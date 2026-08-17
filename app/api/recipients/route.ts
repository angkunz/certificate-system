import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function generateCertCode(activityName: string): string {
  const prefix = activityName
    .replace(/[^a-zA-Zก-๙]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'CERT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/recipients
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('activity_id');
  const q = searchParams.get('q');
  const code = searchParams.get('code');
  const pending = searchParams.get('pending');

  // Public: search by name or code
  if (q) {
    const { data, error } = await supabaseAdmin
      .from('recipients')
      .select('*, activity:activities(id, name, description, cert_date, background_url)')
      .ilike('full_name', `%${q}%`)
      .eq('status', 'approved');
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Public: get by code
  if (code) {
    const { data, error } = await supabaseAdmin
      .from('recipients')
      .select('*, activity:activities(id, name, description, cert_date, background_url)')
      .eq('cert_code', code)
      .eq('status', 'approved')
      .single();
    if (error) return NextResponse.json({ error: 'ไม่พบเกียรติบัตร' }, { status: 404 });
    return NextResponse.json({ data });
  }

  // Admin: pending approvals for executive
  if (pending === '1') {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin
      .from('recipients')
      .select('*, activity:activities(id, name, description, cert_date, background_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Admin: list by activity
  if (activityId) {
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabaseAdmin
      .from('recipients')
      .select('*')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Admin: all recipients
  if (session?.role === 'admin') {
    const { data, error } = await supabaseAdmin
      .from('recipients')
      .select('*, activity:activities(id, name)')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// POST /api/recipients — add one or import CSV rows (admin only)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, activity_id, full_name, extra_details, award, cert_date, rows } = body;

  // Get activity name for cert code prefix
  const { data: activity } = await supabaseAdmin
    .from('activities')
    .select('name')
    .eq('id', activity_id)
    .single();
  const activityName = activity?.name || 'CERT';

  // Import multiple rows
  if (action === 'import' && Array.isArray(rows)) {
    const toInsert = rows.map((row: { full_name: string; extra_details?: string; award?: string; cert_date?: string }) => ({
      activity_id,
      full_name: row.full_name,
      extra_details: row.extra_details || null,
      award: row.award || null,
      cert_date: row.cert_date || null,
      cert_code: generateCertCode(activityName),
    }));
    const { data, error } = await supabaseAdmin.from('recipients').insert(toInsert).select();
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  // Single add
  if (!full_name || !activity_id) {
    return NextResponse.json({ error: 'ชื่อและกิจกรรมจำเป็นต้องกรอก' }, { status: 400 });
  }

  const cert_code = generateCertCode(activityName);
  const { data, error } = await supabaseAdmin
    .from('recipients')
    .insert([{ activity_id, full_name, extra_details, award: award || null, cert_date: cert_date || null, cert_code }])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// PUT /api/recipients — approve / reject / update
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, ids, id, reject_reason } = body;

  // Bulk approve / reject (executive)
  if (action === 'approve' || action === 'reject') {
    const targetIds = ids || (id ? [id] : []);
    if (!targetIds.length) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

    const updateData =
      action === 'approve'
        ? { status: 'approved', approved_by: session.id, approved_at: new Date().toISOString() }
        : { status: 'rejected', reject_reason: reject_reason || null };

    const { error } = await supabaseAdmin
      .from('recipients')
      .update(updateData)
      .in('id', targetIds);

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
