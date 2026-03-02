'use client';

import { useState, useEffect, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Clock,
  ListTodo,
  CalendarDays,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { getCompanySettings } from '@/app/actions/settings';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['emp', 'admin', 'hr'] },
  { icon: Clock, label: 'Attendance', path: '/attendance', roles: ['emp', 'admin', 'hr'] },
  { icon: ListTodo, label: 'Tasks', path: '/tasks', roles: ['emp', 'admin', 'hr'] },
  { icon: FileText, label: 'Leave & WFH', path: '/leave', roles: ['emp', 'admin', 'hr'] },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar', roles: ['emp', 'admin', 'hr'] },
  { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin', 'hr'] },
  { icon: Users, label: 'Employees', path: '/employees', roles: ['admin', 'hr'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin'] },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  useEffect(() => {
    startTransition(async () => {
      const data = await getCompanySettings();
      setSettings(data);
    });
  }, []);

  // Debug: Log user role to console
  if (typeof window !== 'undefined') {
    console.log('Current User Role:', user?.role);
  }

  const filteredNav = navItems.filter((item) =>
    item.roles.includes(user?.role || 'emp')
  );

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[250px]'
        } h-screen sticky top-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
          {settings?.organization_name?.charAt(0)}
        </div>
        {!collapsed && (
          <span className="font-bold text-base text-foreground tracking-tight">
            {settings?.organization_name}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = pathname === item.path;
          return (
            <a
              key={item.path}
              href={item.path}
              className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </a>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        {/* Notifications (Mobile/Collapsed view integration or just separate) */}
        {/* We place it near user profile for now */}

        {/* User */}
        <div className="flex items-center gap-3 px-1 mb-2 relative">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-xs font-semibold">
            {user?.name?.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[11px] text-muted-foreground text-amber-700 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {user?.role}
              </p>
            </div>
          )}
          {/* Notification Bell in Sidebar */}
          <div className={`${collapsed ? 'absolute -top-12 left-1 text-black' : ''}`}>
            <NotificationBell />
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 sidebar-item sidebar-item-inactive justify-center"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 text-black" /> : <ChevronLeft className="w-4 h-4 text-black" />}
          </button>
          {!collapsed && (
            <button onClick={logout} className="sidebar-item sidebar-item-inactive">
              <LogOut className="w-4 h-4 text-red-500" />
              <span className='text-red-500'>Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
