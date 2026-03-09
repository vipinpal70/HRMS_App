'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
    getNotifications,
    getUnreadCount,
    markAsRead as markAsReadAction,
    markAllAsRead as markAllAsReadAction,
} from '../actions/notifications';
import toast from 'react-hot-toast';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category?: string;
    link?: string;
    is_read: boolean;
    metadata?: Record<string, any>;
    actor_id?: string;
    created_at: string;
}

// Tiny base64-encoded notification chime (short beep)
const NOTIFICATION_SOUND_DATA =
    'data:audio/wav;base64,UklGRl9vT19teleUhleVZN0AQABAAIAQEAAIA+f/8AAAIAQAAAEAAAAAA';

function playNotificationSound() {
    try {
        // Use Web Audio API for a short, pleasant chime
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1); // Slide up

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch {
        // Audio not available — fail silently
    }
}

const CATEGORY_LABELS: Record<string, string> = {
    leave_status: '📋 Leave',
    leave_request: '📝 Leave Request',
    task_assigned: '📌 Task',
    task_updated: '🔄 Task Update',
    attendance: '⏰ Attendance',
    system: '🔔 System',
    announcement: '📢 Announcement',
};

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<any>(null);
    const supabaseRef = useRef(createClient());

    // ─── Initial Fetch ──────────────────────────────────────
    const fetchInitial = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [data, count] = await Promise.all([
                getNotifications(20, 0),
                getUnreadCount(),
            ]);
            setNotifications(data as Notification[]);
            setUnreadCount(count);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchInitial();
    }, [fetchInitial]);

    // ─── Realtime Subscription ──────────────────────────────
    useEffect(() => {
        if (!user) return;

        const supabase = supabaseRef.current;

        const channel = supabase
            .channel(`notifications:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const newNotif = payload.new as Notification;

                    // Prepend to state
                    setNotifications((prev) => [newNotif, ...prev.slice(0, 49)]); // Keep max 50
                    setUnreadCount((prev) => prev + 1);

                    // Play sound
                    playNotificationSound();

                    // Show toast
                    const label = CATEGORY_LABELS[newNotif.category || 'system'] || '🔔';
                    toast(newNotif.message, {
                        icon: label,
                        duration: 5000,
                        style: {
                            borderRadius: '10px',
                            background: '#333',
                            color: '#fff',
                            fontSize: '13px',
                            maxWidth: '380px',
                        },
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const updated = payload.new as Notification;
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === updated.id ? updated : n))
                    );
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [user]);

    // ─── Actions ────────────────────────────────────────────
    const markAsRead = useCallback(
        async (id: string) => {
            // Optimistic update
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));

            const result = await markAsReadAction(id);
            if (result.error) {
                // Revert on failure
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
                );
                setUnreadCount((prev) => prev + 1);
            }
        },
        []
    );

    const markAllAsRead = useCallback(async () => {
        const previousNotifs = notifications;
        const previousCount = unreadCount;

        // Optimistic
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);

        const result = await markAllAsReadAction();
        if (result.error) {
            // Revert
            setNotifications(previousNotifs);
            setUnreadCount(previousCount);
        }
    }, [notifications, unreadCount]);

    const clearAll = useCallback(async () => {
        const previousNotifs = notifications;

        // Optimistic update
        setNotifications([]);
        setUnreadCount(0);

        const supabase = supabaseRef.current;
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user!.id);

        if (error) {
            // Revert on failure
            setNotifications(previousNotifs);
            setUnreadCount(previousNotifs.filter(n => !n.is_read).length);
        }
    }, [notifications, user]);

    const refresh = useCallback(() => {
        fetchInitial();
    }, [fetchInitial]);

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        clearAll,
        refresh,
    };
}
