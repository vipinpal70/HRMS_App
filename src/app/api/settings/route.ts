import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'total-leaves') {
      const { data } = await supabase.from('profiles').select('total_leaves').in('role', ['emp', 'hr']).limit(1).single();
      return NextResponse.json(data?.total_leaves ?? 20);
    }

    // Default: get company settings
    const { data, error } = await supabase.from('company_settings').select('*').single();
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ organization_name: 'AttendX Corp', office_lat: 28.41607, office_lng: 77.09253, allowed_radius_meters: 500, allowed_ip_range: '127.0.0.1', office_start_time: '09:00', office_end_time: '19:00' });
      }
      throw error;
    }
    return NextResponse.json({
      ...data,
      allowed_ip_range: data.allowed_ip_range || '127.0.0.1',
      office_lat: data.office_lat ?? 28.41607,
      office_lng: data.office_lng ?? 77.09253,
      allowed_radius_meters: data.allowed_radius_meters ?? 500,
      office_start_time: data.office_start_time ?? '09:00',
      office_end_time: data.office_end_time ?? '18:00'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only admins can update settings.' }, { status: 403 });

    const body = await request.json();
    const { organization_name, allowed_ip_range, office_lat, office_lng, allowed_radius_meters, office_start_time, office_end_time } = body;

    const { data: existing } = await supabase.from('company_settings').select('id').single();
    let error;
    if (existing) {
      const { error: e } = await supabase.from('company_settings').update({ organization_name, allowed_ip_range, office_lat: parseFloat(office_lat), office_lng: parseFloat(office_lng), allowed_radius_meters: parseInt(allowed_radius_meters), office_start_time: office_start_time || '09:00', office_end_time: office_end_time || '19:00', updated_at: new Date().toISOString() }).eq('id', existing.id);
      error = e;
    } else {
      const { error: e } = await supabase.from('company_settings').insert({ organization_name, allowed_ip_range, office_lat: parseFloat(office_lat), office_lng: parseFloat(office_lng), allowed_radius_meters: parseInt(allowed_radius_meters), office_start_time: office_start_time || '09:00', office_end_time: office_end_time || '19:00' });
      error = e;
    }
    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Settings updated successfully.' });
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
    if (body.action === 'updateTotalLeaves') {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') return NextResponse.json({ error: 'Only admins can update leave quotas.' }, { status: 403 });

      const newTotal = body.newTotal;
      if (newTotal < 0 || newTotal > 365) return NextResponse.json({ error: 'Total leaves must be between 0 and 365.' }, { status: 400 });

      const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: employees, error: fetchError } = await supabaseAdmin.from('profiles').select('id, total_leaves, remaining_leaves').in('role', ['emp', 'hr']);
      if (fetchError) throw fetchError;
      if (!employees || employees.length === 0) return NextResponse.json({ error: 'No employee profiles found.' }, { status: 404 });

      await Promise.all(employees.map(emp => {
        const oldTotal = emp.total_leaves ?? newTotal;
        const delta = newTotal - oldTotal;
        const newRemaining = Math.max(0, (emp.remaining_leaves ?? 0) + delta);
        return supabaseAdmin.from('profiles').update({ total_leaves: newTotal, remaining_leaves: newRemaining }).eq('id', emp.id);
      }));

      return NextResponse.json({ success: true, message: `Leave quota updated to ${newTotal} days for all employees.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
