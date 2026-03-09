'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Ensures all Saturdays and Sundays for the given month and year are present in company_calendar.
 */
export async function ensureMonthWeekends(month: number, year: number) {
    try {
        const supabase = await createClient();

        // Get all dates in the month
        const lastDay = new Date(year, month, 0).getDate();
        const weekends = [];

        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                weekends.push({
                    date: dateString,
                    type: 'weekend',
                    description: dayOfWeek === 0 ? 'Sunday' : 'Saturday'
                });
            }
        }

        // Bulk insert with ON CONFLICT DO NOTHING (date is unique)
        // We use ignoreDuplicates: true to prevent overwriting existing holidays
        const { error } = await supabase
            .from('company_calendar')
            .upsert(weekends, { onConflict: 'date', ignoreDuplicates: true });

        if (error) {
            console.error('Error auto-inserting weekends:', error);
            return { error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('ensureMonthWeekends error:', error);
        return { error: error.message };
    }
}

/**
 * Add a holiday to the company calendar.
 */
export async function addHoliday(date: string, description: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { error: 'Unauthorized' };

        // Check if admin or hr
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'hr') {
            return { error: 'Unauthorized' };
        }

        const { error } = await supabase
            .from('company_calendar')
            .upsert({
                date,
                type: 'holiday',
                description
            }, { onConflict: 'date' });

        if (error) throw error;

        revalidatePath('/calendar');
        return { success: true };
    } catch (error: any) {
        console.error('addHoliday error:', error);
        return { error: error.message };
    }
}

/**
 * Returns all holidays and weekends for a given month/year.
 */
export async function getCalendarEvents(month: number, year: number) {
    try {
        const supabase = await createClient();

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('company_calendar')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
}

/**
 * Returns all holidays for a given year.
 */
export async function getYearHolidays(year: number) {
    try {
        const supabase = await createClient();

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const { data, error } = await supabase
            .from('company_calendar')
            .select('*')
            .eq('type', 'holiday')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching year holidays:', error);
        return [];
    }
}

/**
 * Delete a holiday from the company calendar.
 */
export async function deleteHoliday(id: any) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { error: 'Unauthorized' };

        // Check if admin or hr
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'hr') {
            return { error: 'Unauthorized' };
        }

        const { error } = await supabase
            .from('company_calendar')
            .delete()
            .eq('id', id);

        if (error) throw error;

        revalidatePath('/calendar');
        return { success: true };
    } catch (error: any) {
        console.error('deleteHoliday error:', error);
        return { error: error.message };
    }
}

