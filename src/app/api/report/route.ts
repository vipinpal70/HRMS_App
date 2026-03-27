import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/time';

async function isAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return profile?.role === 'admin' || profile?.role === 'hr';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'employee-search') {
      const isAdminUser = await isAdmin(supabase);
      if (!isAdminUser) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      const search = searchParams.get('query') || '';
      let query = supabase.from('profiles').select('id, name, email, emp_id, designation').order('name', { ascending: true });
      if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ success: true, data: data || [] });
    }

    if (type === 'employee-report') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

      const employeeId = searchParams.get('userId')!;
      const currentDate = new Date();
      const monthlyStats: any[] = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const { data, error } = await supabase.from('attendance').select('*').eq('user_id', employeeId).gte('date', startDate).lte('date', endDate).order('date', { ascending: false });
        if (error) continue;
        const safeData = data || [];
        const detailedRecords = safeData.map(r => ({ ...r, check_in_display: r.check_in ? formatTime(r.check_in) : null, check_out_display: r.check_out ? formatTime(r.check_out) : null, hours_display: r.total_minutes ? `${Math.floor(r.total_minutes / 60)}h ${r.total_minutes % 60}m` : null }));
        monthlyStats.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          present: safeData.filter((r: any) => r.present === true || r.status === 'on_time').length,
          absent: safeData.filter((r: any) => r.status === 'absent').length,
          leave: safeData.filter((r: any) => r.status === 'half_day').length,
          late: safeData.filter((r: any) => r.status === 'late').length,
          wfh: safeData.filter((r: any) => r.work_type === 'wfh').length,
          detailedRecords,
          totalHours: safeData.reduce((s: number, r: any) => s + (r.total_minutes || 0), 0),
          averageHoursPerDay: safeData.length > 0 ? Math.round((safeData.reduce((s: number, r: any) => s + (r.total_minutes || 0), 0) / safeData.length / 60) * 10) / 10 : 0,
          overtimeHours: safeData.reduce((s: number, r: any) => s + (r.overtime_by || 0), 0)
        });
      }
      return NextResponse.json({ success: true, data: monthlyStats.reverse() });
    }

    if (type === 'monthly-aggregate') {
      const isAdminUser = await isAdmin(supabase);
      if (!isAdminUser) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      const currentDate = new Date();
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const { data, error } = await supabase.from('attendance').select('status, work_type, user_id, date, present').gte('date', startDate.toISOString().split('T')[0]).lte('date', endDate.toISOString().split('T')[0]).order('date');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const dataByMonth = new Map<string, any[]>();
      (data || []).forEach(r => {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!dataByMonth.has(key)) dataByMonth.set(key, []);
        dataByMonth.get(key)!.push(r);
      });

      const monthlyStats = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const md = dataByMonth.get(key) || [];
        monthlyStats.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          present: [...new Set(md.filter((r: any) => r.present === true || r.status === 'on_time').map((r: any) => r.user_id))].length,
          absent: [...new Set(md.filter((r: any) => r.status === 'absent').map((r: any) => r.user_id))].length,
          leave: [...new Set(md.filter((r: any) => r.status === 'half_day').map((r: any) => r.user_id))].length,
          late: [...new Set(md.filter((r: any) => r.status === 'late').map((r: any) => r.user_id))].length,
          wfh: [...new Set(md.filter((r: any) => r.work_type === 'wfh').map((r: any) => r.user_id))].length,
          totalEmployees: [...new Set(md.map((r: any) => r.user_id))].length
        });
      }
      return NextResponse.json({ success: true, data: monthlyStats.reverse() });
    }

    if (type === 'attendance-aggregate') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json([]);
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json([]);

      const month = parseInt(searchParams.get('month')!);
      const year = parseInt(searchParams.get('year')!);
      const employeeId = searchParams.get('userId') || undefined;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

      let query = supabase.from('attendance').select('user_id, status, work_type, total_minutes, check_in, check_out, present, profiles!inner(name, email, emp_id, designation)').gte('date', startDate).lte('date', endDateStr).order('date', { ascending: false });
      if (employeeId && employeeId !== 'all') query = query.eq('user_id', employeeId);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json((data || []).map(r => ({
        ...r,
        employee_name: (r.profiles as any)?.name || 'Unknown',
        employee_email: (r.profiles as any)?.email || '',
        employee_emp_id: (r.profiles as any)?.emp_id || '',
        employee_designation: (r.profiles as any)?.designation || '',
        check_in_display: r.check_in ? formatTime(r.check_in) : null,
        check_out_display: r.check_out ? formatTime(r.check_out) : null,
        hours_display: r.total_minutes ? `${Math.floor(r.total_minutes / 60)}h ${r.total_minutes % 60}m` : null,
      })));
    }

    if (type === 'weekly-tasks' || type === 'monthly-tasks' || type === 'quarterly-tasks') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const eid = searchParams.get('userId') || undefined;

      if (type === 'weekly-tasks') {
        const s = new Date(); s.setDate(s.getDate() - s.getDay()); s.setHours(0,0,0,0);
        const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999);
        let q = supabase.from('tasks').select('status, assigned_to, created_at').gte('created_at', s.toISOString()).lte('created_at', e.toISOString());
        if (eid) q = q.eq('assigned_to', eid);
        const { data } = await q;
        const wm: any = {}; ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { wm[d] = { week: d, done: 0, pending: 0 }; });
        (data || []).forEach((t: any) => { const d = new Date(t.created_at).toLocaleDateString('en-US', { weekday: 'short' }); if (wm[d]) { t.status === 'completed' ? wm[d].done++ : wm[d].pending++; } });
        return NextResponse.json({ success: true, data: Object.values(wm) });
      }

      if (type === 'monthly-tasks') {
        const now = new Date(); const cy = now.getFullYear(); const cm = now.getMonth();
        const stats = [];
        for (let i = 0; i <= cm; i++) {
          const m = i + 1;
          const sd = `${cy}-${String(m).padStart(2, '0')}-01`;
          const ed = new Date(cy, m, 0).toISOString().split('T')[0];
          let q = supabase.from('tasks').select('status, assigned_to, created_at').gte('created_at', sd).lte('created_at', ed);
          if (eid) q = q.eq('assigned_to', eid);
          const { data } = await q;
          const sd2 = data || [];
          stats.push({ month: new Date(cy, i).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), done: sd2.filter((t: any) => t.status === 'completed').length, pending: sd2.filter((t: any) => t.status !== 'completed').length });
        }
        return NextResponse.json({ success: true, data: stats.reverse() });
      }

      if (type === 'quarterly-tasks') {
        const cy = new Date().getFullYear();
        const qm: any = {};
        for (let i = 0; i < 4; i++) {
          const sn = new Date(cy, i*3, 1).toLocaleDateString('en-US', { month: 'short' });
          const en = new Date(cy, i*3+2, 1).toLocaleDateString('en-US', { month: 'short' });
          qm[`Q${i+1} ${cy}`] = { quarter: `Q${i+1} ${cy} (${sn}-${en})`, done: 0, pending: 0 };
        }
        const sd = new Date(cy, 0, 1); sd.setHours(0,0,0,0);
        const ed = new Date(cy, 11, 31); ed.setHours(23,59,59,999);
        let q = supabase.from('tasks').select('status, assigned_to, created_at').gte('created_at', sd.toISOString()).lte('created_at', ed.toISOString());
        if (eid) q = q.eq('assigned_to', eid);
        const { data } = await q;
        (data || []).forEach((t: any) => {
          const td = new Date(t.created_at);
          const qk = `Q${Math.floor(td.getMonth() / 3) + 1} ${td.getFullYear()}`;
          if (qm[qk]) { t.status === 'completed' ? qm[qk].done++ : qm[qk].pending++; }
        });
        return NextResponse.json({ success: true, data: Object.values(qm) });
      }
    }

    if (type === 'report-data') {
      const isAdminUser = await isAdmin(supabase);
      if (!isAdminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      const now = new Date();
      const month = now.getMonth() + 1, year = now.getFullYear();
      const sd = `${year}-${String(month).padStart(2, '0')}-01`;
      const ed = `${year}-${String(month).padStart(2, '0')}-31`;

      const { data: attData } = await supabase.from('attendance').select('user_id, status, work_type, total_minutes, overtime_by, present, profiles(name)').gte('date', sd).lte('date', ed).order('user_id');
      const safeData = attData || [];
      const employees = [...new Set(safeData.map((i: any) => i.profiles?.name).filter(Boolean))];

      const { data: empData } = await supabase.from('profiles').select('id, name, email, emp_id, designation').order('name', { ascending: true });
      return NextResponse.json({ attendance: employees, tasks: [], employees: empData || [] });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Report GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
