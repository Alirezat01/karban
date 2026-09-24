/* تایپ‌های ماژول حسابداری — آینه جداول Supabase */

export type Currency = 'IRR' | 'IRT';
export type PersonType = 'real' | 'legal';
export type PartnerKind = 'customer' | 'supplier' | 'both';
export type ItemKind = 'goods' | 'service';
export type AccountKind = 'cash' | 'bank' | 'card';
export type InvoiceType = 'sale' | 'proforma' | 'purchase' | 'return_sale';
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';
export type AccessRole = 'owner' | 'accountant' | 'viewer';
export type AccessStatus = 'active' | 'trial' | 'suspended';

export interface AccBusiness {
  id: string;
  owner_id: string;
  name: string;
  brand: string | null;
  person_type: PersonType;
  shenase_melli: string | null;
  national_id: string | null;
  economic_code: string | null;
  registration_number: string | null;
  province: string | null;
  county: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
  fax: string | null;
  default_vat_rate: number;
  currency: Currency;
  invoice_prefix: string | null;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  created_at: string;
}

export interface AccAccess {
  id: string;
  business_id: string | null;
  user_id: string | null;
  email: string | null;
  role: AccessRole;
  status: AccessStatus;
  plan: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AccPartner {
  id: string;
  business_id: string;
  kind: PartnerKind;
  person_type: PersonType;
  /** کد یکتای طرف‌حساب — اتمیک از شمارندهٔ دیتابیس (بند ۴ دستور) */
  partner_code: string | null;
  name: string;
  /** نام حقوقی کامل برای اشخاص حقوقی */
  legal_name: string | null;
  national_id: string | null;
  shenase_melli: string | null;
  economic_code: string | null;
  registration_number: string | null;
  province: string | null;
  county: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  /** موبایل جدا از تلفن ثابت */
  mobile: string | null;
  email: string | null;
  fax: string | null;
  address: string | null;
  notes: string | null;
  /** غیرفعال‌سازی به‌جای حذف (بند ۳۰) */
  active: boolean;
  created_at: string;
  updated_at: string;
  /** نقش‌های طرف‌حساب (join از acc_partner_roles) */
  roles?: PartnerRole[];
}

/* نقش‌های طرف‌حساب — یک شخص می‌تواند چند نقش داشته باشد (بند ۵ و ۶) */
export type PartnerRole = 'customer' | 'supplier' | 'shareholder' | 'employee' | 'other';

export const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  customer: 'مشتری',
  supplier: 'تامین‌کننده',
  shareholder: 'شریک / سهامدار',
  employee: 'کارمند',
  other: 'سایر',
};

export interface AccPartnerRole {
  id: string;
  business_id: string;
  partner_id: string;
  role: PartnerRole;
  chart_code: string | null;
  created_at: string;
}

/* مرکز هزینه — Master مستقل (بند ۲۲) */
export interface AccCostCenter {
  id: string;
  business_id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccItem {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
  /** شناسه کالا و خدمات سامانه مودیان (از فایل رسمی مالیات) */
  stuff_id: string | null;
  unit: string;
  category: string | null;
  kind: ItemKind;
  sale_price: number;
  purchase_price: number;
  vat_rate: number;
  vat_exempt: boolean;
  track_stock: boolean;
  stock: number;
  active: boolean;
  created_at: string;
}

export interface AccAccount {
  id: string;
  business_id: string;
  name: string;
  kind: AccountKind;
  account_number: string | null;
  /** شماره شبا (IBAN) — ۲۶ نویسه IR + ۲۴ رقم؛ زیر صورتحساب نمایش داده می‌شود */
  sheba: string | null;
  initial_balance: number;
  /** حساب معین مرتبط در کدینگ (پیش‌فرض 1102 بانک / 1101 صندوق) */
  chart_code: string | null;
  /** تفصیلی اختصاصی همین بانک/صندوق در دفتر بانک */
  detail_id: string | null;
  active: boolean;
  created_at: string;
}

export interface AccInvoice {
  id: string;
  business_id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  partner_id: string | null;
  date_g: string;
  due_date_g: string | null;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  total: number;
  paid_total: number;
  description: string | null;
  payment_terms: string | null;
  is_cash_sale: boolean | null;
  /** نوع خریدار مودیان: business = بنگاه اقتصادی (نوع ۱) | final = مصرف‌کننده نهایی (نوع ۲) */
  buyer_type: 'business' | 'final' | null;
  /** شناسه یکتای پرداخت سامانه مودیان (payId) */
  pay_id: string | null;
  /** حساب بانکی/صندوق مرتبط با تسویه */
  account_id: string | null;
  moadian_uid: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  created_by: string | null;
  created_at: string;
  partner?: AccPartner | null;
  account?: AccAccount | null;
  acc_invoice_items?: AccInvoiceItem[];
}

export interface AccInvoiceItem {
  id: string;
  invoice_id: string;
  business_id: string;
  item_id: string | null;
  /** شناسه کالا و خدمات مودیان */
  stuff_id: string | null;
  title: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  row_total: number;
  position: number;
}

export type ExpenseTaxStatus = 'valid' | 'incomplete' | 'invalid';

export interface AccExpense {
  id: string;
  business_id: string;
  category: string;
  title: string;
  amount: number;
  vat_amount: number;
  date_g: string;
  account_id: string | null;
  partner_id: string | null;
  is_paid: boolean;
  description: string | null;
  /** فروشنده / محل خرج */
  vendor_name: string | null;
  /** شماره فاکتور / سند هزینه */
  receipt_no: string | null;
  /** پیوست سند (عکس فاکتور/رسید) در storage */
  receipt_url: string | null;
  /** اعتبار مالیاتی: valid قابل قبول | incomplete نیازمند تکمیل سند | invalid بدون سند */
  tax_status: ExpenseTaxStatus;
  tax_note: string | null;
  /** پروژه مرتبط (نسخه ۶) */
  project_id: string | null;
  /** حساب معین هزینه —mapping دیتابیسی به کدینگ (بند ۲۰) */
  expense_account_id: string | null;
  /** تفصیلی سطر هزینه (تامین‌کننده/شریک/…) */
  detail_id: string | null;
  /** چه کسی هزینه را پرداخت کرده (بند ۵ و ۱۳ دستور):
      company | partner | employee | shareholder | other_person | unpaid */
  paid_by_kind: string | null;
  /** تفصیلی شخص پرداخت‌کننده — الزامی وقتی paid_by_kind شخصی است */
  paid_by_detail_id: string | null;
  /** مرکز هزینه (بند ۲۲) */
  cost_center_id: string | null;
  created_by: string | null;
  created_at: string;
  /** ابطال (نسخه ۷): زمان و دلیل باطل‌شدن سند — حذف کامل از سیستم انجام نمی‌شود */
  voided_at: string | null;
  void_reason: string | null;
  account?: AccAccount | null;
  expense_account?: AccChartRow | null;
  detail?: { id: string; title: string; detail_code: string | null } | null;
  /** شخص پرداخت‌کننده (embed از acc_details بر paid_by_detail_id) */
  paid_by_detail?: { id: string; title: string } | null;
  cost_center?: AccCostCenter | null;
}

export interface AccTransaction {
  id: string;
  business_id: string;
  /** kind=transfer: انتقال بین بانک/صندوق — بدون درآمد/هزینه (بند ۲۸) */
  kind: 'receipt' | 'payment' | 'transfer';
  amount: number;
  date_g: string;
  method: 'cash' | 'transfer' | 'cheque' | 'card' | 'other';
  account_id: string | null;
  /** حساب مقصد برای انتقال (بند ۲۸) */
  to_account_id: string | null;
  invoice_id: string | null;
  partner_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  /** ابطال (نسخه ۷): زمان و دلیل باطل‌شدن سند */
  voided_at: string | null;
  void_reason: string | null;
  account?: AccAccount | null;
  to_account?: AccAccount | null;
  partner?: AccPartner | null;
  invoice?: { id: string; number: string; type: InvoiceType } | null;
}

export interface AccJournalEntry {
  id: string;
  business_id: string;
  entry_no: number;
  date_g: string;
  ref_type: 'invoice' | 'expense' | 'transaction' | 'opening' | 'manual';
  ref_action: 'post' | 'reverse';
  ref_id: string | null;
  description: string | null;
  created_at: string;
  acc_journal_lines?: AccJournalLine[];
}

export interface AccJournalLine {
  id: string;
  entry_id: string;
  business_id: string;
  account_code: string;
  account_title: string;
  /** اتصال مستقیم به سطر کدینگ (بند ۶۲) */
  account_id: string | null;
  debit: number;
  credit: number;
  partner_id: string | null;
  detail_id: string | null;
  cost_center_id: string | null;
  project_id: string | null;
  line_desc: string | null;
  detail?: { id: string; title: string; kind: string; detail_code: string | null } | null;
  cost_center?: { id: string; name: string; code: string } | null;
  project?: { id: string; name: string } | null;
}

export interface AccChartRow {
  id: string;
  business_id: string | null;
  code: string;
  title: string;
  kind: AccChartKind;
  is_system: boolean;
  /** سطح درخت کدینگ: 1=گروه، 2=کل، 3=معین، 4=تفصیلی موضعی */
  level: number | null;
  parent_id: string | null;
  is_leaf: boolean | null;
  nature: 'debit' | 'credit' | null;
  active: boolean | null;
  /** این حساب بدون تفصیلی Post نمی‌شود (بند ۲۵) */
  requires_detail: boolean | null;
  /** انواع تفصیلی مجاز برای این حساب */
  allowed_detail_types: string[] | null;
}

export type AccChartKind = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface TrialBalanceRow {
  code: string;
  title: string;
  kind: AccChartRow['kind'];
  debit: number;
  credit: number;
  balance: number;
}

export interface PlRow {
  code: string;
  title: string;
  amount: number;
}

export interface ProfitAndLoss {
  revenues: PlRow[];
  totalRevenue: number;
  expenses: PlRow[];
  totalExpense: number;
  netProfit: number;
}

export interface VatReport {
  salesBase: number;
  salesVat: number;
  purchasesBase: number;
  purchasesVat: number;
  expensesVat: number;
  totalCredit: number;
  payable: number;
  saleRows: { number: string; date: string; partner: string; base: number; vat: number }[];
  purchaseRows: { number: string; date: string; partner: string; base: number; vat: number }[];
}

/* شناسه کالا و خدمات — ردیف کاتالوگ رسمی مالیات */
export interface AccStuffCatalogRow {
  id: string;
  description: string;
  type_name: string | null;
  vat: number | null;
  taxable: boolean | null;
  is_general: boolean | null;
  shamsi_date: string | null;
}

/* ───────────────── نسخه ۵: دسته‌بندی قابل ویرایش هزینه‌ها ───────────────── */
export interface AccExpenseCategory {
  id: string;
  business_id: string;
  title: string;
  code: string | null;
  position: number;
  created_at: string;
}

/* گزارش سود محصولات — فروش منهای بهای تمام‌شده */
export interface ProductProfitRow {
  key: string;
  item_id: string | null;
  title: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

/* ───────────────── نسخه ۴: چک‌ها ───────────────── */
export type CheckKind = 'received' | 'issued';
export type CheckStatus = 'in_hand' | 'deposited' | 'cleared' | 'bounced' | 'returned' | 'canceled';

export const CHECK_KINDS: Record<CheckKind, string> = {
  received: 'چک دریافتی',
  issued: 'چک پرداختی',
};

export interface AccCheck {
  id: string;
  business_id: string;
  kind: CheckKind;
  partner_id: string | null;
  account_id: string | null;
  invoice_id: string | null;
  amount: number;
  serial_no: string | null;
  bank_name: string | null;
  branch: string | null;
  issue_date_g: string | null;
  due_date_g: string;
  status: CheckStatus;
  description: string | null;
  created_by: string | null;
  created_at: string;
  partner?: AccPartner | null;
  account?: AccAccount | null;
}

/* مانده و گردش یک طرف‌حساب (صورت‌حساب) */
export interface PartnerStatement {
  partner: AccPartner;
  invoices: AccInvoice[];
  transactions: AccTransaction[];
  totalInvoiced: number;
  totalSettled: number;
  balance: number;
  agingBuckets: { label: string; amount: number }[];
}

/* ───────────────── نسخه ۶: پروژه، قرارداد، حقوق، دارایی، تکرارشونده، دوره، مغایرت، لاگ ───────────────── */

export type ProjectStatus = 'active' | 'done' | 'archived';
export interface AccProject {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
  partner_id: string | null;
  status: ProjectStatus;
  budget: number;
  start_date_g: string | null;
  end_date_g: string | null;
  description: string | null;
  created_at: string;
  partner?: AccPartner | null;
}

export type ContractStatus = 'draft' | 'signed' | 'active' | 'done' | 'canceled';
export interface AccContract {
  id: string;
  business_id: string;
  title: string;
  partner_id: string | null;
  project_id: string | null;
  amount: number;
  vat_rate: number;
  status: ContractStatus;
  start_date_g: string | null;
  end_date_g: string | null;
  description: string | null;
  created_at: string;
  partner?: AccPartner | null;
}

export interface AccEmployee {
  id: string;
  business_id: string;
  name: string;
  national_id: string | null;
  personnel_code: string | null;
  position: string | null;
  hire_date_g: string | null;
  base_salary: number;
  housing_allowance: number;
  food_allowance: number;
  child_allowance: number;
  child_count: number;
  insurance_number: string | null;
  bank_account: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface AccPayroll {
  id: string;
  business_id: string;
  employee_id: string;
  jyear: number;
  jmonth: number;
  work_days: number;
  overtime_hours: number;
  base_salary: number;
  food_allowance: number;
  housing_allowance: number;
  family_allowance: number;
  overtime_pay: number;
  gross: number;
  insurance_employee: number;
  tax: number;
  other_deductions: number;
  net: number;
  paid: boolean;
  account_id: string | null;
  pay_date_g: string | null;
  description: string | null;
  created_at: string;
  employee?: AccEmployee | null;
}

export type AssetStatus = 'active' | 'sold' | 'disposed';
export interface AccAsset {
  id: string;
  business_id: string;
  name: string;
  category: string | null;
  purchase_date_g: string | null;
  purchase_amount: number;
  useful_life_years: number;
  salvage_value: number;
  account_id: string | null;
  status: AssetStatus;
  sell_amount: number | null;
  sell_date_g: string | null;
  notes: string | null;
  created_at: string;
}

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';
export interface AccRecurring {
  id: string;
  business_id: string;
  title: string;
  category: string | null;
  amount: number;
  vat_amount: number;
  frequency: RecurringFrequency;
  next_date_g: string;
  account_id: string | null;
  partner_id: string | null;
  auto_create: boolean;
  active: boolean;
  last_created_date_g: string | null;
  description: string | null;
  created_at: string;
  account?: AccAccount | null;
}

export interface AccPeriod {
  id: string;
  business_id: string;
  jyear: number;
  jmonth: number;
  locked: boolean;
  locked_at: string | null;
}

export interface AccReconciliation {
  id: string;
  business_id: string;
  account_id: string;
  statement_date_g: string;
  statement_balance: number;
  book_balance: number;
  difference: number;
  reconciled: boolean;
  notes: string | null;
  created_at: string;
  account?: AccAccount | null;
}

export interface AccActivityRow {
  id: string;
  business_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
}

/* ترازنامه ساده */
export interface BalanceSheet {
  assets: PlRow[];
  totalAssets: number;
  liabilities: PlRow[];
  totalLiabilities: number;
  equity: PlRow[];
  totalEquity: number;
}

/* نتیجه محاسبه حقوق یک کارمند */
export interface PayrollCalc {
  hourly: number;
  overtimePay: number;
  gross: number;
  insurance: number;
  tax: number;
  net: number;
  employerInsurance: number;
}

/* نتیجه مغایرت‌گیری یک حساب */
export interface ReconcileResult {
  bookBalance: number;
  statementBalance: number;
  difference: number;
}
