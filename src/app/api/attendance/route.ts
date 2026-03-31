import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgDateString, getOrgTime, formatTime } from '@/lib/time';

// Default Office Location (Fallback if not in settings)
const DEFAULT_OFFICE_LAT = 28.6139;
const DEFAULT_OFFICE_LON = 77.2090;
const DEFAULT_RADIUS_METERS = 500;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

function formatTimeDisplay(timeStr: string): string {
  const { hours, minutes } = parseTimeString(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function isWithinOfficeHours(now: Date, startTime: string, endTime: string): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

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

async function getApprovedLeaveForDate(supabase: any, userId: string, date: string) {
  const { data } = await supabase
    .from('leave_requests')
    .select('id, category')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .in('category', ['leave', 'halfday', 'wfh', 'hybrid'])
    .lte('start_day', date)
    .gte('end_day', date)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function ensureMonthWeekends(supabase: any, month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const weekends = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      weekends.push({ date: dateString, type: 'weekend', description: dayOfWeek === 0 ? 'Sunday' : 'Saturday' });
    }
  }
  await supabase.from('company_calendar').upsert(weekends, { onConflict: 'date', ignoreDuplicates: true });
}

async function buildAbsentDays(
  supabase: any, userId: string, startDate: string, endDate: string,
  joiningDate: string, existingDates: Set<string>,
  employeeMeta?: { employee_name: string; employee_email: string; employee_emp_id: string; employee_designation: string; user_id: string; }
): Promise<any[]> {
  const todayStr = getOrgDateString();
  const { data: calDays } = await supabase.from('company_calendar').select('date, type').gte('date', startDate).lte('date', endDate).in('type', ['weekend', 'holiday']);
  const nonWorkingDates = new Set<string>((calDays || []).map((d: any) => d.date as string));

  const { data: leaves } = await supabase.from('leave_requests').select('category, start_day, end_day').eq('user_id', userId).eq('status', 'approved').in('category', ['leave', 'halfday']).lte('start_day', endDate).gte('end_day', startDate);

  const leaveMap = new Map<string, 'absent' | 'half_day'>();
  for (const lv of leaves || []) {
    const cur = new Date(lv.start_day);
    const end = new Date(lv.end_day);
    while (cur <= end) {
      const ds = cur.toISOString().split('T')[0];
      leaveMap.set(ds, lv.category === 'halfday' ? 'half_day' : 'absent');
      cur.setDate(cur.getDate() + 1);
    }
  }

  const result: any[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const ds = cur.toISOString().split('T')[0];
    cur.setDate(cur.getDate() + 1);
    const hasLeaveToday = leaveMap.has(ds);
    if (ds > todayStr) continue;
    if (ds === todayStr && !hasLeaveToday) continue;
    if (ds < joiningDate) continue;
    if (nonWorkingDates.has(ds)) continue;
    if (existingDates.has(ds)) continue;
    const absentStatus = leaveMap.get(ds) ?? 'absent';
    result.push({
      id: `absent-${userId}-${ds}`, user_id: userId, date: ds,
      check_in_1: null, check_out_1: null, check_in_2: null, check_out_2: null,
      check_in_display: null, check_out_display: null, check_in_2_display: null, check_out_2_display: null,
      hours_display: null, total_minutes: 0, status: absentStatus, work_type: null, present: false,
      ...(employeeMeta ?? {}),
    });
  }
  return result;
}

// ─── Check-in logic ─────────────────────────────────────
async function handleCheckIn(supabase: any, user: any, latitude: number, longitude: number) {
  const settings = await getSettings(supabase);
  const now = getOrgTime();
  const today = getOrgDateString();

  const { data: calendarDay } = await supabase.from('company_calendar').select('type').eq('date', today).single();
  if (calendarDay?.type === 'holiday') return { error: 'Not able to check-in on holiday' };

  const { data: existing } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).single();
  const approval = await getApprovedLeaveForDate(supabase, user.id, today);

  let workType: string;
  if (approval) {
    if (approval.category === 'leave') return { error: 'You are on approved leave today. Check-in is disabled.' };
    workType = approval.category;
  } else {
    if (!isWithinOfficeHours(now, settings.start, settings.end)) {
      return { error: `Office check-in is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
    }
    const distanceKm = calculateDistance(latitude, longitude, settings.office_lat, settings.office_lng);
    if (distanceKm * 1000 > settings.allowed_radius_meters) {
      return { error: 'You are outside the office geofence. Only office check-in is allowed without WFH/Hybrid approval.' };
    }
    workType = 'office';
  }

  if (existing) {
    if (existing.check_in_1 && existing.check_in_2) return { error: 'Maximum 2 check-ins per day already reached.' };
    if (existing.check_in_1 && !existing.check_out_1) return { error: 'Please check out from your current session before starting a new one.' };
    if (workType === 'office' && existing.check_in_1 && existing.check_out_1) return { error: 'You cannot check in again.' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const lateThreshold = 10 * 60 + 30;
  const statusValue = (workType === 'office' && currentMinutes > lateThreshold) ? 'late' : 'present';
  const nowIso = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase.from('attendance').insert({ user_id: user.id, date: today, check_in_1: nowIso, present: true, work_type: workType, status: statusValue, latitude, longitude });
    if (error) throw error;
  } else {
    const updateData: Record<string, any> = { check_in_2: nowIso };
    if (workType !== existing.work_type) { updateData.work_type = workType; updateData.status = statusValue; }
    const { error } = await supabase.from('attendance').update(updateData).eq('id', existing.id);
    if (error) throw error;
  }
  return { success: true, message: `Checked in successfully at ${new Date().toLocaleTimeString()}` };
}

// ─── Check-out logic ────────────────────────────────────
async function handleCheckOut(supabase: any, user: any, latitude: number, longitude: number) {
  const settings = await getSettings(supabase);
  const now = getOrgTime();
  const today = getOrgDateString();

  const { data: session } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).single();
  if (!session) return { error: 'No check-in record found for today.' };

  const approval = await getApprovedLeaveForDate(supabase, user.id, today);
  const effectiveWorkType = approval ? approval.category : session.work_type;

  if (effectiveWorkType === 'office' && !isWithinOfficeHours(now, settings.start, settings.end)) {
    return { error: `Office check-out is only allowed between ${formatTimeDisplay(settings.start)} and ${formatTimeDisplay(settings.end)}.` };
  }

  const nowIso = new Date().toISOString();
  let sessionMinutes = 0;
  let updates: Record<string, any> = {};

  if (session.check_in_1 && !session.check_out_1) {
    sessionMinutes = Math.floor((new Date(nowIso).getTime() - new Date(session.check_in_1).getTime()) / 1000 / 60);
    updates = { check_out_1: nowIso, total_minutes: (session.total_minutes ?? 0) + sessionMinutes, latitude, longitude };
  } else if (session.check_in_2 && !session.check_out_2) {
    sessionMinutes = Math.floor((new Date(nowIso).getTime() - new Date(session.check_in_2).getTime()) / 1000 / 60);
    updates = { check_out_2: nowIso, total_minutes: (session.total_minutes ?? 0) + sessionMinutes, latitude, longitude };
  } else if (session.check_out_1 && session.check_out_2) {
    return { error: 'Both sessions already checked out for today.' };
  } else {
    return { error: 'No active check-in found to check out from.' };
  }

  if (effectiveWorkType !== session.work_type) updates.work_type = effectiveWorkType;

  const { error } = await supabase.from('attendance').update(updates).eq('id', session.id);
  if (error) throw error;

  const totalSoFar = updates.total_minutes as number;
  return { success: true, message: `Checked out. Session: ${Math.floor(sessionMinutes / 60)}h ${sessionMinutes % 60}m | Total today: ${Math.floor(totalSoFar / 60)}h ${totalSoFar % 60}m` };
}

// ─── GET handler ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'today') {
      if (!user) return NextResponse.json(null);
      const now = getOrgTime();
      await ensureMonthWeekends(supabase, now.getMonth() + 1, now.getFullYear());
      const today = getOrgDateString();
      const { data } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', today).single();
      return NextResponse.json(data);
    }

    if (type === 'effective-work-type') {
      if (!user) return NextResponse.json('office');
      const today = getOrgDateString();
      const approval = await getApprovedLeaveForDate(supabase, user.id, today);
      return NextResponse.json(approval ? approval.category : 'office');
    }

    if (type === 'my') {
      if (!user) return NextResponse.json([]);
      const limit = searchParams.get('limit');
      const month = limit ? null : parseInt(searchParams.get('month')!);
      const year = limit ? null : parseInt(searchParams.get('year')!);
      
      let startDate: string;
      let endDateStr: string;

      if (limit) {
        // Just use a very wide range for limit queries
        startDate = '2000-01-01';
        endDateStr = getOrgDateString();
      } else {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year!, month!, 0).getDate();
        endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        await ensureMonthWeekends(supabase, month!, year!);
      }
      const { data: profile } = await supabase.from('profiles').select('created_at, add_on_leaves').eq('id', user.id).single();
      const joiningDate = profile?.created_at ? profile.created_at.split('T')[0] : '1970-01-01';
      const myAddOnLeaves = profile?.add_on_leaves || 0;
      let query = supabase.from('attendance').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDateStr).order('date', { ascending: false });
      if (limit) query = query.limit(parseInt(limit));
      
      const { data, error } = await query;
      if (error) throw error;
      const realRecords = (data || []).map(record => ({
        ...record,
        employee_add_on_leaves: myAddOnLeaves,
        check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
        check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
        check_in_2_display: record.check_in_2 ? formatTime(record.check_in_2) : null,
        check_out_2_display: record.check_out_2 ? formatTime(record.check_out_2) : null,
        hours_display: record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : null,
      }));
      const existingDates = new Set(realRecords.map((r: any) => r.date as string));
      
      // Only build absent rows if not in "limit" mode (which is for recent entries)
      if (limit) return NextResponse.json(realRecords);

      const absentRows = await buildAbsentDays(supabase, user.id, startDate, endDateStr, joiningDate, existingDates);
      return NextResponse.json([...realRecords, ...absentRows].sort((a, b) => b.date.localeCompare(a.date)));
    }

    if (type === 'employees') {
      if (!user) return NextResponse.json([]);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json([]);
      const todayOnly = searchParams.get('todayOnly') === 'true';
      const month = todayOnly ? null : parseInt(searchParams.get('month')!);
      const year = todayOnly ? null : parseInt(searchParams.get('year')!);
      const employeeId = searchParams.get('employeeId') || undefined;
      
      let startDate: string;
      let endDateStr: string;

      if (todayOnly) {
        startDate = getOrgDateString();
        endDateStr = startDate;
      } else {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year!, month!, 0).getDate();
        endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        await ensureMonthWeekends(supabase, month!, year!);
      }

      let query = supabase.from('attendance').select('*, profiles(id, name, email, emp_id, designation, created_at, add_on_leaves)').gte('date', startDate).lte('date', endDateStr).order('date', { ascending: false });
      if (employeeId && employeeId !== 'all') query = query.eq('user_id', employeeId);

      const { data, error } = await query;
      if (error) throw error;

      const realRecords = (data || []).map(record => ({
        ...record,
        employee_name: (record.profiles as any)?.name || 'Unknown',
        employee_email: (record.profiles as any)?.email || '',
        employee_emp_id: (record.profiles as any)?.emp_id || '',
        employee_designation: (record.profiles as any)?.designation || '',
        employee_add_on_leaves: (record.profiles as any)?.add_on_leaves || 0,
        created_at: (record.profiles as any)?.created_at,
        check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
        check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
        check_in_2_display: record.check_in_2 ? formatTime(record.check_in_2) : null,
        check_out_2_display: record.check_out_2 ? formatTime(record.check_out_2) : null,
        hours_display: record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : null,
      }));

      const recordsByUser = new Map<string, { dates: Set<string>; meta: any }>();
      for (const r of realRecords) {
        if (!recordsByUser.has(r.user_id)) {
          recordsByUser.set(r.user_id, { dates: new Set(), meta: { user_id: r.user_id, employee_name: r.employee_name, employee_email: r.employee_email, employee_emp_id: r.employee_emp_id, employee_designation: r.employee_designation, created_at: r.created_at } });
        }
        recordsByUser.get(r.user_id)!.dates.add(r.date);
      }

      if (todayOnly || (employeeId && employeeId !== 'all')) {
        let profilesQuery = supabase.from('profiles').select('id, name, email, emp_id, designation, created_at, add_on_leaves');
        if (employeeId && employeeId !== 'all') {
          profilesQuery = profilesQuery.eq('id', employeeId);
        }
        const { data: profiles } = await profilesQuery;
        
        if (profiles) {
          for (const p of profiles) {
            if (!recordsByUser.has(p.id)) {
              recordsByUser.set(p.id, { 
                dates: new Set(), 
                meta: { 
                  user_id: p.id, 
                  employee_name: p.name || 'Unknown', 
                  employee_email: p.email || '', 
                  employee_emp_id: p.emp_id || '', 
                  employee_designation: p.designation || '',
                  employee_add_on_leaves: p.add_on_leaves || 0,
                  created_at: p.created_at 
                } 
              });
            }
          }
        }
      }

      const absentRowArrays = await Promise.all(
        Array.from(recordsByUser.entries()).map(([uid, { dates, meta }]) => {
          const joiningDate = meta.created_at ? meta.created_at.split('T')[0] : '1970-01-01';
          return buildAbsentDays(supabase, uid, startDate, endDateStr, joiningDate, dates, meta);
        })
      );
      return NextResponse.json([...realRecords, ...absentRowArrays.flat()].sort((a, b) => b.date.localeCompare(a.date)));
    }

    if (type === 'employee-list') {
      if (!user) return NextResponse.json([]);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json([]);
      const { data, error } = await supabase.from('profiles').select('id, name, email, emp_id, designation').order('name', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === 'history') {
      if (!user) return NextResponse.json([]);
      const userId = searchParams.get('userId') || undefined;
      let targetUserId = user.id;
      if (userId && userId !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin' || profile?.role === 'hr') targetUserId = userId;
      }

      let query = supabase.from('attendance').select('*, profiles(name, email)');
      if (userId === 'all') {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin' && profile?.role !== 'hr') query = query.eq('user_id', user.id);
      } else if (userId) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin' || profile?.role === 'hr') query = query.eq('user_id', userId);
        else query = query.eq('user_id', user.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;

      return NextResponse.json(data.map(record => ({
        ...record,
        employee_name: (record.profiles as any)?.name || 'Unknown',
        employee_email: (record.profiles as any)?.email || '',
        check_in: record.check_in_1 ? formatTime(record.check_in_1) : '--',
        check_out: record.check_out_1 ? formatTime(record.check_out_1) : '--',
        check_in_display: record.check_in_1 ? formatTime(record.check_in_1) : null,
        check_out_display: record.check_out_1 ? formatTime(record.check_out_1) : null,
        hours_display: record.total_minutes ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m` : '--',
        total_minutes: record.total_minutes ?? 0,
        ipValid: true, locationValid: true
      })));
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('Attendance GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST handler (check-in / check-out) ────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, latitude, longitude } = body;

    if (action === 'checkIn') {
      const result = await handleCheckIn(supabase, user, latitude, longitude);
      if (result.error) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }
    if (action === 'checkOut') {
      const result = await handleCheckOut(supabase, user, latitude, longitude);
      if (result.error) return NextResponse.json(result, { status: 400 });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
