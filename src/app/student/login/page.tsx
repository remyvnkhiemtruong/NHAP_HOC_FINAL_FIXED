"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function StudentLoginPage() {
  const router = useRouter();
  const [cccd, setCccd] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/student/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cccd, dob }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể xác thực hồ sơ.");
      router.replace("/student/profile"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Đã xảy ra lỗi."); }
    finally { setLoading(false); }
  }

  return (
    <><AppHeader />
      <main className="auth-page"><div className="auth-panel">
        <div className="auth-panel__intro"><span className="eyebrow">DÀNH CHO HỌC SINH</span><h1>Truy cập hồ sơ nhập học</h1><p>Nhập đúng thông tin trong danh sách trúng tuyển. Hệ thống không yêu cầu mật khẩu.</p><div className="notice notice--info"><strong>Lưu ý bảo mật</strong><p>Không chia sẻ mã CCCD, ảnh giấy tờ hoặc phiên đăng nhập cho người khác.</p></div></div>
        <form className="auth-card" onSubmit={submit}><h2>Xác thực thông tin</h2><p className="muted">Các trường có dấu * là bắt buộc.</p>
          <label className="field"><span>Số căn cước công dân *</span><input inputMode="numeric" autoComplete="username" value={cccd} onChange={(e) => setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Nhập 12 chữ số" required /><small>{cccd.length}/12 chữ số</small></label>
          <label className="field"><span>Ngày sinh *</span><input inputMode="numeric" value={dob} onChange={(e) => setDob(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="ddmmyyyy, ví dụ 18062010" required /><small>Nhập liền 8 chữ số theo dạng ngày-tháng-năm.</small></label>
          {error && <div className="notice notice--error" role="alert">{error}</div>}
          <button className="button button--primary button--block" disabled={loading || cccd.length !== 12 || dob.length !== 8}>{loading ? "Đang xác thực…" : "Truy cập hồ sơ"}</button>
          <p className="form-help">Không tìm thấy hồ sơ? Vui lòng liên hệ bộ phận tuyển sinh để đối chiếu CCCD.</p>
        </form>
      </div></main>
    </>
  );
}
