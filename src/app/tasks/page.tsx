import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import TasksPage from '../pages/TasksPage';

export default async function Tasks() {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksPage />
    </HydrationBoundary>
  );
}
