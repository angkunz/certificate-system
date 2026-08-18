'use client';
import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import CertificateTemplate from '../components/CertificateTemplate';
import { mergeLayout, DEFAULT_CERT_LAYOUT, ELEMENT_LABELS, STYLABLE_ELEMENTS } from '../components/certLayout';
import type { CertLayout } from '../components/certLayout';

interface User { id: string; username: string; role: string; displayName: string; }
interface OrgSettings {
  name: string; logo_url: string | null; executive_name: string;
  executive_position: string; signature_url: string | null;
  theme_color: string; cert_layout?: Partial<CertLayout>;
}
interface Activity { id: string; name: string; description: string; cert_date: string; background_url: string | null; status: string; }
interface Recipient {
  id: string; activity_id: string; full_name: string; cert_code: string;
  extra_details: string | null; award: string | null; cert_date: string | null; status: string;
  activity?: Activity;
}

function Toast({ msg, type, onDone }: { msg: string; type: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast toast-${type}`}>{type === 'success' ? '✅' : '❌'} {msg}</div>;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  // Activity form
  const [showActModal, setShowActModal] = useState(false);
  const [editAct, setEditAct] = useState<Activity | null>(null);
  const [actForm, setActForm] = useState({ name: '', description: '', cert_date: today(), background_url: '', status: 'active' });
  const [actSaving, setActSaving] = useState(false);
  const [actBgUploading, setActBgUploading] = useState(false);

  // Recipient form
  const [showRecipModal, setShowRecipModal] = useState(false);
  const [selectedActId, setSelectedActId] = useState('');
  const [recipForm, setRecipForm] = useState({ full_name: '', extra_details: '', award: '', cert_date: '' });
  const [recipSaving, setRecipSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [recipTab, setRecipTab] = useState<'single' | 'csv'>('single');

  // Settings
  const [orgForm, setOrgForm] = useState<OrgSettings>({ name: '', logo_url: null, executive_name: '', executive_position: '', signature_url: null, theme_color: '#1e3a8a' });
  const [orgSaving, setOrgSaving] = useState(false);

  // Password
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);

  // Cert Layout Editor
  const [certLayout, setCertLayout] = useState<CertLayout>(DEFAULT_CERT_LAYOUT);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [previewQRLayout, setPreviewQRLayout] = useState('');

  // Certificate preview
  const [previewRecip, setPreviewRecip] = useState<Recipient | null>(null);
  const [previewQR, setPreviewQR] = useState('');

  // Filters
  const [recipActFilter, setRecipActFilter] = useState('');
  const [recipStatusFilter, setRecipStatusFilter] = useState('');

  function today() { return new Date().toISOString().slice(0, 10); }
  function toast(msg: string, type = 'success') { setToasts(p => [...p, { id: Date.now(), msg, type }]); }

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    if (layoutEditMode && !previewQRLayout) {
      QRCode.toDataURL('https://example.com', { width: 120, margin: 1 }).then(setPreviewQRLayout).catch(() => {});
    }
  }, [layoutEditMode, previewQRLayout]);

  async function checkAuth() {
    const res = await fetch('/api/auth');
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    if (data.user) fetchAll();
  }

  async function fetchAll() {
    const [orgRes, actRes, pendRes, recipRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/activities?all=1'),
      fetch('/api/recipients?pending=1'),
      fetch('/api/recipients'),
    ]);
    const [orgData, actData, pendData, recipData] = await Promise.all([orgRes.json(), actRes.json(), pendRes.json(), recipRes.json()]);
    if (orgData.data) {
      setOrg(orgData.data);
      setOrgForm(orgData.data);
      setCertLayout(mergeLayout(orgData.data.cert_layout));
    }
    if (actData.data) setActivities(actData.data);
    setPendingCount((pendData.data || []).length);
    setRecipients(recipData.data || []);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginError(''); setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username: loginUsername, password: loginPassword }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error); return; }
      if (data.user.role !== 'admin') {
        setLoginError('บัญชีนี้ไม่มีสิทธิ์เข้าหน้าแอดมิน');
        fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        return;
      }
      setUser(data.user); fetchAll();
    } finally { setLoginLoading(false); }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setUser(null); setActivities([]); setRecipients([]);
  }

  async function handlePwdChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdError('');
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('รหัสผ่านใหม่ไม่ตรงกัน'); return;
    }
    if (pwdForm.newPassword.length < 6) {
      setPwdError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change_password', oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }) });
      const data = await res.json();
      if (!res.ok) { setPwdError(data.error); return; }
      setShowPwdModal(false);
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setToasts(p => [...p, { id: Date.now(), msg: 'เปลี่ยนรหัสผ่านสำเร็จ', type: 'success' }]);
    } finally { setPwdSaving(false); }
  }

  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    const fd = new FormData(); fd.append('file', file); fd.append('bucket', bucket);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return res.ok ? data.url : null;
  }

  // ── Activities ──
  function openActModal(act?: Activity) {
    setEditAct(act || null);
    setActForm(act
      ? { name: act.name, description: act.description || '', cert_date: act.cert_date, background_url: act.background_url || '', status: act.status }
      : { name: '', description: '', cert_date: today(), background_url: '', status: 'active' }
    );
    setShowActModal(true);
  }

  async function saveActivity() {
    if (!actForm.name || !actForm.cert_date) { toast('กรุณากรอกชื่อและวันที่', 'error'); return; }
    setActSaving(true);
    try {
      const res = await fetch(editAct ? `/api/activities/${editAct.id}` : '/api/activities', {
        method: editAct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actForm),
      });
      if (!res.ok) { toast('บันทึกไม่สำเร็จ', 'error'); return; }
      toast(editAct ? 'แก้ไขกิจกรรมสำเร็จ' : 'สร้างกิจกรรมสำเร็จ');
      setShowActModal(false); fetchAll();
    } finally { setActSaving(false); }
  }

  async function deleteActivity(id: string) {
    if (!confirm('ลบกิจกรรมนี้? รายชื่อทั้งหมดที่เกี่ยวข้องจะถูกลบด้วย')) return;
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('ลบกิจกรรมสำเร็จ'); fetchAll(); } else toast('ลบไม่สำเร็จ', 'error');
  }

  // ── Recipients ──
  async function saveRecipient() {
    if (!recipForm.full_name || !selectedActId) { toast('กรุณากรอกชื่อและเลือกกิจกรรม', 'error'); return; }
    setRecipSaving(true);
    try {
      const res = await fetch('/api/recipients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...recipForm, activity_id: selectedActId, cert_date: recipForm.cert_date || null }),
      });
      if (!res.ok) { toast('เพิ่มรายชื่อไม่สำเร็จ', 'error'); return; }
      toast('เพิ่มรายชื่อสำเร็จ');
      setRecipForm({ full_name: '', extra_details: '', award: '', cert_date: '' }); fetchAll();
    } finally { setRecipSaving(false); }
  }

  async function importCSV() {
    if (!csvFile || !selectedActId) { toast('กรุณาเลือกไฟล์และกิจกรรม', 'error'); return; }
    setImportLoading(true);
    const text = await csvFile.text();
    const rows = text.trim().split('\n').slice(1).filter(Boolean).map(line => {
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      return { full_name: cols[0] || '', extra_details: cols[1] || '', award: cols[2] || '', cert_date: cols[3] || '' };
    }).filter(r => r.full_name);
    if (!rows.length) { toast('ไม่พบข้อมูลในไฟล์ CSV', 'error'); setImportLoading(false); return; }
    const res = await fetch('/api/recipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'import', activity_id: selectedActId, rows }) });
    if (res.ok) { toast(`นำเข้า ${rows.length} รายการสำเร็จ`); setCsvFile(null); fetchAll(); } else toast('นำเข้าไม่สำเร็จ', 'error');
    setImportLoading(false);
  }

  async function deleteRecipient(id: string) {
    if (!confirm('ลบรายชื่อนี้?')) return;
    const res = await fetch(`/api/recipients/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('ลบรายชื่อสำเร็จ'); fetchAll(); } else toast('ลบไม่สำเร็จ', 'error');
  }

  async function openPreview(r: Recipient) {
    const act = r.activity || activities.find(a => a.id === r.activity_id);
    setPreviewRecip({ ...r, activity: act });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    try { setPreviewQR(await QRCode.toDataURL(`${baseUrl}/certificate/${r.cert_code}`, { width: 140, margin: 1 })); } catch { setPreviewQR(''); }
  }

  // ── Settings ──
  async function saveSettings() {
    setOrgSaving(true);
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orgForm) });
    if (res.ok) { toast('บันทึกการตั้งค่าสำเร็จ'); fetchAll(); } else toast('บันทึกไม่สำเร็จ', 'error');
    setOrgSaving(false);
  }

  async function saveLayout() {
    setLayoutSaving(true);
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...orgForm, cert_layout: certLayout }) });
    if (res.ok) { toast('บันทึก Layout สำเร็จ'); fetchAll(); setLayoutEditMode(false); } else toast('บันทึกไม่สำเร็จ', 'error');
    setLayoutSaving(false);
  }

  const handleLayoutChange = useCallback((l: CertLayout) => setCertLayout(l), []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    const url = await uploadFile(file, 'logos');
    if (url) setOrgForm(f => ({ ...f, logo_url: url })); else toast('อัปโหลดโลโก้ไม่สำเร็จ', 'error');
    setLogoUploading(false);
  }

  async function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setSigUploading(true);
    const url = await uploadFile(file, 'signatures');
    if (url) setOrgForm(f => ({ ...f, signature_url: url })); else toast('อัปโหลดลายเซ็นไม่สำเร็จ', 'error');
    setSigUploading(false);
  }

  async function handleActBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setActBgUploading(true);
    const url = await uploadFile(file, 'certificates');
    if (url) setActForm(f => ({ ...f, background_url: url })); else toast('อัปโหลดรูปไม่สำเร็จ', 'error');
    setActBgUploading(false);
  }

  async function downloadCert(type: 'png' | 'pdf', elId: string, name: string) {
    const el = document.getElementById(elId); if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
    if (type === 'png') {
      const link = document.createElement('a'); link.download = `เกียรติบัตร-${name}.png`; link.href = canvas.toDataURL(); link.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, 297, 210);
      pdf.save(`เกียรติบัตร-${name}.pdf`);
    }
  }

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  const filteredRecipients = recipients.filter(r => {
    if (recipActFilter && r.activity_id !== recipActFilter) return false;
    if (recipStatusFilter && r.status !== recipStatusFilter) return false;
    return true;
  });

  function navTo(tab: string) { setActiveTab(tab); setSidebarOpen(false); }

  // ── LOGIN ──
  if (loading) return (
    <div className="login-page"><div className="login-card" style={{ textAlign:'center' }}>
      <div style={{ fontSize:40 }}>⏳</div><p style={{ marginTop:16, color:'var(--text-muted)' }}>กำลังโหลด...</p>
    </div></div>
  );

  if (!user) return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>⚙️</div>
          <div className="login-title">หน้าแอดมิน</div>
          <div className="login-subtitle">ระบบออกเกียรติบัตรออนไลน์</div>
        </div>
        <form onSubmit={handleLogin}>
          {loginError && <div className="alert alert-error">{loginError}</div>}
          <div className="form-group"><label className="form-label">ชื่อผู้ใช้</label>
            <input className="form-control" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="admin" autoFocus /></div>
          <div className="form-group"><label className="form-label">รหัสผ่าน</label>
            <input className="form-control" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" /></div>
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

  // ── ADMIN LAYOUT ──
  return (
    <>
      <div className="admin-layout">
        {/* Overlay on mobile */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* SIDEBAR */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-logo">
            {org?.logo_url
              ? <img src={org.logo_url} alt="logo" className="sidebar-logo-img" />
              : <div className="sidebar-logo-img" style={{ display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🏛️</div>
            }
            <div className="sidebar-logo-text">{org?.name || 'ระบบเกียรติบัตร'}</div>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section">เมนูหลัก</div>
            {[
              { id:'dashboard', icon:'📊', label:'ภาพรวม' },
              { id:'activities', icon:'🎯', label:'กิจกรรม' },
              { id:'recipients', icon:'👥', label:'รายชื่อผู้รับ' },
              { id:'settings', icon:'⚙️', label:'ตั้งค่าองค์กร' },
            ].map(item => (
              <button key={item.id} className={`sidebar-item${activeTab === item.id ? ' active' : ''}`} onClick={() => navTo(item.id)}>
                <span className="item-icon">{item.icon}</span>{item.label}
                {item.id === 'recipients' && pendingCount > 0 && <span className="item-badge">{pendingCount}</span>}
              </button>
            ))}
            <div className="sidebar-section">ลิงก์</div>
            <a href="/" className="sidebar-item" target="_blank"><span className="item-icon">🌐</span>หน้าสาธารณะ</a>
            <a href="/executive" className="sidebar-item" target="_blank"><span className="item-icon">✅</span>หน้าผู้บริหาร</a>
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{(user.displayName || user.username)?.[0]?.toUpperCase()}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.displayName || user.username}</div>
                <div className="sidebar-user-role">ผู้ดูแลระบบ</div>
              </div>
            </div>
            <button className="sidebar-item" onClick={() => { setPwdError(''); setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' }); setShowPwdModal(true); }} style={{ marginTop:4 }}>
              <span className="item-icon">🔑</span>เปลี่ยนรหัสผ่าน
            </button>
            <button className="sidebar-item" onClick={handleLogout} style={{ marginTop:4 }}>
              <span className="item-icon">🚪</span>ออกจากระบบ
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="admin-content">
          <header className="admin-topbar">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button className="hamburger hamburger-admin" onClick={() => setSidebarOpen(v => !v)}>☰</button>
              <div className="admin-topbar-title">
                {activeTab === 'dashboard' && '📊 ภาพรวม'}
                {activeTab === 'activities' && '🎯 กิจกรรม'}
                {activeTab === 'recipients' && '👥 รายชื่อผู้รับ'}
                {activeTab === 'settings' && '⚙️ ตั้งค่าองค์กร'}
              </div>
            </div>
            <div className="admin-topbar-actions">
              {activeTab === 'activities' && <button className="btn btn-primary btn-sm" onClick={() => openActModal()}>+ สร้างกิจกรรม</button>}
              {activeTab === 'recipients' && <button className="btn btn-primary btn-sm" onClick={() => setShowRecipModal(true)}>+ เพิ่มรายชื่อ</button>}
            </div>
          </header>

          <div className="admin-page">

            {/* ── DASHBOARD ── */}
            {activeTab === 'dashboard' && (
              <div className="animate-fade-in">
                <div className="grid-4" style={{ marginBottom:28 }}>
                  {[
                    { icon:'🎯', val:activities.length, label:'กิจกรรม', cls:'stat-icon-blue' },
                    { icon:'👥', val:recipients.length, label:'รายชื่อทั้งหมด', cls:'stat-icon-gold' },
                    { icon:'✅', val:recipients.filter(r=>r.status==='approved').length, label:'อนุมัติแล้ว', cls:'stat-icon-green' },
                    { icon:'⏳', val:pendingCount, label:'รออนุมัติ', cls:'stat-icon-purple' },
                  ].map((s,i) => (
                    <div key={i} className="stat-card">
                      <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
                      <div><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
                    </div>
                  ))}
                </div>
                <div className="grid-2">
                  <div className="table-container">
                    <div className="table-header"><span className="table-title">กิจกรรมล่าสุด</span>
                      <button className="btn btn-primary btn-sm" onClick={() => navTo('activities')}>ดูทั้งหมด</button></div>
                    {activities.slice(0,5).map(a => (
                      <div key={a.id} style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', gap:12, alignItems:'center' }}>
                        <div style={{ width:40, height:40, borderRadius:8, background: a.background_url ? `url(${a.background_url}) center/cover` : 'linear-gradient(135deg,var(--primary),var(--accent))', flexShrink:0 }} />
                        <div style={{ flex:1, overflow:'hidden' }}>
                          <div style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(a.cert_date)}</div>
                        </div>
                        <span className={`badge ${a.status==='active'?'badge-success':'badge-gray'}`}>{a.status==='active'?'เปิด':'ปิด'}</span>
                      </div>
                    ))}
                    {!activities.length && <div className="table-empty"><div className="table-empty-icon">🎯</div><p>ยังไม่มีกิจกรรม</p></div>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {[
                      { icon:'🎯', title:'สร้างกิจกรรมใหม่', desc:'เริ่มสร้างกิจกรรมและเพิ่มรายชื่อผู้รับเกียรติบัตร', btn:'+ สร้างกิจกรรม', action:() => { navTo('activities'); openActModal(); }, grad:'var(--primary),var(--accent)' },
                      { icon:'👥', title:'เพิ่มรายชื่อผู้รับ', desc:'เพิ่มทีละคนหรือ Import CSV', btn:'+ เพิ่มรายชื่อ', action:() => { navTo('recipients'); setShowRecipModal(true); }, grad:'var(--secondary),var(--secondary-dark)' },
                    ].map((q,i) => (
                      <div key={i} className="card" style={{ background:`linear-gradient(135deg,${q.grad})`, border:'none', color:'white' }}>
                        <div className="card-body">
                          <div style={{ fontSize:32, marginBottom:8 }}>{q.icon}</div>
                          <div style={{ fontSize:18, fontWeight:700, color:'white', marginBottom:6 }}>{q.title}</div>
                          <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', marginBottom:16 }}>{q.desc}</div>
                          <button className="btn" style={{ background:'rgba(255,255,255,0.2)', color:'white', border:'1px solid rgba(255,255,255,0.3)' }} onClick={q.action}>{q.btn}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ACTIVITIES ── */}
            {activeTab === 'activities' && (
              <div className="animate-fade-in">
                <div className="page-header">
                  <div><div className="page-title">กิจกรรม</div><div className="page-subtitle">จัดการกิจกรรมและโครงการทั้งหมด</div></div>
                  <button className="btn btn-primary" onClick={() => openActModal()}>+ สร้างกิจกรรม</button>
                </div>
                {!activities.length ? (
                  <div className="empty-state"><div className="empty-state-icon">🎯</div><div className="empty-state-title">ยังไม่มีกิจกรรม</div>
                    <button className="btn btn-primary" onClick={() => openActModal()}>+ สร้างกิจกรรม</button></div>
                ) : (
                  <div className="grid-3">
                    {activities.map(act => (
                      <div key={act.id} className="card">
                        <div className="activity-card-image">
                          {act.background_url ? <img src={act.background_url} alt={act.name} /> : <span>🎯</span>}
                        </div>
                        <div className="activity-card-body">
                          <div className="activity-card-title">{act.name}</div>
                          <div className="activity-card-desc">{act.description || '-'}</div>
                          <div className="activity-card-meta" style={{ marginBottom:12 }}>
                            <span style={{ fontSize:12, color:'var(--text-muted)' }}>📅 {formatDate(act.cert_date)}</span>
                            <span className={`badge ${act.status==='active'?'badge-success':'badge-gray'}`}>{act.status==='active'?'✅ เปิด':'⏸ ปิด'}</span>
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={() => openActModal(act)}>✏️ แก้ไข</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteActivity(act.id)}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RECIPIENTS ── */}
            {activeTab === 'recipients' && (
              <div className="animate-fade-in">
                <div className="page-header">
                  <div><div className="page-title">รายชื่อผู้รับเกียรติบัตร</div><div className="page-subtitle">จัดการรายชื่อ เพิ่ม หรือ Import CSV</div></div>
                  <button className="btn btn-primary" onClick={() => setShowRecipModal(true)}>+ เพิ่มรายชื่อ</button>
                </div>
                <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
                  <select className="form-control" style={{ width:'auto', minWidth:180 }} value={recipActFilter} onChange={e => setRecipActFilter(e.target.value)}>
                    <option value="">ทุกกิจกรรม</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select className="form-control" style={{ width:'auto' }} value={recipStatusFilter} onChange={e => setRecipStatusFilter(e.target.value)}>
                    <option value="">ทุกสถานะ</option>
                    <option value="pending">⏳ รออนุมัติ</option>
                    <option value="approved">✅ อนุมัติแล้ว</option>
                    <option value="rejected">❌ ปฏิเสธ</option>
                  </select>
                  <span style={{ fontSize:13, color:'var(--text-muted)', alignSelf:'center' }}>{filteredRecipients.length} รายการ</span>
                </div>
                <div className="table-container">
                  {!filteredRecipients.length ? (
                    <div className="table-empty"><div className="table-empty-icon">👥</div><p>ยังไม่มีรายชื่อ</p></div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table>
                        <thead><tr>
                          <th>ชื่อ-สกุล</th><th>กิจกรรม</th><th>รหัสเกียรติบัตร</th><th>วันที่</th><th>สถานะ</th><th>จัดการ</th>
                        </tr></thead>
                        <tbody>
                          {filteredRecipients.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontWeight:600 }}>{r.full_name}</td>
                              <td style={{ color:'var(--text-muted)', fontSize:13 }}>{activities.find(a=>a.id===r.activity_id)?.name||'-'}</td>
                              <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--primary)' }}>{r.cert_code}</td>
                              <td style={{ fontSize:13, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDate(r.cert_date||activities.find(a=>a.id===r.activity_id)?.cert_date||'')}</td>
                              <td>
                                <span className={`badge ${r.status==='approved'?'badge-success':r.status==='rejected'?'badge-error':'badge-warning'}`}>
                                  {r.status==='approved'?'✅ อนุมัติ':r.status==='rejected'?'❌ ปฏิเสธ':'⏳ รอ'}
                                </span>
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn btn-outline btn-sm" onClick={() => openPreview({...r, activity:activities.find(a=>a.id===r.activity_id)})}>🎖️</button>
                                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteRecipient(r.id)}>🗑️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeTab === 'settings' && (
              <div className="animate-fade-in">
                <div className="page-header">
                  <div><div className="page-title">ตั้งค่าองค์กร</div><div className="page-subtitle">ข้อมูลที่ปรากฏบนเกียรติบัตรและหน้าเว็บ</div></div>
                </div>

                {/* Org Info */}
                <div className="card" style={{ marginBottom:24 }}>
                  <div className="card-body">
                    <h3 style={{ marginBottom:20, fontSize:16, fontWeight:700 }}>🏛️ ข้อมูลองค์กร</h3>
                    <div className="form-group">
                      <label className="form-label">โลโก้องค์กร</label>
                      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        {orgForm.logo_url
                          ? <img src={orgForm.logo_url} alt="logo" style={{ width:64, height:64, borderRadius:12, objectFit:'cover', border:'2px solid var(--border)' }} />
                          : <div style={{ width:64, height:64, borderRadius:12, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, border:'2px dashed var(--border)' }}>🏛️</div>
                        }
                        <div>
                          <label className="btn btn-outline btn-sm" style={{ cursor:'pointer' }}>
                            {logoUploading ? '⏳ อัปโหลด...' : '📁 เลือกโลโก้'}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display:'none' }} disabled={logoUploading} />
                          </label>
                          <div className="form-hint">PNG, JPG แนะนำ 200×200px</div>
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ชื่อองค์กร <span>*</span></label>
                      <input className="form-control" value={orgForm.name} onChange={e => setOrgForm(f=>({...f, name:e.target.value}))} placeholder="ชื่อองค์กรของคุณ" />
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">ชื่อผู้บริหาร <span>*</span></label>
                        <input className="form-control" value={orgForm.executive_name} onChange={e => setOrgForm(f=>({...f, executive_name:e.target.value}))} placeholder="ชื่อ-นามสกุล" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ตำแหน่งผู้บริหาร <span>*</span></label>
                        <input className="form-control" value={orgForm.executive_position} onChange={e => setOrgForm(f=>({...f, executive_position:e.target.value}))} placeholder="เช่น ผู้อำนวยการ" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">รูปลายเซ็นผู้บริหาร</label>
                      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                        {orgForm.signature_url
                          ? <img src={orgForm.signature_url} alt="sig" style={{ height:48, objectFit:'contain', background:'var(--bg)', borderRadius:8, padding:4 }} />
                          : <div style={{ width:80, height:48, borderRadius:8, background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, border:'2px dashed var(--border)' }}>✍️</div>
                        }
                        <div>
                          <label className="btn btn-outline btn-sm" style={{ cursor:'pointer' }}>
                            {sigUploading ? '⏳ อัปโหลด...' : '📁 เลือกลายเซ็น'}
                            <input type="file" accept="image/*" onChange={handleSigUpload} style={{ display:'none' }} disabled={sigUploading} />
                          </label>
                          <div className="form-hint">PNG พื้นหลังโปร่งใสดีที่สุด</div>
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">สีหลักองค์กร</label>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <input type="color" value={orgForm.theme_color||'#1e3a8a'} onChange={e=>setOrgForm(f=>({...f,theme_color:e.target.value}))} style={{ width:48, height:40, border:'none', background:'none', cursor:'pointer' }} />
                        <input className="form-control" value={orgForm.theme_color||'#1e3a8a'} onChange={e=>setOrgForm(f=>({...f,theme_color:e.target.value}))} style={{ width:120 }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:32 }}>
                  <button className="btn btn-primary btn-lg" onClick={saveSettings} disabled={orgSaving}>
                    {orgSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูลองค์กร'}
                  </button>
                </div>

                {/* Certificate Layout Editor */}
                <div className="card">
                  <div className="card-body">
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
                      <div>
                        <h3 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>🎨 ปรับแต่ง Layout & ขนาดเกียรติบัตร</h3>
                        <p style={{ fontSize:13, color:'var(--text-muted)' }}>ลากองค์ประกอบเพื่อเปลี่ยนตำแหน่ง หรือปรับขนาดและแนวการจัดวางได้ตามต้องการ</p>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setCertLayout(DEFAULT_CERT_LAYOUT); }}>↩️ รีเซ็ตเป็นค่าเริ่มต้น</button>
                        <button className={`btn btn-sm ${layoutEditMode ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setLayoutEditMode(v => !v)}>
                          {layoutEditMode ? '✓ โหมดแก้ไข ON' : '✏️ เปิดโหมดแก้ไขตำแหน่ง'}
                        </button>
                      </div>
                    </div>

                    {/* Quick Visibility Toggles */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                      {(Object.keys(ELEMENT_LABELS) as (keyof CertLayout)[]).map(key => (
                        <button key={key}
                          className={`badge cursor-pointer ${certLayout[key].visible ? 'badge-success' : 'badge-gray'}`}
                          style={{ cursor:'pointer', padding:'5px 10px', fontSize:12 }}
                          onClick={() => setCertLayout(l => ({ ...l, [key]: { ...l[key], visible: !l[key].visible } }))}>
                          {certLayout[key].visible ? '👁️' : '🚫'} {ELEMENT_LABELS[key]}
                        </button>
                      ))}
                    </div>

                    {/* Preview with sample data */}
                    <div style={{ marginBottom:16 }}>
                      <CertificateTemplate
                        org={orgForm.name ? orgForm : { name:'ชื่อองค์กร', logo_url:null, executive_name:'ชื่อผู้บริหาร', executive_position:'ผู้อำนวยการ', signature_url:null }}
                        recipient={{
                          full_name: 'ชื่อ-นามสกุล ผู้รับเกียรติบัตร',
                          cert_code: 'DEMO-XXXXX',
                          extra_details: 'รายละเอียดเพิ่มเติม',
                          award: 'รางวัลชนะเลิศ',
                          activity: { name:'ชื่อกิจกรรม/โครงการ', description:'รายละเอียดกิจกรรม', cert_date: today(), background_url: activities.find(a=>a.background_url)?.background_url || null },
                        }}
                        qrDataUrl={previewQRLayout}
                        layout={certLayout}
                        editMode={layoutEditMode}
                        onLayoutChange={handleLayoutChange}
                      />
                    </div>

                    {layoutEditMode && (
                      <div className="alert alert-info" style={{ marginBottom:16 }}>
                        💡 <strong>โหมดแก้ไขตำแหน่ง:</strong> ลากองค์ประกอบที่มีกรอบประบนตัวอย่างด้านบนเพื่อปรับย้ายตำแหน่ง (X/Y)
                      </div>
                    )}

                    {/* 📐 Element Size, Alignment, Color & Style Controls Panel */}
                    <div style={{ marginTop:24, padding:16, background:'var(--bg)', borderRadius:12, border:'1px solid var(--border)' }}>
                      <h4 style={{ fontSize:14, fontWeight:700, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                        📐 ปรับขนาด ตำแหน่ง สี และรูปแบบตัวอักษร
                      </h4>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
                        {(Object.keys(ELEMENT_LABELS) as (keyof CertLayout)[]).map(key => (
                          <div key={key} style={{ padding:12, background:'var(--card-bg, #ffffff)', borderRadius:8, border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <span style={{ fontWeight:600, fontSize:13 }}>{ELEMENT_LABELS[key]}</span>
                              <button
                                className={`badge ${certLayout[key].visible ? 'badge-success' : 'badge-gray'}`}
                                style={{ cursor:'pointer', padding:'2px 8px', fontSize:11 }}
                                onClick={() => setCertLayout(l => ({ ...l, [key]: { ...l[key], visible: !l[key].visible } }))}
                              >
                                {certLayout[key].visible ? '👁️ แสดง' : '🚫 ซ่อน'}
                              </button>
                            </div>

                            {/* Alignment — snaps x position */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <span style={{ fontSize:12, color:'var(--text-muted)' }}>จัดตำแหน่ง:</span>
                              <div style={{ display:'flex', gap:3 }}>
                                {(['left', 'center', 'right'] as const).map(align => (
                                  <button
                                    key={align}
                                    className={`btn btn-xs ${certLayout[key].align === align ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ padding:'2px 8px', fontSize:11 }}
                                    onClick={() => {
                                      const snapX = align === 'left' ? 8 : align === 'right' ? 92 : 50;
                                      setCertLayout(l => ({ ...l, [key]: { ...l[key], align, x: snapX } }));
                                    }}
                                  >
                                    {align === 'left' ? '◀ ซ้าย' : align === 'center' ? '● กลาง' : 'ขวา ▶'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Size Slider */}
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                                <span style={{ color:'var(--text-muted)' }}>ขนาด:</span>
                                <span style={{ fontWeight:700, color:'var(--primary)' }}>{certLayout[key].size ?? 100}%</span>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <input
                                  type="range"
                                  min="50"
                                  max="200"
                                  step="5"
                                  value={certLayout[key].size ?? 100}
                                  onChange={e => setCertLayout(l => ({ ...l, [key]: { ...l[key], size: Number(e.target.value) } }))}
                                  style={{ flex:1, cursor:'pointer' }}
                                />
                                <button
                                  className="btn btn-xs btn-outline"
                                  style={{ fontSize:10, padding:'1px 5px' }}
                                  onClick={() => setCertLayout(l => ({ ...l, [key]: { ...l[key], size: 100 } }))}
                                >
                                  100%
                                </button>
                              </div>
                            </div>

                            {/* Color & Font Style — only for text elements */}
                            {STYLABLE_ELEMENTS.includes(key) && (
                              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>สี:</span>
                                  <input
                                    type="color"
                                    value={certLayout[key].color || '#ffffff'}
                                    onChange={e => setCertLayout(l => ({ ...l, [key]: { ...l[key], color: e.target.value } }))}
                                    style={{ width:28, height:22, border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', padding:0 }}
                                  />
                                  {certLayout[key].color && (
                                    <button
                                      className="btn btn-xs btn-ghost"
                                      style={{ fontSize:10, padding:'0 4px' }}
                                      onClick={() => setCertLayout(l => ({ ...l, [key]: { ...l[key], color: undefined } }))}
                                      title="ใช้สีเริ่มต้น"
                                    >✕</button>
                                  )}
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>แบบ:</span>
                                  {(['normal', 'italic', 'bold-italic'] as const).map(fs => (
                                    <button
                                      key={fs}
                                      className={`btn btn-xs ${(certLayout[key].fontStyle || 'normal') === fs ? 'btn-primary' : 'btn-outline'}`}
                                      style={{ padding:'1px 6px', fontSize:10, fontStyle: fs.includes('italic') ? 'italic' : 'normal', fontWeight: fs === 'bold-italic' ? 800 : 400 }}
                                      onClick={() => setCertLayout(l => ({ ...l, [key]: { ...l[key], fontStyle: fs } }))}
                                    >
                                      {fs === 'normal' ? 'ปกติ' : fs === 'italic' ? 'เอียง' : 'หนา+เอียง'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
                      <button className="btn btn-outline" onClick={() => { setCertLayout(mergeLayout(org?.cert_layout)); setLayoutEditMode(false); }}>ยกเลิก</button>
                      <button className="btn btn-primary" onClick={saveLayout} disabled={layoutSaving}>
                        {layoutSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึก Layout & ขนาด'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVITY MODAL */}
      {showActModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowActModal(false); }}>
          <div className="modal modal-lg animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">{editAct ? '✏️ แก้ไขกิจกรรม' : '+ สร้างกิจกรรมใหม่'}</span>
              <button className="modal-close" onClick={() => setShowActModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">ชื่อกิจกรรม <span>*</span></label>
                <input className="form-control" value={actForm.name} onChange={e=>setActForm(f=>({...f,name:e.target.value}))} placeholder="ชื่อกิจกรรม/โครงการ" autoFocus /></div>
              <div className="form-group"><label className="form-label">รายละเอียด</label>
                <textarea className="form-control" value={actForm.description} onChange={e=>setActForm(f=>({...f,description:e.target.value}))} rows={3} placeholder="รายละเอียดกิจกรรม" /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">วันที่ในเกียรติบัตร <span>*</span></label>
                  <input className="form-control" type="date" value={actForm.cert_date} onChange={e=>setActForm(f=>({...f,cert_date:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">สถานะ</label>
                  <select className="form-control" value={actForm.status} onChange={e=>setActForm(f=>({...f,status:e.target.value}))}>
                    <option value="active">✅ เปิด (แสดงสาธารณะ)</option>
                    <option value="inactive">⏸ ปิด (ซ่อน)</option>
                  </select></div>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">รูปพื้นหลังเกียรติบัตร</label>
                {actForm.background_url ? (
                  <div style={{ position:'relative', display:'inline-block', width:'100%' }}>
                    <img src={actForm.background_url} alt="bg" style={{ width:'100%', maxHeight:260, objectFit:'contain', borderRadius:8, border:'1px solid var(--border)', background:'#f0f0f0' }} />
                    <button className="upload-preview-remove" onClick={()=>setActForm(f=>({...f,background_url:''}))}>✕</button>
                  </div>
                ) : (
                  <label className="upload-area" style={{ cursor:'pointer', minHeight:120 }}>
                    <div className="upload-icon">{actBgUploading?'⏳':'🖼️'}</div>
                    <div className="upload-text">{actBgUploading?'กำลังอัปโหลด...':<><strong>คลิกเพื่อเลือกรูป</strong> หรือลากวางที่นี่</>}</div>
                    <input type="file" accept="image/*" onChange={handleActBgUpload} disabled={actBgUploading} />
                  </label>
                )}
                <div className="form-hint">PNG, JPG แนะนำ 1200×850px (A4 แนวนอน)</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowActModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveActivity} disabled={actSaving}>{actSaving?'⏳ กำลังบันทึก...':'💾 บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPIENT MODAL */}
      {showRecipModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecipModal(false); }}>
          <div className="modal animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">+ เพิ่มรายชื่อผู้รับ</span>
              <button className="modal-close" onClick={() => setShowRecipModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">กิจกรรม <span>*</span></label>
                <select className="form-control" value={selectedActId} onChange={e=>setSelectedActId(e.target.value)}>
                  <option value="">-- เลือกกิจกรรม --</option>
                  {activities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="tabs" style={{ marginBottom:20 }}>
                <button className={`tab${recipTab==='single'?' active':''}`} onClick={()=>setRecipTab('single')}>เพิ่มทีละคน</button>
                <button className={`tab${recipTab==='csv'?' active':''}`} onClick={()=>setRecipTab('csv')}>Import CSV</button>
              </div>
              {recipTab === 'single' && (
                <>
                  <div className="form-group"><label className="form-label">ชื่อ-นามสกุล <span>*</span></label>
                    <input className="form-control" value={recipForm.full_name} onChange={e=>setRecipForm(f=>({...f,full_name:e.target.value}))} placeholder="ชื่อ นามสกุล" /></div>
                  <div className="form-group"><label className="form-label">🏆 รางวัล/ผลงาน</label>
                    <input className="form-control" value={recipForm.award} onChange={e=>setRecipForm(f=>({...f,award:e.target.value}))} placeholder="เช่น ชนะเลิศ, รองชนะเลิศ, ดีเด่น, เหรียญทอง" /></div>
                  <div className="form-group"><label className="form-label">รายละเอียดเพิ่มเติม</label>
                    <input className="form-control" value={recipForm.extra_details} onChange={e=>setRecipForm(f=>({...f,extra_details:e.target.value}))} placeholder="เช่น ตำแหน่ง หน่วยงาน" /></div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">วันที่ (override)</label>
                    <input className="form-control" type="date" value={recipForm.cert_date} onChange={e=>setRecipForm(f=>({...f,cert_date:e.target.value}))} />
                    <div className="form-hint">ถ้าไม่กรอก จะใช้วันที่ของกิจกรรม</div>
                  </div>
                </>
              )}
              {recipTab === 'csv' && (
                <>
                  <div className="alert alert-info" style={{ marginBottom:12 }}>
                    ℹ️ Format: <strong>full_name, extra_details, award, cert_date</strong><br />บรรทัดแรกเป็น header
                  </div>
                  <label className="upload-area" style={{ cursor:'pointer', padding:20 }}>
                    <div className="upload-icon">📄</div>
                    <div className="upload-text">{csvFile?<strong>{csvFile.name}</strong>:<><strong>เลือกไฟล์ CSV</strong></>}</div>
                    <input type="file" accept=".csv" onChange={e=>setCsvFile(e.target.files?.[0]||null)} />
                  </label>
                  {csvFile && <button className="btn btn-secondary w-full mt-2" onClick={importCSV} disabled={importLoading}>{importLoading?'⏳ กำลัง Import...':'⬆️ Import CSV'}</button>}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setShowRecipModal(false)}>ปิด</button>
              {recipTab==='single' && <button className="btn btn-primary" onClick={saveRecipient} disabled={recipSaving}>{recipSaving?'⏳...':'💾 เพิ่มรายชื่อ'}</button>}
            </div>
          </div>
        </div>
      )}

      {/* CERTIFICATE PREVIEW MODAL */}
      {previewRecip && org && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPreviewRecip(null); }}>
          <div className="modal modal-xl animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">🎖️ Preview — {previewRecip.full_name}</span>
              <button className="modal-close" onClick={()=>setPreviewRecip(null)}>✕</button>
            </div>
            <div className="modal-body">
              <CertificateTemplate
                id="admin-cert-render"
                org={org}
                recipient={previewRecip}
                qrDataUrl={previewQR}
                layout={certLayout}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={()=>setPreviewRecip(null)}>ปิด</button>
              <button className="btn btn-secondary" onClick={()=>downloadCert('png','admin-cert-render',previewRecip.full_name)}>⬇️ PNG</button>
              <button className="btn btn-primary" onClick={()=>downloadCert('pdf','admin-cert-render',previewRecip.full_name)}>📄 PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {/* PASSWORD MODAL */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPwdModal(false); }}>
          <div className="modal animate-slide-up" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">🔑 เปลี่ยนรหัสผ่าน</span>
              <button className="modal-close" onClick={() => setShowPwdModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {pwdError && <div className="alert alert-error" style={{ marginBottom:16 }}>{pwdError}</div>}
              <div className="form-group">
                <label className="form-label">รหัสผ่านเดิม <span>*</span></label>
                <input className="form-control" type="password" value={pwdForm.oldPassword} onChange={e=>setPwdForm(f=>({...f,oldPassword:e.target.value}))} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">รหัสผ่านใหม่ <span>*</span></label>
                <input className="form-control" type="password" value={pwdForm.newPassword} onChange={e=>setPwdForm(f=>({...f,newPassword:e.target.value}))} placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label">ยืนยันรหัสผ่านใหม่ <span>*</span></label>
                <input className="form-control" type="password" value={pwdForm.confirmPassword} onChange={e=>setPwdForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="••••••••" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowPwdModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handlePwdChange} disabled={pwdSaving || !pwdForm.oldPassword || !pwdForm.newPassword}>{pwdSaving?'⏳ กำลังเปลี่ยน...':'💾 บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
      </div>
    </>
  );
}
