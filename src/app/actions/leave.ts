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

    return data.map(req => ({
      ...req,
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

    const type = formData.get('type') as string;
    const start_date = formData.get('start_date') as string;
    const end_date = formData.get('end_date') as string;
    const reason = formData.get('reason') as string;

    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      type,
      start_date,
      end_date,
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

export async function updateLeaveStatus(id: string, status: 'approved' | 'rejected') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check Admin Role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'hr') {
      return { error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/leave');
    return { success: true, message: `Request ${status}.` };
  } catch (error: any) {
    return { error: error.message };
  }
}
