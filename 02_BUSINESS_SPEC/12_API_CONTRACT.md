# API CONTRACT ĐỀ XUẤT

## Học sinh

- `POST /api/student/access`
- `GET /api/student/profile`
- `PATCH /api/student/profile`
- `POST /api/student/profile/submit`
- `POST /api/student/files`
- `DELETE /api/student/files/:id`
- `POST /api/student/cccd/scan`
- `POST /api/student/photo-4x6/scan`
- `GET /api/student/change-summary`

## ADMIN

- `POST /api/admin/imports`
- `GET /api/admin/imports/:id`
- `GET /api/admin/students`
- `GET /api/admin/students/:id`
- `PATCH /api/admin/students/:id`
- `POST /api/admin/students/:id/request-revision`
- `POST /api/admin/students/:id/approve`
- `POST /api/admin/students/:id/lock`
- `POST /api/admin/students/:id/unlock`
- `POST /api/admin/students/:id/field-decisions`
- `POST /api/admin/exports/student-pdf`
- `POST /api/admin/exports/school-excel`
- `POST /api/admin/exports/photo-4x6-zip`
- `POST /api/admin/exports/cccd-zip`
- `GET /api/admin/jobs/:id`
- `GET /api/admin/jobs/:id/download`

## Yêu cầu chung

- Validate payload ở server.
- Trả lỗi theo trường.
- Upload multipart hoặc signed upload.
- Job export bất đồng bộ.
- Không trả dữ liệu hồ sơ khác qua thay đổi ID trên client.
