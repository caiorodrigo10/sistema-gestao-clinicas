import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lkwrevhxugaxfpwiktdy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrd3Jldmh4dWdheGZwd2lrdGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4Mjg0NjMsImV4cCI6MjA2NTQwNDQ2M30.sWOsGKa_PWfjth6iaXcTpyGa95xmGZO_vnBnrFnK-sc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types para TypeScript
export interface Profile {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthSession {
  user: SupabaseUser;
  session: any;
}