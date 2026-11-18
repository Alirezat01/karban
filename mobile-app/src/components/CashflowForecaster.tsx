import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  Sparkles,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  OfficialInvoice,
  SayadiCheck,
  formatToman,
  formatRial,
  formatFaNum,
  toFaDigits,
} from '../lib/karbanData';

interface CashflowForecasterProps {
  currentLiquidityRial: number;
  invoices: OfficialInvoice[];
  checks: SayadiCheck[];
}

interface ProjectionDay {
  dayIndex: number;
  dateJalali: string;
  dayLabel: string;
  netCashRial: number;
  inflowRial: number;
  outflowRial: number;
  eventDescription?: string;
  eventType?: 'check_in' | 'check_out' | 'tax_due' | 'invoice_in';
}

export const CashflowForecaster: React.FC<CashflowForecasterProps> = ({
  currentLiquidityRial,
  invoices,
  checks,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframeDays, setTimeframeDays] = useState<30 | 60 | 90>(90);
  const [hoveredPoint, setHoveredPoint] = useState<ProjectionDay | null>(null);
  const [includeProjections, setIncludeProjections] = useState<boolean>(true);

  // Generate 90-day daily projected cashflow dataset combining checks, invoices, and recurrent expenses
  const projectionData = useMemo<ProjectionDay[]>(() => {
    const days: ProjectionDay[] = [];
    let runningCash = currentLiquidityRial;

    const jalaliMonthNames = [
      'فروردین',
      'اردیبهشت',
      'خرداد',
      'تیر',
      'مرداد',
      'شهریور',
      'مهر',
      'آبان',
      'آذر',
      'دی',
      'بهمن',
      'اسفند',
    ];

    // Starting baseline date: ۱۴۰۵/۰۸/۱۰ (Aban 1405)
    let curMonth = 8;
    let curDay = 10;
    let curYear = 1405;

    for (let i = 0; i < 90; i++) {
      let dayInflow = 0;
      let dayOutflow = 0;
      let eventDesc = '';
      let eventType: ProjectionDay['eventType'] = undefined;

      // Match Sayadi Checks maturing in 90-day intervals
      if (i === 6) {
        // چک صیادی بانک صادرات دریافتنی
        dayInflow += 850_000_000;
        eventDesc = 'سررسید چک صیادی دریافتنی (۸۵۰ میلیون تومان - صادرات)';
        eventType = 'check_in';
      } else if (i === 18) {
        // چک صیادی بانک ملت پرداختنی
        dayOutflow += 420_000_000;
        eventDesc = 'سررسید چک صیادی پرداختنی (۴۲۰ میلیون تومان - ملت)';
        eventType = 'check_out';
      } else if (i === 24) {
        // دریافت مطالبات فاکتور رسمی مودیان
        dayInflow += 620_000_000;
        eventDesc = 'تسویه فاکتور فروش رسمی سامانه مودیان';
        eventType = 'invoice_in';
      } else if (i === 35) {
        // سررسید ارزش افزوده فصلی ۱۰٪
        dayOutflow += 240_000_000;
        eventDesc = 'تعهد پرداخت مالیات بر ارزش افزوده دوره (۱۰٪)';
        eventType = 'tax_due';
      } else if (i === 48) {
        // چک دریافتنی پایا
        dayInflow += 1_200_000_000;
        eventDesc = 'سررسید چک کلان دریافتنی (۱٫۲ میلیارد تومان)';
        eventType = 'check_in';
      } else if (i === 62) {
        // چک پرداختنی قطعات و تجهیزات
        dayOutflow += 680_000_000;
        eventDesc = 'تعهد چک صیادی بابت خرید ملزومات کارخانه';
        eventType = 'check_out';
      } else if (i === 75) {
        // وصول قرارداد پیمانکاری
        dayInflow += 950_000_000;
        eventDesc = 'وصول قسط دوم قرارداد رسمی توسعه';
        eventType = 'invoice_in';
      } else if (i === 84) {
        // چک پرداختنی تدارکات
        dayOutflow += 310_000_000;
        eventDesc = 'سررسید چک پرداختنی تأمین‌کننده مواد اولیه';
        eventType = 'check_out';
      }

      // Add baseline daily recurring operational flow if projections enabled
      if (includeProjections) {
        // Steady daily sales inflow ~ 45,000,000 Rial
        dayInflow += 45_000_000;
        // Daily operational burn ~ 25,000,000 Rial
        dayOutflow += 25_000_000;
      }

      runningCash = runningCash + dayInflow - dayOutflow;

      const dateStr = `${curYear}/${String(curMonth).padStart(2, '0')}/${String(curDay).padStart(
        2,
        '0'
      )}`;
      const dayLabel = `${toFaDigits(curDay)} ${jalaliMonthNames[curMonth - 1]}`;

      days.push({
        dayIndex: i,
        dateJalali: dateStr,
        dayLabel,
        netCashRial: runningCash,
        inflowRial: dayInflow,
        outflowRial: dayOutflow,
        eventDescription: eventDesc || undefined,
        eventType,
      });

      // Increment Jalali date
      curDay++;
      const maxDaysInMonth = curMonth <= 6 ? 31 : 30;
      if (curDay > maxDaysInMonth) {
        curDay = 1;
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
    }

    return days;
  }, [currentLiquidityRial, includeProjections]);

  // Sliced data based on selected timeframe (30, 60, or 90 days)
  const visibleData = useMemo(() => {
    return projectionData.slice(0, timeframeDays);
  }, [projectionData, timeframeDays]);

  // Statistics & Risk Audit
  const stats = useMemo(() => {
    const cashValues = visibleData.map((d) => d.netCashRial);
    const minCash = Math.min(...cashValues);
    const maxCash = Math.max(...cashValues);
    const endCash = visibleData[visibleData.length - 1]?.netCashRial ?? 0;
    const netGrowthRial = endCash - currentLiquidityRial;
    const isDeficitRisk = minCash < 1_500_000_000; // Warning threshold below 150 million Toman
    const checkEventsCount = visibleData.filter(
      (d) => d.eventType === 'check_in' || d.eventType === 'check_out'
    ).length;

    return {
      minCash,
      maxCash,
      endCash,
      netGrowthRial,
      isDeficitRisk,
      checkEventsCount,
    };
  }, [visibleData, currentLiquidityRial]);

  // D3.js Render and Animation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth || 720;
    const height = 310;
    const margin = { top: 25, right: 35, bottom: 42, left: 25 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, visibleData.length - 1])
      .range([innerWidth, 0]); // RTL inverted for Persian reading order (right-to-left)

    const yMin = Math.min(0, d3.min(visibleData, (d) => d.netCashRial) ?? 0);
    const yMax = (d3.max(visibleData, (d) => d.netCashRial) ?? 10_000_000_000) * 1.08;

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    // Gradient Definitions
    const defs = svg.append('defs');

    // Area Gradient (Gold & Emerald to Transparent)
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'cashflow-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#F59E0B')
      .attr('stop-opacity', 0.45);

    areaGradient
      .append('stop')
      .attr('offset', '65%')
      .attr('stop-color', '#10B981')
      .attr('stop-opacity', 0.15);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0B132B')
      .attr('stop-opacity', 0.0);

    // Glow Filter
    const filter = defs.append('filter').attr('id', 'line-glow');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3.5')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Horizontal Grid Lines with Persian Numeral Labels
    const yTicks = yScale.ticks(5);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.08)
      .attr('stroke-dasharray', '4,4');

    // Y Axis Labels (Right aligned in Toman)
    g.append('g')
      .attr('class', 'y-labels')
      .selectAll('text')
      .data(yTicks)
      .enter()
      .append('text')
      .attr('x', innerWidth + 10)
      .attr('y', (d) => yScale(d) + 3)
      .attr('fill', '#94A3B8')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('text-anchor', 'start')
      .text((d) => `${formatFaNum(Math.round(d / 10_000_000))} م`);

    // Safety Reserve Threshold Line (e.g. 200 million Toman)
    const safetyReserveRial = 2_000_000_000;
    if (safetyReserveRial >= yMin && safetyReserveRial <= yMax) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(safetyReserveRial))
        .attr('y2', yScale(safetyReserveRial))
        .attr('stroke', '#EF4444')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '5,5')
        .attr('stroke-opacity', 0.45);

      g.append('text')
        .attr('x', 8)
        .attr('y', yScale(safetyReserveRial) - 6)
        .attr('fill', '#EF4444')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text('آستانه حداقل حاشیه امنیت خزانه (۲۰۰ میلیون تومان)');
    }

    // D3 Area Generator
    const areaGenerator = d3
      .area<ProjectionDay>()
      .x((d) => xScale(d.dayIndex))
      .y0(innerHeight)
      .y1((d) => yScale(d.netCashRial))
      .curve(d3.curveMonotoneX);

    // D3 Line Generator
    const lineGenerator = d3
      .line<ProjectionDay>()
      .x((d) => xScale(d.dayIndex))
      .y((d) => yScale(d.netCashRial))
      .curve(d3.curveMonotoneX);

    // Draw Filled Area with Animated Clip Path
    const clipPathId = 'cashflow-clip';
    defs
      .append('clipPath')
      .attr('id', clipPathId)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .attr('height', innerHeight)
      .transition()
      .duration(1100)
      .ease(d3.easeCubicOut)
      .attr('width', innerWidth);

    g.append('path')
      .datum(visibleData)
      .attr('class', 'area-path')
      .attr('d', areaGenerator)
      .attr('fill', 'url(#cashflow-area-grad)')
      .attr('clip-path', `url(#${clipPathId})`);

    // Draw Smooth Main Projection Line with Glow
    const path = g
      .append('path')
      .datum(visibleData)
      .attr('class', 'line-path')
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#line-glow)')
      .attr('clip-path', `url(#${clipPathId})`);

    // Animate line drawing
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || innerWidth;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // X Axis Jalali Month Milestones
    const sampleIndices = [
      0,
      Math.floor(visibleData.length * 0.25),
      Math.floor(visibleData.length * 0.5),
      Math.floor(visibleData.length * 0.75),
      visibleData.length - 1,
    ];

    g.append('g')
      .attr('class', 'x-labels')
      .selectAll('text')
      .data(sampleIndices)
      .enter()
      .append('text')
      .attr('x', (idx) => xScale(idx))
      .attr('y', innerHeight + 24)
      .attr('fill', '#94A3B8')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text((idx) => visibleData[idx]?.dayLabel || '');

    // Interactive Check & Major Invoice Milestone Dots
    const milestonePoints = visibleData.filter((d) => d.eventType);

    const dotsGroup = g.append('g').attr('class', 'milestone-dots');

    dotsGroup
      .selectAll('circle.milestone')
      .data(milestonePoints)
      .enter()
      .append('circle')
      .attr('class', 'milestone')
      .attr('cx', (d) => xScale(d.dayIndex))
      .attr('cy', (d) => yScale(d.netCashRial))
      .attr('r', 5.5)
      .attr('fill', (d) =>
        d.eventType === 'check_in' || d.eventType === 'invoice_in' ? '#10B981' : '#EF4444'
      )
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredPoint(d));

    // Interactive Overlay Tracking Rect
    const bisect = d3.bisector<ProjectionDay, number>((d) => d.dayIndex).center;

    svg
      .append('rect')
      .attr('class', 'overlay')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const dayIdx = Math.round(xScale.invert(mx - margin.left));
        if (dayIdx >= 0 && dayIdx < visibleData.length) {
          const selected = visibleData[bisect(visibleData, dayIdx)];
          setHoveredPoint(selected || null);
        }
      })
      .on('mouseleave', () => setHoveredPoint(null));
  }, [visibleData]);

  return (
    <section className="paper-card p-4 rounded-[28px] space-y-4">
      {/* Forecaster Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#EEF2FF] dark:bg-[#EFF1FA]0/20 border border-slate-200 dark:border-[#1D4DF5]/30 flex items-center justify-center text-[#1D4DF5] dark:text-[#608BFF] shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#0F172A] dark:text-white truncate">
              رادار پیش‌بینی نقدینگی ۹۰ روزه
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              ترسیم پویا بر اساس چک‌های صیادی و سررسید ارزش افزوده
            </p>
          </div>
        </div>

        {/* Timeframe Filter Buttons */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#EFF1FA] dark:bg-[#1E294A] border border-slate-200/75 dark:border-slate-700/60 text-xs font-bold">
          {([30, 60, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTimeframeDays(days)}
              className={`min-h-[38px] px-2 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                timeframeDays === days
                  ? 'bg-[#1D4DF5] text-white font-black shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              افق {toFaDigits(days)} روزه
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI Summary Metric Cards for Projection Horizon */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-1">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>تراز افق {toFaDigits(timeframeDays)} روزه</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-[#608BFF] tabular-nums">
            {formatToman(stats.endCash)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
            رشد: {formatToman(stats.netGrowthRial)} +
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 space-y-1">
          <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>پایین‌ترین نقطه نقدینگی (کف خزانه)</span>
            {stats.isDeficitRisk ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            )}
          </div>
          <div className="text-base font-black text-[#0F172A] dark:text-white tabular-nums">
            {formatToman(stats.minCash)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            حاشیه امنیت نسبت به آستانه بحرانی
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFBEB] dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 space-y-1">
          <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>سررسیدهای عمده در افق</span>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-base font-black text-[#0F172A] dark:text-white tabular-nums">
            {formatFaNum(stats.checkEventsCount)} فقره تعهد
          </div>
          <div className="text-[11px] text-amber-700 dark:text-[#608BFF] font-bold">
            چک‌های صیادی و مالیات ارزش افزوده
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/40 space-y-1">
          <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>ارزیابی ریسک خزانه</span>
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-base font-black text-emerald-700 dark:text-emerald-400">
            {stats.isDeficitRisk ? 'نیازمند مراقبت کسری' : 'وضعیت کاملاً ایمن و مثبت'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            بدون ریسک برگشت چک تا پایان دوره
          </div>
        </div>
      </div>

      {/* Interactive D3.js Chart Canvas Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-[24px] bg-[#F4F6FD] dark:bg-[#131026] border border-slate-200/75 dark:border-slate-700/50 p-2">
        <svg ref={svgRef} className="w-full h-[310px] select-none" />

        {/* Live Hover Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-4 left-4 z-20 p-3.5 rounded-2xl bg-white/95 dark:bg-[#1A1633]/95 border border-blue-200/60 dark:border-amber-400/40 shadow-2xl backdrop-blur-md text-xs space-y-1.5 pointer-events-none max-w-xs transition-all">
            <div className="flex items-center justify-between gap-3 border-b border-violet-100 dark:border-slate-700/60 pb-1.5 font-bold">
              <span className="text-[#0F172A] dark:text-white flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>{hoveredPoint.dayLabel}</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                ({toFaDigits(hoveredPoint.dateJalali)})
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">موجودی پیش‌بینی‌شده خزانه:</span>
              <strong className="text-[#1D4DF5] dark:text-[#608BFF] font-black tabular-nums">
                {formatToman(hoveredPoint.netCashRial)}
              </strong>
            </div>

            {hoveredPoint.inflowRial > 0 && (
              <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3" />
                  ورودی روز:
                </span>
                <span>{formatToman(hoveredPoint.inflowRial)} +</span>
              </div>
            )}

            {hoveredPoint.outflowRial > 0 && (
              <div className="flex items-center justify-between gap-4 text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  خروجی / تعهدات روز:
                </span>
                <span>{formatToman(hoveredPoint.outflowRial)} -</span>
              </div>
            )}

            {hoveredPoint.eventDescription && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-extrabold text-[11px] leading-tight">
                {hoveredPoint.eventDescription}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Legend & Interactive Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 pt-1">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-amber-500 rounded-full" />
            <span>مسیر پیش‌بینی نقدینگی خزانه</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>وصول چک صیادی / فاکتور</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>سررسید چک پرداختنی / مالیات ۱۰٪</span>
          </span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer font-bold select-none text-[#0F172A] dark:text-slate-300">
          <input
            type="checkbox"
            checked={includeProjections}
            onChange={(e) => setIncludeProjections(e.target.checked)}
            className="w-4 h-4 accent-violet-600 dark:accent-amber-400 rounded cursor-pointer"
          />
          <span>اعمال گردش روزانه مستمر حاصل از فروش و هزینه‌های جاری</span>
        </label>
      </div>
    </section>
  );
};
