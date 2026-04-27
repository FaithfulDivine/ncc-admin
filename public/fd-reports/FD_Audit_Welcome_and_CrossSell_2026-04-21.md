# FD Audit — Welcome Series W8UjR5 + Cross-sell Fulfilled/Delivered

*Ngày: 2026-04-21 · Run: PM 19:xx ICT · Window dữ liệu: 30 ngày (2026-03-22 → 2026-04-21) + 7 ngày gần nhất*

> Bẩm đại vương, thuộc hạ xin **tường trình audit** cho 2 action item Green Zone từ dashboard run PM. Thuộc hạ **không thực hiện write action** lên Klaviyo (scheduled-task chỉ cho phép report); toàn bộ copy redraft dưới đây đại vương có thể paste thẳng vào Klaviyo Editor.

---

## A. WELCOME SERIES (Sy4yQ7) — Audit Message W8UjR5

### A.1 Bức tranh toàn flow (30 ngày, theo thứ tự)

| # | Msg ID | Flow message name | Rec | Open | Click | **Unsub** | Conv | Rev | Rev/rec |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | **`W8UjR5`** | **Welcome_Email 1** | **1,070** | **40.89%** | 1.16% | **🔴 2.80% (29)** | 0.19% | $119.83 | $0.12 |
| 2 | `WFi88i` | Welcome_Email 2 | 991 | 36.29% | 1.02% | 🟡 1.12% (11) | 0% | $0 | $0 |
| 3 | `SiaMMV` | Welcome_Email 3 | 915 | 32.53% | 0.66% | 🟢 0.66% (6) | 0% | $0 | $0 |
| 4 | `R48GyF` | Welcome_Email 4 | 843 | 33.45% | 0.84% | 🟢 0.84% (7) | 0.24% | $106.95 | $0.13 |
| 5 | `Sdxxsx` | Welcome_Email 5 | 814 | 38.01% | **0.25%** | 🟡 0.99% (8) | 0.37% | $177.94 | $0.22 |
| — | **Aggregate 30d** | — | 4,633 | 36.37% | 0.81% | **1.34%** | 0.15% | **$404.72** | $0.09 |

Benchmark FD (đã set trong CLAUDE.md): open 40%+, click 3–5%, unsub <0.5%. **Flow đạt open tương đối, fail hoàn toàn về click/conv/unsub.**

### A.2 Chẩn đoán W8UjR5 — Welcome Email 1

**Các con số biết nói:**

- Open 40.89% ≈ benchmark → **subject line + sender reputation OK**.
- Clicks unique 12 / opens unique 424 → **CTOR 2.83%** (bench 10–15%) → content/CTA **thất bại nặng** sau khi mở.
- Unsub 29 / delivered 1,037 = **2.80%** → 5.6× ngưỡng cảnh báo 0.5%; **cứ 36 người nhận có 1 người unsub ngay email đầu tiên**.
- Conv 0.19% / rev $119.83 → có 2 đơn trong 1,070 recipients, revenue-per-recipient $0.12 (bench Welcome $2–5).
- Đáng chú ý: W8UjR5 7d unsub = **4.94%** (17/344) — đang **tệ hơn** trung bình 30d (2.80%), xu hướng xấu đi.

**4 nguyên nhân thường gặp (theo signal):**

| # | Nguyên nhân | Signal match | Khả năng |
|---|---|---|---|
| 1 | **Email quá bán hàng ngay đầu** — push sản phẩm trước khi build trust | Open cao + click thấp + unsub cao | ⭐⭐⭐⭐⭐ |
| 2 | **Bait & switch** — form hứa discount nhưng email không deliver rõ ràng | Click thấp + unsub cao (cảm giác bị lừa) | ⭐⭐⭐⭐ |
| 3 | **Sai kỳ vọng tần suất** — signup không nói "bạn sẽ nhận 5 email trong 7 ngày" | Unsub Email 1 cao + unsub giảm dần 2→3 (người ghét email đã bỏ sớm) | ⭐⭐⭐⭐ |
| 4 | **Content quá dài / nhiều CTA cạnh tranh** | CTOR 2.83% rất thấp | ⭐⭐⭐ |

**Signal loại bỏ:** không phải vấn đề deliverability (delivery 96.92% OK), không phải spam filter (open 40.89% quá cao).

### A.3 Redraft đề xuất — Welcome Email 1 (copy-ready)

> **Nguyên tắc thiết kế:** Jessica persona (founder-voice, warm Christian woman, Proverbs 31), mission-first rồi mới sell, discount rõ ràng ở nửa trên email, single CTA, đặt kỳ vọng tần suất ngay đoạn đầu để giảm unsub.

**Subject line A/B:**
- A: `Welcome to the family 💛 (your 15% is inside)`
- B: `A psalm, a promise, and 15% off — from me to you`

**Preview text:**
- A: `Start with something true before you buy anything.`
- B: `Here's what to expect from me — and a gift to begin.`

**Email body (HTML-ready, có thể paste vào Klaviyo):**

```html
<!-- Welcome Email 1 - REDRAFT - Jessica voice, single CTA, clear expectations -->
<table align="center" width="600" style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6">
  <tr><td style="padding:32px 24px 8px">
    <p style="font-size:15px;color:#8a7a4d;letter-spacing:1px;margin:0">FAITHFULDIVINE</p>
    <h1 style="font-size:28px;margin:8px 0 16px;color:#1f3a5f">Hi friend — I'm so glad you're here.</h1>

    <p>I'm Jessica, the woman behind FaithfulDivine. Before I show you anything to buy, I wanted to say something real:</p>

    <p style="font-style:italic;border-left:3px solid #c9a961;padding-left:14px;color:#4a4a4a">
      "She is clothed with strength and dignity, and she laughs without fear of the future." — Proverbs 31:25
    </p>

    <p>That's the kind of woman we design for. Every piece we make is meant to help you wear your faith — quietly, confidently, every single day.</p>

    <h3 style="color:#8a7a4d;margin:24px 0 8px">Here's what you can expect from me:</h3>
    <ul style="padding-left:20px">
      <li><b>2–3 emails a week</b> — never more. Mostly encouragement, occasionally a new piece.</li>
      <li>No pressure. <b>Unsubscribe anytime</b> — I'll still be praying for you.</li>
      <li>A short Scripture or story most weeks, because faith belongs in your inbox too.</li>
    </ul>

    <!-- SINGLE HERO CTA - discount clearly visible -->
    <div style="margin:28px 0;padding:24px;background:#fff8e7;border:1px dashed #c9a961;text-align:center;border-radius:6px">
      <p style="margin:0 0 6px;font-size:13px;color:#8a7a4d;letter-spacing:1px">A GIFT TO START</p>
      <p style="margin:0 0 4px;font-size:24px;color:#1f3a5f"><b>15% off your first order</b></p>
      <p style="margin:0 0 16px;font-size:13px;color:#6a6a6a">Use code <b>WELCOME15</b> at checkout · 14 days</p>
      <a href="https://faithfuldivine.com/collections/bestsellers?utm_source=klaviyo&utm_medium=email&utm_campaign=welcome_e1" style="display:inline-block;background:#1f3a5f;color:#fff;padding:14px 36px;text-decoration:none;border-radius:4px;font-weight:bold">Shop Best Sellers</a>
    </div>

    <p style="color:#6a6a6a;font-size:14px">I'll send the next note in about 2 days — a short piece about what FaithfulDivine really stands for, and why I started it.</p>

    <p>With love and prayers,<br><b>Jessica</b></p>
  </td></tr>
</table>

{% unsubscribe 'Unsubscribe (no hard feelings, friend)' %}
```

### A.4 Việc khác thuộc hạ khuyên đại vương cân nhắc (ngoài redraft)

1. **Giảm tần suất Welcome Series** từ 5 email → 3 email trong 5 ngày. 30d cho thấy recipients giảm dần 1,070 → 814 (-24%), unsub cộng dồn 61 người = 1.34%. Nhiều subscribers không chịu nổi 5 emails liên tiếp.
2. **Add discount code vào mọi email của series** (hiện Email 2–5 rev = $0 cho thấy họ có thể đã clicked discount ở E1 rồi quên). Escalate urgency: E1 15%/14d → E4 10%/48h → E5 last chance.
3. **Check signup form copy** trên Shopify: form có nói rõ "you'll receive X emails/week" không? Nếu không, đây là gốc rễ unsub.
4. **So sánh với MPG Welcome Flow (T2.26) `UU8cbf`** (version "optimized"): 7d 158 rec, open 33.54%, click 1.90%, unsub 2.53% — **cũng kém**, tức vấn đề copy không chỉ ở Sy4yQ7 mà ở cả định hướng flow. Nếu đại vương đồng ý, thuộc hạ sẽ redraft cả UU8cbf theo mẫu trên.

---

## B. CROSS-SELL AUDIT — Fulfilled (UcQjaE) + Shipping:Delivered (WHzVmj)

### B.1 Fulfilled (UcQjaE) — 30d

| # | Msg ID | Name | Rec | Open | Click | Unsub | Conv | Rev |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `VMabL3` | **Fulfilled 1** | 413 | **47.20%** | **10.46%** 🟢 | 0.49% | 0.24% | $44.96 |
| 2 | `WE8FT3` | Fulfilled 2 | 349 | 39.77% | 1.15% 🔴 | 0% | 0% | $0 |
| — | **Agg 30d** | — | 762 | **43.80%** | **6.20%** | 0.26% | 0.13% | $44.96 |

**Context quan trọng:** Flow này `created=2025-02-26, updated=2025-02-26` → **14 tháng chưa động vào**. Không thuộc nhóm MPG-Optimized (các flow khác cập nhật 2026-03-02).

**Chẩn đoán:**
- Fulfilled 1 (VMabL3): click 10.46% xuất sắc vì **bấm tracking link** (không phải product). Conv 0.24% → users bấm để check đơn của họ, không phải để mua thêm.
- Fulfilled 2 (WE8FT3): click 1.15% → **email thứ hai yếu / dư thừa**, users đã check tracking ở E1 rồi, không có lý do mở tiếp.

**Gap chính:** Không có cross-sell/upsell block trong cả 2 email. Đây là **moment tốt nhất để upsell** (AOV $56, user vừa buy, đang excited chờ hàng).

### B.2 Shipping:Delivered (WHzVmj) — 30d

| # | Msg ID | Name | Rec | Open | Click | Unsub | Conv | Rev |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `QZMfsi` | Shipping_Delivered | 350 | **41.55%** | 0.86% 🔴 | 0.29% | 0.86% | $123.48 |
| 2 | `Wg5Yp3` | Shipping_Delivered_2 | 300 | 41.67% | 1.00% 🔴 | 0% | 0.33% | $24.96 |
| — | **Agg 30d** | — | 650 | **41.60%** | **0.92%** | 0.15% | 0.62% | $148.44 |

**Chẩn đoán:**
- Open 41–42% ở cả 2 email → đây là **khoảnh khắc vàng**: user vừa nhận sản phẩm, sự hào hứng cao nhất, niềm tin cực lớn.
- Click <1% → email **hoàn toàn không có CTA cross-sell mạnh**; có thể chỉ là "thanks for shopping".
- Rev/rec $0.23 (vs bench post-purchase $1–3). Nếu chỉ cần đẩy rev/rec lên $1 = **extra $650 trong 30d**, extrapolate **$7,800/năm** chỉ từ flow này.

### B.3 Cross-sell block — copy-ready (dùng cho cả Fulfilled & Delivered)

**Nguyên tắc:**
- Post-purchase là lúc **trust cao nhất** → upsell "complete the look" / "pairs well with" hiệu quả nhất.
- Dùng Klaviyo **Product Feed block** với logic "Related to most recent order" (native feature).
- 2 sản phẩm là đủ, đừng 4–6 (choice paralysis).
- Discount thấp (5–10%) để duy trì margin, kèm timer 72h.

**HTML block (chèn giữa email, sau thông tin tracking):**

```html
<!-- CROSS-SELL BLOCK — insert after tracking info -->
<table align="center" width="600" style="font-family:Georgia,serif;color:#2b2b2b;margin-top:24px">
  <tr><td style="padding:24px;background:#fff8e7;border-radius:6px;text-align:center">
    <p style="font-size:13px;color:#8a7a4d;letter-spacing:1px;margin:0 0 4px">PAIRS BEAUTIFULLY WITH YOUR ORDER</p>
    <h3 style="margin:0 0 20px;color:#1f3a5f">A gentle something to complete your look</h3>

    <!-- Klaviyo dynamic product feed — 2 products based on last order -->
    {% catalog 'related-to-last-order' items:2 %}
      <table align="center" style="width:45%;display:inline-table;vertical-align:top;margin:0 6px">
        <tr><td style="text-align:center">
          <img src="{{ image_url }}" alt="{{ title }}" style="width:100%;max-width:180px;border-radius:4px">
          <p style="margin:8px 0 2px;font-weight:bold;color:#1f3a5f">{{ title }}</p>
          <p style="margin:0 0 10px;color:#8a7a4d">${{ price }}</p>
          <a href="{{ url }}?utm_source=klaviyo&utm_medium=email&utm_campaign=postpurchase_crosssell&discount=THANKYOU10" style="display:inline-block;background:#1f3a5f;color:#fff;padding:8px 20px;text-decoration:none;border-radius:4px;font-size:14px">Shop now</a>
        </td></tr>
      </table>
    {% endcatalog %}

    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e0c892">
      <p style="margin:0;font-size:14px;color:#4a4a4a">
        <b>THANKYOU10</b> — 10% off for 72 hours, our small thank-you for being here.
      </p>
    </div>
  </td></tr>
</table>
```

**Note kỹ thuật cho đại vương:**
- `{% catalog 'related-to-last-order' %}` cần Shopify catalog được sync vào Klaviyo (FD đã có theo ghi nhận trước đây). Nếu chưa, thay bằng handpick 2 best-sellers: `/collections/bestsellers?limit=2`.
- `THANKYOU10` cần tạo discount code trên Shopify với điều kiện "first-time use only" + "expires in 72h from email send".

### B.4 Kiến trúc flow đề xuất (cả hai flow)

**Fulfilled (UcQjaE) — giảm 2 email → 1 email có cross-sell:**

```
Trigger: Order Fulfilled event
  ↓
  Wait 0h (send immediately when carrier picks up)
  ↓
  Email: "Your order is on the way 📦"
    — Tracking number + link (primary)
    — Cross-sell block 2 products (THANKYOU10, 72h)
    — Footer: link to /pages/care-guide
  ↓
  [END — remove Fulfilled 2, nó không tạo revenue]
```

**Shipping:Delivered (WHzVmj) — giữ 2 email, đổi content:**

```
Trigger: Shipment Delivered event
  ↓
  Wait 6h (cho user kịp unbox)
  ↓
  Email 1: "Hope it arrived well 💛" (QZMfsi redraft)
    — Warm check-in (1 sentence)
    — "How does it fit?" — link đến UGC/review page
    — Cross-sell block 2 products (THANKYOU10, 72h)
  ↓
  Wait 3 days
  ↓
  Email 2: "Share the light?" (Wg5Yp3 redraft)
    — Referral program CTA (give $15, get $15)
    — Review request nếu chưa reviewed
    — Cross-sell block 2 products (THANKYOU15 — tăng discount để đẩy conv)
```

### B.5 Expected impact (ước tính conservative)

| Flow | Baseline 30d rev | Target 30d rev | Delta/tháng | Annualized |
|---|---:|---:|---:|---:|
| Fulfilled (UcQjaE) | $44.96 | $300 (rev/rec $0.40) | +$255 | +$3,060 |
| Shipping:Delivered | $148.44 | $650 (rev/rec $1.00) | +$502 | +$6,024 |
| **Tổng** | **$193.40** | **$950** | **+$757** | **+$9,084** |

Nếu redraft đạt được mục tiêu, flow revenue tăng từ hiện tại $192.83/7d → ~$380/7d (gần target $500 ở rule "boost-flow-revenue") chỉ nhờ 2 flow này.

---

## C. THỨ TỰ ĐỀ XUẤT TRIỂN KHAI

| Priority | Action | Zone | Owner | Effort | Impact | Khi nào |
|---|---|---|---|---|---|---|
| 1 | Redraft Welcome Email 1 (W8UjR5) theo §A.3 — copy ready | 🟢 | Thuộc hạ bẩm đại vương review + paste | 30 phút | Giảm unsub 2.80%→<0.8%, tăng conv | Trong 24h (unsub đang xấu đi) |
| 2 | Thêm cross-sell block §B.3 vào Shipping:Delivered Email 1 (QZMfsi) | 🟢 | Thuộc hạ bẩm đại vương review + paste | 20 phút | Rev/rec $0.35→$1, +$500/tháng | Trước run AM 2026-04-22 |
| 3 | Thêm cross-sell block §B.3 vào Fulfilled Email 1 (VMabL3) | 🟢 | Thuộc hạ bẩm đại vương review + paste | 20 phút | +$200–300/tháng | Trước run AM 2026-04-22 |
| 4 | Tắt Fulfilled 2 (WE8FT3) — dư thừa | 🟡 | Đại vương approve | 5 phút | Giảm send volume, tránh spam | Sau khi Fulfilled 1 có cross-sell |
| 5 | Giảm Welcome Series 5→3 emails | 🟡 | Đại vương approve (chiến lược) | 2 giờ | Giảm unsub cộng dồn từ 1.34% → ~0.5% | Tuần sau |

**Yellow Zone (#4, #5)** cần đại vương quyết vì nó thay đổi cấu trúc flow, không chỉ copy. Thuộc hạ **không tự động tắt email** hay **không tự động edit flow** — chỉ báo cáo và chờ approve.

---

## D. Verification rules đã set cho run AM 2026-04-22

Sau khi đại vương paste redraft/cross-sell block, thuộc hạ sẽ tự check trong run kế tiếp:

| Item | Rule | Threshold DONE |
|---|---|---|
| W8UjR5 redraft | unsubscribe_rate(W8UjR5) 7d < 0.02 | Giảm ≥30% từ 4.94% |
| Fulfilled cross-sell | conversion_value(VMabL3) 7d > 0 OR click_rate >= 0.10 duy trì | rev xuất hiện |
| Delivered cross-sell | conversion_value(QZMfsi) 7d > $50 OR click_rate >= 0.03 | click gấp 3× |
| Flow rev tổng | flow_revenue_7d >= $500 | đạt rule boost-flow-revenue |

---

*Generated: 2026-04-21 19:1x ICT · Source: `[Klaviyo API · get_flow_report, get_flow]` window 7d+30d · file: `FD_Audit_Welcome_and_CrossSell_2026-04-21.md`.*
