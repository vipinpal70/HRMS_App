import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import CalendarPage from '../pages/CalendarPage';

export default async function Calendar() {
  const queryClient = getQueryClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();

  // Prefetch current month events and year holidays
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['calendarEvents', currentMonth, currentYear],
      queryFn: () => serverFetch(`/api/calendar?type=events&month=${currentMonth}&year=${currentYear}`),
    }),
    queryClient.prefetchQuery({
      queryKey: ['yearHolidays', currentYear],
      queryFn: () => serverFetch(`/api/calendar?type=holidays&year=${currentYear}`),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarPage />
    </HydrationBoundary>
  );
}
