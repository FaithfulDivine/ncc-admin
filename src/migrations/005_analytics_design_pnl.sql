-- 005_analytics_design_pnl.sql
-- Design-level aggregation RPC for /analytics/ads page.
-- Reuses fb_curator.decisions (latest successful run) + public.facebook_ad_spend.
-- Strips suffix from product_title to roll up POD variants → design.
-- Allocates campaign-level FB spend to designs proportional to UNITS
-- (not revenue — revenue-based allocation makes ROAS uniform and useless for ranking).

-- ── Suffix-strip helper ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adpnl_strip_suffix(t text)
RETURNS TABLE(design_name text, product_type text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN t ~* ' Premium T-?shirts?$'       THEN regexp_replace(t, ' Premium T-?shirts?$', '', 'i')
      WHEN t ~* ' Long Sleeve T-?shirts?$'   THEN regexp_replace(t, ' Long Sleeve T-?shirts?$', '', 'i')
      WHEN t ~* ' Youth T-?shirts?$'         THEN regexp_replace(t, ' Youth T-?shirts?$', '', 'i')
      WHEN t ~* ' Long Sleeves?$'            THEN regexp_replace(t, ' Long Sleeves?$', '', 'i')
      WHEN t ~* ' Sweatshirts?$'             THEN regexp_replace(t, ' Sweatshirts?$', '', 'i')
      WHEN t ~* ' Hoodies?$'                 THEN regexp_replace(t, ' Hoodies?$', '', 'i')
      WHEN t ~* ' T-?shirts?$'               THEN regexp_replace(t, ' T-?shirts?$', '', 'i')
      WHEN t ~* ' Tank Tops?$'               THEN regexp_replace(t, ' Tank Tops?$', '', 'i')
      ELSE t
    END::text AS design_name,
    CASE
      WHEN t ~* ' Premium T-?shirts?$'       THEN 'Premium T-shirt'
      WHEN t ~* ' Long Sleeve T-?shirts?$'   THEN 'Long Sleeve T-shirt'
      WHEN t ~* ' Youth T-?shirts?$'         THEN 'Youth T-shirt'
      WHEN t ~* ' Long Sleeves?$'            THEN 'Long Sleeve'
      WHEN t ~* ' Sweatshirts?$'             THEN 'Sweatshirt'
      WHEN t ~* ' Hoodies?$'                 THEN 'Hoodie'
      WHEN t ~* ' T-?shirts?$'               THEN 'T-shirt'
      WHEN t ~* ' Tank Tops?$'               THEN 'Tank Top'
      ELSE 'T-shirt'
    END::text AS product_type;
$$;

COMMENT ON FUNCTION public.adpnl_strip_suffix IS
  'Strips POD suffix from Shopify product title → (design_name, product_type). Bare titles default to T-shirt.';

-- ── Main RPC ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.analytics_design_pnl(
  p_breakeven  numeric DEFAULT 1.5,
  p_watch_low  numeric DEFAULT 1.2
)
RETURNS TABLE(
  run_id              uuid,
  window_since        date,
  window_until        date,
  total_fb_spend      numeric,
  total_revenue       numeric,
  total_units         integer,
  design_name         text,
  product_types       text[],
  variants_count      integer,
  shopify_units       integer,
  shopify_recent_30d  integer,
  shopify_revenue     numeric,
  avg_unit_price      numeric,
  refund_pct          numeric,
  revenue_share_pct   numeric,
  fb_spend_allocated  numeric,
  roas_est            numeric,
  category            text,
  sample_titles       text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  WITH latest_run AS (
    SELECT r.id, r.window_since, r.window_until
    FROM fb_curator.runs r
    WHERE r.status = 'success'
      AND EXISTS (SELECT 1 FROM fb_curator.decisions d WHERE d.run_id = r.id)
    ORDER BY r.started_at DESC
    LIMIT 1
  ),
  excl_patterns AS (
    SELECT pattern FROM public.cogs_exclusions
    UNION ALL
    SELECT product_name FROM public.cogs_physical_products
    UNION ALL
    -- Jewelry / service keywords fallback
    SELECT p FROM (VALUES
      ('Upgrade to 1-Day Production'),
      ('Peace Of Mind Protection'),
      ('Bead Bracelet Charm'),
      ('Jesus Cross Necklace')
    ) AS x(p)
  ),
  decisions AS (
    SELECT
      d.variant_id,
      d.product_id,
      d.product_title,
      d.shopify_units,
      d.shopify_revenue,
      d.shopify_refund_pct,
      d.shopify_recent_units_30d,
      s.design_name,
      s.product_type,
      EXISTS (
        SELECT 1 FROM excl_patterns e
        WHERE d.product_title ILIKE e.pattern
           OR d.product_title ILIKE e.pattern || '%'
      ) AS is_excluded
    FROM fb_curator.decisions d
    JOIN latest_run lr ON lr.id = d.run_id
    CROSS JOIN LATERAL public.adpnl_strip_suffix(d.product_title) s
  ),
  included AS (SELECT * FROM decisions WHERE NOT is_excluded),
  fb_total AS (
    SELECT COALESCE(SUM(spend), 0) AS total_spend
    FROM public.facebook_ad_spend fas
    JOIN latest_run lr ON fas.date BETWEEN lr.window_since AND lr.window_until
  ),
  totals AS (
    SELECT
      COALESCE(SUM(shopify_revenue), 0)::numeric AS total_rev,
      COALESCE(SUM(shopify_units), 0)::integer AS total_units
    FROM included
  ),
  by_design AS (
    SELECT
      design_name,
      array_agg(DISTINCT product_type ORDER BY product_type) AS product_types,
      count(*)::integer AS variants_count,
      COALESCE(SUM(shopify_units), 0)::integer AS shopify_units,
      COALESCE(SUM(shopify_recent_units_30d), 0)::integer AS shopify_recent_30d,
      COALESCE(SUM(shopify_revenue), 0)::numeric AS shopify_revenue,
      CASE
        WHEN SUM(shopify_units) > 0
          THEN (SUM(shopify_refund_pct * shopify_units) / SUM(shopify_units))::numeric
        ELSE 0::numeric
      END AS refund_pct,
      (array_agg(DISTINCT product_title ORDER BY product_title))[1:5] AS sample_titles
    FROM included
    GROUP BY design_name
  )
  SELECT
    (SELECT id           FROM latest_run) AS run_id,
    (SELECT window_since FROM latest_run) AS window_since,
    (SELECT window_until FROM latest_run) AS window_until,
    (SELECT total_spend  FROM fb_total)   AS total_fb_spend,
    (SELECT total_rev    FROM totals)     AS total_revenue,
    (SELECT total_units  FROM totals)     AS total_units,
    b.design_name,
    b.product_types,
    b.variants_count,
    b.shopify_units,
    b.shopify_recent_30d,
    b.shopify_revenue,
    CASE WHEN b.shopify_units > 0 THEN (b.shopify_revenue / b.shopify_units)::numeric ELSE 0::numeric END AS avg_unit_price,
    b.refund_pct,
    CASE WHEN (SELECT total_rev FROM totals) > 0
      THEN (100.0 * b.shopify_revenue / (SELECT total_rev FROM totals))::numeric
      ELSE 0::numeric END AS revenue_share_pct,
    -- Allocation by UNITS (not revenue) so ROAS varies across designs
    CASE WHEN (SELECT total_units FROM totals) > 0
      THEN ((SELECT total_spend FROM fb_total) * b.shopify_units / (SELECT total_units FROM totals))::numeric
      ELSE 0::numeric END AS fb_spend_allocated,
    CASE
      WHEN (SELECT total_spend FROM fb_total) <= 0 OR b.shopify_units <= 0 THEN NULL
      ELSE (b.shopify_revenue / ((SELECT total_spend FROM fb_total) * b.shopify_units / (SELECT total_units FROM totals)))::numeric
    END AS roas_est,
    CASE
      WHEN (SELECT total_spend FROM fb_total) <= 0 THEN 'no_spend'
      WHEN b.shopify_units <= 0 THEN 'dormant'
      WHEN (b.shopify_revenue / ((SELECT total_spend FROM fb_total) * b.shopify_units / (SELECT total_units FROM totals))) >= p_breakeven THEN 'top_profit'
      WHEN (b.shopify_revenue / ((SELECT total_spend FROM fb_total) * b.shopify_units / (SELECT total_units FROM totals))) >= p_watch_low  THEN 'middle'
      ELSE 'top_loss'
    END AS category,
    b.sample_titles
  FROM by_design b
  ORDER BY b.shopify_revenue DESC;
$$;

COMMENT ON FUNCTION public.analytics_design_pnl IS
  'Design-level P&L for Analytics/Ads page. Aggregates fb_curator.decisions (latest successful run) into designs via suffix strip. Allocates campaign FB spend proportional to UNITS. Returns per-design ROAS estimate + category (top_profit / middle / top_loss / no_spend / dormant).';

GRANT EXECUTE ON FUNCTION public.analytics_design_pnl(numeric, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adpnl_strip_suffix(text) TO anon, authenticated;
