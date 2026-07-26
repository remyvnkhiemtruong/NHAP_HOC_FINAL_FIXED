import PDFDocument from "pdfkit";
import path from "node:path";
import { readPrivateFile } from "./fileStorage";
import { effectiveProfileValue } from "@/lib/student/effectiveProfileValue";

const PDF_FONT = {
  regular: path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-sans/files/noto-sans-vietnamese-400-normal.woff",
  ),
  bold: path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-sans/files/noto-sans-vietnamese-700-normal.woff",
  ),
} as const;

export interface PdfStudentData {
  student: {
    id: string;
    current_cccd: string;
    current_dob: string;
    status: string;
  };
  admission_record: {
    full_name_source: string;
    cccd_source: string;
    dob_source: string;
    ethnicity_source?: string | null;
    residence_source?: string | null;
    middle_school_source?: string | null;
    middle_school_commune_source?: string | null;
    score_fields?: Record<string, unknown> | null;
    note_source?: string | null;
    data_quality_flags?: string[] | null;
    source_tt?: string | null;
    female_mark_source?: string | null;
  };
  profile_values: Array<{
    field_code: string;
    source_value?: string | null;
    proposed_value?: string | null;
    approved_value?: string | null;
    change_status: string;
  }>;
  files: Array<{
    category: string;
    storage_key: string;
    original_name: string;
    mime: string;
    status: string;
    qr_scan_results?: Array<{ success: boolean; card_side: string }>;
  }>;
  family_members: Array<{
    type: string;
    absent_or_deceased: boolean;
    full_name?: string | null;
    birth_year?: string | null;
    occupation?: string | null;
    phone?: string | null;
  }>;
  policy_records: Array<{
    has_policy: boolean;
    description?: string | null;
    policy_regime?: string | null;
  }>;
  disabilities: Array<{
    has_disability: boolean;
    disability_type?: string | null;
    not_assessed: boolean;
  }>;
}

export type PdfCampaignConfig = {
  schoolName: string;
  schoolYearStart: number;
  schoolYearEnd: number;
};

/**
 * Get effective display value for a field: approved_value > proposed_value > source_value
 */
function getEffectiveValue(
  profileValues: PdfStudentData["profile_values"],
  fieldCode: string,
): string {
  const pv = profileValues.find((v) => v.field_code === fieldCode);
  return effectiveProfileValue(pv);
}

/**
 * Get changed fields (ACCEPTED or ADMIN_EDITED)
 */
function getAcceptedChanges(profileValues: PdfStudentData["profile_values"]) {
  return profileValues.filter(
    (v) => v.change_status === "ACCEPTED" || v.change_status === "ADMIN_EDITED",
  );
}

async function renderDocumentThumbnail(
  doc: InstanceType<typeof PDFDocument>,
  file: PdfStudentData["files"][number] | undefined,
  label: string,
): Promise<void> {
  if (!file) {
    doc.fontSize(10).font("NotoSans").text(`${label}: Chưa tải lên`);
    return;
  }

  try {
    doc
      .fontSize(10)
      .font("NotoSans")
      .text(`${label} - Trạng thái: ${file.status}`);
    doc.image(await readPrivateFile(file.storage_key), { fit: [250, 158] });
  } catch {
    doc
      .fontSize(10)
      .font("NotoSans")
      .text(
        `${label}: ${file.original_name} (Trạng thái: ${file.status}) - Không thể nhúng ảnh`,
      );
  }
  doc.moveDown(0.4);
}

export async function generateStudentPdf(
  data: PdfStudentData,
  campaign?: PdfCampaignConfig,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.registerFont("NotoSans", PDF_FONT.regular);
      doc.registerFont("NotoSans-Bold", PDF_FONT.bold);
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageW = doc.page.width - 80; // usable width

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc
        .fontSize(13)
        .font("NotoSans-Bold")
        .text((campaign?.schoolName ?? "HỒ SƠ NHẬP HỌC").toLocaleUpperCase("vi-VN"), { align: "center" });
      doc
        .fontSize(11)
        .font("NotoSans")
        .text(
          campaign
            ? `Hệ thống hồ sơ học sinh trúng tuyển lớp 10 – Năm học ${campaign.schoolYearStart}–${campaign.schoolYearEnd}`
            : "Hệ thống hồ sơ học sinh trúng tuyển lớp 10",
          { align: "center" },
        );
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Title
      const studentName = data.admission_record.full_name_source;
      const cccd = data.student.current_cccd;
      doc
        .fontSize(14)
        .font("NotoSans-Bold")
        .text(`THÔNG TIN HỌC SINH: ${studentName}`, { align: "center" });
      doc.moveDown(0.5);

      // ── 1. THÔNG TIN TRÚNG TUYỂN ────────────────────────────────────────────
      doc.fontSize(11).font("NotoSans-Bold").text("1. Thông tin trúng tuyển");
      doc.moveDown(0.3);

      const admissionRows: [string, string][] = [
        ["Số thứ tự (TT)", data.admission_record.source_tt ?? ""],
        ["Họ và tên (nguồn)", data.admission_record.full_name_source],
        ["CCCD (nguồn)", data.admission_record.cccd_source],
        ["Ngày sinh (nguồn)", data.admission_record.dob_source],
        ["Giới tính nữ (cờ)", data.admission_record.female_mark_source ?? ""],
        ["Dân tộc", data.admission_record.ethnicity_source ?? ""],
        ["Trường THCS", data.admission_record.middle_school_source ?? ""],
        [
          "Xã/Phường THCS",
          data.admission_record.middle_school_commune_source ?? "",
        ],
        ["Nơi thường trú", data.admission_record.residence_source ?? ""],
        ["Ghi chú", data.admission_record.note_source ?? ""],
      ];

      // Add scores if present
      if (data.admission_record.score_fields) {
        const scores = data.admission_record.score_fields as Record<
          string,
          string
        >;
        for (const [key, val] of Object.entries(scores)) {
          admissionRows.push([`Điểm ${key}`, String(val ?? "")]);
        }
      }

      renderTable(doc, admissionRows, pageW);
      doc.moveDown(0.7);

      // ── 2. HỒ SƠ ĐÃ DUYỆT ──────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font("NotoSans-Bold")
        .text("2. Hồ sơ đã duyệt (giá trị hiệu lực)");
      doc.moveDown(0.3);

      // Key fields to show
      const profileRows: [string, string][] = [
        ["CCCD (hiệu lực)", data.student.current_cccd],
        ["Ngày sinh (hiệu lực)", data.student.current_dob],
        ["Dân tộc", getEffectiveValue(data.profile_values, "BY")],
        ["Tôn giáo", getEffectiveValue(data.profile_values, "X")],
        ["Ngày vào Đội", getEffectiveValue(data.profile_values, "V")],
        ["Ngày vào Đoàn", getEffectiveValue(data.profile_values, "BL")],
        ["SDT học sinh", getEffectiveValue(data.profile_values, "AF")],
        ["BHYT", getEffectiveValue(data.profile_values, "AG")],
        ["Nhóm máu", getEffectiveValue(data.profile_values, "AH")],
        ["Biết bơi", getEffectiveValue(data.profile_values, "AJ")],
        ["Trạng thái hồ sơ", data.student.status],
      ];

      renderTable(doc, profileRows, pageW);
      doc.moveDown(0.7);

      // ── 3. GIA ĐÌNH ─────────────────────────────────────────────────────────
      if (data.family_members.length > 0) {
        doc.fontSize(11).font("NotoSans-Bold").text("3. Cha mẹ / Người bảo hộ");
        doc.moveDown(0.3);

        for (const fm of data.family_members) {
          const label =
            fm.type === "FATHER"
              ? "Cha"
              : fm.type === "MOTHER"
                ? "Mẹ"
                : "Người bảo hộ";
          if (fm.absent_or_deceased) {
            doc
              .fontSize(10)
              .font("NotoSans")
              .text(`${label}: (đã mất / không có)`);
          } else {
            const rows: [string, string][] = [
              [`${label} – Họ tên`, fm.full_name ?? ""],
              [`${label} – Năm sinh`, fm.birth_year ?? ""],
              [`${label} – Nghề nghiệp`, fm.occupation ?? ""],
              [`${label} – Điện thoại`, fm.phone ?? ""],
            ];
            renderTable(doc, rows, pageW);
          }
          doc.moveDown(0.3);
        }
        doc.moveDown(0.4);
      }

      // ── 4. CHÍNH SÁCH ───────────────────────────────────────────────────────
      if (data.policy_records.length > 0 && data.policy_records[0].has_policy) {
        const pol = data.policy_records[0];
        doc.fontSize(11).font("NotoSans-Bold").text("4. Đối tượng chính sách");
        doc.moveDown(0.3);
        renderTable(
          doc,
          [
            ["Mô tả đối tượng", pol.description ?? ""],
            ["Chế độ", pol.policy_regime ?? ""],
          ],
          pageW,
        );
        doc.moveDown(0.7);
      }

      // ── 5. KHUYẾT TẬT ───────────────────────────────────────────────────────
      if (data.disabilities.length > 0 && data.disabilities[0].has_disability) {
        const dis = data.disabilities[0];
        doc.fontSize(11).font("NotoSans-Bold").text("5. Thông tin khuyết tật");
        doc.moveDown(0.3);
        renderTable(
          doc,
          [
            ["Loại khuyết tật", dis.disability_type ?? ""],
            ["Không đánh giá", dis.not_assessed ? "Có" : "Không"],
          ],
          pageW,
        );
        doc.moveDown(0.7);
      }

      // ── 6. ẢNH / CCCD ───────────────────────────────────────────────────────
      doc.fontSize(11).font("NotoSans-Bold").text("6. Ảnh & Giấy tờ");
      doc.moveDown(0.3);

      const photo4x6 = data.files.find((f) => f.category === "PHOTO_4X6");
      const cccdFront = data.files.find((f) => f.category === "CCCD_FRONT");
      const cccdBack = data.files.find((f) => f.category === "CCCD_BACK");

      // Embed photo 4x6 if available
      if (photo4x6) {
        try {
          const imgBuf = await readPrivateFile(photo4x6.storage_key);
          doc.text(`Ảnh 4x6 – Trạng thái: ${photo4x6.status}`);
          doc.image(imgBuf, { fit: [113, 151] }); // ~3x4 cm at 96dpi (default align is left)
          doc.moveDown(0.5);
        } catch {
          doc
            .fontSize(10)
            .text(
              `Ảnh 4x6: ${photo4x6.original_name} (Trạng thái: ${photo4x6.status}) – Không thể nhúng ảnh`,
            );
        }
      } else {
        doc.fontSize(10).font("NotoSans").text("Ảnh 4x6: Chưa tải lên");
      }

      await renderDocumentThumbnail(doc, cccdFront, "CCCD mặt trước");
      await renderDocumentThumbnail(doc, cccdBack, "CCCD mặt sau");
      doc.moveDown(0.7);

      // QR/OCR summary
      const qrResults = data.files.flatMap((f) =>
        (f.qr_scan_results ?? []).map((q) => ({
          ...q,
          category: f.category,
        })),
      );
      if (qrResults.length > 0) {
        doc.fontSize(11).font("NotoSans-Bold").text("7. Kết quả quét QR / OCR");
        doc.moveDown(0.3);
        const qrRows: [string, string][] = qrResults.map((q) => [
          `${q.category} – ${q.card_side}`,
          q.success ? "Hợp lệ" : "Không đọc được QR",
        ]);
        renderTable(doc, qrRows, pageW);
        doc.moveDown(0.7);
      }

      // ── 7. LỊCH SỬ THAY ĐỔI ────────────────────────────────────────────────
      const acceptedChanges = getAcceptedChanges(data.profile_values);
      if (acceptedChanges.length > 0) {
        doc
          .fontSize(11)
          .font("NotoSans-Bold")
          .text("8. Danh sách thay đổi đã chấp nhận");
        doc.moveDown(0.3);

        const changeRows: [string, string][] = acceptedChanges.map((c) => [
          `Cột ${c.field_code}`,
          `Gốc: "${c.source_value ?? ""}" → Duyệt: "${c.approved_value ?? ""}"`,
        ]);
        renderTable(doc, changeRows, pageW);
        doc.moveDown(0.7);
      }

      // ── CỜ DỮ LIỆU ──────────────────────────────────────────────────────────
      if (data.admission_record.data_quality_flags?.length) {
        doc
          .fontSize(10)
          .font("NotoSans-Bold")
          .text(
            `Cờ dữ liệu nguồn: ${data.admission_record.data_quality_flags.join(", ")}`,
          );
        doc.moveDown(0.5);
      }

      // ── FOOTER ──────────────────────────────────────────────────────────────
      doc
        .moveTo(40, doc.y + 5)
        .lineTo(555, doc.y + 5)
        .stroke();
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .font("NotoSans")
        .text(
          `Ngày tạo PDF: ${new Date().toLocaleString("vi-VN")}   |   CCCD: ${cccd}`,
          {
            align: "right",
          },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Renders a simple 2-column table (label | value)
 */
function renderTable(
  doc: InstanceType<typeof PDFDocument>,
  rows: [string, string][],
  pageW: number,
) {
  const colLabel = pageW * 0.38;
  const colValue = pageW - colLabel;

  for (const [label, value] of rows) {
    const startY = doc.y;
    doc
      .fontSize(9)
      .font("NotoSans-Bold")
      .text(label, 40, startY, { width: colLabel, lineBreak: true });

    const afterLabel = doc.y;

    doc
      .fontSize(9)
      .font("NotoSans")
      .text(value || "—", 40 + colLabel + 4, startY, {
        width: colValue,
        lineBreak: true,
      });

    const afterValue = doc.y;
    // move to whichever column ended lower
    doc.y = Math.max(afterLabel, afterValue);
    doc.moveDown(0.15);
  }
}
