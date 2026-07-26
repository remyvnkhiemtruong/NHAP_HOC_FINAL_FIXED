import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { StudentStatus } from "@/generated/prisma/enums";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripLocationCode } from "@/lib/utils/stringUtils";
import { activeCampaign } from "@/lib/campaign";
import { blindIndex } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { nameSearchTokens } from "@/lib/searchIndexes";

const querySchema = z.object({
  view: z.enum(["pending", "all", "approved", "missing-files", "cccd-correction", "changes"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  commune: z.string().trim().max(120).optional(),
  school: z.string().trim().max(160).optional(),
  ethnicity: z.string().trim().max(80).optional(),
  campaignId: z.string().min(1).max(128).optional(),
});

const empty = (value: string | null) => value?.trim() || undefined;
const flags = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export async function GET(request: Request) {
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      view: empty(url.searchParams.get("view")), page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined, search: empty(url.searchParams.get("search")),
      status: empty(url.searchParams.get("status")), commune: empty(url.searchParams.get("commune")),
      school: empty(url.searchParams.get("school")), ethnicity: empty(url.searchParams.get("ethnicity")),
      campaignId: empty(url.searchParams.get("campaignId")),
    });
    if (!parsed.success) return NextResponse.json({ error: "Bộ lọc không hợp lệ." }, { status: 400 });
    const input = parsed.data;
    const campaignId = input.campaignId ?? (await activeCampaign()).id;
    const searchTokens = input.search ? nameSearchTokens(input.search) : [];
    const admissionWhere: Prisma.AdmissionRecordWhereInput = {
      ...(input.commune ? { middle_school_commune_lookup: blindIndex(input.commune.toLocaleLowerCase("vi-VN"), "middle_school_commune:v1") } : {}),
      ...(input.school ? { middle_school_lookup: blindIndex(input.school.toLocaleLowerCase("vi-VN"), "middle_school:v1") } : {}),
      ...(input.ethnicity ? { ethnicity_lookup: blindIndex(input.ethnicity.toLocaleLowerCase("vi-VN"), "ethnicity:v1") } : {}),
      ...(input.search
        ? {
            OR: [
              ...(searchTokens.length
                ? [{ full_name_search_tokens: { hasEvery: searchTokens } }]
                : []),
              ...(/^\d{12}$/.test(input.search)
                ? [{ cccd_source_lookup: blindIndex(input.search, "cccd_source_lookup:v1") }]
                : []),
            ],
          }
        : {}),
    };
    const validFileStatuses = ["AUTO_VALID", "AUTO_WARNING", "ADMIN_APPROVED"] as const;
    const missingFileWhere: Prisma.StudentWhereInput =
      input.view === "missing-files"
        ? {
            OR: ["PHOTO_4X6", "CCCD_FRONT", "CCCD_BACK"].map((category) => ({
              files: {
                none: {
                  category: category as "PHOTO_4X6" | "CCCD_FRONT" | "CCCD_BACK",
                  is_current: true,
                  status: { in: [...validFileStatuses] },
                },
              },
            })),
          }
        : {};
    const where: Prisma.StudentWhereInput = {
      campaign_id: campaignId,
      ...(Object.keys(admissionWhere).length ? { admission_record: admissionWhere } : {}),
      ...(input.status ? { status: input.status } : input.view === "pending" ? { status: { in: [StudentStatus.SUBMITTED, StudentStatus.RESUBMITTED] } } : input.view === "approved" ? { status: { in: [StudentStatus.APPROVED, StudentStatus.LOCKED, StudentStatus.EXPORTED] } } : input.view === "cccd-correction" ? { status: StudentStatus.NEEDS_CCCD_CORRECTION } : {}),
      ...(input.view === "changes" ? { profile_values: { some: { change_status: "PROPOSED" } } } : {}),
      ...missingFileWhere,
    };
    const [total, students, totalImported, statusCounts] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { admission_record: { source_tt: "asc" } }, include: { admission_record: { select: { full_name_source: true, cccd_source: true, data_quality_flags: true, middle_school_source: true, middle_school_commune_source: true, ethnicity_source: true } }, profile_values: { where: { change_status: "PROPOSED" }, select: { updated_at: true } }, files: { where: { is_current: true }, select: { category: true, status: true, current_version: true } } } }),
      prisma.student.count({ where: { campaign_id: campaignId } }),
      prisma.student.groupBy({ by: ["status"], where: { campaign_id: campaignId }, _count: { _all: true } }),
    ]);
    const items = students.map((student) => {
      const current = new Map<string, { status: string; current_version: number }>();
      for (const file of student.files) { const old = current.get(file.category); if (!old || old.current_version < file.current_version) current.set(file.category, file); }
      const missingFiles = ["PHOTO_4X6", "CCCD_FRONT", "CCCD_BACK"].some((category) => !current.has(category) || ["AUTO_INVALID", "ADMIN_REJECTED", "REUPLOAD_REQUIRED", "MISSING"].includes(current.get(category)?.status ?? "MISSING"));
      const warnings = [student.current_cccd === "0" ? "CCCD cần cập nhật" : "", flags(student.admission_record.data_quality_flags).length ? "Cần đối chiếu dữ liệu" : "", missingFiles ? "Thiếu hoặc cần tải lại ảnh" : "", student.profile_values.length ? "Có thay đổi chờ duyệt" : ""].filter(Boolean);
      return { id: student.id, name: student.admission_record.full_name_source, cccd: student.current_cccd, status: student.status, school: student.admission_record.middle_school_source ?? "Chưa có", commune: stripLocationCode(student.admission_record.middle_school_commune_source) || "Chưa có", ethnicity: student.admission_record.ethnicity_source ?? "Chưa có", warnings, updatedAt: student.profile_values[0]?.updated_at ?? student.imported_at };
    });
    const countByStatus = Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all]));
    const reviewed = (countByStatus.APPROVED ?? 0) + (countByStatus.LOCKED ?? 0) + (countByStatus.EXPORTED ?? 0);
    const pending = (countByStatus.SUBMITTED ?? 0) + (countByStatus.RESUBMITTED ?? 0);
    return NextResponse.json({ success: true, items, students: items, pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) }, summary: { totalImported, reviewed, pending, countByStatus } });
  } catch (error) {
    logger.error("List review students error", { error });
    return NextResponse.json({ error: "Không thể tải danh sách hồ sơ." }, { status: 500 });
  }
}
