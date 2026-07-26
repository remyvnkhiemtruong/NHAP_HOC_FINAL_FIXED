"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SchoolBrand from "./SchoolBrand";

export default function AppHeader({ mode = "public" }: { mode?: "public" | "student" | "admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const adminLinks = [
    ["/admin", "Tổng quan"],
    ["/admin/campaigns", "Đợt nhập học"],
    ["/admin/import", "Nhập dữ liệu"],
    ["/admin/review", "Duyệt hồ sơ"],
    ["/admin/exports", "Xuất báo cáo"],
  ] as const;

  async function logout() {
    await fetch(mode === "admin" ? "/api/admin/logout" : "/api/student/logout", { method: "POST" });
    router.replace(mode === "admin" ? "/admin/login" : "/student/login");
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="app-header__inner app-header__inner--wide">
        <SchoolBrand compact />
        {mode === "admin" ? (
          <nav className="main-nav" aria-label="Quản trị">
            {adminLinks.map(([href, label]) => (
              <Link key={href} href={href} className={pathname === href || (href !== "/admin" && pathname.startsWith(href)) ? "active" : ""}>{label}</Link>
            ))}
          </nav>
        ) : mode === "public" ? (
          <nav className="main-nav" aria-label="Điều hướng chính">
            <Link href="/student/login">Học sinh nhập học</Link>
            <Link href="/admin/login">Quản trị</Link>
          </nav>
        ) : null}
        {mode !== "public" && <button type="button" className="button button--ghost button--small" onClick={logout}>Đăng xuất</button>}
      </div>
    </header>
  );
}
