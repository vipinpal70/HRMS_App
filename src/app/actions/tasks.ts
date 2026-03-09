'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Helper: get current month date range
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export async function getTasks(
  userId?: string,
  startDate?: string,
  endDate?: string,
  employeeFilter?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    let query = supabase.from('tasks').select(`
      *,
      assignee:assigned_to(id, name, email),
      creator:created_by(name)
    `);

    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('assigned_to', user.id);
      } else {
        // Admin/HR: apply date range (default: current month)
        if (!startDate || !endDate) {
          const range = getCurrentMonthRange();
          startDate = range.start;
          endDate = range.end;
        }
        query = query.gte('start_day', startDate).lte('start_day', endDate);

        // Filter by specific employee
        if (employeeFilter) {
          query = query.eq('assigned_to', employeeFilter);
        }
      }
    } else {
      // Own tasks — default to current month
      if (!startDate || !endDate) {
        const range = getCurrentMonthRange();
        startDate = range.start;
        endDate = range.end;
      }
      query = query.eq('assigned_to', user.id).gte('start_day', startDate).lte('start_day', endDate);
    }

    const { data, error } = await query
      .order('start_day', { ascending: true })
      .order('priority', { ascending: true });

    if (error) throw error;

    // Custom priority sort (critical first)
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    const mapped = data.map(task => ({
      ...task,
      assignee_name: (task.assignee as any)?.name || (task.assignee as any)?.email || 'Unknown',
      assignee_email: (task.assignee as any)?.email || '',
      assignee_id: (task.assignee as any)?.id || '',
      creator_name: (task.creator as any)?.name || 'System'
    }));

    // Sort: today's tasks first, then by date ascending, then by priority
    const today = new Date().toISOString().split('T')[0];
    mapped.sort((a, b) => {
      const aIsToday = a.start_day === today ? 0 : 1;
      const bIsToday = b.start_day === today ? 0 : 1;
      if (aIsToday !== bIsToday) return aIsToday - bIsToday;

      if (a.start_day !== b.start_day) return a.start_day < b.start_day ? -1 : 1;

      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });

    return mapped;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function updateTaskStatus(taskId: string, newStatus: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('Update status failed: Unauthorized');
      return { error: 'Unauthorized' };
    }

    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(newStatus)) {
      console.log(`Update status failed: Invalid status ${newStatus}`);
      return { error: 'Invalid status.' };
    }

    // Check if user owns the task or is admin/hr
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isAdminOrHR = profile?.role === 'admin' || profile?.role === 'hr';
    console.log(`User ${user.email} (Role: ${profile?.role}) is updating task ${taskId} to ${newStatus}`);

    if (!isAdminOrHR) {
      // Employee: can only update own tasks
      const { data: task, error: fetchError } = await supabase.from('tasks').select('assigned_to').eq('id', taskId).maybeSingle();
      if (fetchError || !task) {
        console.log(`Update status failed: Task ${taskId} not found for ownership check`);
        return { error: 'Task not found.' };
      }
      if (task.assigned_to !== user.id) {
        console.log(`Update status failed: User ${user.id} does not own task ${taskId} (Assigned to: ${task.assigned_to})`);
        return { error: 'You can only update your own tasks.' };
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Database update error:', error);
      throw error;
    }

    if (!data) {
      console.log(`Update status failed: No row updated for task ${taskId}. Possible RLS restriction?`);
      return { error: 'Task not found or update failed.' };
    }

    console.log(`Update success: Task ${taskId} status changed to ${newStatus}`);
    revalidatePath('/tasks');
    return { success: true, message: 'Task status updated.', data };
  } catch (error: any) {
    console.error('Update task status exception:', error);
    return { error: error.message };
  }
}

export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'hr') {
      return { error: 'Only Admins/HR can create tasks.' };
    }

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as string;
    const start_day = formData.get('start_day') as string;
    const end_day = formData.get('end_day') as string;

    // Multi-assignee: comma-separated UUIDs
    const assignedToRaw = formData.get('assigned_to') as string;
    const assigneeIds = assignedToRaw.split(',').map(id => id.trim()).filter(Boolean);

    if (assigneeIds.length === 0) {
      return { error: 'Please assign the task to at least one employee.' };
    }

    const today = new Date().toISOString().split('T')[0];
    const startDay = start_day || today;
    const endDay = end_day || startDay;

    // Create one row per assignee
    const rows = assigneeIds.map(assignee_id => ({
      title,
      description,
      assigned_to: assignee_id,
      priority,
      created_by: user.id,
      start_day: startDay,
      end_day: endDay,
      status: 'pending'
    }));

    const { error } = await supabase.from('tasks').insert(rows);

    if (error) throw error;

    revalidatePath('/tasks');
    return { success: true, message: `Task created for ${assigneeIds.length} employee(s).` };
  } catch (error: any) {
    console.error('Create task error:', error);
    return { error: error.message };
  }
}

export async function updateTask(taskId: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'hr') {
      return { error: 'Only Admins/HR can edit tasks.' };
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as string;
    const status = formData.get('status') as string;
    const start_day = formData.get('start_day') as string;
    const end_day = formData.get('end_day') as string;
    const assigned_to = formData.get('assigned_to') as string;

    if (title) updates.title = title;
    if (description !== null) updates.description = description;
    if (priority) updates.priority = priority;
    if (status) updates.status = status;
    if (start_day) updates.start_day = start_day;
    if (end_day) updates.end_day = end_day;
    if (assigned_to) updates.assigned_to = assigned_to;

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) throw error;

    revalidatePath('/tasks');
    return { success: true, message: 'Task updated successfully.' };
  } catch (error: any) {
    console.error('Update task error:', error);
    return { error: error.message };
  }
}

export async function getEmployeesList() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .order('name');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
}

/**
 * Allows an employee to create a task for themselves.
 * Notifies all admins/HR that an employee added their own task.
 */
export async function createSelfTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Fetch the employee's profile (name for notification message)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, role')
      .eq('id', user.id)
      .single();

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = (formData.get('priority') as string) || 'medium';
    const start_day = (formData.get('start_day') as string) || new Date().toISOString().split('T')[0];
    const end_day = (formData.get('end_day') as string) || start_day;

    if (!title) return { error: 'Task title is required.' };

    // Insert the task assigned to themselves
    const { error: insertError } = await supabase.from('tasks').insert({
      title,
      description,
      assigned_to: user.id,
      priority,
      created_by: user.id,
      start_day,
      end_day,
      status: 'pending',
    });

    if (insertError) throw insertError;

    // Notify all admins and HR
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin']);

    if (admins && admins.length > 0) {
      const empName = profile?.name || profile?.email || 'An employee';
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        title: 'New Self-Assigned Task',
        message: `${empName} added a new task for themselves: "${title}"`,
        is_read: false,
      }));
      await supabase.from('notifications').insert(notifications);
    }

    revalidatePath('/tasks');
    return { success: true, message: 'Task added successfully.' };
  } catch (error: any) {
    console.error('createSelfTask error:', error);
    return { error: error.message };
  }
}

/**
 * Checks employees who have no tasks for today after 11 AM.
 * Sends a reminder notification to those employees.
 * Safe to call on every page load — guards against duplicate notifications.
 */
export async function checkAndNotifyNoTasks() {
  try {
    const now = new Date();
    // Only run at or after 11:00 AM
    if (now.getHours() < 11) return { skipped: true };

    const supabase = await createClient();
    const today = now.toISOString().split('T')[0];
    const NOTIF_TITLE = 'No Tasks Added';

    // Fetch all employees
    const { data: employees } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'emp');

    if (!employees || employees.length === 0) return { success: true };

    for (const emp of employees) {
      // Check if they already have a task for today
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', emp.id)
        .eq('start_day', today);

      if ((taskCount ?? 0) > 0) continue; // Has tasks, skip

      // Check if already notified today (dedup)
      const startOfDay = `${today}T00:00:00.000Z`;
      const { count: existingNotif } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', emp.id)
        .eq('title', NOTIF_TITLE)
        .gte('created_at', startOfDay);

      if ((existingNotif ?? 0) > 0) continue; // Already notified today, skip

      // Send notification
      await supabase.from('notifications').insert({
        user_id: emp.id,
        title: NOTIF_TITLE,
        message: "You haven't added any tasks yet today. Please update your task list.",
        is_read: false,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('checkAndNotifyNoTasks error:', error);
    return { error: error.message };
  }
}

