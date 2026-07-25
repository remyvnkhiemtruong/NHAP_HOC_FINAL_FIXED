"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

type Diff = { id: string; field_code: string; source_value: string | null; proposed_value: string | null; updated_at: string };
type ProfileValue = { id: string; field_code: string; source_value: string | null; proposed_value: string | null; updated_at: string; change_status?: string };
type FileItem = { id: string; category: string; status: string; current_version: number; original_name: string; width: number | null; height: number | null };
type Payload = { student: { id: string; name: string; current_cccd: string | null; current_dob: string; status: string }; admission_record: Record<string, unknown>; diffs: Diff[]; profile_values: ProfileValue[]; files: FileItem[]; auditLogs: { id: string; action: string; reason: string | null; created_at: string; actor_type: string }[] };

const LABELS: Record<string,string>={
  C:"Họ và tên",F:"Ngày sinh",G:"Giới tính",W:"Dân tộc",BF:"Số CCCD",BG:"Ngày cấp CCCD",BH:"Nơi cấp CCCD",
  CG:"Tỉnh/thành nơi sinh",CH:"Xã/phường nơi sinh",BY:"Dân tộc (giấy khai sinh)",X:"Tôn giáo",
  L:"Tỉnh thường trú",N:"Xã/phường thường trú",O:"Địa chỉ chi tiết",U:"Chỗ ở hiện nay",
  V:"Ngày vào Đội",BL:"Ngày vào Đoàn",Y:"Đối tượng chính sách",Z:"Chế độ chính sách",BJ:"Diện ưu tiên",
  AE:"Loại khuyết tật",AJ:"Biết bơi",BD:"Loại tốt nghiệp THCS",
  AF:"Điện thoại học sinh",BI:"Email học sinh",
  AK:"Họ tên cha",AL:"Năm sinh cha",AM:"Nghề nghiệp cha",AN:"Điện thoại cha",AO:"Email cha",AP:"Số CCCD cha",
  AQ:"Họ tên mẹ",AR:"Năm sinh mẹ",AS:"Nghề nghiệp mẹ",AT:"Điện thoại mẹ",AU:"Email mẹ",AV:"Số CCCD mẹ",
  AW:"Người bảo hộ",AX:"Năm sinh bảo hộ",AY:"Nghề nghiệp bảo hộ",AZ:"Điện thoại bảo hộ",BA:"Email bảo hộ",BB:"Số CCCD bảo hộ",
  ADMISSION_H:"Trường THCS",ADMISSION_I:"Địa bàn trường THCS",ADMISSION_J:"Điểm TB 4 năm",ADMISSION_K:"Điểm hạnh kiểm",ADMISSION_L:"Điểm ưu tiên",ADMISSION_M:"Điểm khuyến khích",ADMISSION_N:"Điểm xét tuyển"
};
const FILE_LABELS:Record<string,string>={PHOTO_4X6:"Ảnh chân dung 4×6",CCCD_FRONT:"CCCD mặt trước",CCCD_BACK:"CCCD mặt sau",OTHER:"Tệp khác"};

const STEPS = [
  { title: "Thông tin trúng tuyển", fields: ["C", "F", "G", "W", "BF", "BG", "BH"] },
  { title: "Nơi sinh và quê quán", fields: ["CG", "CH", "BY", "X"] },
  { title: "Địa chỉ cư trú", fields: ["L", "N", "O"] },
  { title: "Đội, Đoàn và chính sách", fields: ["V", "BL", "Y", "Z", "BJ"] },
  { title: "Sức khỏe và học tập", fields: ["AE", "AJ", "BD"] },
  { title: "Liên hệ học sinh", fields: ["AF", "BI"] },
  { title: "Thông tin gia đình", fields: ["AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV"] },
  { title: "Người bảo hộ", fields: ["AW", "AX", "AY", "AZ", "BA", "BB"] }
];

const ACTION_LABELS: Record<string, string> = {
  PROFILE_DRAFT_SAVED: "Lưu bản nháp",
  FILE_UPLOADED: "Tải lên tệp/ảnh",
  CCCD_SERVER_SCAN_COMPLETED: "Quét CCCD thành công",
  CCCD_SERVER_SCAN_FAILED: "Quét CCCD thất bại",
  PROFILE_SUBMITTED: "Nộp hồ sơ",
  PROFILE_RESUBMITTED: "Nộp lại hồ sơ",
  ADMIN_REVISION_REQUESTED: "Yêu cầu bổ sung",
  ADMIN_APPROVED: "Phê duyệt hồ sơ",
  ADMIN_LOCKED: "Khóa hồ sơ",
  ADMIN_UNLOCKED: "Mở khóa hồ sơ",
  FILE_DECISION_APPROVE: "Duyệt tệp/ảnh",
  FILE_DECISION_REJECT: "Từ chối tệp/ảnh",
  EXPORT_REQUESTED: "Yêu cầu xuất dữ liệu",
  STUDENT_LOGIN: "Đăng nhập",
  ADMIN_EDIT_PROFILE: "Admin sửa thông tin",
};

const ACTOR_LABELS: Record<string, string> = {
  STUDENT: "Học sinh",
  ADMIN: "Quản trị viên",
  SYSTEM: "Hệ thống",
};

export default function ReviewDetailPage(){
  const params=useParams<{id:string}>();
  const router=useRouter();
  const[data,setData]=useState<Payload|null>(null);
  const[decisions,setDecisions]=useState<Record<string,{action:"ACCEPT"|"REJECT"}>>({});
  const[busy,setBusy]=useState(false);
  const[isSelectingRevision,setIsSelectingRevision]=useState(false);
  const[editingField,setEditingField]=useState<{field_code:string;value:string}|null>(null);
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
    return STEPS.map(step => {
      let values = step.fields.map(f => data.profile_values.find(v => v.field_code === f)).filter(Boolean) as ProfileValue[];
      values = values.filter(v => {
        if (v.field_code === 'AE' && (!v.proposed_value || v.proposed_value.trim() === '')) return false;
        return true;
      });
      return { title: step.title, values };
    }).filter(g => g.values.length > 0);
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
    const ok = await post(`/api/admin/review/${params.id}/edit`,{field_code:editingField.field_code,proposed_value:editingField.value});
    if(ok){
      setEditingField(null);
    }
  }

  async function saveReview(completeReview:boolean){
    if(completeReview&&!confirm("Bạn xác nhận phê duyệt toàn bộ thông tin hợp lệ?"))return;
    const items=data!.profile_values.map(val=>({id:val.id,action:"ACCEPT"}));
    const ok=await post(`/api/admin/review/${params.id}/approve`,{items,completeReview});
    if(ok){setDecisions({});setIsSelectingRevision(false);if(completeReview)router.refresh()}
  }

  async function requestRevision(){
    const errorFields=data!.profile_values.filter(v=>decisions[v.id]?.action==="REJECT").map(v=>LABELS[v.field_code]??v.field_code);
    const prefix=errorFields.length>0?`Cần sửa lại thông tin: ${errorFields.join(", ")}. `:"";
    const reason=prompt("Nhập lý do học sinh cần sửa (tối thiểu 10 ký tự):",prefix);
    if(reason){
      const ok = await post(`/api/admin/review/${params.id}/request-revision`,{reason});
      if(ok) {
         setDecisions({});
         setIsSelectingRevision(false);
      }
    }
  }

  async function fileDecision(file:FileItem,decision:"APPROVE"|"REJECT"){
    let reason:string|undefined;
    if(decision==="REJECT"){
      reason=prompt("Nhập lý do từ chối ảnh:")??undefined;
      if(!reason)return;
    }
    await post(`/api/admin/review/${params.id}/files/${file.id}/decision`,{decision,reason});
  }

  async function toggleLock(){
    if(!data)return;
    const lock=data.student.status==="APPROVED";
    await post(`/api/admin/review/${params.id}/lock`,{lock});
  }

  if(!data)return <><AppHeader mode="admin"/><main className="loading-page"><div className="spinner"/><p>Đang tải hồ sơ…</p></main></>;

  return <><AppHeader mode="admin"/><main className="admin-main"><div className="container"><div className="breadcrumbs"><Link href="/admin/review">Duyệt hồ sơ</Link><span>/</span><strong>{data.student.name}</strong></div><div className="page-title review-title"><div><span className="eyebrow">HỒ SƠ HỌC SINH</span><h1>{data.student.name}</h1><p>CCCD: {data.student.current_cccd??"Chưa cập nhật"} · Ngày sinh: {data.student.current_dob}</p></div><div className="title-actions"><StatusBadge status={data.student.status}/>{["APPROVED","LOCKED"].includes(data.student.status)&&<button className="button button--secondary" onClick={toggleLock} disabled={busy}>{data.student.status==="LOCKED"?"Mở khóa":"Khóa hồ sơ"}</button>}</div></div>{message&&<div className={`notice notice--${message.tone}`}>{message.text}</div>}

  <div className="review-layout"><div className="review-content">
  <section className="panel" style={{padding: '32px'}}><div className="panel__head" style={{marginBottom: '24px'}}><div><h2 style={{fontSize: '20px', color: '#0f172a'}}>Hồ sơ học sinh</h2><p style={{color: '#64748b'}}>Toàn bộ thông tin được tổ chức theo nhóm.</p></div></div>
  {groupedFields.length ? groupedFields.map(group => (
    <div key={group.title} style={{marginBottom: '40px'}}>
      <h3 style={{fontSize: '18px', fontWeight: 600, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px'}}>
        <span style={{display: 'inline-block', width: '4px', height: '20px', background: '#3b82f6', borderRadius: '2px'}}></span>
        {group.title}
      </h3>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px'}}>
        {group.values.map(val=>{
          const decision=decisions[val.id];
          const hasChanged = val.source_value !== val.proposed_value;
          return <article key={val.id} style={{
            padding: '16px', 
            border: decision?.action === 'REJECT' ? '2px solid #ef4444' : '1px solid #cbd5e1', 
            borderRadius: '12px', 
            background: decision?.action === 'REJECT' ? '#fef2f2' : '#ffffff', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            position: 'relative', 
            overflow: 'hidden', 
            transition: 'all 0.2s'
          }}>
            {decision?.action === 'REJECT' && <div style={{position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444'}}></div>}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px'}}>
              <strong style={{fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '6px'}}>{LABELS[val.field_code] ?? val.field_code}
                {!isSelectingRevision && editingField?.field_code !== val.field_code && (
                  <button onClick={() => setEditingField({ field_code: val.field_code, value: val.proposed_value || '' })} style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '14px', color: '#3b82f6'}} title="Sửa thông tin" disabled={busy}>✏️</button>
                )}
              </strong>
              {isSelectingRevision && hasChanged && <span style={{marginLeft: '8px', fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 600}}>Đã sửa</span>}
              {val.change_status === 'PREVIEW' && <span style={{marginLeft: '8px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600}}>Dữ liệu hệ thống</span>}
            </div>
            {editingField?.field_code === val.field_code ? (
              <div style={{marginTop: '8px'}}>
                <input type="text" value={editingField.value} onChange={e => setEditingField({ ...editingField, value: e.target.value })} style={{width: '100%', padding: '8px', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '15px', outline: 'none'}} autoFocus onKeyDown={e => e.key === 'Enter' && saveFieldEdit()} />
                <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                  <button className="button button--primary button--small" onClick={saveFieldEdit} disabled={busy}>Lưu</button>
                  <button className="button button--secondary button--small" onClick={() => setEditingField(null)} disabled={busy}>Hủy</button>
                </div>
              </div>
            ) : (
              <p style={{margin: 0, fontSize: '16px', fontWeight: 500, color: '#0f172a', lineHeight: 1.5}}>{val.proposed_value ? val.proposed_value.replace(/\s*\(\d+\)\s*$/, '').trim() : <span style={{color: '#94a3b8', fontStyle: 'italic'}}>(Trống)</span>}</p>
            )}
            {isSelectingRevision && <div style={{marginTop:'16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1'}}><label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ef4444', fontWeight: 600, fontSize: '14px' }}><input type="checkbox" checked={decision?.action === "REJECT"} onChange={(e) => decide(val, e.target.checked ? "REJECT" : "ACCEPT")} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#ef4444' }} />Yêu cầu học sinh sửa lại</label></div>}
          </article>
        })}
      </div>
    </div>
  )):<div className="empty-state"><strong>Chưa có thông tin</strong></div>}</section>

  <section className="panel"><div className="panel__head"><div><h2>Hình ảnh hồ sơ</h2><p>Chỉ duyệt phiên bản mới nhất của từng loại ảnh.</p></div></div><div className="admin-files">{currentFiles.map(file=><article key={file.id}><div className="admin-file__image"><Image src={`/api/student/files/${file.id}`} alt={FILE_LABELS[file.category]??file.category} width={500} height={340} unoptimized/></div><div className="admin-file__body"><div><h3>{FILE_LABELS[file.category]??file.category}</h3><StatusBadge status={file.status}/></div><p>Phiên bản {file.current_version} · {file.width??"?"}×{file.height??"?"} px</p><div><button className="button button--success button--small" onClick={()=>fileDecision(file,"APPROVE")} disabled={busy}>Duyệt ảnh</button><button className="button button--danger button--small" onClick={()=>fileDecision(file,"REJECT")} disabled={busy}>Từ chối</button></div></div></article>)}</div></section>
  <section className="panel"><div className="panel__head"><div><h2>Nhật ký xử lý</h2><p>Các thao tác gần nhất liên quan đến hồ sơ.</p></div></div><div className="timeline">{data.auditLogs.slice(0,20).map(log=><div key={log.id}><b></b><span><strong>{ACTION_LABELS[log.action] ?? log.action}</strong><small>{new Date(log.created_at).toLocaleString("vi-VN")} · {ACTOR_LABELS[log.actor_type] ?? log.actor_type}</small>{log.reason&&<p>{log.reason}</p>}</span></div>)}</div></section></div>
  <aside className="review-sidebar"><section className="panel sticky-panel"><h2>Quyết định hồ sơ</h2><p className="muted">Kiểm tra thông tin và ảnh trước khi phê duyệt.</p>
  {isSelectingRevision ? <>
    <div className="decision-summary" style={{background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '16px'}}><span>Thông tin đánh dấu sai</span><strong>{Object.values(decisions).filter(d=>d.action==="REJECT").length}</strong></div>
    <button className="button button--danger button--block" disabled={busy||!Object.values(decisions).some(d=>d.action==="REJECT")} onClick={requestRevision}>Xác nhận gửi yêu cầu bổ sung</button>
    <button className="button button--secondary button--block" disabled={busy} onClick={()=>{setIsSelectingRevision(false);setDecisions({});}}>Hủy bỏ</button>
  </> : <>
    <button className="button button--primary button--block" disabled={busy||!["SUBMITTED","RESUBMITTED"].includes(data.student.status)} onClick={()=>saveReview(true)}>Phê duyệt hồ sơ</button>
    <button className="button button--danger-outline button--block" disabled={busy||!["SUBMITTED","RESUBMITTED","APPROVED"].includes(data.student.status)} onClick={()=>setIsSelectingRevision(true)}>Yêu cầu bổ sung</button>
    <div className="review-note"><strong>Điều kiện phê duyệt</strong><span>✓ Đủ 3 ảnh bắt buộc hợp lệ</span><span>✓ Hồ sơ đang chờ duyệt</span></div>
  </>}
  </section></aside></div>
  </div></main></>}
