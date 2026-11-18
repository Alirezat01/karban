import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserPlus,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Users,
  Search,
  Lock,
  ArrowRight,
  AlertTriangle,
  Loader2,
  BadgeCheck,
  Ban,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
  AdminMember,
  AdminRegistrationRequest,
  PaymentApprovalRequest,
  UserProfile,
  AccessStatus,
} from '../lib/firebase';
import { PlanType, formatRial, formatToman, formatFaNum, toFaDigits } from '../lib/karbanData';

interface AdminRegistryViewProps {
  onBackToApp: () => void;
}

type AdminAuthFlow = 'login' | 'register';
type AdminPanelTab = 'payments' | 'users' | 'admins';

const PLAN_LABELS: Record<PlanType, string> = {
  free: 'تست ۱۰ روزه',
  monthly: 'ماهانه پیشرفته',
  yearly: 'سالانه پیشرفته',
  founder: 'بنیان‌گذار (VIP)',
};

const ACCESS_STATUS_META: Record<
  AccessStatus,
  { label: string; badgeClass: string }
> = {
  verified: {
    label: 'تأییدشده (فعال)',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  trial: {
    label: 'دوره تست',
    badgeClass: 'bg-blue-500/15 text-[#1D4DF5] dark:text-[#608BFF]',
  },
  pending_approval: {
    label: 'در انتظار تأیید پرداخت',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  suspended: {
    label: 'مسدود / تعلیق',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
};

export const AdminRegistryView: React.FC<AdminRegistryViewProps> = ({
  onBackToApp,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [authFlow, setAuthFlow] = useState<AdminAuthFlow>('login');
  const [adminTab, setAdminTab] = useState<AdminPanelTab>('payments');

  // Admin Login / Registration State
  const [adminRecord, setAdminRecord] = useState<AdminMember | null>(null);
  const [myAdminRequest, setMyAdminRequest] = useState<AdminRegistrationRequest | null>(null);
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regOrgTitle, setRegOrgTitle] = useState('مدیریت فروش و امور مالی کاربان');
  const [regReason, setRegReason] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Admin Management State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentApprovalRequest[]>([]);
  const [adminsList, setAdminsList] = useState<AdminMember[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRegistrationRequest[]>([]);

  // Filters & Review Notes
  const [paymentFilter, setPaymentFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | AccessStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const isBootstrappedSuperAdmin = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  const isVerifiedAdmin = Boolean(
    isBootstrappedSuperAdmin || (adminRecord && adminRecord.status === 'active')
  );

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user?.displayName && !regDisplayName) {
        setRegDisplayName(user.displayName);
      }
    });
    return () => unsub();
  }, []);

  // Check / bootstrap own admin record & pending admin registration request
  useEffect(() => {
    if (!firebaseUser) {
      setAdminRecord(null);
      setMyAdminRequest(null);
      return;
    }

    const adminDocRef = doc(db, 'admins', firebaseUser.uid);
    const unsubAdminDoc = onSnapshot(
      adminDocRef,
      async (snap) => {
        if (snap.exists()) {
          setAdminRecord(snap.data() as AdminMember);
        } else {
          setAdminRecord(null);
          if (isBootstrappedSuperAdmin) {
            try {
              await setDoc(adminDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email || SUPER_ADMIN_EMAIL,
                displayName: firebaseUser.displayName || 'مدیرکل کاربان',
                role: 'super_admin',
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `admins/${firebaseUser.uid}`);
            }
          }
        }
      },
      (err) => {
        // Non-admins reading their own missing doc might fail if rule denies; handle safely
        if (!isBootstrappedSuperAdmin) {
          setAdminRecord(null);
        } else {
          handleFirestoreError(err, OperationType.GET, `admins/${firebaseUser.uid}`);
        }
      }
    );

    const reqDocRef = doc(db, 'admin_requests', firebaseUser.uid);
    const unsubMyReq = onSnapshot(
      reqDocRef,
      (snap) => {
        setMyAdminRequest(snap.exists() ? (snap.data() as AdminRegistrationRequest) : null);
      },
      () => {
        setMyAdminRequest(null);
      }
    );

    return () => {
      unsubAdminDoc();
      unsubMyReq();
    };
  }, [firebaseUser, isBootstrappedSuperAdmin]);

  // Subscribe to Users, Payment Requests, and Admins collections ONLY when verified admin
  useEffect(() => {
    if (!isVerifiedAdmin) {
      setUsersList([]);
      setPaymentRequests([]);
      setAdminsList([]);
      setAdminRequests([]);
      return;
    }

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('updatedAt', 'desc')),
      (snap) => {
        setUsersList(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payment_requests'), orderBy('createdAt', 'desc')),
      (snap) => {
        setPaymentRequests(snap.docs.map((d) => d.data() as PaymentApprovalRequest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payment_requests')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        setAdminsList(snap.docs.map((d) => d.data() as AdminMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
    );

    const unsubAdminReqs = onSnapshot(
      collection(db, 'admin_requests'),
      (snap) => {
        setAdminRequests(snap.docs.map((d) => d.data() as AdminRegistrationRequest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'admin_requests')
    );

    return () => {
      unsubUsers();
      unsubPayments();
      unsubAdmins();
      unsubAdminReqs();
    };
  }, [isVerifiedAdmin]);

  const handleAdminGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        showToast('ok', 'ورود سوپرادمین با موفقیت تأیید شد.');
      } else {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        if (snap.exists() && (snap.data() as AdminMember).status === 'active') {
          showToast('ok', 'ورود مدیر سامانه تأیید شد.');
        } else {
          setAuthFlow('register');
          showToast('err', 'حساب شما هنوز در لیست مدیران فعال نیست. می‌توانید درخواست ثبت‌نام ادمین ارسال کنید.');
        }
      }
    } catch {
      showToast('err', 'ورود با حساب گوگل لغو شد یا با خطا مواجه گردید.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSubmitAdminRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    try {
      let current = auth.currentUser;
      if (!current) {
        const cred = await signInWithPopup(auth, googleProvider);
        current = cred.user;
      }
      if (!current) return;

      const display = regDisplayName.trim() || current.displayName || 'مدیر متقاضی';
      const org = regOrgTitle.trim() || 'تیم مالی کاربان';
      const path = `admin_requests/${current.uid}`;

      try {
        await setDoc(doc(db, 'admin_requests', current.uid), {
          uid: current.uid,
          email: current.email || '',
          displayName: display,
          organizationTitle: org,
          reason: regReason.trim(),
          status: 'pending',
          reviewedBy: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('ok', 'درخواست ثبت‌نام ادمین ثبت شد و پس از تأیید سوپرادمین فعال می‌گردد.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } catch {
      showToast('err', 'ثبت درخواست ادمین با خطا مواجه شد.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleApprovePayment = async (req: PaymentApprovalRequest) => {
    if (!firebaseUser || actionBusyId) return;
    setActionBusyId(req.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'payment_requests', req.id), {
        status: 'approved',
        reviewedBy: firebaseUser.uid,
        reviewNote: (reviewNotes[req.id] || 'پرداخت تأیید و اشتراک فعال شد').trim(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', req.userId), {
        plan: req.requestedPlan,
        accessStatus: 'verified',
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('ok', `پرداخت ${req.userName} تأیید و پلن ${PLAN_LABELS[req.requestedPlan]} فعال شد.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payment_requests/${req.id}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRejectPayment = async (req: PaymentApprovalRequest) => {
    if (!firebaseUser || actionBusyId) return;
    setActionBusyId(req.id);
    try {
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status: 'rejected',
        reviewedBy: firebaseUser.uid,
        reviewNote: (reviewNotes[req.id] || 'کد پیگیری نامعتبر یا واریز تأیید نشد').trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('ok', `درخواست پرداخت ${req.userName} رد شد.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payment_requests/${req.id}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleUpdateUserAccess = async (
    targetUser: UserProfile,
    nextPlan: PlanType,
    nextStatus: AccessStatus
  ) => {
    if (actionBusyId) return;
    setActionBusyId(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        plan: nextPlan,
        accessStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast('ok', `دسترسی «${targetUser.businessName}» به‌روزرسانی شد.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleApproveAdminRequest = async (req: AdminRegistrationRequest) => {
    if (!firebaseUser || actionBusyId) return;
    setActionBusyId(req.uid);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'admins', req.uid), {
        uid: req.uid,
        email: req.email,
        displayName: req.displayName,
        role: 'admin',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'admin_requests', req.uid), {
        status: 'approved',
        reviewedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showToast('ok', `دسترسی ادمین برای ${req.displayName} فعال شد.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${req.uid}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRejectAdminRequest = async (req: AdminRegistrationRequest) => {
    if (!firebaseUser || actionBusyId) return;
    setActionBusyId(req.uid);
    try {
      await updateDoc(doc(db, 'admin_requests', req.uid), {
        status: 'rejected',
        reviewedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      showToast('ok', `درخواست ادمین ${req.displayName} رد شد.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admin_requests/${req.uid}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleAdminStatus = async (admin: AdminMember) => {
    if (!firebaseUser || admin.uid === firebaseUser.uid || actionBusyId) return;
    setActionBusyId(admin.uid);
    try {
      const nextStatus = admin.status === 'active' ? 'revoked' : 'active';
      await updateDoc(doc(db, 'admins', admin.uid), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast('ok', `وضعیت مدیر ${admin.displayName} به ${nextStatus === 'active' ? 'فعال' : 'لغوشده'} تغییر یافت.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `admins/${admin.uid}`);
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredPayments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return paymentRequests.filter((p) => {
      if (paymentFilter !== 'all' && p.status !== paymentFilter) return false;
      if (!q) return true;
      return (
        p.userName.toLowerCase().includes(q) ||
        p.businessName.toLowerCase().includes(q) ||
        p.userEmail.toLowerCase().includes(q) ||
        p.trackingCode.toLowerCase().includes(q)
      );
    });
  }, [paymentRequests, paymentFilter, searchTerm]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return usersList.filter((u) => {
      if (userStatusFilter !== 'all' && u.accessStatus !== userStatusFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.businessName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [usersList, userStatusFilter, searchTerm]);

  const pendingPaymentsCount = paymentRequests.filter((p) => p.status === 'pending').length;
  const pendingAdminsCount = adminRequests.filter((r) => r.status === 'pending').length;

  return (
    <div
      data-testid="admin-registry-view"
      className="space-y-4 pb-8"
    >
      {/* Top Bar */}
      <div className="crisp-card p-4 rounded-[26px] flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#1D4DF5] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/25">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-[#0F172A] dark:text-white truncate">
              پنل مدیریت و رجیستری ادمین کاربان
            </h1>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              تأیید پرداخت‌ها، مدیریت اشتراک‌ها و کنترل دسترسی کاربران
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToApp}
          className="px-3 py-1.5 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-xs font-extrabold text-[#0F172A] dark:text-white flex items-center gap-1 shrink-0"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>بازگشت</span>
        </button>
      </div>

      {toastMsg && (
        <div
          className={`p-3.5 rounded-[20px] border text-xs font-extrabold flex items-center gap-2 ${
            toastMsg.type === 'ok'
              ? 'bg-[#ECFDF5] dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {toastMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* SEPARATE ADMIN AUTHENTICATION (LOGIN / REGISTER) WHEN NOT VERIFIED */}
      {!isVerifiedAdmin ? (
        <div className="space-y-4">
          {/* Sub-tabs: Admin Login vs Admin Registration */}
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-full bg-white/80 dark:bg-[#161F3B] border border-slate-200/70 dark:border-slate-700/60">
            <button
              type="button"
              data-testid="admin-flow-login-tab"
              onClick={() => setAuthFlow('login')}
              className={`min-h-[40px] rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                authFlow === 'login'
                  ? 'bg-[#1D4DF5] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>ورود مدیران</span>
            </button>
            <button
              type="button"
              data-testid="admin-flow-register-tab"
              onClick={() => setAuthFlow('register')}
              className={`min-h-[40px] rounded-full text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                authFlow === 'register'
                  ? 'bg-[#1D4DF5] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ثبت‌نام ادمین جدید</span>
            </button>
          </div>

          {!authReady && (
            <div className="crisp-card p-6 rounded-[24px] text-center text-xs font-bold text-slate-500">
              در حال بررسی نشست امنیتی...
            </div>
          )}

          {authFlow === 'login' && (
            <div
              data-testid="admin-login-panel"
              className="crisp-card p-5 rounded-[28px] space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
                    ورود اختصاصی مدیران کاربان
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    دسترسی این بخش صرفاً برای ایمیل مدیرکل یا ادمین‌های تأییدشده مجاز است.
                  </p>
                </div>
              </div>

              {firebaseUser && (
                <div className="p-3.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5">
                  <div className="font-bold text-[#0F172A] dark:text-white">
                    حساب فعلی: {firebaseUser.email}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                    {myAdminRequest?.status === 'pending'
                      ? 'درخواست ادمین شما ثبت شده و در انتظار تأیید مدیرکل است.'
                      : 'این حساب هنوز مجوز مدیریت ندارد.'}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="admin-google-signin-btn"
                  disabled={authBusy}
                  onClick={handleAdminGoogleSignIn}
                  className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black flex items-center justify-center gap-2"
                >
                  {authBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>
                    {firebaseUser ? 'تغییر حساب و ورود با ایمیل مدیر' : 'ورود ادمین با حساب گوگل'}
                  </span>
                </button>

                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    className="w-full min-h-[40px] rounded-full bg-[#EFF1FA] dark:bg-[#1E294A] text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج از حساب فعلی</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {authFlow === 'register' && (
            <form
              data-testid="admin-register-form"
              onSubmit={handleSubmitAdminRegistration}
              className="crisp-card p-5 rounded-[28px] space-y-3.5"
            >
              <div>
                <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
                  درخواست ثبت‌نام و عضویت در پنل ادمین
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  پس از ارسال فرم، دسترسی شما توسط مدیرکل بررسی و فعال می‌شود.
                </p>
              </div>

              {myAdminRequest && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-700 dark:text-amber-300">
                  وضعیت درخواست فعلی شما:{' '}
                  {myAdminRequest.status === 'pending'
                    ? 'در انتظار تأیید سوپرادمین'
                    : myAdminRequest.status === 'approved'
                    ? 'تأییدشده'
                    : 'ردشده'}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                  نام و نام خانوادگی مدیر
                </label>
                <input
                  type="text"
                  required
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="مثلاً علیرضا طاهری"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                  سمت سازمانی در کاربان
                </label>
                <input
                  type="text"
                  required
                  value={regOrgTitle}
                  onChange={(e) => setRegOrgTitle(e.target.value)}
                  placeholder="مثلاً کارشناس پشتیبانی و تأیید پرداخت"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-200 mb-1">
                  توضیحات یا کد هماهنگی داخلی
                </label>
                <textarea
                  rows={2}
                  value={regReason}
                  onChange={(e) => setRegReason(e.target.value)}
                  placeholder="توضیح کوتاه برای مدیرکل جهت تأیید دسترسی..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>

              <button
                type="submit"
                data-testid="submit-admin-register-btn"
                disabled={authBusy}
                className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black flex items-center justify-center gap-2"
              >
                {authBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>ارسال درخواست عضویت ادمین</span>
              </button>
            </form>
          )}
        </div>
      ) : (
        /* VERIFIED ADMINISTRATOR MANAGEMENT DASHBOARD */
        <div data-testid="admin-verified-dashboard" className="space-y-4">
          {/* Admin Summary Strip */}
          <div className="cobalt-hero-banner p-4 rounded-[26px] text-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10.5px] text-blue-100 font-bold">
                  نشست فعال مدیر سامانه ({isBootstrappedSuperAdmin ? 'سوپرادمین' : 'ادمین تأییدشده'})
                </div>
                <div className="text-xs font-black truncate mt-0.5">
                  {firebaseUser?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-extrabold flex items-center gap-1 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 tabular-nums">
              <div className="bg-white/12 rounded-2xl p-2.5 text-center">
                <div className="text-base font-black">{formatFaNum(pendingPaymentsCount)}</div>
                <div className="text-[10px] text-blue-100">پرداخت در انتظار</div>
              </div>
              <div className="bg-white/12 rounded-2xl p-2.5 text-center">
                <div className="text-base font-black">{formatFaNum(usersList.length)}</div>
                <div className="text-[10px] text-blue-100">کل کاربران</div>
              </div>
              <div className="bg-white/12 rounded-2xl p-2.5 text-center">
                <div className="text-base font-black">{formatFaNum(pendingAdminsCount)}</div>
                <div className="text-[10px] text-blue-100">درخواست ادمین</div>
              </div>
            </div>
          </div>

          {/* Admin Section Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              {
                id: 'payments' as AdminPanelTab,
                label: `تأیید پرداخت‌ها (${formatFaNum(pendingPaymentsCount)})`,
                icon: CreditCard,
              },
              {
                id: 'users' as AdminPanelTab,
                label: `کاربران و دسترسی‌ها (${formatFaNum(usersList.length)})`,
                icon: Users,
              },
              {
                id: 'admins' as AdminPanelTab,
                label: `مدیران (${formatFaNum(adminsList.length)})`,
                icon: UserCheck,
              },
            ].map((t) => {
              const Icon = t.icon;
              const active = adminTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAdminTab(t.id)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                    active
                      ? 'bg-[#1D4DF5] text-white shadow-md shadow-blue-600/25'
                      : 'crisp-card text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center gap-2 bg-white/85 dark:bg-[#161F3B]/90 border border-white dark:border-slate-700/60 rounded-full h-10 px-3.5 shadow-xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام کاربر، کسب‌وکار، ایمیل یا کد پیگیری..."
              className="w-full bg-transparent text-xs font-medium text-[#0F172A] dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* TAB 1: PENDING & HISTORICAL PAYMENT APPROVALS */}
          {adminTab === 'payments' && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'pending', label: 'در انتظار تایید' },
                    { id: 'approved', label: 'تایید شده' },
                    { id: 'rejected', label: 'رد شده' },
                    { id: 'all', label: 'همه' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPaymentFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                      paymentFilter === f.id
                        ? 'bg-[#0F172A] dark:bg-[#1D4DF5] text-white'
                        : 'bg-white/80 dark:bg-[#18213D] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredPayments.length === 0 ? (
                <div className="crisp-card p-6 rounded-[24px] text-center text-xs font-bold text-slate-500">
                  درخواست پرداختی در این وضعیت یافت نشد.
                </div>
              ) : (
                filteredPayments.map((req) => (
                  <div
                    key={req.id}
                    data-testid={`payment-request-card-${req.id}`}
                    className="crisp-card p-4 rounded-[24px] space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-[#0F172A] dark:text-white truncate">
                          {req.userName} · {req.businessName}
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                          {req.userEmail}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 flex items-center gap-1 ${
                          req.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : req.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {req.status === 'pending' ? (
                          <Clock className="w-3 h-3" />
                        ) : req.status === 'approved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {req.status === 'pending'
                          ? 'در انتظار تایید'
                          : req.status === 'approved'
                          ? 'تایید شده'
                          : 'رد شده'}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] grid grid-cols-2 gap-2 text-[11px] tabular-nums">
                      <div>
                        <span className="text-slate-400">پلن درخواستی: </span>
                        <strong className="text-[#1D4DF5] dark:text-[#608BFF]">
                          {PLAN_LABELS[req.requestedPlan]}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">مبلغ: </span>
                        <strong className="text-[#0F172A] dark:text-white">
                          {formatToman(req.amountRial)}
                        </strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">کد پیگیری بانکی: </span>
                        <strong className="text-[#0F172A] dark:text-white font-mono">
                          {toFaDigits(req.trackingCode)}
                        </strong>
                        {req.bankRef && (
                          <span className="text-slate-500"> · ({req.bankRef})</span>
                        )}
                      </div>
                      {req.note && (
                        <div className="col-span-2 text-slate-500 dark:text-slate-300">
                          یادداشت کاربر: {req.note}
                        </div>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={reviewNotes[req.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="یادداشت بررسی ادمین (اختیاری)..."
                          className="w-full px-3 py-2 rounded-xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-[11px] font-bold"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid={`approve-payment-btn-${req.id}`}
                            disabled={actionBusyId === req.id}
                            onClick={() => handleApprovePayment(req)}
                            className="min-h-[40px] rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تایید و فعال‌سازی</span>
                          </button>
                          <button
                            type="button"
                            data-testid={`reject-payment-btn-${req.id}`}
                            disabled={actionBusyId === req.id}
                            onClick={() => handleRejectPayment(req)}
                            className="min-h-[40px] rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center justify-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>رد درخواست</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: REGISTERED USERS & VERIFIED ACCESS MANAGEMENT */}
          {adminTab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'all', label: 'همه کاربران' },
                    { id: 'verified', label: 'تأییدشده' },
                    { id: 'pending_approval', label: 'در انتظار تأیید' },
                    { id: 'trial', label: 'تست ۱۰ روزه' },
                    { id: 'suspended', label: 'مسدود' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setUserStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                      userStatusFilter === f.id
                        ? 'bg-[#0F172A] dark:bg-[#1D4DF5] text-white'
                        : 'bg-white/80 dark:bg-[#18213D] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="crisp-card p-6 rounded-[24px] text-center text-xs font-bold text-slate-500">
                  کاربری با این مشخصات ثبت نشده است.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const statusMeta = ACCESS_STATUS_META[u.accessStatus];
                  return (
                    <div
                      key={u.uid}
                      data-testid={`admin-user-card-${u.uid}`}
                      className="crisp-card p-4 rounded-[24px] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-[#0F172A] dark:text-white truncate">
                            {u.businessName} — {u.fullName}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            {u.email} {u.phone ? `· ${toFaDigits(u.phone)}` : ''}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            پلن اشتراک
                          </label>
                          <select
                            aria-label={`تغییر پلن ${u.fullName}`}
                            value={u.plan}
                            disabled={actionBusyId === u.uid}
                            onChange={(e) =>
                              handleUpdateUserAccess(
                                u,
                                e.target.value as PlanType,
                                u.accessStatus
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-[11px] font-bold"
                          >
                            <option value="free">تست ۱۰ روزه</option>
                            <option value="monthly">ماهانه پیشرفته</option>
                            <option value="yearly">سالانه پیشرفته</option>
                            <option value="founder">بنیان‌گذار (VIP)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            وضعیت دسترسی
                          </label>
                          <select
                            aria-label={`تغییر دسترسی ${u.fullName}`}
                            value={u.accessStatus}
                            disabled={actionBusyId === u.uid}
                            onChange={(e) =>
                              handleUpdateUserAccess(
                                u,
                                u.plan,
                                e.target.value as AccessStatus
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-[11px] font-bold"
                          >
                            <option value="verified">تأییدشده (فعال)</option>
                            <option value="trial">دوره تست</option>
                            <option value="pending_approval">در انتظار تأیید</option>
                            <option value="suspended">مسدود / تعلیق</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: ADMIN REGISTRY & PENDING ADMIN REQUESTS */}
          {adminTab === 'admins' && (
            <div className="space-y-4">
              {adminRequests.filter((r) => r.status === 'pending').length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black text-[#0F172A] dark:text-white px-1">
                    درخواست‌های عضویت ادمین در انتظار تأیید
                  </h3>
                  {adminRequests
                    .filter((r) => r.status === 'pending')
                    .map((req) => (
                      <div
                        key={req.uid}
                        className="crisp-card p-4 rounded-[24px] space-y-2.5"
                      >
                        <div>
                          <div className="text-xs font-black text-[#0F172A] dark:text-white">
                            {req.displayName} — {req.organizationTitle}
                          </div>
                          <div className="text-[10.5px] text-slate-500">{req.email}</div>
                          {req.reason && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                              {req.reason}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={actionBusyId === req.uid}
                            onClick={() => handleApproveAdminRequest(req)}
                            className="min-h-[38px] rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            <span>تأیید عضویت ادمین</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionBusyId === req.uid}
                            onClick={() => handleRejectAdminRequest(req)}
                            className="min-h-[38px] rounded-full bg-rose-500/15 text-rose-600 text-xs font-black flex items-center justify-center gap-1"
                          >
                            <Ban className="w-4 h-4" />
                            <span>رد درخواست</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-[#0F172A] dark:text-white px-1">
                  فهرست مدیران ثبت‌شده سامانه
                </h3>
                {adminsList.map((adm) => (
                  <div
                    key={adm.uid}
                    className="crisp-card p-4 rounded-[24px] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-[#0F172A] dark:text-white truncate">
                        {adm.displayName}{' '}
                        <span className="text-[10px] text-[#1D4DF5]">
                          ({adm.role === 'super_admin' ? 'سوپرادمین' : 'ادمین'})
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 truncate">{adm.email}</div>
                    </div>
                    {firebaseUser?.uid !== adm.uid ? (
                      <button
                        type="button"
                        disabled={actionBusyId === adm.uid}
                        onClick={() => handleToggleAdminStatus(adm)}
                        className={`px-3 py-1.5 rounded-full text-[10.5px] font-black shrink-0 ${
                          adm.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-rose-500/15 text-rose-600'
                        }`}
                      >
                        {adm.status === 'active' ? 'فعال (لغو دسترسی)' : 'لغوشده (فعال‌سازی)'}
                      </button>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-blue-500/15 text-[#1D4DF5] text-[10.5px] font-black shrink-0">
                        حساب شما
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
