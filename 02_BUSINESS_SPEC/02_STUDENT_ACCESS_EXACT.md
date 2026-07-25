# CƠ CHẾ MỞ HỒ SƠ BẰNG CCCD VÀ NGÀY SINH

## Giao diện

- Ô `Số CCCD`.
- Ô `Ngày sinh` định dạng dd/mm/yyyy.
- Nút `Bắt đầu kê khai`.

## So khớp

- CCCD chuẩn hóa thành chuỗi.
- Ngày sinh chuẩn hóa thành date.
- So khớp chính xác với dữ liệu import đang có hiệu lực.
- CCCD cũ vẫn dùng để truy cập trong khi học sinh đề nghị sửa CCCD; chỉ đổi khóa truy cập sau khi ADMIN chấp nhận.

## Thông báo

Thành công:

> Đã tìm thấy hồ sơ. Vui lòng kiểm tra và bổ sung thông tin.

Thất bại:

> Số CCCD hoặc ngày sinh không khớp với danh sách trúng tuyển. Vui lòng kiểm tra lại hoặc liên hệ nhà trường.

## Ngoại lệ TT 829

CCCD nguồn bằng `0`. Hồ sơ phải hiển thị trong danh sách lỗi của ADMIN và chưa cho học sinh tự mở cho đến khi ADMIN cập nhật CCCD đúng.
