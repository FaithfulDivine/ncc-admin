# FLOW FIX PLAYBOOK — Đòn 2: Sửa 4 Flow Hỏng

**Tài liệu làm việc** — tạo ngày 17/04/2026
**Mục tiêu:** 4 flow đang về $0/tháng → $500-800/tháng (không cần thêm 1 subscriber nào)
**Nguồn dữ liệu:** Klaviyo report 90 ngày (last_90_days), metric conversion = Placed Order (XaHPrt)

---

## MỤC LỤC

1. [Tóm tắt hiện trạng 4 flow](#1-tóm-tắt-hiện-trạng-4-flow)
2. [Flow A — Browse Abandonment (SsEfTC)](#flow-a--browse-abandonment-sseftc)
3. [Flow B — Add to Cart Abandonment (Y5vBpn)](#flow-b--add-to-cart-abandonment-y5vbpn)
4. [Flow C — Customer Winback (Uheh2Y)](#flow-c--customer-winback-uheh2y)
5. [Flow D — Welcome Series E2-E5 (Sy4yQ7)](#flow-d--welcome-series-e2-e5-sy4yq7)
6. [Offer code cần tạo](#6-offer-code-cần-tạo)
7. [Lộ trình triển khai 7 ngày](#7-lộ-trình-triển-khai-7-ngày)
8. [Quyết định đại vương cần duyệt](#8-quyết-định-đại-vương-cần-duyệt)

---

## 1. TÓM TẮT HIỆN TRẠNG 4 FLOW

### 1.1. Tổng thiệt hại

| Flow | 90-day Recipients | 90-day Revenue | 90-day RPR | Benchmark RPR | Mất/tháng |
|---|---|---|---|---|---|
| Browse Abandonment | 680 | $66.79 | $0.10 | $0.20 | ~$20-30 |
| Add-to-Cart Abandon | 279 | $32.89 | $0.12 | $0.40 | ~$40-60 |
| Customer Winback | 592 | **$0** | **$0** | $0.10 | ~$20 |
| Welcome Series | 7,059 | $738.83 | $0.10 | $0.50 | **$650-900** |
| **TỔNG** | **8,610** | **$838.51** | | | **~$730-1,010/tháng** |

> **Kết luận:** Welcome Series là con voi thật. Browse/ATC/Winback cộng lại chỉ ~$80-110/tháng. Ưu tiên rewrite phải đặt Welcome Series lên top.

### 1.2. Bảng message IDs đầy đủ (đã audit lại từ Klaviyo report)

| Flow | Message ID | Tên | 90d Rec | Open | Click | Conv | Revenue | RPR |
|---|---|---|---|---|---|---|---|---|
| **SsEfTC** Browse | Uf69q7 | Browse_1 | 186 | 37.6% | 2.15% | 0.54% | $66.79 | $0.36 ✅ |
| SsEfTC | RcCaEn | Browse_2 | 174 | 37.9% | 2.30% | 0% | $0 | $0 ❌ |
| SsEfTC | WzTPbP | Browse_3 | 161 | 37.3% | 1.86% | 0% | $0 | $0 ❌ |
| SsEfTC | SUqMPt | Browse_4 | 159 | 43.4% | 0.63% | 0% | $0 | $0 ❌ |
| **Y5vBpn** ATC | S5cUfi | ATC_1 | 76 | 33.3% | 0% | 1.33% | $32.89 | $0.44 ⚠️ |
| Y5vBpn | XsuyLK | ATC_2 | 72 | 29.6% | 2.82% | 0% | $0 | $0 ❌ |
| Y5vBpn | WPtwa8 | ATC_3 | 69 | 32.4% | 1.47% | 0% | $0 | $0 ❌ |
| Y5vBpn | XYSm3Y | ATC_4 | 62 | 31.1% | 1.64% | 0% | $0 | $0 ❌ (1.64% unsub!) |
| **Uheh2Y** Winback | W5Eaxt | Winback E1 | 286 | 34.6% | 0.35% | 0% | $0 | $0 ❌ |
| Uheh2Y | T3cbMJ | Winback E2 | 306 | 34.4% | 0.33% | 0% | $0 | $0 ❌ |
| **Sy4yQ7** Welcome | W8UjR5 | Welcome_Email 1 | 1,592 | 41.5% | 1.17% | 0.19% | $239.50 | $0.16 ⚠️ |
| Sy4yQ7 | **WFi88i** | Welcome_Email 2 | 1,465 | 37.8% | 1.11% | 0.07% | $38.27 | $0.03 ❌ |
| Sy4yQ7 | **SiaMMV** | Welcome_Email 3 | 1,400 | 33.5% | 0.65% | **0%** | **$0** | **$0 ❌** |
| Sy4yQ7 | R48GyF | Welcome_Email 4 | 1,323 | 33.9% | 0.92% | 0.23% | $148.84 | $0.11 ⚠️ |
| Sy4yQ7 | Sdxxsx | Welcome_Email 5 | 1,279 | 39.9% | 0.55% | 0.40% | $312.22 | $0.25 ⚠️ |

> ⚠️ **ĐÍNH CHÍNH:** Thứ tự Welcome cũ trong `references/klaviyo-account.md` sai. Đúng là W8UjR5(E1) → WFi88i(E2) → SiaMMV(E3) → R48GyF(E4) → Sdxxsx(E5). Cần cập nhật reference.

---

## FLOW A — BROWSE ABANDONMENT (SsEfTC)

### Hiện trạng (90 ngày)
- **Tổng:** 680 recipients, $66.79 revenue, $0.10 RPR
- **Trigger:** Viewed Product (không mua trong X giờ)
- **Cấu trúc:** 4 email trong 1 chuỗi
- **Vấn đề:** Email 1 có đóng góp, nhưng E2-E3-E4 **hoàn toàn không tạo conversion**

### Chẩn đoán

| Email | Issue chính | Giả thuyết |
|---|---|---|
| Browse_1 (Uf69q7) | RPR $0.36 tốt, nhưng click rate chỉ 2.15% | CTA có thể cải thiện; hook subject đã ổn |
| Browse_2 (RcCaEn) | 37.9% open nhưng 0% conv | Nội dung lặp lại E1, không tăng stake, không offer mới |
| Browse_3 (WzTPbP) | 0% conv dù 1.86% click | Khách click nhưng không mua → landing page hoặc không có urgency |
| Browse_4 (SUqMPt) | **43.4% open (cao nhất), 0.63% click (thấp nhất)** | Subject hay nhưng body/CTA yếu — kỳ vọng > nội dung |

### Fix strategy

**Nguyên tắc:** Email 1 cho urgency nhẹ, Email 2 cho **offer đầu tiên** (10% off — mã `BROWSE10`), Email 3 cho **social proof** (review khách), Email 4 cho **last call + free shipping**.

Đề xuất rewrite mỗi email:

| Email | Subject đề xuất | Angle mới | CTA |
|---|---|---|---|
| Browse_1 | "Was this speaking to you, {{ first_name\|default:'friend' }}?" | Gentle reminder + Scripture tie-in | "Take another look" |
| Browse_2 | "A little something to bring it home 🙏" | **10% off với code BROWSE10**, hết hạn 48h | "Claim 10% off" |
| Browse_3 | "Sister, here's what others are saying" | 3 review từ khách mua sản phẩm đó | "See her story → shop now" |
| Browse_4 | "Last chance (+ free shipping on us)" | **Free ship + code expires** | "Bring it home" |

**Impact dự kiến:** $66.79 → $180-250/90d (tăng 3-4x) = +$40-60/tháng

---

## FLOW B — ADD TO CART ABANDONMENT (Y5vBpn)

### Hiện trạng (90 ngày)
- **Tổng:** 279 recipients, $32.89 revenue, $0.12 RPR
- **Trigger:** Added to Cart (không checkout)
- **Cấu trúc:** 4 email
- **Vấn đề:** E1 có 1 đơn hàng, E2-E4 **0 conversion**, E4 còn có 1.64% unsubscribe rate (cảnh báo cao!)

### Chẩn đoán

| Email | Issue | Giả thuyết |
|---|---|---|
| ATC_1 (S5cUfi) | 33% open, **0% click** nhưng có 1 đơn $32.89 | Khách click → mua trực tiếp từ cart link trong email? OK |
| ATC_2 (XsuyLK) | 29.6% open (thấp nhất), 2.82% click, 0% conv | Subject yếu, có click nhưng landing page không chuyển đổi |
| ATC_3 (WPtwa8) | 32% open, 1.47% click, 0% conv | Nội dung lặp, không có incentive mới |
| ATC_4 (XYSm3Y) | **1.64% unsub** (x20 benchmark!) | Gửi quá nhiều hoặc copy pushy → người ta ức chế |

### Fix strategy

**Nguyên tắc ATC khác Browse:** khách đã **bỏ vào giỏ** = intent rất cao. Cần **urgency + free ship** thay vì discount (bảo vệ margin).

| Email | Subject | Angle | Offer |
|---|---|---|---|
| ATC_1 (2h sau ATC) | "Your cart is still here 💛" | Soft nhắc + show ảnh sản phẩm trong giỏ | Không offer |
| ATC_2 (24h) | "Free shipping if you complete today" | **Free ship code `FAITHSHIP`** (đã có trong Shopify?) — hết hạn 24h | Free ship |
| ATC_3 (48h) | "Someone else is eyeing this" | Scarcity nhẹ (low stock) + social proof | Free ship extend |
| ATC_4 (72h) — **CẮT** hoặc rewrite hoàn toàn | — | **Cắt email này** để giảm 1.64% unsub, HOẶC đổi thành "we'll save your cart for 7 days" — không bán | Không |

**Quyết định quan trọng:** Cắt ATC_4 (thuộc hạ khuyến nghị) hay rewrite nhẹ?

**Impact dự kiến:** $32.89 → $120-180/90d = +$30-50/tháng + giảm unsub rate

---

## FLOW C — CUSTOMER WINBACK (Uheh2Y)

### Hiện trạng (90 ngày)
- **Tổng:** 592 recipients, **$0 revenue**, **$0 RPR**
- **Trigger:** Customer (đã mua) không mua lại trong X ngày (thường 60-90)
- **Cấu trúc:** 2 email
- **Vấn đề:** Flow tạo từ 1/2025, **chưa update 15 tháng** — nội dung cũ, voice không phải Jessica, 0 conversion suốt 3 tháng qua

### Chẩn đoán

| Email | Issue |
|---|---|
| Winback E1 (W5Eaxt) | 34.6% open, 0.35% click, 0% conv — copy nhạt, không có hook cảm xúc |
| Winback E2 (T3cbMJ) | 34.4% open, 0.33% click, 0% conv — lặp lại E1 |

### Fix strategy

**Đây là flow khách ĐÃ mua rồi** — họ biết brand, biết sản phẩm. Winback không phải "giới thiệu" mà là **"nhớ em không? em vẫn nhớ chị"**.

| Email | Timing | Subject | Angle | Offer |
|---|---|---|---|---|
| Winback E1 — **REWRITE HOÀN TOÀN** | 60 ngày sau last purchase | "I was thinking about you, {{ first_name\|default:'friend' }}" | Jessica personal note + Scripture (Isaiah 43:1) + "we have new arrivals since you last shopped" | Không offer, pure relationship |
| Winback E2 | 75 ngày | "A little something to bring you back 💛" | **20% off với code COMEBACK20**, hết 7 ngày | 20% off |
| Winback E3 — **THÊM MỚI** | 90 ngày | "One last note before we say goodbye" | Gentle goodbye, "we'll always be here khi bạn cần" | — |

**Lý do thêm Winback E3:** flow hiện chỉ có 2 email = không đủ nhịp. Thêm 1 email cuối "graceful goodbye" vừa giữ quan hệ, vừa cho cơ hội chuyển segment inactive.

**Impact dự kiến:** $0 → $100-180/90d = +$30-60/tháng

---

## FLOW D — WELCOME SERIES E2-E5 (Sy4yQ7)

### Hiện trạng (90 ngày)
- **Tổng:** 7,059 recipients, $738.83 revenue, $0.10 RPR
- **Trigger:** Added to List (Subscriber List UdxzRE)
- **Cấu trúc:** 5 email
- **Vấn đề:** Open rate giảm đều từ E1 (41.5%) → E3 (33.5%) → **E5 lại tăng (39.9%)**; click rate **0.55-1.17%** trên tất cả email; E3 **$0 revenue**

### Chẩn đoán

| Email | Performance | Chẩn đoán |
|---|---|---|
| W8UjR5 (E1) | 41.5% open, 1.17% click, $239.50 | **Best** — giữ nguyên, chỉ tối ưu nhẹ CTA |
| WFi88i (E2) | 37.8% open, 1.11% click, $38.27 | Click ổn nhưng conversion rất thấp — landing page? |
| **SiaMMV (E3)** | 33.5% open, 0.65% click, **$0** | **Dead zone — rewrite hoàn toàn** |
| R48GyF (E4) | 33.9% open, 0.92% click, $148.84 | OK nhưng nhàm |
| Sdxxsx (E5) | 39.9% open, 0.55% click, $312.22 | Open tăng lại (có thể là final offer), click lại thấp nhất |

### Fix strategy — "Faith Journey" arc (thay cho "buy more")

Welcome series = 5 email kể 1 câu chuyện, không phải 5 email bán lặp lại.

| Email | Day | Angle mới | Subject | CTA | Revenue model |
|---|---|---|---|---|---|
| E1 (W8UjR5) | Day 0 | "Welcome + who is Jessica" | "Welcome to the family, {{ first_name\|default:'friend' }} 🙏" | Browse shop | Welcome code 10% off first order |
| E2 (WFi88i) | Day 2 | "**Jessica's faith story**" — why brand exists | "The verse that started it all" | Read the full story → shop bestsellers | Bestsellers mention cuối thư |
| E3 (SiaMMV) | Day 4 | "**Best sellers — what sisters are wearing**" + social proof | "What our sisters reach for first" | Shop bestseller collection | Direct bestseller push — đây chính là email bán |
| E4 (R48GyF) | Day 7 | "**Faith-based styling guide**" — devotional + how to wear | "Dressing in faith — a short devotional" | Shop the collection | Content-first, product-second |
| E5 (Sdxxsx) | Day 10 | "**Last chance on your welcome 10% off**" + Joy loyalty intro | "Your 10% off expires tonight 💛" | Claim discount → shop | Hard closer |

**Đổi đáng kể nhất:**
- Email 3 (SiaMMV) — từ $0 thành **bestseller pusher** (expect $300-500/90d)
- Email 2 (WFi88i) — thêm welcome code cuối thư để "warm up" trước E3
- Email 5 (Sdxxsx) — thêm hard deadline để đẩy conversion lên

**Impact dự kiến:** $738.83 → $1,500-2,200/90d = +$250-500/tháng

> **Đây là đòn đánh lớn nhất trong Đòn 2** — 1 lần fix, compound mãi mãi cho mọi subscriber mới.

---

## 6. OFFER CODE CẦN TẠO (Shopify)

Để các flow fix hoạt động, cần tạo 4 offer code trong Shopify:

| Code | Discount | Expiry | Dùng cho |
|---|---|---|---|
| `WELCOME10` | 10% off first order, không min | 7 ngày từ subscribe | Welcome E1 + E5 |
| `BROWSE10` | 10% off, không min | 48h từ trigger | Browse Abandonment E2 |
| `FAITHSHIP` | Free shipping, min $0 | 48h từ trigger | ATC Abandonment E2-E3 |
| `COMEBACK20` | 20% off, min $39 | 7 ngày từ trigger | Customer Winback E2 |

> **Thuộc hạ không có quyền tạo code Shopify** — cần đại vương tự tạo hoặc uỷ quyền cho bên kỹ thuật. Thuộc hạ sẽ đợi code xác nhận trước khi paste vào Klaviyo.

---

## 7. LỘ TRÌNH TRIỂN KHAI 7 NGÀY

### Day 1 (hôm nay — 17/4)
- [x] Audit 4 flow, pull dữ liệu, viết playbook này
- [ ] Đại vương đọc playbook, duyệt strategy tổng thể

### Day 2-3 (18-19/4, cuối tuần)
- [ ] Thuộc hạ draft copy đầy đủ cho **Welcome E2, E3, E4, E5** (ưu tiên cao nhất)
- [ ] Thuộc hạ draft copy cho **Browse E2-E4**
- [ ] Thuộc hạ draft copy cho **ATC E2-E3**
- [ ] Thuộc hạ draft copy cho **Winback E1-E3**

### Day 4 (20/4, thứ Hai)
- [ ] Đại vương review copy tất cả, phản hồi điều chỉnh
- [ ] Đại vương tạo 4 offer code trong Shopify

### Day 5 (21/4, thứ Ba) — cùng ngày gửi MD Email 2
- [ ] Thuộc hạ tạo HTML template trong Klaviyo (với offer code đã xác nhận)
- [ ] Đại vương paste template vào flow Welcome E2, E3 (ưu tiên)

### Day 6-7 (22-23/4)
- [ ] Đại vương paste template vào Welcome E4, E5
- [ ] Đại vương paste template vào Browse E2-E4
- [ ] Đại vương paste template vào ATC E2-E3
- [ ] Đại vương paste template vào Winback E1-E3

### Day 8+ (24/4 trở đi)
- [ ] Flow chạy 2 tuần với copy mới
- [ ] Pull report thứ 2 tuần sau, so sánh RPR trước/sau

---

## 8. QUYẾT ĐỊNH ĐẠI VƯƠNG CẦN DUYỆT

### Quyết định E1 — ƯU TIÊN FIX?

3 phương án:

- ☐ **E1.A — Welcome Series trước** (khuyến nghị): ROI lớn nhất, ảnh hưởng mọi subscriber mới. 5 email rewrite.
- ☐ **E1.B — Làm song song cả 4 flow**: Mất 4-5 ngày, compound gain sớm hơn.
- ☐ **E1.C — Làm từng cái một**: Welcome → Browse → ATC → Winback, mỗi cái cách nhau 3 ngày để track riêng.

### Quyết định E2 — OFFER STRATEGY?

- ☐ **E2.A — Tạo 4 offer code** (WELCOME10, BROWSE10, FAITHSHIP, COMEBACK20) — khuyến nghị
- ☐ **E2.B — Chỉ tạo 2 code** (WELCOME10 + COMEBACK20), Browse/ATC dùng free ship threshold $49+ có sẵn
- ☐ **E2.C — Không tạo code mới, rewrite copy only** (impact giảm 40-50%)

### Quyết định E3 — CẮT ATC_4 KHÔNG?

- ☐ **E3.A — Cắt hẳn ATC_4** (khuyến nghị — unsub 1.64% là red flag)
- ☐ **E3.B — Rewrite ATC_4 thành "save cart 7 days" soft touch**
- ☐ **E3.C — Giữ nguyên**, chỉ đổi subject

### Quyết định E4 — THÊM WINBACK E3?

- ☐ **E4.A — Thêm Winback E3 "graceful goodbye"** (khuyến nghị)
- ☐ **E4.B — Giữ flow 2 email, chỉ rewrite**

### Quyết định E5 — JESSICA'S FAITH STORY CHO WELCOME E2?

Đại vương sẽ cung cấp hay thuộc hạ viết dựa trên brand voice doc?

- ☐ **E5.A — Đại vương/Jessica cung cấp story thật** (voice chuẩn nhất)
- ☐ **E5.B — Thuộc hạ draft based on brand-voice.md, đại vương chỉnh** (nhanh)
- ☐ **E5.C — Thuộc hạ dùng khung template, Jessica tự viết sau** (hybrid)

---

## 9. ACTION LOG (cập nhật khi làm)

### 17/4/2026
- [x] Pull flow_report 90 ngày cho SsEfTC, Y5vBpn, Uheh2Y, Sy4yQ7
- [x] Phát hiện sai thứ tự Welcome trong reference, đính chính
- [x] Viết Flow-Fix-Playbook.md
- [ ] **Đợi đại vương duyệt 5 quyết định E1-E5 bên trên**

### Ghi chú
- Sẽ update `references/klaviyo-account.md` sau khi playbook được duyệt
- Sẽ update mục 11 trong `Chien-luoc-Email-FaithfulDivine.md` với message ID đúng

---

**HẾT PLAYBOOK — Chờ đại vương duyệt để thuộc hạ draft copy Day 2-3**
