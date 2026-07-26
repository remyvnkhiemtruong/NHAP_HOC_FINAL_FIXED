import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import Decimal from "decimal.js";

export const scoreRuleSchema = z.object({
  fourYearAverage: z.object({ min: z.number().nonnegative(), max: z.number().positive(), precision: z.number().int().min(0).max(3) }),
  fourYearConduct: z.object({ min: z.number().nonnegative(), max: z.number().positive(), precision: z.number().int().min(0).max(3) }),
  priorityScore: z.object({ min: z.number().nonnegative(), max: z.number().positive(), precision: z.number().int().min(0).max(3) }),
  encouragementScore: z.object({ min: z.number().nonnegative(), max: z.number().positive(), precision: z.number().int().min(0).max(3) }),
}).superRefine((rules, context) => {
  for (const [key, rule] of Object.entries(rules)) {
    if (rule.max <= rule.min) context.addIssue({ code: "custom", path: [key, "max"], message: "max must be greater than min" });
  }
});

export type ScoreRules = z.infer<typeof scoreRuleSchema>;

export async function activeCampaign() {
  const campaign = await prisma.admissionCampaign.findFirst({ where: { status: "ACTIVE" } });
  if (!campaign) throw new Error("ACTIVE_CAMPAIGN_REQUIRED");
  return campaign;
}

export async function ensureDefaultCampaign() {
  const existing = await prisma.admissionCampaign.findFirst({
    orderBy: [{ status: "asc" }, { created_at: "asc" }],
  });
  if (existing) return existing;
  const yearStart = Number.parseInt(
    process.env.DEFAULT_CAMPAIGN_YEAR_START ?? String(new Date().getFullYear()),
    10,
  );
  const yearEnd = yearStart + 1;
  const code = process.env.DEFAULT_CAMPAIGN_CODE ?? `${yearStart}-${yearEnd}`;
  const schoolName = process.env.DEFAULT_SCHOOL_NAME ?? "Trường tuyển sinh";
  const schoolCode = process.env.DEFAULT_SCHOOL_CODE ?? "SCHOOL";
  const admissionDate = new Date(
    process.env.DEFAULT_ADMISSION_DATE ?? `${yearStart}-09-05T00:00:00+07:00`,
  );
  return prisma.admissionCampaign.create({
    data: {
      code,
      name: process.env.DEFAULT_CAMPAIGN_NAME ?? `Tuyển sinh lớp 10 năm học ${yearStart}–${yearEnd}`,
      status: "ACTIVE",
      school_year_start: yearStart,
      school_year_end: yearEnd,
      admission_date: admissionDate,
      school_name: schoolName,
      school_code: schoolCode,
      template_version: process.env.DEFAULT_TEMPLATE_VERSION ?? `SMAS-${code}-v1`,
      score_rules: {
        fourYearAverage: { min: 0, max: 40, precision: 2 },
        fourYearConduct: { min: 0, max: 40, precision: 2 },
        priorityScore: { min: 0, max: 2, precision: 2 },
        encouragementScore: { min: 0, max: 2, precision: 2 },
      },
    },
  });
}

export function parseScoreRules(value: Prisma.JsonValue): ScoreRules {
  return scoreRuleSchema.parse(value);
}

export function validateScoreComponents(
  input: Record<"fourYearAverage" | "fourYearConduct" | "priorityScore" | "encouragementScore", string>,
  rules: ScoreRules,
): string | null {
  for (const key of Object.keys(input) as Array<keyof typeof input>) {
    let value: Decimal;
    try {
      value = new Decimal(input[key] || 0);
    } catch {
      return "Điểm phải là số hợp lệ.";
    }
    const rule = rules[key];
    if (value.lessThan(rule.min) || value.greaterThan(rule.max)) {
      return `${key} phải từ ${rule.min} đến ${rule.max}.`;
    }
    if (value.decimalPlaces() > rule.precision) {
      return `${key} chỉ được tối đa ${rule.precision} chữ số thập phân.`;
    }
  }
  return null;
}
