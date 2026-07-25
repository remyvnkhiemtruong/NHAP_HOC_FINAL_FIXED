# UPLOAD VÀ LƯU TRỮ TỆP

## Tệp bắt buộc

- `cccd_front`
- `cccd_back`
- `photo_4x6`

## Tệp có điều kiện

- minh chứng chính sách;
- chứng chỉ;
- diện ưu tiên/khuyến khích.

## Quy tắc

- Kiểm tra MIME và magic bytes.
- Đổi tên nội bộ bằng UUID.
- Không dùng tên file gốc làm đường dẫn.
- Ảnh có preview, xoay, crop.
- Mỗi tệp lưu:
  - owner student;
  - loại;
  - tên gốc;
  - MIME;
  - kích thước;
  - width/height;
  - checksum;
  - trạng thái quét;
  - phiên bản;
  - thời gian upload.
- Khi thay ảnh, giữ lịch sử phiên bản.
- Khi hồ sơ khóa, học sinh không thay ảnh nếu ADMIN chưa mở.
