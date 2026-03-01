import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgDateString } from '@/lib/time';

// Secure this route with a CRON_SECRET if needed
// For now, we'll allow it but log the request

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const today = getOrgDateString();

    // 1. Get office_end_time from company_settings to use as system checkout time
    const { data: settings } = await supabase
      .from('company_settings')
      .select('office_end_time')
      .single();

    const officeEndTime = settings?.office_end_time ?? '19:00';

    // Build checkout timestamp: today's date + office_end_time in org timezone
    // e.g. "2026-03-01T18:00:00"
    const autoCheckoutTime = new Date(`${today}T${officeEndTime}:00`).toISOString();

    // 2. Find all active check-ins that have NO check-out time
    const { data: openSessions, error } = await supabase
      .from('attendance')
      .select('id, user_id, check_in')
      .eq('date', today)
      .is('check_out', null);

    if (error) throw error;

    if (!openSessions || openSessions.length === 0) {
      return NextResponse.json({ message: 'No open sessions found to auto-checkout.' });
    }

    // 3. Auto-checkout: set check_out to office end time, total_minutes = NULL
    //    total_minutes = NULL flags this as an incomplete/system checkout
    const updates = openSessions.map(async (session) => {
      return supabase
        .from('attendance')
        .update({
          check_out: autoCheckoutTime,
          total_minutes: null,   // NULL = incomplete working hours (forgot to checkout)
          status: 'auto_checkout' // System checkout flag
        })
        .eq('id', session.id);
    });

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      message: `Auto-checked out ${openSessions.length} users. Working hours set to NULL.`,
    });

  } catch (error: any) {
    console.error('Auto-checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
