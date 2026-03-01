'use server';

import { createClient } from '@/lib/supabase/server';
import { getOrgDateString, getOrgTime, formatTime } from '@/lib/time';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns-tz';
import { ORG_TIMEZONE } from '@/lib/time';

// Mock Office Location (e.g., New Delhi)
const OFFICE_LAT = 28.6139;
const OFFICE_LON = 77.2090;
const MAX_DISTANCE_KM = 0.5; // 500 meters

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Helper: parse "HH:mm" or "HH:mm:ss" to { hours, minutes }
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

// Helper: format 24h time to 12h display
function formatTimeDisplay(timeStr: string): string {
  const { hours, minutes } = parseTimeString(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Helper: check if current org time is within office hours
function isWithinOfficeHours(now: Date, startTime: string, endTime: string): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// Helper: fetch office hours from company_settings
async function getOfficeHours(supabase: any): Promise<{ start: string; end: string }> {
  const { data } = await supabase
    .from('company_settings')
    .select('office_start_time, office_end_time')
    .single();
  return {
    start: data?.office_start_time ?? '09:00',
    end: data?.office_end_time ?? '19:00'
  };
}

export async function checkIn(latitude: number, longitude: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized' };
    }

    // 0. Validate Office Hours
    const officeHours = await getOfficeHours(supabase);
    const now = getOrgTime();
    if (!isWithinOfficeHours(now, officeHours.start, officeHours.end)) {
      return { error: `Check-in is only allowed between ${formatTimeDisplay(officeHours.start)} and ${formatTimeDisplay(officeHours.end)}.` };
    }

    // 1. Validate Location
    const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LON);
    // For development, we might skip this or make it lenient
    // if (distance > MAX_DISTANCE_KM) {
    //   return { error: `You are too far from the office (${distance.toFixed(2)} km away).` };
    // }

    const today = getOrgDateString();

    // 2. Check if already checked in
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (existing) {
      return { error: 'Already checked in for today.' };
    }

    // 3. Determine status (Late vs On Time)
    // Late = after office_start_time + 1 hour
    const startParsed = parseTimeString(officeHours.start);
    const lateThresholdMinutes = (startParsed.hours + 1) * 60 + startParsed.minutes;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let status = 'present';
    if (currentMinutes > lateThresholdMinutes) {
      status = 'late';
    }

    // 4. Insert Record
    const { error } = await supabase.from('attendance').insert({
      user_id: user.id,
      date: today,
      check_in: new Date().toISOString(), // Store as UTC ISO
      status: status,
      work_type: 'office', // Default, could be 'wfh' based on request
      location_lat: latitude,
      location_lng: longitude
    });

    if (error) throw error;

    revalidatePath('/');
    return { success: true, message: `Checked in successfully at ${new Date().toLocaleTimeString()}` };
  } catch (error: any) {
    console.error('Check-in error:', error);
    return { error: error.message };
  }
}

export async function checkOut(latitude: number, longitude: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized' };
    }

    // 0. Validate Office Hours
    const officeHours = await getOfficeHours(supabase);
    const now = getOrgTime();
    if (!isWithinOfficeHours(now, officeHours.start, officeHours.end)) {
      return { error: `Check-out is only allowed between ${formatTimeDisplay(officeHours.start)} and ${formatTimeDisplay(officeHours.end)}.` };
    }

    const today = getOrgDateString();

    // 1. Find the active session
    const { data: session } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (!session) {
      return { error: 'No check-in record found for today.' };
    }

    if (session.check_out) {
      return { error: 'Already checked out.' };
    }

    // 2. Calculate duration
    const checkInTime = new Date(session.check_in);
    const checkOutTime = new Date();
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    const durationMinutes = Math.floor(durationMs / 1000 / 60);

    // 3. Update Record
    const { error } = await supabase
      .from('attendance')
      .update({
        check_out: checkOutTime.toISOString(),
        total_minutes: durationMinutes,
        location_lat: latitude,
        location_lng: longitude
      })
      .eq('id', session.id);

    if (error) throw error;

    revalidatePath('/');
    return { success: true, message: `Checked out. Total time: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` };

  } catch (error: any) {
    console.error('Check-out error:', error);
    return { error: error.message };
  }
}

export async function getTodayStatus() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const today = getOrgDateString();

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    return data;
  } catch (error) {
    return null;
  }
}

export async function getAttendanceHistory(userId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    // Check role if userId is provided
    let targetUserId = user.id;
    if (userId && userId !== user.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin' || profile?.role === 'hr') {
        targetUserId = userId;
      } else {
        // If not admin/hr, force own ID
        targetUserId = user.id;
      }
    }

    // If userId is 'all' (special flag) and user is admin/hr, fetch all
    // But for now let's just support specific user or self
    // To support 'View All', we need a different query structure or parameter

    let query = supabase.from('attendance').select('*, profiles(name, email)');

    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('user_id', user.id);
      }
      // else: fetch all (no filter)
    } else if (userId) {
      // Specific user (admin/hr can view anyone, others only self)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin' || profile?.role === 'hr') {
        query = query.eq('user_id', userId);
      } else {
        query = query.eq('user_id', user.id);
      }
    } else {
      // Default to self
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    return data.map(record => ({
      ...record,
      employee_name: (record.profiles as any)?.name || 'Unknown',
      employee_email: (record.profiles as any)?.email || '',
      check_in: record.check_in ? formatTime(record.check_in) : '--',
      check_out: record.check_out ? formatTime(record.check_out) : '--',
      total_minutes: record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : '--',
      ipValid: true,
      locationValid: true
    }));
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    return [];
  }
}
