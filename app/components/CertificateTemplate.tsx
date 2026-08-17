'use client';
import { useRef, useCallback, useEffect } from 'react';
import type { CertLayout, CertElement } from './certLayout';
import { DEFAULT_CERT_LAYOUT } from './certLayout';

export interface OrgSettings {
  name: string;
  logo_url: string | null;
  executive_name: string;
  executive_position: string;
  signature_url: string | null;
}

export interface CertActivity {
  id?: string;
  name: string;
  description?: string;
  cert_date: string;
  background_url: string | null;
}

export interface CertRecipient {
  id?: string;
  full_name: string;
  cert_code: string;
  extra_details?: string | null;
  cert_date?: string | null;
  activity?: CertActivity;
}

interface Props {
  id?: string;
  org: OrgSettings;
  recipient: CertRecipient;
  qrDataUrl?: string;
  layout?: CertLayout;
  editMode?: boolean;
  onLayoutChange?: (layout: CertLayout) => void;
}

function formatDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function getTransform(el: CertElement) {
  if (el.align === 'center') return 'translate(-50%, -50%)';
  if (el.align === 'right') return 'translate(-100%, -50%)';
  return 'translateY(-50%)';
}

export default function CertificateTemplate({
  id, org, recipient, qrDataUrl, layout: layoutProp, editMode = false, onLayoutChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layout = layoutProp || DEFAULT_CERT_LAYOUT;
  const draggingKey = useRef<keyof CertLayout | null>(null);
  const certDate = recipient.cert_date || recipient.activity?.cert_date || '';

  const startDrag = useCallback((key: keyof CertLayout) => (e: React.MouseEvent | React.TouchEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    draggingKey.current = key;
  }, [editMode]);

  useEffect(() => {
    if (!editMode) return;

    const move = (clientX: number, clientY: number) => {
      if (!draggingKey.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.round(Math.min(97, Math.max(3, ((clientX - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.min(97, Math.max(3, ((clientY - rect.top) / rect.height) * 100)));
      onLayoutChange?.({ ...layout, [draggingKey.current]: { ...layout[draggingKey.current], x, y } });
    };

    const onMM = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTM = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => { draggingKey.current = null; };

    window.addEventListener('mousemove', onMM);
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [editMode, layout, onLayoutChange]);

  const el = (key: keyof CertLayout): React.CSSProperties => ({
    position: 'absolute',
    left: `${layout[key].x}%`,
    top: `${layout[key].y}%`,
    transform: getTransform(layout[key]),
    cursor: editMode ? 'move' : 'default',
    userSelect: 'none',
    zIndex: editMode ? 10 : 1,
    ...(editMode ? { outline: '1.5px dashed rgba(255,255,100,0.8)', outlineOffset: 4, borderRadius: 4 } : {}),
  });

  const hidden = (key: keyof CertLayout) => !layout[key].visible ? { display: 'none' } : {};

  return (
    <div
      id={id}
      ref={containerRef}
      className="cert-container"
      style={{ touchAction: editMode ? 'none' : 'auto', position: 'relative', overflow: 'hidden' }}
    >
      {/* Background */}
      {recipient.activity?.background_url
        ? <img src={recipient.activity.background_url} alt="bg" className="cert-bg" crossOrigin="anonymous" />
        : <div className="cert-bg-default" />
      }
      <div className="cert-overlay" />

      {/* ── Logo ── */}
      <div style={{ ...el('logo'), ...hidden('logo') }}
        onMouseDown={startDrag('logo')} onTouchStart={startDrag('logo')}>
        {org.logo_url
          ? <img src={org.logo_url} alt="logo" crossOrigin="anonymous"
              style={{ width: 'clamp(30px,7.1%,60px)', height: 'clamp(30px,7.1%,60px)', borderRadius: 8, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', display: 'block' }} />
          : <div style={{ width: 'clamp(30px,7.1%,60px)', height: 'clamp(30px,7.1%,60px)', borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(14px,3.5%,28px)', color: 'white' }}>🏛️</div>
        }
      </div>

      {/* ── Org Name ── */}
      <div style={{ ...el('orgName'), ...hidden('orgName'), color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: 'clamp(8px,1.8%,16px)', maxWidth: '40%', lineHeight: 1.3 }}
        onMouseDown={startDrag('orgName')} onTouchStart={startDrag('orgName')}>
        {org.name}
      </div>

      {/* ── Title ── */}
      <div style={{ ...el('title'), ...hidden('title'), fontFamily: "'Playfair Display','Sarabun',serif", fontSize: 'clamp(16px,4.5%,40px)', fontWeight: 700, color: '#fcd34d', letterSpacing: '0.08em', textShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}
        onMouseDown={startDrag('title')} onTouchStart={startDrag('title')}>
        เกียรติบัตร
      </div>

      {/* ── Present Text ── */}
      <div style={{ ...el('presentText'), ...hidden('presentText'), color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(7px,1.5%,14px)', whiteSpace: 'nowrap' }}
        onMouseDown={startDrag('presentText')} onTouchStart={startDrag('presentText')}>
        มอบเกียรติบัตรฉบับนี้ให้แก่
      </div>

      {/* ── Recipient ── */}
      <div style={{ ...el('recipient'), ...hidden('recipient'), fontFamily: "'Playfair Display','Sarabun',serif", fontSize: 'clamp(13px,3.5%,32px)', fontWeight: 700, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis' }}
        onMouseDown={startDrag('recipient')} onTouchStart={startDrag('recipient')}>
        {recipient.full_name}
      </div>

      {/* ── Divider ── */}
      <div style={{ ...el('divider'), ...hidden('divider'), width: 'clamp(40px,10%,80px)', height: 2, background: 'linear-gradient(90deg,transparent,#fcd34d,transparent)' }}
        onMouseDown={startDrag('divider')} onTouchStart={startDrag('divider')} />

      {/* ── Activity ── */}
      <div style={{ ...el('activity'), ...hidden('activity'), fontSize: 'clamp(9px,2%,17px)', fontWeight: 700, color: '#fcd34d', whiteSpace: 'nowrap', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis' }}
        onMouseDown={startDrag('activity')} onTouchStart={startDrag('activity')}>
        {recipient.activity?.name}
      </div>

      {/* ── Description ── */}
      {(recipient.extra_details || recipient.activity?.description) && (
        <div style={{ ...el('description'), ...hidden('description'), fontSize: 'clamp(7px,1.3%,12px)', color: 'rgba(255,255,255,0.75)', maxWidth: '70%', lineHeight: 1.5, textAlign: layout.description.align }}
          onMouseDown={startDrag('description')} onTouchStart={startDrag('description')}>
          {recipient.extra_details || recipient.activity?.description}
        </div>
      )}

      {/* ── Date ── */}
      {certDate && (
        <div style={{ ...el('date'), ...hidden('date'), fontSize: 'clamp(7px,1.3%,13px)', color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}
          onMouseDown={startDrag('date')} onTouchStart={startDrag('date')}>
          วันที่ {formatDate(certDate)}
        </div>
      )}

      {/* ── Signature ── */}
      <div style={{ ...el('signature'), ...hidden('signature'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
        onMouseDown={startDrag('signature')} onTouchStart={startDrag('signature')}>
        {org.signature_url && (
          <img src={org.signature_url} alt="sig" crossOrigin="anonymous"
            style={{ height: 'clamp(20px,5%,40px)', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 2 }} />
        )}
        <div style={{ width: 'clamp(60px,14%,120px)', height: 1, background: 'rgba(255,255,255,0.5)' }} />
        <div style={{ fontSize: 'clamp(7px,1.2%,12px)', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', marginTop: 2 }}>
          {org.executive_name}
        </div>
        <div style={{ fontSize: 'clamp(6px,1%,10px)', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
          {org.executive_position}
        </div>
      </div>

      {/* ── QR Code ── */}
      {qrDataUrl && (
        <div style={{ ...el('qr'), ...hidden('qr'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
          onMouseDown={startDrag('qr')} onTouchStart={startDrag('qr')}>
          <div style={{ fontSize: 'clamp(6px,0.9%,10px)', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
            ตรวจสอบเกียรติบัตร
          </div>
          <div style={{ background: 'white', borderRadius: 6, padding: 4, width: 'clamp(38px,8%,68px)', height: 'clamp(38px,8%,68px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={qrDataUrl} alt="qr" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ fontSize: 'clamp(5px,0.75%,9px)', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', maxWidth: 'clamp(38px,8%,68px)', wordBreak: 'break-all', textAlign: 'center' }}>
            {recipient.cert_code}
          </div>
        </div>
      )}

      {/* Edit mode hint */}
      {editMode && (
        <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: 'white', fontSize: 'clamp(8px,1.2%,11px)', padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20 }}>
          🖱️ ลากองค์ประกอบเพื่อย้ายตำแหน่ง
        </div>
      )}
    </div>
  );
}
