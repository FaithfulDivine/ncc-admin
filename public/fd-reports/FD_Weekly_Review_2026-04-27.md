# FD Weekly Strategic Review — 2026-04-27 (Mon AM)

**Period reviewed:** Mon 2026-04-20 → Sun 2026-04-26 (vs. Mon 2026-04-13 → Sun 2026-04-19)
**Run ID:** `FD_Weekly_Review_2026-04-27`
**Prior weekly report:** *không có* (đây là weekly review đầu tiên trong `FD_Reports/`)
**Báo cáo 12h gần nhất:** `FD_Report_2026-04-26_PM_1903.md`

> Bẩm đại vương, thuộc hạ tường trình tuần qua. **Nhìn chung tuần này không đánh giá đầy đủ được vì 2 lỗi data infra thuộc hạ phát hiện root-cause mới**: (1) FB OAuth token bị invalidate đúng vào 14:00 UTC ngày 04-21 → 524 sync attempt fail liên tục, (2) Klaviyo MCP unauth run thứ 9. Thuộc hạ ưu tiên báo cáo khúc này lên trước.

---

## 1) Executive Snapshot

### 1.1 Bảng KPI WoW

| Metric | Tuần này (04-20→04-26) | Tuần trước (04-13→04-19) | WoW | Target | Status |
|---|---:|---:|:-:|---:|:-:|
| Revenue 7d | **N/A** *(Klaviyo unauth)* | $7,370.53 | — | $7,000 | ⚪ |
| Orders 7d | **N/A** | 133 | — | 130 | ⚪ |
| AOV | **N/A** | $55.42 | — | $55 | ⚪ |
| Email-attributed rev | **N/A** | $459.19 | — | $1,750 (25%) | ⚪ |
| Flow revenue 7d | **N/A** | $141.55 | — | $700 (rolling) | ⚪ |
| Campaign revenue 7d | **N/A** | ~$317.64 *(est.)* | — | $580 (rolling) | ⚪ |
| **FB Ad Spend** 7d | **$578.35** *(1/7 ngày)* | $3,709.98 *(7/7)* | — | $3,500 | 🔴 incomplete |
| CPC (window có data) | $0.528 *(04-20)* | $0.462 *(7d)* | +14% xấu | $0.45 | 🟡 |
| CPM | $19.39 *(04-20)* | $17.33 *(7d)* | +12% xấu | $13.48–$16.80 | 🟡 |
| CTR | 3.67% *(04-20)* | 3.75% *(7d)* | -2% | 2.5% (ecom) | 🟢 |
| New Customers / CAC / MER | **N/A** | **N/A** *(no Shopify orders)* | — | — | ⚪ |
| ROAS estimate | **N/A** | ~1.99x *(rev/spend)* | — | 2.30x | 🟡 |

> **Bottom line:** Tuần này không đánh giá được vì 2 sự cố data infra (FB OAuth + Klaviyo MCP); nhưng dựa trên tuần trước data đầy đủ, **FB efficiency cải thiện** (CPC -5.5%, CTR +8.7% WoW Apr 6-12 → Apr 13-19), còn **ROAS ước tính 1.99x vẫn dưới target 2.30x ~13.5%**.

### 1.2 Phát hiện root-cause hôm nay (mới)

Khúc này thuộc hạ chưa thấy run 12h trước nào nói rõ:

| Vấn đề | Root-cause | Evidence |
|---|---|---|
| FB pipeline gap 7d | **OAuth token invalidate** vào 2026-04-21 14:00 UTC, không phải lỗi Supabase/Airbyte | `facebook_ad_spend_sync_log`: 524 sync fail liên tiếp, error code `190`, subcode `460` ("session has been invalidated because the user changed their password or Facebook has changed the session for security reasons") |
| Klaviyo MCP "unauth" 9 run | Connector chưa được reconnect ở Cowork | Klaviyo tools không xuất hiện trong deferred tool list run này |

**Hành động fix:** chỉ cần đại vương vào (1) Meta Business Manager → reset & generate token mới, paste vào Supabase Edge Function env / connector setting; (2) Cowork → Tools → Klaviyo → Authenticate. Cron đã chạy đều mỗi 15 phút, sẽ tự backfill 04-21..04-26 ngay khi token valid lại.

---

## 2) Cờ cảnh báo (theo benchmark trong CLAUDE.md)

### 🔴 RED (CRITICAL — escalate ngay)
1. **FB Meta access token invalidated** từ 2026-04-21 14:00 UTC. **524 lần sync fail liên tiếp** trong 5 ngày 14h. Mọi phân tích ROAS/CPC tuần này phụ thuộc fix này. *Đây là ưu tiên #1 — không reauth = mọi báo cáo từ giờ đến cuối tuần đều flat.*
2. **Klaviyo MCP unauthenticated** run thứ 9 liên tiếp (~108h). Toàn bộ email/revenue/flow/campaign visibility = 0%. Mother's Day Email 3, Email 4, Summer Collection — không ai theo dõi được.
3. **Summer Collection deadline 04-27 (HÔM NAY)**. Không thể verify draft đã có chưa, đã schedule chưa. Nếu chưa, miss window launch.

### 🟡 YELLOW (warning)
4. **CPC ngày 04-20 = $0.528** (vs bench $0.45 → +17%). Cao hơn cả CPC trung bình tuần trước ($0.462). Day mới spike — cần theo dõi nếu pipeline mở lại.
5. **CPM ngày 04-20 = $19.39** (vs bench cao nhất $16.80 → +15%). Day spike, cần kiểm tra creative fatigue / audience saturation.
6. **Testing campaign daily rate $157/ngày** ngày 04-20 (xuống từ $209/ngày 04-19). Đang có dấu hiệu giảm nhưng vẫn cao hơn pre-spike $129/ngày → verification "spend giảm ≥ 50%" KHÔNG đạt. Quyết định pause/giảm budget vẫn pending.
7. **ROAS tuần trước 1.99x** vs target 2.30x (-13.5%). Tuần Mother's Day mạnh nhưng ad spend cũng tăng +27% → ROAS chưa đạt mục tiêu.
8. **Flow revenue tuần trước $141.55** ≈ $607/tháng = **20% target $3,000/tháng**. Chậm cả tháng nay — Welcome flow `Sy4yQ7` 1,430 recipients vẫn $0 doanh thu.

### 🟢 GREEN
9. **CTR tuần trước 3.75%** vs bench ecom 2.5% → +50% (rất tốt, sustained 2 tuần liền).
10. **Spend WoW Apr 6-12 → Apr 13-19** đạt +27% scale có kiểm soát; CPC đồng thời giảm 5.5% — efficiency cải thiện khi scale, đúng với Path B.

---

## 3) Ad Creative Analysis

### 3.1 Performance theo campaign (tuần trước 04-13 → 04-19, 7d data đầy đủ)

| Rank | Campaign | Spend 7d | Imp | Clicks | CTR | CPC | CPM | Bench check |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | All US Shirt Product link tăng Spend Campain 20/03 | **$1,449.68** | 87,699 | 3,166 | 3.61% | **$0.458** | $16.53 | CPC ~bench (+1.8%) · CTR ✅ · CPM ✅ |
| 2 | Best Sellers Catalog | $970.79 | 50,754 | 1,945 | 3.83% | $0.499 | $19.13 | CPC +11% xấu · CTR ✅ · CPM xấu |
| 3 | Testing | $941.96 | 52,011 | 2,047 | **3.94%** | $0.460 | $18.11 | CPC ~bench · CTR ✅ · CPM xấu nhẹ |
| 4 | Best Sellers | $347.55 | 23,609 | 866 | 3.67% | **$0.401** | **$14.72** | **CPC ✅ · CPM ✅ best efficiency** |

### 3.2 Winners
- **"Best Sellers"** — CPC $0.401 (-11% vs bench), CPM $14.72 (đúng giữa range), CTR 3.67%. Spend nhỏ ($347) nhưng efficiency cao nhất → đề xuất **scale 2x ($700/tuần)** sau khi token fix.
- **"All US Shirt"** — top spender ($1,449) vẫn giữ CPC $0.458 ~bench, CTR 3.61%. Là cỗ máy chính, không nên chạm.
- **"Testing"** — CTR cao nhất 3.94%, CPC $0.460. Mặc dù daily rate vẫn cao hơn pre-spike nhưng signal creative tốt; **rút ra winning angle để clone sang campaign mới**.

### 3.3 Losers
- ⚠️ **"Best Sellers Catalog"** — CPM $19.13 vượt bench top 14%, CPC $0.499 vượt 11%. **Catalog format đang fatigue** so với Best Sellers manual selection. Đề xuất: pause hoặc giảm budget 50%.
- ⚠️ **Day-by-day CPC volatility**: 04-09 CPC $0.675, 04-10 $0.586, 04-17 $0.538, 04-20 $0.528 — rõ ràng CPC tăng cuối tuần và day Mother's Day promo, kiểm tra audience saturation.

### 3.4 Creative angles đề xuất tuần tới (nếu token fix được)
1. **"Modest Mother's Day"** — clone winning Testing angle, kết hợp Mother's Day theme; chạy 04-30 → 05-09 (10 ngày).
2. **"Summer Collection Teaser"** — promo new collection (deadline đã trễ 1 ngày), creative faith-based summer style (modest, sáng).
3. **"Best Sellers Bundle"** — bundle 2-3 best-seller áo, AOV uplift ~30%.

---

## 4) Email Performance Deep Dive

> **⚠️ Klaviyo MCP unauthenticated run thứ 9 liên tiếp.** Section này dùng dữ liệu lần cuối pull được (04-20 AM, window 04-13 → 04-19) — không có data tuần 04-20 → 04-26.

### 4.1 Campaign tuần trước (Apr 13-19) đã sent

| Campaign | Status | Send Time | Note |
|---|---|---|---|
| FD - Mother's Day 2026 - Email 2 (Gift Guide) | ✅ Sent | 2026-04-17 17:03 UTC | A/B "What do you give…" / "Proverbs 31:25…". Est. revenue ~$238. |
| FD - Mother's Day 2026 - Email 3 (Shipping Cutoff) | 📝 Draft | null | Cần schedule ~04-30 hoặc 05-01 |
| FD - Mother's Day 2026 - Email 4 (Last Call) | 📝 Draft | null | Cần schedule ~05-09 |
| Summer Collection 2026 Launch | 📝 Draft | null | **Deadline 04-27 — TRỄ 1 ngày** |

### 4.2 Flow performance (snapshot lần cuối)

**Top revenue flows (7d Apr 13-19):**

| # | Flow | ID | Recipients | Open | Click | Revenue |
|---|---|---|---:|---:|---:|---:|
| 1 | MPG - Browse Abandonment T2.26 | `SsEfTC` | 117 | 42.74% | 1.71% | **$66.79** |
| 2 | MPG - Thank You Flow T2.26 | `R3WTZW` | 365 | 43.41% | 6.04% | $41.87 |
| 3 | MPG - Abandoned Add to Cart T2.26 | `Y5vBpn` | 68 | 30.88% | 2.94% | $32.89 |
| **Total** | | | | | | **$141.55** |

**Vẫn $0 revenue (cần action):**
- **Welcome Series** `Sy4yQ7` — 1,430 recipients, click 0.64%, $0. *Volume lớn nhất account, hiệu suất tệ nhất.*
- **Fulfilled** `UcQjaE` — 201 rec, $0, click giảm -17% (8.99% → 7.46%). Cross-sell block chưa ship.
- **MPG - Shipping: Delivered** `WHzVmj` — 168 rec, click 0%, $0. Không có CTA.
- **Browse Abandonment** `SsEfTC` — top revenue nhưng click rate 1.71% còn thấp; redesign thì có thể double.
- **Customer Winback** `Uheh2Y` — open 35% click 2.5% (đã hồi phục) nhưng vẫn $0 revenue. Cần thay subject line + offer.

### 4.3 So với target 25–35% email attribution

- Tuần trước email-attributed rev = $459.19 / total revenue $7,370.53 = **6.2%**
- Vs target 25–35% → **gap 19–29 percentage points** = thiếu khoảng **$1,300–$2,150/tuần** doanh thu email
- Root cause: flow $141.55 (chỉ 3 flow tạo doanh thu) + campaign chỉ gửi 1/tuần

### 4.4 Đề xuất email cho tuần tới
1. **Schedule Summer Collection Teaser HÔM NAY** (deadline đã trễ 1 ngày) — gửi tới `Subscriber List UdxzRE`
2. **Schedule Mother's Day Email 3 (Shipping Cutoff)** cho 04-30 hoặc 05-01
3. **Refresh Welcome Series Email 1** (`Sy4yQ7`) — A/B subject mới, mục tiêu click ≥ 3%, ít nhất $1 revenue/recipient
4. **Ship cross-sell block** vào flow `UcQjaE` Fulfilled + `WHzVmj` Shipping:Delivered
5. **Redesign Browse Abandonment** (`SsEfTC`) — thêm 3-product carousel + scarcity timer

---

## 5) SCE Analysis

### Scenario 1: Data Infrastructure Outage Toàn Diện

**S — Scenario:**
Cùng lúc 2 nguồn data chính chết: (1) FB Meta token expire 04-21 14:00 UTC → **524 sync fail liên tiếp** trong 5 ngày 14h, MAX(date)=04-20. (2) Klaviyo MCP unauthenticated từ run 04-22 PM → run thứ 9. (3) Shopify orders cache 0 rows (chưa từng sync).
→ **Hệ quả: 5 ngày gần nhất (04-21 → 04-26) gần như mù hoàn toàn về performance.**

**C — Consequence:**
- Nếu fix trong 24h: backfill tự động (cron đã chạy mỗi 15 phút), không miss data; chỉ mất 1 ngày phân tích chậm. **Rủi ro thấp.**
- Nếu KHÔNG fix trong 48h tới: miss Summer Collection launch window, miss Mother's Day Email 3 timing (04-30 cutoff), không phát hiện được nếu spend rời tay → có thể đốt $200/ngày × 7 = **~$1,400 lãng phí potential** không ai nhìn thấy. ROAS không đo được = quyết định scale/pause sai.
- Nếu KHÔNG fix Klaviyo: không gửi được campaign mới (đại vương vẫn cần MCP để duyệt draft), email attribution % không đo được → không biết Path B email mục tiêu 25–35% có đạt không.

**E — Execution (3 phương án):**

#### Option A: Đại vương fix cả 2 trong sáng nay (recommended)
- **Pros:** restore đầy đủ visibility trong 4–6h; backfill tự động 04-21..04-26; Summer Collection vẫn kịp launch trong tuần.
- **Cons:** mất ~30 phút thao tác (Meta token regenerate + paste vào Supabase secrets; Cowork → Klaviyo Authenticate).
- **Expected impact:** restore 100% visibility, ROAS đo được, có thể phát hiện và pause Testing campaign nếu cần.

#### Option B: Hoãn fix, chạy "blind mode" thêm 1 tuần
- **Pros:** không tốn thời gian.
- **Cons:** mọi báo cáo 12h tiếp theo flat; quyết định scale/pause Testing không dữ liệu; có thể đốt thêm $1,400 trong 7 ngày tới mà không đo được hiệu quả; miss Summer Collection launch.
- **Expected impact:** **rủi ro $1,400 spend mù** + opportunity cost Summer Collection.

#### Option C: Pause toàn bộ FB ads cho đến khi fix
- **Pros:** không đốt budget mù.
- **Cons:** pause 1 tuần làm mất momentum Mother's Day; mất Pixel learning data; test campaigns reset.
- **Expected impact:** save $1,400 nhưng mất ~$2,000–$3,000 doanh thu Mother's Day.

**💡 Thuộc hạ đề xuất: Option A.** Align Path B (sustainable scale): không thể "scale bền vững" mà thiếu visibility. Fix 2 token trong sáng nay là cheapest, lowest-risk. Sau fix, mọi quyết định optimization đều có data. Thuộc hạ tự verify được trong run 12h chiều nay nếu reauth thành công.

---

### Scenario 2: ROAS Tuần Trước 1.99x — Mother's Day Push KHÔNG Đạt Target 2.30x

**S — Scenario:**
Tuần Apr 13-19 revenue $7,370.53 (+45.5% WoW), nhưng FB ad spend cùng lúc tăng **+27%** lên $3,709.98. ROAS estimate $7,370 / $3,710 = **1.99x** vs target 2.30x → **gap -13.5%**. AOV $55.42 (+1.7% — không đáng kể). Order +43% nhưng chủ yếu từ revenue mở rộng top-of-funnel, không phải uplift CVR.
→ Mother's Day Email 2 chỉ đóng góp ~$238 (3.2% revenue tuần) → email không phải driver chính, FB ads gánh hầu hết.

**C — Consequence:**
- Nếu giữ nguyên cấu trúc spend: ROAS sẽ tiếp tục ~2x cho đến hết Mother's Day window (~05-10). Tổng spend tuần nay + 2 tuần tới ước ~$11,000, revenue ước ~$22,000. **Profit gap so với target 2.30x ROAS = ~$3,000 thiếu hụt** (margin 30%).
- Nếu rebalance về Best Sellers (CPC $0.401, CPM $14.72): có thể đẩy ROAS lên ~2.2x → save ~$2,000 spend.
- Nếu không fix Welcome flow $0: tiếp tục mất ~$2,500/tháng email opportunity.

**E — Execution (3 phương án):**

#### Option A: Rebalance ad budget — cắt Best Sellers Catalog, scale Best Sellers
- Cắt "Best Sellers Catalog" -50% (CPM xấu, fatigue); scale "Best Sellers" +100% ($350 → $700/tuần); giữ "All US Shirt" và "Testing" nguyên.
- **Pros:** tận dụng campaign efficiency cao nhất; test scale có giảm efficiency không.
- **Cons:** rủi ro Best Sellers efficiency giảm khi scale 2x.
- **Expected impact:** ROAS từ 1.99x lên 2.15–2.25x trong 2 tuần.

#### Option B: Tăng email frequency để đẩy email attribution lên 25%
- Schedule MD Email 3 (04-30), MD Email 4 (05-09), thêm MD Email 5 (05-04 mid-week reminder).
- Schedule Summer Collection Teaser 04-28, Email 2 04-30, Launch 05-02.
- **Pros:** email là kênh "free" so với ads (ROAS email 30x+); không tốn ad budget.
- **Cons:** rủi ro unsub rate tăng nếu schedule dày; cần check Klaviyo unsub_rate sau mỗi send.
- **Expected impact:** email-attributed rev từ $459 → $1,500/tuần (3.3x), tổng ROAS blended cải thiện.

#### Option C: Hold position — chấp nhận ROAS 2x trong Mother's Day window
- **Pros:** không thay đổi rủi ro; Mother's Day là dịp đặc biệt, ROAS thấp hơn bình thường acceptable.
- **Cons:** mất cơ hội optimize; potential $2-3K profit thiếu hụt.
- **Expected impact:** ROAS giữ ~2.0x đến hết MD window.

**💡 Thuộc hạ đề xuất: Option A + Option B chạy song song.** Path B = sustainable scale, không mâu thuẫn — A optimize ad spend (đã có signal Best Sellers efficiency cao), B tận dụng kênh free (email) trước khi đốt thêm ad. Chỉ cần đại vương duyệt rebalance + thuộc hạ schedule emails sau khi Klaviyo reauth.

---

### Scenario 3: Welcome Series Email 1 — 1,430 Subscribers $0 Revenue

**S — Scenario:**
Welcome Series flow `Sy4yQ7` có volume cao nhất account (1,430 recipients/7d) nhưng:
- Open rate 33.97% (gần benchmark 35% → OK)
- **Click rate 0.64%** (vs bench 3% → -78% xấu)
- Revenue **$0** suốt 7d window
→ Mỗi tuần "đốt" 1,430 cơ hội first-touch của Subscriber mới mà không convert được ai.

**C — Consequence:**
- Nếu giữ nguyên: tiếp tục bỏ qua **~6,000 subscriber/tháng** không có CTA hiệu quả. Welcome flow thường là 20–30% revenue email → đang mất ~**$600–$900/tháng** revenue tiềm năng.
- Nếu redesign: Click rate 0.64% → 3% (5x); với 1,430 rec × 3% × $40 AOV × 5% CVR ≈ **~$86/tuần** revenue add-on (~$370/tháng). Đạt target $700 flow rolling.

**E — Execution (3 phương án):**

#### Option A: Refresh subject + thêm hero image + 1 CTA rõ ("Shop New Arrivals")
- **Pros:** quick win, ~2h work; Path B alignment (không tốn ad).
- **Cons:** click 0.64% có thể là vấn đề nội dung sâu hơn (offer, audience targeting, send time).
- **Expected impact:** click 1.5–2% (gấp 2-3x), revenue $30–$60/tuần.

#### Option B: Full redesign Welcome 3-email series
- Email 1 (immediate): Brand story + 10% discount code
- Email 2 (Day 2): Best Sellers showcase (ride on top campaign)
- Email 3 (Day 5): Customer testimonial + faith-based UVP
- **Pros:** standard Welcome best practice; mỗi email layer additive; expected click 3-5%.
- **Cons:** 1-2 ngày work; cần đại vương duyệt copy + offer.
- **Expected impact:** click 3%+, revenue $86–$150/tuần ($350–$650/tháng).

#### Option C: Build segment "Welcome 30-day" thay vì flow
- Audience-based campaign manual mỗi tuần thay vì automation flow.
- **Pros:** kiểm soát được nội dung từng tuần.
- **Cons:** cần manual lao động; mất automation advantage.
- **Expected impact:** medium, không tận dụng được trigger.

**💡 Thuộc hạ đề xuất: Option B.** Welcome flow là asset trọng tâm — tiền đầu tư 1 lần, thu cả năm. Path B align: focus vào tài sản bền vững thay vì burn ad spend. Sau Klaviyo reauth, thuộc hạ có thể draft 3 email + đại vương duyệt là ship được trong tuần.

---

## 6) Top 3 Action Items tuần tới (xếp theo ROI)

| # | Action | Owner | Effort | Expected Impact | Deadline |
|---|---|---|---|---|---|
| 1 | **Reauth Meta FB token + Klaviyo MCP** (root cause của 2 outage) | 👑 Đại vương | 30 phút | Restore 100% visibility, unlock mọi action #2-#3 | **Hôm nay 04-27 EOD** |
| 2 | **Schedule Summer Collection Teaser + MD Email 3 + MD Email 4** (3 email đã có draft) | 🤖 AI (sau khi reauth) | 1h | +$500–$1,000 email revenue tuần này | 04-28 |
| 3 | **Rebalance ad budget**: cắt Best Sellers Catalog -50%, scale Best Sellers +100% | 👑 Đại vương duyệt → 🤖 AI ship | 30 phút duyệt + 1h ship | ROAS 1.99x → 2.15-2.25x | 04-29 |

**Phụ trợ (zone xanh, AI tự ship sau reauth):**
4. Refresh Welcome Series Email 1 (`Sy4yQ7`) — copy mới
5. Ship cross-sell block cho Fulfilled (`UcQjaE`) + Shipping:Delivered (`WHzVmj`)
6. Refresh Winback (`Uheh2Y`) subject line
7. Redesign Browse Abandonment (`SsEfTC`) — 3-product carousel

---

## 7) Câu hỏi cần đại vương quyết

1. **Meta FB token** — đại vương có thể reauth trong sáng nay không? Nếu cần thuộc hạ hướng dẫn step-by-step (Meta Business Manager → System Users → regenerate access token → paste vào Supabase Edge Function secrets), thuộc hạ viết ngay.
2. **Klaviyo MCP** — đại vương vào Cowork → Tools → Klaviyo → Authenticate được chứ? Run thứ 9 liên tiếp rồi.
3. **Testing campaign** — đại vương chốt: pause hoàn toàn / giảm budget 50% / để nguyên? Spend vẫn cao hơn pre-spike $129/ngày dù đã giảm từ $209 → $157.
4. **Best Sellers scale +100%** — đại vương duyệt scale từ $50/ngày → $100/ngày trong 7 ngày tới chứ? (Phải có data để verify, đợi sau reauth)
5. **Summer Collection deadline** — Email 1 cần gửi trong 24h, đại vương duyệt gửi cho `Subscriber List UdxzRE` (main list) chứ?
6. **ROAS target trong window Mother's Day** — chấp nhận 2.0x trong 2 tuần MD và quay về 2.30x sau, hay siết chặt 2.30x ngay tuần này?

---

## NGUỒN DỮ LIỆU
- **[Supabase]** `facebook_ad_spend` (project `zcmvvpizoipxehximabk`) — pulled OK qua 04-20.
- **[Supabase]** `facebook_ad_spend_sync_log` — root-cause OAuth invalidation phát hiện hôm nay.
- **[Klaviyo API]** flow_report, campaigns, metric_aggregate, lists — **UNAUTHENTICATED** (run 9). Snapshot lần cuối từ run 04-20 AM.
- **[Estimated]** ROAS = Klaviyo Placed Order ÷ FB spend; chỉ available cho window 04-13 → 04-19.
- **[CLAUDE.md]** benchmarks: ROAS 2.30x · CPC $0.45 · CPM $13.48–$16.80 · CTR ecom 2-3% · Flow $3K/tháng · Campaign $2.5K/tháng · Unsub safe < 0.5% / alert > 0.8%.

---

*Run by AI thuộc hạ — sáng thứ Hai weekly review.*
