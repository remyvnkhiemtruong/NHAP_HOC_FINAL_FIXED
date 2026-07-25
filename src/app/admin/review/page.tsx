"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

type Item = { id: string; name: string; cccd: string | null; status: string; school: string; commune: string; ethnicity: string; warnings: string[] };

export default function ReviewListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // When view or query changes, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [view, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/review?view=${encodeURIComponent(view)}&search=${encodeURIComponent(query)}&pageSize=50&page=${page}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setItems(j.items);
      setTotalPages(j.pagination?.totalPages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách.");
    } finally {
      setLoading(false);
    }
  }, [view, query, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setQuery(search.trim());
  }

  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container">
          <div className="page-title">
            <div>
              <span className="eyebrow">DUYỆT HỒ SƠ</span>
              <h1>Danh sách học sinh</h1>
              <p>Lọc, tìm kiếm và mở từng hồ sơ để đối chiếu.</p>
            </div>
          </div>
          <section className="panel">
            <div className="review-toolbar">
              <div className="tabs">
                {[["pending", "Chờ xử lý"], ["changes", "Có thay đổi"], ["missing-files", "Thiếu ảnh"], ["approved", "Đã duyệt"], ["all", "Tất cả"]].map(([value, label]) => (
                  <button 
                    key={value} 
                    className={`button ${view === value ? 'button--primary' : 'button--secondary'}`}
                    style={{ padding: '8px 16px' }}
                    onClick={() => setView(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form className="search-box" onSubmit={submit}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                  <input 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    placeholder="Tìm theo họ tên hoặc CCCD..." 
                  />
                </div>
                <button className="button button--primary">Tìm kiếm</button>
              </form>
            </div>
            {error && <div className="notice notice--error" style={{marginBottom: '20px'}}>{error}</div>}
            
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Trường THCS</th>
                    <th>Địa bàn</th>
                    <th>Trạng thái</th>
                    <th>Cảnh báo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="empty-cell">Đang tải dữ liệu…</td></tr> : items.length ? items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--sky)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '16px'}}>
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              <span style={{display: 'inline-block', width: '14px', height: '14px', background: 'var(--line)', borderRadius: '3px', textAlign: 'center', lineHeight: '14px', fontSize: '10px', fontWeight: 'bold'}}>#</span>
                              {item.cccd || "Chưa cập nhật"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{item.school}</td>
                      <td>{item.commune}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>
                        <div className="warning-list">
                          {item.warnings.length ? item.warnings.map(w => <span key={w} title={w}>⚠️ {w}</span>) : <span className="ok-text">✓ Tốt</span>}
                        </div>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <Link className="button button--primary" style={{ padding: '8px 16px', fontSize: '14px' }} href={`/admin/review/${item.id}`}>
                          Mở hồ sơ
                        </Link>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className="empty-cell">Không có hồ sơ phù hợp.</td></tr>}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="button button--secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trang trước</button>
                  <span>Trang {page} / {totalPages}</span>
                  <button className="button button--secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Trang sau →</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
