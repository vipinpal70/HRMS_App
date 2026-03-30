import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import { serverFetch } from '@/lib/serverFetch';
import ProfilePage from '@/app/pages/ProfilePage';

interface ProfilePageProps {
    params: Promise<{ id: string }>;
}

export default async function Profile({ params }: ProfilePageProps) {
    const { id } = await params;
    const queryClient = getQueryClient();

    // Prefetch the profile data for this user
    await queryClient.prefetchQuery({
        queryKey: ['profile', id],
        queryFn: () => serverFetch(`/api/profile?id=${id}`),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProfilePage />
        </HydrationBoundary>
    );
}
