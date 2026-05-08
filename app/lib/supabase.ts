import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vatrydgznqomxhahqtge.supabase.co'
const supabaseKey = 'sb_publishable_O2mmB_wcLWQ0S5z3Lz15wA_X0Y-EQgM'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)