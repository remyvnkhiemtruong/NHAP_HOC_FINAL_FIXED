import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { canStudentEdit, canStudentSubmit } from "@/domain/student-state";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getCommunesByProvinceName } from "@/lib/catalogs/administrative";
import {
  ADMISSION_FIELD_CODES,
  admissionEditableSchema,
  calculateAdmissionScore,
  type AdmissionEditableInput,
  type AdmissionFormData,
} from "@/lib/student/admissionProfile";
import { isValidIssueDate } from "@/lib/student/issueDate";
import { coerceProfileFlags, readPersistedFields } from "@/lib/student/profilePersistence";
import { deriveCccdIssuer } from "@/lib/student/profileRules";
import { profileSeedRows } from "@/lib/student/profileSeed";
import { normalizeSingleLine, normalizeUppercaseName } from "@/lib/utils/stringUtils";
import { isValidPhone } from "@/lib/validations/phoneValidator";
import { effectiveProfileValue } from "@/lib/student/effectiveProfileValue";
import { parseScoreRules, validateScoreComponents } from "@/lib/campaign";
import { validateProfileFieldMap } from "@/lib/validations/profileFieldSchema";

const PHONE_FIELDS = new Set(["AF", "AN", "AT", "AZ"]);
const bodySchema = z.object({ fields: z.unknown().optional(), admission: admissionEditableSchema.optional() }).strict();

type ProfileValue = {
  id?: string;
  field_code: string;
  source_value: string | null;
  proposed_value: string | null;
  approved_value: string | null;
  change_status: string;
  updated_at?: Date;
};

function validateStudentChanges(fields: Record<string, string>, effectiveDob: string): string | null {
  if ("BF" in fields && !/^\d{12}$/.test(fields.BF)) return "Số CCCD phải gồm đúng 12 chữ số.";
  for (const field of PHONE_FIELDS) {
    if (fields[field] && !isValidPhone(fields[field])) {
      return "Số điện thoại phải có 10 chữ số và thuộc đầu số được hỗ trợ.";
    }
  }
  if (fields.BG && !isValidIssueDate(fields.BG, effectiveDob)) {
    return "Ngày cấp phải hợp lệ, không trước ngày sinh và không sau ngày hiện tại.";
  }
  return null;
}

function toAdmissionPayload(
  record: {
    source_tt: string;
    cccd_source: string;
    full_name_source: string;
    female_mark_source: string | null;
    dob_source: string;
    ethnicity_source: string | null;
    residence_source: string | null;
  },
  fields: Record<string, string>,
  values: Map<string, ProfileValue>,
): AdmissionFormData {
  return {
    sourceTt: record.source_tt,
    cccd: fields.BF ?? record.cccd_source,
    fullName: fields.C ?? record.full_name_source,
    gender: fields.G ?? (record.female_mark_source?.toLowerCase() === "x" ? "Nữ" : "Nam"),
    dateOfBirth: fields.F ?? record.dob_source,
    ethnicity: fields.W ?? record.ethnicity_source ?? "",
    residenceCommune: fields.N ?? record.residence_source ?? "",
    middleSchool: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.middleSchool)),
    middleSchoolCommune: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.middleSchoolCommune)),
    fourYearAverage: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.fourYearAverage)),
    fourYearConduct: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.fourYearConduct)),
    priorityScore: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.priorityScore)),
    encouragementScore: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.encouragementScore)),
    admissionScore: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.admissionScore)),
    note: effectiveProfileValue(values.get(ADMISSION_FIELD_CODES.note)),
  };
}

export async function GET(request: Request) {
  const id = requestId(request.headers);
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        admission_record: true,
        campaign: { select: { admission_date: true } },
        profile_values: true,
        files: {
          where: { is_current: true },
          orderBy: [{ category: "asc" }, { current_version: "desc" }],
          select: {
            id: true,
            category: true,
            status: true,
            current_version: true,
            original_name: true,
            width: true,
            height: true,
          },
        },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const profileValues: ProfileValue[] = student.profile_values.length
      ? student.profile_values
      : profileSeedRows(student.id, student.admission_record, student.campaign.admission_date).map((row) => ({
          ...row,
          approved_value: null,
        }));
    const valueByCode = new Map(profileValues.map((value) => [value.field_code, value]));
    const fields: Record<string, string> = {};
    for (const value of profileValues) {
      if (!value.field_code.startsWith("ADMISSION_")) fields[value.field_code] = effectiveProfileValue(value);
    }
    const currentFiles = new Map<string, (typeof student.files)[number]>();
    for (const file of student.files) {
      if (!currentFiles.has(file.category)) currentFiles.set(file.category, file);
    }

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        status: student.status,
        editable: canStudentEdit(student.status),
        canSubmit: canStudentSubmit(student.status),
      },
      fields: coerceProfileFlags(fields),
      fieldDetails: profileValues
        .filter((value) => !value.field_code.startsWith("ADMISSION_"))
        .map((value) => ({
          fieldCode: value.field_code,
          sourceValue: value.source_value,
          proposedValue: value.proposed_value,
          approvedValue: value.approved_value,
          changeStatus: value.change_status,
        })),
      admission: toAdmissionPayload(student.admission_record, fields, valueByCode),
      files: [...currentFiles.values()].map((file) => ({
        id: file.id,
        category: file.category,
        status: file.status,
        currentVersion: file.current_version,
        originalName: file.original_name,
        width: file.width,
        height: file.height,
        url: `/api/student/files/${file.id}`,
      })),
    });
  } catch (error) {
    logServerError("Get profile error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const id = requestId(request.headers);
  try {
    const session = await getSession("student_session");
    if (!session?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu hồ sơ không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }
    const rawFields = readPersistedFields(parsed.data.fields);
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(rawFields).map(([code, value]) => [
        code,
        ["AK", "AQ", "AW"].includes(code)
          ? normalizeUppercaseName(value)
          : ["C", "AM", "AS", "AY", "O"].includes(code)
            ? normalizeSingleLine(value)
            : value.trim(),
      ]),
    );

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: session.studentId },
        select: { id: true, status: true, campaign: { select: { score_rules: true } } },
      });
      if (!student) return { kind: "missing" as const };
      if (!canStudentEdit(student.status)) return { kind: "locked" as const, status: student.status };

      const currentValues = await tx.studentProfileValue.findMany({ where: { student_id: student.id } });
      const byCode = new Map<string, ProfileValue>(currentValues.map((value) => [value.field_code, value]));
      const getValue = (code: string) =>
        code in fieldsToUpdate ? fieldsToUpdate[code] : effectiveProfileValue(byCode.get(code));
      const validationError =
        validateProfileFieldMap(fieldsToUpdate) ??
        validateStudentChanges(fieldsToUpdate, getValue("F"));
      if (validationError) return { kind: "validation" as const, validationError };
      const scoreInput = {
        fourYearAverage:
          parsed.data.admission?.fourYearAverage ??
          effectiveProfileValue(byCode.get(ADMISSION_FIELD_CODES.fourYearAverage)),
        fourYearConduct:
          parsed.data.admission?.fourYearConduct ??
          effectiveProfileValue(byCode.get(ADMISSION_FIELD_CODES.fourYearConduct)),
        priorityScore:
          parsed.data.admission?.priorityScore ??
          effectiveProfileValue(byCode.get(ADMISSION_FIELD_CODES.priorityScore)),
        encouragementScore:
          parsed.data.admission?.encouragementScore ??
          effectiveProfileValue(byCode.get(ADMISSION_FIELD_CODES.encouragementScore)),
      };
      const scoreError = validateScoreComponents(scoreInput, parseScoreRules(student.campaign.score_rules));
      if (scoreError) return { kind: "validation" as const, validationError: scoreError };

      const changedCodes: string[] = [];
      const writeProposal = async (code: string, value: string) => {
        const existing = byCode.get(code);
        const sourceValue = existing?.source_value ?? "";
        if (existing?.change_status !== "REJECTED" && effectiveProfileValue(existing) === value) return;
        const saved = await tx.studentProfileValue.upsert({
          where: { student_id_field_code: { student_id: student.id, field_code: code } },
          update: {
            proposed_value: value,
            change_status: sourceValue === value ? "UNCHANGED" : "PROPOSED",
            approved_value: null,
          },
          create: {
            student_id: student.id,
            field_code: code,
            source_value: "",
            proposed_value: value,
            change_status: value ? "PROPOSED" : "UNCHANGED",
          },
        });
        byCode.set(code, saved);
        await tx.revisionItem.updateMany({
          where: {
            profile_value_id: saved.id,
            resolved_at: null,
          },
          data: { resolved_at: new Date() },
        });
        changedCodes.push(code);
      };

      for (const [code, value] of Object.entries(fieldsToUpdate)) await writeProposal(code, value);
      if (parsed.data.admission) {
        for (const [name, value] of Object.entries(parsed.data.admission)) {
          await writeProposal(ADMISSION_FIELD_CODES[name as keyof AdmissionEditableInput], value ?? "");
        }
      }
      const admissionValues = Object.fromEntries(
        Object.entries(ADMISSION_FIELD_CODES).map(([name, code]) => [name, effectiveProfileValue(byCode.get(code))]),
      ) as Record<keyof AdmissionEditableInput | "admissionScore", string>;
      const admissionScore = calculateAdmissionScore(admissionValues);
      await writeProposal(ADMISSION_FIELD_CODES.admissionScore, admissionScore);

      const residenceProvince = getValue("L");
      const residenceCommune = getValue("N");
      const birthProvince = getValue("CG");
      const birthCommune = getValue("CH");
      const residenceCommuneCode =
        getCommunesByProvinceName(residenceProvince).find((commune) => commune.name === residenceCommune)?.code ?? "";
      const birthCommuneCode =
        getCommunesByProvinceName(birthProvince).find((commune) => commune.name === birthCommune)?.code ?? "";
      const permanentAddress = [getValue("O"), residenceCommune, residenceProvince].filter(Boolean).join(", ");
      const derivedFields: Record<string, string> = {
        BY: getValue("W"),
        M: residenceCommuneCode,
        Q: birthProvince,
        R: birthProvince,
        S: [birthCommune, birthProvince].filter(Boolean).join(" - "),
        T: permanentAddress,
        U: getValue("giong_thuong_tru") === "true" ? permanentAddress : getValue("U"),
        CI: birthProvince,
        CJ: birthCommuneCode,
        CK: birthCommune,
        AG: getValue("BF"),
        BH: deriveCccdIssuer(getValue("BG")),
      };
      for (const [code, value] of Object.entries(derivedFields)) await writeProposal(code, value);

      const nextStatus = student.status === "IMPORTED" ? "DRAFT" : student.status;
      if (nextStatus !== student.status) {
        await tx.student.update({ where: { id: student.id }, data: { status: nextStatus } });
      }
      await tx.auditLog.create({
        data: {
          actor_type: "STUDENT",
          actor_id: student.id,
          action: "PROFILE_DRAFT_SAVED",
          entity_type: "Student",
          entity_id: student.id,
          request_id: id,
          after_json: { changedFieldCodes: [...new Set(changedCodes)], status: nextStatus, ip: getClientIp(request.headers) },
        },
      });
      return { kind: "ok" as const, derivedFields, admissionScore, status: nextStatus };
    });

    if (result.kind === "missing") return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (result.kind === "locked") {
      return NextResponse.json(
        { error: "Hồ sơ đang ở trạng thái không cho phép chỉnh sửa.", code: "PROFILE_NOT_EDITABLE", status: result.status },
        { status: 409 },
      );
    }
    if (result.kind === "validation") {
      return NextResponse.json({ error: result.validationError, code: "INVALID_PROFILE_FIELD" }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logServerError("Patch profile error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
