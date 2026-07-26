"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

type Summary = { totalImported: number; reviewed: number; pending: number; countByStatus: Record<string, number> };
type Student = { id: string; name: string; cccd: string | null; status: string; school: string; warnings: string[] };
export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null); const [items, setItems] = useState<Student[]>([]); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/review?view=pending&pageSize=10").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setSummary(j.summary); setItems(j.items); }).catch((e) => setError(e.message)); }, []);
  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container">
          <div className="page-title">
            <div>
              <span className="eyebrow">TỔNG QUAN VẬN HÀNH</span>
              <h1>Bảng điều khiển nhập học</h1>
              <p>Theo dõi nhanh tiến độ tiếp nhận và xử lý hồ sơ.</p>
            </div>
            <Link href="/admin/import" className="button button--primary">
              + Nhập danh sách trúng tuyển
            </Link>
          </div>
          {error && <div className="notice notice--error">{error}</div>}

          <div className="stat-grid">
            <article>
              <span>Tổng hồ sơ</span>
              <strong>{summary?.totalImported ?? "—"}</strong>
              <small>đã nhập vào hệ thống</small>
            </article>
            <article>
              <span className="text-gold">Chờ xử lý</span>
              <strong>{summary?.pending ?? "—"}</strong>
              <small>cần quản trị kiểm tra</small>
            </article>
            <article>
              <span className="text-green">Đã duyệt</span>
              <strong>{summary?.reviewed ?? "—"}</strong>
              <small>đủ điều kiện hoàn tất</small>
            </article>
            <article>
              <span className="text-red">Cần bổ sung</span>
              <strong>{summary?.countByStatus?.NEED_REVISION ?? "—"}</strong>
              <small>đã trả về học sinh</small>
            </article>
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <h2>Hồ sơ cần ưu tiên</h2>
                  <p>Danh sách mới gửi hoặc có cảnh báo.</p>
                </div>
                <Link href="/admin/review" className="table-link">Xem tất cả →</Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Học sinh</th>
                      <th>Trường THCS</th>
                      <th>Trạng thái</th>
                      <th>Cảnh báo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <strong>{student.name}</strong>
                            <small>{student.cccd ? `CCCD: ${student.cccd}` : "Chưa có CCCD"}</small>
                          </td>
                          <td>{student.school}</td>
                          <td>
                            <StatusBadge status={student.status} />
                          </td>
                          <td>
                            {student.warnings[0] ? (
                              <div className="warning-list"><span>⚠️ {student.warnings[0]}</span></div>
                            ) : (
                              <span className="ok-text">✓ Tốt</span>
                            )}
                          </td>
                          <td className="text-right">
                            <Link className="table-link" href={`/admin/review/${student.id}`}>
                              Duyệt
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-cell">Chưa có hồ sơ cần xử lý.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="panel">
              <div className="panel__head">
                <h2>Tác vụ nhanh</h2>
              </div>
              <div className="quick-actions">
                <Link href="/admin/import">
                  <b>01</b>
                  <span>
                    <strong>Nhập Excel</strong>
                    <small>Thêm hoặc cập nhật danh sách</small>
                  </span>
                </Link>
                <Link href="/admin/review">
                  <b>02</b>
                  <span>
                    <strong>Duyệt hồ sơ</strong>
                    <small>Đối chiếu thông tin và hình ảnh</small>
                  </span>
                </Link>
                <Link href="/admin/exports">
                  <b>03</b>
                  <span>
                    <strong>Xuất dữ liệu</strong>
                    <small>Tạo Excel, PDF hoặc ZIP ảnh</small>
                  </span>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
