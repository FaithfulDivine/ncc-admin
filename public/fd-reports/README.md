# FaithfulDivine Reports — Dashboard

Static dashboard tự sinh bởi scheduled task `faithfuldivine-12h-report`.

- `index.html` — dashboard tổng (cập nhật mỗi run)
- `_action_items.json` — snapshot máy-đọc (cập nhật mỗi run)
- `FD_Report_<date>_<AM|PM>_<time>.{md,html}` — báo cáo chi tiết từng run

## Deploy lên Vercel (lần đầu)

```bash
npm i -g vercel
cd "D:\Cong viec\CODE\Tráng CEO\FD_Reports"
vercel login        # đăng nhập 1 lần
vercel --prod       # deploy lần đầu, hỏi chọn project — chọn "Create new"
```

## Re-deploy (mỗi khi report mới)

```bash
cd "D:\Cong viec\CODE\Tráng CEO\FD_Reports"
vercel --prod --yes
```
