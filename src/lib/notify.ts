import { supabase } from '@/lib/supabase';

export const notifyAdmin = async (text: string) => {
  try {
    await supabase.functions.invoke('telegram-notify', {
      body: { text },
    });
  } catch (error) {
    console.error('Telegram notify error:', error);
  }
};
