'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import AppSidebar from './AppSidebar';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
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
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
