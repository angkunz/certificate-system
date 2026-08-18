export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET /api/activities — list all (public: active only, admin: all)
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get('all') === '1' && session?.role === 'admin';

  let query = supabaseAdmin
    .from('activities')
    .select('*, created_by_user:users!created_by(username, display_name)')
    .order('created_at', { ascending: false });

  if (!showAll) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/activities — create (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, cert_date, background_url, status } = body;

  if (!name || !cert_date) {
    return NextResponse.json({ error: 'ชื่อกิจกรรมและวันที่จำเป็นต้องกรอก' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert([{ name, description, cert_date, background_url, status: status || 'active', created_by: session.id }])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
