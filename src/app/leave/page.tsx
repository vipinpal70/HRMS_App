import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import LeavePage from '../pages/LeavePage';

export default async function Leave() {
  const queryClient = getQueryClient();
  const now = new Date();

  // Default date range matches LeavePage's getMonthDates():
  // first day of previous month → last day of current month
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Prefetch for both admin (userId=all) and employee (userId=undefined) views.
  // The matching key will be used; the other is harmless overhead.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['leaveRequests', 'all', firstDay, lastDay],
      queryFn: () => serverFetch(`/api/leave?userId=all&startDate=${firstDay}&endDate=${lastDay}`),
    }),
    queryClient.prefetchQuery({
      queryKey: ['leaveRequests', undefined, firstDay, lastDay],
      queryFn: () => serverFetch(`/api/leave?startDate=${firstDay}&endDate=${lastDay}`),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeavePage />
    </HydrationBoundary>
  );
}
