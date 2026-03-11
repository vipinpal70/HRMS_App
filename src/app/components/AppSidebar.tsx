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
  ChevronUp,
  User,
  Shield,
  Users,
  Sun,
  Moon,
  Menu,
  X,
  Bell
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { getCompanySettings } from '@/app/actions/settings';
import { useTheme } from 'next-themes';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['emp', 'admin', 'hr'] },
  { icon: Clock, label: 'Attendance', path: '/attendance', roles: ['emp', 'admin', 'hr'] },
  { icon: ListTodo, label: 'Tasks', path: '/tasks', roles: ['emp', 'admin', 'hr'] },
  { icon: FileText, label: 'Leave & WFH', path: '/leave', roles: ['emp', 'admin', 'hr'] },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar', roles: ['admin', 'hr'] },
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
        <div className={`px-4 py-5 border-b border-sidebar-border ${collapsed ? 'w-[68px]' : 'w-[250px]'}`}>
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
          <div className="flex flex-col items-center justify-start gap-2 px-2 py-2 border-sidebar-border relative">
            {/* User Menu Popup */}
            {userMenuOpen && (
              <div className={`absolute mb-2 bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-[60]
                ${collapsed ? 'left-[72px] bottom-0 w-64' : 'bottom-full left-3 right-3'}
              `}>
                <div className="py-2">
                  <button
                    onClick={() => {
                      if (user?.id) {
                        window.location.href = `/profile/${user.id}`;
                      }
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>My Profile</span>
                  </button>

                  <div className="px-4 py-2 hover:bg-muted transition-colors cursor-pointer">
                    <NotificationBell showFullList={false} />
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Sun className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Moon className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                  </div>

                  <div className="h-px bg-border/50 my-1" />

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}

            {/* User Profile Card */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 bg-sidebar-accent 
              ${userMenuOpen ? 'bg-black/20 shadow-sm' : 'hover:bg-black/20'}
              ${collapsed ? 'justify-center' : ''}
              group relative
            `}
            >
              <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-white text-sidebar-accent flex items-center justify-center text-sm font-extrabold shrink-0 shadow-sm">
                {user?.avatar ? (
                  <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  user?.name?.split(' ').map(n => n[0]).join('')
                )}
              </div>

              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[10px] text-white/60 truncate font-medium">
                      {user?.designation}
                    </p>
                    <p className="text-[10px] text-blue-500 truncate font-medium">
                      {user?.email}
                    </p>
                    <p className="text-[10px] text-amber-600 truncate font-medium">
                      {user?.role}
                    </p>
                  </div>
                  <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </>
              )}

              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {user?.name || user?.email?.split('@')[0]}
                </div>
              )}
            </button>
          </div>

          {/* Sidebar Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-sidebar-accent border border-sidebar-border rounded-full p-1 shadow-md hover:bg-sidebar-accent transition-all duration-200 z-[70] hover:scale-110 active:scale-95"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="w-5 h-5 text-amber-600" /> : <ChevronLeft className="w-5 h-5 text-amber-600" />}
          </button>
        </div>
      </aside >
    </>
  );
}
