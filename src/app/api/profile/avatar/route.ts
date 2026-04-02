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
    if (!file || !id) return NextResponse.json({ error: 'No file or id provided' }, { status: 400 });

    const { data: currentUserProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = currentUserProfile?.role === 'admin';
    const isOwner = user.id === id;
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete old avatars for this user to clean up storage
    const { data: existingFiles } = await supabaseAdmin.storage
      .from('avatars')
      .list(id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${id}/${f.name}`);
      await supabaseAdmin.storage.from('avatars').remove(filesToDelete);
    }

    // Unique filename per upload — CDN treats it as a brand new file
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${id}/${id}_${timestamp}.${fileExt}`;

    // cacheControl: '0' — don't cache at CDN level
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file, { upsert: false, cacheControl: '0' });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Store URL without cache buster in DB (URL is already unique via timestamp in path)
    await supabase.from('profiles')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', id);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}