'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getCompanySettings() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    if (error) {
      console.error('getCompanySettings DB Error:', error);
      if (error.code === 'PGRST116') {
        return {
          organization_name: 'AttendX Corp',
          office_lat: 28.41607,
          office_lng: 77.09253,
          allowed_radius_meters: 500,
          allowed_ip_range: '127.0.0.1', // Default for dev
          office_start_time: '09:00',
          office_end_time: '19:00'
        };
      }
      throw error;
    }

    console.log('getCompanySettings Data:', data);

    // Ensure critical fields have defaults if DB has nulls
    return {
      ...data,
      allowed_ip_range: data.allowed_ip_range || '127.0.0.1',
      office_lat: data.office_lat ?? 28.41607,
      office_lng: data.office_lng ?? 77.09253,
      allowed_radius_meters: data.allowed_radius_meters ?? 500,
      office_start_time: data.office_start_time ?? '09:00',
      office_end_time: data.office_end_time ?? '18:00'
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
}

export async function updateCompanySettings(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { error: 'Only admins can update settings.' };
    }

    const organization_name = formData.get('organization_name') as string;
    const allowed_ip_range = formData.get('allowed_ip_range') as string;
    const office_lat = parseFloat(formData.get('office_lat') as string);
    const office_lng = parseFloat(formData.get('office_lng') as string);
    const allowed_radius_meters = parseInt(formData.get('allowed_radius_meters') as string);
    const office_start_time = (formData.get('office_start_time') as string) || '09:00';
    const office_end_time = (formData.get('office_end_time') as string) || '19:00';

    const { data: existing } = await supabase.from('company_settings').select('id').single();

    let error;
    if (existing) {
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({
          organization_name,
          allowed_ip_range,
          office_lat,
          office_lng,
          allowed_radius_meters,
          office_start_time,
          office_end_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('company_settings')
        .insert({
          organization_name,
          allowed_ip_range,
          office_lat,
          office_lng,
          allowed_radius_meters,
          office_start_time,
          office_end_time
        });
      error = insertError;
    }

    if (error) throw error;

    revalidatePath('/settings');
    return { success: true, message: 'Settings updated successfully.' };
  } catch (error: any) {
    console.error('Update settings error:', error);
    return { error: error.message };
  }
}
