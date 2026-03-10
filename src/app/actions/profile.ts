'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export type UserRole = 'emp' | 'admin' | 'hr';

export interface Profile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    emp_id?: string;
    designation?: string;
    document_submit?: boolean;
    document_received?: boolean;
    total_leaves?: number;
    remaining_leaves?: number;
    add_on_leaves?: number;
    created_at?: string;
    updated_at?: string;
    avatar?: string; // Kept for UI
}

export async function getProfile(id: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('getProfile Error:', error);
            return null;
        }

        return data as Profile;
    } catch (error) {
        console.error('getProfile Unexpected Error:', error);
        return null;
    }
}

export async function getEmployees() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('getEmployees Error:', error);
            return [];
        }

        return data as Profile[];
    } catch (error) {
        console.error('getEmployees Unexpected Error:', error);
        return [];
    }
}

export async function updateProfile(id: string, updates: Partial<Profile>) {
    try {
        const supabase = await createClient();

        // Check permissions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = currentUserProfile?.role === 'admin';
        const isOwner = user.id === id;

        if (!isAdmin && !isOwner) {
            return { error: 'You do not have permission to update this profile.' };
        }

        // Filter updates to allow only specific fields
        const adminOnlyFields: (keyof Profile)[] = ['total_leaves', 'add_on_leaves'];
        const allowedFields: (keyof Profile)[] = ['name', 'designation', 'phone'];

        const safeUpdates: any = {};

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                safeUpdates[field] = updates[field];
            }
        });

        if (isAdmin) {
            adminOnlyFields.forEach(field => {
                if (updates[field] !== undefined) {
                    safeUpdates[field] = updates[field];
                }
            });
        }

        const { error } = await supabase
            .from('profiles')
            .update(safeUpdates)
            .eq('id', id);

        if (error) throw error;

        revalidatePath(`/profile/${id}`);
        revalidatePath('/employees');

        return { success: true, message: 'Profile updated successfully.' };
    } catch (error: any) {
        console.error('updateProfile Error:', error);
        return { error: error.message };
    }
}

export async function deleteProfile(id: string) {
    try {
        const supabase = await createClient();

        // Check permissions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const isAdmin = currentUserProfile?.role === 'admin';

        if (!isAdmin) {
            return { error: 'Only administrators can delete profiles.' };
        }

        // We can't delete ourselves
        if (user.id === id) {
            return { error: 'You cannot delete your own profile.' };
        }

        // Use Supabase Admin client to bypass RLS and avoid recursive policy checks
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        revalidatePath('/employees');

        return { success: true };
    } catch (error: any) {
        console.error('deleteProfile Error:', error);
        return { error: error.message || 'Failed to delete profile' };
    }
}
