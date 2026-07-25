# THUẬT TOÁN IMPORT WORKBOOK CHÍNH THỨC

## 1. Chọn sheet và header

- Chọn sheet chính xác `Danh sách trúng tuyển`.
- Xác nhận dòng 4 chứa đủ 15 header.
- Đọc dữ liệu từ dòng 5 đến dòng có TT cuối cùng.
- Không dựa vào tên file để xác định dữ liệu hợp lệ; kiểm tra schema.

## 2. CCCD

```text
raw = cell value
if raw == 0:
    cccd = "0"
else:
    cccd = digits(raw).padStart(12, "0")
```

- Không parse sang JavaScript Number sau khi chuẩn hóa.
- Database dùng `varchar(12)`.
- Excel export dùng text hoặc number format `000000000000`.
- Không làm mất mã 092, 095, 096... ở đầu.

## 3. Ngày sinh

- Chấp nhận Excel serial date.
- Chấp nhận Date object từ thư viện đọc Excel.
- Chấp nhận chuỗi `dd/mm/yyyy`.
- Lưu database dạng date.
- Hiển thị và export `dd/mm/yyyy`.

## 4. Giới tính

- `X`, `x` hoặc chuỗi sau trim bằng `X` → Nữ.
- Trống → Nam.
- Giá trị khác → lỗi import cần ADMIN xác nhận.

## 5. Dân tộc

- So khớp chính xác với danh mục 54 dân tộc sau trim.
- Không tự sửa dấu.
- Nếu ngoài danh mục → cờ lỗi và cho ADMIN ánh xạ.

## 6. Điểm

- Trống ở ưu tiên/khuyến khích → 0.
- Kiểm tra `J + K + L + M = N`, sai số cho phép 0,01.
- Không tự thay điểm chính thức nếu sai; ghi lỗi import.

## 7. Upsert

- Khóa ưu tiên: CCCD nếu CCCD khác `0`.
- CCCD `0`: dùng `source_file_hash + source_row_number`.
- Không tạo bản ghi trùng khi import lại cùng file.
- Mỗi import tạo batch, checksum, số dòng hợp lệ/lỗi/cảnh báo.

## 8. Bảo toàn nguồn

Lưu riêng:

- `source_value` của từng trường;
- số dòng Excel;
- tên sheet;
- tên file;
- checksum file;
- thời điểm import;
- người import.

Không ghi đè nguồn khi học sinh sửa hồ sơ.
