import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrgDateString, getOrgTime } from '@/lib/time';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const today = getOrgDateString();

    // 1. Get all active users
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('role', 'emp'); // Only check employees? Or everyone?

    if (userError) throw userError;

    // 2. Get existing attendance for today
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('user_id')
      .eq('date', today);

    if (attError) throw attError;

    // 3. Find missing users
    const presentUserIds = new Set(attendance.map(a => a.user_id));
    const missingUsers = users.filter(u => !presentUserIds.has(u.id));

    if (missingUsers.length === 0) {
      return NextResponse.json({ message: 'Everyone is present or accounted for.' });
    }

    // 4. Mark them as absent
    const inserts = missingUsers.map(user => ({
      user_id: user.id,
      date: today,
      present: false,
      status: 'absent',
      check_in: null,
      check_out: null,
      total_minutes: 0,
      work_type: 'none'
    }));

    const { error: insertError } = await supabase
      .from('attendance')
      .insert(inserts);

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      marked_absent: missingUsers.length,
      users: missingUsers.map(u => u.email)
    });

  } catch (error: any) {
    console.error('Mark Absent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
