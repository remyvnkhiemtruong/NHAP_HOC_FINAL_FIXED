# Hệ thống hồ sơ nhập học lớp 10

Ứng dụng Next.js quản lý nhiều đợt nhập học: nhập danh sách Excel bất đồng bộ, học sinh xác nhận/chỉnh sửa dữ liệu, tải ảnh 4×6 và CCCD, quản trị duyệt sai khác/tệp, khóa hồ sơ và tạo đợt xuất chính thức bất biến.

## Yêu cầu

- Node.js 22 LTS và npm.
- PostgreSQL 15 trở lên.
- Redis 7 trở lên cho hàng đợi xuất dữ liệu.
- Có thể dùng Docker Desktop để chạy PostgreSQL và Redis.

## Cài đặt nhanh trên Windows CMD/PowerShell

```bat
npm install
npm run setup:env
docker compose up -d db redis
npx prisma migrate deploy
npm run seed:admin
npm run dev
```

Lệnh `npm run setup:env` tự tạo `.env`, sinh khóa JWT, khóa mã hóa, mật khẩu PostgreSQL và mật khẩu quản trị ban đầu. Mật khẩu quản trị được in ra màn hình và lưu trong `.env`.

Mở `http://localhost:3000`. Chạy worker ở một cửa sổ CMD/PowerShell khác:

```bat
npm run worker
```

## Cài đặt trên Linux/macOS

```bash
npm install
npm run setup:env
docker compose up -d db redis
npx prisma migrate deploy
npm run seed:admin
npm run dev
```

`npm install` tự chạy `prisma generate`. Kể từ bản sửa này, bước sinh Prisma Client không yêu cầu `DATABASE_URL`; URL thật chỉ bắt buộc khi migrate, seed hoặc chạy ứng dụng.

## Chạy production bằng Docker Compose

Sau khi tạo `.env`, triển khai migration và tạo ADMIN ban đầu, khởi động toàn bộ stack:

```bash
docker compose build
docker compose run --rm web npx prisma migrate deploy
docker compose run --rm web npm run backfill:search-indexes
docker compose run --rm web npm run seed:admin
docker compose up -d
```

Proxy Nginx đi kèm luôn nối địa chỉ kết nối thực vào cuối
`X-Forwarded-For`; ứng dụng đọc từ phải sang trái theo
`TRUSTED_PROXY_HOPS`. Giữ giá trị `1` khi Nginx là proxy duy nhất. Nếu đặt
thêm TLS proxy ở phía trước, đặt `2` và cấu hình TLS proxy ghi đè header do
client gửi tới.

Reverse proxy lắng nghe ở `127.0.0.1:3000`; hãy đặt TLS proxy của máy chủ phía trước cổng này. Web và worker dùng chung private volume, Redis dùng cho limiter/queue, và Docker tự xoay log JSON. Import giới hạn 20 MB; ảnh giới hạn 5 MB ở cả proxy và ứng dụng.

Không đưa `.env`, `node_modules`, `.next` hoặc dữ liệu trong `storage` lên kho mã nguồn.

## Trường hợp đã cài lỗi trước đó trên Windows

Mở CMD trong thư mục dự án rồi chạy:

```bat
rmdir /s /q node_modules
del package-lock.json
npm cache verify
npm install
npm run setup:env
```

Chỉ xóa `package-lock.json` khi npm tiếp tục báo thiếu SWC sau một lần `npm install` hoàn chỉnh. Không ngắt `npm install` hoặc `next build` trong lúc Next.js đang vá lockfile.

## Kiểm tra mã nguồn

```bash
npm run lint
npm run typecheck
npm run verify:config
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Các bài integration/E2E cần PostgreSQL, Redis và biến môi trường kiểm thử. Xem hướng dẫn chi tiết tại [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md).
