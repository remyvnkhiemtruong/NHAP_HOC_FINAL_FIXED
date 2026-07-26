export const FIELD_LABELS: Record<string, string> = {
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
  BY: "Dân tộc (giấy khai sinh)", U: "Chỗ ở hiện nay", V: "Ngày vào Đội", BL: "Ngày vào Đoàn",
  Y: "Đối tượng chính sách", Z: "Chế độ chính sách", AO: "Email cha", AU: "Email mẹ",
  BA: "Email người bảo hộ", BB: "CCCD người bảo hộ",
  ADMISSION_H: "Trường THCS", ADMISSION_I: "Địa bàn trường THCS",
  ADMISSION_J: "Điểm TB 4 năm", ADMISSION_K: "Điểm hạnh kiểm",
  ADMISSION_L: "Điểm ưu tiên", ADMISSION_M: "Điểm khuyến khích",
  ADMISSION_N: "Điểm xét tuyển",
};

const STATUS_LABELS: Record<string, string> = {
  IMPORTED: "Đã import", DRAFT: "Đang khai", SUBMITTED: "Đã gửi", NEED_REVISION: "Cần bổ sung",
  RESUBMITTED: "Đã gửi lại", APPROVED: "Đã duyệt", LOCKED: "Đã khóa", EXPORTED: "Đã xuất",
  NEEDS_CCCD_CORRECTION: "Chưa có CCCD hợp lệ", PENDING: "Đang chờ", PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn tất", FAILED: "Thất bại", UPLOADED: "Đã tải lên", AUTO_VALID: "Tự động hợp lệ",
  AUTO_WARNING: "Cần kiểm tra", AUTO_INVALID: "Không hợp lệ", ADMIN_APPROVED: "Đã duyệt",
  ADMIN_REJECTED: "Đã từ chối", REUPLOAD_REQUIRED: "Cần tải lại",
};

export const FILE_LABELS: Record<string, string> = {
  PHOTO_4X6: "Ảnh thẻ 4×6", CCCD_FRONT: "CCCD mặt trước", CCCD_BACK: "CCCD mặt sau", OTHER: "Tệp khác",
};

export const adminFieldLabel = (code: string) => FIELD_LABELS[code] ?? "Thông tin hồ sơ";
export const adminStatusLabel = (status: string) => STATUS_LABELS[status] ?? "Chưa xác định";
export const adminFileLabel = (category: string) => FILE_LABELS[category] ?? "Tệp hồ sơ";

export const ADMIN_REVIEW_STEPS = [
  {
    title: "Thông tin trúng tuyển",
    fields: ["C", "F", "G", "W", "BF", "BG", "BH", "ADMISSION_H", "ADMISSION_I", "ADMISSION_J", "ADMISSION_K", "ADMISSION_L", "ADMISSION_M", "ADMISSION_N"],
  },
  { title: "Nơi sinh và quê quán", fields: ["CG", "CH", "BY", "X"] },
  { title: "Địa chỉ cư trú", fields: ["L", "N", "O", "U"] },
  { title: "Đội, Đoàn và chính sách", fields: ["V", "BL", "Y", "Z", "BJ"] },
  { title: "Sức khỏe và học tập", fields: ["AE", "AH", "AJ", "BD"] },
  { title: "Liên hệ học sinh", fields: ["AF", "BI"] },
  { title: "Thông tin gia đình", fields: ["AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV"] },
  { title: "Người bảo hộ", fields: ["AW", "AX", "AY", "AZ", "BA", "BB"] },
] as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  PROFILE_DRAFT_SAVED: "Lưu bản nháp",
  FILE_UPLOADED: "Tải lên tệp/ảnh",
  CCCD_SERVER_SCAN_COMPLETED: "Quét CCCD thành công",
  CCCD_SERVER_SCAN_FAILED: "Quét CCCD thất bại",
  PROFILE_SUBMITTED: "Nộp hồ sơ",
  PROFILE_RESUBMITTED: "Nộp lại hồ sơ",
  PROFILE_REVISION_REQUESTED: "Yêu cầu bổ sung",
  PROFILE_APPROVED: "Phê duyệt hồ sơ",
  PROFILE_REVIEWED: "Duyệt thay đổi hồ sơ",
  LOCK_PROFILE: "Khóa hồ sơ",
  UNLOCK_PROFILE: "Mở khóa hồ sơ",
  FILE_APPROVED: "Duyệt tệp/ảnh",
  FILE_REJECTED: "Từ chối tệp/ảnh",
  EXPORT_REQUESTED: "Yêu cầu xuất dữ liệu",
  EXPORT_PROCESSING: "Bắt đầu xuất dữ liệu",
  EXPORT_COMPLETED: "Hoàn tất xuất dữ liệu",
  EXPORT_FAILED: "Xuất dữ liệu thất bại",
  OFFICIAL_EXPORT_CREATED: "Tạo đợt xuất chính thức",
  STUDENT_LOGIN: "Đăng nhập học sinh",
  ADMIN_LOGIN: "Đăng nhập quản trị",
};

export const AUDIT_ACTOR_LABELS: Record<string, string> = {
  STUDENT: "Học sinh",
  ADMIN: "Quản trị viên",
  SYSTEM: "Hệ thống",
};
