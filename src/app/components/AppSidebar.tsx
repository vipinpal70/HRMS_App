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
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { getCompanySettings } from '@/app/actions/settings';
import { useTheme } from 'next-themes';

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

export default function AppSidebar({
  mobileMenuOpen,
  setMobileMenuOpen
}: {
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    <>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen?.(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 flex flex-col bg-sidebar-background border-r border-sidebar-border shadow-sm text-sidebar-foreground transition-all duration-300 h-screen
          ${collapsed ? 'w-[68px]' : 'w-[250px]'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${!mobileMenuOpen && 'md:flex hidden'}
        `}
      >
        {/* Logo & Mobile Close */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
              {settings?.organization_name?.charAt(0)}
            </div>
            {!collapsed && (
              <span className="font-bold text-base text-sidebar-foreground tracking-tight">
                {settings?.organization_name}
              </span>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen?.(false)}
            className="md:hidden p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = pathname === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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

          {/* User */}
          <div className="flex items-center gap-3 px-1 mb-2 relative">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-xs font-semibold">
              {user?.name?.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 text-amber-400">
                  <Shield className="w-3 h-3" />
                  {user?.role}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className={`flex items-center gap-2 ${collapsed ? 'flex-col items-center' : 'justify-evenly'}`}>
              {/* Collapse Button */}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="sidebar-item sidebar-item-inactive p-2"
                title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {collapsed ? <ChevronRight className="w-5 h-5 text-gray-200" /> : <ChevronLeft className="w-5 h-5 text-gray-200" />}
              </button>

              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="sidebar-item sidebar-item-inactive p-2"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5 text-gray-200" /> : <Moon className="w-5 h-5 text-gray-200" />}
                </button>
              )}

              {/* Notification Bell */}
              <div className="sidebar-item p-0 flex items-center justify-center">
                <NotificationBell />
              </div>
            </div>

            <button
              onClick={logout}
              className={`sidebar-item sidebar-item-inactive ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut className="w-5 h-5 text-red-500" />
              {!collapsed && <span className='text-red-500'>Logout</span>}
            </button>
          </div>
        </div>
      </aside >
    </>
  );
}
