import {
  parseScoreRules,
  scoreRuleSchema,
  validateScoreComponents,
} from "@/lib/campaign";
import { effectiveProfileValue } from "@/lib/student/effectiveProfileValue";
import {
  profileFieldValueSchema,
  validateProfileFieldMap,
} from "@/lib/validations/profileFieldSchema";
import { getClientIp } from "@/lib/http";

const rules = {
  fourYearAverage: { min: 0, max: 40, precision: 2 },
  fourYearConduct: { min: 0, max: 40, precision: 1 },
  priorityScore: { min: 0, max: 2, precision: 2 },
  encouragementScore: { min: 0, max: 2, precision: 2 },
};

describe("campaign score rules", () => {
  it("accepts a complete, bounded configuration", () => {
    expect(parseScoreRules(rules)).toEqual(rules);
  });

  it("rejects incomplete and inverted configuration", () => {
    expect(scoreRuleSchema.safeParse({}).success).toBe(false);
    expect(
      scoreRuleSchema.safeParse({
        ...rules,
        priorityScore: { min: 2, max: 1, precision: 2 },
      }).success,
    ).toBe(false);
  });

  it("uses Decimal boundaries and configured precision", () => {
    expect(
      validateScoreComponents(
        {
          fourYearAverage: "40.00",
          fourYearConduct: "20.1",
          priorityScore: "2",
          encouragementScore: "0",
        },
        rules,
      ),
    ).toBeNull();
    expect(
      validateScoreComponents(
        {
          fourYearAverage: "40.001",
          fourYearConduct: "20",
          priorityScore: "0",
          encouragementScore: "0",
        },
        rules,
      ),
    ).toContain("fourYearAverage");
    expect(
      validateScoreComponents(
        {
          fourYearAverage: "40.01",
          fourYearConduct: "20",
          priorityScore: "0",
          encouragementScore: "0",
        },
        rules,
      ),
    ).toContain("fourYearAverage");
  });
});

describe("effective profile value", () => {
  it.each([
    ["ACCEPTED", "source", "proposed", "approved", "approved"],
    ["ADMIN_EDITED", "source", "proposed", "admin", "admin"],
    ["PROPOSED", "source", "proposed", null, "proposed"],
    ["REJECTED", "source", "rejected", null, "source"],
    ["UNCHANGED", "source", "source", null, "source"],
  ])(
    "resolves %s with the documented precedence",
    (change_status, source_value, proposed_value, approved_value, expected) => {
      expect(
        effectiveProfileValue({
          change_status,
          source_value,
          proposed_value,
          approved_value,
        }),
      ).toBe(expected);
    },
  );

  it("falls back safely when an accepted value is missing", () => {
    expect(
      effectiveProfileValue({
        change_status: "ACCEPTED",
        source_value: "source",
        approved_value: null,
      }),
    ).toBe("source");
  });
});

describe("shared profile field validation", () => {
  it("enforces common CCCD, date, email, enum, and length rules", () => {
    expect(profileFieldValueSchema("BF").safeParse("095311003768").success).toBe(true);
    expect(profileFieldValueSchema("BF").safeParse("123").success).toBe(false);
    expect(profileFieldValueSchema("F").safeParse("29/02/2024").success).toBe(true);
    expect(profileFieldValueSchema("F").safeParse("29/02/2025").success).toBe(false);
    expect(profileFieldValueSchema("BI").safeParse("student@example.com").success).toBe(true);
    expect(profileFieldValueSchema("BI").safeParse("not-an-email").success).toBe(false);
    expect(profileFieldValueSchema("G").safeParse("Khác").success).toBe(false);
    expect(profileFieldValueSchema("O").safeParse("x".repeat(501)).success).toBe(false);
  });

  it("returns the first safe public validation error for a patch", () => {
    expect(validateProfileFieldMap({ BF: "123" })).toContain("12 chữ số");
  });
});

describe("trusted proxy client IP", () => {
  const originalHops = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = originalHops;
  });

  it("uses the client supplied by the configured single trusted proxy", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    expect(
      getClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" })),
    ).toBe("203.0.113.9");
  });

  it("ignores forwarded headers when no proxy is trusted", () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "203.0.113.9",
          "x-real-ip": "192.0.2.10",
        }),
      ),
    ).toBe("unknown");
  });

  it("uses the right-most untrusted address and ignores a spoofed prefix", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "198.51.100.44, 203.0.113.9",
        }),
      ),
    ).toBe("203.0.113.9");
  });
});
