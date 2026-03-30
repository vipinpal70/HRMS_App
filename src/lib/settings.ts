import { createClient } from '@/lib/supabase/server';

export interface CompanySettings {
  organization_name: string;
  office_lat: number;
  office_lng: number;
  allowed_radius_meters: number;
  allowed_ip_range: string;
  office_start_time?: string;
  office_end_time?: string;
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('company_settings').select('*').single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Return default values if no record exists
        return {
          organization_name: 'Dev Corp',
          office_lat: 28.41607,
          office_lng: 77.09253,
          allowed_radius_meters: 500,
          allowed_ip_range: '127.0.0.1,::1',
          office_start_time: '09:00',
          office_end_time: '19:00',
        };
      }
      console.error('Error fetching company settings:', error);
      return null;
    }

    return {
      ...data,
      allowed_ip_range: data.allowed_ip_range || '127.0.0.1,::1',
      office_lat: data.office_lat ?? 28.41607,
      office_lng: data.office_lng ?? 77.09253,
      allowed_radius_meters: data.allowed_radius_meters ?? 500,
      office_start_time: data.office_start_time ?? '09:00',
      office_end_time: data.office_end_time ?? '18:00',
    };
  } catch (err) {
    console.error('getCompanySettings exception:', err);
    return null;
  }
}
