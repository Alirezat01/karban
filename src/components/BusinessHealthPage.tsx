import { useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, ShieldCheck } from 'lucide-react';

const questions = [
  'فرآیندهای کلیدی شما مکتوب شده‌اند؟',
  'قراردادهای اصلی کسب‌وکار به‌روز هستند؟',
  'حقوق و بیمه نیروها به‌موقع پرداخت می‌شود؟',
  'حساب‌های مالی ماهانه بررسی می‌شوند؟',
  'مالیات و اظهارنامه‌ها برنامه مشخص دارند؟',
  'برای جذب و نگهداشت نیروی خوب برنامه دارید؟',
  'ریسک‌های حقوقی هر ماه مرور می‌شوند؟',
  'دسترسی به اسناد مهم سازمان‌دهی شده است؟',
  'در صورت بحران، برنامه واکنش سریع دارید؟',
  'شاخص‌های رشد کسب‌وکار را دنبال می‌کنید؟',
] as const;

export default function BusinessHealthPage() {
  const [answers, setAnswers] = useState<boolean[]>(Array.from({ length: questions.length }, () => true));

  const score = useMemo(() => answers.filter(Boolean).length, [answers]);
  const status = score >= 8 ? 'سالم' : score >= 5 ? 'نیازمند اصلاح' : 'بحرانی';

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">
          <ShieldCheck size={15} /> ابزار هوشمند
        </span>
        <h1>تست سلامت کسب‌وکار</h1>
        <p className="lead">با ۱۰ پاسخ بله/خیر، یک تصویر فوری از سلامت عملیاتی، حقوقی و مالی کسب‌وکار خود بگیرید.</p>

        <div className="health-grid">
          {questions.map((question, index) => (
            <label className="health-row" key={question}>
              <span>{question}</span>
              <div className="health-options">
                <button
                  type="button"
                  className={answers[index] ? 'active' : ''}
                  onClick={() => setAnswers((current) => current.map((value, i) => (i === index ? true : value)))}
                >
                  بله
                </button>
                <button
                  type="button"
                  className={!answers[index] ? 'active' : ''}
                  onClick={() => setAnswers((current) => current.map((value, i) => (i === index ? false : value)))}
                >
                  خیر
                </button>
              </div>
            </label>
          ))}
        </div>

        <div className="health-result">
          <div className="health-result-head">
            <CheckCircle2 size={18} />
            <strong>نتیجه سلامت</strong>
          </div>
          <div className="health-score">
            <span>{score}</span>
            <small>از {questions.length}</small>
          </div>
          <p>{status}</p>
        </div>
      </div>
    </section>
  );
}

