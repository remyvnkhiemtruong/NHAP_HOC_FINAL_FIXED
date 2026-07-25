# CÁC CỜ CHẤT LƯỢNG DỮ LIỆU PHẢI XỬ LÝ

Dữ liệu chính thức đã được rà soát nhiều vòng. Tuy vậy, khi kiểm tra ngữ nghĩa CCCD theo quy tắc đã chốt, hệ thống cần gắn cờ các trường hợp sau mà **không tự sửa**:

| TT | CCCD | Họ tên | Ngày sinh | Cờ xử lý |
| --- | --- | --- | --- | --- |
| 829 | 0 | PHAN HOÀNG AN | 15/12/2011 | CCCD bằng 0; không thể dùng luồng truy cập bình thường trước khi ADMIN sửa. |
| 384 | 095211009102 | TRƯƠNG GIA MINH | 26/07/2011 | Đánh dấu giới tính nguồn và ký tự thứ 4 CCCD không khớp: dự kiến 3, thực tế 2. Không tự sửa; đưa ADMIN rà soát. |
| 491 | 095111009267 | PHẠM YẾN NHI | 14/01/2011 | Đánh dấu giới tính nguồn và ký tự thứ 4 CCCD không khớp: dự kiến 3, thực tế 1. Không tự sửa; đưa ADMIN rà soát. |
| 510 | 095211004685 | LÊ ĐĂNG KHÔI | 26/03/2011 | Đánh dấu giới tính nguồn và ký tự thứ 4 CCCD không khớp: dự kiến 3, thực tế 2. Không tự sửa; đưa ADMIN rà soát. |

## Quy tắc

1. TT 829:
   - Import bình thường với `source_cccd = "0"`.
   - Trạng thái `NEEDS_CCCD_CORRECTION`.
   - Không cho mở hồ sơ bằng CCCD hợp lệ cho đến khi ADMIN cập nhật số đúng.
   - Không tự tạo CCCD.
2. Ba trường hợp không khớp mã giới tính:
   - Vẫn import và vẫn cho truy cập bằng CCCD + ngày sinh.
   - Hiển thị cờ cho ADMIN.
   - Học sinh được sửa giới tính hoặc CCCD trong phần đề nghị chỉnh sửa.
   - ADMIN quyết định giá trị cuối cùng sau khi xem hai mặt CCCD/QR.
3. Không dùng tên học sinh để suy đoán giới tính.
4. Không tự sửa dữ liệu chính thức khi chỉ có dấu hiệu không khớp.
