import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgDateString } from '@/lib/time';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const today = getOrgDateString();

    // 1. Get office_end_time from company_settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('office_end_time')
      .single();

    const officeEndTime = settings?.office_end_time ?? '19:00';
    const autoCheckoutTime = new Date(`${today}T${officeEndTime}:00`).toISOString();

    // 2. Find all records that still have an open session (no check_out on session 1 or 2)
    const { data: openSessions, error } = await supabase
      .from('attendance')
      .select('id, user_id, check_in_1, check_out_1, check_in_2, check_out_2, total_minutes')
      .eq('date', today)
      .not('check_in_1', 'is', null);  // Has at least one check-in

    if (error) throw error;

    if (!openSessions || openSessions.length === 0) {
      return NextResponse.json({ message: 'No open sessions found to auto-checkout.' });
    }

    // Filter to only sessions with at least one open checkout
    const toUpdate = openSessions.filter(
      s => (s.check_in_1 && !s.check_out_1) || (s.check_in_2 && !s.check_out_2)
    );

    if (toUpdate.length === 0) {
      return NextResponse.json({ message: 'All sessions already closed.' });
    }

    // 3. Auto-checkout: set NULL total_minutes to flag incomplete hours
    const updates = toUpdate.map(async (session) => {
      const patch: Record<string, any> = {};

      if (session.check_in_1 && !session.check_out_1) {
        patch.check_out_1 = autoCheckoutTime;
      }
      if (session.check_in_2 && !session.check_out_2) {
        patch.check_out_2 = autoCheckoutTime;
      }
      // Mark total_minutes as null to signal auto/incomplete checkout
      patch.total_minutes = null;
      patch.status = 'auto_checkout';

      return supabase.from('attendance').update(patch).eq('id', session.id);
    });

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      message: `Auto-checked out ${toUpdate.length} users.`,
    });

  } catch (error: any) {
    console.error('Auto-checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
