import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Bell, FileText, Headphones, LayoutDashboard, LifeBuoy,
  MessageSquare, Paperclip, Plus, Send, Trash2, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFaDate } from '@/lib/format';
import { useCountUp } from '@/lib/reveal';
import KarbanLoader from '@/components/KarbanLoader';

type SavedContract = {
  id: string; root_id: string; title: string; type: string; industry: string;
  version: number; content: Record<string, string>; created_at: string;
};
type ConsultRow = { id: string; topic: string | null; service: string | null; status: string | null; admin_note: string | null; created_at: string };
type Ticket = { id: string; subject: string; status: string; priority: string; created_at: string };
type TicketMsg = { id: string; ticket_id: string; sender: 'user' | 'admin'; body: string; attachment_path: string | null; created_at: string };
type Notif = { id: string; title: string; body: string | null; href: string | null; is_read: boolean; created_at: string };

type Tab = 'contracts' | 'consults' | 'tickets' | 'notifs';

const STATUS_FA: Record<string, string> = {
  new: 'جدید', in_progress: 'در حال انجام', done: 'انجام شد', rejected: 'رد شد',
  open: 'باز', answered: 'پاسخ داده شد', closed: 'بسته شد',
};

export default function DashboardPage() {
  const { loading, userId, displayName } = useAuth();
  const [tab, setTab] = useState<Tab>('contracts');

  if (!loading && !userId) {
    return (
      <section className="inner-page">
        <div className="container narrow-content">
          <span className="eyebrow"><LayoutDashboard size={14} /> داشبورد کاربان</span>
          <h1>اول وارد شو</h1>
          <p className="lead">داشبورد، قراردادها و درخواست‌های تو را بعد از ورود نشان می‌دهد.</p>
          <a className="button" href="/ورود">ورود با گوگل <ArrowLeft size={15} /></a>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="inner-page">
        <div className="container narrow-content"><KarbanLoader label="در حال آماده‌سازی داشبورد…" /></div>
      </section>
    );
  }

  return (
    <section className="inner-page">
      <div className="container">
        <DashHero name={displayName} />

        <nav className="dash-tabs" aria-label="بخش‌های داشبورد">
          <button className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}><FileText size={16} /> قراردادهای من</button>
          <button className={tab === 'consults' ? 'active' : ''} onClick={() => setTab('consults')}><MessageSquare size={16} /> مشاوره‌های من</button>
          <button className={tab === 'tickets' ? 'active' : ''} onClick={() => setTab('tickets')}><LifeBuoy size={16} /> پشتیبانی و تیکت</button>
          <button className={tab === 'notifs' ? 'active' : ''} onClick={() => setTab('notifs')}><Bell size={16} /> اعلان‌ها</button>
        </nav>

        <div className="dash-content">
          {tab === 'contracts' && <MyContracts />}
          {tab === 'consults' && <MyConsults />}
          {tab === 'tickets' && <MyTickets />}
          {tab === 'notifs' && <MyNotifs />}
        </div>
      </div>
    </section>
  );
}

/* ── هیرو داشبورد: خوش‌آمد پریمیوم + آمار زنده با count-up ── */
function DashHero({ name }: { name: string }) {
  const { userId } = useAuth();
  const [stats, setStats] = useState<{ contracts: number; consults: number; tickets: number; notifs: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const cnt = async (p: PromiseLike<{ count: number | null }>) => {
      try { return (await p).count || 0; } catch { return 0; }
    };
    (async () => {
      const [contracts, consults, tickets, notifs] = await Promise.all([
        cnt(supabase.from('saved_contracts').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        cnt(supabase.from('consultation_requests').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
        cnt(supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['open', 'answered'])),
        cnt(supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)),
      ]);
      if (alive) setStats({ contracts, consults, tickets, notifs });
    })();
    return () => { alive = false; };
  }, [userId]);

  return (
    <div className="dash-hero">
      <div className="dash-hero-top">
        <span className="eyebrow"><LayoutDashboard size={14} /> داشبورد کاربان</span>
        <a className="button button-small button-outline" href="/پروفایل"><User size={14} /> ویرایش پروفایل</a>
      </div>
      <h1>سلام {name}</h1>
      <p className="lead">قراردادها، درخواست‌ها، تیکت‌ها و اعلان‌هایت همگی این‌جاست.</p>
      <div className="dash-stats">
        <StatCard icon={FileText} label="قرارداد ذخیره‌شده" value={stats?.contracts ?? 0} ready={!!stats} />
        <StatCard icon={MessageSquare} label="درخواست مشاوره" value={stats?.consults ?? 0} ready={!!stats} />
        <StatCard icon={LifeBuoy} label="تیکت در جریان" value={stats?.tickets ?? 0} ready={!!stats} />
        <StatCard icon={Bell} label="اعلان خوانده‌نشده" value={stats?.notifs ?? 0} ready={!!stats} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, ready }: { icon: typeof FileText; label: string; value: number; ready: boolean }) {
  const { ref, value: shown } = useCountUp(ready ? value : 0);
  return (
    <div className="dash-stat">
      <Icon size={20} aria-hidden />
      <div>
        <b ref={ref}>{shown.toLocaleString('fa-IR')}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

/* ── قراردادهای من ─────────────────────────────────────────── */
function MyContracts() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<SavedContract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('saved_contracts')
      .select('id,root_id,title,type,industry,version,content,created_at')
      .eq('user_id', userId)
      .order('version', { ascending: false });
    setRows((data || []) as SavedContract[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const groups = new Map<string, SavedContract[]>();
  for (const r of rows) {
    const list = groups.get(r.root_id) || [];
    list.push(r);
    groups.set(r.root_id, list);
  }

  const remove = async (rootId: string) => {
    await supabase.from('saved_contracts').delete().eq('root_id', rootId).eq('user_id', userId!);
    load();
  };

  const openVersion = (r: SavedContract) => {
    try {
      localStorage.setItem('karban-builder-restore', JSON.stringify(r.content));
      window.location.href = `/ابزارهای-هوش-مصنوعی/ساخت-قرارداد?restore=${r.root_id}`;
    } catch { /* noop */ }
  };

  if (loading) return <KarbanLoader label="در حال دریافت قراردادها…" />;

  return (
    <div className="contact-card calc-card dash-card">
      <h2><FileText size={17} /> قراردادهای ذخیره‌شده</h2>
      {rows.length === 0 ? (
        <p className="muted-note">
          هنوز قراردادی ذخیره نکردی. از «ساخت قرارداد هوشمند» شروع کن و دکمه «ذخیره در حساب من» را بزن.
        </p>
      ) : (
        Array.from(groups.entries()).map(([rootId, versions]) => {
          const latest = versions[0];
          return (
            <div className="dash-item" key={rootId}>
              <div className="dash-item-head">
                <div>
                  <strong>{latest.title}</strong>
                  <small>{latest.type} · {latest.industry} · نسخه {latest.version.toLocaleString('fa-IR')} · {formatFaDate(latest.created_at)}</small>
                </div>
                <div className="dash-item-actions">
                  <button className="button button-small" onClick={() => openVersion(latest)}>ویرایش مجدد</button>
                  <button className="button button-small button-outline" onClick={() => remove(rootId)} aria-label="حذف">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {versions.length > 1 && (
                <details>
                  <summary>نسخه‌های قبلی ({(versions.length - 1).toLocaleString('fa-IR')})</summary>
                  <ul className="dash-versions">
                    {versions.slice(1).map((v) => (
                      <li key={v.id}>
                        نسخه {v.version.toLocaleString('fa-IR')} — {formatFaDate(v.created_at)}
                        <button className="button button-small" onClick={() => openVersion(v)}>بازکردن</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })
      )}
      <a className="button" href="/ابزارهای-هوش-مصنوعی/ساخت-قرارداد">ساخت قرارداد جدید <ArrowLeft size={15} /></a>
    </div>
  );
}

/* ── مشاوره‌های من ─────────────────────────────────────────── */
function MyConsults() {
  const { userId, profile } = useAuth();
  const [rows, setRows] = useState<ConsultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ topic: 'روابط کار', description: '', priority: 'معمولی' });
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let q = supabase.from('consultation_requests').select('id,topic,service,status,admin_note,created_at');
    if (profile?.phone) q = q.or(`user_id.eq.${userId},mobile.eq.${profile.phone}`);
    else q = q.eq('user_id', userId);
    const { data } = await q.order('created_at', { ascending: false }).limit(30);
    setRows((data || []) as ConsultRow[]);
    setLoading(false);
  }, [userId, profile?.phone]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!userId || form.description.trim().length < 10) {
      setState('error');
      return;
    }
    setState('loading');
    const { error } = await supabase.from('consultation_requests').insert({
      user_id: userId,
      mobile: profile?.phone || null,
      service: form.topic,
      topic: form.topic,
      description: form.description.trim(),
      priority: form.priority,
      status: 'new',
    });
    if (error) { setState('error'); return; }
    setState('done');
    setForm({ ...form, description: '' });
    load();
  };

  return (
    <div className="contact-card calc-card dash-card">
      <h2><MessageSquare size={17} /> درخواست مشاوره جدید</h2>
      <label>موضوع
        <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
          <option value="روابط کار">روابط کار</option>
          <option value="قرارداد">قرارداد</option>
          <option value="مالی و مالیات">مالی و مالیات</option>
          <option value="بیمه و بازنشستگی">بیمه و بازنشستگی</option>
        </select>
      </label>
      <label>توضیح مشکل
        <textarea rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مسئله را کامل بنویس؛ هرچه دقیق‌تر، پاسخ سریع‌تر…" />
      </label>
      <label>اولویت
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="معمولی">معمولی</option>
          <option value="مهم">مهم</option>
          <option value="فوری">فوری</option>
        </select>
      </label>
      <button className="button" onClick={submit} disabled={state === 'loading'}>
        {state === 'loading' ? 'در حال ارسال…' : 'ثبت درخواست مشاوره'} <Send size={15} />
      </button>
      {state === 'done' && <small className="admin-success">درخواست ثبت شد؛ نتیجه همین‌جا اعلام می‌شود.</small>}
      {state === 'error' && <small className="admin-error">ثبت نشد؛ توضیح مشکل را کامل‌تر بنویس و دوباره امتحان کن.</small>}

      <h2 style={{ marginTop: '1.5rem' }}><Headphones size={17} /> سوابق درخواست‌ها</h2>
      {loading ? <KarbanLoader label="در حال دریافت سوابق…" /> : rows.length === 0 ? (
        <p className="muted-note">هنوز درخواست مشاوره‌ای ثبت نکرده‌ای.</p>
      ) : (
        rows.map((r) => (
          <div className="dash-item" key={r.id}>
            <div className="dash-item-head">
              <div>
                <strong>{r.topic || r.service || 'مشاوره'}</strong>
                <small>{formatFaDate(r.created_at)}</small>
              </div>
              <span className={`dash-status st-${r.status || 'new'}`}>{STATUS_FA[r.status || 'new'] || r.status}</span>
            </div>
            {r.admin_note && <p className="dash-note">پاسخ کاربان: {r.admin_note}</p>}
          </div>
        ))
      )}
    </div>
  );
}

/* ── تیکت‌ها ───────────────────────────────────────────────── */
function MyTickets() {
  const { userId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: '', priority: 'معمولی' });
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('id,subject,status,priority,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setTickets((data || []) as Ticket[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (id: string) => {
    setOpenId(id);
    const { data } = await supabase
      .from('ticket_messages')
      .select('id,ticket_id,sender,body,attachment_path,created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });
    setMessages((data || []) as TicketMsg[]);
  };

  const createTicket = async () => {
    if (!userId || form.subject.trim().length < 3) { setState('error'); return; }
    setState('loading');
    const { data, error } = await supabase
      .from('tickets')
      .insert({ user_id: userId, subject: form.subject.trim(), priority: form.priority, status: 'open' })
      .select('id')
      .single();
    if (error || !data) { setState('error'); return; }
    await supabase.from('ticket_messages').insert({ ticket_id: data.id, sender: 'user', body: form.subject.trim() });
    setForm({ subject: '', priority: 'معمولی' });
    setState('idle');
    load();
    openTicket(data.id);
  };

  const sendReply = async () => {
    if (!openId || !userId || (!reply.trim() && !file)) return;
    setState('loading');
    let attachmentPath: string | null = null;
    if (file) {
      const path = `${userId}/${openId}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from('ticket-files').upload(path, file);
      if (!up.error) attachmentPath = path;
    }
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: openId, sender: 'user', body: reply.trim() || '(فایل پیوست)', attachment_path: attachmentPath,
    });
    if (!error && openId) {
      await supabase.from('tickets').update({ status: 'open' }).eq('id', openId).eq('user_id', userId);
    }
    setReply('');
    setFile(null);
    setState('idle');
    openTicket(openId);
    load();
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from('ticket-files').createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <>
      <div className="contact-card calc-card dash-card">
        <h2><Plus size={17} /> تیکت جدید</h2>
        <label>موضوع
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="خلاصه مشکل را بنویس…" />
        </label>
        <label>اولویت
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="معمولی">معمولی</option>
            <option value="مهم">مهم</option>
            <option value="فوری">فوری</option>
          </select>
        </label>
        <button className="button" onClick={createTicket} disabled={state === 'loading'}>ثبت تیکت</button>
        {state === 'error' && <small className="admin-error">موضوع را بنویس و دوباره امتحان کن.</small>}
      </div>

      <div className="contact-card calc-card dash-card">
        <h2><LifeBuoy size={17} /> گفت‌وگوهای پشتیبانی</h2>
        {loading ? <KarbanLoader label="در حال دریافت تیکت‌ها…" /> : tickets.length === 0 ? (
          <p className="muted-note">هنوز تیکتی نداری.</p>
        ) : (
          <>
            <div className="dash-ticket-list">
              {tickets.map((t) => (
                <button key={t.id} className={`dash-ticket ${openId === t.id ? 'is-open' : ''}`} onClick={() => openTicket(t.id)}>
                  <strong>{t.subject}</strong>
                  <small>{formatFaDate(t.created_at)}</small>
                  <span className={`dash-status st-${t.status}`}>{STATUS_FA[t.status] || t.status}</span>
                </button>
              ))}
            </div>

            {openId && (
              <div className="dash-thread">
                {messages.map((m) => (
                  <div key={m.id} className={`dash-msg ${m.sender === 'admin' ? 'is-admin' : ''}`}>
                    <header>
                      <strong>{m.sender === 'admin' ? 'پشتیبانی کاربان' : 'شما'}</strong>
                      <small>{formatFaDate(m.created_at)}</small>
                    </header>
                    <p>{m.body}</p>
                    {m.attachment_path && (
                      <button className="text-link" onClick={() => download(m.attachment_path!)}>
                        <Paperclip size={13} /> دانلود فایل پیوست
                      </button>
                    )}
                  </div>
                ))}

                <div className="dash-reply">
                  <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ یا توضیح بیشتر…" aria-label="متن پیام" />
                  <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label="ارسال فایل" />
                  <button className="button button-small" onClick={sendReply} disabled={state === 'loading'}>
                    {state === 'loading' ? 'در حال ارسال…' : 'ارسال'} <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ── اعلان‌ها ───────────────────────────────────────────────── */
function MyNotifs() {
  const { userId } = useAuth();
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id,title,body,href,is_read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setRows((data || []) as Notif[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    load();
  };

  if (loading) return <KarbanLoader label="در حال دریافت اعلان‌ها…" />;

  return (
    <div className="contact-card calc-card dash-card">
      <h2><Bell size={17} /> اعلان‌ها</h2>
      {rows.length === 0 ? (
        <p className="muted-note">اعلانی نداری؛ وقتی وضعیت درخواست‌ها یا قراردادها تغییر کند این‌جا خبر می‌شوی.</p>
      ) : (
        <>
          <button className="button button-small button-outline" onClick={markAll}>علامت‌گذاری همه به‌عنوان خوانده‌شده</button>
          {rows.map((n) => (
            <div className={`dash-item dash-notif ${n.is_read ? '' : 'is-unread'}`} key={n.id}>
              <div className="dash-item-head">
                <div>
                  <strong><User size={14} aria-hidden /> {n.title}</strong>
                  <small>{formatFaDate(n.created_at)}</small>
                </div>
                {n.href && <a className="button button-small" href={n.href}>مشاهده</a>}
              </div>
              {n.body && <p className="dash-note">{n.body}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
