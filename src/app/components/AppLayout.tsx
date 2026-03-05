'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import AppSidebar from './AppSidebar';
import { Loader2, Menu } from 'lucide-react';
import { useState } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/auth');

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      // Use window.location.href for reliable redirect if router.push fails
      window.location.href = '/login';
    }
  }, [user, loading, isAuthPage]);

  console.log('AppLayout Render:', { pathname, isAuthPage, loading, user: !!user });

  // If on auth page, render immediately to avoid spinner "swaying"
  // The AuthContext will handle redirect if user is actually logged in
  if (isAuthPage) {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Redirecting to Login...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="flex-1 min-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-sidebar-background sticky top-0 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className='flex gap-2 items-center'>
            <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-xs">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <p className='text-sm font-medium text-sidebar-foreground truncate'>{user?.name}</p>
          </div>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
