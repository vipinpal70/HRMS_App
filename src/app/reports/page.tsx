import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import ReportsPage from '../pages/ReportsPage';

export default async function Reports() {
  const queryClient = getQueryClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Prefetch all "All Employees" report queries in parallel
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['report-data'],
      queryFn: () => serverFetch('/api/report?type=report-data'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['monthly-aggregate'],
      queryFn: () => serverFetch('/api/report?type=monthly-aggregate'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['monthly-tasks', 'all'],
      queryFn: () => serverFetch('/api/report?type=monthly-tasks'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['quarterly-tasks', 'all'],
      queryFn: () => serverFetch('/api/report?type=quarterly-tasks'),
    }),
    queryClient.prefetchQuery({
      queryKey: ['attendance-aggregate', currentMonth, currentYear, 'all'],
      queryFn: () => serverFetch(`/api/report?type=attendance-aggregate&month=${currentMonth}&year=${currentYear}`),
    }),
    queryClient.prefetchQuery({
      queryKey: ['employees'],
      queryFn: () => serverFetch('/api/profile?type=employees'),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportsPage />
    </HydrationBoundary>
  );
}
