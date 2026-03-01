import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    return NextResponse.json({
      status: 'ok',
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Defined' : 'Missing',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Defined' : 'Missing',
        ANON_KEY_START: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 5) || 'N/A',
      },
      db_check: error ? `Error: ${error.message}` : 'Connected',
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
