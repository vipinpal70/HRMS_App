import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import LeavePage from '../pages/LeavePage';

export default async function Leave() {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeavePage />
    </HydrationBoundary>
  );
}
