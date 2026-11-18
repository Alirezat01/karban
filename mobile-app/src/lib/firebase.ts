import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  PlanType,
  OfficialInvoice,
  SayadiCheck,
  JournalEntry,
  PartnerRecord,
  InventoryItem,
  VaultDocument,
  BankAccountRecord,
  PettyCashFund,
  ExpenseRecord,
  ProjectRecord,
  FixedAssetRecord,
  INITIAL_INVOICES,
  INITIAL_CHECKS,
  INITIAL_JOURNAL,
  INITIAL_PARTNERS,
  INITIAL_ITEMS,
  INITIAL_VAULT_DOCS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_PETTY_CASH,
  INITIAL_EXPENSES,
  INITIAL_PROJECTS,
  INITIAL_FIXED_ASSETS,
} from './karbanData';

export const SUPER_ADMIN_EMAIL = 'gaming.alireza.2024@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<'online' | 'offline'> {
  if (typeof window === 'undefined' || !firebaseConfig.projectId) {
    return 'online';
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'online';
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return 'offline';
    }
    return 'online';
  }
}

export type AccessStatus = 'trial' | 'pending_approval' | 'verified' | 'suspended';

export interface AdminMember {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin';
  status: 'active' | 'pending' | 'revoked';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminRegistrationRequest {
  uid: string;
  email: string;
  displayName: string;
  organizationTitle: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  businessName: string;
  taxId?: string;
  phone?: string;
  plan: PlanType;
  accessStatus: AccessStatus;
  hasSampleData: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserWorkspacePayload {
  ownerId: string;
  invoices: OfficialInvoice[];
  checks: SayadiCheck[];
  journal: JournalEntry[];
  partners: PartnerRecord[];
  items: InventoryItem[];
  vaultDocs: VaultDocument[];
  bankAccounts: BankAccountRecord[];
  pettyCash: PettyCashFund[];
  expenses: ExpenseRecord[];
  projects: ProjectRecord[];
  fixedAssets: FixedAssetRecord[];
  signatureDataUrl: string | null;
  updatedAt?: unknown;
}

export interface PaymentApprovalRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  businessName: string;
  requestedPlan: 'monthly' | 'yearly' | 'founder';
  amountRial: number;
  trackingCode: string;
  bankRef?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string;
  reviewNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function createCleanWorkspace(ownerId: string): Omit<UserWorkspacePayload, 'updatedAt'> {
  return {
    ownerId,
    invoices: [],
    checks: [],
    journal: [],
    partners: [],
    items: [],
    vaultDocs: [],
    bankAccounts: [
      {
        id: 'acc-cash',
        name: 'صندوق نقدی مرکزی کسب‌وکار',
        kind: 'cash',
        balanceRial: 0,
      },
    ],
    pettyCash: [],
    expenses: [],
    projects: [],
    fixedAssets: [],
    signatureDataUrl: null,
  };
}

export function createDemoWorkspace(ownerId: string): Omit<UserWorkspacePayload, 'updatedAt'> {
  return {
    ownerId,
    invoices: INITIAL_INVOICES,
    checks: INITIAL_CHECKS,
    journal: INITIAL_JOURNAL,
    partners: INITIAL_PARTNERS,
    items: INITIAL_ITEMS,
    vaultDocs: INITIAL_VAULT_DOCS,
    bankAccounts: INITIAL_BANK_ACCOUNTS,
    pettyCash: INITIAL_PETTY_CASH,
    expenses: INITIAL_EXPENSES,
    projects: INITIAL_PROJECTS,
    fixedAssets: INITIAL_FIXED_ASSETS,
    signatureDataUrl: null,
  };
}

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}
