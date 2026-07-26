# Biên bản UAT — workbook chính thức 2026–2027

## Phạm vi và môi trường

Các bài kiểm tra tự động dùng PostgreSQL, Redis, worker và thư mục tệp tạm cô lập. Mỗi phiên tự áp dụng migration, nạp dữ liệu, chạy kiểm tra rồi dỡ container, volume và thư mục lưu tệp; không sử dụng cơ sở dữ liệu vận hành.

Có hai bộ dữ liệu với mục đích khác nhau:

- `npm run test:integration`: kiểm tra nhanh migration, import, khóa giao dịch và backfill bằng 5 hồ sơ tổng hợp.
- `npm run test:uat`: bài UAT dữ liệu chính thức dùng `00_INPUTS/01_DU_LIEU_CHINH_THUC_TRUNG_TUYEN.xlsx`.

## Tiêu chí đối chiếu workbook chính thức

| Hạng mục | Kết quả cần xác nhận |
| --- | --- |
| Tổng hồ sơ | 930 |
| Giới tính | 491 nữ, 439 nam |
| Cảnh báo dự kiến | 4 |
| Lỗi import | 0 |
| TT 829 | CCCD nguồn `0`, trạng thái `NEEDS_CCCD_CORRECTION` |
| Cờ CCCD/giới tính | TT 384, 491, 510; không tự sửa dữ liệu nguồn |
| Không trùng | TT/CCCD nguồn không trùng; checksum import lặp bị từ chối |
| Định dạng công khai | Không thay đổi cấu trúc import/export hoặc quy tắc mã hóa |

## Kết quả chạy ngày 26/07/2026

- `npm run test:uat`: đạt — 930 hồ sơ; 491 nữ, 439 nam; đúng 4 cảnh báo dự kiến; 0 lỗi.
- `npm run test:integration`: đạt — áp dụng sạch 9 migration; import 5 hồ sơ tổng hợp; kiểm tra advisory lock PostgreSQL và nâng cấp/backfill blind index trên cơ sở dữ liệu đã có dữ liệu.
- `npm run test:unit`: đạt — 29 suite, 173 test. Bao phủ manifest xuất, Redis cold-start, advisory lock, ngày hợp lệ, tìm kiếm không dấu, xuất PDF/XLSX/ZIP và các quy tắc hồ sơ.
- `npm run test:e2e`: đạt — 14 ca thực thi, 4 ca bỏ qua có chủ đích vì kiểm tra worker ảnh và ngày không tồn tại chỉ chạy một lần trên desktop. Phạm vi gồm desktop, tablet, mobile; CSP nonce/hydration; đăng nhập học sinh/admin; 9 bước hồ sơ; ba loại ảnh; worker ảnh; ngày không tồn tại; tìm kiếm tên nhiều từ không dấu; và xác nhận chỉ mở hồ sơ không tạo thay đổi.
- `npm run lint`, `npm run typecheck` và production build: đạt.
- Docker build trên `node:22-bookworm-slim`: đạt; Prisma CLI/client/adapter 7.9.0; OpenSSL có trong build/runtime; toàn bộ route render động để cấp nonce theo response.
- `npm audit`: 0 lỗ hổng.

## Điều kiện triển khai bắt buộc

1. Dùng Node.js 22 cho máy phát triển, CI và Docker.
2. Chạy `prisma migrate deploy`.
3. Chạy `npm run backfill:search-indexes`.
4. Chỉ mở traffic khi `/api/health` trả `ready`, Redis/PostgreSQL sẵn sàng và số hồ sơ thiếu lookup index bằng 0.
5. Reverse proxy TLS phải ghi đè chuỗi `X-Forwarded-For`; cấu hình `TRUSTED_PROXY_HOPS` đúng số proxy tin cậy.

## Ngoại lệ nghiệm thu

Kho dữ liệu không có đủ 930 bộ ảnh 4x6/CCCD thật. Vì vậy chưa thể ký nghiệm thu ZIP ảnh toàn trường bằng ảnh vận hành. Logic thành công, preflight, checksum, CSV lỗi và quy tắc không tạo ZIP một phần đã được kiểm tra bằng fixture; UAT thủ công cuối vẫn cần bộ ảnh đã được nhà trường phê duyệt.

## Ký nghiệm thu thủ công

1. Lưu log `npm run test:uat` và `npm run verify`.
2. Trên môi trường UAT đã nạp ảnh thật, duyệt hồ sơ hợp lệ và xử lý riêng TT 829.
3. Tạo PDF học sinh, Excel toàn trường, ZIP 4x6 và ZIP CCCD; kiểm tra checksum, range download, số entry và CSV preflight.
4. Khóa toàn bộ cohort, tạo lại export cuối, kiểm tra nút “Xuất chính thức” chỉ xuất hiện khi đủ điều kiện.
5. Thay đổi thử một giá trị hoặc phiên bản tệp sau khi tạo job; hệ thống phải từ chối chính thức hóa do manifest đã cũ.
