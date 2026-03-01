'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getTasks(userId?: string, startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    let query = supabase.from('tasks').select(`
      *,
      assignee:assigned_to(name, email),
      creator:created_by(name)
    `);

    // RBAC Logic
    // If userId is 'all', check if admin
    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        // If not admin, force own tasks
        query = query.eq('assigned_to', user.id);
      } else {
        // Admin/HR: apply date range filter
        // Default to current week (Monday to Sunday) if no dates provided
        if (!startDate || !endDate) {
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const monday = new Date(now);
          monday.setDate(now.getDate() + mondayOffset);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);

          startDate = monday.toISOString().split('T')[0];
          endDate = sunday.toISOString().split('T')[0];
        }
        query = query.gte('start_day', startDate).lte('start_day', endDate);
      }
    } else {
      // Default to own tasks
      query = query.eq('assigned_to', user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(task => ({
      ...task,
      assignee_name: (task.assignee as any)?.name || (task.assignee as any)?.email || 'Unknown',
      assignee_email: (task.assignee as any)?.email || '',
      creator_name: (task.creator as any)?.name || 'System'
    }));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Check Role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'hr') {
      return { error: 'Only Admins/HR can create tasks.' };
    }

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const assigned_to = formData.get('assigned_to') as string;
    const priority = formData.get('priority') as string;
    const due_date = formData.get('due_date') as string;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const endDay = due_date ? new Date(due_date).toISOString().split('T')[0] : today;

    const { error } = await supabase.from('tasks').insert({
      title,
      description,
      assigned_to,
      priority,
      created_by: user.id,
      start_day: today,
      end_day: endDay,
      status: 'pending'
    });

    if (error) throw error;

    revalidatePath('/tasks');
    return { success: true, message: 'Task created successfully.' };
  } catch (error: any) {
    console.error('Create task error:', error);
    return { error: error.message };
  }
}

export async function getEmployeesList() {
  try {
    const supabase = await createClient();
    // Only fetch necessary fields
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
