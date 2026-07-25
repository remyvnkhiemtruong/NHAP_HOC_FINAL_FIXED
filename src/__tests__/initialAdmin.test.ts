import { validateInitialAdminInput } from "@/lib/validations/initialAdmin";

describe("initial ADMIN validation", () => {
  it.each([undefined, "", "admin", "CHANGE_ME", "test-admin"])(
    "rejects unsafe username %s",
    (username) => {
      expect(() =>
        validateInitialAdminInput(username, "SafePassword-2026!"),
      ).toThrow("ADMIN_INITIAL_USERNAME");
    },
  );

  it.each([undefined, "", "short", "CHANGE_ME"])(
    "rejects unsafe password %s",
    (password) => {
      expect(() => validateInitialAdminInput("vvk-operator", password)).toThrow(
        "ADMIN_INITIAL_PASSWORD",
      );
    },
  );

  it("trims and accepts production credentials", () => {
    expect(
      validateInitialAdminInput(" vvk-operator ", " AStrongPassword-2026! "),
    ).toEqual({
      username: "vvk-operator",
      password: "AStrongPassword-2026!",
    });
  });
});
