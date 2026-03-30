import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import TasksPage from '../pages/TasksPage';

export default async function Tasks() {
  const queryClient = getQueryClient();
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Prefetch the default view: current user's tasks for this month
  // queryKey matches: ['tasks', userId=undefined, start, end, filteredEmployee=undefined]
  await queryClient.prefetchQuery({
    queryKey: ['tasks', undefined, firstDay, lastDay, undefined],
    queryFn: () => serverFetch(`/api/tasks?startDate=${firstDay}&endDate=${lastDay}`),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksPage />
    </HydrationBoundary>
  );
}
