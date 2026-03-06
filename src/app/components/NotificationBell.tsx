'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, FileText, ListTodo, Clock, Megaphone, Info, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotificationContext } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

// ─── Category → Icon mapping ───────────────────────────────
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  leave_status: FileText,
  leave_request: FileText,
  task_assigned: ListTodo,
  task_updated: ListTodo,
  attendance: Clock,
  announcement: Megaphone,
  system: Info,
};

// ─── Notification type → color mapping ─────────────────────
const TYPE_STYLES: Record<string, string> = {
  success: 'bg-green-500/15 text-green-600',
  error: 'bg-red-500/15 text-red-600',
  warning: 'bg-amber-500/15 text-amber-600',
  info: 'bg-blue-500/15 text-blue-600',
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading,
  } = useNotificationContext();

  // ─── Click outside to close ─────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ─── Bell Button ──────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={`w-5 h-5 text-black transition-transform ${isOpen ? 'scale-110' : ''}`} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-sidebar animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ─── Dropdown Panel ───────────────────────────────── */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-[340px] bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await markAllAsRead();
                }}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1 opacity-60">You&apos;re all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const IconComp = CATEGORY_ICONS[n.category || 'system'] || Info;
                const typeStyle = TYPE_STYLES[n.type] || TYPE_STYLES.info;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-3 px-4 py-3 border-b border-border/40 last:border-0 cursor-pointer transition-all duration-150 hover:bg-muted/50 ${
                      !n.is_read ? 'bg-primary/[0.03]' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${typeStyle}`}>
                      <IconComp className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm leading-tight ${
                          !n.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                        }`}>
                          {n.title}
                        </h4>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-muted-foreground/50 mt-1.5 block">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/notifications');
                }}
                className="w-full text-center text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
