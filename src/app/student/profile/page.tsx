"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

type FieldValue = string | boolean;
type ProfileFile = { id: string; category: string; status: string; currentVersion: number; originalName: string; width?: number | null; height?: number | null; url: string };
type ProfilePayload = {
  student: { id: string; status: string; editable: boolean; canSubmit: boolean };
  fields: Record<string, FieldValue>;
  admission: Record<string, string>;
  files: ProfileFile[];
};

type InputDefinition = { code: string; label: string; placeholder?: string; type?: string; required?: boolean; options?: string[]; wide?: boolean; help?: ReactNode; disabled?: boolean; provinceCode?: string; refKey?: string };
type StepDefinition = { title: string; subtitle: string; fields?: InputDefinition[]; kind?: "files" | "review" };

const STEPS: StepDefinition[] = [
  { title: "Thông tin trúng tuyển", subtitle: "Đối chiếu thông tin cá nhân và kết quả tuyển sinh.", fields: [
    { code: "C", label: "Họ và tên", required: true, wide: true }, { code: "F", label: "Ngày sinh", required: true, placeholder: "dd/mm/yyyy" },
    { code: "G", label: "Giới tính", required: true, options: ["Nam", "Nữ"] }, { code: "W", label: "Dân tộc", required: true, refKey: "Dân tộc" },
    { code: "BF", label: "Số CCCD", required: true, placeholder: "12 chữ số" }, { code: "BG", label: "Ngày cấp CCCD", placeholder: "dd/mm/yyyy" },
    { code: "BH", label: "Nơi cấp CCCD", disabled: true },
  ]},
  { title: "Nơi sinh và quê quán", subtitle: "Bổ sung thông tin theo giấy khai sinh và CCCD.", fields: [
    { code: "CG", label: "Tỉnh/thành nơi sinh", type: "province", required: true }, { code: "CH", label: "Xã/phường nơi sinh", type: "commune", provinceCode: "CG", required: true },
    { code: "BY", label: "Dân tộc trên giấy khai sinh", refKey: "Dân tộc", required: true }, { code: "X", label: "Tôn giáo", refKey: "Tôn giáo", required: true },
  ]},
  { title: "Địa chỉ cư trú", subtitle: "Thông tin dùng để liên hệ và quản lý học sinh.", fields: [
    { code: "L", label: "Tỉnh/thành thường trú", required: true, type: "province" }, { code: "N", label: "Xã/phường thường trú", required: true, type: "commune", provinceCode: "L" },
    { code: "O", label: "Ấp/khóm, số nhà, đường", wide: true, required: true },
  ]},
  { title: "Đội, Đoàn và chính sách", subtitle: "Khai báo thông tin đoàn thể và chế độ được hưởng.", fields: [
    { code: "is_doi_vien", label: "Là Đội viên", type: "checkbox", wide: true }, { code: "V", label: "Ngày vào Đội", placeholder: "dd/mm/yyyy", required: true },
    { code: "is_doan_vien", label: "Là Đoàn viên", type: "checkbox", wide: true }, { code: "BL", label: "Ngày vào Đoàn", placeholder: "dd/mm/yyyy", required: true },
    { code: "has_policy", label: "Thuộc đối tượng chính sách", type: "checkbox", wide: true }, { code: "Y", label: "Đối tượng chính sách", refKey: "Đối tượng chính sách", required: true },
    { code: "Z", label: "Chế độ chính sách", refKey: "Chế độ chính sách", required: true }, { code: "BJ", label: "Diện ưu tiên", refKey: "Diện ưu tiên khuyến khích", required: true, wide: true },
  ]},
  { title: "Sức khỏe và học tập", subtitle: "Các thông tin cần thiết để nhà trường hỗ trợ phù hợp.", fields: [
    { code: "has_disability", label: "Có khuyết tật", type: "checkbox", wide: true }, { code: "AE", label: "Dạng khuyết tật", refKey: "Loại khuyết tật", required: true, wide: true },
    { code: "AJ", label: "Biết bơi", required: true, options: ["Có", "Không"] },
    { code: "BD", label: "Loại tốt nghiệp THCS", refKey: "Import học sinh", required: true, wide: true },
  ]},
  { title: "Liên hệ học sinh", subtitle: "Ít nhất một số điện thoại của học sinh hoặc người thân phải hợp lệ.", fields: [
    { code: "AF", label: "Số điện thoại học sinh", placeholder: "10 chữ số" }, { code: "BI", label: "Email học sinh", type: "email" },
  ]},
  { title: "Thông tin gia đình", subtitle: "Thông tin cha, mẹ hoặc người giám hộ hợp pháp.", fields: [
    { code: "father_status", label: "Cha đã mất", type: "checkbox", wide: true }, 
    { code: "AK", label: "Họ và tên cha" }, { code: "AL", label: "Năm sinh của cha" }, 
    { code: "AM", label: "Nghề nghiệp của cha" }, { code: "AN", label: "Số điện thoại của cha" }, 
    { code: "AO", label: "Email cha", type: "email" }, { code: "AP", label: "Số CCCD cha" },
    { code: "mother_status", label: "Mẹ đã mất", type: "checkbox", wide: true }, 
    { code: "AQ", label: "Họ và tên mẹ" }, { code: "AR", label: "Năm sinh của mẹ" }, 
    { code: "AS", label: "Nghề nghiệp của mẹ" }, { code: "AT", label: "Số điện thoại của mẹ" }, 
    { code: "AU", label: "Email mẹ", type: "email" }, { code: "AV", label: "Số CCCD mẹ" },
  ]},
  { title: "Người bảo hộ", subtitle: "Dành cho học sinh không còn cha và mẹ.", fields: [
    { code: "AW", label: "Họ tên người bảo hộ" }, { code: "AX", label: "Năm sinh người bảo hộ" }, { code: "AY", label: "Nghề nghiệp người bảo hộ" },
    { code: "AZ", label: "Số điện thoại người bảo hộ" }, { code: "BA", label: "Email người bảo hộ", type: "email" }, { code: "BB", label: "Số CCCD người bảo hộ" },
  ]},
  { title: "Tài liệu & Nộp hồ sơ", subtitle: "Tải lên ảnh chụp minh chứng và xác nhận nộp hồ sơ.", kind: "files" },
];

function calculateNoiCap(ngayCap: string): string {
  if (!ngayCap) return "";
  const parts = ngayCap.split("/");
  if (parts.length === 3) {
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (!isNaN(date.getTime())) {
      const cutoff = new Date(2024, 6, 1);
      return date < cutoff ? "Cục Cảnh sát Quản lý Hành chính về Trật tự xã hội" : "Bộ Công an";
    }
  }
  return "";
}

const CCCD_PROVINCE_MAP: Record<string, string> = {
  "001": "Thành phố Hà Nội (01)", "002": "Tỉnh Tuyên Quang (08)", "008": "Tỉnh Tuyên Quang (08)",
  "004": "Tỉnh Cao Bằng (04)", "006": "Tỉnh Thái Nguyên (19)", "019": "Tỉnh Thái Nguyên (19)",
  "010": "Tỉnh Lào Cai (15)", "015": "Tỉnh Lào Cai (15)", "011": "Tỉnh Điện Biên (11)",
  "012": "Tỉnh Lai Châu (12)", "014": "Tỉnh Sơn La (14)", "017": "Tỉnh Phú Thọ (25)",
  "025": "Tỉnh Phú Thọ (25)", "026": "Tỉnh Phú Thọ (25)", "020": "Tỉnh Lạng Sơn (20)",
  "022": "Tỉnh Quảng Ninh (22)", "024": "Tỉnh Bắc Ninh (24)", "027": "Tỉnh Bắc Ninh (24)",
  "030": "Thành phố Hải Phòng (31)", "031": "Thành phố Hải Phòng (31)", "033": "Tỉnh Hưng Yên (33)",
  "034": "Tỉnh Hưng Yên (33)", "035": "Tỉnh Ninh Bình (37)", "036": "Tỉnh Ninh Bình (37)",
  "037": "Tỉnh Ninh Bình (37)", "038": "Tỉnh Thanh Hóa (38)", "040": "Tỉnh Nghệ An (40)",
  "042": "Tỉnh Hà Tĩnh (42)", "044": "Tỉnh Quảng Trị (44)", "045": "Tỉnh Quảng Trị (44)",
  "046": "Thành phố Huế (46)", "048": "Thành phố Đà Nẵng (48)", "049": "Thành phố Đà Nẵng (48)",
  "051": "Tỉnh Quảng Ngãi (51)", "062": "Tỉnh Quảng Ngãi (51)", "052": "Tỉnh Gia Lai (52)",
  "064": "Tỉnh Gia Lai (52)", "054": "Tỉnh Đắk Lắk (66)", "066": "Tỉnh Đắk Lắk (66)",
  "056": "Tỉnh Khánh Hòa (56)", "058": "Tỉnh Khánh Hòa (56)", "060": "Tỉnh Lâm Đồng (68)",
  "067": "Tỉnh Lâm Đồng (68)", "068": "Tỉnh Lâm Đồng (68)", "070": "Tỉnh Đồng Nai (75)",
  "075": "Tỉnh Đồng Nai (75)", "072": "Tỉnh Tây Ninh (80)", "080": "Tỉnh Tây Ninh (80)",
  "074": "Thành phố Hồ Chí Minh (79)", "077": "Thành phố Hồ Chí Minh (79)", "079": "Thành phố Hồ Chí Minh (79)",
  "083": "Tỉnh Vĩnh Long (86)", "084": "Tỉnh Vĩnh Long (86)", "086": "Tỉnh Vĩnh Long (86)",
  "082": "Tỉnh Đồng Tháp (82)", "087": "Tỉnh Đồng Tháp (82)", "089": "Tỉnh An Giang (91)",
  "091": "Tỉnh An Giang (91)", "092": "Thành phố Cần Thơ (92)", "093": "Thành phố Cần Thơ (92)",
  "094": "Thành phố Cần Thơ (92)", "095": "Tỉnh Cà Mau (96)", "096": "Tỉnh Cà Mau (96)"
};

function validateCCCDPartial(cccd: string, dob: string, gender: string): { tone: "error" | "success" | "info", text: string } | null {
  if (!cccd) return null;
  if (/[^0-9]/.test(cccd)) return { tone: "error", text: "CCCD chỉ được chứa chữ số." };

  if (cccd.length >= 3) {
    const provinceCode = cccd.substring(0, 3);
    if (!CCCD_PROVINCE_MAP[provinceCode]) return { tone: "error", text: "Số CCCD sai." };
  }

  let expectedYear = "";
  if (dob) {
    const parts = dob.split("/");
    if (parts.length === 3) expectedYear = parts[2];
  }

  if (cccd.length >= 4 && expectedYear && expectedYear.length === 4) {
    const centuryGender = parseInt(cccd.charAt(3), 10);
    const century = parseInt(expectedYear.substring(0, 2), 10) + 1;
    let expectedCenturyGender = -1;
    if (century === 20) expectedCenturyGender = gender === "Nam" ? 0 : 1;
    else if (century === 21) expectedCenturyGender = gender === "Nam" ? 2 : 3;
    else if (century === 22) expectedCenturyGender = gender === "Nam" ? 4 : 5;
    else if (century === 23) expectedCenturyGender = gender === "Nam" ? 6 : 7;
    else if (century === 24) expectedCenturyGender = gender === "Nam" ? 8 : 9;
    
    if (expectedCenturyGender !== -1 && centuryGender !== expectedCenturyGender) {
      return { tone: "error", text: "Số CCCD sai." };
    }
  }

  if (cccd.length >= 6 && expectedYear && expectedYear.length === 4) {
    const yearDigits = cccd.substring(4, 6);
    const expectedYearDigits = expectedYear.substring(2, 4);
    if (yearDigits !== expectedYearDigits) {
      return { tone: "error", text: "Số CCCD sai." };
    }
  }

  if (cccd.length > 12) return { tone: "error", text: `Quá dài (${cccd.length}/12 số).` };
  if (cccd.length < 12) return { tone: "info", text: `Đang nhập... (${cccd.length}/12 số).` };

  return { tone: "success", text: "CCCD hợp lệ." };
}

function validateParentCCCD(cccd: string, parentType: "father" | "mother" | "guardian"): { tone: "error" | "info" | "success", text: string } | null {
  if (!cccd) return null;
  if (/[^0-9]/.test(cccd)) return { tone: "error", text: "CCCD chỉ được chứa chữ số." };
  
  if (cccd.length > 12) return { tone: "error", text: "CCCD không được vượt quá 12 số." };
  if (cccd.length < 12) return { tone: "info", text: `Đang nhập số CCCD... (${cccd.length}/12 số).` };

  if (parentType === "father") {
    const genderDigit = parseInt(cccd[3], 10);
    if (genderDigit % 2 !== 0) return { tone: "error", text: "Mã giới tính CCCD không đúng (Cha phải là Nam)." };
  } else if (parentType === "mother") {
    const genderDigit = parseInt(cccd[3], 10);
    if (genderDigit % 2 !== 1) return { tone: "error", text: "Mã giới tính CCCD không đúng (Mẹ phải là Nữ)." };
  }

  return { tone: "success", text: "CCCD hợp lệ." };
}

function validatePhonePartial(phone: string): { tone: "error" | "info" | "success", text: string } | null {
  if (!phone) return null;
  if (/[^0-9]/.test(phone)) return { tone: "error", text: "Số điện thoại chỉ được chứa chữ số." };
  
  if (phone.length >= 3) {
    const prefix = phone.substring(0, 3);
    const validPrefixes = ['032', '033', '034', '035', '036', '037', '038', '039', '052', '055', '056', '058', '059', '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '086', '087', '088', '089', '090', '091', '092', '093', '094', '096', '097', '098', '099'];
    if (!validPrefixes.includes(prefix)) return { tone: "error", text: `Đầu số di động ${prefix} không hợp lệ.` };
  }
  
  if (phone.length > 10) return { tone: "error", text: "Số điện thoại thừa số (chỉ gồm 10 chữ số)." };
  if (phone.length < 10) return { tone: "info", text: `Đang nhập số điện thoại... (${phone.length}/10 số).` };
  
  return { tone: "success", text: "Số điện thoại hợp lệ." };
}

function validateEmailPartial(email: string, requireGmail: boolean = false): { tone: "error" | "info" | "success", text: string } | null {
  if (!email) return null;
  if (email.includes("@")) {
    if (requireGmail && !email.endsWith("@gmail.com")) return { tone: "error", text: "Hệ thống chỉ chấp nhận email có đuôi @gmail.com." };
    if (email.split("@")[0].length < 2) return { tone: "error", text: "Tên email quá ngắn." };
    return { tone: "success", text: "Email hợp lệ." };
  } else {
    if (requireGmail) return { tone: "info", text: "Vui lòng dùng tài khoản @gmail.com" };
    return null;
  }
}

function validateYearPartial(year: string): { tone: "error" | "info" | "success", text: string } | null {
  if (!year) return null;
  if (!/^\d*$/.test(year)) return { tone: "error", text: "Năm sinh chỉ được nhập số." };
  if (year.length > 4) return { tone: "error", text: "Năm sinh không được vượt quá 4 số." };
  if (year.length === 4) {
    const y = parseInt(year, 10);
    if (y < 1900 || y > new Date().getFullYear()) return { tone: "error", text: "Năm sinh không hợp lệ." };
    return { tone: "success", text: "Năm sinh hợp lệ." };
  }
  return { tone: "info", text: `Đang nhập năm sinh... (${year.length}/4)` };
}

function FieldInput({ definition, value, fields, disabled, onChange, addressData }: { definition: InputDefinition; value: FieldValue | undefined; fields: Record<string, FieldValue>; disabled: boolean; onChange: (code: string, value: FieldValue) => void; addressData: any }) {
  const isDisabled = disabled || definition.disabled;
  const className = `field ${definition.wide ? "field--wide" : ""}`;

  if (definition.type === "checkbox") {
    return <label className={`field field--check ${definition.wide ? "field--wide" : ""}`}><input type="checkbox" checked={Boolean(value)} disabled={isDisabled} onChange={(event) => onChange(definition.code, event.target.checked)} /> <strong>{definition.label}</strong> {definition.help && <small>{definition.help}</small>}</label>;
  }  
  
  if (definition.type === "province") {
    return (
      <label className={className}><span>{definition.label}{definition.required ? " *" : ""}</span>
        <select value={String(value ?? "")} disabled={isDisabled} onChange={(event) => {
          onChange(definition.code, event.target.value);
          if (definition.code === "CG") onChange("CH", "");
          if (definition.code === "L") onChange("N", "");
        }}>
          <option value="">-- Chọn --</option>
          {addressData?.provinces?.map((p: string, idx: number) => <option key={`${p}-${idx}`} value={p}>{p}</option>)}
        </select>
        {definition.help && <small>{definition.help}</small>}
      </label>
    );
  }

  if (definition.type === "commune") {
    const provinceValue = String(fields[definition.provinceCode!] ?? "");
    const districtMap = addressData?.communes?.[provinceValue] ?? {};
    return (
      <label className={className}><span>{definition.label}{definition.required ? " *" : ""}</span>
        <select value={String(value ?? "")} disabled={isDisabled} onChange={(event) => onChange(definition.code, event.target.value)}>
          <option value="">-- Chọn --</option>
          {Object.entries(districtMap).map(([district, communes]) => (
            <optgroup key={district} label={district}>
              {(communes as string[]).map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
        {definition.help && <small>{definition.help}</small>}
      </label>
    );
  }

  const options = definition.refKey && addressData ? addressData.ref[definition.refKey] : definition.options;
  return <label className={className}><span>{definition.label}{definition.required ? " *" : ""}</span>
    {options ? <select value={String(value ?? "")} disabled={isDisabled} onChange={(event) => onChange(definition.code, event.target.value)}><option value="">--- Chọn ---</option>{options.map((option: string, index: number) => <option key={`${option}-${index}`} value={option}>{option}</option>)}</select>
      : <input type={definition.type ?? "text"} value={String(value ?? "")} disabled={isDisabled} placeholder={definition.placeholder} onChange={(event) => onChange(definition.code, event.target.value)} />}
    {definition.help && <small>{definition.help}</small>}
  </label>;
}

const FILE_TYPES = [
  { category: "CCCD_FRONT", label: "Ảnh CCCD mặt trước", sample: "/mat-truoc-cccd-mau.jpg" },
  { category: "CCCD_BACK", label: "Ảnh CCCD mặt sau", sample: "/mat-sau-cccd-mau.jpg" },
  { category: "PHOTO_4X6", label: "Ảnh thẻ 4x6", sample: "/anh-4x6-mau.jpg" }
];

export default function StudentProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [fields, setFields] = useState<Record<string, FieldValue>>({});
  const [admission, setAdmission] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [addressData, setAddressData] = useState<any>(null);

  useEffect(() => {
    setHighestStep(h => Math.max(h, step));
  }, [step]);

  useEffect(() => {
    fetch("/smas-data.json").then((r) => r.json()).then(setAddressData).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/student/profile", { cache: "no-store" });
    if (response.status === 401) { router.replace("/student/login"); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Không thể tải hồ sơ.");
    setData(result); setFields(result.fields ?? {}); setAdmission(result.admission ?? {});
  }, [router]);

  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((error) => setMessage({ tone: "error", text: error.message })); }, 0); return () => window.clearTimeout(timer); }, [load]);
  
  // Auto-save effect
  useEffect(() => {
    if (!data?.student.editable) return;
    const timer = setTimeout(() => {
      save();
    }, 2000);
    return () => clearTimeout(timer);
  }, [fields, admission, data?.student.editable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time validation toast
  useEffect(() => {
    if (fields.BF) {
      const err = validateCCCDPartial(String(fields.BF), String(fields.F || ""), String(fields.G || ""));
      if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
    }
    for (const code of ["AF", "AN", "AT", "AZ"]) {
      if (fields[code]) {
        const err = validatePhonePartial(String(fields[code]));
        if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
      }
    }
    for (const code of ["BI", "AO", "AU", "BA"]) {
      if (fields[code]) {
        const err = validateEmailPartial(String(fields[code]), code === "BI");
        if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
      }
    }
    for (const code of ["AL", "AR", "AX"]) {
      if (fields[code]) {
        const err = validateYearPartial(String(fields[code]));
        if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
      }
    }
    if (fields.AP) {
      const err = validateParentCCCD(String(fields.AP), "father");
      if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
    }
    if (fields.AV) {
      const err = validateParentCCCD(String(fields.AV), "mother");
      if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
    }
    if (fields.BB) {
      const err = validateParentCCCD(String(fields.BB), "guardian");
      if (err && err.tone === "error") { setMessage({ tone: "error", text: err.text }); return; }
    }
  }, [fields.BF, fields.F, fields.G, fields.AF, fields.AN, fields.AT, fields.AZ, fields.BI, fields.AO, fields.AU, fields.BA, fields.AL, fields.AR, fields.AX, fields.AP, fields.AV, fields.BB]);

  const activeSteps = useMemo(() => {
    let steps = STEPS.map(step => ({ ...step }));
    
    const chaDaMat = Boolean(fields.father_status);
    const meDaMat = Boolean(fields.mother_status);
    if (!(chaDaMat && meDaMat)) {
      steps = steps.filter(s => s.title !== "Người bảo hộ");
    }

    return steps.map(step => {
      let stepFields = step.fields;
      if (stepFields) {
        if (step.title === "Thông tin gia đình") {
          stepFields = stepFields.filter(f => {
            if (chaDaMat && ["AK", "AL", "AM", "AN", "AO", "AP"].includes(f.code)) return false;
            if (meDaMat && ["AQ", "AR", "AS", "AT", "AU", "AV"].includes(f.code)) return false;
            return true;
          });
        }
        if (step.title === "Đội, Đoàn và chính sách") {
          stepFields = stepFields.filter(f => {
            if (f.code === "V") return Boolean(fields.is_doi_vien);
            if (f.code === "BL") return Boolean(fields.is_doan_vien);
            if (f.code === "Y" || f.code === "Z" || f.code === "BJ") return Boolean(fields.has_policy);
            return true;
          });
        }
        if (step.title === "Sức khỏe và học tập") {
          stepFields = stepFields.filter(f => {
            if (f.code === "AE") return Boolean(fields.has_disability);
            return true;
          });
        }
        stepFields = stepFields.map(f => {
          let err: { tone: string, text: string } | null = null;
          if (f.code === "BF" && fields.BF) {
            err = validateCCCDPartial(String(fields.BF), String(fields.F || ""), String(fields.G || ""));
          } else if (["AF", "AN", "AT", "AZ"].includes(f.code) && fields[f.code]) {
            err = validatePhonePartial(String(fields[f.code]));
          } else if (["BI", "AO", "AU", "BA"].includes(f.code) && fields[f.code]) {
            err = validateEmailPartial(String(fields[f.code]), f.code === "BI");
          } else if (["AL", "AR", "AX"].includes(f.code) && fields[f.code]) {
            err = validateYearPartial(String(fields[f.code]));
          } else if (f.code === "AP" && fields.AP) {
            err = validateParentCCCD(String(fields.AP), "father");
          } else if (f.code === "AV" && fields.AV) {
            err = validateParentCCCD(String(fields.AV), "mother");
          } else if (f.code === "BB" && fields.BB) {
            err = validateParentCCCD(String(fields.BB), "guardian");
          }

          if (err) {
            return {
              ...f,
              help: <span style={{ color: err.tone === "error" ? "red" : err.tone === "success" ? "green" : "inherit" }}>{err.text}</span>
            };
          }
          return f;
        });
      }
      return { ...step, fields: stepFields };
    });
  }, [fields]);

  const current = activeSteps[step];
  const completion = Math.round(((step + 1) / activeSteps.length) * 100);
  const fileMap = useMemo(() => new Map((data?.files ?? []).map((file) => [file.category, file])), [data?.files]);

  function isStepValid(stepIndex: number) {
    const s = activeSteps[stepIndex];
    if (s.fields) {
      for (const def of s.fields) {
        if (def.required && !fields[def.code]) return false;
        if (def.code === "BF" && fields.BF) {
          const cccdError = validateCCCDPartial(String(fields.BF), String(fields.F || ""), String(fields.G || ""));
          if (cccdError && cccdError.tone === "error") return false;
          if (String(fields.BF).length < 12) return false;
        }
        if (["AF", "AN", "AT", "AZ"].includes(def.code) && fields[def.code]) {
          const err = validatePhonePartial(String(fields[def.code]));
          if (err && err.tone === "error") return false;
          if (String(fields[def.code]).length < 10) return false;
        }
        if (["BI", "AO", "AU", "BA"].includes(def.code) && fields[def.code]) {
          const err = validateEmailPartial(String(fields[def.code]), def.code === "BI");
          if (err && err.tone === "error") return false;
          if (def.code === "BI" && !String(fields[def.code]).endsWith("@gmail.com")) return false;
        }
        if (["AL", "AR", "AX"].includes(def.code) && fields[def.code]) {
          const err = validateYearPartial(String(fields[def.code]));
          if (err && err.tone === "error") return false;
          if (String(fields[def.code]).length < 4) return false;
        }
        if (def.code === "AP" && fields.AP) {
          const err = validateParentCCCD(String(fields.AP), "father");
          if (err && err.tone === "error") return false;
          if (String(fields.AP).length < 12) return false;
        }
        if (def.code === "AV" && fields.AV) {
          const err = validateParentCCCD(String(fields.AV), "mother");
          if (err && err.tone === "error") return false;
          if (String(fields.AV).length < 12) return false;
        }
        if (def.code === "BB" && fields.BB) {
          const err = validateParentCCCD(String(fields.BB), "guardian");
          if (err && err.tone === "error") return false;
          if (String(fields.BB).length < 12) return false;
        }
      }
    }
    return true;
  }
  function canGoToStep(targetStep: number) {
    if (targetStep <= step) return true;
    if (targetStep > highestStep) return false;
    for (let i = 0; i < targetStep; i++) {
      if (!isStepValid(i)) return false;
    }
    return true;
  }

  function updateField(code: string, value: FieldValue) {
    setFields((old) => {
      let val = value;
      if (typeof val === "string") {
        val = val.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
        if (["C", "O", "AK", "AQ", "AW"].includes(code)) {
          val = val.toUpperCase();
        }
        if (["AL", "AR", "AX"].includes(code)) {
          val = val.replace(/[^\d]/g, "");
        }
        if (["BF", "AP", "AV", "BB"].includes(code)) {
          val = val.replace(/[^0-9]/g, '');
        }
        if (["BI", "AO", "AU", "BA", "AF", "AN", "AT", "AZ"].includes(code)) {
          val = val.replace(/\s/g, "");
        }
      }
      const updated = { ...old, [code]: val };
      if (code === "L" || code === "N" || code === "O") {
         const o = code === "O" ? val : (old.O || "");
         const n = code === "N" ? val : (old.N || "");
         const l = code === "L" ? val : (old.L || "");
         updated.U = [o, n, l].filter(Boolean).join(", ");
      }
      if (code === "BG" && typeof val === "string") {
        const noiCap = calculateNoiCap(val);
        if (noiCap) updated["BH"] = noiCap;
      }
      if (code === "BF" && typeof val === "string" && /^\d{12}$/.test(val)) {
        const provCode = val.substring(0, 3);
        const mappedProv = CCCD_PROVINCE_MAP[provCode];
        if (mappedProv && old.CG !== mappedProv) {
          updated.CG = mappedProv;
          updated.CH = ""; // Reset commune
        }
      }
      if (code === "is_doi_vien" && !val) {
        updated.V = "";
      }
      if (code === "is_doan_vien" && !val) {
        updated.BL = "";
      }
      if (code === "has_policy" && !val) {
        updated.Y = "";
        updated.Z = "";
        updated.BJ = "";
      }
      if (code === "has_disability" && !val) {
        updated.AE = "";
      }
      return updated;
    }); 
  }
  async function save() {
    if (!data?.student.editable) return true;
    setBusy(true); setMessage(null);
    try {
      const editableAdmission = { middleSchool: admission.middleSchool, middleSchoolCommune: admission.middleSchoolCommune, fourYearAverage: admission.fourYearAverage, fourYearConduct: admission.fourYearConduct, priorityScore: admission.priorityScore, encouragementScore: admission.encouragementScore, note: admission.note };
      const response = await fetch("/api/student/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields, admission: editableAdmission }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể lưu hồ sơ.");
      // Silent auto-save, no success message or reload
      return true;
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Không thể lưu hồ sơ." }); return false; }
    finally { setBusy(false); }
  }
  async function next() { 
    if (!isStepValid(step)) {
      if (step === 0 && fields.BF) {
        const cccdError = validateCCCDPartial(String(fields.BF), String(fields.F || ""), String(fields.G || ""));
        if (cccdError && cccdError.tone === "error") {
          setMessage({ tone: "error", text: cccdError.text });
          return;
        }
        if (String(fields.BF).length < 12) {
          setMessage({ tone: "error", text: "Vui lòng nhập đủ 12 chữ số CCCD." });
          return;
        }
      }
      setMessage({ tone: "error", text: "Vui lòng điền đầy đủ và chính xác các trường bắt buộc (*) trước khi tiếp tục." });
      return;
    }
    if (await save()) { setStep((value) => Math.min(value + 1, activeSteps.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); } 
  }
  async function upload(category: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage(null);
    try { const form = new FormData(); form.set("category", category); form.set("file", file);
      const response = await fetch("/api/student/files/upload", { method: "POST", body: form }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tải ảnh thất bại.");
      setMessage({ tone: result.fileRecord.status === "AUTO_VALID" ? "success" : "info", text: result.fileRecord.status === "AUTO_VALID" ? "Ảnh đã được tải và kiểm tra hợp lệ." : "Ảnh đã tải lên nhưng cần nhà trường kiểm tra thêm." }); await load();
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Tải ảnh thất bại." }); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function submit(event: FormEvent) { event.preventDefault(); if (!confirm("Bạn xác nhận thông tin đã chính xác và gửi hồ sơ cho nhà trường?")) return; if (!(await save())) return; setBusy(true); setMessage(null); try { const response = await fetch("/api/student/profile/submit", { method: "POST" }); const result = await response.json(); if (!response.ok) { const details = Array.isArray(result.details) ? result.details.map((item: { message: string }) => item.message).join("; ") : ""; throw new Error([result.error, details].filter(Boolean).join(" ")); } router.replace("/student/success"); } catch (caught) { setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "Không thể gửi hồ sơ." }); } finally { setBusy(false); } }

  if (!data) return <><AppHeader mode="student"/><main className="loading-page"><div className="spinner"/><p>Đang tải hồ sơ…</p></main></>;
  return <><AppHeader mode="student"/><main className="workspace"><div className="workspace__layout">
    <aside className="stepper-card"><div className="stepper-card__head"><span>Tiến độ hồ sơ</span><strong>{completion}%</strong></div><div className="progress"><span style={{ width: `${completion}%` }} /></div>
      <ol className="stepper">{activeSteps.map((item, index) => <li key={item.title} className={index === step ? "active" : index < step ? "done" : ""}><button type="button" onClick={() => canGoToStep(index) && setStep(index)} style={{ opacity: canGoToStep(index) ? 1 : 0.5, cursor: canGoToStep(index) ? "pointer" : "not-allowed" }}><b>{index < step ? "✓" : index + 1}</b><span>{item.title}</span></button></li>)}</ol>
      <div className="stepper-card__status"><small>Trạng thái hiện tại</small><StatusBadge status={data.student.status}/></div>
    </aside>
    <section className="form-shell"><div className="form-shell__head"><div><span className="eyebrow">BƯỚC {step + 1}/{activeSteps.length}</span><h1>{current.title}</h1><p>{current.subtitle}</p></div></div>
      {!data.student.editable && <div className="notice notice--info"><strong>Hồ sơ hiện không thể chỉnh sửa.</strong><p>Hồ sơ đã được gửi hoặc khóa. Khi nhà trường yêu cầu bổ sung, hệ thống sẽ mở lại quyền chỉnh sửa.</p></div>}
      {message && <div className={`notice notice--${message.tone}`}>{message.text}</div>}
      {step === 0 && <div className="admission-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}><div><small>Trường THCS</small><input value={admission.middleSchool ?? ""} disabled={true} onChange={(e) => setAdmission((old) => ({ ...old, middleSchool: e.target.value }))}/></div><div><small>Địa bàn trường THCS</small><input value={admission.middleSchoolCommune ?? ""} disabled={true} onChange={(e) => setAdmission((old) => ({ ...old, middleSchoolCommune: e.target.value }))}/></div><div><small>Tổng ĐTB 4 năm</small><input value={admission.fourYearAverage || "0"} disabled={true} /></div><div><small>Tổng điểm quy đổi</small><input value={admission.fourYearConduct || "0"} disabled={true} /></div><div><small>Điểm ưu tiên</small><input value={admission.priorityScore || "0"} disabled={true} /></div><div><small>Điểm khuyến khích</small><input value={admission.encouragementScore || "0"} disabled={true} /></div><div><small>Điểm xét tuyển</small><strong>{admission.admissionScore || "Chưa có"}</strong></div></div>}
      {current.fields && <div className="form-grid">{current.fields.map((definition) => <FieldInput key={definition.code} definition={definition} value={fields[definition.code]} fields={fields} disabled={!data.student.editable || busy} onChange={updateField} addressData={addressData}/>)}</div>}
      {current.kind === "files" && <form onSubmit={submit}>
        <div className="upload-grid">
          {FILE_TYPES.map((type) => { 
            const file = fileMap.get(type.category); 
            return (
              <article key={type.category} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1e293b" }}>{type.label}</h3>
                  {file && <StatusBadge status={file.status}/>}
                </div>
                
                <div className="upload-split">
                  <div className="upload-split-item">
                    <span className="upload-split-label">Ảnh mẫu</span>
                    <div style={{ position: "relative", width: "100%", aspectRatio: type.category === "PHOTO_4X6" ? "3/4" : "1.6/1", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                      <Image src={type.sample} alt={`Mẫu ${type.label}`} fill unoptimized sizes="300px" style={{ objectFit: "cover", opacity: 0.9 }} />
                    </div>
                  </div>
                  
                  <div className="upload-split-item">
                    <span className="upload-split-label">Ảnh tải lên</span>
                    <label style={{ position: "relative", display: "block", width: "100%", aspectRatio: type.category === "PHOTO_4X6" ? "3/4" : "1.6/1", borderRadius: "12px", overflow: "hidden", cursor: (data.student.editable && !busy) ? "pointer" : "default", border: file ? "none" : "2px dashed #cbd9e1", backgroundColor: "#f8fafc" }}>
                      {file ? (
                        <Image src={file.url} alt={type.label} fill unoptimized sizes="300px" style={{ objectFit: "cover" }} />
                      ) : (
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#64748b" }}>
                          <span style={{ fontSize: "24px" }}>+</span>
                          <span style={{ fontSize: "14px", fontWeight: 500 }}>Nhấn để chọn ảnh</span>
                        </div>
                      )}
                      {data.student.editable && (
                        <div className="upload-overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", opacity: 0, transition: "opacity 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                          <span style={{ color: "white", fontWeight: "bold", background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: "20px" }}>{file ? "Thay đổi" : "Tải lên"}</span>
                        </div>
                      )}
                      <input type="file" accept="image/jpeg,.jpg,.jpeg" style={{ display: "none" }} disabled={!data.student.editable || busy} onChange={(event) => upload(type.category, event)}/>
                    </label>
                  </div>
                </div>


              </article>
            ); 
          })}
        </div>
        <div className="review-box" style={{ background: "#f8fafc", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px" }}>Xác nhận trước khi gửi</h2>
          <label className="confirm" style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", marginBottom: "24px" }}>
            <input type="checkbox" required style={{ width: "20px", height: "20px", marginTop: "2px" }}/>
            <span style={{ fontSize: "15px", lineHeight: "1.5", color: "#334155" }}>Tôi cam kết thông tin và hình ảnh đã cung cấp là chính xác, đồng ý để nhà trường sử dụng cho công tác nhập học và quản lý học sinh.</span>
          </label>
          <button className="button button--primary button--large" style={{ width: "100%", padding: "16px", fontSize: "16px", borderRadius: "12px" }} disabled={busy || !data.student.canSubmit}>
            {busy ? "Đang xử lý…" : data.student.canSubmit ? "Gửi hồ sơ cho nhà trường" : "Hồ sơ đã được gửi"}
          </button>
        </div>
      </form>}
      <div className="form-actions"><button type="button" className="button button--ghost" disabled={step === 0 || busy} onClick={() => setStep((value) => value - 1)}>← Quay lại</button>{step < activeSteps.length - 1 && <button type="button" className="button button--primary" disabled={busy || !isStepValid(step)} onClick={next}>Lưu và tiếp tục →</button>}</div>
    </section>
  </div></main></>;
}
