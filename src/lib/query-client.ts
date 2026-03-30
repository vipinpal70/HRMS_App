import { QueryClient } from '@tanstack/react-query';
import { cache } from 'react';

/**
 * Creates a single QueryClient instance per server request using React.cache().
 * This prevents data leaking between different users' requests while allowing
 * multiple prefetchQuery calls within the same request to share one client.
 */
const getQueryClient = cache(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 2, // 2 hours — matches client QueryProvider config
    },
  },
}));

export default getQueryClient;
