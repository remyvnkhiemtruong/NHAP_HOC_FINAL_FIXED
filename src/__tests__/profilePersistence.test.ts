import { readPersistedFields } from "@/lib/student/profilePersistence";

describe("readPersistedFields", () => {
  it("keeps only persisted string fields", () => {
    expect(
      readPersistedFields({
        C: "NGUYỄN VĂN A",
        BF: "095000000001",
        giong_thuong_tru: false,
        has_policy: true,
        M: "00070",
      }),
    ).toEqual({ C: "NGUYỄN VĂN A", BF: "095000000001" });
  });

  it.each([null, undefined, [], "not-an-object", 42])(
    "rejects invalid payload %p",
    (value) => {
      expect(readPersistedFields(value)).toEqual({});
    },
  );
});
