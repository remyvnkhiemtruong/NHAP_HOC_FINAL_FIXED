const FIELD_LABELS: Record<string, string> = {
  BF: "Số CCCD", C: "Họ và tên", F: "Ngày sinh", G: "Giới tính", W: "Dân tộc",
  X: "Tôn giáo", BG: "Ngày cấp CCCD", BH: "Nơi cấp CCCD", CG: "Tỉnh/thành nơi sinh",
  CH: "Xã/phường nơi sinh", L: "Tỉnh/thành thường trú", N: "Xã/phường thường trú",
  O: "Thôn/xóm thường trú", AF: "Số điện thoại học sinh", BI: "Email học sinh",
  AK: "Họ và tên cha", AL: "Năm sinh cha", AM: "Nghề nghiệp cha", AN: "Điện thoại cha",
  AP: "CCCD cha", AQ: "Họ và tên mẹ", AR: "Năm sinh mẹ", AS: "Nghề nghiệp mẹ",
  AT: "Điện thoại mẹ", AV: "CCCD mẹ", AW: "Họ và tên người bảo hộ", AX: "Năm sinh người bảo hộ",
  AY: "Nghề nghiệp người bảo hộ", AZ: "Điện thoại người bảo hộ", AE: "Khuyết tật",
  AH: "Nhóm máu", AJ: "Biết bơi", BD: "Loại tốt nghiệp cấp dưới", BJ: "Diện ưu tiên, khuyến khích",
  BN: "Phụ huynh có Internet", BO: "Phụ huynh có điện thoại thông minh",
};

const STATUS_LABELS: Record<string, string> = {
  IMPORTED: "Đã import", DRAFT: "Đang khai", SUBMITTED: "Đã gửi", NEED_REVISION: "Cần bổ sung",
  RESUBMITTED: "Đã gửi lại", APPROVED: "Đã duyệt", LOCKED: "Đã khóa", EXPORTED: "Đã xuất",
  NEEDS_CCCD_CORRECTION: "Chưa có CCCD hợp lệ", PENDING: "Đang chờ", PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn tất", FAILED: "Thất bại", UPLOADED: "Đã tải lên", AUTO_VALID: "Tự động hợp lệ",
  AUTO_WARNING: "Cần kiểm tra", AUTO_INVALID: "Không hợp lệ", ADMIN_APPROVED: "Đã duyệt",
  ADMIN_REJECTED: "Đã từ chối", REUPLOAD_REQUIRED: "Cần tải lại",
};

const FILE_LABELS: Record<string, string> = {
  PHOTO_4X6: "Ảnh thẻ 4×6", CCCD_FRONT: "CCCD mặt trước", CCCD_BACK: "CCCD mặt sau", OTHER: "Tệp khác",
};

export const adminFieldLabel = (code: string) => FIELD_LABELS[code] ?? "Thông tin hồ sơ";
export const adminStatusLabel = (status: string) => STATUS_LABELS[status] ?? "Chưa xác định";
export const adminFileLabel = (category: string) => FILE_LABELS[category] ?? "Tệp hồ sơ";
