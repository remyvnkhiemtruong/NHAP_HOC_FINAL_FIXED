"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";

type Campaign = {
  id: string;
  code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  school_year_start: number;
  school_year_end: number;
  admission_date: string;
  school_name: string;
  school_code: string;
  template_version: string;
  _count: { students: number; import_batches: number; export_batches: number };
};

const initialForm = {
  code: "",
  name: "",
  schoolYearStart: new Date().getFullYear(),
  admissionDate: "",
  schoolName: "",
  schoolCode: "",
  templateVersion: "v1",
  fourYearAverageMax: 40,
  fourYearConductMax: 40,
  priorityScoreMax: 2,
  encouragementScoreMax: 2,
  precision: 2,
};

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string }>();

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/campaigns", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Không thể tải danh sách đợt nhập học.");
    setItems(payload.items);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/campaigns", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Không thể tải danh sách đợt nhập học.");
        setItems(payload.items);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage({ error: true, text: error instanceof Error ? error.message : "Không thể tải dữ liệu." });
      });
    return () => controller.abort();
  }, []);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    try {
      const rule = (max: number) => ({ min: 0, max, precision: form.precision });
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          schoolYearStart: form.schoolYearStart,
          schoolYearEnd: form.schoolYearStart + 1,
          admissionDate: new Date(`${form.admissionDate}T00:00:00+07:00`).toISOString(),
          schoolName: form.schoolName,
          schoolCode: form.schoolCode,
          templateVersion: form.templateVersion,
          scoreRules: {
            fourYearAverage: rule(form.fourYearAverageMax),
            fourYearConduct: rule(form.fourYearConductMax),
            priorityScore: rule(form.priorityScoreMax),
            encouragementScore: rule(form.encouragementScoreMax),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể tạo đợt nhập học.");
      setForm(initialForm);
      setMessage({ text: "Đã tạo đợt nhập học ở trạng thái nháp." });
      await load();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Không thể tạo đợt nhập học." });
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    if (!confirm("Kích hoạt đợt này? Đợt đang hoạt động sẽ được đóng.")) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/admin/campaigns/${id}/activate`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Không thể kích hoạt đợt nhập học.");
      setMessage({ text: "Đã kích hoạt đợt nhập học." });
      await load();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Không thể kích hoạt đợt nhập học." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container">
          <div className="page-title">
            <div>
              <span className="eyebrow">CẤU HÌNH THEO NĂM HỌC</span>
              <h1>Đợt nhập học</h1>
              <p>Quản lý năm học, ngày nhập học, phiên bản biểu mẫu và quy tắc điểm.</p>
            </div>
          </div>

          {message && (
            <div className={`notice ${message.error ? "notice--error" : "notice--success"}`}>
              {message.text}
            </div>
          )}

          <div className="campaign-layout">
            <section className="panel campaign-list">
              <div className="panel__head">
                <div>
                  <h2>Các đợt đã tạo</h2>
                  <p>Chỉ một đợt được hoạt động tại một thời điểm.</p>
                </div>
              </div>
              <div className="campaign-cards">
                {items.map((campaign) => (
                  <article className={`campaign-card campaign-card--${campaign.status.toLowerCase()}`} key={campaign.id}>
                    <div className="campaign-card__head">
                      <div>
                        <strong>{campaign.name}</strong>
                        <small>{campaign.code} · {campaign.school_year_start}–{campaign.school_year_end}</small>
                      </div>
                      <span className="campaign-status">{campaign.status === "ACTIVE" ? "Đang hoạt động" : campaign.status === "DRAFT" ? "Bản nháp" : "Đã đóng"}</span>
                    </div>
                    <p>{campaign.school_name} · Ngày nhập học {new Date(campaign.admission_date).toLocaleDateString("vi-VN")}</p>
                    <div className="campaign-metrics">
                      <span><b>{campaign._count.students}</b> học sinh</span>
                      <span><b>{campaign._count.import_batches}</b> lần nhập</span>
                      <span><b>{campaign._count.export_batches}</b> đợt xuất</span>
                    </div>
                    {campaign.status !== "ACTIVE" && (
                      <button className="button button--secondary button--small" disabled={busy} onClick={() => activate(campaign.id)}>
                        Kích hoạt
                      </button>
                    )}
                  </article>
                ))}
                {!items.length && <div className="empty-state">Chưa có đợt nhập học.</div>}
              </div>
            </section>

            <section className="panel campaign-form">
              <div className="panel__head">
                <div>
                  <h2>Tạo đợt mới</h2>
                  <p>Đợt mới được lưu ở trạng thái nháp.</p>
                </div>
              </div>
              <form onSubmit={createCampaign}>
                <div className="form-grid">
                  <label className="field">
                    <span>Mã đợt</span>
                    <input required maxLength={50} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={`${form.schoolYearStart}-${form.schoolYearStart + 1}`} />
                  </label>
                  <label className="field">
                    <span>Năm học bắt đầu</span>
                    <input required type="number" min={2020} max={2100} value={form.schoolYearStart} onChange={(e) => setForm({ ...form, schoolYearStart: Number(e.target.value) })} />
                  </label>
                  <label className="field field--wide">
                    <span>Tên đợt</span>
                    <input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`Tuyển sinh lớp 10 năm học ${form.schoolYearStart}–${form.schoolYearStart + 1}`} />
                  </label>
                  <label className="field field--wide">
                    <span>Tên trường</span>
                    <input required maxLength={200} value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Mã trường</span>
                    <input required maxLength={50} value={form.schoolCode} onChange={(e) => setForm({ ...form, schoolCode: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Ngày nhập học</span>
                    <input required type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Phiên bản biểu mẫu</span>
                    <input required maxLength={100} value={form.templateVersion} onChange={(e) => setForm({ ...form, templateVersion: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Độ chính xác điểm</span>
                    <input required type="number" min={0} max={3} value={form.precision} onChange={(e) => setForm({ ...form, precision: Number(e.target.value) })} />
                  </label>
                  {([
                    ["fourYearAverageMax", "Tối đa điểm J"],
                    ["fourYearConductMax", "Tối đa điểm K"],
                    ["priorityScoreMax", "Tối đa điểm L"],
                    ["encouragementScoreMax", "Tối đa điểm M"],
                  ] as const).map(([key, label]) => (
                    <label className="field" key={key}>
                      <span>{label}</span>
                      <input required type="number" min={0.001} step="0.001" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
                    </label>
                  ))}
                </div>
                <button className="button button--primary button--block" disabled={busy}>
                  {busy ? "Đang lưu…" : "Tạo đợt nhập học"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
