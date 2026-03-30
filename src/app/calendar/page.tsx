import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import CalendarPage from '../pages/CalendarPage';

export default async function Calendar() {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarPage />
    </HydrationBoundary>
  );
}
