"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import {
  ADMIN_REVIEW_STEPS as STEPS,
  AUDIT_ACTION_LABELS as ACTION_LABELS,
  AUDIT_ACTOR_LABELS as ACTOR_LABELS,
  FIELD_LABELS as LABELS,
  FILE_LABELS,
} from "@/lib/admin/labels";

type Diff = { id: string; field_code: string; source_value: string | null; proposed_value: string | null; updated_at: string };
type ProfileValue = { id: string; field_code: string; source_value: string | null; proposed_value: string | null; updated_at: string; change_status?: string };
type FileItem = { id: string; category: string; status: string; current_version: number; original_name: string; width: number | null; height: number | null };
type Payload = { student: { id: string; name: string; current_cccd: string | null; current_dob: string; status: string }; admission_record: Record<string, unknown>; diffs: Diff[]; profile_values: ProfileValue[]; files: FileItem[]; auditLogs: { id: string; action: string; reason: string | null; created_at: string; actor_type: string }[] };

export default function ReviewDetailPage(){
  const params=useParams<{id:string}>();
  const router=useRouter();
  const[data,setData]=useState<Payload|null>(null);
  const[decisions,setDecisions]=useState<Record<string,{action:"ACCEPT"|"REJECT"}>>({});
  const[busy,setBusy]=useState(false);
  const[isSelectingRevision,setIsSelectingRevision]=useState(false);
  const[editingField,setEditingField]=useState<{id:string;field_code:string;value:string;expectedUpdatedAt:string}|null>(null);
  const[message,setMessage]=useState<{tone:string;text:string}|null>(null);

  const load=useCallback(async()=>{
    const r=await fetch(`/api/admin/review/${params.id}`,{cache:"no-store"});
    const j=await r.json();
    if(!r.ok)throw new Error(j.error??"Không thể tải hồ sơ.");
    setData(j);
  },[params.id]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>{void load().catch(e=>setMessage({tone:"error",text:e.message}))},0);
    return()=>window.clearTimeout(timer);
  },[load]);

  const currentFiles=useMemo(()=>{
    const map=new Map<string,FileItem>();
    for(const f of data?.files??[]){
      const old=map.get(f.category);
      if(!old||old.current_version<f.current_version)map.set(f.category,f);
    }
    return [...map.values()];
  },[data]);

  const groupedFields = useMemo(() => {
    if (!data) return [];
    const groups: Array<{ title: string; values: ProfileValue[] }> = STEPS.map(step => {
      let values = step.fields.map(f => data.profile_values.find(v => v.field_code === f)).filter(Boolean) as ProfileValue[];
      values = values.filter(v => {
        if (v.field_code === 'AE' && (!v.proposed_value || v.proposed_value.trim() === '')) return false;
        return true;
      });
      return { title: step.title, values };
    }).filter(g => g.values.length > 0);
    const covered = new Set<string>(STEPS.flatMap(step => [...step.fields]));
    const remaining = data.profile_values.filter(
      value => !covered.has(value.field_code) &&
        !(value.field_code === "AE" && !value.proposed_value?.trim()),
    );
    if (remaining.length) groups.push({ title: "Thông tin khác", values: remaining });
    return groups;
  }, [data]);

  function decide(val:ProfileValue,action:"ACCEPT"|"REJECT"){
    if(action==="ACCEPT"){
      setDecisions(old=>{const copy={...old};delete copy[val.id];return copy});
    }else{
      setDecisions(old=>({...old,[val.id]:{action}}));
    }
  }

  async function post(url:string,body:unknown){
    setBusy(true);setMessage(null);
    try{
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error??"Không thể thực hiện thao tác.");
      setMessage({tone:"success",text:"Đã cập nhật hồ sơ thành công."});
      await load();
      return true;
    }catch(e){
      setMessage({tone:"error",text:e instanceof Error?e.message:"Không thể thực hiện thao tác."});
      return false;
    }finally{
      setBusy(false);
    }
  }

  async function saveFieldEdit(){
    if(!editingField)return;
    const ok = await post(`/api/admin/review/${params.id}/approve`,{
      items:[{
        id:editingField.id,
        action:"EDIT",
        expectedUpdatedAt:editingField.expectedUpdatedAt,
        new_value:editingField.value,
      }],
    });
    if(ok){
      setEditingField(null);
    }
  }

  async function saveReview(completeReview:boolean){
    if(completeReview&&!confirm("Bạn xác nhận phê duyệt toàn bộ thông tin hợp lệ?"))return;
    const items=data!.profile_values
      .filter(val=>val.change_status==="PROPOSED")
      .map(val=>({id:val.id,action:"ACCEPT",expectedUpdatedAt:val.updated_at}));
    const decisionsSaved=items.length===0||await post(`/api/admin/review/${params.id}/approve`,{items});
    if(!decisionsSaved)return;
    const completed=!completeReview||await post(`/api/admin/review/${params.id}/complete`,{});
    if(completed){setDecisions({});setIsSelectingRevision(false);if(completeReview)router.refresh()}
  }

  async function requestRevision(){
    const errorFields=data!.profile_values.filter(v=>decisions[v.id]?.action==="REJECT").map(v=>LABELS[v.field_code]??v.field_code);
    const errorFiles=currentFiles.filter(file=>decisions[file.id]?.action==="REJECT").map(file=>FILE_LABELS[file.category]??file.category);
    const targets=[...errorFields,...errorFiles];
    const prefix=targets.length>0?`Cần sửa lại: ${targets.join(", ")}. `:"";
    const reason=prompt("Nhập lý do học sinh cần sửa (tối thiểu 10 ký tự):",prefix);
    if(reason){
      const profileItems=data!.profile_values
        .filter(v=>decisions[v.id]?.action==="REJECT")
        .map(v=>({profileValueId:v.id,reason}));
      const fileItems=currentFiles
        .filter(file=>decisions[file.id]?.action==="REJECT")
        .map(file=>({fileId:file.id,reason}));
      const items=[...profileItems,...fileItems];
      const ok = await post(`/api/admin/review/${params.id}/request-revision`,{reason,items});
      if(ok) {
         setDecisions({});
         setIsSelectingRevision(false);
      }
    }
  }

  async function fileDecision(file:FileItem,decision:"APPROVE"|"REJECT"){
    if(decision==="REJECT"){
      setIsSelectingRevision(true);
      setDecisions(current => {
        const next={...current};
        if(next[file.id]?.action==="REJECT") delete next[file.id];
        else next[file.id]={action:"REJECT"};
        return next;
      });
      return;
    }
    await post(`/api/admin/review/${params.id}/files/${file.id}/decision`,{decision});
  }

  async function toggleLock() {
    if(!data) return;
    const isLocked = data.student.status === "LOCKED";
    if(!isLocked && !confirm("Bạn có chắc chắn muốn khóa hồ sơ này? Học sinh sẽ không thể sửa lại hồ sơ.")) return;
    const ok = await post(`/api/admin/review/${params.id}/lock`, {lock:!isLocked});
    if(ok) {
      router.refresh();
      await load();
    }
  }

  if(!data) return <div className="loading-page"><div className="spinner"></div></div>;

  return (
    <>
      <AppHeader mode="admin" />
      <main className="admin-main">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/admin/review">Duyệt hồ sơ</Link>
            <span>/</span>
            <strong>{data.student.name}</strong>
          </div>
          
          <div className="page-title review-title">
            <div>
              <span className="eyebrow">HỒ SƠ HỌC SINH</span>
              <h1>{data.student.name}</h1>
              <p>CCCD: {data.student.current_cccd ?? "Chưa cập nhật"} · Ngày sinh: {data.student.current_dob}</p>
            </div>
            <div className="title-actions">
              <StatusBadge status={data.student.status} />
              {["APPROVED", "LOCKED"].includes(data.student.status) && (
                <button className="button button--secondary" onClick={toggleLock} disabled={busy}>
                  {data.student.status === "LOCKED" ? "Mở khóa" : "Khóa hồ sơ"}
                </button>
              )}
            </div>
          </div>
          
          {message && <div className={`notice notice--${message.tone}`}>{message.text}</div>}

          <div className="review-layout">
            <div className="review-content">
              <section className="panel panel--review">
                <div className="panel__head">
                  <div>
                    <h2>Hồ sơ học sinh</h2>
                    <p>Toàn bộ thông tin được tổ chức theo nhóm.</p>
                  </div>
                </div>
                
                {groupedFields.length ? groupedFields.map(group => (
                  <div key={group.title} className="review-group">
                    <h3>
                      <span className="review-group__marker"></span>
                      {group.title}
                    </h3>
                    <div className="review-grid">
                      {group.values.map(val => {
                        const decision = decisions[val.id];
                        const hasChanged = val.source_value !== val.proposed_value;
                        const isRejected = decision?.action === 'REJECT';
                        
                        return (
                          <article key={val.id} className={`review-card ${isRejected ? 'review-card--rejected' : ''}`}>
                            <div className="review-card__head">
                              <strong>
                                {LABELS[val.field_code] ?? val.field_code}
                                {!isSelectingRevision &&
                                  val.change_status !== "PREVIEW" &&
                                  ["SUBMITTED", "RESUBMITTED"].includes(data.student.status) &&
                                  editingField?.id !== val.id && (
                                  <button className="edit-btn" onClick={() => setEditingField({ id:val.id, field_code: val.field_code, value: val.proposed_value || '', expectedUpdatedAt:val.updated_at })} title="Sửa thông tin" disabled={busy}>✏️</button>
                                )}
                              </strong>
                              {isSelectingRevision && hasChanged && <span className="review-badge review-badge--changed">Đã sửa</span>}
                              {val.change_status === 'PREVIEW' && <span className="review-badge review-badge--system">Dữ liệu hệ thống</span>}
                            </div>
                            
                            {editingField?.id === val.id ? (
                              <div className="review-edit-form">
                                <input 
                                  type="text" 
                                  value={editingField.value} 
                                  onChange={e => setEditingField({ ...editingField, value: e.target.value })} 
                                  autoFocus 
                                  onKeyDown={e => e.key === 'Enter' && saveFieldEdit()} 
                                />
                                <div className="review-edit-actions">
                                  <button className="button button--primary button--small" onClick={saveFieldEdit} disabled={busy}>Lưu</button>
                                  <button className="button button--secondary button--small" onClick={() => setEditingField(null)} disabled={busy}>Hủy</button>
                                </div>
                              </div>
                            ) : (
                              <p className="review-card__value">
                                {val.proposed_value ? val.proposed_value.replace(/\s*\(\d+\)\s*$/, '').trim() : <span className="empty-text">(Trống)</span>}
                              </p>
                            )}
                            
                            {isSelectingRevision && (
                              <div className="review-reject-check">
                                <label>
                                  <input 
                                    type="checkbox" 
                                    checked={decision?.action === "REJECT"} 
                                    onChange={(e) => decide(val, e.target.checked ? "REJECT" : "ACCEPT")} 
                                  />
                                  Yêu cầu học sinh sửa lại
                                </label>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )) : <div className="empty-state"><strong>Chưa có thông tin</strong></div>}
              </section>

              <section className="panel">
                <div className="panel__head">
                  <div>
                    <h2>Hình ảnh hồ sơ</h2>
                    <p>Chỉ duyệt phiên bản mới nhất của từng loại ảnh.</p>
                  </div>
                </div>
                <div className="admin-files">
                  {currentFiles.map(file => (
                    <article key={file.id}>
                      <div className="admin-file__image">
                        <Image src={`/api/student/files/${file.id}`} alt={FILE_LABELS[file.category] ?? file.category} width={500} height={340} unoptimized />
                      </div>
                      <div className="admin-file__body">
                        <div>
                          <h3>{FILE_LABELS[file.category] ?? file.category}</h3>
                          <StatusBadge status={file.status} />
                        </div>
                        <p>Phiên bản {file.current_version} · {file.width ?? "?"}×{file.height ?? "?"} px</p>
                        <div>
                          <button className="button button--success button--small" onClick={() => fileDecision(file, "APPROVE")} disabled={busy || isSelectingRevision}>Duyệt ảnh</button>
                          <button className="button button--danger button--small" onClick={() => fileDecision(file, "REJECT")} disabled={busy}>
                            {decisions[file.id]?.action === "REJECT" ? "Bỏ đánh dấu" : "Yêu cầu tải lại"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              
              <section className="panel">
                <div className="panel__head">
                  <div>
                    <h2>Nhật ký xử lý</h2>
                    <p>Các thao tác gần nhất liên quan đến hồ sơ.</p>
                  </div>
                </div>
                <div className="timeline">
                  {data.auditLogs.slice(0, 20).map(log => (
                    <div key={log.id}>
                      <b></b>
                      <span>
                        <strong>{ACTION_LABELS[log.action] ?? log.action}</strong>
                        <small>{new Date(log.created_at).toLocaleString("vi-VN")} · {ACTOR_LABELS[log.actor_type] ?? log.actor_type}</small>
                        {log.reason && <p>{log.reason}</p>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <aside className="review-sidebar">
              <section className="panel sticky-panel">
                <h2>Quyết định hồ sơ</h2>
                <p className="muted">Kiểm tra thông tin và ảnh trước khi phê duyệt.</p>
                {isSelectingRevision ? (
                  <>
                    <div className="decision-summary">
                      <span>Thông tin đánh dấu sai</span>
                      <strong>{Object.values(decisions).filter(d => d.action === "REJECT").length}</strong>
                    </div>
                    <button className="button button--danger button--block" disabled={busy || !Object.values(decisions).some(d => d.action === "REJECT")} onClick={requestRevision}>Xác nhận gửi yêu cầu bổ sung</button>
                    <button className="button button--secondary button--block" disabled={busy} onClick={() => { setIsSelectingRevision(false); setDecisions({}); }}>Hủy bỏ</button>
                  </>
                ) : (
                  <>
                    <button className="button button--primary button--block" disabled={busy || !["SUBMITTED", "RESUBMITTED"].includes(data.student.status)} onClick={() => saveReview(true)}>Phê duyệt hồ sơ</button>
                    <button className="button button--danger-outline button--block" disabled={busy || !["SUBMITTED", "RESUBMITTED", "APPROVED"].includes(data.student.status)} onClick={() => setIsSelectingRevision(true)}>Yêu cầu bổ sung</button>
                    <div className="review-note">
                      <strong>Điều kiện phê duyệt</strong>
                      <span>✓ Đủ 3 ảnh bắt buộc hợp lệ</span>
                      <span>✓ Hồ sơ đang chờ duyệt</span>
                    </div>
                  </>
                )}
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
