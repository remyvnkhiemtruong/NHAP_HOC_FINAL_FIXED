import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { scoreRuleSchema } from "@/lib/campaign";
import { getClientIp, logServerError, publicServerError, requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z
  .object({
    code: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().trim().min(3).max(200),
    schoolYearStart: z.number().int().min(2020).max(2100),
    schoolYearEnd: z.number().int().min(2021).max(2101),
    admissionDate: z.string().datetime(),
    schoolName: z.string().trim().min(3).max(200),
    schoolCode: z.string().trim().min(1).max(50),
    templateVersion: z.string().trim().min(1).max(100),
    scoreRules: scoreRuleSchema,
  })
  .strict()
  .refine((value) => value.schoolYearEnd === value.schoolYearStart + 1, {
    path: ["schoolYearEnd"],
    message: "Năm kết thúc phải ngay sau năm bắt đầu.",
  });

export async function GET() {
  const session = await getSession("admin_session");
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await prisma.admissionCampaign.findMany({
    orderBy: [{ school_year_start: "desc" }, { created_at: "desc" }],
    include: { _count: { select: { students: true, import_batches: true, export_batches: true } } },
  });
  return NextResponse.json({ success: true, items: campaigns });
}

export async function POST(request: Request) {
  const id = requestId(request.headers);
  try {
    const session = await getSession("admin_session");
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Cấu hình đợt tuyển sinh không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.admissionCampaign.create({
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          school_year_start: parsed.data.schoolYearStart,
          school_year_end: parsed.data.schoolYearEnd,
          admission_date: new Date(parsed.data.admissionDate),
          school_name: parsed.data.schoolName,
          school_code: parsed.data.schoolCode,
          template_version: parsed.data.templateVersion,
          score_rules: parsed.data.scoreRules,
        },
      });
      await tx.auditLog.create({
        data: {
          actor_type: "ADMIN",
          actor_id: session.userId,
          action: "CAMPAIGN_CREATED",
          entity_type: "AdmissionCampaign",
          entity_id: created.id,
          request_id: id,
          after_json: { code: created.code, ip: getClientIp(request.headers) },
        },
      });
      return created;
    });
    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    logServerError("Create campaign error", error, id);
    return NextResponse.json(publicServerError(id), { status: 500 });
  }
}
