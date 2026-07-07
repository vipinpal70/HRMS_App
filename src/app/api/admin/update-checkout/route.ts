import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import { ORG_TIMEZONE, formatTime } from '@/lib/time';

type AttendanceUpdatePayload = {
  userId?: string;
  date?: string;
  check_in_1?: string | null;
  check_out_1?: string | null;
  check_in_2?: string | null;
  check_out_2?: string | null;
  updates?: Record<string, string | null | undefined>;
};

const VALID_TIME_FIELDS = new Set(['check_in_1', 'check_out_1', 'check_in_2', 'check_out_2']);

function isValidDateString(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidTimeString(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function toUtcTimestamp(date: string, value: string) {
  if (value.includes('T')) {
    const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
    const parsed = hasExplicitTimezone
      ? new Date(value)
      : fromZonedTime(value, ORG_TIMEZONE);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid timestamp value: ${value}`);
    }
    return parsed.toISOString();
  }

  if (!isValidTimeString(value)) {
    throw new Error(`Invalid time value: ${value}`);
  }

  const timeValue = value.length === 5 ? `${value}:00` : value;
  return fromZonedTime(`${date}T${timeValue}`, ORG_TIMEZONE).toISOString();
}

function calculateTotalMinutes(record: {
  check_in_1: string | null;
  check_out_1: string | null;
  check_in_2: string | null;
  check_out_2: string | null;
}) {
  const pairs: Array<[string | null, string | null]> = [
    [record.check_in_1, record.check_out_1],
    [record.check_in_2, record.check_out_2],
  ];

  return pairs.reduce((total, [start, end]) => {
    if (!start || !end) return total;

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return total;

    return total + Math.floor((endMs - startMs) / 60000);
  }, 0);
}

function normalizeUpdateFields(payload: AttendanceUpdatePayload, date: string) {
  const updates: Record<string, string | null> = {};

  const directFields = {
    check_in_1: payload.check_in_1,
    check_out_1: payload.check_out_1,
    check_in_2: payload.check_in_2,
    check_out_2: payload.check_out_2,
  };

  for (const [field, value] of Object.entries(directFields)) {
    if (typeof value === 'undefined') continue;
    // Treat empty string the same as null (clears the field)
    updates[field] = (value === null || value === '') ? null : toUtcTimestamp(date, value);
  }

  for (const [field, value] of Object.entries(payload.updates || {})) {
    if (!VALID_TIME_FIELDS.has(field)) continue;
    if (typeof value === 'undefined') continue;
    updates[field] = (value === null || value === '') ? null : toUtcTimestamp(date, value);
  }

  return updates;
}

async function getAdminUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'hr') {
    return null;
  }

  return user;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AttendanceUpdatePayload;
    const userId = body.userId?.trim();
    const date = body.date?.trim();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (!date || !isValidDateString(date)) {
      return NextResponse.json({ error: 'Missing or invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const updates = normalizeUpdateFields(body, date);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No attendance fields supplied for update.' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    // No existing record — create a new one with the supplied fields
    if (fetchError || !existing) {
      const insertPayload: Record<string, any> = {
        user_id: userId,
        date,
        ...updates,
      };

      const newRecord = {
        check_in_1: null, check_out_1: null,
        check_in_2: null, check_out_2: null,
        ...insertPayload,
      };

      const totalMinutes = calculateTotalMinutes(newRecord as any);
      const present = Boolean(newRecord.check_in_1 || newRecord.check_in_2);

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('attendance')
        .insert({
          ...insertPayload,
          total_minutes: totalMinutes,
          present,
          status: present ? 'present' : 'absent',
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({
        success: true,
        message: 'Attendance record created successfully.',
        data: {
          ...inserted,
          check_in_1_display: inserted.check_in_1 ? formatTime(inserted.check_in_1) : null,
          check_out_1_display: inserted.check_out_1 ? formatTime(inserted.check_out_1) : null,
          check_in_2_display: inserted.check_in_2 ? formatTime(inserted.check_in_2) : null,
          check_out_2_display: inserted.check_out_2 ? formatTime(inserted.check_out_2) : null,
          hours_display: `${Math.floor((inserted.total_minutes ?? 0) / 60)}h ${(inserted.total_minutes ?? 0) % 60}m`,
        },
      });
    }

    const nextRecord = {
      ...existing,
      ...updates,
    };

    const totalMinutes = calculateTotalMinutes(nextRecord);
    const present = Boolean(nextRecord.check_in_1 || nextRecord.check_in_2);
    const status = present
      ? (existing.status === 'absent' || existing.status === 'auto_checkout' ? 'present' : existing.status ?? 'present')
      : 'absent';

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .update({
        ...updates,
        total_minutes: totalMinutes,
        present,
        status,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Attendance record updated successfully.',
      data: {
        ...data,
        check_in_1_display: data.check_in_1 ? formatTime(data.check_in_1) : null,
        check_out_1_display: data.check_out_1 ? formatTime(data.check_out_1) : null,
        check_in_2_display: data.check_in_2 ? formatTime(data.check_in_2) : null,
        check_out_2_display: data.check_out_2 ? formatTime(data.check_out_2) : null,
        hours_display: `${Math.floor((data.total_minutes ?? 0) / 60)}h ${(data.total_minutes ?? 0) % 60}m`,
      },
    });
  } catch (error: any) {
    console.error('Admin attendance update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
