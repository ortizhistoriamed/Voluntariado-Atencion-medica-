'use client'
import { createClient } from '@supabase/supabase-js'

let supabaseInstance

export function getSupabase() {
  if (!supabaseInstance) {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
    const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

    if (!url || !url.startsWith('http')) {
      console.error('❌ Faltan o son inválidas N_P_SUPABASE_URL o N_P_SUPABASE_ANON_KEY')
    }
    
    supabaseInstance = createClient(
      (url && url.startsWith('http')) ? url : 'https://temp-build-only.supabase.co', 
      key || 'public-anon-key'
    )
  }
  return supabaseInstance
}

// Fallback para imports directos
export const supabase = typeof window !== 'undefined' ? getSupabase() : null
