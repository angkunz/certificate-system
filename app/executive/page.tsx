'use client';
import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import CertificateTemplate from '../components/CertificateTemplate';
import { mergeLayout } from '../components/certLayout';
import type { CertLayout } from '../components/certLayout';

interface User { id: string; username: string; role: string; displayName: string; }
interface OrgSettings { name: string; logo_url: string | null; executive_name: string; executive_position: string; signature_url: string | null; cert_layout?: Partial<CertLayout>; }
interface Activity { id: string; name: string; description: string; cert_date: string; background_url: string | null; }
interface Recipient {
  id: string; activity_id: string; full_name: string; cert_code: string;
  extra_details: string | null; award: string | null; cert_date: string | null; status: string;
  activity?: Activity;
}

function Toast({ msg, type, onDone }: { msg: string; type: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast toast-${type}`}>{type === 'success' ? '✅' : '❌'} {msg}</div>;
}

export default function ExecutivePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [pending, setPending] = useState<Recipient[]>([]);
  const [approved, setApproved] = useState<Recipient[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewRecip, setPreviewRecip] = useState<Recipient | null>(null);
  const [previewQR, setPreviewQR] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [approveAllLoading, setApproveAllLoading] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  const toast = useCallback((msg: string, type = 'success') => {
    setToasts(p => [...p, { id: Date.now(), msg, type }]);
  }, []);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const res = await fetch('/api/auth');
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    if (data.user) fetchData();
  }

  async function fetchData() {
    const [orgRes, pendRes, allRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/recipients?pending=1'),
      fetch('/api/recipients'),
    ]);
    const [orgData, pendData, allData] = await Promise.all([orgRes.json(), pendRes.json(), allRes.json()]);
    setOrg(orgData.data);
    setPending(pendData.data || []);
    setApproved((allData.data || []).filter((r: Recipient) => r.status === 'approved'));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginError(''); setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username: loginUsername, password: loginPassword }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'เข้าสู่ระบบไม่สำเร็จ'); return; }
      if (data.user.role !== 'executive') {
        setLoginError('บัญชีนี้ไม่มีสิทธิ์เข้าหน้าผู้บริหาร');
        fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        return;
      }
      setUser(data.user); fetchData();
    } finally { setLoginLoading(false); }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setUser(null); setPending([]); setApproved([]);
  }

  async function openPreview(r: Recipient) {
    setPreviewRecip(r);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    try { setPreviewQR(await QRCode.toDataURL(`${baseUrl}/certificate/${r.cert_code}`, { width: 140, margin: 1 })); } catch { setPreviewQR(''); }
  }

  // ── Approve / Reject ──
  async function callAction(action: 'approve' | 'reject', ids: string[], reason?: string) {
    const res = await fetch('/api/recipients', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids, ...(reason ? { reject_reason: reason } : {}) }),
    });
    return res.ok;
  }

  async function approveSelected() {
    const ids = Array.from(selected);
    if (!ids.length) { toast('กรุณาเลือกรายการ', 'error'); return; }
    setActionLoading(true);
    const ok = await callAction('approve', ids);
    if (ok) { toast(`อนุมัติ ${ids.length} รายการสำเร็จ`); setSelected(new Set()); fetchData(); }
    else toast('อนุมัติไม่สำเร็จ', 'error');
    setActionLoading(false);
  }

  async function approveAll() {
    if (!pending.length) { toast('ไม่มีรายการรออนุมัติ', 'error'); return; }
    if (!confirm(`อนุมัติทั้งหมด ${pending.length} รายการ?`)) return;
    setApproveAllLoading(true);
    const ids = pending.map(r => r.id);
    const ok = await callAction('approve', ids);
    if (ok) { toast(`✅ อนุมัติทั้งหมด ${ids.length} รายการสำเร็จ`); setSelected(new Set()); fetchData(); }
    else toast('อนุมัติทั้งหมดไม่สำเร็จ', 'error');
    setApproveAllLoading(false);
  }

  async function approveOne(id: string) {
    setActionLoading(true);
    const ok = await callAction('approve', [id]);
    if (ok) { toast('อนุมัติสำเร็จ'); fetchData(); if (previewRecip?.id === id) setPreviewRecip(null); }
    else toast('อนุมัติไม่สำเร็จ', 'error');
    setActionLoading(false);
  }

  function openReject(ids: string[]) { setRejectTargetIds(ids); setRejectReason(''); setShowRejectModal(true); }

  async function confirmReject() {
    setActionLoading(true);
    const ok = await callAction('reject', rejectTargetIds, rejectReason);
    if (ok) {
      toast(`ปฏิเสธ ${rejectTargetIds.length} รายการ`);
      setSelected(new Set()); setShowRejectModal(false); fetchData();
      if (previewRecip && rejectTargetIds.includes(previewRecip.id)) setPreviewRecip(null);
    } else toast('ดำเนินการไม่สำเร็จ', 'error');
    setActionLoading(false);
  }

  function toggleSelect(id: string) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelected(new Set(pending.map(r => r.id))); }
  function clearSelect() { setSelected(new Set()); }

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  const certLayout = org?.cert_layout ? mergeLayout(org.cert_layout) : undefined;

  // ── LOGIN ──
  if (loading) return (
    <div className="login-page"><div className="login-card" style={{ textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⏳</div>
      <p style={{ marginTop:16, color:'var(--text-muted)' }}>กำลังโหลด...</p>
    </div></div>
  );

  if (!user) return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div className="login-title">หน้าผู้บริหาร</div>
          <div className="login-subtitle">อนุมัติเกียรติบัตร</div>
        </div>
        <form onSubmit={handleLogin}>
          {loginError && <div className="alert alert-error">{loginError}</div>}
          <div className="form-group"><label className="form-label">ชื่อผู้ใช้</label>
            <input className="form-control" value={loginUsername} onChange={e=>setLoginUsername(e.target.value)} placeholder="executive" autoFocus /></div>
          <div className="form-group"><label className="form-label">รหัสผ่าน</label>
            <input className="form-control" type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••" /></div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loginLoading}>
            {loginLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:20 }}>
          <a href="/" style={{ fontSize:13, color:'var(--text-muted)', textDecoration:'none' }}>← กลับหน้าหลัก</a>
        </div>
      </div>
    </div>
  );

  // ── MAIN ──
  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            {org?.logo_url ? <img src={org.logo_url} alt="logo" className="navbar-logo" /> : <div className="navbar-logo-placeholder">🏛️</div>}
            <span className="navbar-name">{org?.name || 'ระบบเกียรติบัตร'}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="badge badge-success" style={{ display:'flex', alignItems:'center', gap:4 }}>✅ ผู้บริหาร</span>
            <span style={{ fontSize:13, color:'var(--text-muted)', display:'none' }} className="desktop-only">{user.displayName||user.username}</span>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>🚪 ออก</button>
          </div>
        </div>
      </nav>

      <main style={{ padding:'32px 0', minHeight:'80vh' }}>
        <div className="container">
          <div className="page-header" style={{ flexWrap:'wrap', gap:12 }}>
            <div>
              <div className="page-title">✅ อนุมัติเกียรติบัตร</div>
              <div className="page-subtitle">ตรวจสอบและอนุมัติเกียรติบัตรที่รออยู่</div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {activeTab === 'pending' && (
                <>
                  {selected.size > 0 && (
                    <>
                      <button className="btn btn-outline btn-sm" onClick={clearSelect}>ยกเลิก ({selected.size})</button>
                      <button className="btn btn-danger btn-sm" onClick={() => openReject(Array.from(selected))} disabled={actionLoading}>❌ ปฏิเสธ ({selected.size})</button>
                      <button className="btn btn-success btn-sm" onClick={approveSelected} disabled={actionLoading}>✅ อนุมัติที่เลือก ({selected.size})</button>
                    </>
                  )}
                  {pending.length > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={approveAll} disabled={approveAllLoading}>
                      {approveAllLoading ? '⏳ กำลังอนุมัติ...' : `✅ อนุมัติทั้งหมด (${pending.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid-3" style={{ marginBottom:28 }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple">⏳</div>
              <div><div className="stat-value">{pending.length}</div><div className="stat-label">รออนุมัติ</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green">✅</div>
              <div><div className="stat-value">{approved.length}</div><div className="stat-label">อนุมัติแล้ว</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-gold">🎖️</div>
              <div><div className="stat-value">{pending.length + approved.length}</div><div className="stat-label">รวมทั้งหมด</div></div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom:24 }}>
            <button className={`tab${activeTab==='pending'?' active':''}`} onClick={() => setActiveTab('pending')}>
              ⏳ รออนุมัติ {pending.length > 0 && <span className="badge badge-warning" style={{ marginLeft:4 }}>{pending.length}</span>}
            </button>
            <button className={`tab${activeTab==='approved'?' active':''}`} onClick={() => setActiveTab('approved')}>
              ✅ อนุมัติแล้ว ({approved.length})
            </button>
          </div>

          {/* PENDING */}
          {activeTab === 'pending' && (
            <div className="animate-fade-in">
              {!pending.length ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <div className="empty-state-title">ไม่มีรายการรออนุมัติ</div>
                  <div className="empty-state-text">เกียรติบัตรทุกรายการถูกดำเนินการแล้ว</div>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12, flexWrap:'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={selected.size === pending.length ? clearSelect : selectAll}>
                      {selected.size === pending.length ? '☑️ ยกเลิกทั้งหมด' : '☐ เลือกทั้งหมด'}
                    </button>
                    <span style={{ fontSize:13, color:'var(--text-muted)' }}>เลือก {selected.size} / {pending.length}</span>
                  </div>
                  <div className="table-container">
                    <div style={{ overflowX:'auto' }}>
                      <table>
                        <thead><tr>
                          <th style={{ width:40 }}></th>
                          <th>ชื่อ-สกุล</th><th className="desktop-only">กิจกรรม</th>
                          <th className="desktop-only">วันที่</th><th>รหัส</th><th>จัดการ</th>
                        </tr></thead>
                        <tbody>
                          {pending.map(r => (
                            <tr key={r.id} style={{ background:selected.has(r.id)?'rgba(30,58,138,0.06)':undefined }}>
                              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ width:16, height:16, accentColor:'var(--primary)', cursor:'pointer' }} /></td>
                              <td>
                                <div style={{ fontWeight:600 }}>{r.full_name}</div>
                                <div className="mobile-only" style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{r.activity?.name}</div>
                              </td>
                              <td className="desktop-only" style={{ color:'var(--text-muted)', fontSize:13 }}>{r.activity?.name||'-'}</td>
                              <td className="desktop-only" style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(r.cert_date||r.activity?.cert_date||'')}</td>
                              <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--primary)' }}>{r.cert_code}</td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn btn-outline btn-sm" onClick={() => openPreview(r)}>🎖️</button>
                                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => openReject([r.id])} disabled={actionLoading}>❌</button>
                                  <button className="btn btn-success btn-sm btn-icon" onClick={() => approveOne(r.id)} disabled={actionLoading}>✅</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* APPROVED */}
          {activeTab === 'approved' && (
            <div className="animate-fade-in">
              {!approved.length ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎖️</div>
                  <div className="empty-state-title">ยังไม่มีรายการที่อนุมัติ</div>
                </div>
              ) : (
                <div className="table-container">
                  <div style={{ overflowX:'auto' }}>
                    <table>
                      <thead><tr>
                        <th>ชื่อ-สกุล</th><th className="desktop-only">กิจกรรม</th>
                        <th className="desktop-only">วันที่</th><th>รหัส</th><th>จัดการ</th>
                      </tr></thead>
                      <tbody>
                        {approved.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ fontWeight:600 }}>{r.full_name}</div>
                              <div className="mobile-only" style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{r.activity?.name}</div>
                            </td>
                            <td className="desktop-only" style={{ color:'var(--text-muted)', fontSize:13 }}>{r.activity?.name||'-'}</td>
                            <td className="desktop-only" style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(r.cert_date||r.activity?.cert_date||'')}</td>
                            <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--primary)' }}>{r.cert_code}</td>
                            <td><button className="btn btn-outline btn-sm" onClick={() => openPreview(r)}>🎖️ ดู</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* CERTIFICATE PREVIEW MODAL */}
      {previewRecip && org && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPreviewRecip(null); }}>
          <div className="modal modal-xl animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">🎖️ {previewRecip.full_name}</span>
              <button className="modal-close" onClick={() => setPreviewRecip(null)}>✕</button>
            </div>
            <div className="modal-body">
              <CertificateTemplate org={org} recipient={previewRecip} qrDataUrl={previewQR} layout={certLayout} />
            </div>
            <div className="modal-footer" style={{ flexWrap:'wrap', gap:8 }}>
              <button className="btn btn-outline" onClick={() => setPreviewRecip(null)}>ปิด</button>
              {previewRecip.status === 'pending' && (
                <>
                  <button className="btn btn-danger" onClick={() => { setPreviewRecip(null); openReject([previewRecip.id]); }} disabled={actionLoading}>❌ ปฏิเสธ</button>
                  <button className="btn btn-success" onClick={() => approveOne(previewRecip.id)} disabled={actionLoading}>
                    {actionLoading ? '⏳' : '✅ อนุมัติ'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal animate-slide-up" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <span className="modal-title">❌ ปฏิเสธเกียรติบัตร</span>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom:16, color:'var(--text-muted)' }}>ปฏิเสธ {rejectTargetIds.length} รายการ</p>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">เหตุผล (ไม่บังคับ)</label>
                <textarea className="form-control" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="ระบุเหตุผล..." rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>ยกเลิก</button>
              <button className="btn btn-danger" onClick={confirmReject} disabled={actionLoading}>{actionLoading?'⏳':'❌ ยืนยันปฏิเสธ'}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={() => setToasts(p=>p.filter(x=>x.id!==t.id))} />)}
      </div>
    </>
  );
}
