import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getDistance } from '@/lib/location';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  : null;

async function getCompanySettingsInternal() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('company_settings').select('*').single();
  if (error) {
    if (error.code === 'PGRST116') {
      return { organization_name: 'AttendX Corp', office_lat: 28.41607, office_lng: 77.09253, allowed_radius_meters: 500, allowed_ip_range: '127.0.0.1', office_start_time: '09:00', office_end_time: '19:00' };
    }
    return null;
  }
  return { ...data, allowed_ip_range: data.allowed_ip_range || '127.0.0.1', office_lat: data.office_lat ?? 28.41607, office_lng: data.office_lng ?? 77.09253, allowed_radius_meters: data.allowed_radius_meters ?? 500, office_start_time: data.office_start_time ?? '09:00', office_end_time: data.office_end_time ?? '18:00' };
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server misconfiguration: Service Role Key missing.' }, { status: 500 });

    const body = await request.json();
    const { action, email, lat, lng } = body;

    if (action === 'loginWithIp') {
      let settings = await getCompanySettingsInternal();
      if (!settings) {
        settings = { allowed_ip_range: '127.0.0.1,::1', office_lat: 28.41607, office_lng: 77.09253, allowed_radius_meters: 500, organization_name: 'Dev Corp' } as any;
      }
      if (!settings?.allowed_ip_range) return NextResponse.json({ error: 'IP Login not configured for this company.' }, { status: 400 });

      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for');
      const realIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
      const isIpValid = realIp === '127.0.0.1' || realIp === '::1' || settings.allowed_ip_range.includes(realIp);
      if (!isIpValid) return NextResponse.json({ error: 'Access Denied: You are not at the office (IP Mismatch).' }, { status: 403 });

      const { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
      if (!existingUser) return NextResponse.json({ error: 'Account not found. Please sign up first.' }, { status: 404 });

      const host = headersList.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const redirectUrl = `${protocol}://${host}/auth/confirm`;

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: redirectUrl } });
      if (error) throw error;
      return NextResponse.json({ success: true, url: data.properties?.action_link });
    }

    if (action === 'loginWithGps') {
      const settings = await getCompanySettingsInternal();
      if (!settings?.office_lat || !settings?.office_lng) return NextResponse.json({ error: 'GPS Login not configured.' }, { status: 400 });

      const distance = getDistance(lat, lng, settings.office_lat, settings.office_lng);
      const maxRadius = settings.allowed_radius_meters || 300;
      if (distance > maxRadius) return NextResponse.json({ error: `Access Denied: You are ${Math.round(distance)}m away from office. Allowed: ${maxRadius}m. ${lat}, ${lng}` }, { status: 403 });

      const { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('email', email).single();
      if (!existingUser) return NextResponse.json({ error: 'Account not found. Please sign up first.' }, { status: 404 });

      const headersList = await headers();
      const host = headersList.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const redirectUrl = `${protocol}://${host}/auth/confirm`;

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: redirectUrl } });
      if (error) throw error;
      return NextResponse.json({ success: true, url: data.properties?.action_link });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth Advanced POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
