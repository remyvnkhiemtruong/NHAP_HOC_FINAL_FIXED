import { blindIndex, decrypt, encryptRandom } from "./encryption";

const ENCRYPTED_MODELS = {
  Student: {
    random: ["current_cccd", "current_dob"],
    blind: { current_cccd: "current_cccd_lookup" },
  },
  AdmissionRecord: {
    random: [
      "cccd_source",
      "full_name_source",
      "dob_source",
      "ethnicity_source",
      "residence_source",
      "middle_school_source",
      "middle_school_commune_source",
      "note_source",
    ],
    json: ["source_json"],
    blind: { cccd_source: "cccd_source_lookup" },
  },
  StudentProfileValue: {
    random: ["source_value", "proposed_value", "approved_value"],
  },
  StudentProfileVersion: {
    json: ["snapshot_json"],
  },
  Address: {
    random: ["province_name_snapshot", "commune_name_snapshot", "hamlet", "detailed_text"],
  },
  FamilyMember: {
    random: ["full_name", "birth_year", "occupation", "phone", "email", "cccd"],
  },
  PolicyRecord: {
    random: ["description", "policy_regime"],
  },
  Disability: {
    random: ["disability_type"],
  },
  FileRecord: {},
  QrScanResult: {
    json: ["parsed_json"],
  },
  OcrResult: {
    random: ["raw_text"],
    json: ["parsed_json"],
  },
  ReviewDecision: {
    random: ["value_before", "value_after"],
  },
  AuditLog: {
    json: ["before_json", "after_json"],
  },
} as const;

const RELATION_MODELS: Record<string, Record<string, keyof typeof ENCRYPTED_MODELS>> = {
  Student: {
    admission_record: "AdmissionRecord",
    addresses: "Address",
    family_members: "FamilyMember",
    policy_records: "PolicyRecord",
    disabilities: "Disability",
    profile_values: "StudentProfileValue",
    profile_versions: "StudentProfileVersion",
    files: "FileRecord",
  },
  AdmissionRecord: { student: "Student" },
  FileRecord: {
    qr_scan_results: "QrScanResult",
    ocr_results: "OcrResult",
  },
};

type QueryArguments = Record<string, unknown>;
type QueryHandler = (args: unknown) => Promise<unknown>;

export const encryptionExtension = {
  name: "field-encryption",
  query: {
    $allModels: {
      async $allOperations({
        model,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: QueryArguments;
        query: QueryHandler;
      }) {
        if (!model || !(model in ENCRYPTED_MODELS)) return query(args);

        const config = ENCRYPTED_MODELS[model as keyof typeof ENCRYPTED_MODELS];
        const randomFields = (config as { random?: readonly string[] }).random ?? [];
        const jsonFields = (config as { json?: readonly string[] }).json ?? [];
        const blindFields =
          (config as { blind?: Readonly<Record<string, string>> }).blind ?? {};
        const clonedArgs = structuredClone(args);

        encryptMutationArguments(clonedArgs, randomFields, jsonFields, blindFields);

        const result = await query(clonedArgs);
        decryptResult(result, model as keyof typeof ENCRYPTED_MODELS);
        return result;
      },
    },
  },
};

function encryptMutationArguments(
  args: QueryArguments,
  randomFields: readonly string[],
  jsonFields: readonly string[],
  blindFields: Readonly<Record<string, string>>,
): void {
  for (const key of ["data", "create", "update"] as const) {
    const value = args[key];
    if (Array.isArray(value)) {
      value.forEach((item) => encryptPayload(item as QueryArguments, randomFields, jsonFields, blindFields));
    } else if (value && typeof value === "object") {
      encryptPayload(value as QueryArguments, randomFields, jsonFields, blindFields);
    }
  }
}

function valueForWrite(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "set" in value) {
    const setValue = (value as { set?: unknown }).set;
    return typeof setValue === "string" ? setValue : null;
  }
  return null;
}

function replaceWriteValue(container: QueryArguments, field: string, encrypted: string): void {
  const original = container[field];
  if (original && typeof original === "object" && "set" in original) {
    (original as { set: string }).set = encrypted;
  } else {
    container[field] = encrypted;
  }
}

function encryptPayload(
  payload: QueryArguments,
  randomFields: readonly string[],
  jsonFields: readonly string[],
  blindFields: Readonly<Record<string, string>>,
): void {
  if (!payload || typeof payload !== "object") return;
  for (const field of randomFields) {
    const value = valueForWrite(payload[field]);
    if (value && !value.startsWith("enc:v")) {
      const lookupField = blindFields[field];
      if (lookupField) {
        payload[lookupField] = blindIndex(value, `${lookupField}:v1`);
      }
      replaceWriteValue(payload, field, encryptRandom(value));
    }
  }
  for (const field of jsonFields) {
    const value = payload[field];
    if (
      value !== undefined &&
      value !== null &&
      !(
        typeof value === "object" &&
        !Array.isArray(value) &&
        "__encrypted" in value
      )
    ) {
      payload[field] = { __encrypted: encryptRandom(JSON.stringify(value)) };
    }
  }
}

function decryptResult(result: unknown, model: keyof typeof ENCRYPTED_MODELS): void {
  if (!result) return;
  if (Array.isArray(result)) {
    result.forEach((item) => decryptResult(item, model));
    return;
  }
  if (typeof result !== "object") return;
  const record = result as QueryArguments;
  const encryptedFields =
    (ENCRYPTED_MODELS[model] as { random?: readonly string[] }).random ?? [];
  for (const field of encryptedFields) {
    const value = record[field];
    if (typeof value === "string" && value.startsWith("enc:v")) {
      record[field] = decrypt(value);
    }
  }
  const encryptedJsonFields =
    (ENCRYPTED_MODELS[model] as { json?: readonly string[] }).json ?? [];
  for (const field of encryptedJsonFields) {
    const value = record[field];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "__encrypted" in value &&
      typeof (value as { __encrypted?: unknown }).__encrypted === "string"
    ) {
      record[field] = JSON.parse(
        decrypt((value as { __encrypted: string }).__encrypted),
      );
    }
  }
  for (const [relation, relationModel] of Object.entries(RELATION_MODELS[model] ?? {})) {
    if (record[relation]) decryptResult(record[relation], relationModel);
  }
}
