import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Printer,
  Share2,
  BookOpen,
  CreditCard,
  Users,
  Package,
  Lock,
  Crown,
  Download,
  CheckCircle2,
  X,
  ScanLine,
  PenTool,
  ShieldCheck,
  QrCode,
  Calendar,
  Wallet,
  Receipt,
  TrendingUp,
  Building2,
  BadgeCheck,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  PartnerRecord,
  InventoryItem,
  BankAccountRecord,
  PettyCashFund,
  ExpenseRecord,
  ExpenseTaxStatus,
  ProjectRecord,
  FixedAssetRecord,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_PETTY_CASH,
  INITIAL_EXPENSES,
  INITIAL_PROJECTS,
  INITIAL_FIXED_ASSETS,
  PlanType,
  isProPlan,
  formatRial,
  formatToman,
  numberToPersianWords,
  toFaDigits,
  formatFaNum,
  formatSayadiFa,
  TrialStatus,
} from '../lib/karbanData';
import {
  FaNumberInput,
  FaDigitsInput,
  JalaliDatePicker,
  toEnDigits,
} from './ui/PersianInputs';
import { SubscriptionGuard } from './SubscriptionGuard';
import { PrintPreviewPdfModal } from './PrintPreviewPdfModal';

export type AccountingSubTab =
  | 'invoices'
  | 'checks'
  | 'expenses'
  | 'accounts'
  | 'books'
  | 'vat169'
  | 'projects_assets'
  | 'catalog';

interface AccountingSuiteViewProps {
  plan: PlanType;
  trialStatus?: TrialStatus;
  onOpenUpgrade: (featureTitle?: string) => void;
  invoices: OfficialInvoice[];
  onAddInvoice: (inv: OfficialInvoice, journal: JournalEntry) => void;
  checks: SayadiCheck[];
  onAddCheck: (chk: SayadiCheck, journal: JournalEntry) => void;
  onUpdateCheckStatus: (id: string, status: SayadiCheck['status']) => void;
  journal: JournalEntry[];
  partners: PartnerRecord[];
  onAddPartner: (p: PartnerRecord) => void;
  items: InventoryItem[];
  onAddItem: (it: InventoryItem) => void;
  accounts?: BankAccountRecord[];
  onAdjustAccountBalance?: (accountId: string, deltaRial: number, jr: JournalEntry) => void;
  onAddBankAccount?: (acc: BankAccountRecord) => void;
  pettyCash?: PettyCashFund[];
  onPettyOperation?: (pettyId: string, kind: 'charge' | 'spend' | 'settle', amountRial: number, jr: JournalEntry) => void;
  expenses?: ExpenseRecord[];
  onAddExpense?: (exp: ExpenseRecord, jr: JournalEntry) => void;
  projects?: ProjectRecord[];
  onAddProject?: (prj: ProjectRecord) => void;
  assets?: FixedAssetRecord[];
  onAddAsset?: (ast: FixedAssetRecord) => void;
  initialSubTab?: AccountingSubTab;
  signatureDataUrl: string | null;
  onNavigateToScanner: () => void;
  onNavigateToSignPad: () => void;
}

export const AccountingSuiteView: React.FC<AccountingSuiteViewProps> = ({
  plan,
  trialStatus,
  onOpenUpgrade,
  invoices,
  onAddInvoice,
  checks,
  onAddCheck,
  onUpdateCheckStatus,
  journal,
  partners,
  onAddPartner,
  items,
  onAddItem,
  accounts = INITIAL_BANK_ACCOUNTS,
  onAdjustAccountBalance,
  onAddBankAccount,
  pettyCash = INITIAL_PETTY_CASH,
  onPettyOperation,
  expenses = INITIAL_EXPENSES,
  onAddExpense,
  projects = INITIAL_PROJECTS,
  onAddProject,
  assets = INITIAL_FIXED_ASSETS,
  initialSubTab = 'invoices',
  onAddAsset,
  signatureDataUrl,
  onNavigateToScanner,
  onNavigateToSignPad,
}) => {
  const [subTab, setSubTab] = useState<AccountingSubTab>(initialSubTab);

  React.useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<OfficialInvoice | null>(null);
  const [showNewInvoiceSheet, setShowNewInvoiceSheet] = useState(false);
  const [showNewCheckSheet, setShowNewCheckSheet] = useState(false);

  // New Invoice Form State (with Jalali Date & Persian Numeric State)
  const [invType, setInvType] = useState<OfficialInvoice['type']>('sale');
  const [invDateJalali, setInvDateJalali] = useState('۱۴۰۵/۰۸/۱۰');
  const [partnerName, setPartnerName] = useState('شرکت مهندسی داده‌پردازان البرز');
  const [partnerNationalId, setPartnerNationalId] = useState('۱۰۱۰۴۴۵۵۶۶۷');
  const [partnerEcoCode, setPartnerEcoCode] = useState('۴۱۱۶۷۸۹۰۱۲۳۴');
  const [itemTitle, setItemTitle] = useState('طراحی و استقرار سامانه نرم‌افزاری اختصاصی');
  const [itemCommodityCode, setItemCommodityCode] = useState('۲۹۰۱۲۳۴۵۶۷۸۹۵');
  const [itemQty, setItemQty] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState(450_000_000);
  const [itemDiscount, setItemDiscount] = useState(0);
  const [vatRate, setVatRate] = useState(10);

  // New Check Form State
  const [chkType, setChkType] = useState<'receivable' | 'payable'>('receivable');
  const [chkSayadi, setChkSayadi] = useState('۱۴۰۵۷۷۲۸۳۹۱۰۴۹۲۱');
  const [chkParty, setChkParty] = useState('شرکت مهندسی داده‌پردازان البرز');
  const [chkBank, setChkBank] = useState('بانک پاسارگاد - شعبه آفریقا');
  const [chkDueDate, setChkDueDate] = useState('۱۴۰۵/۰۹/۰۵');
  const [chkAmount, setChkAmount] = useState(380_000_000);
  const [chkColor, setChkColor] = useState<SayadiCheck['sayadiColor']>('white');

  // New Partner / Item quick state
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerNatId, setNewPartnerNatId] = useState('۱۰۱۰۹۹۸۸۷۷۶');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(120_000_000);

  // Daily Expense Form State
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('هزینه‌های اداری و جاری');
  const [expAmount, setExpAmount] = useState(35_000_000);
  const [expDate, setExpDate] = useState('۱۴۰۵/۰۸/۱۱');
  const [expAccountId, setExpAccountId] = useState(accounts[0]?.id || 'acc-mellat');
  const [expTaxStatus, setExpTaxStatus] = useState<ExpenseTaxStatus>('valid');
  const [expProjectName, setExpProjectName] = useState(projects[0]?.name || 'هزینه عمومی دفتر');

  // Bank/Cash Transfer & Petty Cash Operation State
  const [txKind, setTxKind] = useState<'receipt' | 'payment'>('receipt');
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id || 'acc-mellat');
  const [txAmount, setTxAmount] = useState(150_000_000);
  const [txDesc, setTxDesc] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBankInitial, setNewBankInitial] = useState(200_000_000);

  const [selectedPettyId, setSelectedPettyId] = useState(pettyCash[0]?.id || 'pty-1');
  const [pettyKind, setPettyKind] = useState<'charge' | 'spend' | 'settle'>('spend');
  const [pettyAmount, setPettyAmount] = useState(12_000_000);
  const [pettyNote, setPettyNote] = useState('');

  // Projects & Fixed Assets Quick Add State
  const [newPrjName, setNewPrjName] = useState('');
  const [newPrjClient, setNewPrjClient] = useState('');
  const [newPrjBudget, setNewPrjBudget] = useState(800_000_000);
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetCost, setNewAssetCost] = useState(450_000_000);
  const [newAssetYears, setNewAssetYears] = useState(5);
  const [accToast, setAccToast] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const showToast = (msg: string) => {
    setAccToast(msg);
    setTimeout(() => setAccToast(null), 2600);
  };

  const proUnlocked = isProPlan(plan);

  const normalizeJalaliComparable = (d: string): string => {
    const en = toEnDigits(d || '').replace(/-/g, '/').trim();
    const parts = en.split('/').filter(Boolean);
    if (parts.length !== 3) return en;
    return `${parts[0].padStart(4, '0')}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
  };

  const { filteredInvoices, filteredExpenses } = useMemo(() => {
    const fromNorm = filterDateFrom ? normalizeJalaliComparable(filterDateFrom) : '';
    const toNorm = filterDateTo ? normalizeJalaliComparable(filterDateTo) : '';
    const inRange = (dateJalali: string) => {
      const target = normalizeJalaliComparable(dateJalali);
      if (!target) return true;
      if (fromNorm && target < fromNorm) return false;
      if (toNorm && target > toNorm) return false;
      return true;
    };
    return {
      filteredInvoices: invoices.filter((inv) => inRange(inv.dateJalali)),
      filteredExpenses: expenses.filter((exp) => inRange(exp.dateJalali)),
    };
  }, [invoices, expenses, filterDateFrom, filterDateTo]);

  const trialBalanceRows = useMemo(() => {
    const map = new Map<string, { account: string; debitTurn: number; creditTurn: number }>();
    journal.forEach((j) => {
      const d = map.get(j.debitAccount) || { account: j.debitAccount, debitTurn: 0, creditTurn: 0 };
      d.debitTurn += j.amountRial;
      map.set(j.debitAccount, d);

      const c = map.get(j.creditAccount) || { account: j.creditAccount, debitTurn: 0, creditTurn: 0 };
      c.creditTurn += j.amountRial;
      map.set(j.creditAccount, c);
    });
    return Array.from(map.values()).map((r) => {
      const diff = r.debitTurn - r.creditTurn;
      return {
        ...r,
        debitBalance: diff > 0 ? diff : 0,
        creditBalance: diff < 0 ? Math.abs(diff) : 0,
      };
    });
  }, [journal]);

  const vatSummary = useMemo(() => {
    const sales = invoices.filter((i) => i.type === 'sale');
    const purchases = invoices.filter((i) => i.type === 'purchase');
    const totalSalesSub = sales.reduce((acc, i) => acc + (i.subtotalRial - i.discountTotalRial), 0);
    const outputVat = sales.reduce((acc, i) => acc + i.vatTotalRial, 0);
    const totalPurchaseSub = purchases.reduce((acc, i) => acc + (i.subtotalRial - i.discountTotalRial), 0);
    const inputVatCredit = purchases.reduce((acc, i) => acc + i.vatTotalRial, 0);
    return {
      totalSalesSub,
      outputVat,
      totalPurchaseSub,
      inputVatCredit,
      netPayableVat: Math.max(0, outputVat - inputVatCredit),
    };
  }, [invoices]);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if ((invType === 'purchase' || invType === 'return') && !proUnlocked) {
      onOpenUpgrade('فاکتور خرید و برگشت از فروش رسمی');
      return;
    }
    const subtotal = itemQty * itemUnitPrice;
    const taxable = Math.max(0, subtotal - itemDiscount);
    const vatAmount = Math.round((taxable * vatRate) / 100);
    const grandTotal = taxable + vatAmount;
    const seq = 1000 + invoices.length + 1;

    const newInv: OfficialInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `۱۴۰۵/${toFaDigits(seq)}`,
      moadianTaxId: toFaDigits(`140508100010294857${seq}`),
      type: invType,
      dateJalali: invDateJalali,
      partnerName,
      partnerNationalId: toFaDigits(partnerNationalId),
      partnerEconomicCode: toFaDigits(partnerEcoCode),
      partnerPostalCode: '۱۵۹۹۸۸۷۷۶۶',
      status: 'pending',
      items: [
        {
          id: `it-${Date.now()}`,
          commodityCode: toFaDigits(itemCommodityCode),
          name: itemTitle,
          quantity: itemQty,
          unitPriceRial: itemUnitPrice,
          discountRial: itemDiscount,
          vatRatePercent: vatRate,
        },
      ],
      subtotalRial: subtotal,
      discountTotalRial: itemDiscount,
      vatTotalRial: vatAmount,
      grandTotalRial: grandTotal,
      notes: 'صادرشده در سوپراپ کاربان — منطبق با الگوی صورتحساب الکترونیکی سازمان امور مالیاتی.',
    };

    const newJr: JournalEntry = {
      id: `jr-${Date.now()}`,
      docNumber: 100 + journal.length + 1,
      dateJalali: invDateJalali,
      description: `صدور صورتحساب ${invType === 'sale' ? 'فروش' : invType === 'purchase' ? 'خرید' : 'پیش‌فاکتور'} شماره ${newInv.invoiceNumber} — ${partnerName}`,
      debitAccount:
        invType === 'purchase'
          ? '۵۰۱۰ - بهای تمام‌شده خرید و موجودی کالا'
          : '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری',
      creditAccount:
        invType === 'purchase'
          ? '۲۰۱۰ - حساب‌ها و اسناد پرداختنی تجاری'
          : '۴۰۱۰ - درآمد فروش کالا و خدمات',
      amountRial: grandTotal,
      refType: 'invoice',
    };

    onAddInvoice(newInv, newJr);
    setShowNewInvoiceSheet(false);
    setSelectedInvoiceForPrint(newInv);
  };

  const handleCreateCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSayadi = toFaDigits(chkSayadi).slice(0, 16).padEnd(16, '۰');
    const newChk: SayadiCheck = {
      id: `chk-${Date.now()}`,
      sayadiId: cleanSayadi,
      type: chkType,
      partyName: chkParty,
      nationalId: '۱۰۱۰۷۷۸۸۹۹۰',
      bankName: chkBank,
      dueDateJalali: chkDueDate,
      amountRial: chkAmount,
      sayadiColor: chkColor,
      status: 'in_flow',
      description: `ثبت چک صیادی ${chkType === 'receivable' ? 'دریافتنی' : 'پرداختنی'} در اپلیکیشن کاربان`,
    };

    const newJr: JournalEntry = {
      id: `jr-${Date.now()}`,
      docNumber: 100 + journal.length + 1,
      dateJalali: chkDueDate,
      description: `ثبت چک صیادی ${formatSayadiFa(cleanSayadi)} — ${chkParty}`,
      debitAccount:
        chkType === 'receivable'
          ? '۱۰۴۰ - اسناد دریافتنی در جریان وصول (چک صیادی)'
          : '۲۰۱۰ - حساب‌ها و اسناد پرداختنی تجاری',
      creditAccount:
        chkType === 'receivable'
          ? '۱۰۳۰ - حساب‌ها و اسناد دریافتنی تجاری'
          : '۲۰۲۰ - اسناد پرداختنی صیادی',
      amountRial: chkAmount,
      refType: 'check',
    };

    onAddCheck(newChk, newJr);
    setShowNewCheckSheet(false);
  };

  const handleShareInvoice = async (inv: OfficialInvoice) => {
    const shareText = `صورتحساب رسمی کاربان\nشماره: ${inv.invoiceNumber}\nشناسه یکتای مودیان: ${toFaDigits(inv.moadianTaxId)}\nطرف حساب: ${inv.partnerName}\nمبلغ کل (با ۱۰٪ ارزش افزوده): ${formatRial(inv.grandTotalRial)} (${formatToman(inv.grandTotalRial)})\nبه حروف: ${numberToPersianWords(inv.grandTotalRial)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `صورتحساب رسمی ${inv.invoiceNumber}`,
          text: shareText,
        });
        return;
      } catch {
        // fallback
      }
    }
    navigator.clipboard.writeText(shareText);
  };

  const handleExport169Csv = () => {
    if (!proUnlocked) {
      onOpenUpgrade('گزارش ارزش افزوده ۱۰٪ و معاملات فصلی ماده ۱۶۹ با خروجی اکسل');
      return;
    }
    const headers = ['شماره فاکتور', 'شناسه مودیان', 'نوع', 'تاریخ', 'طرف حساب', 'کد ملی/اقتصادی', 'مبلغ خالص (ریال)', 'ارزش افزوده ۱۰٪ (ریال)', 'مبلغ کل (ریال)'];
    const rows = invoices.map((i) => [
      i.invoiceNumber,
      toFaDigits(i.moadianTaxId),
      i.type === 'sale' ? 'فروش' : 'خرید',
      i.dateJalali,
      i.partnerName,
      toFaDigits(i.partnerEconomicCode),
      formatFaNum(i.subtotalRial - i.discountTotalRial),
      formatFaNum(i.vatTotalRial),
      formatFaNum(i.grandTotalRial),
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'گزارش-فصلی-ماده-۱۶۹-کاربان.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sayadiColorMeta = (color: SayadiCheck['sayadiColor']) => {
    switch (color) {
      case 'white':
        return { label: 'وضعیت سفید صیادی (بدون برگشتی)', textClass: 'text-emerald-600 dark:text-emerald-400', barClass: 'from-purple-900 via-indigo-950 to-slate-900' };
      case 'yellow':
        return { label: 'وضعیت زرد صیادی (۱ فقره برگشتی)', textClass: 'text-amber-500', barClass: 'from-purple-950 via-amber-950/60 to-slate-900' };
      case 'orange':
        return { label: 'وضعیت نارنجی صیادی (۲ تا ۴ فقره)', textClass: 'text-orange-500', barClass: 'from-purple-950 via-orange-950/60 to-slate-900' };
      case 'brown':
        return { label: 'وضعیت قهوه‌ای صیادی (۵ تا ۱۰ فقره)', textClass: 'text-amber-600', barClass: 'from-purple-950 via-stone-900 to-slate-900' };
      case 'red':
        return { label: 'وضعیت قرمز صیادی (ممنوع‌المعامله)', textClass: 'text-rose-500', barClass: 'from-rose-950 via-purple-950 to-slate-900' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="crisp-card flex flex-col justify-between gap-3 p-4 rounded-[26px]">
        <div>
          <h1 className="text-base font-black text-[#0F172A] dark:text-white">
            هسته حسابداری ابری و پایانه سامانه مودیان
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            صدور صورتحساب الکترونیکی ۱۰٪ ارزش افزوده ۱۴۰۵، ثبت خودکار دفتر روزنامه و مدیریت چک صیادی
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onNavigateToScanner}
            className="min-h-[42px] px-3 py-2 rounded-full bg-[#EFF1FA] dark:bg-[#1A223B] text-[#1D4DF5] dark:text-[#608BFF] text-[11px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <ScanLine className="w-4 h-4 shrink-0" />
            <span className="truncate">اسکن فاکتور/چک</span>
          </button>
          <button
            onClick={() => setShowNewInvoiceSheet(true)}
            className="cobalt-pill-btn min-h-[42px] px-3 py-2 text-[11px] font-black flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">صدور فاکتور رسمی</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Square-Tile & Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'invoices', label: 'فاکتورهای مودیان', icon: FileText, pro: false },
          { id: 'checks', label: 'چک‌های صیادی', icon: CreditCard, pro: false },
          { id: 'expenses', label: 'هزینه‌های روزانه', icon: Receipt, pro: false },
          { id: 'accounts', label: 'بانک، صندوق و تنخواه', icon: Wallet, pro: false },
          { id: 'books', label: 'روزنامه و تراز ۴ ستونی', icon: BookOpen, pro: true },
          { id: 'vat169', label: 'ارزش افزوده و ۱۶۹', icon: Download, pro: true },
          { id: 'projects_assets', label: 'پروژه‌ها و دارایی', icon: Building2, pro: true },
          { id: 'catalog', label: 'طرف‌حساب و کالا', icon: Users, pro: false },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as AccountingSubTab)}
              className={`min-h-[40px] px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#1D4DF5] text-white shadow-md shadow-blue-600/25'
                  : 'crisp-card text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.pro && (
                <span className={`text-[10px] font-black ${active ? 'text-blue-100' : 'text-[#1D4DF5] dark:text-[#608BFF]'}`}>
                  · ویژه
                </span>
              )}
            </button>
          );
        })}
      </div>

      {accToast && (
        <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{accToast}</span>
        </div>
      )}

      {(subTab === 'invoices' || subTab === 'expenses') && (
        <div
          data-testid="accounting-date-range-filter"
          className="crisp-card p-3.5 rounded-[24px] space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0F172A] dark:text-white">
              <Filter className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>فیلتر بازه زمانی (تقویم شمسی)</span>
            </div>
            {(filterDateFrom || filterDateTo) && (
              <button
                type="button"
                data-testid="clear-date-range-btn"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10.5px] font-extrabold flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>حذف فیلتر بازه</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <JalaliDatePicker
              label="از تاریخ"
              placeholder="انتخاب شروع بازه"
              value={filterDateFrom}
              onChange={setFilterDateFrom}
            />
            <JalaliDatePicker
              label="تا تاریخ"
              placeholder="انتخاب پایان بازه"
              value={filterDateTo}
              onChange={setFilterDateTo}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5 tabular-nums">
            <span>
              {subTab === 'invoices'
                ? `نمایش ${formatFaNum(filteredInvoices.length)} از ${formatFaNum(invoices.length)} فاکتور`
                : `نمایش ${formatFaNum(filteredExpenses.length)} از ${formatFaNum(expenses.length)} هزینه`}
            </span>
            {(filterDateFrom || filterDateTo) && (
              <span className="text-[#1D4DF5] dark:text-[#608BFF]">
                {filterDateFrom ? `از ${toFaDigits(filterDateFrom)}` : 'از ابتدا'}{' '}
                {filterDateTo ? `تا ${toFaDigits(filterDateTo)}` : 'تا اکنون'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: OFFICIAL MOADIAN INVOICES */}
      {subTab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="p-5 rounded-[28px] bg-[#ECFDF5] dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40">
              <div className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-300/80">جمع فروش رسمی دوره</div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-1.5">
                {formatToman(
                  filteredInvoices
                    .filter((i) => i.type === 'sale')
                    .reduce((acc, i) => acc + i.grandTotalRial, 0)
                )}
              </div>
              <div className="text-[11px] text-emerald-700/70 dark:text-emerald-300/60 mt-1 tabular-nums">
                معادل {formatRial(filteredInvoices.filter((i) => i.type === 'sale').reduce((acc, i) => acc + i.grandTotalRial, 0))}
              </div>
            </div>
            <div className="paper-card p-5 rounded-[28px]">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">جمع فاکتورهای خرید و هزینه</div>
              <div className="text-xl font-black text-[#0F172A] dark:text-white tabular-nums mt-1.5">
                {formatToman(
                  filteredInvoices
                    .filter((i) => i.type === 'purchase')
                    .reduce((acc, i) => acc + i.grandTotalRial, 0)
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">دارای اعتبار مالیاتی قابل کسر</div>
            </div>
            <div className="paper-card p-5 rounded-[28px] flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">وضعیت امضا و مهر دیجیتال</div>
                <div className="text-sm font-extrabold text-[#0F172A] dark:text-white mt-1.5">
                  {signatureDataUrl ? 'امضای لمسی شما فعال است' : 'امضای لمسی هنوز ثبت نشده'}
                </div>
              </div>
              <button
                onClick={onNavigateToSignPad}
                className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-[#EEF2FF] dark:bg-amber-500/15 text-[#1D4DF5] dark:text-[#608BFF] text-xs font-extrabold flex items-center gap-1.5 hover:bg-violet-200/70 transition-colors"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>بوم امضا</span>
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {filteredInvoices.length === 0 ? (
              <div className="paper-card p-6 rounded-[24px] text-center space-y-2.5">
                <div className="text-xs font-black text-[#0F172A] dark:text-white">
                  در بازه زمانی انتخاب‌شده فاکتوری ثبت نشده است
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="px-4 py-2 rounded-full bg-[#1D4DF5] text-white text-xs font-extrabold"
                >
                  نمایش همه فاکتورها
                </button>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="paper-card p-4 rounded-[24px] hover:border-[#1D4DF5] dark:hover:border-amber-400/50 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-black text-[#0F172A] dark:text-white tabular-nums">
                        شماره {toFaDigits(inv.invoiceNumber)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#1D4DF5] dark:text-[#608BFF]">
                        {inv.type === 'sale'
                          ? 'صورتحساب فروش رسمی'
                          : inv.type === 'purchase'
                          ? 'فاکتور خرید رسمی'
                          : inv.type === 'proforma'
                          ? 'پیش‌فاکتور'
                          : 'برگشت از فروش'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {toFaDigits(inv.dateJalali)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        شناسه یکتای مودیان: {toFaDigits(inv.moadianTaxId)}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-extrabold text-[#0F172A] dark:text-white">
                      {inv.partnerName}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      شناسه ملی: {toFaDigits(inv.partnerNationalId)} · کد اقتصادی: {toFaDigits(inv.partnerEconomicCode)} · تعداد اقلام: {formatFaNum(inv.items.length)} ردیف
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-violet-100 dark:border-slate-700/50">
                    <div className="text-left">
                      <div className="text-base md:text-lg font-black text-[#0F172A] dark:text-white tabular-nums">
                        {formatRial(inv.grandTotalRial)}
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                        معادل {formatToman(inv.grandTotalRial)} (ارزش افزوده: {formatToman(inv.vatTotalRial)})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInvoiceForPrint(inv)}
                        className="min-h-[42px] px-4 py-2 rounded-2xl bg-[#EFF1FA] dark:bg-[#1E294A] text-[#0F172A] dark:text-white text-xs font-extrabold flex items-center gap-1.5 hover:bg-[#1D4DF5] hover:text-white dark:hover:bg-amber-400 dark:hover:text-[#141129] transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        <span>پیش‌نمایش چاپ و PDF</span>
                      </button>
                      <button
                        onClick={() => handleShareInvoice(inv)}
                        className="min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:bg-[#EFF1FA] dark:hover:bg-[#211D3F] transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>اشتراک</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REALISTIC PURPLE SAYADI CHECK CARDS */}
      {subTab === 'checks' && (
        <div className="space-y-5">
          <div className="paper-card flex flex-wrap items-center justify-between gap-3 p-5 rounded-[28px]">
            <div>
              <h2 className="text-sm md:text-base font-black text-[#0F172A] dark:text-white">
                خزانه چک‌های صیادی بنفش (شناسه ۱۶ رقمی بانک مرکزی)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                نمایش گرافیکی برگه چک صیادی با تفکیک ۴ رقمی فارسی، مبلغ به حروف و استعلام وضعیت رنگ
              </p>
            </div>
            <button
              onClick={() => setShowNewCheckSheet(true)}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-black flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت برگه چک صیادی جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {checks.map((chk) => {
              const colorMeta = sayadiColorMeta(chk.sayadiColor);
              return (
                <div
                  key={chk.id}
                  className={`rounded-3xl bg-gradient-to-br ${colorMeta.barClass} text-white border border-purple-400/25 shadow-xl overflow-hidden flex flex-col justify-between p-5 space-y-4`}
                >
                  {/* Top Strip of Purple Sayadi Check */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div className="space-y-1">
                      <div className="text-[11px] text-purple-200/80 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>سامانه صیاد بانک مرکزی — {chk.bankName}</span>
                      </div>
                      <div className="text-sm font-black tracking-wider text-amber-300 tabular-nums">
                        شناسه صیادی: {formatSayadiFa(chk.sayadiId)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] text-purple-200/80">سررسید شمسی</div>
                      <div className="text-sm font-black text-white tabular-nums mt-0.5">
                        {toFaDigits(chk.dueDateJalali)}
                      </div>
                    </div>
                  </div>

                  {/* Check Body */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-200/75">
                        {chk.type === 'receivable' ? 'واگذارنده / صادرکننده:' : 'در وجه ذینفع:'}
                      </span>
                      <strong className="text-sm font-extrabold text-white">{chk.partyName}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-200/75">مبلغ به حروف:</span>
                      <span className="text-purple-100 font-medium">{numberToPersianWords(chk.amountRial)}</span>
                    </div>
                  </div>

                  {/* Amount Box & Action */}
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="bg-black/30 px-4 py-2 rounded-2xl border border-white/10">
                      <div className="text-[10px] text-purple-200/70">مبلغ چک (ریال / تومان)</div>
                      <div className="text-base font-black text-amber-400 tabular-nums">
                        {formatRial(chk.amountRial)}
                      </div>
                      <div className="text-[11px] text-emerald-300 font-bold tabular-nums">
                        معادل {formatToman(chk.amountRial)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[11px] font-bold ${colorMeta.textClass}`}>
                        {colorMeta.label}
                      </span>
                      {chk.status === 'in_flow' ? (
                        <button
                          onClick={() => onUpdateCheckStatus(chk.id, 'cleared')}
                          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ثبت وصول چک</span>
                        </button>
                      ) : (
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>وصول و تسویه شد</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DOUBLE-ENTRY JOURNAL & 4-COLUMN TRIAL BALANCE (ADVANCED ACCOUNTING) */}
      {subTab === 'books' && (
        <SubscriptionGuard
          plan={plan}
          trialStatus={trialStatus}
          featureTitle="دفاتر قانونی و تراز آزمایشی چهارستونی (حسابداری پیشرفته)"
          featureDescription="دسترسی به دفاتر قانونی کل و روزنامه دوطرفه، صدور تراز آزمایشی چهارستونی و گزارش‌های تطبیق مالیاتی نیازمند اشتراک حرفه‌ای یا دوره آزمایشی معتبر است."
          onOpenUpgrade={onOpenUpgrade}
        >
          <div className="space-y-5">
            {!proUnlocked && (
              <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      تراز آزمایشی چهارستونی و خروجی رسمی دفاتر قانونی (ویژه اشتراک پیشرفته)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      در نسخه آزمایشی پیش‌نمایش زنده اسناد را می‌بینید؛ برای دریافت خروجی اکسل دفاتر و تراز چهارستونی کامل، پلن خود را ارتقا دهید.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenUpgrade('دفتر روزنامه، کل و تراز آزمایشی چهارستونی')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shrink-0"
                >
                  <Crown className="w-4 h-4" />
                  <span>مشاهده و ارتقای پلن</span>
                </button>
              </div>
            )}

            {/* 4-Column Trial Balance Table */}
            <div className="paper-card p-5 rounded-[28px] space-y-3 overflow-x-auto">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white">
                تراز آزمایشی چهارستونی حساب‌های کل (ارقام به ریال با جداکننده سه‌رقمی فارسی)
              </h3>
              <table className="w-full text-right text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-3 font-bold">کد و نام حساب کل</th>
                    <th className="py-3 px-3 font-bold text-left">گردش بدهکار</th>
                    <th className="py-3 px-3 font-bold text-left">گردش بستانکار</th>
                    <th className="py-3 px-3 font-bold text-left">مانده بدهکار</th>
                    <th className="py-3 px-3 font-bold text-left">مانده بستانکار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-100 dark:divide-violet-800/40 tabular-nums">
                  {trialBalanceRows.map((row) => (
                    <tr key={row.account} className="hover:bg-[#EFF1FA] dark:hover:bg-[#1E1A36]">
                      <td className="py-3.5 px-3 font-extrabold text-[#0F172A] dark:text-white">{row.account}</td>
                      <td className="py-3.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                        {formatFaNum(row.debitTurn)}
                      </td>
                      <td className="py-3.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                        {formatFaNum(row.creditTurn)}
                      </td>
                      <td className="py-3.5 px-3 text-left font-black text-emerald-600 dark:text-emerald-400">
                        {formatFaNum(row.debitBalance)}
                      </td>
                      <td className="py-3.5 px-3 text-left font-black text-[#1D4DF5] dark:text-[#608BFF]">
                        {formatFaNum(row.creditBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Double-Entry Journal List */}
            <div className="paper-card p-5 rounded-[28px] space-y-3">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white">
                اسناد دفتر روزنامه دوطرفه (ثبت خودکار سیستم)
              </h3>
              <div className="space-y-2.5">
                {journal.map((j) => (
                  <div
                    key={j.id}
                    className="p-3.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-extrabold text-[#0F172A] dark:text-white tabular-nums">
                        سند شماره {formatFaNum(j.docNumber)} · تاریخ شمسی: {toFaDigits(j.dateJalali)} — {j.description}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        بدهکار: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{j.debitAccount}</span> | بستانکار: <span className="text-[#1D4DF5] dark:text-[#608BFF] font-bold">{j.creditAccount}</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="font-black text-sm text-[#0F172A] dark:text-white tabular-nums">
                        {formatRial(j.amountRial)}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        معادل {formatToman(j.amountRial)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SubscriptionGuard>
      )}

      {/* TAB 4: VAT 10% & SEASONAL ARTICLE 169 REPORT (ADVANCED ACCOUNTING) */}
      {subTab === 'vat169' && (
        <SubscriptionGuard
          plan={plan}
          trialStatus={trialStatus}
          featureTitle="گزارش فصلی ماده ۱۶۹ مکرر و ارزش افزوده ۱۰٪ (حسابداری پیشرفته)"
          featureDescription="محاسبه خودکار مالیات ابرازی ارزش افزوده، کسر اعتبارات خرید رسمی و تولید فایل اکسل استاندارد معاملات فصلی ماده ۱۶۹ جهت ارسال به سامانه مودیان نیازمند اشتراک حرفه‌ای است."
          onOpenUpgrade={onOpenUpgrade}
        >
          <div className="space-y-4">
            <div className="paper-card p-6 rounded-[32px] space-y-5">
              <div className="flex flex-col justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[#0F172A] dark:text-white">
                    کاربرگ اظهارنامه مالیات بر ارزش افزوده (۱۰٪ مصوب ۱۴۰۵) و معاملات فصلی ماده ۱۶۹
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    محاسبه خودکار مالیات ابرازی فروش پس از کسر اعتبار مالیاتی خریدهای رسمی ثبت‌شده در سامانه مودیان
                  </p>
                </div>
                <button
                  onClick={handleExport169Csv}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-black flex items-center gap-2 transition-colors shrink-0 shadow-lg shadow-indigo-950/15"
                >
                  <Download className="w-4 h-4" />
                  <span>خروجی اکسل معاملات فصلی ماده ۱۶۹</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="p-5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">۱. مالیات ارزش افزوده دریافتی (فروش)</div>
                  <div className="text-xl font-black text-[#0F172A] dark:text-white tabular-nums mt-1.5">
                    {formatRial(vatSummary.outputVat)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    از ماخذ فروش خالص: {formatRial(vatSummary.totalSalesSub)}
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/40">
                  <div className="text-xs font-bold text-emerald-700/80 dark:text-emerald-300/80">۲. اعتبار مالیاتی ارزش افزوده (خرید رسمی)</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1.5">
                    {formatRial(vatSummary.inputVatCredit)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    از ماخذ خرید خالص: {formatRial(vatSummary.totalPurchaseSub)}
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    ۳. خالص مالیات ارزش افزوده قابل پرداخت دوره
                  </div>
                  <div className="text-xl font-black text-amber-600 dark:text-[#608BFF] tabular-nums mt-1.5">
                    {formatRial(vatSummary.netPayableVat)}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 tabular-nums font-bold">
                    معادل {formatToman(vatSummary.netPayableVat)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SubscriptionGuard>
      )}

      {/* TAB 5: PARTNERS & INVENTORY CATALOG */}
      {subTab === 'catalog' && (
        <div className="grid grid-cols-1 gap-4">
          {/* Partners Column */}
          <div className="paper-card p-5 rounded-[28px] space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>پرونده طرف‌حساب‌ها (مشتریان و تأمین‌کنندگان)</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPartnerName.trim()) return;
                onAddPartner({
                  id: `prt-${Date.now()}`,
                  name: newPartnerName.trim(),
                  role: 'customer',
                  nationalId: toFaDigits(newPartnerNatId.trim() || '۱۰۱۰۹۹۸۸۷۷۶'),
                  economicCode: '۴۱۱۸۸۹۹۰۰۱۱۲',
                  phone: '۰۲۱-۸۸۰۰۰۰۰۰',
                  postalCode: '۱۵۱۱۱۲۲۲۳۳',
                  balanceRial: 0,
                });
                setNewPartnerName('');
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end"
            >
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1">
                  نام طرف‌حساب جدید
                </label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="مثلاً شرکت البرز سیستم..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>
              <FaDigitsInput
                label="شناسه ملی / کد ملی"
                value={newPartnerNatId}
                onChange={setNewPartnerNatId}
                maxLength={11}
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2.5 rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
              >
                افزودن طرف‌حساب
              </button>
            </form>
            <div className="space-y-2.5">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-[#0F172A] dark:text-white">{p.name}</div>
                    <div className="text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      شناسه ملی: {toFaDigits(p.nationalId)} · کد اقتصادی: {toFaDigits(p.economicCode)}
                    </div>
                  </div>
                  <div className="text-left tabular-nums font-extrabold">
                    {p.balanceRial > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        بدهکار: {formatToman(p.balanceRial)}
                      </span>
                    ) : p.balanceRial < 0 ? (
                      <span className="text-rose-500">
                        بستانکار: {formatToman(Math.abs(p.balanceRial))}
                      </span>
                    ) : (
                      <span className="text-slate-400">تسویه (۰ ریال)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inventory & Moadian Items Column */}
          <div className="paper-card p-5 rounded-[28px] space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>کالا و خدمات (با شناسه ۱۳ رقمی سامانه مودیان)</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItemName.trim()) return;
                onAddItem({
                  id: `itm-${Date.now()}`,
                  code: `کد-${toFaDigits(100 + items.length + 1)}`,
                  moadianId: '۲۹۰۱۲۳۴۵۶۷۸۹۹',
                  name: newItemName.trim(),
                  category: 'خدمات',
                  unit: 'مورد',
                  stock: 50,
                  minStock: 5,
                  priceRial: newItemPrice || 120_000_000,
                  vatRate: 10,
                });
                setNewItemName('');
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end"
            >
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-300 mb-1">
                  عنوان کالا یا خدمت
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="عنوان کالا یا خدمت..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>
              <FaNumberInput
                label="بهای واحد (ریال)"
                value={newItemPrice}
                onChange={setNewItemPrice}
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2.5 rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
              >
                ثبت کالا/خدمت
              </button>
            </form>
            <div className="space-y-2.5">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="p-4 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-[#0F172A] dark:text-white">{it.name}</div>
                    <div className="text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                      شناسه مودیان: {toFaDigits(it.moadianId)} · موجودی: {formatFaNum(it.stock)} {it.unit}
                    </div>
                  </div>
                  <div className="text-left font-black text-[#0F172A] dark:text-[#608BFF] tabular-nums">
                    <div>{formatToman(it.priceRial)}</div>
                    <div className="text-[10px] text-slate-400">{formatRial(it.priceRial)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: DAILY EXPENSES (QMM 147/148 TAX VALIDATION) */}
      {subTab === 'expenses' && (
        <div className="space-y-4">
          <div className="paper-card p-4 rounded-[28px] space-y-3.5">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
              <span>ثبت هزینه جدید با اعتبارسنجی مالیاتی (مواد ۱۴۷ و ۱۴۸ ق.م.م)</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!expTitle.trim() || expAmount <= 0) return;
                const acc = accounts.find((a) => a.id === expAccountId) || accounts[0];
                const newExp: ExpenseRecord = {
                  id: `exp-${Date.now()}`,
                  dateJalali: expDate,
                  title: expTitle.trim(),
                  category: expCategory,
                  amountRial: expAmount,
                  accountId: acc?.id || 'acc-cash',
                  accountName: acc?.name || 'صندوق',
                  taxStatus: expTaxStatus,
                  projectName: expProjectName,
                };
                const jr: JournalEntry = {
                  id: `jr-${Date.now()}`,
                  docNumber: 100 + journal.length + 1,
                  dateJalali: expDate,
                  description: `ثبت هزینه: ${newExp.title} (${expCategory})`,
                  debitAccount: `۵۲۰۱ - ${expCategory}`,
                  creditAccount: `۱۰۱۰ - ${acc?.name || 'صندوق/بانک'}`,
                  amountRial: expAmount,
                  refType: 'expense',
                };
                onAddExpense?.(newExp, jr);
                setExpTitle('');
                showToast('هزینه ثبت و سند حسابداری دوطرفه به‌طور خودکار صادر شد.');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شرح هزینه
                </label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="مثلاً خرید ملزومات فنی، هزینه اینترنت، حق‌الزحمه..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    سرفصل هزینه
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  >
                    <option value="هزینه‌های اداری و جاری">هزینه‌های اداری و جاری</option>
                    <option value="اجاره و تأسیسات">اجاره و تأسیسات</option>
                    <option value="زیرساخت و نرم‌افزار">زیرساخت و نرم‌افزار</option>
                    <option value="تبلیغات و بازاریابی">تبلیغات و بازاریابی</option>
                    <option value="حمل‌ونقل و ایاب‌وذهاب">حمل‌ونقل و ایاب‌وذهاب</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    وضعیت مدرک مالیاتی
                  </label>
                  <select
                    value={expTaxStatus}
                    onChange={(e) => setExpTaxStatus(e.target.value as ExpenseTaxStatus)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  >
                    <option value="valid">معتبر (فاکتور رسمی مودیان)</option>
                    <option value="incomplete">ناقص (نیازمند تکمیل سند)</option>
                    <option value="invalid">فاقد اعتبار مالیاتی</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    پرداخت از حساب
                  </label>
                  <select
                    value={expAccountId}
                    onChange={(e) => setExpAccountId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    مرکز هزینه / پروژه
                  </label>
                  <select
                    value={expProjectName}
                    onChange={(e) => setExpProjectName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  >
                    <option value="هزینه عمومی دفتر">هزینه عمومی دفتر</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <JalaliDatePicker label="تاریخ هزینه" value={expDate} onChange={setExpDate} />
              <FaNumberInput
                label="مبلغ هزینه (ریال)"
                value={expAmount}
                onChange={setExpAmount}
                showTomanHint
                quickChips={[
                  { label: '۵ میلیون ت', value: 50_000_000 },
                  { label: '۲۵ میلیون ت', value: 250_000_000 },
                ]}
              />
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
              >
                ثبت هزینه و کسر خودکار از موجودی حساب
              </button>
            </form>
          </div>

          <div className="space-y-2.5">
            {filteredExpenses.length === 0 ? (
              <div className="paper-card p-6 rounded-[24px] text-center space-y-2.5">
                <div className="text-xs font-black text-[#0F172A] dark:text-white">
                  در بازه زمانی انتخاب‌شده هزینه‌ای ثبت نشده است
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  className="px-4 py-2 rounded-full bg-[#1D4DF5] text-white text-xs font-extrabold"
                >
                  نمایش همه هزینه‌ها
                </button>
              </div>
            ) : (
              filteredExpenses.map((ex) => (
                <div key={ex.id} className="paper-card p-4 rounded-[24px] space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-[#0F172A] dark:text-white">{ex.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ex.category} · {ex.accountName} · {toFaDigits(ex.dateJalali)}
                      </div>
                    </div>
                    <div className="text-left tabular-nums shrink-0">
                      <div className="font-black text-rose-600 dark:text-rose-400">{formatToman(ex.amountRial)}</div>
                      <div className="text-[10px] text-slate-400">{formatRial(ex.amountRial)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-500">{ex.projectName || 'عمومی'}</span>
                    <span
                      className={`font-extrabold flex items-center gap-1 ${
                        ex.taxStatus === 'valid'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ex.taxStatus === 'incomplete'
                          ? 'text-amber-600 dark:text-[#608BFF]'
                          : 'text-rose-500'
                      }`}
                    >
                      {ex.taxStatus === 'valid' ? (
                        <>
                          <BadgeCheck className="w-3.5 h-3.5" />
                          مورد قبول ممیز مالیاتی
                        </>
                      ) : ex.taxStatus === 'incomplete' ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          مدرک ناقص
                        </>
                      ) : (
                        'غیرقابل قبول مالیاتی'
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: BANK ACCOUNTS, CASH & PETTY CASH (تنخواه‌گردان و دریافت/پرداخت) */}
      {subTab === 'accounts' && (
        <div className="space-y-4">
          {/* Bank & Cash Cards */}
          <div className="paper-card p-4 rounded-[28px] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>بانک‌ها و صندوق‌های نقدی</span>
              </h3>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                جمع: {formatToman(accounts.reduce((s, a) => s + a.balanceRial, 0))}
              </span>
            </div>

            <div className="space-y-2.5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-black text-[#0F172A] dark:text-white truncate">{acc.name}</div>
                    {acc.shebaOrCard && (
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {toFaDigits(acc.shebaOrCard)}
                      </div>
                    )}
                  </div>
                  <div className="text-left shrink-0 tabular-nums">
                    <div className="font-black text-[#1D4DF5] dark:text-[#608BFF]">{formatToman(acc.balanceRial)}</div>
                    <div className="text-[10px] text-slate-400">{formatRial(acc.balanceRial)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Bank Account Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newBankName.trim()) return;
                onAddBankAccount?.({
                  id: `acc-${Date.now()}`,
                  name: newBankName.trim(),
                  kind: 'bank',
                  balanceRial: newBankInitial,
                });
                setNewBankName('');
                showToast('حساب بانکی جدید به سیستم اضافه شد.');
              }}
              className="grid grid-cols-1 gap-2 pt-2 border-t border-violet-100 dark:border-violet-800/40"
            >
              <input
                type="text"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder="افزودن حساب بانکی یا صندوق جدید (مثلاً بانک پاسارگاد)..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <div className="grid grid-cols-2 gap-2 items-end">
                <FaNumberInput label="موجودی اولیه (ریال)" value={newBankInitial} onChange={setNewBankInitial} />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
                >
                  افزودن حساب
                </button>
              </div>
            </form>
          </div>

          {/* Direct Receipt / Payment Voucher */}
          <div className="paper-card p-4 rounded-[28px] space-y-3">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-emerald-500" />
              <span>ثبت سریع دریافت و پرداخت نقدی / حواله</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (txAmount <= 0) return;
                const acc = accounts.find((a) => a.id === txAccountId) || accounts[0];
                const delta = txKind === 'receipt' ? txAmount : -txAmount;
                const jr: JournalEntry = {
                  id: `jr-${Date.now()}`,
                  docNumber: 100 + journal.length + 1,
                  dateJalali: '۱۴۰۵/۰۸/۱۱',
                  description: `${txKind === 'receipt' ? 'دریافت نقد/حواله' : 'پرداخت نقد/حواله'}${txDesc ? `: ${txDesc}` : ''} (${acc?.name || ''})`,
                  debitAccount: txKind === 'receipt' ? `۱۰۱۰ - ${acc?.name}` : '۲۰۱۰ - حساب‌ها و اسناد پرداختنی',
                  creditAccount: txKind === 'receipt' ? '۱۰۳۰ - حساب‌های دریافتنی تجاری' : `۱۰۱۰ - ${acc?.name}`,
                  amountRial: txAmount,
                  refType: 'invoice',
                };
                onAdjustAccountBalance?.(acc.id, delta, jr);
                setTxDesc('');
                showToast('تراکنش دریافت/پرداخت ثبت و مانده حساب به‌روزرسانی شد.');
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxKind('receipt')}
                  className={`min-h-[40px] rounded-xl text-xs font-black border ${
                    txKind === 'receipt'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-violet-800 text-slate-500'
                  }`}
                >
                  دریافت به حساب (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTxKind('payment')}
                  className={`min-h-[40px] rounded-xl text-xs font-black border ${
                    txKind === 'payment'
                      ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                      : 'border-slate-200 dark:border-violet-800 text-slate-500'
                  }`}
                >
                  پرداخت از حساب (−)
                </button>
              </div>
              <select
                value={txAccountId}
                onChange={(e) => setTxAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatToman(a.balanceRial)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                placeholder="بابت تسویه فاکتور، واریز مشتری یا پرداخت پیمانکار..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <FaNumberInput label="مبلغ تراکنش (ریال)" value={txAmount} onChange={setTxAmount} showTomanHint />
              <button
                type="submit"
                className="w-full min-h-[42px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
              >
                ثبت تراکنش و صدور سند روزنامه
              </button>
            </form>
          </div>

          {/* Petty Cash Funds (تنخواه‌گردان) */}
          <div className="paper-card p-4 rounded-[28px] space-y-3">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              <span>مدیریت تنخواه‌گردان (شارژ، هزینه‌کرد، تسویه)</span>
            </h3>
            <div className="space-y-2">
              {pettyCash.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-black text-[#0F172A] dark:text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      تنخواه‌دار: {p.custodian} · {p.status === 'open' ? 'فعال' : 'تسویه‌شده'}
                    </div>
                  </div>
                  <div className="font-black text-amber-600 dark:text-[#608BFF] tabular-nums shrink-0">
                    {formatToman(p.balanceRial)}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pettyAmount <= 0) return;
                const fund = pettyCash.find((f) => f.id === selectedPettyId) || pettyCash[0];
                const jr: JournalEntry = {
                  id: `jr-${Date.now()}`,
                  docNumber: 100 + journal.length + 1,
                  dateJalali: '۱۴۰۵/۰۸/۱۱',
                  description: `عملیات تنخواه‌گردان (${pettyKind === 'charge' ? 'شارژ' : pettyKind === 'spend' ? 'هزینه‌کرد' : 'تسویه'}): ${fund?.name}${pettyNote ? ` — ${pettyNote}` : ''}`,
                  debitAccount: pettyKind === 'charge' ? '۱۰۲۰ - تنخواه‌گردان' : pettyKind === 'spend' ? '۵۲۰۱ - هزینه‌های عمومی' : '۱۰۱۰ - موجودی بانک و نقد',
                  creditAccount: pettyKind === 'charge' ? '۱۰۱۰ - موجودی بانک و نقد' : '۱۰۲۰ - تنخواه‌گردان',
                  amountRial: pettyAmount,
                  refType: 'expense',
                };
                onPettyOperation?.(fund.id, pettyKind, pettyAmount, jr);
                setPettyNote('');
                showToast('عملیات تنخواه با سند دوطرفه ثبت شد.');
              }}
              className="space-y-2.5 pt-2 border-t border-violet-100 dark:border-violet-800/40"
            >
              <select
                value={selectedPettyId}
                onChange={(e) => setSelectedPettyId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              >
                {pettyCash.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatToman(p.balanceRial)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'charge', label: 'شارژ تنخواه' },
                  { id: 'spend', label: 'هزینه‌کرد' },
                  { id: 'settle', label: 'تسویه تنخواه' },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setPettyKind(op.id as typeof pettyKind)}
                    className={`min-h-[38px] rounded-xl text-[11px] font-black border ${
                      pettyKind === op.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-violet-800 text-slate-500'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={pettyNote}
                onChange={(e) => setPettyNote(e.target.value)}
                placeholder="توضیحات سند تنخواه..."
                className="w-full px-3.5 py-2 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
              />
              <FaNumberInput label="مبلغ عملیات تنخواه (ریال)" value={pettyAmount} onChange={setPettyAmount} showTomanHint />
              <button
                type="submit"
                className="w-full min-h-[42px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white text-xs font-black"
              >
                اجرای عملیات تنخواه‌گردان
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB: PROJECTS & FIXED ASSETS */}
      {subTab === 'projects_assets' && (
        <SubscriptionGuard
          plan={plan}
          trialStatus={trialStatus}
          featureTitle="پروژه‌ها، مراکز هزینه و دارایی‌های ثابت"
          featureDescription="تحلیل سودآوری پروژه‌ها و محاسبه خودکار استهلاک سالانه دارایی‌های ثابت شرکت ویژه اشتراک فعال است."
          onOpenUpgrade={onOpenUpgrade}
        >
          <div className="space-y-4">
            {/* Projects Card */}
            <div className="paper-card p-4 rounded-[28px] space-y-3">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>پروژه‌ها و مراکز درآمد / هزینه</span>
              </h3>
              <div className="space-y-2.5">
                {projects.map((pr) => {
                  const profit = pr.revenueRial - pr.costRial;
                  return (
                    <div
                      key={pr.id}
                      className="p-3.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-black text-[#0F172A] dark:text-white">
                            {pr.code} — {pr.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{pr.clientName}</div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                          {pr.status === 'active' ? 'در حال اجرا' : 'تکمیل‌شده'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] tabular-nums">
                        <div>
                          <div className="text-slate-400">درآمد:</div>
                          <div className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatToman(pr.revenueRial)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">هزینه:</div>
                          <div className="font-extrabold text-rose-500">{formatToman(pr.costRial)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">سود پروژه:</div>
                          <div className="font-black text-[#0F172A] dark:text-[#608BFF]">{formatToman(profit)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPrjName.trim()) return;
                  onAddProject?.({
                    id: `prj-${Date.now()}`,
                    code: `PRJ-${toFaDigits(100 + projects.length + 1)}`,
                    name: newPrjName.trim(),
                    clientName: newPrjClient.trim() || 'کارفرمای جدید',
                    budgetRial: newPrjBudget,
                    revenueRial: 0,
                    costRial: 0,
                    status: 'active',
                  });
                  setNewPrjName('');
                  setNewPrjClient('');
                  showToast('پروژه / مرکز هزینه جدید تعریف شد.');
                }}
                className="space-y-2 pt-2 border-t border-violet-100 dark:border-violet-800/40"
              >
                <input
                  type="text"
                  value={newPrjName}
                  onChange={(e) => setNewPrjName(e.target.value)}
                  placeholder="عنوان پروژه یا مرکز هزینه جدید..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                />
                <input
                  type="text"
                  value={newPrjClient}
                  onChange={(e) => setNewPrjClient(e.target.value)}
                  placeholder="نام کارفرما / مشتری..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                />
                <FaNumberInput label="بودجه برآوردی (ریال)" value={newPrjBudget} onChange={setNewPrjBudget} />
                <button
                  type="submit"
                  className="w-full min-h-[42px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
                >
                  افزودن پروژه جدید
                </button>
              </form>
            </div>

            {/* Fixed Assets Card */}
            <div className="paper-card p-4 rounded-[28px] space-y-3">
              <h3 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>دارایی‌های ثابت و محاسبه استهلاک خط مستقیم</span>
              </h3>
              <div className="space-y-2.5">
                {assets.map((ast) => {
                  const annualDep = Math.round(Math.max(0, ast.costRial - ast.salvageRial) / Math.max(1, ast.usefulLifeYears));
                  return (
                    <div
                      key={ast.id}
                      className="p-3.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[#0F172A] dark:text-white">
                          {ast.code} — {ast.name}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">{toFaDigits(ast.purchaseDateJalali)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                        <span>بهای تمام‌شده: {formatToman(ast.costRial)}</span>
                        <span className="font-black text-amber-600 dark:text-[#608BFF]">
                          استهلاک سالانه ({formatFaNum(ast.usefulLifeYears)} سال): {formatToman(annualDep)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newAssetName.trim()) return;
                  onAddAsset?.({
                    id: `ast-${Date.now()}`,
                    code: `AST-${toFaDigits(String(assets.length + 1).padStart(3, '0'))}`,
                    name: newAssetName.trim(),
                    purchaseDateJalali: '۱۴۰۵/۰۸/۱۱',
                    costRial: newAssetCost,
                    salvageRial: Math.round(newAssetCost * 0.1),
                    usefulLifeYears: Math.max(1, newAssetYears),
                  });
                  setNewAssetName('');
                  showToast('دارایی ثابت ثبت و استهلاک سالانه محاسبه شد.');
                }}
                className="space-y-2 pt-2 border-t border-violet-100 dark:border-violet-800/40"
              >
                <input
                  type="text"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  placeholder="نام دارایی ثابت (لپ‌تاپ، خودرو، دستگاه، نرم‌افزار)..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                />
                <div className="grid grid-cols-2 gap-2">
                  <FaNumberInput label="ارزش خرید (ریال)" value={newAssetCost} onChange={setNewAssetCost} />
                  <FaNumberInput label="عمر مفید (سال)" value={newAssetYears} onChange={setNewAssetYears} suffix="سال" min={1} max={30} />
                </div>
                <button
                  type="submit"
                  className="w-full min-h-[42px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
                >
                  ثبت دارایی ثابت
                </button>
              </form>
            </div>
          </div>
        </SubscriptionGuard>
      )}

      {/* NEW INVOICE BOTTOM SHEET / MODAL WITH PERSIAN INPUTS & JALALI CALENDAR */}
      {showNewInvoiceSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4">
          <div className="w-full max-w-2xl rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                صدور صورتحساب الکترونیکی استاندارد مودیان
              </h3>
              <button
                onClick={() => setShowNewInvoiceSheet(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'sale', label: 'فاکتور فروش رسمی' },
                  { id: 'proforma', label: 'پیش‌فاکتور' },
                  { id: 'purchase', label: 'فاکتور خرید (ویژه)' },
                  { id: 'return', label: 'برگشت از فروش' },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setInvType(t.id as OfficialInvoice['type'])}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                      invType === t.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-[#608BFF]'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="md:col-span-1">
                  <JalaliDatePicker
                    label="تاریخ صدور (تقویم شمسی)"
                    value={invDateJalali}
                    onChange={setInvDateJalali}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام خریدار / طرف‌حساب
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <FaDigitsInput
                  label="شناسه ملی / کد اقتصادی"
                  value={partnerNationalId}
                  onChange={(val) => {
                    setPartnerNationalId(val);
                    setPartnerEcoCode(val);
                  }}
                  maxLength={12}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    شرح کالا یا خدمات مورد معامله
                  </label>
                  <input
                    type="text"
                    required
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <FaDigitsInput
                  label="شناسه ۱۳ رقمی کالا/خدمت مودیان"
                  value={itemCommodityCode}
                  onChange={setItemCommodityCode}
                  maxLength={13}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <FaNumberInput
                  label="بهای واحد (ریال — با جداکننده سه‌رقمی)"
                  value={itemUnitPrice}
                  onChange={setItemUnitPrice}
                  showTomanHint
                  quickChips={[
                    { label: '۵۰ میلیون تومان', value: 500_000_000 },
                    { label: '۱۰۰ میلیون تومان', value: 1_000_000_000 },
                  ]}
                />
                <FaNumberInput
                  label="مبلغ تخفیف (ریال)"
                  value={itemDiscount}
                  onChange={setItemDiscount}
                  showTomanHint
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <FaNumberInput
                  label="تعداد / مقدار"
                  value={itemQty}
                  onChange={(v) => setItemQty(Math.max(1, v))}
                  suffix="واحد"
                  min={1}
                />
                <FaNumberInput
                  label="نرخ ارزش افزوده مصوب"
                  value={vatRate}
                  onChange={setVatRate}
                  suffix="درصد (٪)"
                  max={20}
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between font-black text-slate-900 dark:text-white">
                  <span>جمع کل قابل پرداخت (با احتساب ارزش افزوده):</span>
                  <span className="tabular-nums text-amber-600 dark:text-[#608BFF] text-sm">
                    {formatRial(
                      Math.max(0, itemQty * itemUnitPrice - itemDiscount) * (1 + vatRate / 100)
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  به حروف:{' '}
                  {numberToPersianWords(
                    Math.max(0, itemQty * itemUnitPrice - itemDiscount) * (1 + vatRate / 100)
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-sm transition-colors shadow-lg shadow-amber-500/20"
              >
                ثبت نهایی صورتحساب و صدور خودکار سند روزنامه
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW SAYADI CHECK BOTTOM SHEET WITH PERSIAN INPUTS & JALALI CALENDAR */}
      {showNewCheckSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-4">
          <div className="w-full max-w-lg rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                ثبت برگه چک صیادی بنفش ۱۶ رقمی
              </h3>
              <button
                onClick={() => setShowNewCheckSheet(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCheck} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChkType('receivable')}
                  className={`min-h-[42px] rounded-xl text-xs font-extrabold border ${
                    chkType === 'receivable'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  چک دریافتنی (از مشتری)
                </button>
                <button
                  type="button"
                  onClick={() => setChkType('payable')}
                  className={`min-h-[42px] rounded-xl text-xs font-extrabold border ${
                    chkType === 'payable'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-[#608BFF]'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  چک پرداختنی (شرکت)
                </button>
              </div>

              <FaDigitsInput
                label="شناسه صیادی ۱۶ رقمی (تفکیک خودکار ۴ رقمی فارسی)"
                value={chkSayadi}
                onChange={setChkSayadi}
                maxLength={16}
                grouped4
              />

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام صادرکننده / ذینفع
                  </label>
                  <input
                    type="text"
                    required
                    value={chkParty}
                    onChange={(e) => setChkParty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام بانک و شعبه
                  </label>
                  <input
                    type="text"
                    required
                    value={chkBank}
                    onChange={(e) => setChkBank(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <JalaliDatePicker
                label="تاریخ سررسید چک (تقویم شمسی)"
                value={chkDueDate}
                onChange={setChkDueDate}
              />

              <FaNumberInput
                label="مبلغ چک صیادی (ریال — با جداکننده سه‌رقمی)"
                value={chkAmount}
                onChange={setChkAmount}
                showTomanHint
                quickChips={[
                  { label: '۲۰ میلیون تومان', value: 200_000_000 },
                  { label: '۵۰ میلیون تومان', value: 500_000_000 },
                  { label: '۱۰۰ میلیون تومان', value: 1_000_000_000 },
                ]}
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نتیجه استعلام وضعیت رنگ صیادی
                </label>
                <select
                  value={chkColor}
                  onChange={(e) => setChkColor(e.target.value as SayadiCheck['sayadiColor'])}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1222] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="white">وضعیت سفید (بدون سابقه چک برگشتی)</option>
                  <option value="yellow">وضعیت زرد (۱ فقره چک برگشتی)</option>
                  <option value="orange">وضعیت نارنجی (۲ تا ۴ فقره چک برگشتی)</option>
                  <option value="brown">وضعیت قهوه‌ای (۵ تا ۱۰ فقره چک برگشتی)</option>
                  <option value="red">وضعیت قرمز (بیش از ۱۰ فقره / ممنوع‌المعامله)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-2xl bg-[#1D4DF5] hover:bg-[#163ED4] text-white font-black text-sm transition-colors"
              >
                ثبت برگه چک صیادی و درج در رادار سررسید
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL TAX ORGANIZATION PRINT PREVIEW & PDF MODAL */}
      <PrintPreviewPdfModal
        documentData={
          selectedInvoiceForPrint
            ? { kind: 'invoice', invoice: selectedInvoiceForPrint }
            : null
        }
        signatureDataUrl={signatureDataUrl}
        onClose={() => setSelectedInvoiceForPrint(null)}
        onShare={
          selectedInvoiceForPrint
            ? () => handleShareInvoice(selectedInvoiceForPrint)
            : undefined
        }
        onRequestSignaturePad={onNavigateToSignPad}
      />
    </div>
  );
};
