export function extractFirstName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function getHiddenFieldDefaults(studentInfo: { fullName: string }) {
  const fields = [
    { field_code: "B", value: "" }, // Mã học sinh
    { field_code: "D", value: extractFirstName(studentInfo.fullName) }, // Tên
    { field_code: "E", value: "" }, // Mã MOET
    { field_code: "H", value: "" }, // Lớp
    { field_code: "I", value: "Xét tuyển" }, // Hình thức trúng tuyển
    { field_code: "J", value: "05/09/2026" }, // Ngày vào trường
    { field_code: "K", value: "Đang học" }, // Trạng thái của học sinh
    { field_code: "M", value: "" }, // Mã xã/phường thường trú (will be derived later)
    { field_code: "P", value: "" }, // Sổ đăng bộ
    { field_code: "Q", value: "" }, // Nơi sinh (will be derived)
    { field_code: "R", value: "" }, // Nơi sinh theo giấy khai sinh (will be derived)
    { field_code: "S", value: "" }, // Địa chỉ quê quán chi tiết (will be derived)
    { field_code: "T", value: "" }, // Địa chỉ thường trú chi tiết (will be derived)
    { field_code: "AB", value: "Không" }, // Thuộc diện tái định cư
    { field_code: "AC", value: "Đồng bằng" }, // Khu vực
    { field_code: "AI", value: "Có" }, // Học chương trình giáo dục của Bộ
    { field_code: "BK", value: "" }, // Hướng nghiệp dạy nghề
    { field_code: "BP", value: "" }, // Ngày vào Đảng
    { field_code: "BQ", value: "Không" }, // Tư vấn giáo dục hướng nghiệp
    { field_code: "BR", value: "Trực tiếp" }, // Hình thức học
    { field_code: "CE", value: "10 buổi/tuần" }, // Số buổi học trên tuần
    { field_code: "BU", value: "" }, // Học lớp MG 5 tuổi
    { field_code: "BV", value: "Không" }, // HSDT có nhu cầu HT NN
    { field_code: "BW", value: "Không" }, // HSDT có TL T.Cường TV
    { field_code: "BX", value: "Không" }, // Học sinh DT trợ giảng
    { field_code: "BZ", value: "Không" }, // Học bán trú
    { field_code: "CA", value: "Không" }, // Hỗ trợ nhà ở
    { field_code: "CB", value: "Không" }, // Cấp tiền hàng tháng
    { field_code: "CC", value: "Không" }, // Cấp gạo
    { field_code: "CD", value: "Không" }, // Học tiếng dân tộc
    { field_code: "CF", value: "Không" }, // Lưu ban năm trước
    { field_code: "CL", value: "" }, // Mã hệ thống khác
    { field_code: "CM", value: "Có" }, // Học 2 buổi
    { field_code: "CN", value: "Không" }, // Làm quen với tin học
    { field_code: "CO", value: "Không" }, // Làm quen với ngoại ngữ
    { field_code: "CP", value: "" }, // SSO
    { field_code: "CQ", value: "" }, // Mã địa phương nộp MOET
  ];

  return fields;
}
