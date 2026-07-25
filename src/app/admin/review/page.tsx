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
          <section style={{background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9'}}>
            <div className="review-toolbar" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px'}}>
              <div className="tabs" style={{display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                {[["pending", "Chờ xử lý"], ["changes", "Có thay đổi"], ["missing-files", "Thiếu ảnh"], ["approved", "Đã duyệt"], ["all", "Tất cả"]].map(([value, label]) => (
                  <button key={value} style={{background: view === value ? '#ffffff' : 'transparent', color: view === value ? '#0f172a' : '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: view === value ? 600 : 500, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: view === value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}} onClick={() => setView(value)}>{label}</button>
                ))}
              </div>
              <form className="search-box" onSubmit={submit} style={{display: 'flex', gap: '8px'}}>
                <div style={{position: 'relative', width: '300px'}}>
                  <span style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5}}>🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo họ tên hoặc CCCD..." style={{width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', transition: 'border-color 0.2s'}} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
                </div>
                <button style={{background: '#0f172a', color: '#ffffff', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s'}} onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}>Tìm kiếm</button>
              </form>
            </div>
            {error && <div className="notice notice--error" style={{marginBottom: '20px'}}>{error}</div>}
            <div className="table-wrap" style={{border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
                <thead>
                  <tr>
                    <th style={{background: '#f8fafc', padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '2px solid #e2e8f0'}}>Học sinh</th>
                    <th style={{background: '#f8fafc', padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '2px solid #e2e8f0'}}>Trường THCS</th>
                    <th style={{background: '#f8fafc', padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '2px solid #e2e8f0'}}>Địa bàn</th>
                    <th style={{background: '#f8fafc', padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '2px solid #e2e8f0'}}>Trạng thái</th>
                    <th style={{background: '#f8fafc', padding: '16px', color: '#475569', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '2px solid #e2e8f0'}}>Cảnh báo</th>
                    <th style={{background: '#f8fafc', padding: '16px', borderBottom: '2px solid #e2e8f0'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} style={{padding: '40px', textAlign: 'center', color: '#64748b'}}>Đang tải dữ liệu…</td></tr> : items.length ? items.map(item => (
                    <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s'}} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{padding: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <div style={{width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '16px', border: '1px solid #bfdbfe'}}>
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <strong style={{display: 'block', fontSize: '15px', color: '#0f172a', fontWeight: 600}}>{item.name}</strong>
                            <small style={{color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px'}}>
                              <span style={{display: 'inline-block', width: '14px', height: '14px', background: '#e2e8f0', borderRadius: '3px', textAlign: 'center', lineHeight: '14px', fontSize: '10px', fontWeight: 'bold'}}>#</span>
                              {item.cccd || "Chưa cập nhật"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td style={{padding: '16px', color: '#334155', fontSize: '14px', fontWeight: 500}}>{item.school}</td>
                      <td style={{padding: '16px', color: '#475569', fontSize: '14px'}}>{item.commune}</td>
                      <td style={{padding: '16px'}}><StatusBadge status={item.status} /></td>
                      <td style={{padding: '16px'}}>
                        <div className="warning-list" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                          {item.warnings.length ? item.warnings.map(w => <span key={w} style={{fontSize: '12px', color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '180px', display: 'inline-block'}} title={w}>⚠️ {w}</span>) : <span style={{fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px'}}>✓ Tốt</span>}
                        </div>
                      </td>
                      <td style={{padding: '16px', textAlign: 'right'}}>
                        <Link style={{display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'}} href={`/admin/review/${item.id}`} onMouseEnter={e => {e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'translateY(-1px)'}} onMouseLeave={e => {e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.transform = 'translateY(0)'}}>
                          Mở hồ sơ
                        </Link>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} style={{padding: '40px', textAlign: 'center', color: '#64748b'}}>Không có hồ sơ phù hợp.</td></tr>}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <button style={{background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, color: page <= 1 ? '#94a3b8' : '#334155', cursor: page <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s'}} disabled={page <= 1} onClick={() => setPage(p => p - 1)} onMouseEnter={e => {if(page > 1) e.currentTarget.style.background = '#f1f5f9'}} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>← Trang trước</button>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', background: '#e2e8f0', padding: '4px 12px', borderRadius: '16px' }}>Trang {page} / {totalPages}</span>
                  <button style={{background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, color: page >= totalPages ? '#94a3b8' : '#334155', cursor: page >= totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.2s'}} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} onMouseEnter={e => {if(page < totalPages) e.currentTarget.style.background = '#f1f5f9'}} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>Trang sau →</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
