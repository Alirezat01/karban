export type ServicePlan = {
  title: string;
  description: string;
  price: string;
  unit: string;
  featured?: boolean;
  discountPercent?: number;
};

export const servicePlans: ServicePlan[] = [
  {
    title: 'مشاوره متنی',
    description: 'پاسخ تخصصی به پرسش حقوقی، مالی یا مدیریتی شما.',
    price: '۲۹۰٬۰۰۰ ریال',
    unit: 'هر درخواست',
  },
  {
    title: 'مشاوره تلفنی ۳۰ دقیقه',
    description: 'گفت‌وگوی مستقیم با متخصص تأییدشده کاربان.',
    price: '۸۹۰٬۰۰۰ ریال',
    unit: '۳۰ دقیقه',
    featured: true,
    discountPercent: 10,
  },
  {
    title: 'مشاوره حضوری ۱ ساعت',
    description: 'جلسه عمیق برای بررسی مسئله کسب‌وکار.',
    price: '۲٬۹۰۰٬۰۰۰ ریال',
    unit: '۱ ساعت',
  },
  {
    title: 'پکیج ماهانه',
    description: 'پشتیبانی منظم برای امور مالی، مالیاتی و روابط کار.',
    price: '۱۴٬۹۰۰٬۰۰۰ ریال',
    unit: 'ماهانه',
    discountPercent: 15,
  },
];

export const specialistServices = [
  ['تنظیم قرارداد اختصاصی برای شرکت شما', '۴٬۹۰۰٬۰۰۰ ریال'],
  ['بازبینی و حاشیه‌نویسی قرارداد', '۱٬۹۰۰٬۰۰۰ ریال'],
  ['انجام اظهارنامه عملکرد و ارزش افزوده', '۳٬۹۰۰٬۰۰۰ ریال'],
  ['اظهارنامه معاملات فصلی', '۱٬۹۰۰٬۰۰۰ ریال'],
] as const;

export const legalConfig = {
  year: '۱۴۰۵',
  baseSalaryDaily: 3463650,
  housingAllowanceMonthly: 9000000,
  foodAllowanceMonthly: 22000000,
  familyAllowanceMonthly: 7000000,
  childAllowanceMonthly: 3000000,
  overtimeMultiplier: 1.4,
  insuranceEmployeeRate: 0.07,
  insuranceEmployerRate: 0.23,
  insuranceRate: 0.07,
  annualTaxFree: 2880000000,
  taxExemptionMonthly: 240000000,
  taxBrackets: [
    { max: 3600000000, rate: 0.1 },
    { max: 4800000000, rate: 0.15 },
    { max: 7200000000, rate: 0.2 },
    { max: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
};

export const roleCards = [
  { title: 'کارفرما هستم', description: 'قرارداد، استخدام، حقوق و دستمزد', icon: 'briefcase', href: '/کارفرما', accent: 'navy' },
  { title: 'کارگر/کارمند هستم', description: 'درک قرارداد، محاسبه حقوق، قانون کار', icon: 'shield', href: '/کارمند', accent: 'green' },
  { title: 'فریلنسر هستم', description: 'قرارداد همکاری، پروژه، مالیات', icon: 'laptop', href: '/فریلنسر', accent: 'gold' },
] as const;

export const serviceItems = [
  { title: 'مشاوره مالی، مالیاتی و حسابرسی', description: 'تصمیم‌گیری دقیق با همراهی متخصصان مالی و مالیاتی.', icon: 'chart', href: '/خدمات/مالی' },
  { title: 'مشاوره روابط کار', description: 'قرارداد، بیمه و رابطه‌ای روشن میان کارگر و کارفرما.', icon: 'scale', href: '/خدمات/روابط-کار' },
] as const;

export const toolItems = [
  { title: 'ساخت قرارداد هوشمند', description: 'قرارداد متناسب با نیاز شما، در چند مرحله.', href: '/ابزارهای-هوش-مصنوعی/ساخت-قرارداد', icon: 'file' },
  { title: 'محاسبه حقوق و دستمزد ۱۴۰۵', description: 'حقوق، بیمه و مالیات را دقیق برآورد کنید.', href: '/ابزارهای-هوش-مصنوعی/محاسبه-حقوق', icon: 'calculator' },
  { title: 'ماشین‌حساب بازنشستگی', description: 'تصویری روشن از مسیر بازنشستگی تأمین اجتماعی.', href: '/ابزارهای-هوش-مصنوعی/بازنشستگی', icon: 'sun' },
  { title: 'تست سلامت کسب‌وکار', description: 'نقاط قوت و ریسک‌های کسب‌وکار را بشناسید.', href: '/ابزارهای-هوش-مصنوعی/تست-سلامت', icon: 'heart' },
] as const;

export const calculatorItems = [
  ...toolItems,
  { title: 'هزینه استخدام', description: 'هزینه واقعی استخدام یک نفر را برآورد کنید.', href: '/ابزارهای-هوش-مصنوعی/هزینه-استخدام', icon: 'briefcase' },
  { title: 'سنوات پایان خدمت', description: 'مبلغ سنوات پایان کار را محاسبه کنید.', href: '/ابزارهای-هوش-مصنوعی/سنوات', icon: 'scale' },
  { title: 'اضافه‌کاری', description: 'مبلغ اضافه‌کاری را بر اساس نرخ قانونی ببینید.', href: '/ابزارهای-هوش-مصنوعی/اضافه-کاری', icon: 'clock' },
] as const;

export const CONTRACT_TYPES = ['کار', 'همکاری', 'پیمانکاری', 'خدمات', 'مشاوره', 'فروش', 'تأمین کالا', 'اجاره', 'لیزینگ', 'نمایندگی', 'توزیع', 'وکالت', 'محرمانگی', 'عدم رقابت', 'آموزش', 'کارآموزی', 'مشارکت مدنی', 'حمل‌ونقل', 'پشتیبانی و نگهداری', 'فرانچایز'] as const;
export const INDUSTRIES = ['پزشکان', 'دندانپزشکان', 'پیراپزشکی', 'داروخانه‌ها', 'برنامه‌نویسان', 'طراحان گرافیک', 'تولیدکنندگان محتوا', 'فروشگاه‌های آنلاین', 'استارتاپ‌ها', 'رستوران‌ها', 'کافه‌ها', 'سوپرمارکت‌ها', 'قنادی‌ها', 'پوشاک', 'خیاطی', 'کفش و چرم', 'آرایشگاه‌ها و سالن‌های زیبایی', 'آموزشگاه‌ها', 'مدرسه‌ها', 'مربیان ورزشی', 'باشگاه‌ها', 'مشاوران املاک', 'ساخت‌وساز', 'مهندسان', 'معماران', 'پیمانکاران ساختمان', 'برق‌کاران', 'لوله‌کش‌ها', 'مکانیک‌ها', 'تعمیرگاه‌ها', 'فروشندگان خودرو', 'نمایشگاه‌های خودرو', 'شرکت‌های حمل‌ونقل', 'رانندگان', 'آژانس‌ها', 'گردشگری', 'آژانس‌های هواپیمایی', 'هتل‌ها', 'وکلا', 'دفاتر اسناد رسمی', 'حسابداران', 'شرکت‌های حسابداری', 'فریلنسرها', 'عکاسان و آتلیه‌ها', 'تبلیغات و چاپ', 'کشاورزی', 'دامداری', 'گل‌فروشی‌ها', 'طلا و جواهر', 'صرافی‌ها', 'بیمه', 'بازاریابی دیجیتال'] as const;

export const contractCatalog = CONTRACT_TYPES.flatMap((type) =>
  INDUSTRIES.map((industry, index) => ({
    id: `${type}-${industry}`,
    type,
    industry,
    title: `قرارداد ${type} ${industry}`,
    description: `نسخه استاندارد و تخصصی برای همکاری‌های حوزه ${industry}.`,
    icon: index % 3,
  })),
);

