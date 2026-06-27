import { createClient } from '@supabase/supabase-js'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validación estricta para evitar errores en el constructor de Supabase durante el build
if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.startsWith('http')) {
  supabaseUrl = 'https://placeholder.supabase.co'
  supabaseAnonKey = 'placeholder'
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
