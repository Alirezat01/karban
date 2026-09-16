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
  name: string;
  national_id: string | null;
  shenase_melli: string | null;
  economic_code: string | null;
  registration_number: string | null;
  province: string | null;
  county: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface AccItem {
  id: string;
  business_id: string;
  name: string;
  code: string | null;
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
  initial_balance: number;
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
  moadian_uid: string | null;
  posted_at: string | null;
  reversed_at: string | null;
  created_by: string | null;
  created_at: string;
  partner?: AccPartner | null;
  acc_invoice_items?: AccInvoiceItem[];
}

export interface AccInvoiceItem {
  id: string;
  invoice_id: string;
  business_id: string;
  item_id: string | null;
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
  created_by: string | null;
  created_at: string;
  account?: AccAccount | null;
}

export interface AccTransaction {
  id: string;
  business_id: string;
  kind: 'receipt' | 'payment';
  amount: number;
  date_g: string;
  method: 'cash' | 'transfer' | 'cheque' | 'card' | 'other';
  account_id: string | null;
  invoice_id: string | null;
  partner_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  account?: AccAccount | null;
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
  debit: number;
  credit: number;
  partner_id: string | null;
}

export interface AccChartRow {
  id: string;
  business_id: string | null;
  code: string;
  title: string;
  kind: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  is_system: boolean;
}

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
