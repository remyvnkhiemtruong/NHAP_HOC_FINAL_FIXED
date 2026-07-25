import { decrypt, encryptDeterministic, encryptRandom } from "./encryption";

const ENCRYPTED_MODELS = {
  Student: {
    deterministic: ["current_cccd"],
    random: ["current_dob"],
  },
  FamilyMember: {
    random: ["full_name", "phone", "email", "cccd"],
  },
} as const;

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
        const deterministicFields =
          (config as { deterministic?: readonly string[] }).deterministic ?? [];
        const randomFields = (config as { random?: readonly string[] }).random ?? [];
        const encryptedFields = [...deterministicFields, ...randomFields];
        const clonedArgs = structuredClone(args);

        encryptMutationArguments(clonedArgs, deterministicFields, randomFields);
        if (clonedArgs.where) {
          encryptWhere(clonedArgs.where as QueryArguments, deterministicFields);
        }

        const result = await query(clonedArgs);
        decryptResult(result, encryptedFields);
        return result;
      },
    },
  },
};

function encryptMutationArguments(
  args: QueryArguments,
  deterministicFields: readonly string[],
  randomFields: readonly string[],
): void {
  for (const key of ["data", "create", "update"] as const) {
    const value = args[key];
    if (Array.isArray(value)) {
      value.forEach((item) => encryptPayload(item as QueryArguments, deterministicFields, randomFields));
    } else if (value && typeof value === "object") {
      encryptPayload(value as QueryArguments, deterministicFields, randomFields);
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
  deterministicFields: readonly string[],
  randomFields: readonly string[],
): void {
  if (!payload || typeof payload !== "object") return;
  for (const field of deterministicFields) {
    const value = valueForWrite(payload[field]);
    if (value && !value.startsWith("enc:v")) {
      replaceWriteValue(payload, field, encryptDeterministic(value));
    }
  }
  for (const field of randomFields) {
    const value = valueForWrite(payload[field]);
    if (value && !value.startsWith("enc:v")) {
      replaceWriteValue(payload, field, encryptRandom(value));
    }
  }
}

function encryptWhere(where: QueryArguments, deterministicFields: readonly string[]): void {
  if (!where || typeof where !== "object") return;
  for (const field of deterministicFields) {
    const value = where[field];
    if (typeof value === "string" && !value.startsWith("enc:v")) {
      where[field] = encryptDeterministic(value);
    } else if (value && typeof value === "object") {
      const operator = value as QueryArguments;
      if (typeof operator.equals === "string" && !operator.equals.startsWith("enc:v")) {
        operator.equals = encryptDeterministic(operator.equals);
      }
      if (Array.isArray(operator.in)) {
        operator.in = operator.in.map((item) =>
          typeof item === "string" && !item.startsWith("enc:v")
            ? encryptDeterministic(item)
            : item,
        );
      }
    }
  }
  for (const operator of ["AND", "OR", "NOT"] as const) {
    const nested = where[operator];
    if (!nested) continue;
    const list = Array.isArray(nested) ? nested : [nested];
    list.forEach((item) => encryptWhere(item as QueryArguments, deterministicFields));
  }
}

function decryptResult(result: unknown, encryptedFields: readonly string[]): void {
  if (!result) return;
  if (Array.isArray(result)) {
    result.forEach((item) => decryptResult(item, encryptedFields));
    return;
  }
  if (typeof result !== "object") return;
  const record = result as QueryArguments;
  for (const field of encryptedFields) {
    const value = record[field];
    if (typeof value === "string" && value.startsWith("enc:v")) {
      record[field] = decrypt(value);
    }
  }
}
