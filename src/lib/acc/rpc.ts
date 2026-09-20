/* تشخیص «تابع RPC هنوز در دیتابیس نیست» — سازگاری تدریجی با مایگریشن سخت‌سازی
   تا استقرار کد و اجرای SQL بتوانند به هر ترتیبی انجام شوند. */

export function isMissingRpc(err: { code?: string | number; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code ?? '');
  if (code === '404' || code === 'PGRST202' || code === '42883') return true;
  return /could not find the function|schema cache|does not exist/i.test(err.message || '');
}

/** ساخت URL نمایش امن برای فایل‌های storage — پشتیبانِ مسیر خام، URL عمومی قدیمی و URL احرازشده */
export async function resolveAccFileUrl(
  fileUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  const raw = (fileUrl || '').trim();
  if (!raw) return '';
  // لینک خارجی غیر از storage — همان می‌ماند
  if (/^https?:\/\//i.test(raw) && !raw.includes('/object/')) return raw;
  // URL عمومی قدیمی (acc-media) — سرراست قابل استفاده
  if (raw.includes('/object/public/')) return raw;

  let bucket = '';
  let object = '';
  if (/^https?:\/\//i.test(raw)) {
    const m = raw.match(/\/object\/(?:authenticated|signed)\/([^/]+)\/(.+)$/);
    if (m) { bucket = m[1]; object = decodeURIComponent(m[2]); }
  } else {
    const slash = raw.indexOf('/');
    if (slash > 0) { bucket = raw.slice(0, slash); object = raw.slice(slash + 1); }
  }
  if (!bucket || !object) return raw;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(object, expiresInSeconds);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch { /* افتادن به مسیر خام */ }
  return raw;
}

/** استخراج «bucket/object» از URL یا مسیر ذخیره‌شده — برای حذف فایل */
export function accStoragePathOf(fileUrl: string | null | undefined): { bucket: string; object: string } | null {
  const raw = (fileUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    const m = raw.match(/\/object\/(?:public|authenticated|signed)\/([^/]+)\/(.+)$/);
    if (m) return { bucket: m[1], object: decodeURIComponent(m[2]) };
    return null;
  }
  const slash = raw.indexOf('/');
  if (slash > 0) return { bucket: raw.slice(0, slash), object: raw.slice(slash + 1) };
  return null;
}
