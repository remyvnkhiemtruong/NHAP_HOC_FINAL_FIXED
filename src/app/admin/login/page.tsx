"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import SchoolBrand from "@/components/SchoolBrand";

export default function AdminLoginPage() {
  const router = useRouter(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Đăng nhập thất bại."); router.replace("/admin"); router.refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Đăng nhập thất bại."); } finally { setLoading(false); } }
  return <main className="admin-login"><div className="admin-login__brand"><SchoolBrand/><span className="eyebrow">CỔNG QUẢN TRỊ TUYỂN SINH</span><h1>Quản lý hồ sơ nhập học tập trung</h1></div><form className="admin-login__form glass-panel" onSubmit={submit}><div><span className="eyebrow">QUẢN TRỊ VIÊN</span><h2>Đăng nhập hệ thống</h2><p className="muted">Sử dụng tài khoản do quản trị hệ thống cấp.</p></div><label className="field"><span>Tên đăng nhập</span><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required/></label><label className="field"><span>Mật khẩu</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required/></label>{error && <div className="notice notice--error">{error}</div>}<button className="button button--primary button--block" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập quản trị"}</button><Link href="/" className="back-link">← Trở về trang nhập học</Link></form></main>;
}
