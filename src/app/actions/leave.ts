'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getLeaveRequests(userId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    let query = supabase.from('leave_requests').select(`
      *,
      user:user_id(name, email)
    `);

    // RBAC Logic
    if (userId === 'all') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('user_id', user.id);
      }
    } else {
      // Default to own leaves unless Admin specifically requests all
      // Actually, getLeaveRequests usually implies "my leaves" OR "all leaves if admin"
      // Let's check role first
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('user_id', user.id);
      }
      // If admin, they see all by default unless filtered (which we handle on client or add filter here)
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Reverse map DB category → UI type
    const typeMap: Record<string, string> = {
      'leave': 'full-day',
      'halfday': 'half-day',
      'wfh': 'wfh',
    };

    return data.map(req => ({
      ...req,
      type: typeMap[req.category] || req.category, // DB 'category' → UI 'type'
      start_date: req.start_day,
      end_date: req.end_day,
      user_name: (req.user as any)?.name || (req.user as any)?.email || 'Unknown',
      user_email: (req.user as any)?.email || ''
    }));
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return [];
  }
}

export async function createLeaveRequest(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const uiType = formData.get('type') as string;
    const start_date = formData.get('start_date') as string;
    const end_date = formData.get('end_date') as string;
    const reason = formData.get('reason') as string;

    // Map UI type → DB category (constraint allows: 'leave', 'wfh', 'halfday')
    const categoryMap: Record<string, string> = {
      'full-day': 'leave',
      'half-day': 'halfday',
      'wfh': 'wfh',
    };
    const category = categoryMap[uiType] || uiType;
    console.log('createLeaveRequest payload:', { uiType, category, start_date, end_date, reason });

    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      category, // DB column
      start_day: start_date,
      end_day: end_date,
      reason,
      status: 'pending'
    });

    if (error) throw error;

    revalidatePath('/leave');
    return { success: true, message: 'Leave request submitted.' };
  } catch (error: any) {
    console.error('Create leave error:', error);
    return { error: error.message };
  }
}


/**
 * Count weekday (Mon–Fri) days between two date strings (inclusive).
 */
function countWorkingDays(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++; // Skip weekends
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function updateLeaveStatus(id: string, status: 'approved' | 'rejected') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check Admin Role
    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') {
      return { error: 'Unauthorized' };
    }

    // Fetch leave request details before updating
    const { data: leaveReq, error: fetchError } = await supabase
      .from('leave_requests')
      .select('user_id, category, start_day, end_day, status')
      .eq('id', id)
      .single();

    if (fetchError || !leaveReq) return { error: 'Leave request not found.' };

    // Don't allow re-processing an already approved request
    if (leaveReq.status === 'approved') {
      return { error: 'Leave is already approved.' };
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    // Deduct remaining_leaves only on approval
    if (status === 'approved') {
      // Fetch the employee's current remaining_leaves
      const { data: empProfile } = await supabase
        .from('profiles')
        .select('remaining_leaves')
        .eq('id', leaveReq.user_id)
        .single();

      const currentLeaves = empProfile?.remaining_leaves ?? 0;

      // Calculate days to deduct
      let daysToDeduct = 0;
      if (leaveReq.category === 'leave') {
        // Count actual working days in the leave range
        daysToDeduct = countWorkingDays(leaveReq.start_day, leaveReq.end_day || leaveReq.start_day);
      }
      // WFH doesn't deduct leave balance

      if (daysToDeduct > 0) {
        const newBalance = Math.max(0, currentLeaves - daysToDeduct);
        await supabase
          .from('profiles')
          .update({ remaining_leaves: newBalance })
          .eq('id', leaveReq.user_id);
      }
    }

    revalidatePath('/leave');
    revalidatePath('/employees');
    return { success: true, message: `Request ${status}.` };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Deducts 1 from remaining_leaves for an absent day (no check-in on a workday).
 * Call this from a scheduled job or admin action.
 */
export async function deductAbsentLeave(userId: string) {
  try {
    const supabase = await createClient();

    const { data: empProfile } = await supabase
      .from('profiles')
      .select('remaining_leaves')
      .eq('id', userId)
      .single();

    const currentLeaves = empProfile?.remaining_leaves ?? 0;
    const newBalance = Math.max(0, currentLeaves - 1);

    const { error } = await supabase
      .from('profiles')
      .update({ remaining_leaves: newBalance })
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('deductAbsentLeave error:', error);
    return { error: error.message };
  }
}
