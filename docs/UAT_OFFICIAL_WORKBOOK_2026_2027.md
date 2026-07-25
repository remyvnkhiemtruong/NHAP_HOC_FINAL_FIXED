# Biên bản UAT — workbook chính thức 2026–2027

## Phạm vi và môi trường

UAT thực hiện trên PostgreSQL/Redis cô lập do `npm run test:integration` tạo, không ghi vào database vận hành. Nguồn là `00_INPUTS/01_DU_LIEU_CHINH_THUC_TRUNG_TUYEN.xlsx`.

## Tiêu chí đối chiếu

| Hạng mục          | Kết quả cần xác nhận                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| Tổng hồ sơ        | 930                                                                                    |
| Giới tính         | 491 nữ, 439 nam                                                                        |
| TT 829            | CCCD nguồn `0`, trạng thái `NEEDS_CCCD_CORRECTION`                                     |
| Cờ CCCD/giới tính | TT 384, 491, 510; không tự sửa                                                         |
| Không trùng       | TT/CCCD nguồn không trùng; import cùng checksum bị từ chối                             |
| Phân bố           | năm sinh, dân tộc, nơi cư trú, THCS, đầu số CCCD theo `01_OFFICIAL_DATA_STATISTICS.md` |
| Excel             | template 6 sheet, 95 cột A–CQ, text số 0 đầu và ngày                                   |
| PDF/ZIP           | PDF/Excel output, ZIP path/preflight/CSV lỗi/checksum theo test export                 |

## Kết quả chạy — 23/07/2026

- `npm run test:integration`: đạt. PostgreSQL/Redis cô lập đã áp dụng 3 migration, import 930 `AdmissionRecord` và 930 `Student`; xác nhận 491 nữ, 439 nam; phân bố năm sinh, dân tộc, nơi cư trú, THCS và đầu CCCD khớp tài liệu thống kê; TT 829 giữ CCCD nguồn `0` và đúng một `NEEDS_CCCD_CORRECTION`; TT 384/491/510 có cờ `GENDER_MISMATCH`; checksum import chỉ có một batch và import lặp lại bị từ chối. Dịch vụ test được dỡ sau phiên chạy.
- Jest export: đạt 5 suite, 39 test. Xác nhận PDF, Excel 6 sheet/95 cột, ZIP 4x6 `<CCCD>.jpg`, ZIP CCCD `<CCCD>/mat_truoc.jpg` và `mat_sau.jpg`, chọn version file cao nhất, checksum và CSV UTF-8 BOM khi preflight thất bại.
- `npm run test:e2e`: đạt 6/6 cho desktop và mobile: CCCD + ngày sinh không OTP/CAPTCHA, ADMIN export và accessibility của các control upload.
- `npm run lint`, `npx tsc --noEmit` và `npm run build`: đạt. Dự án chưa khai báo script `typecheck`, nên dùng trực tiếp TypeScript compiler. Production build có một cảnh báo Next.js về convention `middleware` bị deprecate; không có lỗi build, hydration, console hoặc API 5xx trong E2E.

## Ngoại lệ nghiệm thu

Không có bộ 930 ảnh 4x6/CCCD chính thức trong `00_INPUTS`; vì vậy không chứng nhận ZIP thành công toàn trường bằng dữ liệu ảnh thật. Đã kiểm tra logic thành công với fixture và preflight toàn trường: CCCD `0`, trùng hoặc thiếu ảnh phải làm job thất bại kèm CSV, không tạo ZIP một phần. Cần bổ sung 930 ảnh được duyệt để đóng mục UAT ZIP toàn trường.

## Hướng dẫn ký nghiệm thu thủ công

1. Chạy `npm run test:integration` và lưu log.
2. Trên môi trường cô lập đã nạp ảnh thật, duyệt 929 hồ sơ hợp lệ; giữ TT 829 ở `NEEDS_CCCD_CORRECTION`.
3. Tạo PDF một học sinh, Excel toàn trường, ZIP 4x6 và ZIP CCCD; kiểm tra download, checksum, số entry và console/network không có API 5xx.
4. ADMIN xác nhận CSV lỗi cho TT 829 trước khi cập nhật CCCD hợp lệ; sau duyệt lại, chạy ZIP/Excel cuối cùng.
