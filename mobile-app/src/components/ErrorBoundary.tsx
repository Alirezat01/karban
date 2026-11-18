import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'خطای غیرمنتظره در اجرای سامانه رخ داد.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Karban ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#E2E5F6] dark:bg-[#050811] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-[400px] crisp-card p-6 rounded-[28px] text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-sm font-black text-[#0F172A] dark:text-white">
              بروز خطای دسترسی یا همگام‌سازی
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
              {this.state.errorMessage.includes('PERMISSION_DENIED') ||
              this.state.errorMessage.includes('Missing or insufficient permissions')
                ? 'دسترسی به این بخش نیاز به احراز هویت یا تأیید حساب توسط مدیر سامانه دارد.'
                : 'ارتباط با سرور با اختلال مواجه شد. لطفاً صفحه را مجدداً بارگذاری کنید.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="cobalt-pill-btn w-full min-h-[44px] text-xs font-black flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>بارگذاری مجدد کاربان</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
