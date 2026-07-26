# Runbook triển khai và vận hành 2026–2027

Áp dụng cho hệ thống hồ sơ trúng tuyển lớp 10 THPT Võ Văn Kiệt. Production gồm ba tiến trình riêng: Next.js web/API, PostgreSQL và Redis/BullMQ worker. Chỉ có role `ADMIN`; học sinh truy cập bằng CCCD và ngày sinh, không OTP/CAPTCHA.

## Môi trường và khởi động

Sao chép `.env.example` thành `.env` ngoài source control. Không dùng `docker-compose.yml` hiện có cho production: file đó chỉ dành cho phát triển cục bộ vì có tài khoản/port mặc định.

| Biến                                                | Mục đích            | Yêu cầu production                       |
| --------------------------------------------------- | ------------------- | ---------------------------------------- |
| `DATABASE_URL`                                      | PostgreSQL ứng dụng | TLS, user tối thiểu quyền, mật khẩu mạnh |
| `REDIS_URL`                                         | BullMQ export       | authenticated/TLS, không public Internet |
| `JWT_SECRET`                                        | ký session          | tối thiểu 32 byte ngẫu nhiên             |
| `ENCRYPTION_KEY`                                    | mã hóa dữ liệu nhạy cảm | đúng 64 ký tự hex, quản lý như secret |
| `ADMISSION_YEAR`                                    | năm tuyển sinh      | đặt đúng năm đang vận hành                |
| `STORAGE_ROOT`                                      | private filesystem  | absolute shared volume trên web + worker |
| `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD` | ADMIN đầu tiên      | secret manager, password ≥16 ký tự       |

Thứ tự triển khai khuyến nghị:

```powershell
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run backfill:search-indexes
npm run seed:admin
npm run build
npm run start
# tiến trình riêng, cùng .env và STORAGE_ROOT
npm run worker
```

Không đưa web nhận traffic trước khi backfill hoàn tất. `/api/health` chỉ trả
`200 ready` khi PostgreSQL, Redis và toàn bộ blind index bắt buộc đều sẵn
sàng; nếu còn bản ghi thiếu index, endpoint trả `503` cùng số lượng cần xử lý.

Seed ADMIN idempotent: chạy lại cập nhật hash mật khẩu, role `ADMIN` và trạng thái active của cùng username. Script từ chối username mặc định/test và mật khẩu ngắn. Dữ liệu trúng tuyển không được seed kèm mã nguồn; nhập qua màn hình `/admin/import` để có nhật ký và kiểm tra file.

## Migration, import và storage

Production chỉ dùng `prisma migrate deploy`; không dùng `migrate dev`, `migrate reset` hoặc `db push`. Trước migration tạo backup, sau đó kiểm tra:

```powershell
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Sau migration kiểm tra ADMIN login, student access CCCD+ngày sinh, worker/job export và log không có API 5xx.

Storage hiện là **private filesystem**, không phải MinIO/S3: upload ở `$STORAGE_ROOT/uploads/<studentId>/`, export ở `$STORAGE_ROOT/exports/<exportJobId>/`. Không phục vụ trực tiếp thư mục này qua proxy; download luôn qua API đã xác thực. Web và worker phải mount chính xác cùng volume. Database quyết định version hiện hành; không đổi tên/sửa tệp nguồn import.

Trước import workbook chính thức, xác minh checksum/số dòng `ImportBatch`. Không import lại để “sửa” dữ liệu nguồn; sử dụng đề xuất học sinh và ADMIN duyệt.

## Backup, restore và rollback

Backup hằng ngày gồm **cả** PostgreSQL và `STORAGE_ROOT`; giữ tối thiểu 7 daily, 4 weekly, 12 monthly; mã hóa khi đưa ra ngoài máy chủ.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
pg_dump --format=custom --no-owner --file "D:\vvk-backups\db-$stamp.dump" $env:DATABASE_URL
Compress-Archive -Path "$env:STORAGE_ROOT\*" -DestinationPath "D:\vvk-backups\storage-$stamp.zip"
Get-FileHash "D:\vvk-backups\db-$stamp.dump", "D:\vvk-backups\storage-$stamp.zip" -Algorithm SHA256
```

Khôi phục trước trên môi trường cô lập: dừng web/worker, restore database và storage **cùng mốc**, chạy `prisma migrate status`, kiểm tra ADMIN login và một export. Chỉ sau khi phê duyệt mới chuyển production.

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:DATABASE_URL "D:\vvk-backups\db-YYYYMMDD-HHMMSS.dump"
Expand-Archive "D:\vvk-backups\storage-YYYYMMDD-HHMMSS.zip" -DestinationPath $env:STORAGE_ROOT
```

Rollback ứng dụng bằng artifact trước và giữ nguyên database/Redis/storage. Migration Prisma không tự đảo chiều; rollback database chỉ bằng backup đã kiểm tra hoặc migration down được phê duyệt. Không chạy SQL thủ công để xóa/sửa `AdmissionRecord`, `source_value`, TT 829 hoặc ba cờ CCCD/giới tính.

## Vận hành năm học

Mỗi ngày kiểm tra backup checksum, dung lượng storage, PostgreSQL/Redis, worker, job `FAILED`, AuditLog và cảnh báo CCCD `0`, CCCD/giới tính, thiếu/invalid ảnh, thay đổi chờ duyệt. Khi Redis hồi phục, gửi lại yêu cầu export giống hệt để idempotency enqueue lại job `PENDING`; không sửa trực tiếp `ExportJob`, checksum hoặc ZIP.

Khi PostgreSQL báo `ECONNREFUSED`, xác nhận service, DNS/port, `DATABASE_URL`, TLS và quyền trước khi restart. Không bypass validation hay tạo dữ liệu giả trong production.

## Nghiệm thu và API

Trước go-live dùng Node.js 22 và chạy `npm run lint`, `npm run typecheck`,
`npm run test:unit`, `npm run test:integration`, `npm run test:uat`,
`npm run test:e2e`, `npm run build`, `npm run verify:audit`; kiểm tra
desktop/tablet/mobile, console, hydration, network và API 5xx.

Export theo API contract: tạo job `POST /api/admin/exports/{student-pdf|school-excel|photo-4x6-zip|cccd-zip}`, polling `GET /api/admin/jobs/:id`, download `GET /api/admin/jobs/:id/download`. Payload/params validate server-side; output chỉ tải khi `COMPLETED`, CSV lỗi có thể tải khi `FAILED`.

Ghi nhận mỗi lần deploy: artifact/version, người triển khai, migration, backup checksum, thời điểm web/worker lên, kết quả smoke test và quyết định rollback.
