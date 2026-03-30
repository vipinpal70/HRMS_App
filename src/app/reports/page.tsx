import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import ReportsPage from '../pages/ReportsPage';

export default async function Reports() {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportsPage />
    </HydrationBoundary>
  );
}
