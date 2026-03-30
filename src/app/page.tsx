import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import Dashboard from './pages/Dashboard';

export default async function Home() {
  const queryClient = getQueryClient();
  const currentYear = new Date().getFullYear();

  // Prefetch all stable/cacheable dashboard queries in parallel.
  // todayStatus is NOT prefetched because it uses staleTime: 0 (always fresh).
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['companySettings'],
      queryFn: () => serverFetch('/api/settings'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['attendanceHistory'],
      queryFn: () => serverFetch('/api/attendance?type=history'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboardTasks'],
      queryFn: () => serverFetch('/api/tasks'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['effectiveWorkType'],
      queryFn: () => serverFetch('/api/attendance?type=effective-work-type'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['quoteOfDay'],
      queryFn: () => serverFetch('/api/quotes'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['yearHolidays', currentYear],
      queryFn: () => serverFetch(`/api/calendar?type=holidays&year=${currentYear}`),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard />
    </HydrationBoundary>
  );
}
