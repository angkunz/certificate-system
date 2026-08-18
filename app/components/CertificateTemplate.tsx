'use client';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { CertLayout, CertElement } from './certLayout';
import { DEFAULT_CERT_LAYOUT } from './certLayout';

interface OrgSettings { name: string; logo_url: string | null; executive_name: string; executive_position: string; signature_url: string | null; }
interface CertActivity { id?: string; name: string; description: string; cert_date: string; background_url: string | null; }
export interface CertRecipient {
  id?: string;
  full_name: string;
  cert_code: string;
  extra_details?: string | null;
  award?: string | null;
  cert_date?: string | null;
  activity?: CertActivity;
}

interface Props {
  id?: string;
  org: OrgSettings;
  recipient: CertRecipient;
  qrDataUrl: string;
  layout?: CertLayout;
  editMode?: boolean;
  onLayoutChange?: (layout: CertLayout) => void;
}

export default function CertificateTemplate({
  id, org, recipient, qrDataUrl, layout: layoutProp, editMode = false, onLayoutChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const layout = layoutProp || DEFAULT_CERT_LAYOUT;
  const draggingKey = useRef<keyof CertLayout | null>(null);
  const certDate = recipient.cert_date || recipient.activity?.cert_date || '';

  useEffect(() => {
    if (!scalerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setScale(entry.contentRect.width / 842);
      }
    });
    resizeObserver.observe(scalerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

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
      const x = Math.round(Math.min(97, Math.max(3, ((clientX - rect.left) / (rect.width)) * 100)));
      const y = Math.round(Math.min(97, Math.max(3, ((clientY - rect.top) / (rect.height)) * 100)));
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
  }, [editMode, layout, onLayoutChange, scale]);

  const getTransform = (elLayout: CertElement) => {
    if (elLayout.align === 'center') return 'translate(-50%, -50%)';
    if (elLayout.align === 'right') return 'translate(-100%, -50%)';
    return 'translate(0, -50%)';
  };

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
  const sz = (key: keyof CertLayout) => (layout[key]?.size ?? 100) / 100;

  const textStyle = (key: keyof CertLayout, defaultColor: string): React.CSSProperties => {
    const e = layout[key];
    const fs = e.fontStyle || 'normal';
    return {
      color: e.color || defaultColor,
      fontStyle: (fs === 'italic' || fs === 'bold-italic') ? 'italic' : 'normal',
      fontWeight: fs === 'bold-italic' ? 800 : undefined,
      textAlign: e.align as React.CSSProperties['textAlign'],
    };
  };

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d);
    const m = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  return (
    <div ref={scalerRef} style={{ width: '100%', maxWidth: 842, aspectRatio: '842/595', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
      <div
        id={id}
        ref={containerRef}
        style={{
          width: 842, height: 595,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          touchAction: editMode ? 'none' : 'auto', position: 'absolute', top: 0, left: 0, overflow: 'hidden'
        }}
      >
        {recipient.activity?.background_url
          ? <img src={recipient.activity.background_url} alt="bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
          : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%)' }} />
        }

        <div style={{ ...el('logo'), ...hidden('logo') }}
          onMouseDown={startDrag('logo')} onTouchStart={startDrag('logo')}>
          {org.logo_url
            ? <img src={org.logo_url} alt="logo" crossOrigin="anonymous"
                style={{ height: `calc(84px * ${sz('logo')})`, width: 'auto', objectFit: 'contain', display: 'block' }} />
            : <div style={{ width: `calc(84px * ${sz('logo')})`, height: `calc(84px * ${sz('logo')})`, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `calc(44px * ${sz('logo')})`, color: 'white' }}>🏛️</div>
          }
        </div>

        <div style={{ ...el('orgName'), ...hidden('orgName'), ...textStyle('orgName', 'rgba(255,255,255,0.95)'), fontWeight: textStyle('orgName', '').fontWeight ?? 700, fontSize: `calc(26px * ${sz('orgName')})`, maxWidth: 500, lineHeight: 1.3 }}
          onMouseDown={startDrag('orgName')} onTouchStart={startDrag('orgName')}>
          {org.name}
        </div>

        <div style={{ ...el('title'), ...hidden('title'), fontFamily: "'Playfair Display','Sarabun',serif", fontSize: `calc(64px * ${sz('title')})`, fontWeight: textStyle('title', '').fontWeight ?? 700, letterSpacing: '0.08em', textShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', ...textStyle('title', '#fcd34d') }}
          onMouseDown={startDrag('title')} onTouchStart={startDrag('title')}>
          เกียรติบัตร
        </div>

        <div style={{ ...el('presentText'), ...hidden('presentText'), fontSize: `calc(22px * ${sz('presentText')})`, whiteSpace: 'nowrap', ...textStyle('presentText', 'rgba(255,255,255,0.8)') }}
          onMouseDown={startDrag('presentText')} onTouchStart={startDrag('presentText')}>
          มอบเกียรติบัตรฉบับนี้ให้แก่
        </div>

        <div style={{ ...el('recipient'), ...hidden('recipient'), fontFamily: "'Playfair Display','Sarabun',serif", fontSize: `calc(48px * ${sz('recipient')})`, fontWeight: textStyle('recipient', '').fontWeight ?? 700, textShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', maxWidth: 750, overflow: 'hidden', textOverflow: 'ellipsis', ...textStyle('recipient', 'white') }}
          onMouseDown={startDrag('recipient')} onTouchStart={startDrag('recipient')}>
          {recipient.full_name}
        </div>

        {recipient.award && (
          <div style={{ ...el('award'), ...hidden('award'), fontSize: `calc(24px * ${sz('award')})`, fontWeight: textStyle('award', '').fontWeight ?? 600, whiteSpace: 'nowrap', maxWidth: 650, overflow: 'hidden', textOverflow: 'ellipsis', ...textStyle('award', '#fcd34d') }}
            onMouseDown={startDrag('award')} onTouchStart={startDrag('award')}>
            {recipient.award}
          </div>
        )}

        <div style={{ ...el('divider'), ...hidden('divider'), width: `calc(136px * ${sz('divider')})`, height: 3, background: layout.divider.color ? `linear-gradient(90deg,transparent,${layout.divider.color},transparent)` : 'linear-gradient(90deg,transparent,#fcd34d,transparent)' }}
          onMouseDown={startDrag('divider')} onTouchStart={startDrag('divider')} />

        <div style={{ ...el('activity'), ...hidden('activity'), fontSize: `calc(28px * ${sz('activity')})`, fontWeight: textStyle('activity', '').fontWeight ?? 700, whiteSpace: 'nowrap', maxWidth: 750, overflow: 'hidden', textOverflow: 'ellipsis', ...textStyle('activity', '#fcd34d') }}
          onMouseDown={startDrag('activity')} onTouchStart={startDrag('activity')}>
          {recipient.activity?.name}
        </div>

        {(recipient.extra_details || recipient.activity?.description) && (
          <div style={{ ...el('description'), ...hidden('description'), fontSize: `calc(20px * ${sz('description')})`, maxWidth: 650, lineHeight: 1.5, ...textStyle('description', 'rgba(255,255,255,0.75)') }}
            onMouseDown={startDrag('description')} onTouchStart={startDrag('description')}>
            {recipient.extra_details || recipient.activity?.description}
          </div>
        )}

        {certDate && (
          <div style={{ ...el('date'), ...hidden('date'), fontSize: `calc(20px * ${sz('date')})`, whiteSpace: 'nowrap', ...textStyle('date', 'rgba(255,255,255,0.75)') }}
            onMouseDown={startDrag('date')} onTouchStart={startDrag('date')}>
            วันที่ {formatDate(certDate)}
          </div>
        )}

        <div style={{ ...el('signature'), ...hidden('signature'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          onMouseDown={startDrag('signature')} onTouchStart={startDrag('signature')}>
          {org.signature_url && (
            <img src={org.signature_url} alt="sig" crossOrigin="anonymous"
              style={{ height: `calc(68px * ${sz('signature')})`, objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 2 }} />
          )}
          <div style={{ width: `calc(168px * ${sz('signature')})`, height: 2, background: 'rgba(255,255,255,0.5)' }} />
          <div style={{ fontSize: `calc(20px * ${sz('signature')})`, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4, ...textStyle('signature', 'white') }}>
            {org.executive_name}
          </div>
          <div style={{ fontSize: `calc(18px * ${sz('signature')})`, whiteSpace: 'nowrap', color: layout.signature.color || 'rgba(255,255,255,0.7)' }}>
            {org.executive_position}
          </div>
        </div>

        {qrDataUrl && (
          <div style={{ ...el('qr'), ...hidden('qr'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            onMouseDown={startDrag('qr')} onTouchStart={startDrag('qr')}>
            <div style={{ fontSize: `calc(16px * ${sz('qr')})`, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
              ตรวจสอบเกียรติบัตร
            </div>
            <div style={{ background: 'white', borderRadius: 8, padding: 6, width: `calc(100px * ${sz('qr')})`, height: `calc(100px * ${sz('qr')})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={qrDataUrl} alt="qr" style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={{ fontSize: `calc(12px * ${sz('qr')})`, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', maxWidth: `calc(100px * ${sz('qr')})`, wordBreak: 'break-all', textAlign: 'center' }}>
              {recipient.cert_code}
            </div>
          </div>
        )}

        {editMode && (
          <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: 'white', fontSize: '14px', padding: '6px 16px', borderRadius: 20, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20 }}>
            🖱️ ลากองค์ประกอบเพื่อย้ายตำแหน่ง
          </div>
        )}
      </div>
    </div>
  );
}
