# MÔ HÌNH NGƯỜI DÙNG VÀ TRUY CẬP

## ADMIN

Chỉ có một role `ADMIN`, có quyền:

- import danh sách chính thức;
- quản lý đợt kê khai;
- xem/sửa mọi hồ sơ;
- xem dữ liệu gốc và dữ liệu học sinh đề nghị;
- chấp nhận/từ chối từng thay đổi;
- kiểm tra ảnh, QR, OCR;
- yêu cầu bổ sung;
- duyệt, khóa, mở lại hồ sơ;
- tải PDF/Excel/ZIP;
- quản lý danh mục và cấu hình.

## Học sinh

Học sinh không phải role và không có tài khoản lâu dài.

Luồng:

1. Nhập CCCD.
2. Nhập ngày sinh.
3. Hệ thống đối chiếu dữ liệu import.
4. Khớp → mở hồ sơ.
5. Không khớp → thông báo chung.
6. Phiên chỉ cho phép thao tác trên đúng hồ sơ đã mở.

## Không có cơ chế xác thực bổ sung

Không triển khai:

- OTP;
- mật khẩu học sinh;
- mã mời;
- mã truy cập riêng;
- câu hỏi bảo mật;
- CAPTCHA.

ADMIN vẫn cần đăng nhập quản trị để thực hiện thao tác quản trị.
