'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getOrgDateString, getOrgTime } from '@/lib/time';
import { isWithinRadius } from '@/lib/location';

// Office Coordinates (Fallback — actual values come from company_settings in DB)
const OFFICE_COORDS = {
  latitude: 19.0760,
  longitude: 72.8777,
};
const ALLOWED_RADIUS = 100;

// Helper: check for approved WFH/Hybrid leave today
async function getApprovedLeaveForDate(supabase: any, userId: string, date: string) {
  const { data } = await supabase
    .from('leave_requests')
    .select('id, category')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .in('category', ['wfh', 'hybrid'])
    .lte('start_day', date)
    .gte('end_day', date)
    .limit(1)
    .single();
  return data ?? null;
}

export async function checkIn(latitude: number, longitude: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized' };
  }

  const todayDate = getOrgDateString();

  // 1. Check for existing attendance record and enforce max 2 check-ins
  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', todayDate)
    .single();

  if (existing) {
    if (existing.check_in_1 && existing.check_in_2) {
      return { error: 'Maximum 2 check-ins per day already reached.' };
    }
    if (existing.check_in_1 && !existing.check_out_1) {
      return { error: 'Please check out from your current session first.' };
    }
  }

  // 2. Approval-first: check for approved WFH/Hybrid leave
  const approval = await getApprovedLeaveForDate(supabase, user.id, todayDate);

  // Compute current time for office hours + late detection
  const now = getOrgTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let workType: string;
  if (approval) {
    // Approved WFH/Hybrid — allow from anywhere, no hours restriction
    workType = approval.category;
  } else {
    // No approval — office check-in: enforce hours + location
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    const officeStart = settings?.office_start_time ?? '09:00';
    const officeEnd = settings?.office_end_time ?? '19:00';
    const [sh, sm] = officeStart.split(':').map(Number);
    const [eh, em] = officeEnd.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (currentMinutes < startMin || currentMinutes > endMin) {
      return { error: `Office check-in is only allowed between ${officeStart} and ${officeEnd}.` };
    }

    const officeLat = settings?.office_lat || OFFICE_COORDS.latitude;
    const officeLng = settings?.office_lng || OFFICE_COORDS.longitude;
    const radius = settings?.allowed_radius_meters || ALLOWED_RADIUS;

    const isValidLocation = isWithinRadius(
      { latitude, longitude },
      { latitude: officeLat, longitude: officeLng },
      radius
    );

    if (!isValidLocation) {
      return { error: 'You are outside the office geofence. WFH/Hybrid approval is required.' };
    }
    workType = 'office';
  }

  // 3. Determine status
  // Late (after 10:30 AM) only applies to office check-ins
  // WFH and Hybrid are always 'present'
  const statusValue = (workType === 'office' && currentMinutes > (10 * 60 + 30)) ? 'late' : 'present';

  const nowIso = new Date().toISOString();

  if (!existing) {
    // First check-in of the day
    const { error } = await supabase.from('attendance').insert({
      user_id: user.id,
      date: todayDate,
      check_in_1: nowIso,
      present: true,
      status: statusValue,
      work_type: workType,
      latitude,
      longitude,
      ip_address: '0.0.0.0',
    });
    if (error) {
      console.error('Check-in error:', error);
      return { error: 'Failed to check in.' };
    }
  } else {
    // Second check-in
    const { error } = await supabase
      .from('attendance')
      .update({ check_in_2: nowIso })
      .eq('id', existing.id);
    if (error) {
      return { error: 'Failed to start second session.' };
    }
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

  // Only enforce office hours for office work_type
  if (existing.work_type === 'office') {
    const orgNow = getOrgTime();
    const { data: settings } = await supabase
      .from('company_settings')
      .select('office_start_time, office_end_time')
      .single();
    const officeStart = settings?.office_start_time ?? '09:00';
    const officeEnd = settings?.office_end_time ?? '19:00';
    const [sh, sm] = officeStart.split(':').map(Number);
    const [eh, em] = officeEnd.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const currentMinutes = orgNow.getHours() * 60 + orgNow.getMinutes();
    if (currentMinutes < startMin || currentMinutes > endMin) {
      return { error: `Office check-out is only allowed between ${officeStart} and ${officeEnd}.` };
    }
  }

  const nowIso = new Date().toISOString();
  let updates: Record<string, any> = {};

  if (existing.check_in_1 && !existing.check_out_1) {
    // First session checkout
    const sessionMs = new Date(nowIso).getTime() - new Date(existing.check_in_1).getTime();
    const sessionMin = Math.floor(sessionMs / 1000 / 60);
    updates = {
      check_out_1: nowIso,
      total_minutes: (existing.total_minutes ?? 0) + sessionMin,
    };
  } else if (existing.check_in_2 && !existing.check_out_2) {
    // Second session checkout
    const sessionMs = new Date(nowIso).getTime() - new Date(existing.check_in_2).getTime();
    const sessionMin = Math.floor(sessionMs / 1000 / 60);
    updates = {
      check_out_2: nowIso,
      total_minutes: (existing.total_minutes ?? 0) + sessionMin,
    };
  } else {
    return { error: 'No active check-in found to check out from.' };
  }

  const { error } = await supabase
    .from('attendance')
    .update(updates)
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
