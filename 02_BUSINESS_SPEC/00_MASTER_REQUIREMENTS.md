# ĐẶC TẢ TỔNG THỂ – NGUỒN SỰ THẬT NGHIỆP VỤ

## Mục tiêu

Xây dựng cổng thu thập hồ sơ điện tử cho 930 học sinh trúng tuyển lớp 10 Trường THPT Võ Văn Kiệt năm học 2026–2027.

## Quyết định bắt buộc

- Một role quản trị duy nhất: `ADMIN`.
- Học sinh không đăng ký tài khoản.
- Học sinh mở hồ sơ bằng đúng **CCCD + ngày sinh**.
- Không OTP.
- Không mã truy cập riêng.
- Không CAPTCHA, không xác minh bổ sung trong luồng học sinh theo yêu cầu nghiệp vụ hiện tại.
- Dữ liệu trúng tuyển được import sẵn.
- Tất cả thông tin hiển thị có thể được học sinh sửa/đề nghị sửa.
- Dữ liệu gốc không bị ghi đè; ADMIN duyệt sai khác.
- Upload bắt buộc:
  - mặt trước CCCD;
  - mặt sau CCCD;
  - ảnh chân dung 4x6.
- Quét QR ở cả hai mặt CCCD; mặt nào có QR thì trả kết quả.
- Có thể OCR chữ/MRZ để đối chiếu bổ sung.
- Ảnh 4x6 được kiểm tra tự động đúng quy định; ADMIN là người quyết định cuối.
- ADMIN tải:
  - PDF thông tin từng học sinh;
  - Excel thông tin toàn trường;
  - ZIP toàn bộ ảnh 4x6;
  - ZIP toàn bộ ảnh hai mặt CCCD.
- Excel toàn trường phải đúng 95 cột A–CQ.
