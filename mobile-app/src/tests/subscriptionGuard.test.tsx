import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionGuard } from '../components/SubscriptionGuard';
import { TrialStatus } from '../lib/karbanData';

describe('SubscriptionGuard Component', () => {
  const defaultTrialActive: TrialStatus = {
    isTrial: true,
    daysRemaining: 7,
    isExpired: false,
    percentUsed: 30,
    startedAt: new Date().toISOString(),
  };

  const defaultTrialExpired: TrialStatus = {
    isTrial: true,
    daysRemaining: 0,
    isExpired: true,
    percentUsed: 100,
    startedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children directly when user is on a paid pro plan (e.g. yearly)', () => {
    const handleOpenUpgrade = vi.fn();
    render(
      <SubscriptionGuard
        plan="yearly"
        trialStatus={defaultTrialExpired}
        featureTitle="استودیو هوش مصنوعی کاربان"
        onOpenUpgrade={handleOpenUpgrade}
      >
        <div data-testid="protected-content">محتوای محافظت‌شده ویژه استودیو هوش مصنوعی</div>
      </SubscriptionGuard>
    );

    const content = screen.getByTestId('protected-content');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('محتوای محافظت‌شده ویژه استودیو هوش مصنوعی');
    expect(screen.queryByTestId('subscription-guard-restricted')).toBeNull();
    expect(handleOpenUpgrade).not.toHaveBeenCalled();
  });

  it('renders children directly when user is on free plan but trial is still active', () => {
    const handleOpenUpgrade = vi.fn();
    render(
      <SubscriptionGuard
        plan="free"
        trialStatus={defaultTrialActive}
        featureTitle="دفاتر قانونی و تراز ۴ ستونی"
        onOpenUpgrade={handleOpenUpgrade}
      >
        <div data-testid="accounting-pro-content">تراز آزمایشی چهارستونی فعال</div>
      </SubscriptionGuard>
    );

    const content = screen.getByTestId('accounting-pro-content');
    expect(content).toBeTruthy();
    expect(content.textContent).toContain('تراز آزمایشی چهارستونی فعال');
    expect(screen.queryByTestId('subscription-guard-restricted')).toBeNull();
    expect(handleOpenUpgrade).not.toHaveBeenCalled();
  });

  it('restricts access and hides children when user is on free plan and trial has expired', () => {
    const handleOpenUpgrade = vi.fn();
    render(
      <SubscriptionGuard
        plan="free"
        trialStatus={defaultTrialExpired}
        featureTitle="استودیو هوش مصنوعی و اسکنر صیاد"
        featureDescription="تست قفل ماژول هوش مصنوعی"
        onOpenUpgrade={handleOpenUpgrade}
      >
        <div data-testid="protected-content">محتوای مخفی که نباید دیده شود</div>
      </SubscriptionGuard>
    );

    expect(screen.queryByTestId('protected-content')).toBeNull();
    const barrier = screen.getByTestId('subscription-guard-restricted');
    expect(barrier).toBeTruthy();
    expect(barrier.textContent).toContain('استودیو هوش مصنوعی و اسکنر صیاد');
    expect(barrier.textContent).toContain('مهلت تست ۱۰ روزه به پایان رسیده است');
  });

  it('calls onOpenUpgrade with the featureTitle when user clicks the upgrade CTA button', () => {
    const handleOpenUpgrade = vi.fn();
    const featureTitle = 'تراز آزمایشی چهارستونی پیشرفته';

    render(
      <SubscriptionGuard
        plan="free"
        trialStatus={defaultTrialExpired}
        featureTitle={featureTitle}
        onOpenUpgrade={handleOpenUpgrade}
      >
        <div data-testid="hidden-child">محتوا</div>
      </SubscriptionGuard>
    );

    const upgradeBtn = screen.getByRole('button', { name: /مشاهده تعرفه‌ها و ارتقا به اشتراک حرفه‌ای/i });
    expect(upgradeBtn).toBeTruthy();

    fireEvent.click(upgradeBtn);
    expect(handleOpenUpgrade).toHaveBeenCalledTimes(1);
    expect(handleOpenUpgrade).toHaveBeenCalledWith(featureTitle);
  });

  it('triggers autoRedirect to upgrade modal when autoRedirect is true and access is restricted', async () => {
    const handleOpenUpgrade = vi.fn();
    const featureTitle = 'ماژول مالیات بر ارزش افزوده و ماده ۱۶۹';

    render(
      <SubscriptionGuard
        plan="free"
        trialStatus={defaultTrialExpired}
        featureTitle={featureTitle}
        onOpenUpgrade={handleOpenUpgrade}
        autoRedirect={true}
      >
        <div data-testid="hidden-child">محتوا</div>
      </SubscriptionGuard>
    );

    await waitFor(
      () => {
        expect(handleOpenUpgrade).toHaveBeenCalledWith(featureTitle);
      },
      { timeout: 1000 }
    );
  });
});
