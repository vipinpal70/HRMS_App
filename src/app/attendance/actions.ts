'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getOrgDateString, getOrgTime } from '@/lib/time';
import { isWithinRadius, getDistance } from '@/lib/location';

// Office Coordinates (Mock - should be in DB)
// Let's assume Mumbai office
const OFFICE_COORDS = {
  latitude: 19.0760,
  longitude: 72.8777,
};

// 100 meters radius
const ALLOWED_RADIUS = 100;

export async function checkIn(latitude: number, longitude: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  // 1. Validate Location
  // Fetch office settings from DB
  const { data: settings } = await supabase
    .from('company_settings')
    .select('*')
    .single();

  const officeLat = settings?.office_lat || OFFICE_COORDS.latitude;
  const officeLng = settings?.office_lng || OFFICE_COORDS.longitude;
  const radius = settings?.allowed_radius_meters || ALLOWED_RADIUS;

  const isValidLocation = isWithinRadius(
    { latitude, longitude },
    { latitude: officeLat, longitude: officeLng },
    radius
  );

  // If GPS login is required and location is invalid, reject
  if (settings?.gps_login_required && !isValidLocation) {
    return { error: 'You are too far from the office to check in.' };
  }

  // 2. Check if already checked in today
  const todayDate = getOrgDateString(); // "YYYY-MM-DD" in Org Timezone
  
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', todayDate)
    .single();

  if (existing) {
    return { error: 'You have already checked in today.' };
  }

  // 3. Insert Check In
  const now = new Date().toISOString(); // UTC ISO string
  
  const { error } = await supabase.from('attendance').insert({
    user_id: user.id,
    date: todayDate,
    check_in: now,
    present: true,
    status: 'on_time', // Logic for late/on_time can be added here
    work_type: isValidLocation ? 'office' : 'wfh', // Fallback logic
    latitude,
    longitude,
    ip_address: '0.0.0.0', // We can't get IP easily in Server Action without headers, assume middleware handles it or we skip for now
  });

  if (error) {
    console.error('Check-in error:', error);
    return { error: 'Failed to check in.' };
  }

  revalidatePath('/');
  revalidatePath('/attendance');
  return { success: true };
}

export async function checkOut(latitude: number, longitude: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const todayDate = getOrgDateString();
  
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', todayDate)
    .single();

  if (!existing) {
    return { error: 'You have not checked in today.' };
  }

  if (existing.check_out) {
    return { error: 'You have already checked out.' };
  }

  const now = new Date();
  const checkInTime = new Date(existing.check_in);
  
  // Calculate duration in minutes
  const durationMs = now.getTime() - checkInTime.getTime();
  const totalMinutes = Math.floor(durationMs / 1000 / 60);

  const { error } = await supabase
    .from('attendance')
    .update({
      check_out: now.toISOString(),
      total_minutes: totalMinutes,
    })
    .eq('id', existing.id);

  if (error) {
    return { error: 'Failed to check out.' };
  }

  revalidatePath('/');
  revalidatePath('/attendance');
  return { success: true };
}

export async function getTodayStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const todayDate = getOrgDateString();

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', todayDate)
    .single();

  return data;
}
