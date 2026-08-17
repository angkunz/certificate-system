import { notFound } from 'next/navigation';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%)',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      textAlign: 'center',
      color: 'white',
    }}>
      <div style={{ fontSize: 80 }}>🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white' }}>ไม่พบเกียรติบัตร</h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, maxWidth: 400 }}>
        ไม่พบเกียรติบัตรที่ตรงกับรหัสนี้ หรือเกียรติบัตรยังไม่ได้รับการอนุมัติ
      </p>
      <a href="/" style={{
        marginTop: 8,
        padding: '12px 28px',
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 12,
        color: 'white',
        textDecoration: 'none',
        fontSize: 15,
        fontWeight: 600,
      }}>← กลับหน้าหลัก</a>
    </div>
  );
}
