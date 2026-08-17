import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import type { Metadata } from 'next';
import CertificateClient from './CertificateClient';

interface Props { params: Promise<{ code: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const { data } = await supabaseAdmin.from('recipients').select('full_name').eq('cert_code', code).single();
  return {
    title: data ? `เกียรติบัตร — ${data.full_name}` : 'เกียรติบัตร',
    description: 'ตรวจสอบเกียรติบัตรออนไลน์',
  };
}

export default async function CertPage({ params }: Props) {
  const { code } = await params;

  const { data: recipient } = await supabaseAdmin
    .from('recipients')
    .select('*, activity:activities(id, name, description, cert_date, background_url)')
    .eq('cert_code', code)
    .eq('status', 'approved')
    .single();

  if (!recipient) notFound();

  const { data: org } = await supabaseAdmin.from('organization').select('*').eq('id', 1).single();

  return <CertificateClient recipient={recipient} org={org} />;
}
