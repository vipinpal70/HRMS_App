import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export type UserRole = 'emp' | 'admin' | 'hr';
export interface Profile {
  id: string; name: string; email: string; phone?: string; role: UserRole;
  emp_id?: string; designation?: string; document_submit?: boolean; document_received?: boolean;
  total_leaves?: number; remaining_leaves?: number; add_on_leaves?: number;
  created_at?: string; updated_at?: string; avatar_url?: string; dob?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (type === 'employees') {
      const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
      if (error) return NextResponse.json([]);
      return NextResponse.json(data || []);
    }

    if (id) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (error) return NextResponse.json(null);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Missing id or type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, updates } = body;

    const { data: currentUserProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isAdmin = currentUserProfile?.role === 'admin';
    const isOwner = user.id === id;
    if (!isAdmin && !isOwner) return NextResponse.json({ error: 'You do not have permission to update this profile.' }, { status: 403 });

    const adminOnlyFields = ['total_leaves', 'add_on_leaves'];
    const allowedFields = ['name', 'designation', 'phone', 'dob', 'avatar_url'];
    const safeUpdates: any = {};

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        const isDobEmpty = field === 'dob' && (!updates[field] || String(updates[field]).trim() === '');
        safeUpdates[field] = isDobEmpty ? null : updates[field];
      }
    });

    if (isAdmin) {
      adminOnlyFields.forEach(field => {
        if (updates[field] !== undefined) safeUpdates[field] = updates[field];
      });
    }

    const { error } = await supabase.from('profiles').update(safeUpdates).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: currentUserProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (currentUserProfile?.role !== 'admin') return NextResponse.json({ error: 'Only administrators can delete profiles.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (user.id === id) return NextResponse.json({ error: 'You cannot delete your own profile.' }, { status: 400 });

    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete profile' }, { status: 500 });
  }
}
