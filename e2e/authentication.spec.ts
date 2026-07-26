import { expect, test } from "@playwright/test";
import { Client } from "pg";
import path from "node:path";
import { decrypt } from "../src/lib/encryption";

function projectOffset(projectName: string): number {
  if (projectName === "tablet") return 1;
  if (projectName === "mobile") return 2;
  return 0;
}

async function eligibleStudent(projectName = "desktop"): Promise<{ id: string; cccd: string; dob: string }> {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@127.0.0.1:25432/vvk_test?schema=public",
  });
  await client.connect();
  try {
    const result = await client.query<{ id: string; current_cccd: string; current_dob: string }>(
      'SELECT "id", "current_cccd", "current_dob" FROM "Student" WHERE status <> \'NEEDS_CCCD_CORRECTION\' ORDER BY "imported_at" ASC LIMIT 1 OFFSET $1',
      [projectOffset(projectName)],
    );
    if (!result.rows[0]) throw new Error("Missing imported student fixture");
    return {
      id: result.rows[0].id,
      cccd: decrypt(result.rows[0].current_cccd),
      dob: decrypt(result.rows[0].current_dob),
    };
  } finally {
    await client.end();
  }
}

async function profilePersistenceState(studentId: string): Promise<{ status: string; valueCount: number }> {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@127.0.0.1:25432/vvk_test?schema=public",
  });
  await client.connect();
  try {
    const result = await client.query<{ status: string; value_count: string }>(
      'SELECT s."status", COUNT(v."id")::text AS "value_count" FROM "Student" s LEFT JOIN "StudentProfileValue" v ON v."student_id" = s."id" WHERE s."id" = $1 GROUP BY s."id"',
      [studentId],
    );
    if (!result.rows[0]) throw new Error("Missing student persistence state");
    return { status: result.rows[0].status, valueCount: Number(result.rows[0].value_count) };
  } finally {
    await client.end();
  }
}

async function loginStudent(page: import("@playwright/test").Page, projectName: string): Promise<{ id: string; cccd: string; dob: string }> {
  const student = await eligibleStudent(projectName);
  await page.goto("/student/login");
  await page.getByLabel(/Số căn cước công dân/i).fill(student.cccd);
  await page.getByLabel(/Ngày sinh/i).fill(student.dob.replaceAll("/", ""));
  await page.getByRole("button", { name: /Truy cập hồ sơ/i }).click();
  await page.waitForURL("**/student/profile");
  return student;
}

test("landing page is responsive and links to student access", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  const expectedNonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(expectedNonce).toBeTruthy();
  const scriptNonces = await page
    .locator("script")
    .evaluateAll((scripts) => scripts.map((script) => script.nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every((nonce) => nonce === expectedNonce)).toBe(true);
  await expect(page.getByRole("heading", { name: /Hệ thống nhập học trực tuyến lớp 10/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bắt đầu nhập học/i })).toHaveAttribute("href", "/student/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("student authenticates with CCCD and date of birth", async ({ page }, testInfo) => {
  await page.goto("/student/login");
  await page.getByLabel(/Số căn cước công dân/i).fill("000000000000");
  await page.getByLabel(/Ngày sinh/i).fill("01012010");
  await page.getByRole("button", { name: /Truy cập hồ sơ/i }).click();
  await expect(
    page.getByText(/Số CCCD hoặc ngày sinh không khớp/i),
  ).toBeVisible();

  const student = await loginStudent(page, testInfo.project.name);
  const initialPersistence = await profilePersistenceState(student.id);
  await expect(page.getByText(/Tiến độ hồ sơ/i)).toBeVisible();
  await expect(page.getByText(/BƯỚC 1\/9/i)).toBeVisible();
  await page.waitForTimeout(2_500);
  await expect.poll(() => profilePersistenceState(student.id)).toEqual(initialPersistence);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("student can navigate all nine steps and sees three required file types", async ({ page }, testInfo) => {
  await loginStudent(page, testInfo.project.name);
  const mobileStepNavigation = page.getByLabel("Chọn bước hồ sơ");
  if (testInfo.project.name === "mobile") {
    await expect(mobileStepNavigation).toBeVisible();
    await mobileStepNavigation.selectOption("8");
  } else {
    await page.getByRole("button", { name: /Tài liệu & Nộp hồ sơ/i }).click();
  }
  await expect(page.getByText(/BƯỚC 9\/9/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ảnh thẻ 4x6" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ảnh CCCD mặt trước" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ảnh CCCD mặt sau" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(3);
});

test("student image upload completes in the background worker", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Worker regression runs once.");
  test.setTimeout(100_000);
  await loginStudent(page, testInfo.project.name);
  await page.getByRole("button", { name: /Tài liệu & Nộp hồ sơ/i }).click();
  await page
    .locator('input[type="file"]')
    .nth(2)
    .setInputFiles(path.resolve("public", "anh-4x6-mau.jpg"));
  await expect(
    page.getByText(/Ảnh đã được tải và kiểm tra hợp lệ|cần nhà trường kiểm tra thêm/i),
  ).toBeVisible({ timeout: 90_000 });
});

test("ADMIN signs in and reaches the dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel(/Tên đăng nhập/i).fill(process.env.TEST_ADMIN_USERNAME ?? "test-admin");
  await page.getByLabel(/Mật khẩu/i).fill(process.env.TEST_ADMIN_PASSWORD ?? "test-password-2026");
  await page.getByRole("button", { name: /Đăng nhập quản trị/i }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: /Bảng điều khiển nhập học/i })).toBeVisible();
});

test("ADMIN manual entry rejects an impossible date", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Validation regression runs once.");
  await page.goto("/admin/login");
  await page
    .getByLabel(/Tên đăng nhập/i)
    .fill(process.env.TEST_ADMIN_USERNAME ?? "test-admin");
  await page
    .getByLabel(/Mật khẩu/i)
    .fill(process.env.TEST_ADMIN_PASSWORD ?? "test-password-2026");
  await page.getByRole("button", { name: /Đăng nhập quản trị/i }).click();
  await page.waitForURL("**/admin");

  const result = await page.evaluate(async (data) => {
    const response = await fetch("/api/admin/student/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  }, {
      fullName: "Học sinh ngày sai",
      cccd: "079210123456",
      dob: "99/99/9999",
      middleSchool: "THCS Kiểm thử",
  });
  expect(result.status).toBe(400);
  expect(result.body).toEqual(
    expect.objectContaining({ error: "Dữ liệu học sinh không hợp lệ." }),
  );

  const searchResult = await page.evaluate(async () => {
    const response = await fetch("/api/admin/review?view=all&search=nguyen%20van&pageSize=10");
    return { status: response.status, body: await response.json() };
  });
  expect(searchResult.status).toBe(200);
  expect(searchResult.body.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: expect.stringMatching(/NGUYỄN VĂN/i) }),
    ]),
  );
});
