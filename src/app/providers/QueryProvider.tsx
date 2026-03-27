'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactNode, useState, useEffect } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 60 * 24, // 24 hours
                gcTime: 1000 * 60 * 60 * 24,    // 24 hours
                refetchOnWindowFocus: false,
                refetchOnMount: false,
                refetchOnReconnect: false,
            },
        },
    }));

    const [persister, setPersister] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const syncStoragePersister = createSyncStoragePersister({
                storage: window.sessionStorage,
            });
            setPersister(syncStoragePersister);
        }
    }, []);

    if (!persister) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}