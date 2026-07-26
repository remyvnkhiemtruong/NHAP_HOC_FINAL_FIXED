"use client";
import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
const EXPORTS=[{type:"school-excel",title:"Danh sách toàn trường",desc:"File Excel tổng hợp dữ liệu các hồ sơ đã duyệt.",format:"XLSX"},{type:"bulk-student-pdf-zip",title:"Phiếu thông tin học sinh",desc:"Mỗi học sinh một PDF, đóng gói thành ZIP.",format:"ZIP"},{type:"photo-4x6-zip",title:"Toàn bộ ảnh 4×6",desc:"Tên ảnh theo số CCCD, chỉ lấy tệp hiện hành đã duyệt.",format:"ZIP"},{type:"cccd-zip",title:"Ảnh căn cước công dân",desc:"Mỗi học sinh một thư mục gồm mặt trước và mặt sau.",format:"ZIP"},{type:"scan-report-csv",title:"Báo cáo QR/OCR",desc:"Kết quả quét và trạng thái đối chiếu từng ảnh CCCD.",format:"CSV"},{type:"scan-report-pdf",title:"Báo cáo kiểm tra ảnh",desc:"Báo cáo PDF phục vụ lưu trữ và ký duyệt.",format:"PDF"}] as const;
type Job={id:string;type:string;status:string;progress:number;filename:string|null;createdAt:string;ready:boolean;hasErrorReport:boolean;official:boolean;officialEligible:boolean};
export default function ExportsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/jobs", { cache: "no-store" });
    const j = await r.json();
    if (r.ok) setJobs(j.items);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function create(type: string) {
    setBusy(type);
    setMessage(null);
    try {
      const r = await fetch(`/api/admin/exports/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Không thể tạo báo cáo.");
      setMessage({ tone: "success", text: "Đã tạo yêu cầu xuất dữ liệu. Tiến trình sẽ tự động cập nhật." });
      await load();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Không thể tạo báo cáo." });
    } finally {
      setBusy("");
    }
  }

  async function makeOfficial(jobId: string) {
    if (!confirm("Xác nhận tạo đợt xuất chính thức và chuyển các hồ sơ đã khóa sang Đã xuất?")) return;
    setBusy(jobId);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/export-batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifactJobIds: [jobId] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Không thể tạo đợt xuất chính thức.");
      setMessage({ tone: "success", text: "Đã tạo đợt xuất chính thức." });
      await load();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Không thể tạo đợt xuất chính thức." });
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container">
          <div className="page-title">
            <div>
              <span className="eyebrow">XUẤT DỮ LIỆU</span>
              <h1>Báo cáo và tệp bàn giao</h1>
              <p>Chỉ hồ sơ đã duyệt, khóa hoặc đã xuất mới được đưa vào báo cáo.</p>
            </div>
          </div>
          {message && (
            <div className={`notice notice--${message.tone} mb-20`}>
              {message.text}
            </div>
          )}

          <div className="export-grid">
            {EXPORTS.map((item) => (
              <article className="export-card" key={item.type}>
                <span className="export-card__format">{item.format}</span>
                <h2>{item.title}</h2>
                <p>{item.desc}</p>
                <button
                  className="button button--primary"
                  onClick={() => create(item.type)}
                  disabled={Boolean(busy)}
                >
                  {busy === item.type ? "Đang tạo yêu cầu…" : "Tạo tệp xuất"}
                </button>
              </article>
            ))}
          </div>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h2>Lịch sử xuất dữ liệu</h2>
                <p>Tự động cập nhật mỗi 5 giây.</p>
              </div>
              <button className="button button--secondary" onClick={load}>
                Làm mới
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Thời điểm</th>
                    <th>Trạng thái</th>
                    <th>Tiến độ</th>
                    <th>Tệp</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length ? (
                    jobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <strong>{job.type}</strong>
                        </td>
                        <td>{new Date(job.createdAt).toLocaleString("vi-VN")}</td>
                        <td>
                          <span className={`job-status job-status--${job.status.toLowerCase()}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>
                          <div className="job-progress"><progress max={100} value={job.progress} aria-label={`Tiến độ ${job.progress}%`} /></div>
                          <small>{job.progress}%</small>
                        </td>
                        <td>
                          {job.ready ? (
                            <>
                              <a className="table-link" href={`/api/admin/jobs/${job.id}/download`}>
                                Tải xuống ↓
                              </a>
                              {!job.official && job.officialEligible && (
                                <button className="button button--secondary" disabled={Boolean(busy)} onClick={() => makeOfficial(job.id)}>
                                  Xuất chính thức
                                </button>
                              )}
                              {!job.official && !job.officialEligible && (
                                <small>Khóa đủ hồ sơ và xuất lại nếu dữ liệu đã thay đổi.</small>
                              )}
                              {job.official && <span>Đã chính thức</span>}
                            </>
                          ) : job.status === "FAILED" && job.hasErrorReport ? (
                            <a className="table-link text-red" href={`/api/admin/jobs/${job.id}/download?report=1`}>
                              Xem lỗi
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-cell">Chưa có tác vụ xuất dữ liệu.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
