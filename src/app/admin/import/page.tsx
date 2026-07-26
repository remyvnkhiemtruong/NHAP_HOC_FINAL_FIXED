"use client";
import { ChangeEvent, useState } from "react";
import AppHeader from "@/components/AppHeader";
export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: string; text: string; summary?: Record<string, number> } | null>(null);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ fullName: "", cccd: "", dob: "", middleSchool: "" });
  const [manualBusy, setManualBusy] = useState(false);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/student/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualData)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể thêm học sinh.");
      setResult({ tone: "success", text: "Đã thêm học sinh thành công." });
      setManualData({ fullName: "", cccd: "", dob: "", middleSchool: "" });
      setShowManualForm(false);
    } catch (e) {
      setResult({ tone: "error", text: e instanceof Error ? e.message : "Lỗi không xác định." });
    } finally {
      setManualBusy(false);
    }
  }

  function choose(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/import", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Không thể nhập file.");
      setResult({ tone: "success", text: "Đã tiếp nhận file. Hệ thống đang kiểm tra trong tác vụ nền." });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/admin/import/jobs/${json.jobId}`, { cache: "no-store" });
        const statusJson = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusJson.error ?? "Không thể đọc trạng thái import.");
        if (statusJson.job.status === "FAILED") {
          throw new Error(statusJson.job.error?.message ?? "Import thất bại.");
        }
        if (statusJson.job.status === "COMPLETED") {
          setResult({
            tone: "success",
            text: "Đã nhập dữ liệu thành công.",
            summary: statusJson.job.result,
          });
          return;
        }
        setResult({ tone: "success", text: `Đang kiểm tra và nhập dữ liệu… ${statusJson.job.progress}%` });
      }
      throw new Error("Tác vụ vẫn đang xử lý. Vui lòng kiểm tra lại sau.");
    } catch (e) {
      setResult({ tone: "error", text: e instanceof Error ? e.message : "Không thể nhập file." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container container--narrow">
          <div className="page-title">
            <div>
              <span className="eyebrow">NHẬP DỮ LIỆU</span>
              <h1>Danh sách học sinh trúng tuyển</h1>
              <p>Tải file Excel .xlsx theo đúng mẫu. Hệ thống sẽ kiểm tra từng dòng trước khi cập nhật.</p>
            </div>
          </div>

          <section className="panel import-panel">
            <div className="dropzone">
              <span className="dropzone__icon">XLSX</span>
              <h2>Chọn file danh sách</h2>
              <p>Kích thước tối đa 20 MB. Không đóng file bằng mật khẩu hoặc chứa macro.</p>
              <label className="button button--secondary">
                Chọn file Excel
                <input
                  type="file"
                  className="input-file-hidden"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={choose}
                />
              </label>

              {file && (
                <div className="selected-file">
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>

            {result && (
              <div className={`notice notice--${result.tone} notice--result`}>
                {result.text}
                {result.summary && (
                  <div className="import-summary">
                    <span>Tổng: <b>{result.summary.totalRows}</b></span>
                    <span>Hợp lệ: <b className="text-green">{result.summary.validRows}</b></span>
                    <span>Cảnh báo: <b className="text-gold">{result.summary.warningRows}</b></span>
                    <span>Lỗi: <b className="text-red">{result.summary.errorRows}</b></span>
                  </div>
                )}
              </div>
            )}

            <div className="panel-actions">
              <button
                className="button button--primary button--full"
                disabled={!file || busy}
                onClick={upload}
              >
                {busy ? "Đang kiểm tra và nhập…" : "Kiểm tra và nhập dữ liệu"}
              </button>
            </div>
            
            <div className="panel-actions panel-actions--manual">
              <button className="button button--secondary" onClick={() => setShowManualForm(!showManualForm)}>
                {showManualForm ? "Đóng form thêm thủ công" : "+ Thêm học sinh thủ công"}
              </button>
            </div>
          </section>

          {showManualForm && (
            <section className="panel manual-panel mt-24">
              <h2>Thêm học sinh thủ công</h2>
              <form onSubmit={submitManual} className="manual-form">
                <div>
                  <label className="field-label">Họ và tên *</label>
                  <input className="field-input" required value={manualData.fullName} onChange={(e) => setManualData({ ...manualData, fullName: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">CCCD (12 số) *</label>
                  <input className="field-input" required pattern="\d{12}" value={manualData.cccd} onChange={(e) => setManualData({ ...manualData, cccd: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Ngày sinh (VD: 01/01/2010) *</label>
                  <input className="field-input" required value={manualData.dob} onChange={(e) => setManualData({ ...manualData, dob: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Trường THCS (Tùy chọn)</label>
                  <input className="field-input" value={manualData.middleSchool} onChange={(e) => setManualData({ ...manualData, middleSchool: e.target.value })} />
                </div>
                <button type="submit" className="button button--primary" disabled={manualBusy}>
                  {manualBusy ? "Đang lưu..." : "Lưu học sinh"}
                </button>
              </form>
            </section>
          )}

          <section className="panel guide-panel mt-24">
            <h2>Yêu cầu đối với file</h2>
            <div className="check-grid">
              <p><span className="ok-text">✓</span> Giữ nguyên tên và thứ tự cột trong file mẫu.</p>
              <p><span className="ok-text">✓</span> CCCD phải là chuỗi 12 chữ số, không dùng dạng số mũ.</p>
              <p><span className="ok-text">✓</span> Ngày sinh phải theo định dạng được quy định.</p>
              <p><span className="ok-text">✓</span> Mỗi học sinh chỉ xuất hiện một lần trong một đợt nhập.</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
