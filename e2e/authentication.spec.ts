import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { decrypt } from "../src/lib/encryption";

function projectOffset(projectName: string): number {
  if (projectName === "tablet") return 1;
  if (projectName === "mobile") return 2;
  return 0;
}

async function eligibleStudent(projectName = "desktop"): Promise<{ cccd: string; dob: string }> {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@127.0.0.1:25432/vvk_test?schema=public",
  });
  await client.connect();
  try {
    const result = await client.query<{ current_cccd: string; current_dob: string }>(
      'SELECT "current_cccd", "current_dob" FROM "Student" WHERE status = \'IMPORTED\' ORDER BY "imported_at" ASC LIMIT 1 OFFSET $1',
      [projectOffset(projectName)],
    );
    if (!result.rows[0]) throw new Error("Missing imported student fixture");
    return { cccd: decrypt(result.rows[0].current_cccd), dob: decrypt(result.rows[0].current_dob) };
  } finally {
    await client.end();
  }
}

async function loginStudent(page: import("@playwright/test").Page, projectName: string): Promise<void> {
  const student = await eligibleStudent(projectName);
  await page.goto("/student/login");
  await page.getByLabel(/Số căn cước công dân/i).fill(student.cccd);
  await page.getByLabel(/Ngày sinh/i).fill(student.dob.replaceAll("/", ""));
  await page.getByRole("button", { name: /Truy cập hồ sơ/i }).click();
  await page.waitForURL("**/student/profile");
}

test("landing page is responsive and links to student access", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hệ thống nhập học trực tuyến lớp 10/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bắt đầu nhập học/i })).toHaveAttribute("href", "/student/login");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("student authenticates with CCCD and date of birth", async ({ page }, testInfo) => {
  await page.goto("/student/login");
  await page.getByLabel(/Số căn cước công dân/i).fill("000000000000");
  await page.getByLabel(/Ngày sinh/i).fill("01012010");
  await page.getByRole("button", { name: /Truy cập hồ sơ/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await loginStudent(page, testInfo.project.name);
  await expect(page.getByText(/Tiến độ hồ sơ/i)).toBeVisible();
  await expect(page.getByText(/BƯỚC 1\/9/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("student can navigate all nine steps and sees three required file types", async ({ page }, testInfo) => {
  await loginStudent(page, testInfo.project.name);
  await page.getByRole("button", { name: /Tệp hồ sơ và xác nhận/i }).click();
  await expect(page.getByText(/BƯỚC 9\/9/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ảnh chân dung 4×6" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CCCD mặt trước" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CCCD mặt sau" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(3);
});

test("ADMIN signs in and reaches the dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel(/Tên đăng nhập/i).fill(process.env.TEST_ADMIN_USERNAME ?? "test-admin");
  await page.getByLabel(/Mật khẩu/i).fill(process.env.TEST_ADMIN_PASSWORD ?? "test-password-2026");
  await page.getByRole("button", { name: /Đăng nhập quản trị/i }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: /Bảng điều khiển nhập học/i })).toBeVisible();
});
