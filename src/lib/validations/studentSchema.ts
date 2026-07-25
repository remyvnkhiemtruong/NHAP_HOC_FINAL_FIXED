import { z } from "zod";
import { validateCCCD } from "./cccdValidator";
import { normalizePhone, isValidPhone } from "./phoneValidator";
import { normalizeName } from "../utils/stringUtils";
import { ETHNICITIES } from "../catalogs/ethnicities";
import { RELIGIONS } from "../catalogs/religions";
import { parseVietnameseDate } from "../student/profileRules";

const validEthnicityNames = ETHNICITIES.map((e) => e.name);
const validReligionNames = RELIGIONS.map((r) => r.name);
const ADMISSION_YEAR = Number.parseInt(process.env.ADMISSION_YEAR ?? "2026", 10);

// We'll define a flexible schema that allows all 95 fields (A-CQ) as strings
// We can add strict refinements step by step

export const studentSchema = z
  .object({
    C: z
      .string()
      .min(1, "Họ và tên không được để trống")
      .transform((val) => normalizeName(val)),
    F: z.string().min(1, "Ngày sinh không được để trống"),
    G: z.string().min(1, "Giới tính không được để trống"),
    W: z
      .string()
      .min(1, "Dân tộc không được để trống")
      .refine(
        (val) => validEthnicityNames.includes(val),
        "Dân tộc không hợp lệ",
      ),
    L: z.string().min(1, "Tỉnh/thành thường trú không được để trống"),

    // CCCD Info
    BF: z.string().min(1, "CCCD không được để trống"),
    BG: z.string().optional(), // Ngày cấp
    BH: z.string().optional(), // Nơi cấp

    // Nơi sinh, quê quán, thường trú
    CG: z.string().optional(), // Tỉnh/TP nơi sinh
    CH: z.string().optional(), // Xã phường nơi sinh
    CI: z.string().optional(), // Tỉnh thành quê quán
    CJ: z.string().optional(), // Mã xã phường quê quán
    CK: z.string().optional(), // Tên xã phường quê quán
    L_PROVINCE: z.string().optional(), // Mapping cho Tỉnh thường trú
    M: z.string().optional(), // Mã xã phường thường trú
    N: z.string().optional(), // Tên xã phường thường trú
    O: z.string().optional(), // Thôn xóm thường trú
    U: z.string().optional(), // Chỗ ở hiện nay

    // Dân tộc, tôn giáo, Đội/Đoàn
    BY: z
      .string()
      .optional()
      .refine(
        (val) => !val || validEthnicityNames.includes(val),
        "Dân tộc trên giấy khai sinh không hợp lệ",
      ),
    X: z
      .string()
      .optional()
      .refine(
        (val) => !val || validReligionNames.includes(val),
        "Tôn giáo không hợp lệ",
      ),
    V: z.string().optional(), // Ngày vào đội
    BL: z.string().optional(), // Ngày vào đoàn

    // Chính sách, sức khỏe
    has_policy: z.boolean().optional(),
    Y: z.string().optional(), // Đối tượng chính sách
    Z: z.string().optional(), // Chế độ chính sách
    AE: z
      .string()
      .optional()
      .refine(
        (val) =>
          !val ||
          [
            "Khuyết tật nhìn",
            "Khuyết tật nghe nói",
            "Khuyết tật vận động",
            "Khuyết tật trí tuệ",
            "Khuyết tật thần kinh tâm thần",
            "Khuyết tật khác",
          ].includes(val),
        "Khuyết tật không hợp lệ",
      ),
    BM: z
      .string()
      .optional()
      .refine(
        (val) => !val || ["Có", "Không"].includes(val),
        "Giá trị không hợp lệ",
      ), // Khuyết tật không ĐG
    AG: z.string().optional(), // Số thẻ BHYT
    AH: z
      .string()
      .optional()
      .refine(
        (val) => !val || ["A", "B", "AB", "O", "Không biết"].includes(val),
        "Nhóm máu không hợp lệ",
      ),
    AJ: z
      .string()
      .min(1, "Vui lòng chọn trạng thái biết bơi")
      .refine((val) => ["Có", "Không"].includes(val), "Giá trị không hợp lệ"),

    // Liên hệ & gia đình
    AF: z
      .string()
      .refine((val) => !val || isValidPhone(val), "Số điện thoại không hợp lệ")
      .transform((val) => (val ? normalizePhone(val) : val))
      .optional(), // SDT học sinh
    BI: z
      .string()
      .refine(
        (val) => !val || z.string().email().safeParse(val.trim()).success,
        "Email không hợp lệ",
      )
      .transform((val) => (val ? val.trim().toLowerCase() : val))
      .optional(), // Email học sinh
    AK: z
      .string()
      .transform((val) => normalizeName(val))
      .optional(), // Tên cha
    AL: z.string().optional(), // Năm sinh cha
    AM: z.string().optional(), // Nghề nghiệp cha
    AN: z
      .string()
      .refine((val) => !val || isValidPhone(val), "Số điện thoại không hợp lệ")
      .transform((val) => (val ? normalizePhone(val) : val))
      .optional(), // SDT cha
    AO: z
      .string()
      .refine(
        (val) => !val || z.string().email().safeParse(val.trim()).success,
        "Email không hợp lệ",
      )
      .transform((val) => (val ? val.trim().toLowerCase() : val))
      .optional(),
    AP: z
      .string()
      .refine((value) => !value || /^\d{12}$/.test(value), "CCCD phải đủ 12 chữ số")
      .optional(), // CCCD cha
    AQ: z
      .string()
      .transform((val) => normalizeName(val))
      .optional(), // Tên mẹ
    AR: z.string().optional(), // Năm sinh mẹ
    AS: z.string().optional(), // Nghề nghiệp mẹ
    AT: z
      .string()
      .refine((val) => !val || isValidPhone(val), "Số điện thoại không hợp lệ")
      .transform((val) => (val ? normalizePhone(val) : val))
      .optional(), // SDT mẹ
    AU: z
      .string()
      .refine(
        (val) => !val || z.string().email().safeParse(val.trim()).success,
        "Email không hợp lệ",
      )
      .transform((val) => (val ? val.trim().toLowerCase() : val))
      .optional(),
    AV: z
      .string()
      .refine((value) => !value || /^\d{12}$/.test(value), "CCCD phải đủ 12 chữ số")
      .optional(), // CCCD mẹ
    AW: z
      .string()
      .transform((val) => normalizeName(val))
      .optional(), // Tên người bảo hộ
    AX: z.string().optional(), // Năm sinh NBH
    AY: z.string().optional(), // Nghề nghiệp NBH
    AZ: z
      .string()
      .refine((val) => !val || isValidPhone(val), "Số điện thoại không hợp lệ")
      .transform((val) => (val ? normalizePhone(val) : val))
      .optional(), // SDT NBH
    BA: z
      .string()
      .refine(
        (val) => !val || z.string().email().safeParse(val.trim()).success,
        "Email không hợp lệ",
      )
      .transform((val) => (val ? val.trim().toLowerCase() : val))
      .optional(),
    BB: z.string().optional(), // Cha dân tộc
    BC: z.string().optional(), // Mẹ dân tộc
    BN: z.string().optional(), // Phụ huynh có máy tính internet
    BO: z.string().optional(), // Phụ huynh có smartphone

    // Học tập bổ sung
    BD: z.string().optional(), // Loại TN cấp dưới
    BE: z.string().optional(), // Hệ học ngoại ngữ
    BS: z.string().optional(), // CC ngoại ngữ
    BT: z.string().optional(), // CC tin học
    BJ: z.string().optional(), // Diện ưu tiên
    AD: z.string().optional(), // Diện học sinh
    CE: z.string().optional(), // Số buổi học trên tuần

    // Custom states that might not directly map to DB columns initially
    // e.g. checkbox states
    is_doi_vien: z.boolean().optional(),
    is_doan_vien: z.boolean().optional(),
    cha_da_mat: z.boolean().optional(),
    me_da_mat: z.boolean().optional(),
    giong_thuong_tru: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    for (const field of ["AL", "AR", "AX"] as const) {
      const value = data[field];
      if (
        value &&
        (!/^(19\d{2}|20\d{2})$/.test(value) ||
          Number(value) > ADMISSION_YEAR)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Năm sinh phải gồm 4 chữ số từ 1900 đến năm hiện tại",
          path: [field],
        });
      }
    }
    // Cross-validation for CCCD
    if (data.BF) {
      const res = validateCCCD(
        data.BF,
        data.G as string | undefined,
        data.F as string | undefined,
      );
      if (!res.isValid) {
        for (const err of res.errors) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: err,
            path: ["BF"],
          });
        }
      }
    }

    // Cross-validation for Family & Contacts
    const hasFather = !data.cha_da_mat && !!data.AK;
    const hasMother = !data.me_da_mat && !!data.AQ;

    if (!hasFather && !hasMother && !data.AW) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Bắt buộc nhập Người bảo hộ (AW) nếu không có thông tin Cha và Mẹ",
        path: ["AW"],
      });
    }

    const hasAnyPhone = !!data.AF || !!data.AN || !!data.AT || !!data.AZ;
    if (!hasAnyPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Phải có ít nhất một số điện thoại liên lạc hợp lệ (Học sinh, Cha, Mẹ hoặc Bảo hộ)",
        path: ["AF"], // Display error at Student Phone or globally
      });
    }

    // Cross-validation for Step 5
    if (data.has_policy && !data.Y) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng nhập mô tả đối tượng chính sách",
        path: ["Y"],
      });
    }
    if (data.has_policy && !data.Z) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn chế độ chính sách",
        path: ["Z"],
      });
    }

    // Cross-validation for Đội/Đoàn
    if (data.is_doi_vien && !data.V) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng nhập ngày vào Đội",
        path: ["V"],
      });
    }
    if (data.V && data.F) {
      const doiDate = parseVietnameseDate(data.V);
      const sinhDate = parseVietnameseDate(data.F);
      if (!doiDate || !sinhDate || doiDate <= sinhDate || doiDate > new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ngày vào Đội phải hợp lệ, sau ngày sinh và không ở tương lai",
          path: ["V"],
        });
      }
    }

    if (data.is_doan_vien && !data.BL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng nhập ngày vào Đoàn",
        path: ["BL"],
      });
    }
    if (data.BL && data.F) {
      const doanDate = parseVietnameseDate(data.BL);
      const sinhDate = parseVietnameseDate(data.F);
      if (!doanDate || !sinhDate || doanDate <= sinhDate || doanDate > new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ngày vào Đoàn phải hợp lệ, sau ngày sinh và không ở tương lai",
          path: ["BL"],
        });
      }
    }
  });

export type StudentFormData = z.infer<typeof studentSchema>;
