import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const getLocalISODate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: getLocalISODate(start), end: getLocalISODate(end) };
}

// Add this utility above the POST handler
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  // Safety cap: max 365 rows
  let count = 0;
  while (current <= endDate && count < 365) {
    dates.push(getLocalISODate(current));
    current.setDate(current.getDate() + 1);
    count++;
  }
  return dates;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'employees-list') {
      const { data, error } = await supabase.from('profiles').select('id, name, email, role').order('name');
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Default: get tasks
    const userId = searchParams.get('userId') || undefined;
    let startDate = searchParams.get('startDate') || undefined;
    let endDate = searchParams.get('endDate') || undefined;
    const employeeFilter = searchParams.get('employeeFilter') || undefined;

    let query = supabase.from('tasks').select(`*, assignee:assigned_to(id, name, email), creator:created_by(name)`);

    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('assigned_to', user.id);
      } else {
        if (!startDate || !endDate) { const range = getCurrentMonthRange(); startDate = range.start; endDate = range.end; }
        query = query.gte('start_day', startDate).lte('start_day', endDate);
        if (employeeFilter) query = query.eq('assigned_to', employeeFilter);
      }
    } else {
      if (!startDate || !endDate) { const range = getCurrentMonthRange(); startDate = range.start; endDate = range.end; }
      query = query.eq('assigned_to', user.id).gte('start_day', startDate).lte('start_day', endDate);
    }

    const { data, error } = await query.order('start_day', { ascending: true }).order('priority', { ascending: true });
    if (error) throw error;

    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const mapped = data.map(task => ({
      ...task,
      assignee_name: (task.assignee as any)?.name || (task.assignee as any)?.email || 'Unknown',
      assignee_email: (task.assignee as any)?.email || '',
      assignee_id: (task.assignee as any)?.id || '',
      creator_name: (task.creator as any)?.name || 'System'
    }));

    const today = getLocalISODate();
    mapped.sort((a, b) => {
      const aT = a.start_day === today ? 0 : 1, bT = b.start_day === today ? 0 : 1;
      if (aT !== bT) return aT - bT;
      if (a.start_day !== b.start_day) return a.start_day < b.start_day ? -1 : 1;
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (body.action === 'create') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') return NextResponse.json({ error: 'Only Admins/HR can create tasks.' }, { status: 403 });

      const assigneeIds = body.assigned_to.split(',').map((id: string) => id.trim()).filter(Boolean);
      if (assigneeIds.length === 0) return NextResponse.json({ error: 'Please assign the task to at least one employee.' }, { status: 400 });

      const today = getLocalISODate();
      const startDay = body.start_day || today;
      const rows = assigneeIds.map((aid: string) => ({ title: body.title, description: body.description, assigned_to: aid, priority: body.priority, created_by: user.id, start_day: startDay, end_day: body.end_day || startDay, status: 'pending' }));

      const { error } = await supabase.from('tasks').insert(rows);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Task created for ${assigneeIds.length} employee(s).` });
    }

    if (body.action === 'createSelf') {
      const { data: profile } = await supabase.from('profiles').select('name, email, role').eq('id', user.id).single();
      if (!body.title) return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });

      const start_day = body.start_day || getLocalISODate();
      const end_day = body.end_day || start_day;
      const is_daily = body.is_daily === true;

      // Generate rows: one per day if daily, else just start_day
      const dates = is_daily ? getDateRange(start_day, end_day) : [start_day];

      const rows = dates.map(date => ({
        title: body.title,
        description: body.description,
        assigned_to: user.id,
        priority: body.priority || 'medium',
        created_by: user.id,
        start_day: date,
        end_day: date,      // each row owns exactly one day
        status: 'pending',
        is_daily,           // flag preserved for badge display
      }));

      const { error: insertError } = await supabase.from('tasks').insert(rows);
      if (insertError) throw insertError;

      // Notify admins
      const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin']);
      if (admins && admins.length > 0) {
        const empName = profile?.name || profile?.email || 'An employee';
        const label = is_daily ? `daily task (${dates.length} days)` : 'task';
        await supabase.from('notifications').insert(
          admins.map(admin => ({
            user_id: admin.id,
            title: 'New Self-Assigned Task',
            message: `${empName} added a new ${label}: "${body.title}"`,
            is_read: false,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        message: is_daily
          ? `Daily task created for ${dates.length} day(s).`
          : 'Task added successfully.',
      });
    }

    if (body.action === 'checkNotify') {
      const now = new Date();
      if (now.getHours() < 11) return NextResponse.json({ skipped: true });
      const today = getLocalISODate();
      const NOTIF_TITLE = 'No Tasks Added';
      const { data: employees } = await supabase.from('profiles').select('id').eq('role', 'emp');
      if (!employees || employees.length === 0) return NextResponse.json({ success: true });

      for (const emp of employees) {
        const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', emp.id).eq('start_day', today);
        if ((taskCount ?? 0) > 0) continue;
        const startOfDay = `${today}T00:00:00.000Z`;
        const { count: existingNotif } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', emp.id).eq('title', NOTIF_TITLE).gte('created_at', startOfDay);
        if ((existingNotif ?? 0) > 0) continue;
        await supabase.from('notifications').insert({ user_id: emp.id, title: NOTIF_TITLE, message: "You haven't added any tasks yet today. Please update your task list.", is_read: false });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    if (body.action === 'updateStatus') {
      const validStatuses = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isAdminOrHR = profile?.role === 'admin' || profile?.role === 'hr';

      if (!isAdminOrHR) {
        const { data: task } = await supabase.from('tasks').select('assigned_to').eq('id', body.taskId).maybeSingle();
        if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
        if (task.assigned_to !== user.id) return NextResponse.json({ error: 'You can only update your own tasks.' }, { status: 403 });
      }

      const { data, error } = await supabase.from('tasks').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.taskId).select().maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Task not found or update failed.' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Task status updated.', data });
    }

    if (body.action === 'update') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isAdminOrHR = profile?.role === 'admin' || profile?.role === 'hr';

      if (!isAdminOrHR) {
        const { data: task } = await supabase.from('tasks').select('assigned_to').eq('id', body.taskId).maybeSingle();
        if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
        if (task.assigned_to !== user.id) return NextResponse.json({ error: 'You can only edit your own tasks.' }, { status: 403 });
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.title) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.priority) updates.priority = body.priority;
      if (body.status) updates.status = body.status;
      if (body.start_day) updates.start_day = body.start_day;
      if (body.end_day) updates.end_day = body.end_day;
      if (body.assigned_to) updates.assigned_to = body.assigned_to;

      const { error } = await supabase.from('tasks').update(updates).eq('id', body.taskId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Task updated successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only Admins can delete tasks.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Task deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
