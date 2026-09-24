/* ارسال خودکار گزارش خطا به پشتیبانی — ساخت تیکت + اعلان تلگرام
   اگر کاربر لاگین نباشد، fallback: فقط کپی دستی (UI می‌داند) */

import { supabase } from '@/lib/supabase';

export interface SupportReportResult { ok: boolean; ticketId?: string; message: string }

export async function reportErrorToSupport(report: string, title: string): Promise<SupportReportResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) {
    return { ok: false, message: 'برای ارسال خودکار، اول وارد حساب کاربری شوید — یا گزارش را کپی کنید و در پشتیبانی بفرستید.' };
  }
  const subject = `گزارش خطا — ${title}`.slice(0, 120);
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({ user_id: uid, subject, priority: 'مهم', status: 'open' })
    .select('id')
    .single();
  if (error || !ticket) {
    return { ok: false, message: 'ثبت تیکت ناموفق بود — گزارش را کپی کنید و از بخش پشتیبانی بفرستید.' };
  }
  await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, sender: 'user', body: report });
  /* اعلان تلگرام ادمین — خطا مسیر اصلی را نبندد */
  try {
    const { notifyTelegram } = await import('@/lib/acc/telegram');
    void notifyTelegram(`🐞 گزارش خطا #${ticket.id}: ${title}`, 'ticket');
  } catch { /* اعلان اجباری نیست */ }
  return { ok: true, ticketId: ticket.id, message: `گزارش ثبت شد — تیکت #${ticket.id}` };
}
