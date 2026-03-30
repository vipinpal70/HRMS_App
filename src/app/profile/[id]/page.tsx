import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/query-client';
import ProfilePage from '@/app/pages/ProfilePage';

interface ProfilePageProps {
    params: Promise<{ id: string }>;
}

export default async function Profile({ params }: ProfilePageProps) {
    const { id } = await params;
    const queryClient = getQueryClient();

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProfilePage />
        </HydrationBoundary>
    );
}
