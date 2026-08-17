'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import CertificateTemplate from '../../components/CertificateTemplate';
import { mergeLayout } from '../../components/certLayout';
import type { CertLayout } from '../../components/certLayout';

interface OrgSettings { name: string; logo_url: string | null; executive_name: string; executive_position: string; signature_url: string | null; cert_layout?: Partial<CertLayout>; }
interface Activity { id: string; name: string; description: string; cert_date: string; background_url: string | null; }
interface Recipient { id: string; full_name: string; cert_code: string; extra_details: string | null; award: string | null; cert_date: string | null; status: string; activity?: Activity; }

export default function CertificatePageClient({ recipient, org }: { recipient: Recipient; org: OrgSettings }) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/certificate/${recipient.cert_code}`
      : window.location.href;
    QRCode.toDataURL(url, { width: 140, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [recipient.cert_code]);

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  async function downloadCert(type: 'png' | 'pdf') {
    const el = document.getElementById('cert-page-render'); if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, logging: false });
    if (type === 'png') {
      const link = document.createElement('a');
      link.download = `เกียรติบัตร-${recipient.full_name}.png`;
      link.href = canvas.toDataURL('image/png'); link.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
      pdf.save(`เกียรติบัตร-${recipient.full_name}.pdf`);
    }
  }

  const certLayout = org?.cert_layout ? mergeLayout(org.cert_layout) : undefined;
  const certDate = recipient.cert_date || recipient.activity?.cert_date || '';

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <a href="/" className="navbar-brand">
            {org.logo_url ? <img src={org.logo_url} alt="logo" className="navbar-logo" /> : <div className="navbar-logo-placeholder">🏛️</div>}
            <span className="navbar-name">{org.name}</span>
          </a>
          <span className="badge badge-success">✅ เกียรติบัตรได้รับการยืนยัน</span>
        </div>
      </nav>

      <main style={{ padding:'48px 0', minHeight:'80vh' }}>
        <div className="container" style={{ maxWidth:900 }}>
          <div className="alert alert-success" style={{ marginBottom:24, fontSize:15 }}>
            <span style={{ fontSize:22 }}>✅</span>
            <div>
              <strong>เกียรติบัตรฉบับนี้ได้รับการยืนยันความถูกต้อง</strong>
              <div style={{ fontSize:13, marginTop:2 }}>รหัส: <span style={{ fontFamily:'monospace', fontWeight:700 }}>{recipient.cert_code}</span></div>
            </div>
          </div>

          <div className="cert-wrapper" style={{ marginBottom:20 }}>
            <CertificateTemplate
              id="cert-page-render"
              org={org}
              recipient={recipient}
              qrDataUrl={qrDataUrl}
              layout={certLayout}
            />
          </div>

          <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:32, flexWrap:'wrap' }}>
            <button className="btn btn-secondary btn-lg" onClick={() => downloadCert('png')}>⬇️ ดาวน์โหลด PNG</button>
            <button className="btn btn-primary btn-lg" onClick={() => downloadCert('pdf')}>📄 ดาวน์โหลด PDF</button>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 style={{ marginBottom:16, fontSize:16, fontWeight:700 }}>📋 รายละเอียดเกียรติบัตร</h3>
              <div className="grid-2" style={{ gap:24 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>ชื่อ-นามสกุล</div><div style={{ fontWeight:700, fontSize:17 }}>{recipient.full_name}</div></div>
                  <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>กิจกรรม/โครงการ</div><div style={{ fontWeight:600 }}>{recipient.activity?.name}</div></div>
                  {recipient.award && (
                    <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>รางวัล/ผลงาน</div><div style={{ fontWeight:600, color:'var(--secondary-dark)' }}>{recipient.award}</div></div>
                  )}
                  {recipient.extra_details && (
                    <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>รายละเอียดเพิ่มเติม</div><div>{recipient.extra_details}</div></div>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>วันที่มอบ</div><div style={{ fontWeight:600 }}>{formatDate(certDate)}</div></div>
                  <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>รหัสเกียรติบัตร</div><div style={{ fontFamily:'monospace', color:'var(--primary)', fontWeight:700, fontSize:14 }}>{recipient.cert_code}</div></div>
                  <div><div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:3 }}>สถานะ</div><span className="badge badge-success">✅ อนุมัติแล้ว</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign:'center', marginTop:24 }}>
            <a href="/" style={{ fontSize:14, color:'var(--primary)', textDecoration:'none' }}>← กลับหน้าหลัก</a>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} {org.name} · ระบบออกเกียรติบัตรออนไลน์</p>
      </footer>
    </>
  );
}
