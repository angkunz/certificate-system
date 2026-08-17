# ระบบออกเกียรติบัตรออนไลน์

ระบบจัดการและออกเกียรติบัตรออนไลน์ พัฒนาด้วย **Next.js + Supabase** พร้อม Deploy บน **Vercel**

---

## 🚀 การ Setup

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) → สร้าง account และ project ใหม่
2. ไปที่ **SQL Editor** แล้วรัน `supabase/schema.sql`
3. ไปที่ **Storage** → สร้าง bucket 3 ตัว (ทั้งหมด **Public**):
   - `certificates` — รูปพื้นหลังเกียรติบัตร
   - `logos` — โลโก้องค์กร
   - `signatures` — รูปลายเซ็น

### 2. ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env.local`:

```bash
cp .env.example .env.local
```

แก้ไขค่าใน `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL จาก Supabase Settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (เป็นความลับ!)
- `JWT_SECRET` — สุ่ม string ยาวๆ (แนะนำ 32+ ตัวอักษร)
- `NEXT_PUBLIC_APP_URL` — URL ของแอป

### 3. รันโปรเจกต์ Local

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### 4. สร้าง Initial Users

เปิด browser ไปที่:
```
http://localhost:3000/api/setup
```

จะสร้าง users อัตโนมัติ:
- **Admin**: `admin` / `Admin@123`
- **Executive**: `executive` / `Exec@123`

> ⚠️ **สำคัญ**: เปลี่ยนรหัสผ่านหลังจาก setup เสร็จ!

---

## 🌐 Deploy บน Vercel

1. Push code ขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com) → Import Repository
3. เพิ่ม **Environment Variables** ทั้งหมดใน Vercel Settings
4. Deploy!

> หลัง Deploy แล้วให้ไปที่ `https://your-app.vercel.app/api/setup` เพื่อสร้าง users

---

## 📋 หน้าต่างๆ

| หน้า | URL | ผู้ใช้ |
|------|-----|--------|
| หน้าหลัก + ค้นหา | `/` | ทุกคน |
| ดูเกียรติบัตร | `/certificate/[code]` | ทุกคน |
| แอดมิน | `/admin` | admin |
| ผู้บริหาร | `/executive` | executive |

---

## 📁 โครงสร้างโปรเจกต์

```
app/
├── page.tsx                    # หน้าสาธารณะ
├── admin/page.tsx              # แอดมิน
├── executive/page.tsx          # ผู้บริหาร
├── certificate/[code]/         # ดูเกียรติบัตร
├── api/
│   ├── auth/                   # Login/Logout
│   ├── activities/             # CRUD กิจกรรม
│   ├── recipients/             # จัดการรายชื่อ
│   ├── settings/               # ตั้งค่าองค์กร
│   ├── upload/                 # อัปโหลดไฟล์
│   └── setup/                  # สร้าง initial users
lib/
├── supabase.ts                 # Supabase client
└── auth.ts                     # JWT helpers
supabase/
└── schema.sql                  # Database schema
```

---

## 📊 Import CSV Format

```csv
full_name,extra_details,cert_date
นาย สมชาย ใจดี,วิศวกรซอฟต์แวร์,2025-01-15
นาง สมหญิง รักดี,,
```

- บรรทัดแรก = header (จำเป็น)
- `cert_date` = ไม่บังคับ (ใช้วันที่ของกิจกรรมถ้าไม่กรอก)

---

## 🔒 Security Notes

- JWT tokens เก็บใน HttpOnly cookies (ป้องกัน XSS)
- Supabase service role key เก็บ server-side เท่านั้น
- ใช้ Supabase RLS ในการควบคุม access ได้เพิ่มเติม
