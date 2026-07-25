# TÓM TẮT BẢN SỬA HỆ THỐNG NHẬP HỌC

## Phạm vi hoàn thành

- Khôi phục đầy đủ giao diện học sinh và quản trị bằng Next.js App Router.
- Hoàn thiện biểu mẫu nhập học 9 bước, lưu nháp, tải/kiểm tra ảnh, quét QR CCCD và gửi hồ sơ.
- Hoàn thiện dashboard, nhập Excel, danh sách duyệt, duyệt từng trường/tệp, yêu cầu bổ sung, khóa và xuất dữ liệu.
- Chuẩn hóa state machine hồ sơ: `IMPORTED → DRAFT → SUBMITTED/RESUBMITTED → APPROVED → LOCKED → EXPORTED`, kèm nhánh `NEED_REVISION` và `NEEDS_CCCD_CORRECTION`.
- Siết xác thực phiên, thu hồi session trong cơ sở dữ liệu, cookie an toàn, rate limit Redis có fallback và security headers/CSP.
- Thay mã hóa cũ bằng AES-256-GCM có xác thực; bắt buộc `ENCRYPTION_KEY` riêng cho từng môi trường.
- Kiểm tra tệp theo magic bytes, chống path traversal, ghi tệp nguyên tử, giới hạn kích thước và xác minh ảnh phía máy chủ.
- Không tin dữ liệu QR/OCR do trình duyệt tự gửi; kết quả được đọc và lưu phía máy chủ.
- Siết import XLSX: giới hạn ZIP bomb, macro/external link, số dòng/cột, CCCD trùng, ngày sinh, tổng điểm và checksum idempotent.
- Siết quy trình duyệt: chỉ duyệt hồ sơ đúng trạng thái, không phê duyệt khi còn trường/tệp chưa xử lý, lưu người duyệt/thời điểm/lý do.
- Siết export: chỉ lấy phiên bản tệp hiện hành hợp lệ, chống formula injection, kiểm tra CCCD/ảnh trước xuất, dọn tệp mồ côi nếu giao dịch thất bại.
- Bổ sung migration đảm bảo checksum lô import và số dòng trong lô là duy nhất.
- Thay toàn bộ ảnh minh họa giấy tờ bằng SVG trung tính, không chứa dữ liệu cá nhân.
- Cập nhật `.env.example`, Docker Compose, hướng dẫn cài đặt, seed ADMIN và bài kiểm tra dùng dữ liệu tổng hợp.

## Bổ sung bản 1.0.1 — sửa cài đặt Windows

- `npm install` không còn thất bại khi chưa có `DATABASE_URL`; `prisma generate` có thể chạy trước khi cấu hình cơ sở dữ liệu.
- Việc kiểm tra `ENCRYPTION_KEY` được chuyển sang thời điểm thực sự mã hóa/giải mã, tránh làm hỏng bước build chỉ vì chưa nạp secret runtime.
- Bổ sung `npm run setup:env` để tự sinh `.env`, khóa JWT, khóa AES-256, mật khẩu PostgreSQL và mật khẩu ADMIN.
- Bổ sung `INSTALL_WINDOWS.cmd` và hướng dẫn CMD/PowerShell riêng.
- Làm rõ cách xử lý `node_modules` hoặc lockfile bị dở dang khi người dùng ngắt quá trình cài đặt/build.

## Kiểm tra đã thực hiện trong môi trường bàn giao

- `tsc --noEmit`: đạt, không có lỗi TypeScript.
- `eslint .`: đạt, không có lỗi lint.
- Smoke test độc lập: đạt cho parser QR, state machine và mã hóa/giải mã AES-GCM.
- Kiểm tra cấu trúc ZIP cuối: không có `node_modules`, `.env`, `.next`, cache, log, dữ liệu runtime hoặc tệp tạm.

## Giới hạn kiểm tra của môi trường hiện tại

Bản `node_modules` trong gói nguồn ban đầu được cài trên Windows. Khi chạy trên Linux, các binary `@next/swc`, Prisma engine và `esbuild` không tương thích; kho tải phụ thuộc tại môi trường kiểm tra đồng thời trả lỗi 503/EAI_AGAIN. Vì vậy build/Jest/Prisma migration không thể chạy bằng thư mục phụ thuộc cũ. ZIP phát hành không chứa thư mục này; tại máy đích cần chạy `npm install` để cài đúng binary cho hệ điều hành, sau đó chạy toàn bộ lệnh trong README.
