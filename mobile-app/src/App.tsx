/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, Variants } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Home,
  Receipt,
  Sparkles,
  FileSignature,
  Calculator,
  Crown,
  Sun,
  Moon,
  Camera,
  Scale,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cloud,
  TrendingUp,
  Calendar,
  QrCode,
  Fingerprint,
  Lock,
  Mic,
  BookOpen,
  SlidersHorizontal,
  CreditCard,
  Bell,
  BarChart3,
  ChevronLeft,
  Search,
  Star,
  Briefcase,
  LayoutGrid,
  Wallet,
  Bookmark,
  MoreHorizontal,
  ArrowUpLeft,
  FileSpreadsheet,
  UserCheck,
  UserPlus,
  Building2,
  Eraser,
} from 'lucide-react';
import {
  PlanType,
  getPlanInfo,
  BankAccountRecord,
  PettyCashFund,
  ExpenseRecord,
  ProjectRecord,
  FixedAssetRecord,
  MONTHLY_CASHFLOW_CHART,
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  PartnerRecord,
  InventoryItem,
  VaultDocument,
  formatToman,
  formatFaNum,
  toFaDigits,
  getTrialStatus,
} from './lib/karbanData';
import {
  JalaliDatePicker,
  formatSayadiFa,
  useGlobalPersianNumberEnforcer,
} from './components/ui/PersianInputs';
import { AccountingSuiteView, AccountingSubTab } from './components/AccountingSuiteView';
import { AiProStudioView } from './components/AiProStudioView';
import { ContractsAndVaultView } from './components/ContractsAndVaultView';
import { ToolsAndLawView, ToolsSubTab } from './components/ToolsAndLawView';
import { PWAAndNativeModal, OfflineIndicator } from './components/PWAAndNativeModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import {
  BiometricLockScreen,
  BiometricSecurityConfig,
  loadBiometricConfig,
  saveBiometricConfig,
} from './components/BiometricLockScreen';
import { Neobank3DCardWidget } from './components/Neobank3DCardWidget';
import { VoiceAssistantModal, VoiceNavTarget } from './components/VoiceAssistantModal';
import { CashflowForecaster } from './components/CashflowForecaster';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { DailyTaxSavingTips } from './components/DailyTaxSavingTips';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { AdminRegistryView } from './components/AdminRegistryView';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  UserProfile,
  UserWorkspacePayload,
  createCleanWorkspace,
  createDemoWorkspace,
  sanitizeFirestoreId,
} from './lib/firebase';
import treasuryArt from './assets/images/paperpillar_treasury_art_1794563328986.jpg';

type MainTab = 'dashboard' | 'accounting' | 'ai_studio' | 'contracts' | 'tools';
type DashboardSheet =
  | null
  | 'forecaster'
  | 'tax_tips'
  | 'calendar'
  | 'monthly_chart'
  | 'checks'
  | 'journal'
  | 'card3d'
  | 'ai_quick'
  | 'settings';
type HomeFeedFilter = 'all' | 'urgent' | 'analytics' | 'ledger';

const TAB_ORDER: MainTab[] = ['dashboard', 'accounting', 'ai_studio', 'contracts', 'tools'];

const tabPageTransitionVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -18 : 18,
    y: 4,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { type: 'spring', stiffness: 360, damping: 30 },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 14 : -14,
    y: -4,
    transition: { duration: 0.14 },
  }),
};

const moduleCardsContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.05,
    },
  },
};

const moduleCardSlideUpVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 340,
      damping: 26,
    },
  },
};

/**
 * گیج نیم‌دایره قطعه‌قطعه (Segmented Radial Arc Gauge) دقیقاً منطبق با اسکرین‌شات مرجع
 */
const SegmentedRadialGauge: React.FC<{ percent: number; label: string }> = ({
  percent,
  label,
}) => {
  const totalSegments = 12;
  const clamped = Math.max(0, Math.min(100, percent));
  const activeSegments = Math.round((clamped / 100) * totalSegments);
  const cx = 90;
  const cy = 84;
  const r = 64;
  const gapDeg = 4.2;
  const totalArc = 180;
  const segSpan = (totalArc - gapDeg * (totalSegments - 1)) / totalSegments;

  const describeArc = (startAngleDeg: number, endAngleDeg: number) => {
    const startRad = ((180 + startAngleDeg) * Math.PI) / 180;
    const endRad = ((180 + endAngleDeg) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center pt-1">
      <svg viewBox="0 0 180 96" className="w-full max-w-[164px] overflow-visible">
        {Array.from({ length: totalSegments }).map((_, idx) => {
          const start = idx * (segSpan + gapDeg);
          const end = start + segSpan;
          const isFilled = idx < activeSegments;
          return (
            <path
              key={idx}
              d={describeArc(start, end)}
              fill="none"
              strokeWidth={14}
              strokeLinecap="butt"
              className={
                isFilled
                  ? 'stroke-[#1D4DF5] dark:stroke-[#3B6BFF]'
                  : 'stroke-[#E6ECFF] dark:stroke-[#1E294A]'
              }
            />
          );
        })}
      </svg>
      <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
        <div className="text-[22px] leading-none font-black text-[#0F172A] dark:text-white tabular-nums">
          {toFaDigits(clamped)}٪
        </div>
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-1">
          {label}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  useGlobalPersianNumberEnforcer();

  const [activeTab, setActiveTabState] = useState<MainTab>('dashboard');
  const [tabDirection, setTabDirection] = useState<number>(1);
  const setActiveTab = (nextTab: MainTab) => {
    const prevIdx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = TAB_ORDER.indexOf(nextTab);
    if (prevIdx !== -1 && nextIdx !== -1 && nextIdx !== prevIdx) {
      setTabDirection(nextIdx > prevIdx ? 1 : -1);
    }
    setActiveTabState(nextTab);
  };
  const [activeSheet, setActiveSheet] = useState<DashboardSheet>(null);
  const [homeFeedFilter, setHomeFeedFilter] = useState<HomeFeedFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>('all');
  const [contractsInitialTab, setContractsInitialTab] = useState<
    'builder' | 'signpad' | 'letters' | 'vault'
  >('builder');
  const [accountingInitialTab, setAccountingInitialTab] =
    useState<AccountingSubTab>('invoices');
  const [toolsInitialTab, setToolsInitialTab] =
    useState<ToolsSubTab>('calculators');
  const [selectedChartIdx, setSelectedChartIdx] = useState<number>(5);
  const [activeReportDateJalali, setActiveReportDateJalali] =
    useState<string>('۱۴۰۵/۰۲/۳۱');
  const [showVoiceAssistant, setShowVoiceAssistant] = useState<boolean>(false);

  // Native Biometric Security State
  const [bioConfig, setBioConfig] = useState<BiometricSecurityConfig>(() =>
    loadBiometricConfig()
  );
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    const cfg = loadBiometricConfig();
    return cfg.enabledOnLaunch;
  });
  const [showBioSettingsModal, setShowBioSettingsModal] =
    useState<boolean>(false);

  const handleUpdateBioConfig = (next: BiometricSecurityConfig) => {
    setBioConfig(next);
    saveBiometricConfig(next);
  };

  const handleVoiceNavigation = (target: VoiceNavTarget) => {
    setActiveSheet(null);
    if (target === 'dashboard') setActiveTab('dashboard');
    else if (target === 'accounting') setActiveTab('accounting');
    else if (target === 'ai_studio') setActiveTab('ai_studio');
    else if (target === 'contracts') {
      setContractsInitialTab('builder');
      setActiveTab('contracts');
    } else if (target === 'signpad') {
      setContractsInitialTab('signpad');
      setActiveTab('contracts');
    } else if (target === 'tools') {
      setActiveTab('tools');
    } else if (target === 'lock_app') {
      setIsBiometricLocked(true);
    } else if (target === 'upgrade_modal') {
      setShowSubModal(true);
    }
  };

  // Dual Theme (Frosted Periwinkle Light / Midnight Cobalt Dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('karban_theme_v2');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('karban_theme_v2', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('karban_theme_v2', 'light');
    }
  }, [isDark]);

  // Clean Workspace First (v3): Always start every new user with empty personal ledgers unless explicitly toggled demo or registered
  const STORE_VERSION_KEY = 'karban_store_version_v3';
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('karban_demo_mode') === '1';
  });

  function loadStoreSlice<T>(key: string, cleanFallback: T): T {
    const versionReady = localStorage.getItem(STORE_VERSION_KEY) === '1';
    const demoMode = localStorage.getItem('karban_demo_mode') === '1';
    if (!versionReady && !demoMode) {
      return cleanFallback;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return cleanFallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return cleanFallback;
    }
  }

  useEffect(() => {
    if (localStorage.getItem(STORE_VERSION_KEY) !== '1') {
      localStorage.setItem(STORE_VERSION_KEY, '1');
    }
  }, []);

  // Subscription Plan & Daily AI Quotas
  const [plan, setPlan] = useState<PlanType>(() => {
    const versionReady = localStorage.getItem(STORE_VERSION_KEY) === '1';
    if (!versionReady && localStorage.getItem('karban_demo_mode') !== '1') {
      return 'free';
    }
    return (localStorage.getItem('karban_plan') as PlanType) || 'free';
  });
  const [chatUsed, setChatUsed] = useState<number>(() => {
    return Number(localStorage.getItem('karban_chat_used') || 0);
  });
  const [analyzeUsed, setAnalyzeUsed] = useState<number>(() => {
    return Number(localStorage.getItem('karban_analyze_used') || 0);
  });

  // Persistent Hybrid Store (Clean empty workspace by default)
  const [invoices, setInvoices] = useState<OfficialInvoice[]>(() =>
    loadStoreSlice<OfficialInvoice[]>('karban_invoices', [])
  );
  const [checks, setChecks] = useState<SayadiCheck[]>(() =>
    loadStoreSlice<SayadiCheck[]>('karban_checks', [])
  );
  const [journal, setJournal] = useState<JournalEntry[]>(() =>
    loadStoreSlice<JournalEntry[]>('karban_journal', [])
  );
  const [partners, setPartners] = useState<PartnerRecord[]>(() =>
    loadStoreSlice<PartnerRecord[]>('karban_partners', [])
  );
  const [items, setItems] = useState<InventoryItem[]>(() =>
    loadStoreSlice<InventoryItem[]>('karban_items', [])
  );
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>(() =>
    loadStoreSlice<VaultDocument[]>('karban_vault', [])
  );
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>(() =>
    loadStoreSlice<BankAccountRecord[]>('karban_bank_accounts', [
      {
        id: 'acc-cash',
        name: 'صندوق نقدی مرکزی کسب‌وکار',
        kind: 'cash',
        balanceRial: 0,
      },
    ])
  );
  const [pettyCash, setPettyCash] = useState<PettyCashFund[]>(() =>
    loadStoreSlice<PettyCashFund[]>('karban_petty_cash', [])
  );
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() =>
    loadStoreSlice<ExpenseRecord[]>('karban_expenses', [])
  );
  const [projects, setProjects] = useState<ProjectRecord[]>(() =>
    loadStoreSlice<ProjectRecord[]>('karban_projects', [])
  );
  const [fixedAssets, setFixedAssets] = useState<FixedAssetRecord[]>(() =>
    loadStoreSlice<FixedAssetRecord[]>('karban_assets', [])
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(() => {
    const versionReady = localStorage.getItem(STORE_VERSION_KEY) === '1';
    if (!versionReady) return null;
    return localStorage.getItem('karban_signature');
  });

  // Firebase Auth, User Profile & Cloud Workspace State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hasLoadedCloudWorkspace, setHasLoadedCloudWorkspace] = useState(false);
  const isSyncingFromRemoteRef = useRef(false);

  // Modals & Admin Portal
  const [showSubModal, setShowSubModal] = useState(false);
  const [highlightedFeature, setHighlightedFeature] = useState<string | undefined>(undefined);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminRegistry, setShowAdminRegistry] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'admin' || params.get('admin') === '1';
    }
    return false;
  });
  const [supabaseStatus, setSupabaseStatus] = useState<'local_only' | 'connected' | 'error'>(() =>
    localStorage.getItem('karban_sb_url') ? 'connected' : 'local_only'
  );

  // Switch local workspace between clean blank ledger and optional demo data
  const handleLoadCleanLocalWorkspace = () => {
    const clean = createCleanWorkspace('local');
    setInvoices(clean.invoices);
    setChecks(clean.checks);
    setJournal(clean.journal);
    setPartners(clean.partners);
    setItems(clean.items);
    setVaultDocs(clean.vaultDocs);
    setBankAccounts(clean.bankAccounts);
    setPettyCash(clean.pettyCash);
    setExpenses(clean.expenses);
    setProjects(clean.projects);
    setFixedAssets(clean.fixedAssets);
    setSignatureDataUrl(null);
    localStorage.removeItem('karban_signature');
    localStorage.removeItem('karban_demo_mode');
    localStorage.setItem(STORE_VERSION_KEY, '1');
    setIsDemoMode(false);
  };

  const handleLoadDemoLocalWorkspace = () => {
    const demo = createDemoWorkspace('local');
    setInvoices(demo.invoices);
    setChecks(demo.checks);
    setJournal(demo.journal);
    setPartners(demo.partners);
    setItems(demo.items);
    setVaultDocs(demo.vaultDocs);
    setBankAccounts(demo.bankAccounts);
    setPettyCash(demo.pettyCash);
    setExpenses(demo.expenses);
    setProjects(demo.projects);
    setFixedAssets(demo.fixedAssets);
    localStorage.setItem('karban_demo_mode', '1');
    localStorage.setItem(STORE_VERSION_KEY, '1');
    setIsDemoMode(true);
  };

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setHasLoadedCloudWorkspace(false);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to authenticated user's profile & isolated cloud workspace
  useEffect(() => {
    if (!firebaseUser) return;

    const userDocPath = `users/${firebaseUser.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          setUserProfile(profile);
          setPlan(profile.plan);
        } else {
          setUserProfile(null);
          setShowAuthModal(true);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, userDocPath);
      }
    );

    const wsPath = `users/${firebaseUser.uid}/workspace/main`;
    const unsubWs = onSnapshot(
      doc(db, 'users', firebaseUser.uid, 'workspace', 'main'),
      (snap) => {
        if (snap.exists()) {
          const ws = snap.data() as UserWorkspacePayload;
          isSyncingFromRemoteRef.current = true;
          setInvoices(Array.isArray(ws.invoices) ? ws.invoices : []);
          setChecks(Array.isArray(ws.checks) ? ws.checks : []);
          setJournal(Array.isArray(ws.journal) ? ws.journal : []);
          setPartners(Array.isArray(ws.partners) ? ws.partners : []);
          setItems(Array.isArray(ws.items) ? ws.items : []);
          setVaultDocs(Array.isArray(ws.vaultDocs) ? ws.vaultDocs : []);
          setBankAccounts(Array.isArray(ws.bankAccounts) ? ws.bankAccounts : []);
          setPettyCash(Array.isArray(ws.pettyCash) ? ws.pettyCash : []);
          setExpenses(Array.isArray(ws.expenses) ? ws.expenses : []);
          setProjects(Array.isArray(ws.projects) ? ws.projects : []);
          setFixedAssets(Array.isArray(ws.fixedAssets) ? ws.fixedAssets : []);
          setSignatureDataUrl(ws.signatureDataUrl || null);
          setIsDemoMode(false);
          setHasLoadedCloudWorkspace(true);
          setTimeout(() => {
            isSyncingFromRemoteRef.current = false;
          }, 150);
        } else {
          setHasLoadedCloudWorkspace(true);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, wsPath);
      }
    );

    return () => {
      unsubProfile();
      unsubWs();
    };
  }, [firebaseUser]);

  // Debounced cloud sync whenever authenticated user edits their own workspace
  useEffect(() => {
    if (!firebaseUser || !userProfile || !hasLoadedCloudWorkspace || isSyncingFromRemoteRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const wsPath = `users/${firebaseUser.uid}/workspace/main`;
      setDoc(doc(db, 'users', firebaseUser.uid, 'workspace', 'main'), {
        ownerId: firebaseUser.uid,
        invoices: invoices.slice(0, 500),
        checks: checks.slice(0, 500),
        journal: journal.slice(0, 1000),
        partners: partners.slice(0, 500),
        items: items.slice(0, 500),
        vaultDocs: vaultDocs.slice(0, 500),
        bankAccounts: bankAccounts.slice(0, 100),
        pettyCash: pettyCash.slice(0, 100),
        expenses: expenses.slice(0, 500),
        projects: projects.slice(0, 200),
        fixedAssets: fixedAssets.slice(0, 200),
        signatureDataUrl: signatureDataUrl || null,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, wsPath);
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [
    firebaseUser,
    userProfile,
    hasLoadedCloudWorkspace,
    invoices,
    checks,
    journal,
    partners,
    items,
    vaultDocs,
    bankAccounts,
    pettyCash,
    expenses,
    projects,
    fixedAssets,
    signatureDataUrl,
  ]);

  const handleSubmitPaymentRequest = async (payload: {
    requestedPlan: 'monthly' | 'yearly' | 'founder';
    amountRial: number;
    trackingCode: string;
    bankRef: string;
    note: string;
  }) => {
    if (!firebaseUser || !userProfile) {
      setShowSubModal(false);
      setShowAuthModal(true);
      return;
    }
    const reqId = sanitizeFirestoreId(`pay_${firebaseUser.uid.slice(0, 10)}_${Date.now()}`);
    const reqPath = `payment_requests/${reqId}`;
    try {
      await setDoc(doc(db, 'payment_requests', reqId), {
        id: reqId,
        userId: firebaseUser.uid,
        userEmail: firebaseUser.email || userProfile.email,
        userName: userProfile.fullName,
        businessName: userProfile.businessName,
        requestedPlan: payload.requestedPlan,
        amountRial: payload.amountRial,
        trackingCode: payload.trackingCode,
        bankRef: payload.bankRef || '',
        note: payload.note || '',
        status: 'pending',
        reviewedBy: '',
        reviewNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, reqPath);
    }
  };

  useEffect(() => {
    localStorage.setItem('karban_plan', plan);
  }, [plan]);
  useEffect(() => {
    localStorage.setItem('karban_invoices', JSON.stringify(invoices));
  }, [invoices]);
  useEffect(() => {
    localStorage.setItem('karban_checks', JSON.stringify(checks));
  }, [checks]);
  useEffect(() => {
    localStorage.setItem('karban_journal', JSON.stringify(journal));
  }, [journal]);
  useEffect(() => {
    localStorage.setItem('karban_partners', JSON.stringify(partners));
  }, [partners]);
  useEffect(() => {
    localStorage.setItem('karban_items', JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem('karban_vault', JSON.stringify(vaultDocs));
  }, [vaultDocs]);
  useEffect(() => {
    localStorage.setItem('karban_bank_accounts', JSON.stringify(bankAccounts));
  }, [bankAccounts]);
  useEffect(() => {
    localStorage.setItem('karban_petty_cash', JSON.stringify(pettyCash));
  }, [pettyCash]);
  useEffect(() => {
    localStorage.setItem('karban_expenses', JSON.stringify(expenses));
  }, [expenses]);
  useEffect(() => {
    localStorage.setItem('karban_projects', JSON.stringify(projects));
  }, [projects]);
  useEffect(() => {
    localStorage.setItem('karban_assets', JSON.stringify(fixedAssets));
  }, [fixedAssets]);

  const handleSaveSignature = (url: string | null) => {
    setSignatureDataUrl(url);
    if (url) {
      localStorage.setItem('karban_signature', url);
    } else {
      localStorage.removeItem('karban_signature');
    }
  };

  const [trialRefreshKey, setTrialRefreshKey] = useState<number>(0);
  const planInfo = getPlanInfo(plan);
  const trialStatus = useMemo(() => getTrialStatus(), [trialRefreshKey]);

  const handleIncrementAiUsage = (type: 'chat' | 'analyze'): boolean => {
    if (type === 'chat') {
      if (planInfo.chatLimit !== -1 && chatUsed >= planInfo.chatLimit) return false;
      const next = chatUsed + 1;
      setChatUsed(next);
      localStorage.setItem('karban_chat_used', String(next));
      return true;
    } else {
      if (planInfo.analyzeLimit !== -1 && analyzeUsed >= planInfo.analyzeLimit) return false;
      const next = analyzeUsed + 1;
      setAnalyzeUsed(next);
      localStorage.setItem('karban_analyze_used', String(next));
      return true;
    }
  };

  const handleOpenUpgrade = (featureTitle?: string) => {
    setHighlightedFeature(featureTitle);
    setShowSubModal(true);
  };

  const metrics = useMemo(() => {
    const totalSalesRial = invoices
      .filter((i) => i.type === 'sale')
      .reduce((acc, i) => acc + i.grandTotalRial, 0);
    const totalPurchasesRial = invoices
      .filter((i) => i.type === 'purchase')
      .reduce((acc, i) => acc + i.grandTotalRial, 0);
    const receivableChecksRial = checks
      .filter((c) => c.type === 'receivable' && c.status === 'in_flow')
      .reduce((acc, c) => acc + c.amountRial, 0);
    const payableChecksRial = checks
      .filter((c) => c.type === 'payable' && c.status === 'in_flow')
      .reduce((acc, c) => acc + c.amountRial, 0);
    const bankCashTotal = bankAccounts.reduce((acc, b) => acc + b.balanceRial, 0);
    const pettyCashTotal = pettyCash.reduce((acc, p) => acc + p.balanceRial, 0);
    const expensesTotalRial = expenses.reduce((acc, ex) => acc + ex.amountRial, 0);
    const netLiquidityRial = bankCashTotal + pettyCashTotal + totalSalesRial - totalPurchasesRial - expensesTotalRial;
    return {
      totalSalesRial,
      totalPurchasesRial,
      receivableChecksRial,
      payableChecksRial,
      expensesTotalRial,
      netLiquidityRial,
    };
  }, [invoices, checks, bankAccounts, pettyCash, expenses]);

  const complianceScore = useMemo(() => {
    if (invoices.length === 0 && expenses.length === 0 && checks.length === 0) {
      return 0;
    }
    const validExpenses = expenses.filter((e) => e.taxStatus === 'valid').length;
    const base = 60 + Math.min(20, invoices.length * 4) + Math.min(18, validExpenses * 4);
    return Math.min(98, base);
  }, [invoices.length, expenses, checks.length]);

  const handleExportFullBackup = () => {
    const payload = {
      exportedAtJalali: activeReportDateJalali,
      plan,
      invoices,
      checks,
      journal,
      partners,
      items,
      vaultDocs,
      bankAccounts,
      pettyCash,
      expenses,
      projects,
      fixedAssets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'karban-full-backup-1405.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.invoices) setInvoices(parsed.invoices);
        if (parsed.checks) setChecks(parsed.checks);
        if (parsed.journal) setJournal(parsed.journal);
        if (parsed.partners) setPartners(parsed.partners);
        if (parsed.items) setItems(parsed.items);
        if (parsed.vaultDocs) setVaultDocs(parsed.vaultDocs);
        if (parsed.bankAccounts) setBankAccounts(parsed.bankAccounts);
        if (parsed.pettyCash) setPettyCash(parsed.pettyCash);
        if (parsed.expenses) setExpenses(parsed.expenses);
        if (parsed.projects) setProjects(parsed.projects);
        if (parsed.fixedAssets) setFixedAssets(parsed.fixedAssets);
        setShowPwaModal(false);
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
  };

  const hasFinancialActivity = invoices.length > 0 || expenses.length > 0;
  const chartDataset = useMemo(() => {
    if (isDemoMode) return MONTHLY_CASHFLOW_CHART;
    const monthLabels = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];
    if (!hasFinancialActivity) {
      return monthLabels.map((month) => ({ month, incomeToman: 0, expenseToman: 0 }));
    }
    const salesToman = Math.round(metrics.totalSalesRial / 10);
    const outToman = Math.round((metrics.totalPurchasesRial + metrics.expensesTotalRial) / 10);
    return monthLabels.map((month, idx) =>
      idx === 5
        ? { month, incomeToman: salesToman, expenseToman: outToman }
        : { month, incomeToman: 0, expenseToman: 0 }
    );
  }, [isDemoMode, hasFinancialActivity, metrics.totalSalesRial, metrics.totalPurchasesRial, metrics.expensesTotalRial]);

  const activeChartPoint = chartDataset[selectedChartIdx] || chartDataset[5];
  const maxChartValue = Math.max(1, ...chartDataset.map((m) => m.incomeToman));

  const urgentDeadlines = [
    {
      id: 'vat-spring',
      orgTag: 'سازمان امور مالیاتی · فصل بهار',
      title: 'ارسال اظهارنامه ارزش افزوده (۱۰٪)',
      subtitle: 'تایید صورتحساب‌ها در کارپوشه سامانه مودیان',
      chips: ['الزامی', 'سامانه مودیان', 'نرخ ۱۰٪'],
      dueDate: '۱۴۰۵/۰۴/۱۵',
      daysLeftLabel: '۴ روز مانده',
      urgent: true,
      actionTab: 'accounting' as MainTab,
    },
    {
      id: 'insurance-salary',
      orgTag: 'تأمین اجتماعی · لیست ماهانه',
      title: 'ارسال فهرست حقوق و بیمه تأمین اجتماعی',
      subtitle: 'بیمه ۳۰٪ و مالیات حقوق پرسنل بدون جریمه تأخیر',
      chips: ['بیمه ۳۰٪', 'مالیات حقوق', 'ماهانه'],
      dueDate: '۱۴۰۵/۰۳/۳۱',
      daysLeftLabel: '۷ روز مانده',
      urgent: true,
      actionTab: 'tools' as MainTab,
    },
    {
      id: 'corp-tax',
      orgTag: 'مالیات مستقیم · عملکرد سالانه',
      title: 'اظهارنامه عملکرد اشخاص حقوقی (ترازنامه)',
      subtitle: 'مبتنی بر تراز آزمایشی ۴ ستونی و دفاتر قانونی',
      chips: ['تراز ۴ ستونی', 'ماده ۱۱۰', 'عملکرد ۲۵٪'],
      dueDate: '۱۴۰۵/۰۴/۳۱',
      daysLeftLabel: '۲۰ روز مانده',
      urgent: false,
      actionTab: 'accounting' as MainTab,
    },
  ];

  const navItems: { id: MainTab; mobileLabel: string; icon: React.ElementType }[] = [
    { id: 'dashboard', mobileLabel: 'خانه', icon: Home },
    { id: 'accounting', mobileLabel: 'حسابداری', icon: Receipt },
    { id: 'ai_studio', mobileLabel: 'هوش مصنوعی', icon: Sparkles },
    { id: 'contracts', mobileLabel: 'قراردادها', icon: FileSignature },
    { id: 'tools', mobileLabel: 'محاسبه‌گر', icon: Calculator },
  ];

  // نوار دسته‌بندی مربعی ابزارها (مطابق با اسکرین‌شات وسط تصویر مرجع)
  const categoryRailItems: {
    id: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
  }[] = [
    {
      id: 'all',
      label: 'همه',
      icon: LayoutGrid,
      onClick: () => {
        setActiveCategoryKey('all');
        setHomeFeedFilter('all');
      },
    },
    {
      id: 'invoices',
      label: 'حسابداری',
      icon: Receipt,
      onClick: () => {
        setActiveCategoryKey('invoices');
        setAccountingInitialTab('invoices');
        setActiveTab('accounting');
      },
    },
    {
      id: 'expenses',
      label: 'هزینه و تنخواه',
      icon: Wallet,
      onClick: () => {
        setActiveCategoryKey('expenses');
        setAccountingInitialTab('expenses');
        setActiveTab('accounting');
      },
    },
    {
      id: 'ocr',
      label: 'اسکن هوشمند',
      icon: Camera,
      onClick: () => {
        setActiveCategoryKey('ocr');
        setActiveTab('ai_studio');
      },
    },
    {
      id: 'contracts',
      label: '۲۳ قرارداد',
      icon: FileSignature,
      onClick: () => {
        setActiveCategoryKey('contracts');
        setContractsInitialTab('builder');
        setActiveTab('contracts');
      },
    },
    {
      id: 'tax_return',
      label: 'اظهارنامه',
      icon: FileSpreadsheet,
      onClick: () => {
        setActiveCategoryKey('tax_return');
        setToolsInitialTab('tax_return');
        setActiveTab('tools');
      },
    },
    {
      id: 'calculators',
      label: '۱۳ محاسبه‌گر',
      icon: Calculator,
      onClick: () => {
        setActiveCategoryKey('calculators');
        setToolsInitialTab('calculators');
        setActiveTab('tools');
      },
    },
    {
      id: 'card3d',
      label: 'کارت ۳بعدی',
      icon: CreditCard,
      onClick: () => {
        setActiveCategoryKey('card3d');
        setActiveSheet('card3d');
      },
    },
  ];

  const moduleButtons: {
    id: Exclude<DashboardSheet, null>;
    category: HomeFeedFilter;
    meta: string;
    title: string;
    subtitle: string;
    chips: string[];
    metricText: string;
    countLabel: string;
    icon: React.ElementType;
    urgent?: boolean;
  }[] = [
    {
      id: 'tax_tips',
      category: 'urgent',
      meta: `تقویم شمسی · ${toFaDigits(activeReportDateJalali)}`,
      title: 'صرفه‌جویی مالیاتی امروز',
      subtitle: 'تحلیل هوشمند معافیت‌های مالیاتی متناسب با فاکتورها',
      chips: ['کاهش مالیات', 'ماده ۱۳۱', 'هوشمند'],
      metricText: invoices.length > 0 ? formatToman(Math.round(metrics.totalSalesRial * 0.05)) : '۰ تومان',
      countLabel: invoices.length > 0 ? `${formatFaNum(Math.min(5, invoices.length + 2))} پیشنهاد فعال` : 'بدون فاکتور ثبت‌شده',
      icon: ShieldCheck,
      urgent: true,
    },
    {
      id: 'calendar',
      category: 'urgent',
      meta: 'تقویم رسمی ۱۴۰۵ · فوری',
      title: 'تقویم تکالیف مالیاتی و بیمه',
      subtitle: 'زمان‌بندی ارسال ارزش افزوده، فهرست حقوق و عملکرد',
      chips: ['ارزش افزوده ۱۰٪', 'بیمه ۳۰٪', 'هشداردار'],
      metricText: '۴ روز تا سررسید',
      countLabel: '۳ تکلیف پیش‌رو',
      icon: Calendar,
      urgent: true,
    },
    {
      id: 'forecaster',
      category: 'analytics',
      meta: 'تحلیلگر D3.js · زنده',
      title: 'پیش‌بینی نقدینگی ۹۰ روزه',
      subtitle: 'رصد دقیق تداخل سررسید چک‌های دریافتنی و پرداختنی',
      chips: ['نمودار ۹۰ روزه', 'جریان نقد', 'رادار کسری'],
      metricText: formatToman(metrics.netLiquidityRial),
      countLabel: hasFinancialActivity ? 'به‌روزرسانی لحظه‌ای' : 'دفتر سفید فعال',
      icon: TrendingUp,
    },
    {
      id: 'monthly_chart',
      category: 'analytics',
      meta: `${activeChartPoint.month} ۱۴۰۵ · عملکرد دوره`,
      title: 'نمودار سود ماه‌های شمسی',
      subtitle: 'مقایسه ورودی نقد، مخارج جاری و حاشیه سود خالص',
      chips: ['۶ ماه اول', 'تومان/ریال', 'تحلیلی'],
      metricText: hasFinancialActivity || isDemoMode
        ? `${formatFaNum(Math.round((activeChartPoint.incomeToman - activeChartPoint.expenseToman) / 1000))} هـ ت`
        : '۰ تومان',
      countLabel: hasFinancialActivity || isDemoMode ? '۶ دوره شمسی' : 'بدون تراکنش ثبت‌شده',
      icon: BarChart3,
    },
    {
      id: 'checks',
      category: 'ledger',
      meta: 'بانک مرکزی · سامانه صیاد',
      title: `چک‌های صیادی (${formatFaNum(checks.length)} فقره)`,
      subtitle: 'استعلام وضعیت رنگ صیادی و پیگیری موعد وصول',
      chips: ['شناسه ۱۶ رقمی', 'استعلام رنگ', 'سررسید'],
      metricText: formatToman(metrics.receivableChecksRial),
      countLabel: `${formatFaNum(checks.filter((c) => c.sayadiColor === 'white').length)} فقره سفید`,
      icon: QrCode,
    },
    {
      id: 'journal',
      category: 'ledger',
      meta: 'حسابداری دوبل · استاندارد ایران',
      title: `دفتر روزنامه (${formatFaNum(journal.length)} سند)`,
      subtitle: 'بررسی ردیف‌های بدهکار و بستانکار و تراز ۴ ستونی',
      chips: ['دوطرفه', 'تراز ۴ ستونی', 'دفاتر'],
      metricText: formatToman(metrics.totalSalesRial),
      countLabel: journal.length > 0 ? 'تراز متوازن' : 'دفتر خالی',
      icon: BookOpen,
    },
    {
      id: 'ai_quick',
      category: 'analytics',
      meta: 'استودیو هوش مصنوعی کاربان',
      title: '۴ ابرقابلیت موبایل‌پرو',
      subtitle: 'اسکن دوربین، لایحه‌نگار ماده ۲۴۴، رادار نقدینگی و امضا',
      chips: ['اسکن OCR', 'لایحه مالیاتی', 'امضای لمسی'],
      metricText: 'دسترسی مستقیم',
      countLabel: '۴ ابزار یکپارچه',
      icon: Sparkles,
    },
    {
      id: 'card3d',
      category: 'ledger',
      meta: 'خزانه اختصاصی · کارت فلزی',
      title: 'کارت فلزی سه‌بعدی و خزانه',
      subtitle: 'نمای کارت ۳بعدی و تنظیم تاریخ گزارش‌های خزانه',
      chips: ['نمایش ۳بعدی', 'تنظیم تاریخ', 'امنیت بالا'],
      metricText: planInfo.name,
      countLabel: `${formatFaNum(bankAccounts.length)} حساب بانکی`,
      icon: CreditCard,
    },
  ];

  // Live search matches
  const normalizedQuery = searchQuery.trim();
  const filteredModuleButtons = useMemo(() => {
    return moduleButtons.filter((m) => {
      const catOk = homeFeedFilter === 'all' || m.category === homeFeedFilter;
      if (!catOk) return false;
      if (!normalizedQuery) return true;
      return (
        m.title.includes(normalizedQuery) ||
        m.subtitle.includes(normalizedQuery) ||
        m.meta.includes(normalizedQuery) ||
        m.chips.some((c) => c.includes(normalizedQuery))
      );
    });
  }, [moduleButtons, homeFeedFilter, normalizedQuery]);

  const filteredUrgentDeadlines = useMemo(() => {
    const base = urgentDeadlines.filter((d) => d.urgent);
    if (!normalizedQuery) return base;
    return base.filter(
      (d) =>
        d.title.includes(normalizedQuery) ||
        d.subtitle.includes(normalizedQuery) ||
        d.chips.some((c) => c.includes(normalizedQuery))
    );
  }, [urgentDeadlines, normalizedQuery]);

  if (showAdminRegistry) {
    return (
      <div className="min-h-screen bg-[#E2E5F6] dark:bg-[#050811] flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen frost-shell text-[#0F172A] dark:text-[#F8FAFC] shadow-2xl border-x border-white/70 dark:border-slate-800/70 relative flex flex-col">
          <AdminRegistryView onBackToApp={() => setShowAdminRegistry(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E2E5F6] dark:bg-[#050811] flex justify-center">
      {/* STRICT MOBILE-ONLY APP CANVAS (max-w-[430px] centered smartphone viewport) */}
      <div className="w-full max-w-[430px] min-h-screen frost-shell text-[#0F172A] dark:text-[#F8FAFC] shadow-2xl border-x border-white/70 dark:border-slate-800/70 relative flex flex-col pb-24 transition-colors duration-300 selection:bg-[#1D4DF5]/20">
        <OfflineIndicator />

        {/* COMPACT MOBILE TOP BAR (Screen 2 Signature: Circular Avatar + Centered Title + Circular Action Icons) */}
        <header className="no-print sticky top-0 z-30 px-4 pt-3 pb-2 bg-[#E9EBFF]/80 dark:bg-[#111936]/85 backdrop-blur-xl flex items-center justify-between gap-2">
          {/* Right Slot (RTL Start): Circular Karban Avatar */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1A223B] p-1 shadow-sm ring-2 ring-white/90 dark:ring-slate-700/70 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            aria-label="صفحه اصلی کاربان"
          >
            <img
              src="/karban-logo.png"
              alt="لوگوی اصل کاربان"
              className="w-full h-full object-contain rounded-full"
            />
          </button>

          {/* Center Slot: Personalized Business Name & Plan */}
          <button
            type="button"
            onClick={() => handleOpenUpgrade()}
            className="min-w-0 flex-1 text-center px-1 active:scale-[0.99] transition-transform"
            title="مدیریت اشتراک کاربان"
          >
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              کاربان · {planInfo.name}
            </div>
            <div className="text-[12.5px] font-black text-[#0F172A] dark:text-white flex items-center justify-center gap-1 truncate mt-0.5">
              <Crown className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0" />
              <span className="truncate">
                {userProfile ? userProfile.businessName : 'خزانه‌داری و مودیان ۱۴۰۵'}
              </span>
            </div>
          </button>

          {/* Left Slot: Compact Circular Icon Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              data-testid="header-account-btn"
              aria-label="حساب کاربری و ثبت‌نام کسب‌وکار"
              title={userProfile ? userProfile.businessName : 'ثبت‌نام و حساب اختصاصی'}
              className={`circle-icon-btn w-9 h-9 flex items-center justify-center active:scale-95 transition-transform ${
                userProfile
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[#1D4DF5] dark:text-[#608BFF]'
              }`}
            >
              {userProfile ? <UserCheck className="w-[16px] h-[16px]" /> : <UserPlus className="w-[16px] h-[16px]" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('calendar')}
              aria-label="اعلان‌های سررسید مالیاتی"
              className="circle-icon-btn relative w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
            >
              <Bell className="w-[16px] h-[16px]" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#1A223B]" />
            </button>

            <button
              type="button"
              onClick={() => setShowVoiceAssistant(true)}
              aria-label="دستیار صوتی هوشمند"
              className="circle-icon-btn w-9 h-9 flex items-center justify-center text-[#1D4DF5] dark:text-[#608BFF] active:scale-95 transition-transform"
            >
              <Mic className="w-[16px] h-[16px]" />
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label="تغییر تم روشن و شب"
              className="circle-icon-btn w-9 h-9 flex items-center justify-center text-slate-700 dark:text-amber-300 active:scale-95 transition-transform"
            >
              {isDark ? <Sun className="w-[16px] h-[16px]" /> : <Moon className="w-[16px] h-[16px]" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSheet('settings')}
              aria-label="تنظیمات، اشتراک و پشتیبان ابری"
              className="circle-icon-btn w-9 h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
            >
              <SlidersHorizontal className="w-[16px] h-[16px]" />
            </button>
          </div>
        </header>

        {/* WORKSPACE OWNERSHIP / SUSPENSION / ONBOARDING STRIP */}
        {userProfile?.accessStatus === 'suspended' ? (
          <div className="no-print mx-4 mt-1.5 px-3.5 py-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] font-black text-center">
            حساب شما موقتاً توسط مدیر سامانه تعلیق شده است — برای بررسی با پشتیبانی تماس بگیرید.
          </div>
        ) : !userProfile ? (
          <div
            data-testid="guest-preview-banner"
            className="no-print mx-4 mt-1.5 px-3 py-2 rounded-2xl bg-white/85 dark:bg-[#18213D] border border-blue-200/70 dark:border-blue-800/50 flex items-center justify-between gap-2 text-[10.5px]"
          >
            <span className="font-bold text-slate-600 dark:text-slate-300 truncate">
              {isDemoMode
                ? 'در حال نمایش داده‌های نمونه — برای پاکسازی «دفتر سفید» بزنید'
                : 'دفتر سفید شخصی آماده است — برای ذخیره ابری ثبت‌نام کنید'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {isDemoMode ? (
                <button
                  type="button"
                  onClick={handleLoadCleanLocalWorkspace}
                  className="px-2.5 py-1 rounded-full bg-[#EFF1FA] dark:bg-[#232F54] text-[#0F172A] dark:text-white font-extrabold"
                >
                  دفتر سفید
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadDemoLocalWorkspace}
                  className="px-2.5 py-1 rounded-full bg-[#EFF1FA] dark:bg-[#232F54] text-slate-600 dark:text-slate-300 font-extrabold"
                >
                  داده نمونه
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-2.5 py-1 rounded-full bg-[#1D4DF5] text-white font-black"
              >
                ثبت‌نام
              </button>
            </div>
          </div>
        ) : null}

        {/* COMPACT 10-DAY TRIAL BANNER (WHEN FREE PLAN) */}
        {plan === 'free' && (
          <button
            type="button"
            onClick={() => handleOpenUpgrade()}
            className={`no-print mx-4 mt-1.5 px-3.5 py-2 rounded-full border flex items-center justify-between gap-2 text-[11px] font-extrabold transition-colors ${
              trialStatus.isExpired
                ? 'urgent-deadline-card text-rose-900 dark:text-rose-200'
                : 'bg-white/85 dark:bg-[#18213D] border-blue-200/70 dark:border-blue-800/50 text-[#0F172A] dark:text-slate-100'
            }`}
          >
            <span className="truncate">
              {trialStatus.isExpired
                ? 'پایان تست ۱۰ روزه — برای ادامه اشتراک تهیه کنید'
                : `تست ۱۰ روزه رایگان (${toFaDigits(trialStatus.daysRemaining)} روز مانده)`}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1D4DF5] text-white text-[10px] font-black shrink-0">
              خرید اشتراک
            </span>
          </button>
        )}

        {/* MOBILE APP VIEWPORT */}
        <main className="flex-1 px-4 pt-2 space-y-4">
          <AnimatePresence mode="wait" custom={tabDirection}>
            {activeTab === 'dashboard' && (
              <motion.div
                key="tab-dashboard"
                custom={tabDirection}
                variants={tabPageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                {/* 1. FROSTED PILL SEARCH BAR (Screen 2 Pattern) */}
                <div className="relative flex items-center gap-2 bg-white/85 dark:bg-[#161F3B]/90 border border-white dark:border-slate-700/60 rounded-full h-11 px-3.5 shadow-[0_6px_20px_-10px_rgba(24,39,95,0.14)]">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی ابزار، فاکتور، چک صیادی یا تکلیف..."
                    aria-label="جستجوی سریع در کاربان"
                    className="w-full bg-transparent text-xs font-medium text-[#0F172A] dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsBiometricLocked(true)}
                    aria-label="قفل بیومتریک"
                    title="قفل فوری بیومتریک"
                    className="w-8 h-8 rounded-full bg-[#EFF1FA] dark:bg-[#232F54] text-slate-600 dark:text-slate-200 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. OVERVIEW BENTO + SEGMENTED RADIAL GAUGE + COBALT HERO BANNER (Screen 1 Exact Pattern) */}
                <section className="space-y-2.5" aria-label="نمای کلی مالی">
                  <div className="grid grid-cols-12 gap-2.5 items-stretch">
                    {/* 7-Col Overview Card with Segmented Gauge */}
                    <div className="col-span-7 crisp-card rounded-[24px] p-3.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-black text-[#0F172A] dark:text-white">
                          نمای کلی
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSheet('monthly_chart')}
                          aria-label="جزئیات نمودار ماهانه"
                          className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-1.5 inline-flex items-center gap-1 self-start px-2.5 py-1 rounded-full bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#789BFF] text-[10px] font-extrabold">
                        <Crown className="w-3 h-3 shrink-0" />
                        <span>{hasFinancialActivity || isDemoMode ? 'انضباط مالی فعال' : 'آماده ثبت اولین سند'}</span>
                      </div>

                      <SegmentedRadialGauge
                        percent={complianceScore}
                        label={hasFinancialActivity || isDemoMode ? 'آمادگی مودیان' : 'دفتر خالی شخصی'}
                      />
                    </div>

                    {/* 5-Col Right Column: 2 Stacked Crisp Mini Cards */}
                    <div className="col-span-5 grid grid-rows-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('accounting')}
                        className="crisp-card rounded-[22px] p-3 text-right flex flex-col justify-between active:scale-[0.98] transition-transform"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#1D4DF5] text-white flex items-center justify-center shadow-sm shadow-blue-600/30">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="mt-2">
                          <div className="text-[15px] font-black text-[#0F172A] dark:text-white tabular-nums">
                            {formatFaNum(invoices.length)} سند رسمی
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            ثبت در سامانه مودیان
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSheet('checks')}
                        className="crisp-card rounded-[22px] p-3 text-right flex flex-col justify-between active:scale-[0.98] transition-transform"
                      >
                        <div className="text-[11px] font-semibold text-slate-400">
                          اعتبار چک صیادی
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <div className="flex items-center gap-1.5">
                            <Star className="w-5 h-5 fill-[#F59E0B] text-[#F59E0B] shrink-0" />
                            <span className="text-[19px] font-black text-[#0F172A] dark:text-white tabular-nums">
                              {checks.length === 0
                                ? '۰٫۰'
                                : toFaDigits(
                                    (
                                      (checks.filter((c) => c.sayadiColor === 'white').length /
                                        checks.length) *
                                      5
                                    ).toFixed(1)
                                  )}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {checks.length === 0
                              ? 'خالی'
                              : `${formatFaNum(checks.filter((c) => c.sayadiColor === 'white').length)} سفید`}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Signature Vibrant Cobalt Blue Liquidity Banner (Exact Reference Centerpiece) */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setActiveSheet('forecaster')}
                    className="w-full cobalt-hero-banner rounded-[24px] px-4 py-3.5 text-white flex items-center justify-between gap-3 text-right"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white text-[#1D4DF5] flex items-center justify-center shrink-0 shadow-sm">
                        <Wallet className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-blue-100">
                          خالص نقدینگی خزانه · {toFaDigits(activeReportDateJalali)}
                        </div>
                        <div className="text-[20px] font-black tracking-tight tabular-nums truncate mt-0.5">
                          {formatToman(metrics.netLiquidityRial)}
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-white/90 shrink-0" />
                  </motion.button>

                  {/* 4 Quick Cobalt Pill / Crisp Shortcuts (Easy Thumb Reach) */}
                  <div className="grid grid-cols-4 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('accounting')}
                      className="cobalt-pill-btn min-h-[38px] px-2 text-[10.5px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Receipt className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">فاکتور</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('ai_studio')}
                      className="crisp-card min-h-[38px] px-2 rounded-full text-[10.5px] font-extrabold text-[#0F172A] dark:text-slate-100 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0" />
                      <span className="truncate">اسکن</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContractsInitialTab('signpad');
                        setActiveTab('contracts');
                      }}
                      className="crisp-card min-h-[38px] px-2 rounded-full text-[10.5px] font-extrabold text-[#0F172A] dark:text-slate-100 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <PenTool className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF] shrink-0" />
                      <span className="truncate">امضا</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVoiceAssistant(true)}
                      className="crisp-card min-h-[38px] px-2 rounded-full text-[10.5px] font-extrabold text-[#0F172A] dark:text-slate-100 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">صوتی</span>
                    </button>
                  </div>
                </section>

                {/* 3. HORIZONTAL SQUARE ICON CATEGORY RAIL (Exact Screen 2 Middle Rail Pattern) */}
                <section className="space-y-2.5" aria-label="دسته‌بندی ابزارها">
                  <div className="flex items-center justify-between px-0.5">
                    <h2 className="text-[13px] font-black text-[#0F172A] dark:text-white">
                      دسته‌بندی ابزارها
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSheet('ai_quick')}
                      className="text-[11px] font-bold text-[#1D4DF5] dark:text-[#608BFF]"
                    >
                      مشاهده همه
                    </button>
                  </div>

                  <div className="flex items-start gap-3 overflow-x-auto no-scrollbar pb-1">
                    {categoryRailItems.map((cat) => {
                      const Icon = cat.icon;
                      const isActive = activeCategoryKey === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={cat.onClick}
                          className="flex flex-col items-center gap-1.5 shrink-0 w-[62px] active:scale-95 transition-transform"
                        >
                          <div
                            className={`w-[56px] h-[56px] rounded-[18px] flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-[#1D4DF5] text-white shadow-md shadow-blue-600/30'
                                : 'crisp-card text-slate-700 dark:text-slate-200 hover:border-[#1D4DF5]/40'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <span
                            className={`text-[10.5px] leading-tight text-center truncate w-full ${
                              isActive
                                ? 'font-black text-[#1D4DF5] dark:text-[#608BFF]'
                                : 'font-semibold text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 4. CLEAN UNDERLINE TAB SWITCHER (Screen 1 Pattern) */}
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pt-1">
                  {(
                    [
                      { id: 'all', label: 'همه موارد' },
                      { id: 'urgent', label: 'هشدار فوری' },
                      { id: 'analytics', label: 'تحلیل و نمودار' },
                      { id: 'ledger', label: 'چک و دفاتر' },
                    ] as { id: HomeFeedFilter; label: string }[]
                  ).map((tab) => {
                    const active = homeFeedFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHomeFeedFilter(tab.id)}
                        className={`pb-2.5 px-1.5 text-[11.5px] relative transition-colors whitespace-nowrap ${
                          active
                            ? 'font-black text-[#1D4DF5] dark:text-[#608BFF]'
                            : 'font-semibold text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                        {active && (
                          <motion.div
                            layoutId="home-underline-tab"
                            className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-full bg-[#1D4DF5] dark:bg-[#608BFF]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 5. URGENT DEADLINE FEED CARDS (With Gentle Shimmer + Subtle Shake Animation) */}
                {(homeFeedFilter === 'all' || homeFeedFilter === 'urgent') &&
                  filteredUrgentDeadlines.length > 0 && (
                    <section className="space-y-2.5" aria-label="هشدار سررسیدهای نزدیک">
                      {filteredUrgentDeadlines.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSheet('calendar')}
                          data-testid={`urgent-deadline-${item.id}`}
                          className="urgent-deadline-card w-full p-4 rounded-[22px] border text-right space-y-2.5 active:scale-[0.99] transition-transform"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-300 truncate">
                              {item.orgTag}
                            </span>
                            <span className="w-7 h-7 rounded-full bg-rose-500/12 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          <div>
                            <div className="text-[13.5px] font-black text-[#0F172A] dark:text-white leading-snug">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5 truncate">
                              {item.subtitle}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {item.chips.map((ch) => (
                              <span
                                key={ch}
                                className="soft-chip px-2.5 py-1 text-[10px] font-bold"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-500/20 text-[11px] tabular-nums">
                            <span className="font-bold text-slate-500 dark:text-slate-300">
                              سررسید: {toFaDigits(item.dueDate)}
                            </span>
                            <span className="font-black text-rose-600 dark:text-rose-300">
                              {item.daysLeftLabel}
                            </span>
                          </div>
                        </button>
                      ))}
                    </section>
                  )}

                {/* 6. MODULE FEED CARDS (Staggered Slide-Up Entrance Animation) */}
                <motion.section
                  key={`modules-feed-${homeFeedFilter}`}
                  variants={moduleCardsContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2.5"
                  aria-label="ماژول‌ها و ابزارهای هوشمند"
                >
                  {filteredModuleButtons.map((btn) => {
                    const Icon = btn.icon;
                    return (
                      <motion.button
                        key={btn.id}
                        type="button"
                        variants={moduleCardSlideUpVariants}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setActiveSheet(btn.id)}
                        data-testid={`mobile-module-btn-${btn.id}`}
                        className={`w-full p-4 rounded-[22px] text-right space-y-2.5 border transition-colors ${
                          btn.urgent
                            ? 'urgent-deadline-card'
                            : 'crisp-card hover:border-[#1D4DF5]/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-400 truncate">
                            {btn.meta}
                          </span>
                          <span className="w-7 h-7 rounded-full bg-[#EFF1FA] dark:bg-[#1E294A] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                            <Bookmark className="w-3.5 h-3.5" />
                          </span>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-black text-[#0F172A] dark:text-white leading-snug truncate">
                              {btn.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {btn.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {btn.chips.map((ch) => (
                            <span
                              key={ch}
                              className="soft-chip px-2.5 py-1 text-[10px] font-bold"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-0.5 text-[11px] tabular-nums">
                          <span className="font-semibold text-slate-400 dark:text-slate-400">
                            {btn.countLabel}
                          </span>
                          <span className="font-black text-[#0F172A] dark:text-white">
                            {btn.metricText}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}

                  {/* Direct Sub-Module Jump Cards (Expenses + Tax Return / 13 Calculators) */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <motion.button
                      type="button"
                      variants={moduleCardSlideUpVariants}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setAccountingInitialTab('expenses');
                        setActiveTab('accounting');
                      }}
                      data-testid="mobile-jump-expenses"
                      className="crisp-card p-3.5 rounded-[22px] text-right flex flex-col justify-between gap-2 min-h-[104px] hover:border-[#1D4DF5]/40"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-9 h-9 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                      <div className="min-w-0 w-full">
                        <div className="text-xs font-black text-[#0F172A] dark:text-white leading-snug truncate">
                          هزینه‌ها، بانک و تنخواه
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          ثبت هزینه مودیان و تنخواه‌گردان
                        </div>
                      </div>
                    </motion.button>

                    <motion.button
                      type="button"
                      variants={moduleCardSlideUpVariants}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setToolsInitialTab('tax_return');
                        setActiveTab('tools');
                      }}
                      data-testid="mobile-jump-tax-return"
                      className="crisp-card p-3.5 rounded-[22px] text-right flex flex-col justify-between gap-2 min-h-[104px] hover:border-[#1D4DF5]/40"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-9 h-9 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                          <Calculator className="w-4 h-4" />
                        </div>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                      <div className="min-w-0 w-full">
                        <div className="text-xs font-black text-[#0F172A] dark:text-white leading-snug truncate">
                          اظهارنامه و ۱۳ محاسبه‌گر
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          تشخیصی ماده ۱۳۱ و عملکرد ۲۵٪
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </motion.section>
              </motion.div>
            )}

            {activeTab === 'accounting' && (
              <motion.div
                key="tab-accounting"
                custom={tabDirection}
                variants={tabPageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <AccountingSuiteView
                  plan={plan}
                  trialStatus={trialStatus}
                  onOpenUpgrade={handleOpenUpgrade}
                  invoices={invoices}
                  onAddInvoice={(inv, jr) => {
                    setInvoices((prev) => [inv, ...prev]);
                    setJournal((prev) => [jr, ...prev]);
                  }}
                  checks={checks}
                  onAddCheck={(chk, jr) => {
                    setChecks((prev) => [chk, ...prev]);
                    setJournal((prev) => [jr, ...prev]);
                  }}
                  onUpdateCheckStatus={(id, status) => {
                    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
                  }}
                  journal={journal}
                  partners={partners}
                  onAddPartner={(p) => setPartners((prev) => [p, ...prev])}
                  items={items}
                  onAddItem={(it) => setItems((prev) => [it, ...prev])}
                  accounts={bankAccounts}
                  onAddBankAccount={(acc) => setBankAccounts((prev) => [acc, ...prev])}
                  onAdjustAccountBalance={(accountId, deltaRial, jr) => {
                    setBankAccounts((prev) =>
                      prev.map((a) => (a.id === accountId ? { ...a, balanceRial: a.balanceRial + deltaRial } : a))
                    );
                    setJournal((prev) => [jr, ...prev]);
                  }}
                  pettyCash={pettyCash}
                  onPettyOperation={(pettyId, kind, amountRial, jr) => {
                    setPettyCash((prev) =>
                      prev.map((p) => {
                        if (p.id !== pettyId) return p;
                        const nextBal =
                          kind === 'charge'
                            ? p.balanceRial + amountRial
                            : kind === 'spend'
                            ? Math.max(0, p.balanceRial - amountRial)
                            : 0;
                        return {
                          ...p,
                          balanceRial: nextBal,
                          status: kind === 'settle' ? 'settled' : 'open',
                        };
                      })
                    );
                    setJournal((prev) => [jr, ...prev]);
                  }}
                  expenses={expenses}
                  onAddExpense={(exp, jr) => {
                    setExpenses((prev) => [exp, ...prev]);
                    setBankAccounts((prev) =>
                      prev.map((a) => (a.id === exp.accountId ? { ...a, balanceRial: a.balanceRial - exp.amountRial } : a))
                    );
                    setJournal((prev) => [jr, ...prev]);
                  }}
                  projects={projects}
                  onAddProject={(pr) => setProjects((prev) => [pr, ...prev])}
                  assets={fixedAssets}
                  onAddAsset={(ast) => setFixedAssets((prev) => [ast, ...prev])}
                  initialSubTab={accountingInitialTab}
                  signatureDataUrl={signatureDataUrl}
                  onNavigateToScanner={() => setActiveTab('ai_studio')}
                  onNavigateToSignPad={() => {
                    setContractsInitialTab('signpad');
                    setActiveTab('contracts');
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'ai_studio' && (
              <motion.div
                key="tab-ai-studio"
                custom={tabDirection}
                variants={tabPageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <SubscriptionGuard
                  plan={plan}
                  trialStatus={trialStatus}
                  featureTitle="استودیو هوش مصنوعی کاربان"
                  featureDescription="اسکنر QR چک صیادی، OCR فاکتور رسمی، لایحه‌نگار مالیاتی و رادار نقدینگی نیازمند اشتراک فعال یا دوره آزمایشی معتبر است."
                  onOpenUpgrade={handleOpenUpgrade}
                  onTrialReset={() => setTrialRefreshKey((k) => k + 1)}
                >
                  <AiProStudioView
                    plan={plan}
                    chatUsed={chatUsed}
                    analyzeUsed={analyzeUsed}
                    onIncrementUsage={handleIncrementAiUsage}
                    onOpenUpgrade={handleOpenUpgrade}
                    invoices={invoices}
                    checks={checks}
                    onAddInvoiceFromOcr={(inv, jr) => {
                      setInvoices((prev) => [inv, ...prev]);
                      setJournal((prev) => [jr, ...prev]);
                    }}
                    onAddCheckFromOcr={(chk, jr) => {
                      setChecks((prev) => [chk, ...prev]);
                      setJournal((prev) => [jr, ...prev]);
                    }}
                    onSaveToVault={(doc) => setVaultDocs((prev) => [doc, ...prev])}
                  />
                </SubscriptionGuard>
              </motion.div>
            )}

            {activeTab === 'contracts' && (
              <motion.div
                key="tab-contracts"
                custom={tabDirection}
                variants={tabPageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <ContractsAndVaultView
                  plan={plan}
                  onOpenUpgrade={handleOpenUpgrade}
                  signatureDataUrl={signatureDataUrl}
                  onSaveSignature={handleSaveSignature}
                  vaultDocs={vaultDocs}
                  onAddVaultDoc={(doc) => setVaultDocs((prev) => [doc, ...prev])}
                  initialSubTab={contractsInitialTab}
                />
              </motion.div>
            )}

            {activeTab === 'tools' && (
              <motion.div
                key="tab-tools"
                custom={tabDirection}
                variants={tabPageTransitionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <ToolsAndLawView
                  initialSubTab={toolsInitialTab}
                  signatureDataUrl={signatureDataUrl}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* DOCKED CLEAN BOTTOM NAVIGATION BAR (Smooth Slide-In + Gliding Tab Indicator) */}
        <motion.nav
          aria-label="ناوبری پایین اپلیکیشن موبایل"
          initial={{ y: 56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="no-print fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white/95 dark:bg-[#11172B]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-5 items-center h-[68px] px-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative min-h-[50px] flex flex-col items-center justify-center rounded-2xl transition-colors ${
                  active
                    ? 'text-[#1D4DF5] dark:text-[#608BFF] font-black'
                    : 'text-slate-400 dark:text-slate-400 font-semibold hover:text-slate-600'
                }`}
              >
                {active && (
                  <>
                    <motion.div
                      layoutId="mobile-bottom-nav-pill"
                      className="absolute inset-x-1 inset-y-1.5 rounded-2xl bg-[#EEF2FF]/85 dark:bg-[#1D2B57]/70 -z-10"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                    <motion.div
                      layoutId="mobile-bottom-nav-indicator"
                      className="absolute top-0 w-7 h-[2.5px] bg-[#1D4DF5] dark:bg-[#608BFF] rounded-full"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  </>
                )}
                <motion.div
                  key={`${item.id}-${active ? 'on' : 'off'}`}
                  initial={active ? { y: 5, x: tabDirection * -8, opacity: 0.65, scale: 0.92 } : false}
                  animate={{ y: 0, x: 0, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  className="flex flex-col items-center justify-center"
                >
                  <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[10.5px] tracking-tight mt-0.5 whitespace-nowrap">
                    {item.mobileLabel}
                  </span>
                </motion.div>
              </motion.button>
            );
          })}
        </motion.nav>

        {/* ============================================================ */}
        {/* MOBILE DRILL-DOWN BOTTOM SHEETS (ALL ON BUTTONS)             */}
        {/* ============================================================ */}

        {/* 1. 90-Day Cashflow Forecaster Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'forecaster'}
          onClose={() => setActiveSheet(null)}
          title="پیش‌بینی نقدینگی ۹۰ روزه"
          subtitle="بر اساس چک‌های صیادی و سررسید فاکتورهای رسمی"
        >
          <CashflowForecaster
            currentLiquidityRial={metrics.netLiquidityRial}
            invoices={invoices}
            checks={checks}
          />
        </MobileBottomSheet>

        {/* 2. Daily Personalized Tax-Saving Tips Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'tax_tips'}
          onClose={() => setActiveSheet(null)}
          title="توصیه‌های صرفه‌جویی مالیاتی امروز"
          subtitle={`تقویم شمسی ${toFaDigits(activeReportDateJalali)}`}
        >
          <DailyTaxSavingTips
            invoices={invoices}
            checks={checks}
            journal={journal}
            partners={partners}
            activeReportDateJalali={activeReportDateJalali}
            onNavigateTab={(target) => {
              setActiveSheet(null);
              if (target === 'contracts') setContractsInitialTab('builder');
              setActiveTab(target);
            }}
          />
        </MobileBottomSheet>

        {/* 3. Shamsi Tax Calendar & Urgent Deadlines Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'calendar'}
          onClose={() => setActiveSheet(null)}
          title="تقویم تکالیف مالیاتی و بیمه ۱۴۰۵"
          subtitle="سررسیدهای مهم با هشدار فوری رنگ و لرزش ظریف"
        >
          <div className="space-y-3">
            {urgentDeadlines.map((d) => (
              <div
                key={d.id}
                className={`p-4 rounded-[22px] border space-y-2.5 ${
                  d.urgent ? 'urgent-deadline-card' : 'crisp-card'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-black text-[#0F172A] dark:text-white">{d.title}</span>
                  <span className="tabular-nums font-black text-rose-600 dark:text-rose-300 shrink-0">
                    {toFaDigits(d.dueDate)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">{d.subtitle}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                    {d.daysLeftLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet(null);
                      setActiveTab(d.actionTab);
                    }}
                    className="cobalt-pill-btn px-4 py-2 text-[11px] font-black"
                  >
                    اقدام و محاسبه
                  </button>
                </div>
              </div>
            ))}
          </div>
        </MobileBottomSheet>

        {/* 4. Interactive Monthly Cashflow & Profit Bar Chart Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'monthly_chart'}
          onClose={() => setActiveSheet(null)}
          title="نمودار جریان نقدینگی و سود ماهانه"
          subtitle="برای مشاهده جزئیات روی هر ماه لمس کنید"
        >
          <div className="crisp-card p-4 rounded-[24px] space-y-4">
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#EFF1FA] dark:bg-[#1A223B] text-[11px]">
              <div>
                <div className="text-slate-500 dark:text-slate-400">ماه انتخابی</div>
                <div className="font-black text-[#0F172A] dark:text-white mt-0.5">
                  {activeChartPoint.month}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">ورودی نقد</div>
                <div className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                  {formatFaNum(Math.round(activeChartPoint.incomeToman / 1000))} هـ ت
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">سود خالص</div>
                <div className="font-black text-[#1D4DF5] dark:text-[#608BFF] tabular-nums mt-0.5">
                  {formatFaNum(Math.round((activeChartPoint.incomeToman - activeChartPoint.expenseToman) / 1000))} هـ ت
                </div>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1.5 items-end h-44 pt-4 px-1 border-b border-slate-100 dark:border-slate-800">
              {chartDataset.map((item, idx) => {
                const profitToman = Math.max(0, item.incomeToman - item.expenseToman);
                const inflowH = Math.round((item.incomeToman / maxChartValue) * 100);
                const profitH = Math.round((profitToman / maxChartValue) * 100);
                const isSelected = idx === selectedChartIdx;
                return (
                  <button
                    key={item.month}
                    type="button"
                    onClick={() => setSelectedChartIdx(idx)}
                    className={`flex flex-col items-center justify-end h-full rounded-xl p-1 transition-colors ${
                      isSelected ? 'bg-[#EEF2FF] dark:bg-[#1D2B57] ring-1 ring-[#1D4DF5]/40' : ''
                    }`}
                  >
                    <div className="w-full flex items-end justify-center gap-1 h-28">
                      <div
                        style={{ height: `${inflowH}%` }}
                        className={`w-2.5 rounded-t-md ${isSelected ? 'bg-emerald-500' : 'bg-emerald-500/55'}`}
                      />
                      <div
                        style={{ height: `${profitH}%` }}
                        className={`w-2.5 rounded-t-md ${
                          isSelected ? 'bg-[#1D4DF5] dark:bg-[#608BFF]' : 'bg-[#1D4DF5]/45 dark:bg-[#608BFF]/45'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] mt-1.5 font-bold text-slate-600 dark:text-slate-300">
                      {item.month}
                    </span>
                  </button>
                );
              })}
            </div>
            {!hasFinancialActivity && !isDemoMode && (
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 text-center">
                هنوز فاکتور یا هزینه‌ای ثبت نکرده‌اید؛ با ثبت اولین سند، نمودار سود ماهانه ترسیم می‌شود.
              </div>
            )}
          </div>
        </MobileBottomSheet>

        {/* 5. Sayadi Check Radar Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'checks'}
          onClose={() => setActiveSheet(null)}
          title={`رادار چک‌های صیادی (${formatFaNum(checks.length)} فقره)`}
          subtitle="وضعیت رنگ صیاد و تاریخ سررسید شمسی"
        >
          <div className="space-y-3">
            {checks.length === 0 ? (
              <div className="crisp-card p-5 rounded-[22px] text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                هنوز هیچ چک صیادی در حساب شما ثبت نشده است.
              </div>
            ) : (
              checks.map((chk) => (
                <div
                  key={chk.id}
                  className="crisp-card p-4 rounded-[22px] space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-[#1D4DF5] dark:text-[#608BFF]">
                      {chk.bankName} ({chk.type === 'receivable' ? 'دریافتنی' : 'پرداختنی'})
                    </span>
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums soft-chip px-2 py-0.5">
                      {formatSayadiFa(chk.sayadiId)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white truncate">{chk.partyName}</span>
                    <strong className="text-sm font-black text-[#0F172A] dark:text-white tabular-nums shrink-0">
                      {formatToman(chk.amountRial)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 tabular-nums pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>سررسید: {toFaDigits(chk.dueDateJalali)}</span>
                    <span className={chk.sayadiColor === 'white' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                      {chk.sayadiColor === 'white' ? 'وضعیت سفید صیادی' : 'نیاز به بررسی رنگ'}
                    </span>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setActiveSheet(null);
                setAccountingInitialTab('checks');
                setActiveTab('accounting');
              }}
              className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black"
            >
              مدیریت و ثبت چک صیادی جدید
            </button>
          </div>
        </MobileBottomSheet>

        {/* 6. Double-Entry Ledger Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'journal'}
          onClose={() => setActiveSheet(null)}
          title="اسناد دفتر روزنامه دوطرفه"
          subtitle="مشاهده آخرین ردیف‌های بدهکار و بستانکار"
        >
          <div className="space-y-2.5">
            {journal.length === 0 ? (
              <div className="crisp-card p-5 rounded-[22px] text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                هنوز هیچ سند حسابداری در دفتر روزنامه شما ثبت نشده است.
              </div>
            ) : (
              journal.map((j) => (
                <div
                  key={j.id}
                  className="crisp-card p-3.5 rounded-[20px] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-[#0F172A] dark:text-white truncate">
                      سند {formatFaNum(j.docNumber)} — {j.description}
                    </span>
                    <span className="font-black text-[#1D4DF5] dark:text-[#608BFF] tabular-nums shrink-0">
                      {formatToman(j.amountRial)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    بدهکار: {j.debitAccount} · بستانکار: {j.creditAccount}
                  </div>
                  <div className="text-[10px] text-slate-400 tabular-nums">
                    تاریخ: {toFaDigits(j.dateJalali)}
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => {
                setActiveSheet(null);
                setAccountingInitialTab('books');
                setActiveTab('accounting');
              }}
              className="cobalt-pill-btn w-full min-h-[46px] text-xs font-black"
            >
              باز کردن تراز آزمایشی ۴ ستونی
            </button>
          </div>
        </MobileBottomSheet>

        {/* 7. 3D Neobank Card & Treasury Art Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'card3d'}
          onClose={() => setActiveSheet(null)}
          title="کارت فلزی سه‌بعدی خزانه‌داری"
          subtitle="نمای تعاملی سه‌بعدی و چشم‌انداز خزانه کاربان"
        >
          <div className="space-y-4">
            <Neobank3DCardWidget finish="gold" />
            <div className="rounded-[22px] overflow-hidden border border-slate-200/80 dark:border-slate-700/60">
              <img
                src={treasuryArt}
                alt="چشم‌انداز خزانه‌داری کاربان"
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover"
              />
            </div>
            <div className="crisp-card p-3.5 rounded-[20px]">
              <JalaliDatePicker
                label="تنظیم تاریخ گزارش خزانه (شمسی)"
                value={activeReportDateJalali}
                onChange={setActiveReportDateJalali}
              />
            </div>
          </div>
        </MobileBottomSheet>

        {/* 8. 4 Mobile Pro AI Shortcuts Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'ai_quick'}
          onClose={() => setActiveSheet(null)}
          title="۴ ابرقابلیت موبایل‌پرو کاربان"
          subtitle="برای ورود مستقیم به هر قابلیت لمس کنید"
        >
          <div className="space-y-2.5">
            {[
              {
                title: '۱. اسکن دوربین چک صیادی و فاکتور (OCR)',
                desc: 'استخراج شناسه ۱۶ رقمی صیادی و ثبت خودکار سند',
                icon: Camera,
                tab: 'ai_studio' as MainTab,
              },
              {
                title: '۲. نگارش خودکار لایحه دفاعیه مالیاتی',
                desc: 'تولید متن دفاعیه ماده ۲۴۴ با دانلود فایل PDF',
                icon: Scale,
                tab: 'ai_studio' as MainTab,
              },
              {
                title: '۳. رادار پیش‌بینی نقدینگی و کسری بودجه',
                desc: 'هشدار هوشمند تداخل سررسید چک‌ها و مالیات',
                icon: TrendingUp,
                tab: 'ai_studio' as MainTab,
              },
              {
                title: '۴. بوم امضای دیجیتال لمسی و PDF قرارداد',
                desc: 'درج امضای لمسی روی فاکتور رسمی و قراردادها',
                icon: PenTool,
                tab: 'contracts' as MainTab,
                sub: 'signpad' as const,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    if (item.sub) setContractsInitialTab(item.sub);
                    setActiveTab(item.tab);
                  }}
                  className="crisp-card w-full p-3.5 rounded-[20px] flex items-center justify-between gap-3 text-right active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#EEF2FF] dark:bg-[#1D2B57] text-[#1D4DF5] dark:text-[#608BFF] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-[#0F172A] dark:text-white truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  <ArrowUpLeft className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </MobileBottomSheet>

        {/* 9. Mobile Settings, Subscription, Biometric & Cloud Sync Sheet */}
        <MobileBottomSheet
          isOpen={activeSheet === 'settings'}
          onClose={() => setActiveSheet(null)}
          title="تنظیمات اپلیکیشن موبایل، امنیت و اشتراک"
          subtitle="مدیریت پلن کاربری، FaceID و همگام‌سازی ابری"
        >
          <div className="space-y-3.5 text-xs">
            {/* Plan Selector */}
            <div className="crisp-card p-4 rounded-[22px] space-y-2.5">
              <div className="font-black text-[#0F172A] dark:text-white flex items-center justify-between">
                <span>وضعیت اشتراک ({planInfo.name})</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet(null);
                    handleOpenUpgrade();
                  }}
                  className="text-[#1D4DF5] dark:text-[#608BFF] font-extrabold underline"
                >
                  جدول تعرفه‌ها
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'free', label: 'تست ۱۰ روزه' },
                    { id: 'monthly', label: 'ویژه ماهانه' },
                    { id: 'yearly', label: 'ویژه سالانه' },
                    { id: 'founder', label: 'همراه اول (VIP)' },
                  ] as { id: PlanType; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-full font-bold transition-colors ${
                      plan === p.id
                        ? 'bg-[#1D4DF5] text-white shadow-sm'
                        : 'bg-[#EFF1FA] dark:bg-[#1E294A] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Account, Clean Workspace & Admin Portal Actions */}
            <button
              type="button"
              onClick={() => {
                setActiveSheet(null);
                setShowAuthModal(true);
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                {userProfile
                  ? `پرونده ابری: ${userProfile.businessName}`
                  : 'ثبت‌نام / ورود اختصاصی کسب‌وکار (فضای ابری مجزا)'}
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                handleLoadCleanLocalWorkspace();
                setActiveSheet(null);
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2">
                <Eraser className="w-4 h-4 text-amber-500" />
                پاکسازی مقادیر پیش‌فرض و شروع دفتر سفید خالی
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              data-testid="open-admin-registry-btn"
              onClick={() => {
                setActiveSheet(null);
                setShowAdminRegistry(true);
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card border-[#1D4DF5]/25 flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2 text-[#1D4DF5] dark:text-[#608BFF]">
                <ShieldCheck className="w-4 h-4" />
                پنل مجزای ادمین (تأیید کاربران و فیش‌های پرداختی)
              </span>
              <ChevronLeft className="w-4 h-4 text-[#1D4DF5]" />
            </button>

            {/* Settings Action Buttons */}
            <button
              type="button"
              onClick={() => {
                setActiveSheet(null);
                setShowBioSettingsModal(true);
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                تنظیمات قفل بیومتریک (FaceID / پین ۴ رقمی)
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSheet(null);
                setShowPwaModal(true);
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-500" />
                {supabaseStatus === 'connected' ? 'سینک ابری متصل است' : 'پشتیبان ابری و نصب PWA / APK'}
              </span>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="w-full min-h-[48px] px-4 py-3 rounded-[20px] crisp-card flex items-center justify-between font-extrabold"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#1D4DF5]" />}
                {isDark ? 'تغییر به تم روشن سفید-کوبالت (روز)' : 'تغییر به تم شب سرمه‌ای'}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </button>
          </div>
        </MobileBottomSheet>

        {/* CORE MODALS */}
        <CustomerAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          firebaseUser={firebaseUser}
          userProfile={userProfile}
          onOpenAdminRegistry={() => setShowAdminRegistry(true)}
          onLoadCleanLocalWorkspace={handleLoadCleanLocalWorkspace}
          onLoadDemoLocalWorkspace={handleLoadDemoLocalWorkspace}
        />

        <SubscriptionModal
          isOpen={showSubModal}
          onClose={() => setShowSubModal(false)}
          currentPlan={plan}
          onSelectPlan={(nextPlan) => setPlan(nextPlan)}
          highlightedFeatureTitle={highlightedFeature}
          isAuthenticated={Boolean(firebaseUser && userProfile)}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onSubmitPaymentRequest={handleSubmitPaymentRequest}
        />

        <PWAAndNativeModal
          isOpen={showPwaModal}
          onClose={() => setShowPwaModal(false)}
          onExportBackup={handleExportFullBackup}
          onImportBackup={handleImportFullBackup}
          supabaseStatus={supabaseStatus}
          onSupabaseConnected={() => setSupabaseStatus('connected')}
        />

        <BiometricLockScreen
          isLocked={isBiometricLocked}
          onUnlock={() => setIsBiometricLocked(false)}
          config={bioConfig}
          onUpdateConfig={handleUpdateBioConfig}
          isSettingsModalOpen={showBioSettingsModal}
          onCloseSettingsModal={() => setShowBioSettingsModal(false)}
          onManualLock={() => setIsBiometricLocked(true)}
        />

        <VoiceAssistantModal
          isOpen={showVoiceAssistant}
          onClose={() => setShowVoiceAssistant(false)}
          onNavigate={handleVoiceNavigation}
          financialSnapshot={{
            netLiquidityRial: metrics.netLiquidityRial,
            totalSalesRial: metrics.totalSalesRial,
            totalPurchasesRial: metrics.totalPurchasesRial,
            receivableChecksRial: metrics.receivableChecksRial,
            payableChecksRial: metrics.payableChecksRial,
            invoicesCount: invoices.length,
            checksCount: checks.length,
            vaultDocsCount: vaultDocs.length,
            activeDateJalali: activeReportDateJalali,
          }}
        />
      </div>
    </div>
  );
}
