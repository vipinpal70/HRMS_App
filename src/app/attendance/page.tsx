import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import AttendancePage from '../pages/AttendancePage';

export default async function Attendance() {
  const queryClient = getQueryClient();
  const now = new Date();

  // Prefetch the default view: current month attendance
  await queryClient.prefetchQuery({
    queryKey: ['myAttendance', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => serverFetch(`/api/attendance?type=my&month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AttendancePage />
    </HydrationBoundary>
  );
}
