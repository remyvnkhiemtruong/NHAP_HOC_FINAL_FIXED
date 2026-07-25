# HỒ SƠ WORKBOOK DỮ LIỆU CHÍNH THỨC

## 1. Workbook chính thức

`00_INPUTS/01_DU_LIEU_CHINH_THUC_TRUNG_TUYEN.xlsx`

## 2. Các sheet

| Sheet | Phạm vi | Cách sử dụng |
| --- | --- | --- |
| Danh sách trúng tuyển | A1:O934 | Nguồn dữ liệu chính thức để import; header tại dòng 4, 930 học sinh từ dòng 5–934. |
| Dữ liệu OCR gốc | A1:P931 | Dữ liệu trích xuất OCR ban đầu; chỉ dùng truy vết, không import hồ sơ. |
| Thông tin | A1:B35 | Thông tin nguồn, số lượng và kết luận rà soát. |
| Nhật ký sửa OCR | A1:F148 | Nhật ký sửa lần đầu; chỉ dùng kiểm chứng. |
| Rà soát bổ sung | A1:G29 | Các lỗi bổ sung và kết quả kiểm tra. |
| Rà soát lần cuối | A1:G22 | Rà soát toàn bộ dữ liệu lần cuối. |
| Rà soát xác nhận | A1:G19 | Xác nhận cuối cùng; dữ liệu sheet chính là dữ liệu chuẩn. |

## 3. Quy tắc nguồn sự thật

- Chỉ import sheet `Danh sách trúng tuyển`.
- Không import từ `Dữ liệu OCR gốc`.
- Không tự áp dụng lại các giá trị “trước sửa” trong nhật ký.
- Các sheet rà soát là bằng chứng nguồn gốc và lịch sử chỉnh sửa.
- Giữ đúng họ tên đang có trong sheet chính; không tự sửa tên riêng theo suy đoán.
- Dữ liệu chính thức có 930 hồ sơ, TT liên tục từ 1 đến 930.

## 4. Cấu trúc sheet chính

- Dòng 1: tiêu đề.
- Dòng 2: mô tả nguồn.
- Dòng 3: trống.
- Dòng 4: header.
- Dòng 5 đến 934: dữ liệu.
- 15 cột A–O.

| Cột nguồn | Tên chính xác |
| --- | --- |
| A | TT |
| B | Mã định danh cá nhân/CCCD |
| C | Họ và tên |
| D | Nữ |
| E | Ngày tháng năm sinh |
| F | Dân tộc |
| G | Nơi cư trú (Xã/Phường) |
| H | Trường THCS - Tên trường |
| I | Trường THCS - Xã/Phường |
| J | Tổng ĐTB môn cả năm các môn học của 4 năm cấp THCS |
| K | Tổng điểm quy đổi của 4 năm cấp THCS |
| L | Điểm ưu tiên |
| M | Điểm khuyến khích |
| N | Điểm xét tuyển |
| O | Ghi chú |

## 5. Kiểu dữ liệu cần lưu ý

- Cột B CCCD đang là số với định dạng Excel `000000000000`; phải chuyển thành chuỗi 12 ký tự và giữ số 0 đầu.
- Riêng TT 829 có mã `0` đúng theo workbook; không được tự biến thành `000000000000`.
- Cột E ngày sinh là ngày Excel, định dạng hiển thị `dd/mm/yyyy`.
- Cột D: `X` nghĩa là Nữ; ô trống nghĩa là Nam.
- Cột L/M điểm ưu tiên/khuyến khích để trống nghĩa là 0.
- Điểm xét tuyển = Tổng ĐTB + Tổng điểm quy đổi + Điểm ưu tiên + Điểm khuyến khích.
