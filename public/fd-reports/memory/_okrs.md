# FD OKRs — Q2 2026 (v2, sửa 2026-04-27 PM)

> Đại vương quyết: KHÔNG tính timeline AI bằng tuần. OKR scoring theo Google convention 0.0-1.0; sweet spot 0.6-0.7.
> KR target dưới đây là **realistic stretch** dựa trên 84 ngày data + Hormozi Path B principle.

---

## O1 — Khôi phục data infra 100% reliable

| KR | Target | Baseline | Owner | Source check |
|---|---:|---:|---|---|
| **KR1.1** | FB pipeline gap < 1 ngày trong 30 ngày liên tục | gap = 7d (run #10) | Đại vương (H1) | `MAX(date) FROM facebook_ad_spend` |
| **KR1.2** | Klaviyo MCP authenticated trong 30 ngày liên tục | UNAUTH (run #10) | Đại vương (H2) | Tool health check |
| **KR1.3** | Shopify MCP connected + LTV cohort baseline đầu tiên ghi nhận tháng 6 | chưa có | Đại vương (H3) + AI | Shopify orders API |
| **KR1.4** | Reports SLA: ≥ 95% run có data đầy đủ trong tháng 6 | run #10 = 0% Klaviyo | AI | `_kpi_history.json` audit |
| **KR1.5** | Đại vương open Morning Briefing trước 09:00 trong ≥ 70% ngày Q2 (sau khi cadence chạy) | n/a | Đại vương | dashboard `last_opened_at` log |

*Hạ KR1.5 từ 80% → 70% — realistic cho start, có thể stretch sau.*

---

## O2 — Scale FB ads efficiency theo Path B

| KR | Target (v2) | Baseline | Owner | Note |
|---|---:|---:|---|---|
| **KR2.1** | Blended ROAS 7d ≥ **2.0x** trong ≥ 4/8 tuần cuối Q2 (hạ từ 2.30x) | ~1.99x est. | AI propose, Đại vương duyệt | Bằng-bench đã là thắng |
| **KR2.2** | CPC trung bình tháng ≤ $0.50 trong tháng 5 và tháng 6 | tháng 4 ~$0.50 | AI | Supabase 30d agg |
| **KR2.3** | Spend tăng **+25%** vs Q1 ($24.3K → ~$30.4K), CPC ≤ $0.52 (hạ từ +50%) | Q1 spend $24.3K | Đại vương duyệt | Sustainable scale, không saturation |
| **KR2.4** | Tháng 6: **baseline LTV:CAC** ghi nhận (cohort #1 đủ 60d). **Q3-end: target 3:1** (đẩy timing) | unknown | AI + Shopify | Cohort math cần 60d window |

---

## O3 — Build email contribution → 12% revenue cuối Q2

| KR | Target (v2) | Baseline | Owner | Note |
|---|---:|---:|---|---|
| **KR3.1** | Flow revenue ≥ **$400/tuần** trong 4 tuần cuối Q2 (hạ từ $750) | $141.55 | AI ship + Đại vương duyệt | ~3x baseline đã rất stretch |
| **KR3.2** | Campaign revenue ≥ $580/tuần trong 4 tuần cuối Q2 | ~$317 est. | AI ship + Đại vương duyệt | 1.8x — đạt được nếu ship 2 campaign/tuần |
| **KR3.3** | Email-attributed revenue ≥ **12% total cuối Q2; ≥ 20% cuối Q3** (hạ từ 25%) | ~6% | AI + Đại vương | 2x trong 60d khả thi |

---

## Weekly check-in cadence (auto-update mỗi Mon Weekly SCE)

| KR | Score (0-1.0) | Trend | Latest evidence | Risk flag |
|---|:-:|:-:|---|:-:|
| KR1.1 | 0.0 | flat | gap 7d run #10 | 🔴 |
| KR1.2 | 0.0 | flat | unauth run #10 | 🔴 |
| KR1.3 | 0.0 | — | chưa start | 🟡 |
| KR1.4 | n/a | — | chưa đến June | ⚪ |
| KR1.5 | n/a | — | cadence chưa chạy | ⚪ |
| KR2.1 | 0.5 (est. tuần Apr 13-19: 1.99x) | up | spend $3,710 → $578 (1d) | 🟡 |
| KR2.2 | 0.95 (Q1 90d $0.51) | flat | Apr 14-20 rolling $0.474 | 🟢 |
| KR2.3 | n/a | — | chưa kết Q2 | ⚪ |
| KR2.4 | 0.0 | — | chưa Shopify data | 🔴 |
| KR3.1 | 0.35 ($141 / $400) | flat | Welcome $0/1430 recipients | 🔴 |
| KR3.2 | 0.55 (~$317 / $580) | flat | Mother's Day mạnh | 🟡 |
| KR3.3 | 0.5 (~6% / 12%) | flat | cần ship Welcome fix | 🟡 |

**Đầu Q2 score:** 4 đỏ / 4 vàng / 1 xanh / 3 chưa đủ data. Khá hơn version cũ (6 đỏ) vì target realistic hơn.

---

*Updated 2026-04-27 20:35 ICT — sau khi đại vương yêu cầu "đừng tính timeline AI bằng tuần".*
*Source: 84-day Supabase data + Blueprint v1 + Hormozi Path B principle.*
