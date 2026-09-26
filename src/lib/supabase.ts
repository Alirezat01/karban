import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rocjeanizzhfvhnuhnms.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    /* خواندن ?code= (PKCE) یا #access_token (legacy) پس از برگشت OAuth گوگل */
    detectSessionInUrl: true,
    /* فلوی PKCE (توصیهٔ supabase-js v2): کد یک‌بارمصرف به‌جای توکن در fragment —
       نشست با exchangeCodeForSession در سرور ساپابیس مبادله می‌شود و توکن
       دیگر در تاریخچهٔ مرورگر/ریفرر دیده نمی‌شود */
    flowType: 'pkce',
  },
});
