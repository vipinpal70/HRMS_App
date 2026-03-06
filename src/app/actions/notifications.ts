'use server';

import { createClient } from '@/lib/supabase/server';

// ─── Fetch Notifications (paginated) ────────────────────────

export async function getNotifications(limit = 20, offset = 0) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

// ─── Unread Count ───────────────────────────────────────────

export async function getUnreadCount() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return 0;
    }
}

// ─── Mark Single as Read ────────────────────────────────────

export async function markAsRead(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
            .eq('user_id', user.id); // RLS double-check

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return { error: error.message };
    }
}

// ─── Mark All as Read ───────────────────────────────────────

export async function markAllAsRead() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error marking all as read:', error);
        return { error: error.message };
    }
}

// ─── Delete Single ──────────────────────────────────────────

export async function deleteNotification(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return { error: error.message };
    }
}

// ─── Cleanup: delete old read notifications ─────────────────

export async function deleteAllRead() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id)
            .eq('is_read', true)
            .lt('created_at', thirtyDaysAgo.toISOString());

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error cleaning up notifications:', error);
        return { error: error.message };
    }
}
