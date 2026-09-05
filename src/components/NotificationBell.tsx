import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; href: string | null; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id,title,href,is_read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);
    const rows = data || [];
    setItems(rows.filter((r) => !r.is_read).map((r) => ({ id: r.id, title: r.title, href: r.href, created_at: r.created_at })));
    setUnread(rows.filter((r) => !r.is_read).length);
  }, [userId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, userId]);

  return (
    <div className="notif-bell-wrap">
      <a className="notif-bell" href="/داشبورد" aria-label={`اعلان‌ها${unread ? ` — ${unread} خوانده‌نشده` : ''}`} onClick={() => setOpen((v) => !v)}>
        <Bell size={19} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}</span>}
      </a>
      {open && items.length > 0 && (
        <div className="notif-pop" role="dialog" aria-label="اعلان‌های خوانده‌نشده">
          {items.map((n) => (
            <a key={n.id} href={n.href || '/داشبورد'} onClick={() => setOpen(false)}>
              <strong>{n.title}</strong>
              <small>{new Date(n.created_at).toLocaleDateString('fa-IR')}</small>
            </a>
          ))}
          <a className="notif-all" href="/داشبورد" onClick={() => setOpen(false)}>مشاهده همه اعلان‌ها</a>
        </div>
      )}
    </div>
  );
}
