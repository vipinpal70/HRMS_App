import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getCompanySettings } from '@/lib/settings';
import { getDistance } from '@/lib/location';

// Initialize Admin Client (Requires SUPABASE_SERVICE_ROLE_KEY)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: Service Role Key missing.' }, { status: 500 });
    }

    const body = await request.json();
    const { action, email } = body;
    const lat = body.lat ?? body.latitude;
    const lng = body.lng ?? body.longitude;

    if (action === 'loginWithIp') {
      const result = await loginWithIp(email);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    if (action === 'loginWithGps') {
      if (lat === undefined || lng === undefined) {
        return NextResponse.json({ error: 'Missing coordinates for GPS login.' }, { status: 400 });
      }
      const result = await loginWithGps(email, Number(lat), Number(lng));
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Auth Advanced POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function loginWithIp(email: string) {
  try {
    if (!supabaseAdmin) {
      return { error: 'Server misconfiguration: Service Role Key missing.' };
    }

    console.log('Attempting IP Login for:', email);

    // 1. Get Company Settings
    let settings = await getCompanySettings();

    // Fallback for development if DB fetch fails
    if (!settings) {
      console.warn('Using fallback settings (DB fetch failed)');
      settings = {
        allowed_ip_range: '127.0.0.1,::1',
        office_lat: 28.41607,
        office_lng: 77.09253,
        allowed_radius_meters: 500,
        organization_name: 'Dev Corp'
      };
    }

    if (!settings?.allowed_ip_range) {
      console.error('Settings missing allowed_ip_range:', settings);
      return { error: 'IP Login not configured for this company.' };
    }

    // 2. Get User IP
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1'; // Default to localhost in dev

    // 3. Validate IP
    const isIpValid = realIp === '127.0.0.1' || realIp === '::1' || settings.allowed_ip_range.includes(realIp);

    if (!isIpValid) {
      return { error: `Access Denied: You are not at the office (IP Mismatch). Your IP: ${realIp}` };
    }

    // 3.5 Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!existingUser) {
      return { error: 'Account not found. Please sign up first.' };
    }

    // 4. Generate Magic Link (Instant Login)
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUrl = `${protocol}://${host}/auth/confirm`;

    console.log(`Generating magic link with redirect to: ${redirectUrl}`);

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) throw error;

    return { success: true, url: data.properties?.action_link };

  } catch (error: any) {
    console.error('IP Login Error:', error);
    return { error: error.message };
  }
}

export async function loginWithGps(email: string, lat: number, lng: number) {
  try {
    if (!supabaseAdmin) {
      return { error: 'Server misconfiguration: Service Role Key missing.' };
    }

    // 1. Get Company Settings
    const settings = await getCompanySettings();
    if (!settings?.office_lat || !settings?.office_lng) {
      return { error: 'GPS Login not configured.' };
    }

    // 2. Validate Distance
    const distance = getDistance(lat, lng, settings.office_lat, settings.office_lng);
    const maxRadius = settings.allowed_radius_meters || 300;

    if (distance > maxRadius) {
      return { error: `Access Denied: You are ${Math.round(distance)}m away from office. Allowed: ${maxRadius}m.` };
    }

    // 2.5 Check if user exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!existingUser) {
      return { error: 'Account not found. Please sign up first.' };
    }

    // 3. Generate Magic Link
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUrl = `${protocol}://${host}/auth/confirm`;

    console.log(`Generating magic link with redirect to: ${redirectUrl}`);

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (error) throw error;

    return { success: true, url: data.properties?.action_link };

  } catch (error: any) {
    console.error('GPS Login Error:', error);
    return { error: error.message };
  }
}

export async function updateUserLocation(email: string, lat?: number, lng?: number, ip?: string) {
  return { success: true };
}