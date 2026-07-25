# ÁNH XẠ 15 CỘT NGUỒN CHÍNH THỨC

| Trường nguồn | Cột | Trường đích | Quy tắc |
| --- | --- | --- | --- |
| TT | A | admission_source_row | Chỉ dùng truy vết; không map vào STT A của file 95 cột vì STT đích được sinh khi xuất. |
| Mã định danh cá nhân/CCCD | B | student.cccd / cột BF | Giữ chuỗi 12 số, zfill; riêng giá trị 0 giữ nguyên. |
| Họ và tên | C | student.full_name / cột C | Giữ nguyên dữ liệu chính thức; học sinh có thể đề nghị sửa. |
| Nữ | D | student.gender / cột G | X = Nữ; trống = Nam. |
| Ngày tháng năm sinh | E | student.date_of_birth / cột F | Đọc ngày Excel hoặc dd/mm/yyyy. |
| Dân tộc | F | student.ethnicity / cột W và BY | Prefill W và BY; học sinh có thể sửa bằng dropdown 54 dân tộc. |
| Nơi cư trú (Xã/Phường) | G | admission.residence_commune + prefill địa chỉ | Lưu nguyên chuỗi nguồn; dùng để gợi ý xã/phường thường trú, học sinh xác nhận/sửa. |
| Trường THCS - Tên trường | H | admission.middle_school_name | Lưu snapshot tuyển sinh, hiển thị trong hồ sơ và PDF. |
| Trường THCS - Xã/Phường | I | admission.middle_school_commune | Lưu snapshot tuyển sinh. |
| Tổng ĐTB ... 4 năm | J | admission.four_year_subject_average_total | Số thập phân. |
| Tổng điểm quy đổi ... | K | admission.four_year_conduct_conversion_total | Số. |
| Điểm ưu tiên | L | admission.priority_score | Trống = 0. |
| Điểm khuyến khích | M | admission.encouragement_score | Trống = 0. |
| Điểm xét tuyển | N | admission.admission_score | Kiểm tra lại bằng tổng J+K+L+M. |
| Ghi chú | O | admission.note | Hiện tại toàn bộ trống; vẫn hỗ trợ. |

## Dữ liệu tuyển sinh không nằm trong 95 cột

Tên trường THCS, xã/phường trường THCS và các điểm tuyển sinh cần lưu trong nhóm `admission_snapshot`. Các dữ liệu này:

- xuất hiện trong dashboard ADMIN;
- xuất hiện trong PDF từng học sinh;
- có thể được học sinh đề nghị sửa;
- không tự động chen vào file Excel 95 cột nếu mẫu không có cột tương ứng.
