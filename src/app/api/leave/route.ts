import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function countCalendarDays(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

const getLocalISODate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    let startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // By default, load only last 2 months (current and previous)
    if (!startDate && !endDate) {
      const now = new Date();
      const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = getLocalISODate(firstOfPrevMonth);
    }

    let query = supabase.from('leave_requests').select(`*, user:user_id(name, email, remaining_leaves, total_leaves)`);

    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') query = query.eq('user_id', user.id);
    } else {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') query = query.eq('user_id', user.id);
    }

    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const typeMap: Record<string, string> = { 'leave': 'full-day', 'halfday': 'half-day', 'wfh': 'wfh', 'hybrid': 'hybrid' };

    return NextResponse.json(data.map(req => ({
      ...req,
      type: typeMap[req.category] || req.category,
      start_date: req.start_day,
      end_date: req.end_day,
      user_name: (req.user as any)?.name || (req.user as any)?.email || 'Unknown',
      user_email: (req.user as any)?.email || '',
      remaining_leaves: (req.user as any)?.remaining_leaves ?? null,
      total_leaves: (req.user as any)?.total_leaves ?? null,
    })));
  } catch (error: any) {
    console.error('Leave GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type: uiType, start_date, end_date, reason } = body;

    const categoryMap: Record<string, string> = { 'full-day': 'leave', 'half-day': 'halfday', 'wfh': 'wfh', 'hybrid': 'hybrid' };
    const category = categoryMap[uiType] || uiType;

    const { error } = await supabase.from('leave_requests').insert({ user_id: user.id, category, start_day: start_date, end_day: end_date, reason, status: 'pending' });
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Leave request submitted.' });
  } catch (error: any) {
    console.error('Leave POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, id, status } = body;

    if (action === 'retract') {
      const { data: leaveReq, error: fetchError } = await supabase.from('leave_requests').select('user_id, status').eq('id', id).single();
      if (fetchError || !leaveReq) return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
      if (leaveReq.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      let newStatus = '';
      if (leaveReq.status === 'pending') newStatus = 'cancelled';
      else if (leaveReq.status === 'approved') newStatus = 'retraction_pending';
      else return NextResponse.json({ error: 'Cannot retract request in current status.' }, { status: 400 });

      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { error: updateError } = await supabaseAdmin.from('leave_requests').update({ status: newStatus }).eq('id', id).select().single();
      if (updateError) throw updateError;

      if (newStatus === 'retraction_pending') {
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'hr']);
        if (admins && admins.length > 0) {
          const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', user.id).single();
          const empName = profile?.name || profile?.email || 'An employee';
          const notifications = admins.map(admin => ({ user_id: admin.id, title: 'Leave Retraction Request', message: `${empName} has requested to retract an approved leave.`, is_read: false, category: 'leave_request', link: '/leave' }));
          await supabase.from('notifications').insert(notifications);
        }
      }
      return NextResponse.json({ success: true, message: `Request ${newStatus === 'cancelled' ? 'cancelled' : 'retraction sent to admin'}.` });
    }

    if (action === 'updateStatus') {
      const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

      const { data: leaveReq, error: fetchError } = await supabase.from('leave_requests').select('user_id, category, start_day, end_day, status').eq('id', id).single();
      if (fetchError || !leaveReq) return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
      if (leaveReq.status === 'approved' && status !== 'cancelled') return NextResponse.json({ error: 'Leave is already approved.' }, { status: 400 });

      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { error: updateError } = await supabaseAdmin.from('leave_requests').update({ status }).eq('id', id);
      if (updateError) throw updateError;

      const shouldDeduct = status === 'approved' && leaveReq.status === 'pending';
      const shouldRefund = status === 'cancelled' && (leaveReq.status === 'approved' || leaveReq.status === 'retraction_pending');

      if (shouldDeduct || shouldRefund) {
        const { data: empProfile } = await supabase.from('profiles').select('remaining_leaves').eq('id', leaveReq.user_id).single();
        const currentLeaves = empProfile?.remaining_leaves ?? 0;
        let days = 0;
        if (leaveReq.category === 'leave') {
          days = countCalendarDays(leaveReq.start_day, leaveReq.end_day || leaveReq.start_day);
        } else if (leaveReq.category === 'halfday') {
          days = Math.max(0.5, countCalendarDays(leaveReq.start_day, leaveReq.end_day || leaveReq.start_day) * 0.5);
        }
        if (days > 0) {
          let newBalance = currentLeaves;
          if (shouldDeduct) newBalance = Math.max(0, currentLeaves - days);
          if (shouldRefund) newBalance = currentLeaves + days;
          await supabaseAdmin.from('profiles').update({ remaining_leaves: newBalance }).eq('id', leaveReq.user_id);
        }
      }
      return NextResponse.json({ success: true, message: `Request ${status}.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Leave PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabaseAdmin.from('leave_requests').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Leave request deleted.' });
  } catch (error: any) {
    console.error('Leave DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
