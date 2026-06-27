import { createClient } from '@supabase/supabase-js'

// Limpiamos los valores por si traen espacios invisibles del copy-paste
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

// Si no están configuradas, usamos placeholders para el build, pero lanzamos advertencia
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.warn("⚠️ Supabase URL no detectada o inválida. Revisa las variables de entorno en Vercel.")
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
)
