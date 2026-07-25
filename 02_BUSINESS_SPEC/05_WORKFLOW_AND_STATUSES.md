# WORKFLOW VÀ TRẠNG THÁI

## Trạng thái hồ sơ

- `IMPORTED`: đã import, chưa mở.
- `DRAFT`: học sinh đang kê khai.
- `SUBMITTED`: đã gửi.
- `NEED_REVISION`: ADMIN yêu cầu bổ sung.
- `RESUBMITTED`: học sinh gửi lại.
- `APPROVED`: ADMIN đã duyệt.
- `LOCKED`: hồ sơ khóa.
- `EXPORTED`: đã nằm trong đợt xuất.
- `NEEDS_CCCD_CORRECTION`: ngoại lệ chưa có CCCD hợp lệ.

## Trạng thái ảnh

- `MISSING`
- `UPLOADED`
- `AUTO_VALID`
- `AUTO_WARNING`
- `AUTO_INVALID`
- `ADMIN_APPROVED`
- `ADMIN_REJECTED`
- `REUPLOAD_REQUIRED`

## Trạng thái thay đổi trường

- `UNCHANGED`
- `PROPOSED`
- `ACCEPTED`
- `REJECTED`
- `ADMIN_EDITED`

## Chuyển trạng thái

- Import → IMPORTED.
- Lưu lần đầu → DRAFT.
- Đủ dữ liệu và ảnh → SUBMITTED.
- ADMIN yêu cầu sửa → NEED_REVISION.
- Gửi lại → RESUBMITTED.
- ADMIN duyệt → APPROVED.
- ADMIN khóa → LOCKED.
- Tạo export thành công → EXPORTED.
