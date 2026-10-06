/* ────────────────────────────────────────────────────────────
   AI Limits — daily quota tracking for AI features.
   Free users: 5 questions/day (chat) + 3 analyses/day
   Pro users (accounting plan): 20 questions/day + 10 analyses/day
   Founder: unlimited
   ──────────────────────────────────────────────────────────── */
import { supabase } from '@/lib/supabase';
import { isProPlan } from '@/lib/acc/plan';

export type PlanType = 'free' | 'pro' | 'founder';

export type AiUsage = {
  chat_count: number;
  analyze_count: number;
};

export type AiLimits = {
  chatLimit: number;       // -1 = unlimited
  analyzeLimit: number;    // -1 = unlimited
  chatUsed: number;
  analyzeUsed: number;
  chatRemaining: number;   // -1 = unlimited
  analyzeRemaining: number;
  plan: PlanType;
};

/* تعیین پلن کاربر از روی اشتراک حسابداری */
export async function getUserPlan(userId: string): Promise<PlanType> {
  try {
    /* اگر اشتراک حسابداری فعال داشته باشد → pro یا founder */
    const { data } = await supabase
      .from('acc_access')
      .select('plan, expires_at')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (data && data.length > 0) {
      /* founder بالاترین پلن است */
      const plans = data.map((r: { plan: string; expires_at: string | null }) => r.plan);
      if (plans.includes('founder')) return 'founder';
      /* اگه اشتراک پولی فعال داره و منقضی نشده */
      const activePaid = data.find((r: { plan: string; expires_at: string | null }) => {
        if (!['monthly', 'yearly', 'founder'].includes(r.plan)) return false;
        if (!r.expires_at) return true;
        return new Date(r.expires_at).getTime() > Date.now();
      });
      if (activePaid) {
        return activePaid.plan === 'founder' ? 'founder' : 'pro';
      }
    }
    return 'free';
  } catch {
    return 'free';
  }
}

/* محدودیت‌های هر پلن */
export function getPlanLimits(plan: PlanType): { chat: number; analyze: number } {
  switch (plan) {
    case 'founder':
      return { chat: -1, analyze: -1 };  // نامحدود
    case 'pro':
      return { chat: 20, analyze: 10 };   // روزانه ۲۰ سوال، ۱۰ تحلیل
    case 'free':
    default:
      return { chat: 5, analyze: 3 };      // روزانه ۵ سوال، ۳ تحلیل
  }
}

/* دریافت مصرف امروز کاربر */
export async function getTodayUsage(userId: string): Promise<AiUsage> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('ai_usage')
    .select('chat_count, analyze_count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle();
  return {
    chat_count: data?.chat_count || 0,
    analyze_count: data?.analyze_count || 0,
  };
}

/* افزایش شمارنده (با upsert) */
export async function incrementUsage(userId: string, type: 'chat' | 'analyze'): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const field = type === 'chat' ? 'chat_count' : 'analyze_count';

  /* ابتدا ردیف امروز رو پیدا کن */
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('id, chat_count, analyze_count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle();

  if (existing) {
    /* update */
    const newValue = (existing as { chat_count: number; analyze_count: number })[field] + 1;
    const { error } = await supabase
      .from('ai_usage')
      .update({ [field]: newValue })
      .eq('id', (existing as { id: string }).id);
    return !error;
  } else {
    /* insert */
    const { error } = await supabase
      .from('ai_usage')
      .insert({
        user_id: userId,
        day: today,
        chat_count: type === 'chat' ? 1 : 0,
        analyze_count: type === 'analyze' ? 1 : 0,
      });
    return !error;
  }
}

/* دریافت وضعیت کامل محدودیت‌ها برای نمایش در UI */
export async function getAiLimits(userId: string): Promise<AiLimits> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const usage = await getTodayUsage(userId);

  return {
    chatLimit: limits.chat,
    analyzeLimit: limits.analyze,
    chatUsed: usage.chat_count,
    analyzeUsed: usage.analyze_count,
    chatRemaining: limits.chat === -1 ? -1 : Math.max(0, limits.chat - usage.chat_count),
    analyzeRemaining: limits.analyze === -1 ? -1 : Math.max(0, limits.analyze - usage.analyze_count),
    plan,
  };
}

/* بررسی اینکه آیا کاربر می‌تواند درخواست بدهد (برای استفاده در API) */
export async function checkAiLimit(userId: string, type: 'chat' | 'analyze'): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const usage = await getTodayUsage(userId);

  if (limits.chat === -1 || limits.analyze === -1) {
    /* نامحدود */
    return { allowed: true, remaining: -1 };
  }

  const limit = type === 'chat' ? limits.chat : limits.analyze;
  const used = type === 'chat' ? usage.chat_count : usage.analyze_count;
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      reason: `سقف روزانه شما (${limit.toLocaleString('fa-IR')} درخواست) تکمیل شده است. فردا دوباره تلاش کنید یا به پلن پیشرفته ارتقا دهید.`,
      remaining: 0,
    };
  }
  return { allowed: true, remaining };
}
