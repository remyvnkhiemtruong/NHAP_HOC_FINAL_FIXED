# QUY TẮC VALIDATION

## CCCD học sinh

- `0` chỉ chấp nhận như ngoại lệ import TT 829, không phải CCCD hợp lệ.
- Bình thường đúng 12 chữ số.
- Kiểm tra XXX theo 63 mã.
- Y = 2 Nam, 3 Nữ với năm sinh 2000–2099.
- ZZ bằng hai số cuối năm sinh.
- Sai ngữ nghĩa → cảnh báo, không tự sửa.

## Ngày cấp/nơi cấp

- Ngày `dd/mm/yyyy`.
- Không ở tương lai.
- Trước 01/07/2024 → Cục Cảnh sát Quản lý Hành chính về Trật tự xã hội.
- Từ 01/07/2024 → Bộ Công an.
- Học sinh/ADMIN có thể sửa theo mặt thẻ.

## Điện thoại

- Chuẩn hóa +84 thành 0.
- Đúng 10 chữ số.
- So khớp danh sách đầu số.
- Ưu tiên tiền tố dài trước.
- Chặn toàn một số, 0000000000, 0123456789, 0987654321.

## Email

- Không bắt buộc.
- Validate khi có.
- Lowercase và trim.

## Họ tên

- Trim.
- Gộp nhiều khoảng trắng.
- Unicode NFC.
- Dữ liệu nguồn chính thức giữ nguyên cách viết.
- Không tự thêm/bớt dấu hoặc thay họ tên theo suy đoán.

## Ngày Đội/Đoàn

- Sau ngày sinh.
- Không sau ngày hiện tại.
- Chỉ bắt buộc khi checkbox tương ứng được tích.

## Gia đình

- Nếu cha không có → ẩn phần cha.
- Nếu mẹ không có → ẩn phần mẹ.
- Nếu không có cả hai → bắt buộc người bảo hộ.
- Có ít nhất một số liên hệ hợp lệ.

## Chính sách

- Có → mô tả, chế độ và minh chứng.
- Không → xóa dữ liệu điều kiện chưa gửi.

## Khuyết tật

- Có → bắt buộc loại.
- Không → loại để trống.
