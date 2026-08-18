export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/setup — สร้าง initial users (รันครั้งเดียว)
export async function GET() {
  try {
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const execHash = await bcrypt.hash('Exec@123', 10);

    // Create admin user
    const { error: adminError } = await supabaseAdmin.from('users').upsert(
      [{ username: 'admin', password_hash: adminHash, role: 'admin', display_name: 'ผู้ดูแลระบบ' }],
      { onConflict: 'username' }
    );

    // Create executive user
    const { error: execError } = await supabaseAdmin.from('users').upsert(
      [{ username: 'executive', password_hash: execHash, role: 'executive', display_name: 'ผู้บริหาร' }],
      { onConflict: 'username' }
    );

    if (adminError || execError) {
      return NextResponse.json({ error: adminError || execError }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Setup complete!',
      credentials: {
        admin: { username: 'admin', password: 'Admin@123' },
        executive: { username: 'executive', password: 'Exec@123' },
      },
      note: 'เปลี่ยนรหัสผ่านหลังเข้าสู่ระบบครั้งแรก',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/setup — Change password
export async function POST(request: NextRequest) {
  const { username, newPassword } = await request.json();
  if (!username || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hash })
    .eq('username', username);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
