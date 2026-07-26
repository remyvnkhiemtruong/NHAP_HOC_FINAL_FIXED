import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getOfficialProfilePrefill } from "@/lib/student/officialProfilePrefill";

function normalizeDataQualityFlags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object" && "flags" in value) {
    const flags = (value as { flags?: unknown }).flags;
    return Array.isArray(flags) ? flags.map(String) : [];
  }
  return [];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestIdentifier = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        admission_record: true,
        profile_values: true,
        files: { where: { is_current: true }, include: { qr_scan_results: true, ocr_results: true, photo_scan_results: true } },
        addresses: true,
        family_members: true,
        policy_records: true,
        disabilities: true,
        revision_requests: {
          include: { items: true },
          orderBy: { created_at: "desc" },
          take: 20,
        },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const fileIds = student.files.map((file) => file.id);
    const [auditLogs, decisionHistory] = await Promise.all([
      prisma.auditLog.findMany({
        where: { OR: [{ entity_id: id }, ...(fileIds.length ? [{ entity_id: { in: fileIds } }] : [])] },
        orderBy: { created_at: "desc" },
        take: 200,
      }),
      prisma.reviewDecision.findMany({
        where: { student_id: id },
        orderBy: { created_at: "desc" },
        take: 200,
      }),
    ]);
    const diffs = student.profile_values
      .filter((value) => value.change_status === "PROPOSED")
      .map((value) => ({ id: value.id, field_code: value.field_code, source_value: value.source_value, proposed_value: value.proposed_value, updated_at: value.updated_at }));

    type ProfileValueResponse =
      | (typeof student.profile_values)[number]
      | {
          id: string;
          field_code: string;
          source_value: null;
          proposed_value: string;
          change_status: "PREVIEW";
          updated_at: Date;
          student_id: string;
        };
    let profile_values: ProfileValueResponse[] = student.profile_values;
    if (profile_values.length === 0) {
      const prefill = getOfficialProfilePrefill({
        cccd: student.admission_record.cccd_source,
        fullName: student.admission_record.full_name_source,
        dateOfBirth: student.admission_record.dob_source,
        femaleMark: student.admission_record.female_mark_source,
        ethnicity: student.admission_record.ethnicity_source,
        residenceCommune: student.admission_record.residence_source,
      });

      const scores = student.admission_record.score_fields as Record<string, string | number> | null;
      if (scores) {
        if (scores["Điểm TB 4 năm"]) prefill.push({ fieldCode: "ADMISSION_J", value: String(scores["Điểm TB 4 năm"]) });
        if (scores["Hạnh kiểm"]) prefill.push({ fieldCode: "ADMISSION_K", value: String(scores["Hạnh kiểm"]) });
        if (scores["Điểm ưu tiên"]) prefill.push({ fieldCode: "ADMISSION_L", value: String(scores["Điểm ưu tiên"]) });
        if (scores["Điểm khuyến khích"]) prefill.push({ fieldCode: "ADMISSION_M", value: String(scores["Điểm khuyến khích"]) });
        if (scores["Tổng điểm xét tuyển"]) prefill.push({ fieldCode: "ADMISSION_N", value: String(scores["Tổng điểm xét tuyển"]) });
      }

      profile_values = prefill.map((p) => ({
        id: `preview-${p.fieldCode}`,
        field_code: p.fieldCode,
        source_value: null,
        proposed_value: p.value,
        change_status: "PREVIEW",
        updated_at: new Date(),
        student_id: student.id,
      }));
    }

    return NextResponse.json({
      success: true,
      student: { id: student.id, name: student.admission_record.full_name_source, current_cccd: student.current_cccd, current_dob: student.current_dob, status: student.status },
      admission_record: { ...student.admission_record, data_quality_flags: normalizeDataQualityFlags(student.admission_record.data_quality_flags) },
      profile_values,
      diffs,
      files: student.files,
      addresses: student.addresses,
      family_members: student.family_members,
      policy_records: student.policy_records,
      disabilities: student.disabilities,
      auditLogs,
      currentDecisions: student.profile_values.filter((value) =>
        ["ACCEPTED", "REJECTED", "ADMIN_EDITED"].includes(value.change_status),
      ),
      decisionHistory,
      revisionRequests: student.revision_requests,
    });
  } catch (error) {
    logServerError("Get review details error", error, requestIdentifier);
    return NextResponse.json(publicServerError(requestIdentifier), { status: 500 });
  }
}
