import { createClient } from '@supabase/supabase-js';

// Set these in your .env file or replace with your Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://affdbcmavqvtyhzusytr.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZmRiY21hdnF2dHloenVzeXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ2NjUsImV4cCI6MjA4ODQ3MDY2NX0.ZBwRXQIE-BfDcvRwGj1epsNp-tAuYVFC8EhnIVlmHHM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
