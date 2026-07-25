const forbiddenUsernames = new Set(["", "admin", "change_me", "test-admin"]);

export function validateInitialAdminInput(
  username: string | undefined,
  password: string | undefined,
): { username: string; password: string } {
  const normalizedUsername = username?.trim() ?? "";
  const normalizedPassword = password?.trim() ?? "";
  if (forbiddenUsernames.has(normalizedUsername.toLowerCase())) {
    throw new Error(
      "ADMIN_INITIAL_USERNAME must be a non-default production value.",
    );
  }
  if (
    normalizedPassword.length < 16 ||
    normalizedPassword.toLowerCase() === "change_me"
  ) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD must contain at least 16 characters.",
    );
  }
  return { username: normalizedUsername, password: normalizedPassword };
}
