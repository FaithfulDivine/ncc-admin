import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Shopify proxy plugin — handles:
 * 1. Token refresh via OAuth client_credentials
 * 2. Order fetching with secret token server-side
 * 3. Persists refreshed token to .env automatically
 */
function shopifyProxy(): Plugin {
  let storeUrl = ''
  let accessToken = ''
  let clientId = ''
  let clientSecret = ''
  let envPath = ''

  function loadCredentials() {
    const env = loadEnv('', process.cwd(), '')
    const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
    storeUrl = clean(env.VITE_SHOPIFY_STORE_URL)
    accessToken = clean(env.SHOPIFY_ACCESS_TOKEN)
    clientId = clean(env.SHOPIFY_CLIENT_ID)
    clientSecret = clean(env.SHOPIFY_CLIENT_SECRET)
  }

  function updateEnvFile(key: string, value: string) {
    try {
      let content = fs.readFileSync(envPath, 'utf-8')
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`)
      } else {
        content += `\n${key}=${value}`
      }
      fs.writeFileSync(envPath, content, 'utf-8')
    } catch {
      // Best effort
    }
  }

  function json(res: ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  async function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString()))
      req.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve({}) }
      })
    })
  }

  return {
    name: 'shopify-proxy',
    configResolved() {
      envPath = path.resolve(process.cwd(), '.env')
      loadCredentials()
    },
    configureServer(server) {
      // ── POST /api/shopify/renew-token ──
      // Refresh token using OAuth client_credentials
      server.middlewares.use('/api/shopify/renew-token', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method not allowed' })
          return
        }

        // Reload in case user updated .env
        loadCredentials()

        if (!clientId || !clientSecret) {
          json(res, 400, {
            error: 'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET in .env',
          })
          return
        }

        if (!storeUrl) {
          json(res, 400, { error: 'Missing VITE_SHOPIFY_STORE_URL in .env' })
          return
        }

        const cleanUrl = storeUrl.replace(/^https?:\/\//, '')

        try {
          // 1. Call Shopify OAuth
          const tokenUrl = `https://${cleanUrl}/admin/oauth/access_token`
          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'client_credentials',
              client_id: clientId,
              client_secret: clientSecret,
            }),
          })

          const result = await response.json()

          if (!response.ok || !result.access_token) {
            const errorMsg = result.errors || result.error_description || JSON.stringify(result)
            json(res, 502, { error: `Shopify OAuth failed: ${errorMsg}` })
            return
          }

          const newToken = result.access_token
          const expiresIn = result.expires_in

          // 2. Update in-memory
          accessToken = newToken

          // 3. Persist to .env
          updateEnvFile('SHOPIFY_ACCESS_TOKEN', newToken)

          // 4. Save to Supabase system_settings (best-effort)
          // This is done from frontend after receiving success

          // 5. Verify token
          let verified = false
          try {
            const verifyUrl = `https://${cleanUrl}/admin/api/2024-10/shop.json`
            const verifyRes = await fetch(verifyUrl, {
              headers: { 'X-Shopify-Access-Token': newToken },
            })
            verified = verifyRes.ok
          } catch {
            // Verification failed but token may still be valid
          }

          const expiresHours = expiresIn ? Math.round(expiresIn / 3600) : null

          json(res, 200, {
            success: true,
            verified,
            expiresInHours: expiresHours,
            masked: '****' + newToken.slice(-4),
            message: verified
              ? `Token renewed! Expires in ${expiresHours || '?'}h. Verified OK.`
              : 'Token renewed but verification failed.',
          })
        } catch (err: any) {
          json(res, 502, { error: `Cannot reach Shopify: ${err.message}` })
        }
      })

      // ── GET /api/shopify/orders ──
      // Handles pagination: fetches all orders in date range (not just first 250)
      server.middlewares.use('/api/shopify/orders', async (req, res) => {
        if (!storeUrl || !accessToken) {
          json(res, 500, { error: 'Shopify not configured. Refresh token first.' })
          return
        }

        try {
          const url = new URL(req.url || '', 'http://localhost')
          const from = url.searchParams.get('from') || ''
          const to = url.searchParams.get('to') || ''

          const cleanStore = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

          let allOrders: any[] = []
          let nextPageUrl: string | null = null
          let pageCount = 0
          const maxPages = 50 // Safety limit to prevent infinite loops

          // Fetch first page
          let apiUrl = `https://${cleanStore}/admin/api/2024-10/orders.json?status=any&created_at_min=${from}&created_at_max=${to}&limit=250`

          while (apiUrl && pageCount < maxPages) {
            pageCount++

            const response = await fetch(apiUrl, {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
            })

            if (!response.ok) {
              json(res, response.status, { error: `Shopify API error: ${response.status}` })
              return
            }

            const data = await response.json()
            allOrders = allOrders.concat(data.orders || [])

            // Check for next page via Link header
            const linkHeader = response.headers.get('link')
            nextPageUrl = null

            if (linkHeader) {
              const links = linkHeader.split(',')
              for (const link of links) {
                if (link.includes('rel="next"')) {
                  const match = link.match(/<([^>]+)>/)
                  if (match) {
                    nextPageUrl = match[1]
                  }
                  break
                }
              }
            }

            apiUrl = nextPageUrl
          }

          json(res, 200, allOrders)
        } catch (err: any) {
          json(res, 500, { error: err.message })
        }
      })

      // ── GET /api/shopify/status ──
      // Check current token status
      server.middlewares.use('/api/shopify/status', async (req, res) => {
        loadCredentials()
        json(res, 200, {
          hasToken: !!accessToken,
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasStoreUrl: !!storeUrl,
          maskedToken: accessToken ? '****' + accessToken.slice(-4) : null,
          storeUrl: storeUrl || null,
        })
      })
    },
  }
}

/**
 * Facebook Ads proxy plugin — handles:
 * 1. Check current FB token status
 * 2. Save manually-pasted token to .env
 * 3. Exchange short-lived token → long-lived via Graph API
 */
function facebookProxy(): Plugin {
  let appId = ''
  let appSecret = ''
  let adAccountId = ''
  let accessToken = ''
  let envPath = ''

  function loadCredentials() {
    const env = loadEnv('', process.cwd(), '')
    // Trim whitespace and null bytes that Windows editors may inject
    const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
    appId = clean(env.FB_APP_ID)
    appSecret = clean(env.FB_APP_SECRET)
    adAccountId = clean(env.FB_AD_ACCOUNT_ID)
    accessToken = clean(env.FB_ACCESS_TOKEN)
  }

  function updateEnvFile(key: string, value: string) {
    try {
      let content = fs.readFileSync(envPath, 'utf-8')
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`)
      } else {
        content += `\n${key}=${value}`
      }
      fs.writeFileSync(envPath, content, 'utf-8')
    } catch {
      // Best effort
    }
  }

  function json(res: ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  async function readBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString()))
      req.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve({}) }
      })
    })
  }

  return {
    name: 'facebook-proxy',
    configResolved() {
      envPath = path.resolve(process.cwd(), '.env')
      loadCredentials()
    },
    configureServer(server) {
      // ── GET /api/facebook/status ──
      server.middlewares.use('/api/facebook/status', async (req, res) => {
        loadCredentials()

        let tokenValid = false
        let tokenExpiry: string | null = null

        // If we have a token, check it against Graph API
        if (accessToken) {
          try {
            const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`
            const debugRes = await fetch(debugUrl)
            const debugData = await debugRes.json()
            if (debugData.data) {
              tokenValid = debugData.data.is_valid === true
              if (debugData.data.expires_at) {
                tokenExpiry = new Date(debugData.data.expires_at * 1000).toISOString()
              }
            }
          } catch {
            // Can't verify, just report what we have
          }
        }

        json(res, 200, {
          hasToken: !!accessToken,
          hasAppId: !!appId,
          hasAppSecret: !!appSecret,
          adAccountId: adAccountId || null,
          maskedToken: accessToken ? '****' + accessToken.slice(-4) : null,
          tokenValid,
          tokenExpiry,
        })
      })

      // ── POST /api/facebook/save-token ──
      // Manually save a pasted token
      server.middlewares.use('/api/facebook/save-token', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method not allowed' })
          return
        }

        const body = await readBody(req)
        const token = body.token

        if (!token || typeof token !== 'string') {
          json(res, 400, { error: 'Missing token in request body' })
          return
        }

        // Save to memory + .env
        accessToken = token.trim()
        updateEnvFile('FB_ACCESS_TOKEN', accessToken)

        json(res, 200, {
          success: true,
          message: 'Facebook token saved to .env',
          masked: '****' + accessToken.slice(-4),
        })
      })

      // ── POST /api/facebook/refresh-token ──
      // Exchange current short-lived → long-lived token
      server.middlewares.use('/api/facebook/refresh-token', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'Method not allowed' })
          return
        }

        loadCredentials()

        if (!appId || !appSecret) {
          json(res, 400, {
            error: 'Missing FB_APP_ID or FB_APP_SECRET in .env',
          })
          return
        }

        // Get token from request body or .env
        const body = await readBody(req)
        const tokenToExchange = body.token || accessToken

        if (!tokenToExchange) {
          json(res, 400, {
            error: 'No FB_ACCESS_TOKEN found. Paste a short-lived token first.',
          })
          return
        }

        try {
          // Exchange for long-lived token via Graph API
          const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenToExchange}`
          const response = await fetch(exchangeUrl)
          const result = await response.json()

          if (!response.ok || result.error) {
            const errMsg = result.error?.message || JSON.stringify(result)
            json(res, 502, { error: `Facebook token exchange failed: ${errMsg}` })
            return
          }

          const newToken = result.access_token
          const expiresIn = result.expires_in // seconds

          // Update in memory + .env
          accessToken = newToken
          updateEnvFile('FB_ACCESS_TOKEN', newToken)

          const expiresInDays = expiresIn ? Math.round(expiresIn / 86400) : null

          json(res, 200, {
            success: true,
            expiresInDays,
            masked: '****' + newToken.slice(-4),
            message: `Long-lived token obtained! Expires in ~${expiresInDays || '?'} days.`,
          })
        } catch (err: any) {
          json(res, 502, { error: `Cannot reach Facebook: ${err.message}` })
        }
      })

      // ── GET /api/facebook/ad-spend ──
      // Fetch campaign performance from Facebook Graph API
      // Query params: from (ISO date), to (ISO date)
      server.middlewares.use('/api/facebook/ad-spend', async (req, res) => {
        loadCredentials()

        if (!accessToken) {
          json(res, 400, { error: 'Facebook token not configured' })
          return
        }

        if (!adAccountId) {
          json(res, 400, { error: 'Facebook Ad Account ID not configured' })
          return
        }

        try {
          const url = new URL(req.url || '', 'http://localhost')
          const from = url.searchParams.get('from') || '' // ISO date string
          const to = url.searchParams.get('to') || ''

          // Build date range filter for Graph API
          // Facebook expects YYYY-MM-DD format
          const fromDate = from ? from.split('T')[0] : new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
          const toDate = to ? to.split('T')[0] : new Date().toISOString().split('T')[0]

          // Ensure ad account ID has act_ prefix
          const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

          // Step 1: Verify token is valid first
          const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`)
          const meData = await meRes.json()
          if (meData.error) {
            json(res, 401, { error: `Facebook token invalid: ${meData.error.message}` })
            return
          }

          // Step 2: Fetch ad insights at account level with bracket notation for time_range
          // time_increment=1 gives daily breakdown
          const insightUrl = `https://graph.facebook.com/v21.0/${actId}/insights?fields=spend,impressions,clicks,reach,campaign_name&time_increment=1&time_range[since]=${fromDate}&time_range[until]=${toDate}&level=campaign&access_token=${accessToken}&limit=500`
          console.log('[FB] Fetching insights:', insightUrl.replace(accessToken, '***'))
          const insightRes = await fetch(insightUrl)
          const insightData = await insightRes.json()

          console.log('[FB] Response status:', insightRes.status, 'data keys:', Object.keys(insightData))

          if (!insightRes.ok || insightData.error) {
            const errMsg = insightData.error?.message || insightData.error?.type || JSON.stringify(insightData.error) || 'Unknown'
            console.error('[FB] Error:', errMsg)
            json(res, 502, { error: `Facebook API error: ${errMsg}` })
            return
          }

          const allInsights: any[] = []
          if (insightData.data) {
            insightData.data.forEach((day: any) => {
              allInsights.push({
                date: day.date_start,
                campaign_name: day.campaign_name || 'Unknown',
                spend: parseFloat(day.spend) || 0,
                impressions: parseInt(day.impressions) || 0,
                clicks: parseInt(day.clicks) || 0,
                reach: parseInt(day.reach) || 0,
              })
            })
          }

          // Handle pagination
          let nextUrl = insightData.paging?.next
          while (nextUrl) {
            const nextRes = await fetch(nextUrl)
            const nextData = await nextRes.json()
            if (nextData.data) {
              nextData.data.forEach((day: any) => {
                allInsights.push({
                  date: day.date_start,
                  campaign_name: day.campaign_name || 'Unknown',
                  spend: parseFloat(day.spend) || 0,
                  impressions: parseInt(day.impressions) || 0,
                  clicks: parseInt(day.clicks) || 0,
                  reach: parseInt(day.reach) || 0,
                })
              })
            }
            nextUrl = nextData.paging?.next
          }

          json(res, 200, allInsights)
        } catch (err: any) {
          json(res, 500, { error: err.message })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), shopifyProxy(), facebookProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
