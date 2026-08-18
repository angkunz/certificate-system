export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signToken, verifyToken, getSession } from '@/lib/auth';
import { cookies } from 'next/headers';

// POST: login / logout
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, username, password } = body;

  if (action === 'login') {
    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name || user.username,
    });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 28800,
      path: '/',
    });

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name },
    });
  }

  if (action === 'logout') {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    return NextResponse.json({ success: true });
  }

  if (action === 'change_password') {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { oldPassword, newPassword } = body;
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();
    if (!user) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) return NextResponse.json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 401 });

    const hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabaseAdmin.from('users').update({ password_hash: hash }).eq('id', session.id);
    if (error) return NextResponse.json({ error }, { status: 500 });
    
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// GET: get current session
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return NextResponse.json({ user: null });

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ user: null });

  return NextResponse.json({ user: payload });
}
