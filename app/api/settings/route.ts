import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET /api/settings — public read
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('organization')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/settings — admin only
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, logo_url, executive_name, executive_position, signature_url, theme_color } = body;

  const { data, error } = await supabaseAdmin
    .from('organization')
    .update({ name, logo_url, executive_name, executive_position, signature_url, theme_color, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}
