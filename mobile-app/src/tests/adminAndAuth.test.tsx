import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SUPER_ADMIN_EMAIL } from '../lib/firebase';

const mockState = vi.hoisted(() => {
  const setDoc = vi.fn().mockResolvedValue(undefined);
  const updateDoc = vi.fn().mockResolvedValue(undefined);
  const getDoc = vi.fn().mockResolvedValue({ exists: () => false, data: () => null });
  const batchUpdate = vi.fn();
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  const writeBatch = vi.fn(() => ({
    update: batchUpdate,
    set: batchSet,
    commit: batchCommit,
  }));
  const signInWithPopup = vi.fn();
  const signOut = vi.fn().mockResolvedValue(undefined);

  return {
    currentUser: null as null | {
      uid: string;
      email: string;
      emailVerified: boolean;
      displayName: string;
      providerData: unknown[];
    },
    collections: {
      payment_requests: [] as Record<string, unknown>[],
      users: [] as Record<string, unknown>[],
      admins: [] as Record<string, unknown>[],
      admin_requests: [] as Record<string, unknown>[],
    },
    setDoc,
    updateDoc,
    getDoc,
    batchUpdate,
    batchSet,
    batchCommit,
    writeBatch,
    signInWithPopup,
    signOut,
  };
});

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    setCustomParameters = vi.fn();
  }
  return {
    GoogleAuthProvider,
    getAuth: vi.fn(() => ({
      get currentUser() {
        return mockState.currentUser;
      },
    })),
    onAuthStateChanged: vi.fn((_auth, cb: (user: unknown) => void) => {
      cb(mockState.currentUser);
      return () => {};
    }),
    signInWithPopup: mockState.signInWithPopup,
    signOut: mockState.signOut,
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ __mockDb: true })),
  getDocFromServer: vi.fn().mockResolvedValue({ exists: () => false }),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  collection: vi.fn((_db, name: string) => ({ __path: name, __isCollection: true })),
  query: vi.fn((colRef: { __path: string }) => ({ __path: colRef.__path, __isQuery: true })),
  orderBy: vi.fn(() => ({})),
  doc: vi.fn((_db, ...segments: string[]) => ({
    __path: segments.join('/'),
    __collection: segments[0],
    __id: segments[segments.length - 1],
  })),
  setDoc: mockState.setDoc,
  updateDoc: mockState.updateDoc,
  getDoc: mockState.getDoc,
  writeBatch: mockState.writeBatch,
  onSnapshot: vi.fn((target: { __path?: string; __isQuery?: boolean; __isCollection?: boolean }, onNext: (snap: unknown) => void) => {
    const path = target?.__path || '';
    if (path === 'payment_requests' || path === 'users' || path === 'admins' || path === 'admin_requests') {
      const rows = mockState.collections[path as keyof typeof mockState.collections] || [];
      onNext({
        docs: rows.map((row) => ({ data: () => row })),
      });
    } else if (path.startsWith('admins/') && mockState.currentUser?.email === SUPER_ADMIN_EMAIL) {
      onNext({
        exists: () => true,
        data: () => ({
          uid: mockState.currentUser!.uid,
          email: SUPER_ADMIN_EMAIL,
          displayName: 'مدیرکل کاربان',
          role: 'super_admin',
          status: 'active',
        }),
      });
    } else {
      onNext({ exists: () => false, data: () => null, docs: [] });
    }
    return () => {};
  }),
}));

import { AdminRegistryView } from '../components/AdminRegistryView';
import { CustomerAuthModal } from '../components/CustomerAuthModal';
import { SubscriptionModal } from '../components/SubscriptionModal';

describe('AdminRegistryView, CustomerAuthModal & Payment Approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockState.currentUser = null;
    mockState.collections.payment_requests = [];
    mockState.collections.users = [];
    mockState.collections.admins = [];
    mockState.collections.admin_requests = [];
  });

  it('امکان جابه‌جایی بین فرم ورود مدیران و ثبت‌نام ادمین جدید و ارسال درخواست ادمین را فراهم می‌کند', async () => {
    const newAdminCandidate = {
      uid: 'candidate-admin-1',
      email: 'ops.admin@karbanapp.ir',
      emailVerified: true,
      displayName: 'مریم رضایی',
      providerData: [],
    };
    mockState.signInWithPopup.mockResolvedValue({ user: newAdminCandidate });

    render(<AdminRegistryView onBackToApp={() => {}} />);

    expect(screen.getByTestId('admin-login-panel')).toBeTruthy();

    fireEvent.click(screen.getByTestId('admin-flow-register-tab'));
    const form = screen.getByTestId('admin-register-form');
    expect(form).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('مثلاً علیرضا طاهری'), {
      target: { value: 'مریم رضایی' },
    });
    fireEvent.change(screen.getByPlaceholderText('مثلاً کارشناس پشتیبانی و تأیید پرداخت'), {
      target: { value: 'سرپرست تأیید واریزی‌ها' },
    });

    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockState.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'admin_requests/candidate-admin-1' }),
        expect.objectContaining({
          uid: 'candidate-admin-1',
          displayName: 'مریم رضایی',
          organizationTitle: 'سرپرست تأیید واریزی‌ها',
          status: 'pending',
          reviewedBy: '',
        })
      );
    });
  });

  it('داشبورد ادمین تأییدشده می‌تواند فیش پرداختی در انتظار را با تراکنش اتمیک تایید و پلن کاربر را فعال کند', async () => {
    mockState.currentUser = {
      uid: 'super-admin-uid',
      email: SUPER_ADMIN_EMAIL,
      emailVerified: true,
      displayName: 'علیرضا طاهری',
      providerData: [],
    };

    mockState.collections.payment_requests = [
      {
        id: 'pay_user1_100',
        userId: 'user-customer-1',
        userEmail: 'customer1@example.com',
        userName: 'سارا محمدی',
        businessName: 'بازرگانی آفتاب',
        requestedPlan: 'yearly',
        amountRial: 49_000_000,
        trackingCode: 'TRK-998811',
        bankRef: 'بانک ملت',
        note: 'واریز سالانه',
        status: 'pending',
        reviewedBy: '',
      },
    ];

    mockState.collections.users = [
      {
        uid: 'user-customer-1',
        email: 'customer1@example.com',
        fullName: 'سارا محمدی',
        businessName: 'بازرگانی آفتاب',
        plan: 'free',
        accessStatus: 'trial',
        hasSampleData: false,
      },
    ];

    render(<AdminRegistryView onBackToApp={() => {}} />);

    expect(screen.getByTestId('admin-verified-dashboard')).toBeTruthy();
    expect(screen.getByTestId('payment-request-card-pay_user1_100')).toBeTruthy();

    fireEvent.click(screen.getByTestId('approve-payment-btn-pay_user1_100'));

    await waitFor(() => {
      expect(mockState.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'payment_requests/pay_user1_100' }),
        expect.objectContaining({
          status: 'approved',
          reviewedBy: 'super-admin-uid',
        })
      );
      expect(mockState.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-customer-1' }),
        expect.objectContaining({
          plan: 'yearly',
          accessStatus: 'verified',
        })
      );
      expect(mockState.batchCommit).toHaveBeenCalled();
    });

    // Switch to Users tab and suspend/verify access
    fireEvent.click(screen.getByText(/کاربران و دسترسی‌ها/));
    const accessSelect = screen.getByLabelText('تغییر دسترسی سارا محمدی');
    fireEvent.change(accessSelect, { target: { value: 'suspended' } });

    await waitFor(() => {
      expect(mockState.updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-customer-1' }),
        expect.objectContaining({
          accessStatus: 'suspended',
        })
      );
    });
  });

  it('فرم ثبت‌نام مشتری فضای کاری تمیز و مجزا بدون داده‌های تکراری ایجاد می‌کند', async () => {
    const signedCustomer = {
      uid: 'cust-uid-77',
      email: 'owner@alborz.ir',
      displayName: 'رضا کریمی',
    } as unknown as import('firebase/auth').User;

    render(
      <CustomerAuthModal
        isOpen={true}
        onClose={() => {}}
        firebaseUser={signedCustomer}
        userProfile={null}
        onOpenAdminRegistry={() => {}}
        onLoadCleanLocalWorkspace={() => {}}
        onLoadDemoLocalWorkspace={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('مثلاً سارا احمدی'), {
      target: { value: 'رضا کریمی' },
    });
    fireEvent.change(screen.getByPlaceholderText('مثلاً بازرگانی نیک‌پرداز یا فروشگاه البرز'), {
      target: { value: 'پخش مواد غذایی البرز' },
    });

    fireEvent.click(screen.getByText('ایجاد فضای کاری اختصاصی'));

    await waitFor(() => {
      expect(mockState.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/cust-uid-77' }),
        expect.objectContaining({
          uid: 'cust-uid-77',
          fullName: 'رضا کریمی',
          businessName: 'پخش مواد غذایی البرز',
          plan: 'free',
          accessStatus: 'trial',
          hasSampleData: false,
        })
      );
      expect(mockState.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/cust-uid-77/workspace/main' }),
        expect.objectContaining({
          ownerId: 'cust-uid-77',
          invoices: [],
          checks: [],
          journal: [],
        })
      );
    });
  });

  it('SubscriptionModal پس از انتخاب پلن برای کاربر احرازشده فرم ارسال کد پیگیری به ادمین را نمایش می‌دهد', async () => {
    const onSubmitPaymentRequest = vi.fn().mockResolvedValue(undefined);

    render(
      <SubscriptionModal
        isOpen={true}
        onClose={() => {}}
        currentPlan="free"
        onSelectPlan={() => {}}
        isAuthenticated={true}
        onSubmitPaymentRequest={onSubmitPaymentRequest}
      />
    );

    fireEvent.click(screen.getByText('خرید و فعال‌سازی سالانه'));

    const payForm = screen.getByTestId('payment-request-form');
    expect(payForm).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText('شماره پیگیری / ارجاع بانکی (حداقل ۳ کاراکتر) *'),
      { target: { value: 'REF-405012' } }
    );
    fireEvent.submit(payForm);

    await waitFor(() => {
      expect(onSubmitPaymentRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedPlan: 'yearly',
          trackingCode: 'REF-405012',
          amountRial: 49_000_000,
        })
      );
    });
  });

  it('اپلیکیشن در شروع اولیه بدون داده‌های نمونه تکراری با دفتر سفید و مقادیر صفر بالا می‌آید', async () => {
    const { default: App } = await import('../App');
    render(<App />);

    expect(screen.getByText('۰ سند رسمی')).toBeTruthy();
    expect(screen.getByText('۰٪')).toBeTruthy();
    expect(screen.getByTestId('guest-preview-banner').textContent).toContain('دفتر سفید شخصی آماده است');
  });
});
