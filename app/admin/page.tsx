'use client';
import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

interface User { id: string; username: string; role: string; displayName: string; }
interface OrgSettings {
  name: string; logo_url: string | null;
  executive_name: string; executive_position: string;
  signature_url: string | null; theme_color: string;
}
interface Activity {
  id: string; name: string; description: string;
  cert_date: string; background_url: string | null; status: string;
}
interface Recipient {
  id: string; activity_id: string; full_name: string;
  cert_code: string; extra_details: string | null;
  cert_date: string | null; status: string;
  activity?: Activity;
}

function Toast({ msg, type, onDone }: { msg: string; type: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} {msg}
    </div>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  // Activity modal
  const [showActModal, setShowActModal] = useState(false);
  const [editAct, setEditAct] = useState<Activity | null>(null);
  const [actForm, setActForm] = useState({ name: '', description: '', cert_date: today(), background_url: '', status: 'active' });
  const [actSaving, setActSaving] = useState(false);
  const [actBgUploading, setActBgUploading] = useState(false);

  // Recipient modal
  const [showRecipModal, setShowRecipModal] = useState(false);
  const [selectedActId, setSelectedActId] = useState('');
  const [recipForm, setRecipForm] = useState({ full_name: '', extra_details: '', cert_date: '' });
  const [recipSaving, setRecipSaving] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Settings
  const [orgForm, setOrgForm] = useState<OrgSettings>({ name: '', logo_url: null, executive_name: '', executive_position: '', signature_url: null, theme_color: '#1e3a8a' });
  const [orgSaving, setOrgSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);

  // Certificate preview
  const [previewRecip, setPreviewRecip] = useState<Recipient | null>(null);
  const [previewQR, setPreviewQR] = useState('');

  // Recipients table filter
  const [recipActFilter, setRecipActFilter] = useState('');
  const [recipStatusFilter, setRecipStatusFilter] = useState('');

  function today() { return new Date().toISOString().slice(0, 10); }
  function toast(msg: string, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
  }
  function removeToast(id: number) { setToasts(p => p.filter(t => t.id !== id)); }

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const res = await fetch('/api/auth');
    const data = await res.json();
    setUser(data.user);
    setLoading(false);
    if (data.user) fetchAll();
  }

  async function fetchAll() {
    const [orgRes, actRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/activities?all=1'),
    ]);
    const orgData = await orgRes.json();
    const actData = await actRes.json();
    if (orgData.data) {
      setOrg(orgData.data);
      setOrgForm(orgData.data);
    }
    if (actData.data) setActivities(actData.data);

    // Pending count
    const pendRes = await fetch('/api/recipients?pending=1');
    const pendData = await pendRes.json();
    setPendingCount((pendData.data || []).length);

    // All recipients
    const recipRes = await fetch('/api/recipients');
    const recipData = await recipRes.json();
    setRecipients(recipData.data || []);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'เข้าสู่ระบบไม่สำเร็จ'); return; }
      if (data.user.role !== 'admin') {
        setLoginError('บัญชีนี้ไม่มีสิทธิ์เข้าหน้าแอดมิน');
        await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        return;
      }
      setUser(data.user);
      fetchAll();
    } finally { setLoginLoading(false); }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setUser(null);
    setActivities([]); setRecipients([]);
  }

  // ---- ACTIVITIES ----
  function openActModal(act?: Activity) {
    if (act) {
      setEditAct(act);
      setActForm({ name: act.name, description: act.description || '', cert_date: act.cert_date, background_url: act.background_url || '', status: act.status });
    } else {
      setEditAct(null);
      setActForm({ name: '', description: '', cert_date: today(), background_url: '', status: 'active' });
    }
    setShowActModal(true);
  }

  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    const fd = new FormData(); fd.append('file', file); fd.append('bucket', bucket);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    return res.ok ? data.url : null;
  }

  async function handleActBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setActBgUploading(true);
    const url = await uploadFile(file, 'certificates');
    if (url) setActForm(f => ({ ...f, background_url: url }));
    else toast('อัปโหลดรูปไม่สำเร็จ', 'error');
    setActBgUploading(false);
  }

  async function saveActivity() {
    if (!actForm.name || !actForm.cert_date) { toast('กรุณากรอกชื่อและวันที่', 'error'); return; }
    setActSaving(true);
    try {
      const url = editAct ? `/api/activities/${editAct.id}` : '/api/activities';
      const method = editAct ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actForm) });
      if (!res.ok) { toast('บันทึกไม่สำเร็จ', 'error'); return; }
      toast(editAct ? 'แก้ไขกิจกรรมสำเร็จ' : 'สร้างกิจกรรมสำเร็จ');
      setShowActModal(false);
      fetchAll();
    } finally { setActSaving(false); }
  }

  async function deleteActivity(id: string) {
    if (!confirm('ลบกิจกรรมนี้? รายชื่อที่เกี่ยวข้องจะถูกลบด้วย')) return;
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('ลบกิจกรรมสำเร็จ'); fetchAll(); }
    else toast('ลบไม่สำเร็จ', 'error');
  }

  // ---- RECIPIENTS ----
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
      setRecipForm({ full_name: '', extra_details: '', cert_date: '' });
      fetchAll();
    } finally { setRecipSaving(false); }
  }

  async function importCSV() {
    if (!csvFile || !selectedActId) { toast('กรุณาเลือกไฟล์และกิจกรรม', 'error'); return; }
    setImportLoading(true);
    const text = await csvFile.text();
    const lines = text.trim().split('\n').filter(Boolean);
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      return { full_name: cols[0] || '', extra_details: cols[1] || '', cert_date: cols[2] || '' };
    }).filter(r => r.full_name);

    if (rows.length === 0) { toast('ไม่พบข้อมูลในไฟล์ CSV', 'error'); setImportLoading(false); return; }

    const res = await fetch('/api/recipients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', activity_id: selectedActId, rows }),
    });
    if (res.ok) { toast(`นำเข้า ${rows.length} รายการสำเร็จ`); setCsvFile(null); fetchAll(); }
    else toast('นำเข้าไม่สำเร็จ', 'error');
    setImportLoading(false);
  }

  async function deleteRecipient(id: string) {
    if (!confirm('ลบรายชื่อนี้?')) return;
    const res = await fetch(`/api/recipients/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('ลบรายชื่อสำเร็จ'); fetchAll(); }
    else toast('ลบไม่สำเร็จ', 'error');
  }

  async function openPreview(r: Recipient) {
    let act = r.activity;
    if (!act) {
      const res = await fetch(`/api/activities/${r.activity_id}`);
      const d = await res.json();
      act = d.data;
    }
    setPreviewRecip({ ...r, activity: act });
    const url = `${window.location.origin}/certificate/${r.cert_code}`;
    try { const qr = await QRCode.toDataURL(url, { width: 120, margin: 1 }); setPreviewQR(qr); } catch { setPreviewQR(''); }
  }

  // ---- SETTINGS ----
  async function saveSettings() {
    setOrgSaving(true);
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orgForm) });
    if (res.ok) { toast('บันทึกการตั้งค่าสำเร็จ'); fetchAll(); }
    else toast('บันทึกไม่สำเร็จ', 'error');
    setOrgSaving(false);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    const url = await uploadFile(file, 'logos');
    if (url) setOrgForm(f => ({ ...f, logo_url: url }));
    else toast('อัปโหลดโลโก้ไม่สำเร็จ', 'error');
    setLogoUploading(false);
  }

  async function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setSigUploading(true);
    const url = await uploadFile(file, 'signatures');
    if (url) setOrgForm(f => ({ ...f, signature_url: url }));
    else toast('อัปโหลดลายเซ็นไม่สำเร็จ', 'error');
    setSigUploading(false);
  }

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }
  function formatDateFull(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  async function downloadCert(type: 'png' | 'pdf') {
    const el = document.getElementById('admin-cert-render');
    if (!el) return;
    if (type === 'png') {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = `เกียรติบัตร-${previewRecip?.full_name}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } else {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, 297, 210);
      pdf.save(`เกียรติบัตร-${previewRecip?.full_name}.pdf`);
    }
  }

  const filteredRecipients = recipients.filter(r => {
    if (recipActFilter && r.activity_id !== recipActFilter) return false;
    if (recipStatusFilter && r.status !== recipStatusFilter) return false;
    return true;
  });

  // --- STATS ---
  const totalActs = activities.length;
  const totalRecips = recipients.length;
  const approvedRecips = recipients.filter(r => r.status === 'approved').length;

  // ---- RENDER: LOGIN ----
  if (loading) return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="loading" style={{ fontSize: 40 }}>⏳</div>
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>กำลังโหลด...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
          <div className="login-title">หน้าแอดมิน</div>
          <div className="login-subtitle">ระบบออกเกียรติบัตรออนไลน์</div>
        </div>
        <form onSubmit={handleLogin}>
          {loginError && <div className="alert alert-error">{loginError}</div>}
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้</label>
            <input className="form-control" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="admin" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">รหัสผ่าน</label>
            <input className="form-control" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loginLoading}>
            {loginLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← กลับหน้าหลัก</a>
        </div>
      </div>
    </div>
  );

  // ---- RENDER: ADMIN DASHBOARD ----
  return (
    <>
      <div className="admin-layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            {org?.logo_url
              ? <img src={org.logo_url} alt="logo" className="sidebar-logo-img" />
              : <div className="sidebar-logo-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏛️</div>
            }
            <div className="sidebar-logo-text">{org?.name || 'ระบบเกียรติบัตร'}</div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section">เมนูหลัก</div>
            {[
              { id: 'dashboard', icon: '📊', label: 'ภาพรวม' },
              { id: 'activities', icon: '🎯', label: 'กิจกรรม' },
              { id: 'recipients', icon: '👥', label: 'รายชื่อผู้รับ' },
              { id: 'settings', icon: '⚙️', label: 'ตั้งค่าองค์กร' },
            ].map(item => (
              <button
                key={item.id}
                className={`sidebar-item${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="item-icon">{item.icon}</span>
                {item.label}
                {item.id === 'recipients' && pendingCount > 0 && (
                  <span className="item-badge">{pendingCount}</span>
                )}
              </button>
            ))}

            <div className="sidebar-section">ลิงก์</div>
            <a href="/" className="sidebar-item" target="_blank">
              <span className="item-icon">🌐</span> หน้าสาธารณะ
            </a>
            <a href="/executive" className="sidebar-item" target="_blank">
              <span className="item-icon">✅</span> หน้าผู้บริหาร
            </a>
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user.displayName?.[0] || 'A'}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.displayName || user.username}</div>
                <div className="sidebar-user-role">ผู้ดูแลระบบ</div>
              </div>
            </div>
            <button className="sidebar-item" onClick={handleLogout} style={{ marginTop: 4 }}>
              <span className="item-icon">🚪</span> ออกจากระบบ
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="admin-content">
          <header className="admin-topbar">
            <div>
              <div className="admin-topbar-title">
                {activeTab === 'dashboard' && '📊 ภาพรวมระบบ'}
                {activeTab === 'activities' && '🎯 จัดการกิจกรรม'}
                {activeTab === 'recipients' && '👥 จัดการรายชื่อผู้รับ'}
                {activeTab === 'settings' && '⚙️ ตั้งค่าองค์กร'}
              </div>
            </div>
            <div className="admin-topbar-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('settings')}>
                ⚙️ ตั้งค่า
              </button>
            </div>
          </header>

          <div className="admin-page">

            {/* ---- DASHBOARD ---- */}
            {activeTab === 'dashboard' && (
              <div className="animate-fade-in">
                <div className="grid-4" style={{ marginBottom: 32 }}>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-blue">🎯</div>
                    <div>
                      <div className="stat-value">{totalActs}</div>
                      <div className="stat-label">กิจกรรมทั้งหมด</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-gold">👥</div>
                    <div>
                      <div className="stat-value">{totalRecips}</div>
                      <div className="stat-label">รายชื่อทั้งหมด</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-green">✅</div>
                    <div>
                      <div className="stat-value">{approvedRecips}</div>
                      <div className="stat-label">อนุมัติแล้ว</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-purple">⏳</div>
                    <div>
                      <div className="stat-value">{pendingCount}</div>
                      <div className="stat-label">รออนุมัติ</div>
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  {/* Recent activities */}
                  <div className="table-container">
                    <div className="table-header">
                      <span className="table-title">กิจกรรมล่าสุด</span>
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('activities')}>ดูทั้งหมด</button>
                    </div>
                    {activities.slice(0, 5).map(a => (
                      <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: a.background_url ? `url(${a.background_url}) center/cover` : 'linear-gradient(135deg,var(--primary),var(--accent))', flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(a.cert_date)}</div>
                        </div>
                        <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                          {a.status === 'active' ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                    ))}
                    {activities.length === 0 && <div className="table-empty"><div className="table-empty-icon">🎯</div><p>ยังไม่มีกิจกรรม</p></div>}
                  </div>

                  {/* Quick actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', border: 'none', color: 'white' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'white' }}>สร้างกิจกรรมใหม่</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>เริ่มต้นสร้างกิจกรรมและเพิ่มรายชื่อผู้รับเกียรติบัตร</div>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                          onClick={() => { setActiveTab('activities'); openActModal(); }}>
                          + สร้างกิจกรรม
                        </button>
                      </div>
                    </div>
                    <div className="card" style={{ background: 'linear-gradient(135deg, var(--secondary), var(--secondary-dark))', border: 'none', color: 'white' }}>
                      <div className="card-body">
                        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'white' }}>เพิ่มรายชื่อผู้รับ</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>เพิ่มรายชื่อผู้รับเกียรติบัตรทีละคนหรือ Import CSV</div>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                          onClick={() => setActiveTab('recipients')}>
                          + เพิ่มรายชื่อ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---- ACTIVITIES ---- */}
            {activeTab === 'activities' && (
              <div className="animate-fade-in">
                <div className="page-header">
                  <div>
                    <div className="page-title">กิจกรรม</div>
                    <div className="page-subtitle">จัดการกิจกรรมและโครงการทั้งหมด</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => openActModal()}>+ สร้างกิจกรรม</button>
                </div>

                {activities.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎯</div>
                    <div className="empty-state-title">ยังไม่มีกิจกรรม</div>
                    <div className="empty-state-text">เริ่มสร้างกิจกรรมแรกของคุณ</div>
                    <button className="btn btn-primary" onClick={() => openActModal()}>+ สร้างกิจกรรม</button>
                  </div>
                ) : (
                  <div className="grid-3">
                    {activities.map(act => (
                      <div key={act.id} className="card">
                        <div className="activity-card-image">
                          {act.background_url
                            ? <img src={act.background_url} alt={act.name} />
                            : <span>🎯</span>
                          }
                        </div>
                        <div className="activity-card-body">
                          <div className="activity-card-title">{act.name}</div>
                          <div className="activity-card-desc">{act.description || '-'}</div>
                          <div className="activity-card-meta" style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📅 {formatDate(act.cert_date)}</span>
                            <span className={`badge ${act.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                              {act.status === 'active' ? '✅ เปิด' : '⏸ ปิด'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => openActModal(act)}>✏️ แก้ไข</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteActivity(act.id)}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- RECIPIENTS ---- */}
            {activeTab === 'recipients' && (
              <div className="animate-fade-in">
                <div className="page-header">
                  <div>
                    <div className="page-title">รายชื่อผู้รับเกียรติบัตร</div>
                    <div className="page-subtitle">จัดการรายชื่อ เพิ่ม หรือ Import CSV</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowRecipModal(true)}>+ เพิ่มรายชื่อ</button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <select className="form-control" style={{ width: 'auto', minWidth: 200 }}
                    value={recipActFilter} onChange={e => setRecipActFilter(e.target.value)}>
                    <option value="">ทุกกิจกรรม</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select className="form-control" style={{ width: 'auto' }}
                    value={recipStatusFilter} onChange={e => setRecipStatusFilter(e.target.value)}>
                    <option value="">ทุกสถานะ</option>
                    <option value="pending">⏳ รออนุมัติ</option>
                    <option value="approved">✅ อนุมัติแล้ว</option>
                    <option value="rejected">❌ ปฏิเสธ</option>
                  </select>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
                    แสดง {filteredRecipients.length} รายการ
                  </span>
                </div>

                <div className="table-container">
                  {filteredRecipients.length === 0 ? (
                    <div className="table-empty">
                      <div className="table-empty-icon">👥</div>
                      <p>ยังไม่มีรายชื่อ</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>ชื่อ-สกุล</th>
                            <th>กิจกรรม</th>
                            <th>รหัสเกียรติบัตร</th>
                            <th>วันที่</th>
                            <th>สถานะ</th>
                            <th>จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecipients.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                {activities.find(a => a.id === r.activity_id)?.name || '-'}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{r.cert_code}</td>
                              <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {formatDate(r.cert_date || activities.find(a => a.id === r.activity_id)?.cert_date || '')}
                              </td>
                              <td>
                                <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                                  {r.status === 'approved' ? '✅ อนุมัติ' : r.status === 'rejected' ? '❌ ปฏิเสธ' : '⏳ รออนุมัติ'}
                                </span>
                              </td>
                              <td>
                                <div className="table-actions">
                                  <button className="btn btn-outline btn-sm" onClick={() => openPreview({ ...r, activity: activities.find(a => a.id === r.activity_id) })}>🎖️ ดู</button>
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

            {/* ---- SETTINGS ---- */}
            {activeTab === 'settings' && (
              <div className="animate-fade-in" style={{ maxWidth: 700 }}>
                <div className="page-header">
                  <div>
                    <div className="page-title">ตั้งค่าองค์กร</div>
                    <div className="page-subtitle">ข้อมูลที่ปรากฏบนเกียรติบัตรและหน้าเว็บ</div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="form-group">
                      <label className="form-label">โลโก้องค์กร</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {orgForm.logo_url
                          ? <img src={orgForm.logo_url} alt="logo" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)' }} />
                          : <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: '2px dashed var(--border)' }}>🏛️</div>
                        }
                        <div>
                          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                            {logoUploading ? '⏳ กำลังอัปโหลด...' : '📁 เลือกไฟล์'}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={logoUploading} />
                          </label>
                          <div className="form-hint">PNG, JPG ขนาดแนะนำ 200x200px</div>
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">ชื่อองค์กร <span>*</span></label>
                      <input className="form-control" value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อองค์กรของคุณ" />
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">ชื่อผู้บริหาร <span>*</span></label>
                        <input className="form-control" value={orgForm.executive_name} onChange={e => setOrgForm(f => ({ ...f, executive_name: e.target.value }))} placeholder="ชื่อ-นามสกุล" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ตำแหน่งผู้บริหาร <span>*</span></label>
                        <input className="form-control" value={orgForm.executive_position} onChange={e => setOrgForm(f => ({ ...f, executive_position: e.target.value }))} placeholder="เช่น ผู้อำนวยการ" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">รูปลายเซ็นผู้บริหาร</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {orgForm.signature_url
                          ? <img src={orgForm.signature_url} alt="sig" style={{ height: 48, objectFit: 'contain', background: 'var(--bg)', borderRadius: 8, padding: 4 }} />
                          : <div style={{ width: 80, height: 48, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '2px dashed var(--border)' }}>✍️</div>
                        }
                        <div>
                          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                            {sigUploading ? '⏳ กำลังอัปโหลด...' : '📁 เลือกลายเซ็น'}
                            <input type="file" accept="image/*" onChange={handleSigUpload} style={{ display: 'none' }} disabled={sigUploading} />
                          </label>
                          <div className="form-hint">รูปลายเซ็น PNG พื้นหลังโปร่งใสจะดูดีที่สุด</div>
                        </div>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">สีหลักองค์กร</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input type="color" value={orgForm.theme_color} onChange={e => setOrgForm(f => ({ ...f, theme_color: e.target.value }))} style={{ width: 48, height: 40, border: 'none', background: 'none', cursor: 'pointer' }} />
                        <input className="form-control" value={orgForm.theme_color} onChange={e => setOrgForm(f => ({ ...f, theme_color: e.target.value }))} style={{ width: 120 }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary btn-lg" onClick={saveSettings} disabled={orgSaving}>
                    {orgSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ACTIVITY MODAL */}
      {showActModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowActModal(false); }}>
          <div className="modal animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">{editAct ? '✏️ แก้ไขกิจกรรม' : '+ สร้างกิจกรรมใหม่'}</span>
              <button className="modal-close" onClick={() => setShowActModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">ชื่อกิจกรรม/โครงการ <span>*</span></label>
                <input className="form-control" value={actForm.name} onChange={e => setActForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อกิจกรรม" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">รายละเอียด</label>
                <textarea className="form-control" value={actForm.description} onChange={e => setActForm(f => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดกิจกรรม" rows={3} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">วันที่ในเกียรติบัตร <span>*</span></label>
                  <input className="form-control" type="date" value={actForm.cert_date} onChange={e => setActForm(f => ({ ...f, cert_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">สถานะ</label>
                  <select className="form-control" value={actForm.status} onChange={e => setActForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">✅ เปิด (แสดงสาธารณะ)</option>
                    <option value="inactive">⏸ ปิด (ซ่อน)</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">รูปพื้นหลังเกียรติบัตร</label>
                {actForm.background_url ? (
                  <div className="upload-preview">
                    <img src={actForm.background_url} alt="bg" />
                    <button className="upload-preview-remove" onClick={() => setActForm(f => ({ ...f, background_url: '' }))}>✕</button>
                  </div>
                ) : (
                  <label className="upload-area" style={{ cursor: 'pointer' }}>
                    <div className="upload-icon">{actBgUploading ? '⏳' : '🖼️'}</div>
                    <div className="upload-text">
                      {actBgUploading ? 'กำลังอัปโหลด...' : <><strong>คลิกเพื่อเลือกรูปภาพ</strong> หรือลากวางที่นี่</>}
                    </div>
                    <input type="file" accept="image/*" onChange={handleActBgUpload} disabled={actBgUploading} />
                  </label>
                )}
                <div className="form-hint">PNG, JPG — แนะนำ 1200×850px สัดส่วน A4 แนวนอน</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowActModal(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveActivity} disabled={actSaving}>
                {actSaving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPIENT ADD MODAL */}
      {showRecipModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecipModal(false); }}>
          <div className="modal animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">+ เพิ่มรายชื่อผู้รับเกียรติบัตร</span>
              <button className="modal-close" onClick={() => setShowRecipModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">กิจกรรม <span>*</span></label>
                <select className="form-control" value={selectedActId} onChange={e => setSelectedActId(e.target.value)}>
                  <option value="">-- เลือกกิจกรรม --</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="tabs" style={{ marginBottom: 20 }}>
                <button className="tab active" id="tab-single">เพิ่มทีละคน</button>
                <button className="tab" id="tab-csv">Import CSV</button>
              </div>

              {/* Single add */}
              <div id="panel-single">
                <div className="form-group">
                  <label className="form-label">ชื่อ-นามสกุล <span>*</span></label>
                  <input className="form-control" value={recipForm.full_name} onChange={e => setRecipForm(f => ({ ...f, full_name: e.target.value }))} placeholder="ชื่อ นามสกุล" />
                </div>
                <div className="form-group">
                  <label className="form-label">รายละเอียดเพิ่มเติม</label>
                  <input className="form-control" value={recipForm.extra_details} onChange={e => setRecipForm(f => ({ ...f, extra_details: e.target.value }))} placeholder="เช่น ตำแหน่ง, หน่วยงาน" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">วันที่ (ถ้าต้องการ override)</label>
                  <input className="form-control" type="date" value={recipForm.cert_date} onChange={e => setRecipForm(f => ({ ...f, cert_date: e.target.value }))} />
                  <div className="form-hint">ถ้าไม่กรอก จะใช้วันที่ของกิจกรรม</div>
                </div>
              </div>

              <div className="divider" style={{ margin: '20px 0' }} />

              {/* CSV Import */}
              <div>
                <label className="form-label">Import จาก CSV</label>
                <div className="alert alert-info" style={{ marginBottom: 12 }}>
                  <span>ℹ️</span>
                  <span>Format: <strong>full_name, extra_details, cert_date</strong><br />บรรทัดแรกเป็น header — cert_date ไม่จำเป็น</span>
                </div>
                <label className="upload-area" style={{ cursor: 'pointer', padding: 20 }}>
                  <div className="upload-icon">📄</div>
                  <div className="upload-text">
                    {csvFile ? <><strong>{csvFile.name}</strong></> : <><strong>เลือกไฟล์ CSV</strong></>}
                  </div>
                  <input type="file" accept=".csv,text/csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                </label>
                {csvFile && (
                  <button className="btn btn-secondary w-full mt-2" onClick={importCSV} disabled={importLoading}>
                    {importLoading ? '⏳ กำลัง Import...' : '⬆️ Import CSV'}
                  </button>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRecipModal(false)}>ปิด</button>
              <button className="btn btn-primary" onClick={saveRecipient} disabled={recipSaving}>
                {recipSaving ? '⏳ กำลังบันทึก...' : '💾 เพิ่มรายชื่อ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CERTIFICATE PREVIEW MODAL */}
      {previewRecip && org && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPreviewRecip(null); }}>
          <div className="modal modal-xl animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">🎖️ Preview เกียรติบัตร</span>
              <button className="modal-close" onClick={() => setPreviewRecip(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="cert-wrapper">
                <div id="admin-cert-render" className="cert-container">
                  {previewRecip.activity?.background_url
                    ? <img src={previewRecip.activity.background_url} alt="bg" className="cert-bg" crossOrigin="anonymous" />
                    : <div className="cert-bg-default" />
                  }
                  <div className="cert-overlay" />
                  <div className="cert-content">
                    <div className="cert-header">
                      {org.logo_url
                        ? <img src={org.logo_url} alt="logo" className="cert-logo" crossOrigin="anonymous" />
                        : <div className="cert-logo" style={{ background: 'rgba(255,255,255,0.2)', display:'flex',alignItems:'center',justifyContent:'center',fontSize:24 }}>🏛️</div>
                      }
                      <div className="cert-org-name">{org.name}</div>
                    </div>
                    <div className="cert-body">
                      <div className="cert-title">เกียรติบัตร</div>
                      <div className="cert-present-text">มอบเกียรติบัตรฉบับนี้ให้แก่</div>
                      <div className="cert-recipient">{previewRecip.full_name}</div>
                      <div className="cert-divider" />
                      <div className="cert-activity">{previewRecip.activity?.name}</div>
                      {(previewRecip.extra_details || previewRecip.activity?.description) && (
                        <div className="cert-desc">{previewRecip.extra_details || previewRecip.activity?.description}</div>
                      )}
                      <div className="cert-date">วันที่ {formatDateFull(previewRecip.cert_date || previewRecip.activity?.cert_date || '')}</div>
                    </div>
                    <div className="cert-footer">
                      <div className="cert-signature">
                        {org.signature_url && <img src={org.signature_url} alt="sig" className="cert-signature-img" crossOrigin="anonymous" />}
                        <div className="cert-signature-line" />
                        <div className="cert-signature-name">{org.executive_name}</div>
                        <div className="cert-signature-pos">{org.executive_position}</div>
                      </div>
                      <div className="cert-qr">{previewQR && <img src={previewQR} alt="qr" />}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPreviewRecip(null)}>ปิด</button>
              <button className="btn btn-secondary" onClick={() => downloadCert('png')}>⬇️ PNG</button>
              <button className="btn btn-primary" onClick={() => downloadCert('pdf')}>📄 PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={() => removeToast(t.id)} />)}
      </div>
    </>
  );
}
