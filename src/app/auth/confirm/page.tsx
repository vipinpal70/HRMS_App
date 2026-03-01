'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check for hash parameters (Implicit Flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          router.push('/'); // Success!
          return;
        } else {
          setError(error.message);
        }
      }

      // 2. Check for code parameter (PKCE Flow) - handled by middleware/callback usually, but safe to have
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
          // If code exists, we should have hit the server callback. 
          // If we are here, maybe we need to exchange it client side?
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
              router.push('/');
              return;
          }
      }
      
      // If we are here and no session, try getting user
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
          router.push('/');
      } else if (!accessToken && !code) {
          // No tokens found
          setError('No authentication token found.');
      }
    };

    handleAuth();
  }, [router, supabase]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-red-500 text-xl font-bold mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-600">Completing login...</p>
      </div>
    </div>
  );
}
