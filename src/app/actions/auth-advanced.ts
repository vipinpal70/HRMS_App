'use server';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { getCompanySettings } from './settings';
import { getDistance } from '@/lib/location';

// Initialize Admin Client (Requires SUPABASE_SERVICE_ROLE_KEY)
// We create this purely for admin operations
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

    // 3. Validate IP (Simple CIDR check or exact match)
    // For now, let's assume exact match or localhost allowed in dev
    // In real prod, we need a CIDR library. 
    // Simplified: Check if settings.allowed_ip_range contains the IP (very basic)
    // or if dev environment.

    // CIDR Check Mock:
    const isIpValid = realIp === '127.0.0.1' || realIp === '::1' || settings.allowed_ip_range.includes(realIp);

    if (!isIpValid) {
      return { error: 'Access Denied: You are not at the office (IP Mismatch).' };
    }

    // 4. Generate Magic Link (Instant Login)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: 'http://localhost:3000/auth/confirm'
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
    // getDistance returns meters
    const distance = getDistance(lat, lng, settings.office_lat, settings.office_lng);
    const maxRadius = settings.allowed_radius_meters || 300;

    if (distance > maxRadius) {
      return { error: `Access Denied: You are ${Math.round(distance)}m away from office. Allowed: ${maxRadius}m. ${lat}, ${lng}` };
    }

    // 3. Generate Magic Link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: 'http://localhost:3000/auth/confirm'
      }
    });

    if (error) throw error;

    return { success: true, url: data.properties?.action_link };

  } catch (error: any) {
    console.error('GPS Login Error:', error);
    return { error: error.message };
  }
}

// Helper to update user location (called after successful login)
export async function updateUserLocation(email: string, lat?: number, lng?: number, ip?: string) {
  return { success: true };
}
