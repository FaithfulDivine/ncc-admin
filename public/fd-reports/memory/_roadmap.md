# FD Agent v2 — Roadmap (v2, sửa 2026-04-27 PM)

> **Đại vương đã chỉnh thuộc hạ:** đừng tính timeline cho AI bằng tuần. Roadmap dưới đây tách rõ:
> - **Việc của Đại vương** (chỉ đại vương có credential / brand authority — tính bằng phút khi đại vương click)
> - **Việc của AI** (làm xong trong phiên — không cần lịch)
> - **Việc bottleneck phải đợi data sau auth** (đợi → AI tự làm khi data đến)

---

## 🎯 Q2 2026 Strategic Bet — "Build the dashboard. Drive 3 needles. Earn the right to scale."

**3 needles cần đạt cuối Q2 (2026-06-30):**
1. ROAS blended 7d ≥ **2.0x** trong ≥ 4/8 tuần cuối Q2
2. Email contribution ≥ **12% revenue** (baseline ~6%)
3. FB pipeline gap **< 1 ngày** trong ≥ 30 ngày liên tục

**"Earn the right to scale":** KHÔNG tăng FB spend > 25% so Q1 trong Q2. Chỉ unlock Q3 scale-aggressive nếu cả 3 needle xong.

**Path B alignment:** master 1 channel before expanding. FB đã profitable nhưng efficiency trượt → tháng 5 ưu tiên BOFU (email), tháng 6 mới chạm FB scale.

---

## 🚦 Việc của Đại vương (Human bottleneck — tính bằng phút)

| # | Việc | Vì sao chỉ đại vương làm được | Ước tính |
|---|---|---|---|
| H1 | **Fix FB OAuth token** — Meta Business Manager → reset & generate token mới → paste vào Supabase env | Cần đăng nhập tài khoản Meta của đại vương | **5-10 phút** |
| H2 | **Reconnect Klaviyo MCP** — Cowork → Settings → Connectors → Klaviyo → Authenticate | OAuth flow yêu cầu đại vương click | **2-3 phút** |
| H3 | **Connect Shopify MCP** (cho LTV:CAC) — Cowork → Settings → Connectors → Shopify → Authenticate | Cùng lý do | **2-3 phút** |
| H4 | **Duyệt SCE Recommendations** — đại vương mở mỗi báo cáo, click "Approve" cho scenario AI propose | Brand/budget authority thuộc đại vương | 5-10 phút mỗi báo cáo |
| H5 | **Pause Best Sellers (cũ) trong Meta Ads Manager** | Brand/budget authority | 2 phút |
| H6 | **Quyết Testing campaign** (kill / scale / hold) | Brand/budget authority | 2 phút |

**Tổng thời gian Human:** ~15-25 phút unblock + 5-10 phút mỗi báo cáo Yellow Zone.

→ **Sau khi đại vương xong H1+H2, AI tự backfill 7 ngày data thiếu, log decisions, generate Weekly SCE đầy đủ trong vài phút.**

---

## 🤖 Việc của AI (làm xong trong phiên này — Phase 2-5)

| Phase | Deliverable | Trạng thái |
|---|---|---|
| Phase 1 | Memory layer + KPI backfill 84d + Roadmap/OKRs stub + verify engine v1 + decision log | ✅ Done 2026-04-27 19:55 |
| Phase 2 | 5 template cadence (AM/PM/Weekly/Monthly/Quarterly) + Universal runner | ✅ done in this session |
| Phase 3 | SCE generator (Layer 2-3-4 mọi report) + Decision auto-capture v2 | ✅ done in this session |
| Phase 4 | Scale Readiness Score (10 dimensions) + LTV:CAC framework (skeleton, đợi Shopify data) + Monthly P&L logic | ✅ done in this session |
| Phase 5 | Quarterly Roadmap revision logic + Lessons Learned auto-pattern (3+ decisions cùng pattern → auto-add lesson) | ✅ done in this session |

---

## 📅 Cadence dự kiến sau khi đại vương xong H1+H2

| Nhịp | Output | Trigger |
|---|---|---|
| Daily AM 07:00 | Morning Briefing ≤500 chữ | scheduled |
| Daily PM 19:00 | Tactical Pulse ≤300 chữ | scheduled |
| Weekly Mon 08:00 | Weekly SCE Review (Layer 1-4 đầy đủ) | scheduled |
| Monthly 1st 08:00 | Strategic Review + Scale Readiness Score | scheduled |
| Quarterly 1st (Jan/Apr/Jul/Oct) | Roadmap Revision + Lessons Learned export | scheduled |

---

## 📌 Q2 Phân kỳ ưu tiên (theo nội dung, không theo timeline AI)

### Đợt 1 — Đại vương unblock (15-25 phút thực)
- H1: Fix FB OAuth → AI auto-backfill 7d data thiếu
- H2: Reconnect Klaviyo → AI auto-pull flow + campaign reports
- H3: Connect Shopify → AI auto-build LTV:CAC baseline cohort

### Đợt 2 — AI ship ngay sau Đợt 1 (cùng phiên đại vương unblock)
- Fix Welcome W8UjR5 (1430 recipients $0 doanh thu — biggest leak)
- Ship Cross-sell Fulfilled (UcQjaE) + Shipping:Delivered (WHzVmj)
- Rescue Abandoned Checkout SpCgkC
- Refresh Winback Uheh2Y
- Draft Summer Collection arc 3 email

### Đợt 3 — Đại vương duyệt SCE (5-10 phút mỗi cái)
- H5: Pause Best Sellers cũ
- H6: Quyết Testing campaign
- Approve / reject email drafts AI ship Đợt 2

### Đợt 4 — AI run cadence như đã design (sau khi Đợt 1-3 settle ~ vài giờ)
- Daily AM/PM/Weekly từ ngày kế tiếp
- Monthly Strategic Review đầu tháng 5 + đầu tháng 6
- Quarterly Roadmap Revision đầu tháng 7

---

## 🔄 Q3 2026 (Jul-Sep) — Bet provisional (revise đầu Q3)

Provisional: "Diversify cẩn thận — TikTok hoặc YouTube Shorts pilot, expand affiliate community."
*Chỉ kích hoạt nếu Q2 KR đạt ≥ 60% (Google OKR sweet spot).*

---

## Operating Principles
1. Data over opinions — nhưng tôn trọng experience-based intuition của đại vương.
2. Sustainable over fast — Path B unless explicitly told otherwise.
3. Master 1 channel before expanding (Hormozi).
4. Build institutional knowledge — log everything to memory.
5. **Earn autonomy through results** — AI ship Đợt 2 trước, đợi đại vương duyệt; sau khi đại vương thấy results, mở Green Zone rộng hơn.

---

*Updated: 2026-04-27 20:30 ICT (sau lệnh đại vương "đừng tính timeline AI bằng tuần").*
