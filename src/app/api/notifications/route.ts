import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'list') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (type === 'unread-count') {
      const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      return NextResponse.json(count || 0);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { title, message, type = 'info', category = 'system' } = body;
    const { error } = await supabase.from('notifications').insert({ user_id: user.id, title, message, type, category, is_read: false });
    if (error) throw error;
    return NextResponse.json({ success: true });
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
    if (body.action === 'markRead') {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', body.id).eq('user_id', user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (body.action === 'markAllRead') {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'single') {
      const id = searchParams.get('id');
      const { error } = await supabase.from('notifications').delete().eq('id', id!).eq('user_id', user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (type === 'all') {
      const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (type === 'old-read') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      const { error } = await supabase.from('notifications').delete().eq('user_id', user.id).eq('is_read', true).lt('created_at', d.toISOString());
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
