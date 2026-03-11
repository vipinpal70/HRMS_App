'use server';

import { createClient } from '@/lib/supabase/server';
import { getOrgDateString, getOrgTime, formatTime } from '@/lib/time';
import { revalidatePath } from 'next/cache';
import { ORG_TIMEZONE } from '@/lib/time';
import { ensureMonthWeekends } from './calendar';

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

// Helper: check if employee has an approved WFH or Hybrid leave for a given date
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
  return data ?? null; // { id, category } or null
}

export async function checkIn(latitude: number, longitude: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized' };
    }

    // 0. Get settings & current org time
    const settings = await getSettings(supabase);
    const now = getOrgTime();
    const today = getOrgDateString();

    // 0.1 Holiday Check
    const { data: calendarDay } = await supabase
      .from('company_calendar')
      .select('type')
      .eq('date', today)
      .single();

    if (calendarDay?.type === 'holiday') {
      return { error: 'Not able to check-in on holiday' };
    }

    // 1. Check for existing attendance record
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    // 2. Enforce max 2 check-ins per day
    if (existing) {
      if (existing.check_in_1 && existing.check_in_2) {
        return { error: 'Maximum 2 check-ins per day already reached.' };
      }
      // For a second check-in, the first session must be closed (check_out_1 set)
      if (existing.check_in_1 && !existing.check_out_1) {
        return { error: 'Please check out from your current session before starting a new one.' };
      }
    }

    // 3. Approval-first: check for approved WFH or Hybrid leave today
    const approval = await getApprovedLeaveForDate(supabase, user.id, today);

    let workType: string;

    if (approval) {
      // Approved WFH or Hybrid — allow from anywhere, no office hours restriction
      workType = approval.category; // 'wfh' or 'hybrid'
    } else {
      // No approval — must be in office: enforce office hours
      if (!isWithinOfficeHours(now, settings.start, settings.end)) {
        return { error: `Office check-in is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
      }

      // GPS distance check — must be inside geofence
      const distanceKm = calculateDistance(latitude, longitude, settings.office_lat, settings.office_lng);
      const distanceMeters = distanceKm * 1000;

      if (distanceMeters > settings.allowed_radius_meters) {
        return { error: 'You are outside the office geofence. Only office check-in is allowed without WFH/Hybrid approval.' };
      }
      workType = 'office';
    }

    // 4. Determine status
    // Late (after 10:30 AM) only applies to office check-ins
    // WFH and Hybrid are always 'present'
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const lateThreshold = 10 * 60 + 30; // 10:30 AM
    const statusValue = (workType === 'office' && currentMinutes > lateThreshold) ? 'late' : 'present';

    // 5. Insert or update
    const nowIso = new Date().toISOString();

    if (!existing) {
      // First check-in of the day → insert new record
      const { error } = await supabase.from('attendance').insert({
        user_id: user.id,
        date: today,
        check_in_1: nowIso,
        present: true,
        work_type: workType,
        status: statusValue,
        latitude,
        longitude
      });
      if (error) throw error;
    } else {
      // Second check-in (after first checkout)
      const { error } = await supabase
        .from('attendance')
        .update({ check_in_2: nowIso })
        .eq('id', existing.id);
      if (error) throw error;
    }

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

    // 0. Validate Office Hours — only for office mode (no WFH/Hybrid approval)
    const settings = await getSettings(supabase);
    const now = getOrgTime();
    const today = getOrgDateString();

    // 1. Find the attendance record for today
    const { data: session } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (!session) {
      return { error: 'No check-in record found for today.' };
    }

    // Only enforce office hours for office work type
    if (session.work_type === 'office' && !isWithinOfficeHours(now, settings.start, settings.end)) {
      return { error: `Office check-out is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
    }
    const nowIso = new Date().toISOString();
    let sessionMinutes = 0;
    let updates: Record<string, any> = {};

    // 2. Determine which session to close
    if (session.check_in_1 && !session.check_out_1) {
      // First session checkout
      const checkInTime = new Date(session.check_in_1);
      const checkOutTime = new Date(nowIso);
      sessionMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 1000 / 60);
      const previousTotal = session.total_minutes ?? 0;
      updates = {
        check_out_1: nowIso,
        total_minutes: previousTotal + sessionMinutes,
        latitude,
        longitude
      };
    } else if (session.check_in_2 && !session.check_out_2) {
      // Second session checkout
      const checkInTime = new Date(session.check_in_2);
      const checkOutTime = new Date(nowIso);
      sessionMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 1000 / 60);
      const previousTotal = session.total_minutes ?? 0;
      updates = {
        check_out_2: nowIso,
        total_minutes: previousTotal + sessionMinutes,
        latitude,
        longitude
      };
    } else if (session.check_out_1 && session.check_out_2) {
      return { error: 'Both sessions already checked out for today.' };
    } else {
      return { error: 'No active check-in found to check out from.' };
    }

    // 3. Update Record
    const { error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', session.id);

    if (error) throw error;

    revalidatePath('/');
    const totalSoFar = updates.total_minutes as number;
    return {
      success: true,
      message: `Checked out. Session: ${Math.floor(sessionMinutes / 60)}h ${sessionMinutes % 60}m | Total today: ${Math.floor(totalSoFar / 60)}h ${totalSoFar % 60}m`
    };

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

    // Auto-update weekends for the current month
    const now = getOrgTime();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await ensureMonthWeekends(month, year);

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
// Month-scoped queries for the Attendance page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the logged-in user's attendance records for a specific month/year.
 */
export async function getMyAttendance(month: number, year: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
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
      check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
      check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
      check_in_2_display: record.check_in_2 ? formatTime(record.check_in_2) : null,
      check_out_2_display: record.check_out_2 ? formatTime(record.check_out_2) : null,
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
 * for a given month/year.
 */
export async function getEmployeesAttendance(month: number, year: number, employeeId?: string) {
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
      check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
      check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
      check_in_2_display: record.check_in_2 ? formatTime(record.check_in_2) : null,
      check_out_2_display: record.check_out_2 ? formatTime(record.check_out_2) : null,
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

    let targetUserId = user.id;
    if (userId && userId !== user.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin' || profile?.role === 'hr') {
        targetUserId = userId;
      }
    }

    let query = supabase.from('attendance').select('*, profiles(name, email)');

    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('user_id', user.id);
      }
    } else if (userId) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin' || profile?.role === 'hr') {
        query = query.eq('user_id', userId);
      } else {
        query = query.eq('user_id', user.id);
      }
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    return data.map(record => ({
      ...record,
      employee_name: (record.profiles as any)?.name || 'Unknown',
      employee_email: (record.profiles as any)?.email || '',
      // Map session 1 for backward compat display
      check_in: record.check_in_1 ? formatTime(record.check_in_1) : '--',
      check_out: record.check_out_1 ? formatTime(record.check_out_1) : '--',
      check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
      check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
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
