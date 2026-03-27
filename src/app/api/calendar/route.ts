import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'events') {
      const month = parseInt(searchParams.get('month')!);
      const year = parseInt(searchParams.get('year')!);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase.from('company_calendar').select('*').gte('date', startDate).lte('date', endDate);
      if (error) throw error;

      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('name, dob').not('dob', 'is', null);

      if (!profileError && profiles) {
        const birthdays = profiles
          .filter(p => { const dob = new Date(p.dob); return dob.getMonth() + 1 === month; })
          .map(p => ({ date: `${year}-${String(month).padStart(2, '0')}-${String(new Date(p.dob).getDate()).padStart(2, '0')}`, type: 'event', description: `🎂 ${p.name}'s Birthday` }));
        return NextResponse.json([...(data || []), ...birthdays]);
      }
      return NextResponse.json(data || []);
    }

    if (type === 'holidays') {
      const year = parseInt(searchParams.get('year')!);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data, error } = await supabase.from('company_calendar').select('*').eq('type', 'holiday').gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
      if (error) throw error;

      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: profiles, error: profileError } = await supabaseAdmin.from('profiles').select('name, dob').not('dob', 'is', null);

      if (!profileError && profiles) {
        const birthdays = profiles.map(p => {
          const dob = new Date(p.dob);
          return { date: `${year}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`, type: 'event', description: `🎂 ${p.name}'s Birthday` };
        });
        return NextResponse.json([...(data || []), ...birthdays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }
      return NextResponse.json(data || []);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('Calendar GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;

    if (action === 'addHoliday') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      const { error } = await supabase.from('company_calendar').upsert({ date: body.date, type: 'holiday', description: body.description }, { onConflict: 'date' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'ensureWeekends') {
      const month = body.month;
      const year = body.year;
      const lastDay = new Date(year, month, 0).getDate();
      const weekends = [];
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekends.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, type: 'weekend', description: dayOfWeek === 0 ? 'Sunday' : 'Saturday' });
        }
      }
      const { error } = await supabase.from('company_calendar').upsert(weekends, { onConflict: 'date', ignoreDuplicates: true });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Calendar POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase.from('company_calendar').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Calendar DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
