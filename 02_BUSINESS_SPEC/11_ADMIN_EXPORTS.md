# QUYỀN TẢI DỮ LIỆU CỦA ADMIN

## 1. PDF từng học sinh

Tên:

`Thong_tin_hoc_sinh_<CCCD>.pdf`

Nội dung:

- thông tin trường;
- thông tin trúng tuyển;
- toàn bộ hồ sơ đã duyệt;
- ảnh 4x6;
- hình thu nhỏ mặt trước/mặt sau CCCD hoặc trạng thái tệp;
- dữ liệu cha mẹ/người bảo hộ;
- chính sách/khuyết tật;
- QR/OCR summary;
- danh sách thay đổi đã được chấp nhận;
- ngày tạo PDF.

## 2. Excel toàn trường

Tên:

`Thong_tin_hoc_sinh_toan_truong_2026_2027.xlsx`

- dùng mẫu 95 cột;
- đúng thứ tự A–CQ;
- giữ các sheet ref/tỉnh/xã/version nếu dùng template;
- chỉ export giá trị ADMIN đã duyệt;
- trường ẩn dùng giá trị mặc định;
- mã kỹ thuật chưa có để trống.

## 3. ZIP ảnh 4x6

Tên:

`Anh_4x6_toan_truong_2026_2027.zip`

Cấu trúc:

```text
095311003768.jpg
095211001217.jpg
...
```

Mỗi ảnh tên đúng `<CCCD>.jpg`.

## 4. ZIP ảnh CCCD

Tên:

`Anh_CCCD_toan_truong_2026_2027.zip`

Cấu trúc:

```text
095311003768/
├── mat_truoc.jpg
└── mat_sau.jpg
```

## 5. Quy tắc trước export

- Chỉ dùng tệp phiên bản hiện hành.
- Báo danh sách thiếu ảnh.
- Báo CCCD bằng 0, thiếu hoặc trùng.
- Không âm thầm đổi tên gây trùng.
- Tạo job nền, hiển thị tiến độ.
- ADMIN tải khi job hoàn tất.
