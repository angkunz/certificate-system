// Certificate Layout Types & Defaults

export interface CertElement {
  x: number;       // 0–100 (% from left of container)
  y: number;       // 0–100 (% from top of container)
  align: 'left' | 'center' | 'right';
  visible: boolean;
  size?: number;   // 50–200 (% scale, default 100)
  color?: string;  // hex color override (empty = use default)
  fontStyle?: 'normal' | 'italic' | 'bold-italic'; // font style override
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

// Elements that support color/font customization (exclude logo, divider, qr)
export const STYLABLE_ELEMENTS: (keyof CertLayout)[] = [
  'orgName', 'title', 'presentText', 'recipient', 'activity', 'description', 'date', 'signature',
];

export const DEFAULT_CERT_LAYOUT: CertLayout = {
  logo:        { x: 6,  y: 7,  align: 'left',   visible: true, size: 100 },
  orgName:     { x: 16, y: 9,  align: 'left',   visible: true, size: 100 },
  title:       { x: 50, y: 23, align: 'center', visible: true, size: 100 },
  presentText: { x: 50, y: 38, align: 'center', visible: true, size: 100 },
  recipient:   { x: 50, y: 45, align: 'center', visible: true, size: 100 },
  divider:     { x: 50, y: 57, align: 'center', visible: true, size: 100 },
  activity:    { x: 50, y: 62, align: 'center', visible: true, size: 100 },
  description: { x: 50, y: 70, align: 'center', visible: true, size: 100 },
  date:        { x: 50, y: 78, align: 'center', visible: true, size: 100 },
  signature:   { x: 14, y: 83, align: 'center', visible: true, size: 100 },
  qr:          { x: 87, y: 81, align: 'center', visible: true, size: 100 },
};

export function mergeLayout(saved: Partial<CertLayout> | null | undefined): CertLayout {
  if (!saved) return { ...DEFAULT_CERT_LAYOUT };
  const result = { ...DEFAULT_CERT_LAYOUT };
  for (const key of Object.keys(DEFAULT_CERT_LAYOUT) as (keyof CertLayout)[]) {
    if (saved[key]) {
      result[key] = {
        ...DEFAULT_CERT_LAYOUT[key],
        ...saved[key],
        size: saved[key].size ?? 100,
      };
    }
  }
  return result;
}
