'use client';
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface OrgSettings { name: string; logo_url: string | null; executive_name: string; executive_position: string; signature_url: string | null; }
interface Activity { id: string; name: string; description: string; cert_date: string; background_url: string | null; }
interface Recipient { id: string; full_name: string; cert_code: string; extra_details: string | null; award: string | null; cert_date: string | null; status: string; activity?: Activity; }

export default function CertificateClient({ recipient, org }: { recipient: Recipient; org: OrgSettings }) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(window.location.href, { width: 120, margin: 1 })
      .then(setQrDataUrl).catch(() => {});
  }, []);

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  async function downloadCert(type: 'png' | 'pdf') {
    const el = document.getElementById('cert-page-render');
    if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true });
    if (type === 'png') {
      const link = document.createElement('a');
      link.download = `เกียรติบัตร-${recipient.full_name}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, 297, 210);
      pdf.save(`เกียรติบัตร-${recipient.full_name}.pdf`);
    }
  }

  const certDate = recipient.cert_date || recipient.activity?.cert_date || '';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <a href="/" className="navbar-brand">
            {org.logo_url
              ? <img src={org.logo_url} alt="logo" className="navbar-logo" />
              : <div className="navbar-logo-placeholder">🏛️</div>
            }
            <span className="navbar-name">{org.name}</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-success">✅ ยืนยันแล้ว</span>
          </div>
        </div>
      </nav>

      <main style={{ padding: '48px 24px', minHeight: '80vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Verification banner */}
          <div className="alert alert-success" style={{ marginBottom: 24, fontSize: 15 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div>
              <strong>เกียรติบัตรฉบับนี้ได้รับการยืนยันแล้ว</strong>
              <div style={{ fontSize: 13, marginTop: 2 }}>รหัส: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{recipient.cert_code}</span></div>
            </div>
          </div>

          {/* Certificate */}
          <div className="cert-wrapper" style={{ marginBottom: 24 }}>
            <div id="cert-page-render" className="cert-container">
              {recipient.activity?.background_url
                ? <img src={recipient.activity.background_url} alt="bg" className="cert-bg" crossOrigin="anonymous" />
                : <div className="cert-bg-default" />
              }
              <div className="cert-overlay" />
              <div className="cert-content">
                <div className="cert-header">
                  {org.logo_url
                    ? <img src={org.logo_url} alt="logo" className="cert-logo" crossOrigin="anonymous" />
                    : <div className="cert-logo" style={{ background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24 }}>🏛️</div>
                  }
                  <div className="cert-org-name">{org.name}</div>
                </div>
                <div className="cert-body">
                  <div className="cert-title">เกียรติบัตร</div>
                  <div className="cert-present-text">มอบเกียรติบัตรฉบับนี้ให้แก่</div>
                  <div className="cert-recipient">{recipient.full_name}</div>
                  <div className="cert-divider" />
                  <div className="cert-activity">{recipient.activity?.name}</div>
                  {(recipient.extra_details || recipient.activity?.description) && (
                    <div className="cert-desc">{recipient.extra_details || recipient.activity?.description}</div>
                  )}
                  <div className="cert-date">วันที่ {formatDate(certDate)}</div>
                </div>
                <div className="cert-footer">
                  <div className="cert-signature">
                    {org.signature_url && <img src={org.signature_url} alt="sig" className="cert-signature-img" crossOrigin="anonymous" />}
                    <div className="cert-signature-line" />
                    <div className="cert-signature-name">{org.executive_name}</div>
                    <div className="cert-signature-pos">{org.executive_position}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 4 }}>ตรวจสอบเกียรติบัตร</div>
                    <div className="cert-qr">{qrDataUrl && <img src={qrDataUrl} alt="qr" />}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 2, fontFamily: 'monospace', maxWidth: 70, wordBreak: 'break-all' }}>
                      {recipient.cert_code}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Download buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
            <button className="btn btn-secondary btn-lg" onClick={() => downloadCert('png')}>⬇️ ดาวน์โหลด PNG</button>
            <button className="btn btn-primary btn-lg" onClick={() => downloadCert('pdf')}>📄 ดาวน์โหลด PDF</button>
          </div>

          {/* Info Card */}
          <div className="card">
            <div className="card-body">
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>📋 รายละเอียดเกียรติบัตร</h3>
              <div className="grid-2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>ชื่อ-นามสกุล</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{recipient.full_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>กิจกรรม/โครงการ</div>
                    <div style={{ fontWeight: 600 }}>{recipient.activity?.name}</div>
                  </div>
                  {recipient.award && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>🏆 รางวัล/ผลงาน</div>
                      <div style={{ fontWeight: 600, color: 'var(--secondary-dark)' }}>{recipient.award}</div>
                    </div>
                  )}
                  {recipient.extra_details && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>รายละเอียดเพิ่มเติม</div>
                      <div>{recipient.extra_details}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>วันที่มอบ</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(certDate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>รหัสเกียรติบัตร</div>
                    <div style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{recipient.cert_code}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>สถานะ</div>
                    <span className="badge badge-success">✅ อนุมัติแล้ว</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <a href="/" style={{ fontSize: 14, color: 'var(--primary)', textDecoration: 'none' }}>← กลับหน้าหลัก</a>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} {org.name} · ระบบออกเกียรติบัตรออนไลน์</p>
      </footer>
    </>
  );
}
