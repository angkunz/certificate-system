'use client';
import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

interface OrgSettings {
  name: string;
  logo_url: string | null;
  executive_name: string;
  executive_position: string;
  signature_url: string | null;
}

interface Activity {
  id: string;
  name: string;
  description: string;
  cert_date: string;
  background_url: string | null;
  status: string;
}

interface Recipient {
  id: string;
  activity_id: string;
  full_name: string;
  cert_code: string;
  extra_details: string | null;
  cert_date: string | null;
  status: string;
  activity?: Activity;
}

export default function PublicPage() {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Recipient | null>(null);
  const [activeView, setActiveView] = useState<'activities' | 'search'>('activities');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [orgRes, actRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/activities'),
    ]);
    const orgData = await orgRes.json();
    const actData = await actRes.json();
    setOrg(orgData.data);
    setActivities(actData.data || []);
    setLoading(false);
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/recipients?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.data || []);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }

  async function handleSearchByCode(code: string) {
    if (!code.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/recipients?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.data) {
        await openCertificate(data.data);
      } else {
        alert('ไม่พบเกียรติบัตรสำหรับรหัสนี้');
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function openCertificate(recipient: Recipient) {
    setSelectedCert(recipient);
    const url = `${window.location.origin}/certificate/${recipient.cert_code}`;
    try {
      const qr = await QRCode.toDataURL(url, { width: 120, margin: 1 });
      setQrDataUrl(qr);
    } catch { setQrDataUrl(''); }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  async function downloadCertificate(type: 'png' | 'pdf') {
    const el = document.getElementById('cert-render');
    if (!el) return;
    if (type === 'png') {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = `เกียรติบัตร-${selectedCert?.full_name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`เกียรติบัตร-${selectedCert?.full_name}.pdf`);
    }
  }

  const certDate = selectedCert?.cert_date || selectedCert?.activity?.cert_date || '';

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar-inner">
          <a className="navbar-brand" href="/">
            {org?.logo_url ? (
              <img src={org.logo_url} alt="logo" className="navbar-logo" />
            ) : (
              <div className="navbar-logo-placeholder">🏛️</div>
            )}
            <span className="navbar-name">{org?.name || 'ระบบออกเกียรติบัตรออนไลน์'}</span>
          </a>
          <ul className="navbar-links">
            <li>
              <button
                className={`navbar-link${activeView === 'activities' ? ' active' : ''}`}
                onClick={() => setActiveView('activities')}
              >🎖️ กิจกรรม</button>
            </li>
            <li>
              <button
                className={`navbar-link${activeView === 'search' ? ' active' : ''}`}
                onClick={() => setActiveView('search')}
              >🔍 ค้นหาเกียรติบัตร</button>
            </li>
            <li>
              <a href="/admin" className="navbar-link btn-outline">⚙️ แอดมิน</a>
            </li>
          </ul>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          {org?.logo_url && (
            <img src={org.logo_url} alt="org logo" className="hero-org-logo" />
          )}
          <div className="hero-badge">🏆 ระบบออกเกียรติบัตรออนไลน์</div>
          <h1 className="font-display">{org?.name || 'ระบบออกเกียรติบัตรออนไลน์'}</h1>
          <p>ค้นหาและดาวน์โหลดเกียรติบัตรของคุณได้ทันที ปลอดภัย พร้อม QR Code ยืนยัน</p>
          {/* Quick Search */}
          <div className="search-box" style={{ marginTop: 0 }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <input
              type="text"
              placeholder="ค้นหาด้วยชื่อ-สกุล หรือรหัสเกียรติบัตร..."
              value={searchQuery}
              onFocus={() => setActiveView('search')}
              onChange={e => { setActiveView('search'); handleSearch(e.target.value); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.includes('-')) handleSearchByCode(searchQuery);
              }}
            />
            <button
              className="btn btn-primary"
              style={{ borderRadius: 999 }}
              onClick={() => {
                if (searchQuery.includes('-')) handleSearchByCode(searchQuery);
                else if (searchQuery) setActiveView('search');
              }}
            >ค้นหา</button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>
            พิมพ์ชื่อเพื่อค้นหา หรือป้อนรหัสเกียรติบัตร (เช่น ACT-xxxxx-xxxx) แล้วกด Enter
          </p>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <main style={{ padding: '48px 0', minHeight: '60vh' }}>
        <div className="container">

          {/* ACTIVITIES VIEW */}
          {activeView === 'activities' && (
            <>
              <div className="section-header">
                <h2 className="section-title">กิจกรรมและโครงการ</h2>
                <p className="section-subtitle">รายการกิจกรรมที่มีการมอบเกียรติบัตร</p>
              </div>
              {loading ? (
                <div className="grid-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="card">
                      <div className="skeleton" style={{ height: 180 }} />
                      <div className="card-body">
                        <div className="skeleton" style={{ height: 20, marginBottom: 10 }} />
                        <div className="skeleton" style={{ height: 14, marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 14, width: '60%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎖️</div>
                  <div className="empty-state-title">ยังไม่มีกิจกรรม</div>
                  <div className="empty-state-text">กิจกรรมที่มีเกียรติบัตรจะแสดงที่นี่</div>
                </div>
              ) : (
                <div className="grid-3">
                  {activities.map((act, i) => (
                    <div
                      key={act.id}
                      className="card activity-card animate-slide-up"
                      style={{ animationDelay: `${i * 0.07}s` }}
                      onClick={() => { setActiveView('search'); setSearchQuery(''); setSearchResults([]); }}
                    >
                      <div className="activity-card-image">
                        {act.background_url
                          ? <img src={act.background_url} alt={act.name} />
                          : <span>🎖️</span>
                        }
                      </div>
                      <div className="activity-card-body">
                        <div className="activity-card-title">{act.name}</div>
                        <div className="activity-card-desc">{act.description || 'ไม่มีรายละเอียด'}</div>
                        <div className="activity-card-meta">
                          <span>📅 {formatDate(act.cert_date)}</span>
                          <span className="badge badge-success">✅ มีเกียรติบัตร</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* SEARCH VIEW */}
          {activeView === 'search' && (
            <>
              <div className="section-header">
                <h2 className="section-title">ค้นหาเกียรติบัตร</h2>
                <p className="section-subtitle">ค้นหาด้วยชื่อ-นามสกุล หรือรหัสเกียรติบัตร</p>
              </div>
              <div style={{ maxWidth: 600, margin: '0 auto 32px' }}>
                <div className="search-box">
                  <span style={{ fontSize: 20 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="ชื่อ-นามสกุล หรือรหัสเกียรติบัตร..."
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && searchQuery.includes('-')) handleSearchByCode(searchQuery);
                    }}
                    autoFocus
                  />
                  {searchQuery && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>✕</button>
                  )}
                </div>
              </div>

              {isSearching && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div className="loading" style={{ display: 'inline-block' }}>⏳ กำลังค้นหา...</div>
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700, margin: '0 auto' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>พบ {searchResults.length} รายการ</p>
                  {searchResults.map(r => (
                    <div key={r.id} className="search-result-card animate-slide-up" onClick={() => openCertificate(r)}>
                      <div className="search-result-icon">🎖️</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{r.full_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {r.activity?.name} • {formatDate(r.cert_date || r.activity?.cert_date || '')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2, fontFamily: 'monospace' }}>
                          รหัส: {r.cert_code}
                        </div>
                      </div>
                      <span className="badge badge-success">✅ อนุมัติแล้ว</span>
                    </div>
                  ))}
                </div>
              )}

              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">ไม่พบเกียรติบัตร</div>
                  <div className="empty-state-text">
                    ไม่พบเกียรติบัตรสำหรับ &quot;{searchQuery}&quot;<br />
                    ลองตรวจสอบการสะกดชื่อ หรือรหัสเกียรติบัตร
                  </div>
                </div>
              )}

              {!searchQuery && (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">เริ่มค้นหา</div>
                  <div className="empty-state-text">พิมพ์ชื่อ-นามสกุลหรือรหัสเกียรติบัตรในช่องด้านบน</div>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} {org?.name} · ระบบออกเกียรติบัตรออนไลน์</p>
      </footer>

      {/* CERTIFICATE MODAL */}
      {selectedCert && org && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedCert(null); }}>
          <div className="modal modal-xl animate-slide-up">
            <div className="modal-header">
              <span className="modal-title">🎖️ เกียรติบัตร</span>
              <button className="modal-close" onClick={() => setSelectedCert(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="cert-wrapper">
                {/* CERTIFICATE RENDER */}
                <div id="cert-render" className="cert-container">
                  {selectedCert.activity?.background_url
                    ? <img src={selectedCert.activity.background_url} alt="bg" className="cert-bg" crossOrigin="anonymous" />
                    : <div className="cert-bg-default" />
                  }
                  <div className="cert-overlay" />
                  <div className="cert-content">
                    {/* Header */}
                    <div className="cert-header">
                      {org.logo_url
                        ? <img src={org.logo_url} alt="logo" className="cert-logo" crossOrigin="anonymous" />
                        : <div className="cert-logo" style={{ background: 'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🏛️</div>
                      }
                      <div className="cert-org-name">{org.name}</div>
                    </div>

                    {/* Body */}
                    <div className="cert-body">
                      <div className="cert-title">เกียรติบัตร</div>
                      <div className="cert-present-text">มอบเกียรติบัตรฉบับนี้ให้แก่</div>
                      <div className="cert-recipient">{selectedCert.full_name}</div>
                      <div className="cert-divider" />
                      <div className="cert-activity">{selectedCert.activity?.name}</div>
                      {(selectedCert.extra_details || selectedCert.activity?.description) && (
                        <div className="cert-desc">
                          {selectedCert.extra_details || selectedCert.activity?.description}
                        </div>
                      )}
                      <div className="cert-date">วันที่ {formatDate(certDate)}</div>
                    </div>

                    {/* Footer */}
                    <div className="cert-footer">
                      <div className="cert-signature">
                        {org.signature_url && (
                          <img src={org.signature_url} alt="signature" className="cert-signature-img" crossOrigin="anonymous" />
                        )}
                        <div className="cert-signature-line" />
                        <div className="cert-signature-name">{org.executive_name}</div>
                        <div className="cert-signature-pos">{org.executive_position}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 4 }}>
                          ตรวจสอบเกียรติบัตร
                        </div>
                        <div className="cert-qr">
                          {qrDataUrl && <img src={qrDataUrl} alt="qr" />}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2, fontFamily: 'monospace', maxWidth: 70, wordBreak: 'break-all' }}>
                          {selectedCert.cert_code}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* INFO */}
                <div style={{ width: '100%', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ชื่อ-สกุล</div>
                      <div style={{ fontWeight: 700 }}>{selectedCert.full_name}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>กิจกรรม</div>
                      <div style={{ fontWeight: 600 }}>{selectedCert.activity?.name}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>วันที่</div>
                      <div style={{ fontWeight: 600 }}>{formatDate(certDate)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>รหัสเกียรติบัตร</div>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)' }}>
                        {selectedCert.cert_code}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedCert(null)}>ปิด</button>
              <button className="btn btn-secondary" onClick={() => downloadCertificate('png')}>
                ⬇️ ดาวน์โหลด PNG
              </button>
              <button className="btn btn-primary" onClick={() => downloadCertificate('pdf')}>
                📄 ดาวน์โหลด PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
