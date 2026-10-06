/* ────────────────────────────────────────────────────────────
   ContractSignPage — digital signature page (Phase 4.2)
   Two roles:
   • Owner (logged-in): views the contract, generates share link,
     sees signature status.
   • Signer (anyone with the token): views contract text, types name,
     signs and submits.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { CheckCircle2, FileSignature, Link2, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import KarbanLoader from '@/components/KarbanLoader';

type SignRecord = {
  id: string;
  contract_id: string;
  owner_id: string;
  share_token: string;
  signer_name: string | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type Contract = {
  id: string;
  title: string;
  type: string;
  industry: string;
  content: any;
};

export default function ContractSignPage({ token }: { token: string }) {
  const { userId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<SignRecord | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [signerName, setSignerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        /* پیدا کردن رکورد امضا با توکن */
        const { data: rec } = await supabase
          .from('contract_signatures')
          .select('*')
          .eq('share_token', token)
          .maybeSingle();
        if (!rec) { setErr('لینک امضا نامعتبر یا منقضی است'); setLoading(false); return; }
        setRecord(rec as SignRecord);
        if (rec.expires_at && new Date(rec.expires_at).getTime() < Date.now()) {
          setErr('این لینک امضا منقضی شده است');
        }
        /* گرفتن قرارداد */
        const { data: c } = await supabase
          .from('saved_contracts')
          .select('id,title,type,industry,content')
          .eq('id', rec.contract_id)
          .maybeSingle();
        if (c) setContract(c as Contract);
        setShareLink(`${window.location.origin}/امضای-قرارداد/${token}`);
      } catch (e) {
        setErr('خطا: ' + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const isOwner = record && userId === record.owner_id;
  const alreadySigned = !!record?.signed_at;

  const sign = async () => {
    if (!signerName.trim() || signerName.trim().length < 3) {
      setErr('نام و نام خانوادگی را کامل وارد کنید');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase
        .from('contract_signatures')
        .update({
          signer_name: signerName.trim(),
          signed_at: new Date().toISOString(),
          signer_user_agent: navigator.userAgent,
        })
        .eq('share_token', token);
      if (error) { setErr('ثبت امضا ناموفق بود'); return; }
      setDone(true);
    } catch (e) {
      setErr('خطا: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loading) return <KarbanLoader label="در حال بارگیری صفحه امضا…" />;

  return (
    <div className="sign-page" style={{ minHeight: '100vh', padding: '2rem 1.5rem', background: 'var(--bg)' }}>
      <div className="container narrow-content">
        <div className="contact-card calc-card" style={{ textAlign: 'center' }}>
          <FileSignature size={48} style={{ color: 'var(--gold)', margin: '0 auto .8rem' }} />
          <h1 style={{ fontSize: '1.5rem' }}>امضای دیجیتال قرارداد</h1>
          <p className="lead" style={{ color: 'var(--muted)' }}>{contract?.title || 'قرارداد'}</p>
        </div>

        {err && <div className="contact-card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

        {record && !err && (
          <>
            {/* نمایش متن قرارداد */}
            {contract && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
                <h2>متن قرارداد</h2>
                <pre className="contract-pre" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.9rem', lineHeight: 1.8 }}>
{typeof contract.content === 'string'
  ? contract.content
  : `قرارداد ${contract.type} — ویژه ${contract.industry}

${Object.entries(contract.content || {}).filter(([k]) => k !== '__root').map(([k, v]) => `${k}: ${v}`).join('\n')}`}
                </pre>
              </div>
            )}

            {/* اگر امضا شده */}
            {alreadySigned && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem', textAlign: 'center', borderColor: 'rgba(76,175,80,.4)' }}>
                <CheckCircle2 size={42} style={{ color: '#66bb6a', margin: '0 auto .6rem' }} />
                <h2 style={{ justifyContent: 'center' }}>این قرارداد امضا شده است</h2>
                <p className="muted-note">امضاکننده: <strong>{record.signer_name}</strong></p>
                <p className="muted-note">تاریخ امضا: {new Date(record.signed_at!).toLocaleString('fa-IR')}</p>
              </div>
            )}

            {/* اگر صاحب قرارداد است */}
            {isOwner && !alreadySigned && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
                <h2><Link2 size={18} /> لینک امضای اشتراکی</h2>
                <p className="muted-note">این لینک را برای طرف مقابل بفرست تا قرارداد را امضا کند:</p>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <input value={shareLink} readOnly style={{ flex: 1, fontFamily: 'monospace', fontSize: '.8rem' }} dir="ltr" />
                  <button className="button button-outline" onClick={copyLink}>{copied ? '✓' : 'کپی'}</button>
                </div>
                <small className="muted-note">منتظر امضای طرف مقابل هستیم…</small>
              </div>
            )}

            {/* اگر طرف امضاکننده است و هنوز امضا نکرده */}
            {!isOwner && !alreadySigned && !done && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
                <h2><PenLine size={18} /> امضای قرارداد</h2>
                <p className="muted-note">نام و نام خانوادگی خود را وارد کنید و تأیید کنید. با امضا، شما متن بالا را پذیرفته‌اید.</p>
                <label>نام و نام خانوادگی <span className="req-star">*</span>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="مثلاً: علی رضایی"
                    dir="rtl"
                  />
                </label>
                <button className="button" onClick={sign} disabled={busy || signerName.trim().length < 3}>
                  {busy ? <><Loader2 size={15} className="spin" /> در حال ثبت امضا…</> : <><PenLine size={15} /> امضا و تأیید قرارداد</>}
                </button>
                <small className="muted-note">
                  <ShieldCheck size={12} style={{ display: 'inline' }} /> امضای دیجیتال شما شامل نام، تاریخ و مشخصات مرورگر ثبت می‌شود. این امضا جنبه حقوقی دارد اما جایگزین امضای رسمی دفترخانه نیست.
                </small>
              </div>
            )}

            {/* پس از امضا */}
            {done && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem', textAlign: 'center', borderColor: 'rgba(76,175,80,.4)' }}>
                <CheckCircle2 size={48} style={{ color: '#66bb6a', margin: '0 auto .6rem' }} />
                <h2 style={{ justifyContent: 'center' }}>امضا با موفقیت ثبت شد</h2>
                <p className="muted-note">{signerName} عزیز، امضای شما در تاریخ {new Date().toLocaleString('fa-IR')} ثبت شد.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
