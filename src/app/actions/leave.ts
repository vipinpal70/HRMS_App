'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export async function getLeaveRequests(userId?: string, startDate?: string, endDate?: string) {
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
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin' && profile?.role !== 'hr') {
        query = query.eq('user_id', user.id);
      }
    }

    // Apply date range filter on created_at (Requested On date)
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Reverse map DB category → UI type
    const typeMap: Record<string, string> = {
      'leave': 'full-day',
      'halfday': 'half-day',
      'wfh': 'wfh',
      'hybrid': 'hybrid',
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

    // Map UI type → DB category (constraint allows: 'leave', 'wfh', 'halfday', 'hybrid')
    const categoryMap: Record<string, string> = {
      'full-day': 'leave',
      'half-day': 'halfday',
      'wfh': 'wfh',
      'hybrid': 'hybrid',
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

export async function deleteLeaveRequest(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Use Supabase Admin client to bypass RLS and avoid recursive policy checks
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.from('leave_requests').delete().eq('id', id);

    if (error) throw error;

    revalidatePath('/leave');
    return { success: true, message: 'Leave request deleted.' };
  } catch (error: any) {
    console.error('Delete leave error:', error);
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

export async function retractLeaveRequest(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const { data: leaveReq, error: fetchError } = await supabase
      .from('leave_requests')
      .select('user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !leaveReq) {
      return { error: 'Leave request not found.' };
    }

    if (leaveReq.user_id !== user.id) {
      return { error: 'Unauthorized' };
    }

    let newStatus: string = '';
    if (leaveReq.status === 'pending') {
      newStatus = 'cancelled';
    } else if (leaveReq.status === 'approved') {
      newStatus = 'retraction_pending';
    } else {
      return { error: 'Cannot retract request in current status.' };
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: updateError, data: updatedData } = await supabaseAdmin
      .from('leave_requests')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Notify admins/HR if it's a retraction request for an approved leave
    if (newStatus === 'retraction_pending') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'hr']);

      if (admins && admins.length > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single();

        const empName = profile?.name || profile?.email || 'An employee';
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: 'Leave Retraction Request',
          message: `${empName} has requested to retract an approved leave.`,
          is_read: false,
          category: 'leave_request',
          link: '/leave'
        }));
        await supabase.from('notifications').insert(notifications);
      }
    }

    revalidatePath('/leave');
    console.log('retractLeaveRequest success, status:', newStatus);
    return { success: true, message: `Request ${newStatus === 'cancelled' ? 'cancelled' : 'retraction sent to admin'}.` };
  } catch (error: any) {
    console.error('Retract leave error:', error);
    return { error: error.message };
  }
}

export async function updateLeaveStatus(id: string, status: 'approved' | 'rejected' | 'cancelled') {
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

    // Don't allow re-processing an already approved request unless we are cancelling it
    if (leaveReq.status === 'approved' && status !== 'cancelled') {
      return { error: 'Leave is already approved.' };
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: updateError } = await supabaseAdmin
      .from('leave_requests')
      .update({ status })
      .eq('id', id);

    if (updateError) throw updateError;

    // Deduct or Refund logic
    // Decide whether we deduct or refund
    const shouldDeduct = status === 'approved' && leaveReq.status === 'pending';
    const shouldRefund =
      status === 'cancelled' &&
      (leaveReq.status === 'approved' || leaveReq.status === 'retraction_pending');

    if (shouldDeduct || shouldRefund) {

      const { data: empProfile } = await supabase
        .from('profiles')
        .select('remaining_leaves')
        .eq('id', leaveReq.user_id)
        .single();

      const currentLeaves = empProfile?.remaining_leaves ?? 0;

      let days = 0;

      if (leaveReq.category === 'leave') {
        days = countWorkingDays(
          leaveReq.start_day,
          leaveReq.end_day || leaveReq.start_day
        );
      }

      if (days > 0) {

        let newBalance = currentLeaves;

        if (shouldDeduct) {
          newBalance = Math.max(0, currentLeaves - days);
        }

        if (shouldRefund) {
          newBalance = currentLeaves + days;
        }

        await supabaseAdmin
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

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
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
