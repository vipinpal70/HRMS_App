'use server';

import { createClient } from '@/lib/supabase/server';
import { getOrgDateString, getOrgTime, formatTime } from '@/lib/time';
import { revalidatePath } from 'next/cache';
import { format } from 'date-fns-tz';
import { ORG_TIMEZONE } from '@/lib/time';

// Default Office Location (Fallback if not in settings)
const DEFAULT_OFFICE_LAT = 28.6139;
const DEFAULT_OFFICE_LON = 77.2090;
const DEFAULT_RADIUS_METERS = 500;

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

// Helper: fetch settings from company_settings
async function getSettings(supabase: any) {
  const { data } = await supabase
    .from('company_settings')
    .select('office_start_time, office_end_time, office_lat, office_lng, allowed_radius_meters')
    .single();
  return {
    start: data?.office_start_time ?? '09:00',
    end: data?.office_end_time ?? '19:00',
    office_lat: data?.office_lat ?? DEFAULT_OFFICE_LAT,
    office_lng: data?.office_lng ?? DEFAULT_OFFICE_LON,
    allowed_radius_meters: data?.allowed_radius_meters ?? DEFAULT_RADIUS_METERS
  };
}

export async function checkIn(latitude: number, longitude: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized' };
    }

    // 0. Validate Office Hours & Get Location
    const settings = await getSettings(supabase);
    const now = getOrgTime();
    if (!isWithinOfficeHours(now, settings.start, settings.end)) {
      return { error: `Check-in is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
    }

    // 1. Determine Work Type (GPS based)
    const distanceKm = calculateDistance(latitude, longitude, settings.office_lat, settings.office_lng);
    const distanceMeters = distanceKm * 1000;

    // If user is outside the allowed radius, mark as WFH
    const workType = distanceMeters <= settings.allowed_radius_meters ? 'office' : 'wfh';

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
    const startParsed = parseTimeString(settings.start);
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
      work_type: workType,
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
    const settings = await getSettings(supabase);
    const now = getOrgTime();
    if (!isWithinOfficeHours(now, settings.start, settings.end)) {
      return { error: `Check-out is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
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

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Month-scoped queries for the redesigned Attendance page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the logged-in user's attendance records for a specific month/year.
 * Sorted date descending (most recent first).
 */
export async function getMyAttendance(month: number, year: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Build date range: YYYY-MM-01 to YYYY-MM-last
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0); // last day of month
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(record => ({
      ...record,
      check_in_display: record.check_in ? formatTime(record.check_in) : null,
      check_out_display: record.check_out ? formatTime(record.check_out) : null,
      hours_display: record.total_minutes
        ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m`
        : null,
    }));
  } catch (error) {
    console.error('Error in getMyAttendance:', error);
    return [];
  }
}

/**
 * Admin/HR only: Returns attendance records for all employees (or a specific one)
 * for a given month/year. Sorted date descending.
 */
export async function getEmployeesAttendance(month: number, year: number, employeeId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Verify the caller is admin or hr
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'hr') return [];

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    let query = supabase
      .from('attendance')
      .select('*, profiles(id, name, email, emp_id, designation)')
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: false });

    if (employeeId && employeeId !== 'all') {
      query = query.eq('user_id', employeeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(record => ({
      ...record,
      employee_name: (record.profiles as any)?.name || 'Unknown',
      employee_email: (record.profiles as any)?.email || '',
      employee_emp_id: (record.profiles as any)?.emp_id || '',
      employee_designation: (record.profiles as any)?.designation || '',
      check_in_display: record.check_in ? formatTime(record.check_in) : null,
      check_out_display: record.check_out ? formatTime(record.check_out) : null,
      hours_display: record.total_minutes
        ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m`
        : null,
    }));
  } catch (error) {
    console.error('Error in getEmployeesAttendance:', error);
    return [];
  }
}

/**
 * Admin/HR only: Returns the list of all employees for the filter dropdown.
 */
export async function getEmployeeListForFilter() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && profile?.role !== 'hr') return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, emp_id, designation')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in getEmployeeListForFilter:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: kept for backward compat (Dashboard, etc.)
// ─────────────────────────────────────────────────────────────────────────────
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
      // else: fetch all
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
      hours_display: record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : '--',
      total_minutes: record.total_minutes ?? 0,
      ipValid: true,
      locationValid: true
    }));
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    return [];
  }
}
