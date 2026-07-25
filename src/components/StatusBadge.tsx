const LABELS: Record<string, string> = {
  IMPORTED: "Đã nhập danh sách",
  DRAFT: "Đang bổ sung",
  SUBMITTED: "Chờ duyệt",
  NEED_REVISION: "Cần chỉnh sửa",
  RESUBMITTED: "Đã gửi lại",
  APPROVED: "Đã phê duyệt",
  LOCKED: "Đã khóa",
  EXPORTED: "Đã xuất dữ liệu",
  NEEDS_CCCD_CORRECTION: "Cần cập nhật CCCD",
  AUTO_VALID: "Tự động hợp lệ",
  AUTO_WARNING: "Cần kiểm tra",
  AUTO_INVALID: "Không hợp lệ",
  ADMIN_APPROVED: "Đã duyệt",
  ADMIN_REJECTED: "Bị từ chối",
  REUPLOAD_REQUIRED: "Cần tải lại",
};
export default function StatusBadge({ status }: { status: string }) {
  const tone = ["APPROVED", "LOCKED", "EXPORTED", "ADMIN_APPROVED", "AUTO_VALID"].includes(status)
    ? "success"
    : ["NEED_REVISION", "NEEDS_CCCD_CORRECTION", "ADMIN_REJECTED", "AUTO_INVALID", "REUPLOAD_REQUIRED"].includes(status)
      ? "danger"
      : ["SUBMITTED", "RESUBMITTED", "AUTO_WARNING"].includes(status)
        ? "warning"
        : "neutral";
  return <span className={`status status--${tone}`}>{LABELS[status] ?? status}</span>;
}
