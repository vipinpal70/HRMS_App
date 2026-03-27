import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const { data: currentUserProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = currentUserProfile?.role === 'admin';
    const isOwner = user.id === id;
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const fileExt = file.name.split('.').pop();
    const filePath = `${id}/${id}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage.from('avatars').upload(filePath, file, { upsert: true, cacheControl: '31536000' });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);
    await supabase.from('profiles').update({ avatar_url: publicUrlData.publicUrl }).eq('id', id);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
