'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell({ showFullList = true }: { showFullList?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }

      // Realtime subscription
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            // Play sound or show toast here if needed
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  if (!showFullList) {
    return (
      <div className="flex items-center justify-between w-full cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>
          <span>Notifications</span>
        </div>
        {unreadCount > 0 && (
          <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}

        {isOpen && (
          <div className="fixed bottom-20 left-4 right-4 md:left-[260px] md:right-auto md:w-80 bg-background border border-border rounded-xl shadow-2xl z-[70] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-border font-semibold text-sm flex justify-between items-center bg-muted/30">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
                      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                      setUnreadCount(0);
                    }
                  }}
                  className="text-[10px] uppercase tracking-wider font-bold text-primary hover:text-primary/80"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs italic">
                  No new notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={(e) => { e.stopPropagation(); handleNotificationClick(n) }}
                    className={`p-4 border-b border-border/40 last:border-0 hover:bg-accent/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-primary/5' : ''
                      }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-xs font-semibold ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {n.title}
                      </h4>
                      {!n.is_read && <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                    <span className="text-[9px] text-muted-foreground/50 mt-2 block font-medium">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-200" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-sidebar" />
        )}
      </button>

      {isOpen && (
        <div className="absolute -right-10 md:right-auto md:left-0 bottom-12 mb-2 w-[250px] sm:w-80 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-border font-semibold text-xs md:text-sm flex justify-between items-center">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                    setUnreadCount(0);
                  }
                }}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs md:text-sm">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${!n.is_read ? 'bg-muted/20' : ''
                    }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className={`text-xs md:text-sm font-medium ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {n.title}
                    </h4>
                    {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                  <span className="text-[10px] text-muted-foreground/60 mt-2 block">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
