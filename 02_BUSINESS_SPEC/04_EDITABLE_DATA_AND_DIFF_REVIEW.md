# TẤT CẢ THÔNG TIN HIỂN THỊ CÓ THỂ SỬA

## Ba lớp dữ liệu

1. `source_value`: giá trị chính thức khi import.
2. `student_proposed_value`: giá trị học sinh nhập/sửa.
3. `approved_value`: giá trị ADMIN chấp nhận để xuất.

## Quy tắc

- Học sinh có thể sửa mọi trường đang hiển thị, gồm họ tên, ngày sinh, giới tính, CCCD, dân tộc, nơi cư trú, trường THCS và điểm tuyển sinh.
- Sửa dữ liệu không trực tiếp ghi đè nguồn.
- Mỗi trường thay đổi có:
  - giá trị cũ;
  - giá trị mới;
  - thời gian;
  - nguồn thay đổi;
  - lý do nếu cần;
  - trạng thái chờ duyệt/chấp nhận/từ chối.
- ADMIN có màn hình diff theo từng trường.
- ADMIN có thể chấp nhận từng trường, chấp nhận toàn bộ hoặc sửa lại.
- Nếu học sinh sửa CCCD/ngày sinh, khóa truy cập cũ vẫn còn cho đến khi ADMIN duyệt.
- Khi ADMIN duyệt CCCD mới, cập nhật khóa truy cập và giữ lịch sử.
