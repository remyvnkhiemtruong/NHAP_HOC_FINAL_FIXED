export type EffectiveProfileValue = {
  source_value?: string | null;
  proposed_value?: string | null;
  approved_value?: string | null;
  change_status: string;
};

export function effectiveProfileValue(value: EffectiveProfileValue | null | undefined): string {
  if (!value) return "";
  switch (value.change_status) {
    case "ACCEPTED":
    case "ADMIN_EDITED":
      return value.approved_value ?? value.source_value ?? "";
    case "PROPOSED":
      return value.proposed_value ?? value.source_value ?? "";
    case "REJECTED":
    case "UNCHANGED":
    default:
      return value.source_value ?? "";
  }
}
