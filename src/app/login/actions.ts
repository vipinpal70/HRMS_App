'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Login a user
export async function login(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log('Attempting login for:', email);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error);
      return { error: error.message }
    }

    console.log('Login successful, redirecting...');
    revalidatePath('/', 'layout')
    redirect('/')
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('Unexpected error in login action:', err);
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// create a new user
export async function signup(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const dob = formData.get('dob') as string

    console.log('Attempting signup for:', email);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          dob: dob,
        },
      },
    })

    if (error) {
      console.error('Signup error:', error);
      return { error: error.message }
    }

    console.log('Signup successful, redirecting...');
    revalidatePath('/', 'layout')
    redirect('/')
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('Unexpected error in signup action:', err);
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
