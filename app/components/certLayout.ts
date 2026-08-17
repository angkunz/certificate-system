// Certificate Layout Types & Defaults

export interface CertElement {
  x: number;       // 0–100 (% from left of container)
  y: number;       // 0–100 (% from top of container)
  align: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface CertLayout {
  logo: CertElement;
  orgName: CertElement;
  title: CertElement;
  presentText: CertElement;
  recipient: CertElement;
  divider: CertElement;
  activity: CertElement;
  description: CertElement;
  date: CertElement;
  signature: CertElement;
  qr: CertElement;
}

export const ELEMENT_LABELS: Record<keyof CertLayout, string> = {
  logo:        '🏛️ โลโก้',
  orgName:     '🏷️ ชื่อองค์กร',
  title:       '📜 หัวข้อ "เกียรติบัตร"',
  presentText: '📝 ข้อความมอบให้',
  recipient:   '👤 ชื่อผู้รับ',
  divider:     '➖ เส้นคั่น',
  activity:    '🎯 ชื่อกิจกรรม',
  description: '📋 รายละเอียด',
  date:        '📅 วันที่',
  signature:   '✍️ ลายเซ็น',
  qr:          '🔗 QR Code',
};

export const DEFAULT_CERT_LAYOUT: CertLayout = {
  logo:        { x: 6,  y: 7,  align: 'left',   visible: true },
  orgName:     { x: 16, y: 9,  align: 'left',   visible: true },
  title:       { x: 50, y: 23, align: 'center', visible: true },
  presentText: { x: 50, y: 38, align: 'center', visible: true },
  recipient:   { x: 50, y: 45, align: 'center', visible: true },
  divider:     { x: 50, y: 57, align: 'center', visible: true },
  activity:    { x: 50, y: 62, align: 'center', visible: true },
  description: { x: 50, y: 70, align: 'center', visible: true },
  date:        { x: 50, y: 78, align: 'center', visible: true },
  signature:   { x: 14, y: 83, align: 'center', visible: true },
  qr:          { x: 87, y: 81, align: 'center', visible: true },
};

export function mergeLayout(saved: Partial<CertLayout> | null | undefined): CertLayout {
  if (!saved) return { ...DEFAULT_CERT_LAYOUT };
  const result = { ...DEFAULT_CERT_LAYOUT };
  for (const key of Object.keys(DEFAULT_CERT_LAYOUT) as (keyof CertLayout)[]) {
    if (saved[key]) result[key] = { ...DEFAULT_CERT_LAYOUT[key], ...saved[key] };
  }
  return result;
}
