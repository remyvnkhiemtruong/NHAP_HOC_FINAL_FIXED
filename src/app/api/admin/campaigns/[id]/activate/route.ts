import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { scoreRuleSchema } from "@/lib/campaign";
import { requestId } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({ id: z.string().min(1).max(128) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession("admin_session");
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.admissionCampaign.findUnique({ where: { id: params.data.id } });
    if (!campaign) return null;
    if (!scoreRuleSchema.safeParse(campaign.score_rules).success) {
      return { error: "SCORE_RULES_REQUIRED" as const };
    }
    await tx.admissionCampaign.updateMany({
      where: { status: "ACTIVE", id: { not: campaign.id } },
      data: { status: "CLOSED" },
    });
    const active = await tx.admissionCampaign.update({
      where: { id: campaign.id },
      data: { status: "ACTIVE" },
    });
    await tx.auditLog.create({
      data: {
        actor_type: "ADMIN",
        actor_id: session.userId,
        action: "CAMPAIGN_ACTIVATED",
        entity_type: "AdmissionCampaign",
        entity_id: campaign.id,
        request_id: requestId(request.headers),
      },
    });
    return { campaign: active };
  });
  if (!result) return NextResponse.json({ error: "Không tìm thấy đợt tuyển sinh." }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: "Phải cấu hình đầy đủ quy tắc điểm trước khi kích hoạt." }, { status: 409 });
  return NextResponse.json({ success: true, campaign: result.campaign });
}
