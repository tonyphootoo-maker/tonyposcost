import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Order,
  Expense,
  Product,
  Recipe,
  ProductCategory,
  RestaurantSettings,
  RecurringExpense,
} from '../../types';
import { dbGetAll, dbGet } from '../../db';
import { useTranslation } from '../../i18n';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
  Award,
  Flame,
  HelpCircle,
  Truck,
  ArrowUpRight,
  Filter,
  X,
  Share2,
  Smartphone,
  Info,
  CalendarDays,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import {
  calcPeriodPnL,
  calcOrderNetRevenue,
  calcOrderDeliveryGPFee,
  calcOrderReportingCost,
  classifyMenuEngineering,
  generateLineSummaryText,
  formatMoney,
  formatPercent,
  MenuEngineeringItem,
  MenuEngineeringClass,
  PeriodPnLResult,
} from '../../utils/calc';
import { showToast } from '../common/ToastContainer';

type PeriodMode = 'day' | 'month' | 'year' | 'custom';
type ReportTab = 'summary' | 'products' | 'channels' | 'pnl' | 'menu_engineering';

export const ReportsView: React.FC = () => {
  const { t, language, formatCurrency, formatDate } = useTranslation();

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  // Period Selector State (Section 8.2)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const currentYearStr = useMemo(() => todayStr.slice(0, 4), [todayStr]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Filters & Sorting for tables
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productSortBy, setProductSortBy] = useState<'sales' | 'qty' | 'profit' | 'name'>('sales');
  const [menuMatrixFilter, setMenuMatrixFilter] = useState<'all' | MenuEngineeringClass>('all');
  const [menuMatrixSort, setMenuMatrixSort] = useState<'qty' | 'profit' | 'revenue'>('qty');

  // LINE Summary Text modal / fallback
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [generatedLineText, setGeneratedLineText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [ordList, expList, metaRec, prodList, recList, catList, savedSettings] = await Promise.all([
        dbGetAll<Order>('orders'),
        dbGetAll<Expense>('expenses'),
        dbGet<{ id: string; list: RecurringExpense[] }>('meta', 'recurring_expenses'),
        dbGetAll<Product>('products'),
        dbGetAll<Recipe>('recipes'),
        dbGetAll<ProductCategory>('categories'),
        dbGet<RestaurantSettings>('settings', 'current_settings'),
      ]);

      let loadedRec = metaRec?.list;
      if (!loadedRec || loadedRec.length === 0) {
        try {
          const raw = localStorage.getItem('tonys_recurring_expenses');
          if (raw) loadedRec = JSON.parse(raw);
        } catch {
          // ignore
        }
      }

      setOrders(ordList);
      setExpenses(expList);
      setRecurringExpenses(Array.isArray(loadedRec) ? loadedRec : []);
      setProducts(prodList);
      setRecipes(recList);
      setCategories(catList);
      if (savedSettings) setSettings(savedSettings);
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Period Range Calculation (Date boundaries)
  // ---------------------------------------------------------------------------
  const { startDateStr, endDateStr, periodDisplayLabel } = useMemo(() => {
    if (periodMode === 'day') {
      const label =
        selectedDay === todayStr
          ? language === 'th'
            ? `วันนี้ (${formatDate(selectedDay)})`
            : `Today (${selectedDay})`
          : formatDate(selectedDay);
      return {
        startDateStr: selectedDay,
        endDateStr: selectedDay,
        periodDisplayLabel: label,
      };
    }

    if (periodMode === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const padM = String(m).padStart(2, '0');
      const start = `${y}-${padM}-01`;
      const end = `${y}-${padM}-${String(lastDay).padStart(2, '0')}`;

      const monthNamesTh = [
        'มกราคม',
        'กุมภาพันธ์',
        'มีนาคม',
        'เมษายน',
        'พฤษภาคม',
        'มิถุนายน',
        'กรกฎาคม',
        'สิงหาคม',
        'กันยายน',
        'ตุลาคม',
        'พฤศจิกายน',
        'ธันวาคม',
      ];
      const monthNamesEn = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const monthName = language === 'th' ? monthNamesTh[m - 1] : monthNamesEn[m - 1];
      const yearLabel = language === 'th' ? y + 543 : y;

      return {
        startDateStr: start,
        endDateStr: end,
        periodDisplayLabel: `${monthName} ${yearLabel}`,
      };
    }

    if (periodMode === 'year') {
      const y = Number(selectedYear);
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      const yearLabel = language === 'th' ? `ปี พ.ศ. ${y + 543}` : `Year ${y}`;
      return {
        startDateStr: start,
        endDateStr: end,
        periodDisplayLabel: yearLabel,
      };
    }

    // Custom
    return {
      startDateStr: customStartDate,
      endDateStr: customEndDate,
      periodDisplayLabel: `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`,
    };
  }, [
    periodMode,
    selectedDay,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    todayStr,
    language,
    formatDate,
  ]);

  // Period navigation helpers (prev/next)
  const handlePrevPeriod = () => {
    if (periodMode === 'day') {
      const d = new Date(selectedDay);
      d.setDate(d.getDate() - 1);
      setSelectedDay(d.toISOString().split('T')[0]);
    } else if (periodMode === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      setSelectedMonth(prevDate.toISOString().slice(0, 7));
    } else if (periodMode === 'year') {
      setSelectedYear(String(Number(selectedYear) - 1));
    }
  };

  const handleNextPeriod = () => {
    if (periodMode === 'day') {
      const d = new Date(selectedDay);
      d.setDate(d.getDate() + 1);
      setSelectedDay(d.toISOString().split('T')[0]);
    } else if (periodMode === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      setSelectedMonth(nextDate.toISOString().slice(0, 7));
    } else if (periodMode === 'year') {
      setSelectedYear(String(Number(selectedYear) + 1));
    }
  };

  // ---------------------------------------------------------------------------
  // 2. Filtered Data for Period
  // ---------------------------------------------------------------------------
  const { allOrdersInPeriod, paidOrdersInPeriod, filteredExpensesInPeriod } = useMemo(() => {
    const allInPeriod = orders.filter((o) => {
      const orderDateStr = (o.paidAt || o.createdAt || '').split('T')[0];
      return orderDateStr >= startDateStr && orderDateStr <= endDateStr;
    });

    const paidInPeriod = allInPeriod.filter((o) => o.status === 'paid');

    const expInPeriod = expenses.filter((e) => {
      const expDateStr = (e.date || '').split('T')[0];
      return expDateStr >= startDateStr && expDateStr <= endDateStr;
    });

    return {
      allOrdersInPeriod: allInPeriod,
      paidOrdersInPeriod: paidInPeriod,
      filteredExpensesInPeriod: expInPeriod,
    };
  }, [orders, expenses, startDateStr, endDateStr]);

  // ---------------------------------------------------------------------------
  // 3. Profit & Loss Result (Rule Section 8.2 & calc.ts)
  // ---------------------------------------------------------------------------
  const pnlResult: PeriodPnLResult = useMemo(() => {
    return calcPeriodPnL(
      paidOrdersInPeriod,
      allOrdersInPeriod,
      filteredExpensesInPeriod,
      recurringExpenses,
      startDateStr,
      endDateStr,
      settings
    );
  }, [
    paidOrdersInPeriod,
    allOrdersInPeriod,
    filteredExpensesInPeriod,
    recurringExpenses,
    startDateStr,
    endDateStr,
    settings,
  ]);

  // ---------------------------------------------------------------------------
  // 4. Sales Channels Breakdown (Payment Methods, Order Types, Sources)
  // ---------------------------------------------------------------------------
  const channels = useMemo(() => {
    const payments = {
      cash: 0,
      promptpay: 0,
      card: 0,
      wallet: 0,
      grab: 0,
      lineman: 0,
      foodpanda: 0,
      otherDelivery: 0,
    };

    const orderTypes = {
      dineIn: 0,
      takeaway: 0,
      delivery: 0,
    };

    const sources = {
      pos: 0,
      online: 0,
    };

    paidOrdersInPeriod.forEach((o) => {
      const amt = o.totalAmount || 0;

      // Order Type
      if (o.orderType === 'dine_in') orderTypes.dineIn += amt;
      else if (o.orderType === 'takeaway') orderTypes.takeaway += amt;
      else if (o.orderType === 'delivery') orderTypes.delivery += amt;

      // Source
      if (o.source === 'online' || (o as { orderSource?: string }).orderSource === 'online') sources.online += amt;
      else sources.pos += amt;

      // Payment Breakdown
      const method = (o.paymentMethod || '').toLowerCase();
      const platformId = (o.platformId || (o as { platform?: string }).platform || '').toLowerCase();

      if (o.orderType === 'delivery' || platformId) {
        if (platformId.includes('grab')) payments.grab += amt;
        else if (platformId.includes('line') || platformId.includes('lineman')) payments.lineman += amt;
        else if (platformId.includes('panda')) payments.foodpanda += amt;
        else payments.otherDelivery += amt;
      } else {
        if (method === 'cash') payments.cash += amt;
        else if (method === 'promptpay' || method === 'qr_code') payments.promptpay += amt;
        else if (method === 'credit_card' || method === 'card' || method === 'transfer') payments.card += amt;
        else payments.wallet += amt;
      }
    });

    const totalDeliveryPayments =
      payments.grab + payments.lineman + payments.foodpanda + payments.otherDelivery;

    return {
      payments: {
        ...payments,
        deliveryTotal: totalDeliveryPayments,
      },
      orderTypes,
      sources,
    };
  }, [paidOrdersInPeriod]);

  // ---------------------------------------------------------------------------
  // 5. Sales by Category & by Product (Section 8.2)
  // ---------------------------------------------------------------------------
  const { productSalesList, categorySalesList, top5Dishes } = useMemo(() => {
    interface ProductAgg {
      productId: string;
      nameTh: string;
      nameEn?: string;
      category: string;
      quantitySold: number;
      totalRevenue: number;
      totalCost: number;
      hasMissingCost: boolean;
      profit: number;
    }

    const prodMap: Record<string, ProductAgg> = {};

    paidOrdersInPeriod.forEach((order) => {
      const items = order.lines || order.items || [];
      items.forEach((item) => {
        if (item.voided) return;
        const pid = item.productId || item.productNameTh || 'unknown';
        const qty = item.qty ?? item.quantity ?? 1;
        const lineTotal = item.lineTotal ?? ((item.unitPrice ?? item.basePrice ?? 0) * qty);

        const unitCost = item.unitCostSnapshot ?? item.unitCost;
        const hasMissing = typeof unitCost !== 'number' || isNaN(unitCost);
        const cost = hasMissing ? 0 : unitCost * qty;

        if (!prodMap[pid]) {
          const matchedProd = products.find((p) => p.id === pid);
          prodMap[pid] = {
            productId: pid,
            nameTh: item.productNameTh || matchedProd?.nameTh || matchedProd?.name || pid,
            nameEn: item.productNameEn || matchedProd?.nameEn,
            category: matchedProd?.categoryId || (matchedProd as { category?: string })?.category || (item as { category?: string })?.category || 'ทั่วไป',
            quantitySold: 0,
            totalRevenue: 0,
            totalCost: 0,
            hasMissingCost: false,
            profit: 0,
          };
        }

        prodMap[pid].quantitySold += qty;
        prodMap[pid].totalRevenue += lineTotal;
        prodMap[pid].totalCost += cost;
        if (hasMissing) {
          prodMap[pid].hasMissingCost = true;
        }
        prodMap[pid].profit += lineTotal - cost;
      });
    });

    const list = Object.values(prodMap);

    // Group by category
    const catMap: Record<string, { category: string; quantity: number; sales: number; cost: number; profit: number }> =
      {};
    list.forEach((item) => {
      if (!catMap[item.category]) {
        catMap[item.category] = { category: item.category, quantity: 0, sales: 0, cost: 0, profit: 0 };
      }
      catMap[item.category].quantity += item.quantitySold;
      catMap[item.category].sales += item.totalRevenue;
      catMap[item.category].cost += item.totalCost;
      catMap[item.category].profit += item.profit;
    });

    const sortedTop5 = [...list]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5)
      .map((d) => ({
        name: language === 'th' ? d.nameTh : d.nameEn || d.nameTh,
        quantity: d.quantitySold,
        revenue: d.totalRevenue,
      }));

    return {
      productSalesList: list,
      categorySalesList: Object.values(catMap).sort((a, b) => b.sales - a.sales),
      top5Dishes: sortedTop5,
    };
  }, [paidOrdersInPeriod, products, language]);

  // Filtered and sorted product sales
  const displayedProducts = useMemo(() => {
    let filtered = productSalesList;
    if (productCategoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === productCategoryFilter);
    }
    return [...filtered].sort((a, b) => {
      if (productSortBy === 'sales') return b.totalRevenue - a.totalRevenue;
      if (productSortBy === 'qty') return b.quantitySold - a.quantitySold;
      if (productSortBy === 'profit') return b.profit - a.profit;
      return a.nameTh.localeCompare(b.nameTh, 'th');
    });
  }, [productSalesList, productCategoryFilter, productSortBy]);

  // ---------------------------------------------------------------------------
  // 6. Menu Engineering (Section 8.2)
  // ---------------------------------------------------------------------------
  const menuEngineeringData = useMemo(() => {
    const inputItems = productSalesList.map((p) => ({
      id: p.productId,
      nameTh: p.nameTh,
      nameEn: p.nameEn,
      quantitySold: p.quantitySold,
      totalRevenue: p.totalRevenue,
      totalCost: p.totalCost,
      hasMissingCost: p.hasMissingCost,
    }));

    return classifyMenuEngineering(inputItems);
  }, [productSalesList]);

  const displayedMenuEngineering = useMemo(() => {
    let items = menuEngineeringData.items;
    if (menuMatrixFilter !== 'all') {
      items = items.filter((i) => i.classification === menuMatrixFilter);
    }
    return [...items].sort((a, b) => {
      if (menuMatrixSort === 'qty') return b.quantitySold - a.quantitySold;
      if (menuMatrixSort === 'profit') return b.unitProfit - a.unitProfit;
      return b.totalRevenue - a.totalRevenue;
    });
  }, [menuEngineeringData, menuMatrixFilter, menuMatrixSort]);

  // ---------------------------------------------------------------------------
  // 7. Monthly Breakdown (Year View) & Daily Breakdown (Month View)
  // ---------------------------------------------------------------------------
  const yearMonthlyBreakdown = useMemo(() => {
    if (periodMode !== 'year') return [];
    const y = Number(selectedYear);
    const months = [];

    for (let m = 1; m <= 12; m++) {
      const padM = String(m).padStart(2, '0');
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${y}-${padM}-01`;
      const end = `${y}-${padM}-${String(lastDay).padStart(2, '0')}`;

      const monthOrders = paidOrdersInPeriod.filter((o) => {
        const d = (o.paidAt || o.createdAt || '').split('T')[0];
        return d >= start && d <= end;
      });

      const monthExpenses = filteredExpensesInPeriod.filter((e) => {
        const d = (e.date || '').split('T')[0];
        return d >= start && d <= end;
      });

      const pnl = calcPeriodPnL(
        monthOrders,
        allOrdersInPeriod,
        monthExpenses,
        recurringExpenses,
        start,
        end,
        settings
      );

      const monthNamesTh = [
        'ม.ค.',
        'ก.พ.',
        'มี.ค.',
        'เม.ย.',
        'พ.ค.',
        'มิ.ย.',
        'ก.ค.',
        'ส.ค.',
        'ก.ย.',
        'ต.ค.',
        'พ.ย.',
        'ธ.ค.',
      ];
      months.push({
        monthNumber: m,
        monthLabel: language === 'th' ? monthNamesTh[m - 1] : `Month ${m}`,
        pnl,
      });
    }

    return months;
  }, [
    periodMode,
    selectedYear,
    paidOrdersInPeriod,
    allOrdersInPeriod,
    filteredExpensesInPeriod,
    recurringExpenses,
    settings,
    language,
  ]);

  const monthDailyBreakdown = useMemo(() => {
    if (periodMode !== 'month') return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const days = [];

    for (let day = 1; day <= lastDay; day++) {
      const padDay = String(day).padStart(2, '0');
      const padM = String(m).padStart(2, '0');
      const dateStr = `${y}-${padM}-${padDay}`;

      const dayOrders = paidOrdersInPeriod.filter((o) => {
        const d = (o.paidAt || o.createdAt || '').split('T')[0];
        return d === dateStr;
      });

      const dayExpenses = filteredExpensesInPeriod.filter((e) => {
        const d = (e.date || '').split('T')[0];
        return d === dateStr;
      });

      const pnl = calcPeriodPnL(
        dayOrders,
        allOrdersInPeriod,
        dayExpenses,
        recurringExpenses,
        dateStr,
        dateStr,
        settings
      );

      days.push({
        dayNumber: day,
        dateStr,
        pnl,
      });
    }

    return days;
  }, [
    periodMode,
    selectedMonth,
    paidOrdersInPeriod,
    allOrdersInPeriod,
    filteredExpensesInPeriod,
    recurringExpenses,
    settings,
  ]);

  // ---------------------------------------------------------------------------
  // 8. LINE Summary Action (Section 8.2 & 8.3)
  // ---------------------------------------------------------------------------
  const handleCopyLineSummary = async () => {
    const text = generateLineSummaryText(
      periodDisplayLabel,
      pnlResult,
      {
        cash: channels.payments.cash,
        promptpay: channels.payments.promptpay,
        card: channels.payments.card,
        delivery: channels.payments.deliveryTotal,
      },
      top5Dishes
    );

    setGeneratedLineText(text);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        showToast({
          title: 'คัดลอกข้อความสำเร็จ',
          message: 'คัดลอกสรุปยอดขายสำหรับส่ง LINE เข้าคลิปบอร์ดแล้ว',
          type: 'success',
        });
        setTimeout(() => setIsCopied(false), 2500);
      } else {
        setIsLineModalOpen(true);
      }
    } catch {
      // Fallback for iframe clipboard restrictions
      setIsLineModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* -------------------------------------------------------------------- */}
      {/* Section 8.3: Mobile Viewing & Offline Notice Banner                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-[#FFFBF5] border border-[#FED7AA] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#1F2937]">
                ระบบทำงานบนเครื่องนี้ 100% (Local-First Offline)
              </span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-semibold rounded-md">
                ความปลอดภัยสูง
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1 max-w-2xl leading-relaxed">
              ไม่มีการส่งข้อมูลยอดขายหรือสูตรอาหารขึ้นเซิร์ฟเวอร์ภายนอก หากต้องการดูข้อมูลบนโทรศัพท์มือถือของเจ้าของร้าน:
              (1) กดปุ่ม{' '}
              <strong className="text-orange-700">"คัดลอกสรุปยอดส่ง LINE"</strong> เพื่อส่งเข้าแชทส่วนตัวทุกวัน หรือ
              (2) สำรองข้อมูลผ่านปุ่ม <strong className="text-orange-700">"Export JSON"</strong> ในเมนูตั้งค่าแล้วนำไป
              Import บนเบราว์เซอร์โทรศัพท์
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            onClick={handleCopyLineSummary}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
          >
            {isCopied ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
            <span>{isCopied ? 'คัดลอกแล้ว!' : 'คัดลอกสรุปยอดส่ง LINE'}</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Period Selector (วัน / เดือน / ปี / Custom with prev/next)           */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-orange-500" />
              <span>{t.financialReports || 'รายงานยอดขายและผลกำไร'}</span>
            </h1>
            <p className="text-xs text-[#6B7280] mt-1">
              ช่วงเวลาที่เลือก: <strong className="text-orange-600 font-bold">{periodDisplayLabel}</strong>
            </p>
          </div>

          {/* Period Mode Selector Tabs */}
          <div className="flex items-center p-1 bg-[#F3F4F6] rounded-xl text-xs font-semibold self-start md:self-auto border border-[#E5E7EB]">
            {(
              [
                { id: 'day', label: 'วัน (Day)' },
                { id: 'month', label: 'เดือน (Month)' },
                { id: 'year', label: 'ปี (Year)' },
                { id: 'custom', label: 'กำหนดเอง (Custom)' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setPeriodMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodMode === mode.id
                    ? 'bg-white text-[#1F2937] shadow-xs font-bold'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Navigation Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            {periodMode !== 'custom' && (
              <>
                <button
                  onClick={handlePrevPeriod}
                  className="p-2 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] text-[#4B5563] transition"
                  title="ช่วงก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={handleNextPeriod}
                  className="p-2 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] text-[#4B5563] transition"
                  title="ช่วงถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Mode-specific date pickers */}
            {periodMode === 'day' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#1F2937] bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {selectedDay !== todayStr && (
                  <button
                    onClick={() => setSelectedDay(todayStr)}
                    className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition"
                  >
                    กลับมาวันนี้
                  </button>
                )}
              </div>
            )}

            {periodMode === 'month' && (
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#1F2937] bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
                {selectedMonth !== currentMonthStr && (
                  <button
                    onClick={() => setSelectedMonth(currentMonthStr)}
                    className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition"
                  >
                    กลับมาเดือนนี้
                  </button>
                )}
              </div>
            )}

            {periodMode === 'year' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#1F2937] bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {Array.from({ length: 7 }, (_, i) => String(Number(currentYearStr) - 3 + i)).map((y) => (
                    <option key={y} value={y}>
                      {language === 'th' ? `พ.ศ. ${Number(y) + 543} (${y})` : y}
                    </option>
                  ))}
                </select>
                {selectedYear !== currentYearStr && (
                  <button
                    onClick={() => setSelectedYear(currentYearStr)}
                    className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-lg transition"
                  >
                    กลับมาปีนี้
                  </button>
                )}
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#6B7280]">จาก:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#1F2937] bg-white outline-none"
                />
                <span className="text-xs text-[#6B7280]">ถึง:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#1F2937] bg-white outline-none"
                />
              </div>
            )}
          </div>

          <div className="text-xs text-[#6B7280] font-mono">
            ยอดที่ชำระแล้ว: <strong className="text-emerald-600 font-bold">{pnlResult.paidBillsCount}</strong> บิล
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Sub Navigation Tabs                                                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex border-b border-[#E5E7EB] gap-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'summary', label: 'ภาพรวมยอดขาย (Sales Summary)' },
          { id: 'products', label: 'ยอดขายรายเมนู & หมวด (By Menu)' },
          { id: 'channels', label: 'ช่องทางชำระเงิน & เดลิเวอรี (Channels)' },
          { id: 'pnl', label: 'งบกำไรขาดทุน (P&L Statement)' },
          { id: 'menu_engineering', label: 'วิเคราะห์เมนูทำเงิน (Menu Matrix)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`py-3 px-4 border-b-2 transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600 font-extrabold'
                : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: SALES SUMMARY                                                 */}
      {/* ==================================================================== */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* 8 Metric KPI Cards (Rule Section 8.2) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gross Sales */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">ยอดขายรวม (Gross Sales)</div>
              <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
                ฿{formatMoney(pnlResult.grossSales)}
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                ก่อนหักส่วนลดและ GP
              </div>
            </div>

            {/* 2. Discounts */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">ส่วนลดรวม (Discounts)</div>
              <div className="text-2xl font-black text-rose-500 font-mono mt-1">
                -฿{formatMoney(pnlResult.discounts)}
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                โปรโมชั่น + คูปอง + แต้ม
              </div>
            </div>

            {/* 3. Service Charge & VAT */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">ภาษี & เซอร์วิสชาร์จ</div>
              <div className="text-lg font-black text-[#1F2937] font-mono mt-1">
                VAT: ฿{formatMoney(pnlResult.vat)}
              </div>
              <div className="text-xs font-bold text-neutral-600 font-mono">
                SC: ฿{formatMoney(pnlResult.serviceCharge)}
              </div>
            </div>

            {/* 4. Net Sales (Revenue per plate rule h/o) */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl shadow-xs">
              <div className="text-xs font-bold text-orange-900">ยอดขายสุทธิ (Net Revenue)</div>
              <div className="text-2xl font-black text-orange-600 font-mono mt-1">
                ฿{formatMoney(pnlResult.netRevenue)}
              </div>
              <div className="text-[11px] text-orange-800 mt-1">
                ตามกฎ Food Cost (ex-VAT)
              </div>
            </div>

            {/* 5. Number of bills */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">จำนวนบิลที่ชำระ (Bills)</div>
              <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
                {pnlResult.paidBillsCount} <span className="text-sm font-normal text-[#6B7280]">บิล</span>
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                สถานะชำระเงินแล้ว
              </div>
            </div>

            {/* 6. Average Bill Amount */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">ยอดเฉลี่ยต่อบิล (Avg Bill)</div>
              <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
                ฿{formatMoney(pnlResult.avgBillAmount ?? 0)}
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                ยอดขายเฉลี่ยต่อโต๊ะ/ออเดอร์
              </div>
            </div>

            {/* 7. Food Cost COGS */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">ต้นทุนวัตถุดิบ (COGS)</div>
              <div className="text-2xl font-black text-rose-600 font-mono mt-1">
                ฿{formatMoney(pnlResult.foodCost)}
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-1">
                <span>Food Cost: </span>
                <strong className="text-rose-600">
                  {pnlResult.foodCostPct !== null ? `${formatPercent(pnlResult.foodCostPct)}%` : '-'}
                </strong>
                {pnlResult.hasMissingFoodCost && (
                  <span className="text-amber-600 font-bold">(มีเมนูไม่มีต้นทุน)</span>
                )}
              </div>
            </div>

            {/* 8. Cancelled Total */}
            <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
              <div className="text-xs font-semibold text-[#6B7280]">บิลยกเลิก/โมฆะ (Cancelled)</div>
              <div className="text-2xl font-black text-neutral-500 font-mono mt-1">
                ฿{formatMoney(pnlResult.cancelledTotal)}
              </div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                ไม่นำมารวมในยอดขาย
              </div>
            </div>
          </div>

          {/* Quick Snapshot Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 Best Sellers */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center justify-between">
                <span>5 อันดับเมนูขายดีที่สุด</span>
                <button
                  onClick={() => setActiveTab('products')}
                  className="text-xs text-orange-600 hover:underline font-semibold"
                >
                  ดูทั้งหมด →
                </button>
              </h3>

              <div className="space-y-2.5">
                {top5Dishes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#9CA3AF]">
                    ยังไม่มีรายการขายในช่วงเวลาที่เลือก
                  </div>
                ) : (
                  top5Dishes.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-[#1F2937]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-orange-600 font-mono">
                          {item.quantity} จาน
                        </div>
                        <div className="text-[11px] text-[#6B7280] font-mono">
                          ฿{formatMoney(item.revenue)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Profit & Margin Summary */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center justify-between">
                  <span>สรุปผลกำไร (Profit Summary)</span>
                  <button
                    onClick={() => setActiveTab('pnl')}
                    className="text-xs text-orange-600 hover:underline font-semibold"
                  >
                    ดูงบเต็ม →
                  </button>
                </h3>

                <div className="space-y-3 mt-4 text-xs font-mono">
                  <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">กำไรขั้นต้น (Gross Profit)</span>
                    <span className="font-bold text-emerald-600">
                      ฿{formatMoney(pnlResult.grossProfit)}{' '}
                      <span className="text-xs font-normal">
                        ({pnlResult.grossMarginPct !== null ? `${formatPercent(pnlResult.grossMarginPct)}%` : '-'})
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">หัก GP เดลิเวอรี</span>
                    <span className="text-rose-500 font-bold">-฿{formatMoney(pnlResult.deliveryFees)}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">หัก ค่าใช้จ่ายดำเนินงาน</span>
                    <span className="text-rose-500 font-bold">
                      -฿{formatMoney(pnlResult.totalOperatingExpenses)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between mt-4">
                <div>
                  <div className="text-xs font-bold text-[#1F2937]">กำไรสุทธิ (Net Operating Profit)</div>
                  <div className="text-[11px] text-[#6B7280]">หลังหักวัตถุดิบ GP และค่าใช้จ่ายร้าน</div>
                </div>
                <div
                  className={`text-xl font-black font-mono ${
                    pnlResult.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  ฿{formatMoney(pnlResult.netProfit)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: SALES BY MENU & CATEGORY                                      */}
      {/* ==================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Category Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categorySalesList.map((cat) => (
              <div key={cat.category} className="p-3.5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
                <div className="text-xs font-bold text-[#1F2937] truncate">{cat.category}</div>
                <div className="text-lg font-black text-orange-600 font-mono mt-1">
                  ฿{formatMoney(cat.sales)}
                </div>
                <div className="text-[11px] text-[#6B7280] font-mono mt-0.5">
                  ขายได้ {cat.quantity} รายการ • กำไร ฿{formatMoney(cat.profit)}
                </div>
              </div>
            ))}
          </div>

          {/* Product Sales Table Toolbar */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#6B7280] font-semibold">หมวดหมู่:</span>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl font-semibold text-[#1F2937] bg-white outline-none"
                >
                  <option value="all">ทุกหมวดหมู่ ({productSalesList.length})</option>
                  {categorySalesList.map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category}
                    </option>
                  ))}
                </select>

                <span className="text-[#6B7280] font-semibold ml-2">เรียงตาม:</span>
                <select
                  value={productSortBy}
                  onChange={(e) => setProductSortBy(e.target.value as any)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl font-semibold text-[#1F2937] bg-white outline-none"
                >
                  <option value="sales">ยอดขายรวมสูงสุด (Sales)</option>
                  <option value="qty">จำนวนจานที่ขายมากสุด (Qty)</option>
                  <option value="profit">กำไรขั้นต้นสูงสุด (Profit)</option>
                  <option value="name">ชื่อเมนู (A-Z)</option>
                </select>
              </div>

              <div className="text-xs text-[#6B7280]">
                พบทั้งหมด <strong>{displayedProducts.length}</strong> รายการ
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">เมนูอาหาร / สินค้า</th>
                    <th className="py-2.5 px-3">หมวดหมู่</th>
                    <th className="py-2.5 px-3 text-right">จำนวนที่ขาย</th>
                    <th className="py-2.5 px-3 text-right">ยอดขายรวม (฿)</th>
                    <th className="py-2.5 px-3 text-right">ต้นทุนรวม (฿)</th>
                    <th className="py-2.5 px-3 text-right">กำไรขั้นต้น (฿)</th>
                    <th className="py-2.5 px-3 text-right">สถานะต้นทุน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-mono">
                  {displayedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#9CA3AF] font-sans">
                        ไม่พบข้อมูลยอดขายเมนูในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    displayedProducts.map((p, idx) => (
                      <tr key={p.productId} className="hover:bg-[#F9FAFB]/70 transition-colors">
                        <td className="py-2.5 px-3 text-[#9CA3AF] font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-[#1F2937]">
                          {p.nameTh}
                          {p.nameEn && <div className="text-[10px] text-[#9CA3AF] font-normal">{p.nameEn}</div>}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-[#6B7280]">{p.category}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-orange-600">
                          {p.quantitySold} จาน
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#1F2937]">
                          {formatMoney(p.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600">
                          {p.hasMissingCost ? '-' : formatMoney(p.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {p.hasMissingCost ? '-' : formatMoney(p.profit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {p.hasMissingCost ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              ไม่มีต้นทุน
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              สมบูรณ์
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CHANNELS & PAYMENT METHODS                                    */}
      {/* ==================================================================== */}
      {activeTab === 'channels' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Payment Methods */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-500" />
              <span>ช่องทางการชำระเงิน</span>
            </h3>

            <div className="space-y-4 text-xs font-mono">
              {[
                { label: 'เงินสด (Cash)', amount: channels.payments.cash, color: 'bg-amber-500' },
                { label: 'พร้อมเพย์ QR (PromptPay)', amount: channels.payments.promptpay, color: 'bg-sky-500' },
                { label: 'บัตรเครดิต/โอน (Card/Transfer)', amount: channels.payments.card, color: 'bg-indigo-500' },
                { label: 'E-Wallet / อื่นๆ', amount: channels.payments.wallet, color: 'bg-purple-500' },
                { label: 'ช่องทางเดลิเวอรีรวม', amount: channels.payments.deliveryTotal, color: 'bg-emerald-500' },
              ].map((item, idx) => {
                const share =
                  pnlResult.grossSales > 0 ? (item.amount / pnlResult.grossSales) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between font-sans text-[#1F2937]">
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono font-bold text-orange-600">
                        ฿{formatMoney(item.amount)}{' '}
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          ({formatPercent(share)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Platforms Breakdown */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-500" />
              <span>แพลตฟอร์มเดลิเวอรี</span>
            </h3>

            <div className="space-y-4 text-xs font-mono">
              {[
                { label: 'GrabFood', amount: channels.payments.grab, color: 'bg-emerald-600' },
                { label: 'LINE MAN', amount: channels.payments.lineman, color: 'bg-green-500' },
                { label: 'Foodpanda', amount: channels.payments.foodpanda, color: 'bg-pink-500' },
                { label: 'แพลตฟอร์มอื่นๆ', amount: channels.payments.otherDelivery, color: 'bg-neutral-500' },
              ].map((item, idx) => {
                const share =
                  channels.payments.deliveryTotal > 0
                    ? (item.amount / channels.payments.deliveryTotal) * 100
                    : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between font-sans text-[#1F2937]">
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono font-bold text-[#1F2937]">
                        ฿{formatMoney(item.amount)}{' '}
                        <span className="text-[11px] text-[#9CA3AF] font-normal">
                          ({formatPercent(share)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl mt-4 font-sans text-[11px] text-orange-800">
                ค่าธรรมเนียม GP รวมเดลิเวอรีรอบนี้: <strong>฿{formatMoney(pnlResult.deliveryFees)}</strong>
              </div>
            </div>
          </div>

          {/* Order Types & Sources */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-orange-500" />
              <span>ประเภทการสั่ง & ที่มา</span>
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div className="text-[11px] font-sans font-bold text-[#6B7280]">ประเภทการรับประทาน:</div>
              {[
                { label: 'ทานที่ร้าน (Dine-in)', amount: channels.orderTypes.dineIn, color: 'bg-amber-500' },
                { label: 'ซื้อกลับบ้าน (Takeaway)', amount: channels.orderTypes.takeaway, color: 'bg-sky-500' },
                { label: 'เดลิเวอรี (Delivery)', amount: channels.orderTypes.delivery, color: 'bg-emerald-500' },
              ].map((item, idx) => {
                const share =
                  pnlResult.grossSales > 0 ? (item.amount / pnlResult.grossSales) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between font-sans text-[#1F2937]">
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono font-bold text-[#1F2937]">
                        ฿{formatMoney(item.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-[#F3F4F6] text-[11px] font-sans font-bold text-[#6B7280]">
                ที่มาของออเดอร์:
              </div>
              {[
                { label: 'ขายผ่านหน้าจอแคชเชียร์ (POS)', amount: channels.sources.pos, color: 'bg-orange-500' },
                { label: 'สั่งผ่านเว็บออนไลน์ (Online)', amount: channels.sources.online, color: 'bg-indigo-500' },
              ].map((item, idx) => {
                const share =
                  pnlResult.grossSales > 0 ? (item.amount / pnlResult.grossSales) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between font-sans text-[#1F2937]">
                      <span className="font-semibold">{item.label}</span>
                      <span className="font-mono font-bold text-[#1F2937]">
                        ฿{formatMoney(item.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: PROFIT & LOSS STATEMENT (P&L)                                 */}
      {/* ==================================================================== */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {/* Main Statement Breakdown Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-6 max-w-3xl mx-auto">
            <div>
              <h2 className="text-lg font-extrabold text-[#1F2937]">
                งบกำไรขาดทุน (Profit & Loss Statement)
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                ช่วงเวลา: <strong>{periodDisplayLabel}</strong> • คำนวณตามหลักการบัญชีร้านอาหารสากล
              </p>
            </div>

            <div className="space-y-4 text-xs font-mono divide-y divide-[#F3F4F6]">
              {/* 1. Net Revenue */}
              <div className="pt-2">
                <div className="flex justify-between items-center text-sm font-bold font-sans text-[#1F2937]">
                  <span>1. รายได้สุทธิจากการขายอาหาร (Net Revenue ex-VAT)</span>
                  <span className="text-orange-600 font-mono text-base font-black">
                    ฿{formatMoney(pnlResult.netRevenue)}
                  </span>
                </div>
                <div className="text-[11px] text-[#6B7280] font-sans mt-0.5">
                  ยอดขายหักส่วนลด ถอด VAT ออกเรียบร้อย (และรวม Service Charge ถ้าตั้งค่าให้นับเป็นรายได้)
                </div>
              </div>

              {/* 2. COGS Food Cost */}
              <div className="pt-3">
                <div className="flex justify-between items-center font-sans text-[#1F2937]">
                  <span className="font-semibold">หัก: ต้นทุนวัตถุดิบอาหารที่ขาย (Food Cost / COGS)</span>
                  <span className="text-rose-600 font-mono font-bold text-sm">
                    -฿{formatMoney(pnlResult.foodCost)}
                  </span>
                </div>
                <div className="text-[11px] text-[#9CA3AF] font-sans mt-0.5 flex items-center justify-between">
                  <span>จากผลรวม Snapshot ต้นทุน ณ วินาทีขายจริง</span>
                  <span className="font-mono text-rose-600">
                    Food Cost: {pnlResult.foodCostPct !== null ? `${formatPercent(pnlResult.foodCostPct)}%` : '-'}
                  </span>
                </div>
              </div>

              {/* 3. Gross Profit */}
              <div className="pt-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="font-extrabold font-sans text-emerald-950 text-sm">
                    กำไรขั้นต้น (Gross Profit)
                  </span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    ฿{formatMoney(pnlResult.grossProfit)}{' '}
                    <span className="text-xs font-normal">
                      (Margin {pnlResult.grossMarginPct !== null ? `${formatPercent(pnlResult.grossMarginPct)}%` : '-'})
                    </span>
                  </span>
                </div>
              </div>

              {/* 4. Delivery GP Fees */}
              <div className="pt-3">
                <div className="flex justify-between items-center font-sans text-[#1F2937]">
                  <span className="font-semibold">หัก: ค่าธรรมเนียม GP แพลตฟอร์มเดลิเวอรี</span>
                  <span className="text-rose-600 font-mono font-bold text-sm">
                    -฿{formatMoney(pnlResult.deliveryFees)}
                  </span>
                </div>
                <div className="text-[11px] text-[#9CA3AF] font-sans mt-0.5">
                  คำนวณจากเปอร์เซ็นต์ GP แต่ละแพลตฟอร์ม (รวมภาษี GP ตามตั้งค่า)
                </div>
              </div>

              {/* 5. Operating Expenses */}
              <div className="pt-3 space-y-2">
                <div className="flex justify-between items-center font-sans text-[#1F2937]">
                  <span className="font-semibold">หัก: ค่าใช้จ่ายดำเนินงานร้าน (Operating Expenses)</span>
                  <span className="text-rose-600 font-mono font-bold text-sm">
                    -฿{formatMoney(pnlResult.totalOperatingExpenses)}
                  </span>
                </div>

                <div className="bg-[#F9FAFB] p-3 rounded-xl space-y-1.5 font-sans text-[11px] text-[#4B5563]">
                  <div className="flex justify-between">
                    <span>• รายจ่ายประจำวัน (Daily Expenses):</span>
                    <span className="font-mono font-bold">฿{formatMoney(pnlResult.directExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• รายจ่ายประจำเดือนปันส่วน (Recurring Spread):</span>
                    <span className="font-mono font-bold">
                      ฿{formatMoney(pnlResult.recurringExpensesAllocation)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] pt-1 border-t border-[#E5E7EB]">
                    * กฎการปันส่วน: ยอดรายจ่ายประจำเดือนจะถูกหารเฉลี่ยตามจำนวนวันในแต่ละเดือนเพื่อความเที่ยงตรง
                  </div>
                </div>
              </div>

              {/* 6. Net Profit / Loss */}
              <div className="pt-4">
                <div
                  className={`p-4 rounded-xl flex items-center justify-between border ${
                    pnlResult.netProfit >= 0
                      ? 'bg-sky-50 border-sky-200 text-sky-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div>
                    <div className="font-black font-sans text-base">
                      {pnlResult.netProfit >= 0 ? 'กำไรสุทธิ (Net Operating Profit)' : 'ขาดทุนสุทธิ (Net Operating Loss)'}
                    </div>
                    <div className="text-xs opacity-80">
                      อัตรากำไรสุทธิ:{' '}
                      {pnlResult.netMarginPct !== null ? `${formatPercent(pnlResult.netMarginPct)}%` : '-'}
                    </div>
                  </div>
                  <div
                    className={`text-2xl font-black font-mono ${
                      pnlResult.netProfit >= 0 ? 'text-sky-700' : 'text-rose-600'
                    }`}
                  >
                    ฿{formatMoney(pnlResult.netProfit)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Year View Table (12 Months Breakdown) */}
          {periodMode === 'year' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="font-extrabold text-sm text-[#1F2937]">
                ตารางสรุปรายเดือน ประจำปี {selectedYear} (12 เดือน)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-sans">
                    <tr>
                      <th className="py-2.5 px-3">เดือน</th>
                      <th className="py-2.5 px-3 text-right">ยอดขายสุทธิ</th>
                      <th className="py-2.5 px-3 text-right">ต้นทุนอาหาร (COGS)</th>
                      <th className="py-2.5 px-3 text-right">กำไรขั้นต้น</th>
                      <th className="py-2.5 px-3 text-right">GP เดลิเวอรี</th>
                      <th className="py-2.5 px-3 text-right">ค่าใช้จ่ายร้าน</th>
                      <th className="py-2.5 px-3 text-right">กำไรสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {yearMonthlyBreakdown.map((row) => (
                      <tr key={row.monthNumber} className="hover:bg-[#F9FAFB]/70">
                        <td className="py-2 px-3 font-sans font-bold text-[#1F2937]">{row.monthLabel}</td>
                        <td className="py-2 px-3 text-right text-[#1F2937]">
                          {formatMoney(row.pnl.netRevenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-600">
                          {row.pnl.hasMissingFoodCost ? (
                            <span className="text-amber-600" title="มีเมนูไม่มีต้นทุน">
                              {formatMoney(row.pnl.foodCost)}*
                            </span>
                          ) : (
                            formatMoney(row.pnl.foodCost)
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          {formatMoney(row.pnl.grossProfit)}
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-500">
                          {formatMoney(row.pnl.deliveryFees)}
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-500">
                          {formatMoney(row.pnl.totalOperatingExpenses)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-black ${
                            row.pnl.netProfit >= 0 ? 'text-sky-600' : 'text-rose-600'
                          }`}
                        >
                          {formatMoney(row.pnl.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Month View Table (Daily Breakdown) */}
          {periodMode === 'month' && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="font-extrabold text-sm text-[#1F2937]">
                ตารางสรุปรายวัน ประจำเดือน {selectedMonth}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-sans">
                    <tr>
                      <th className="py-2.5 px-3">วันที่</th>
                      <th className="py-2.5 px-3 text-right">บิล</th>
                      <th className="py-2.5 px-3 text-right">ยอดขายสุทธิ</th>
                      <th className="py-2.5 px-3 text-right">ต้นทุนอาหาร</th>
                      <th className="py-2.5 px-3 text-right">กำไรขั้นต้น</th>
                      <th className="py-2.5 px-3 text-right">ค่าใช้จ่ายร้าน</th>
                      <th className="py-2.5 px-3 text-right">กำไรสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {monthDailyBreakdown.map((row) => (
                      <tr key={row.dayNumber} className="hover:bg-[#F9FAFB]/70">
                        <td className="py-2 px-3 font-bold text-[#1F2937]">
                          วันที่ {row.dayNumber}
                        </td>
                        <td className="py-2 px-3 text-right text-[#6B7280]">
                          {row.pnl.paidBillsCount}
                        </td>
                        <td className="py-2 px-3 text-right text-[#1F2937]">
                          {formatMoney(row.pnl.netRevenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-600">
                          {formatMoney(row.pnl.foodCost)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          {formatMoney(row.pnl.grossProfit)}
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-500">
                          {formatMoney(row.pnl.totalOperatingExpenses)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-black ${
                            row.pnl.netProfit >= 0 ? 'text-sky-600' : 'text-rose-600'
                          }`}
                        >
                          {formatMoney(row.pnl.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: MENU ENGINEERING MATRIX (BCG)                                 */}
      {/* ==================================================================== */}
      {activeTab === 'menu_engineering' && (
        <div className="space-y-6">
          {/* Header Explanation */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-2">
            <h2 className="text-base font-extrabold text-[#1F2937] flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-500" />
              <span>การวิเคราะห์ความสามารถของเมนู (Menu Engineering Matrix)</span>
            </h2>
            <p className="text-xs text-[#6B7280] leading-relaxed max-w-3xl">
              จำแนกเมนูอาหารออกเป็น 4 กลุ่ม โดยเปรียบเทียบระหว่าง <strong>จำนวนจานที่ขาย (ความนิยม)</strong> กับ{' '}
              <strong>กำไรต่อจาน</strong> เทียบกับค่าเฉลี่ยของร้าน (เฉลี่ย{' '}
              <strong className="font-mono text-orange-600">
                {menuEngineeringData.avgQuantitySold.toFixed(1)} จาน
              </strong>{' '}
              และกำไรเฉลี่ย{' '}
              <strong className="font-mono text-emerald-600">
                ฿{menuEngineeringData.avgProfitPerUnit.toFixed(1)}/จาน
              </strong>
              )
            </p>
          </div>

          {/* 4 Quadrants Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stars */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-emerald-900 font-extrabold text-sm">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  ⭐ Star (ดาวเด่น)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-xs font-mono font-bold">
                  {menuEngineeringData.items.filter((i) => i.classification === 'star').length}
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-800">ขายดี & กำไรดี</div>
              <p className="text-[11px] text-emerald-700 leading-snug">
                รักษามาตรฐานสูตรและรสชาติให้คงที่ วางไว้ตำแหน่งเด่นที่สุดในเมนู
              </p>
            </div>

            {/* Plowhorses */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-amber-900 font-extrabold text-sm">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-600" />
                  🐴 Plowhorse (ม้างาน)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-mono font-bold">
                  {menuEngineeringData.items.filter((i) => i.classification === 'plowhorse').length}
                </span>
              </div>
              <div className="text-xs font-bold text-amber-800">ขายดี แต่กำไรต่ำ</div>
              <p className="text-[11px] text-amber-700 leading-snug">
                พิจารณาปรับขึ้นราคา 5-10 บาท หรือหาวิธีลดต้นทุนวัตถุดิบ/ปรับ Portion
              </p>
            </div>

            {/* Puzzles */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-sky-900 font-extrabold text-sm">
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-sky-600" />
                  ❓ Puzzle (ปริศนา)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-sky-200 text-sky-900 text-xs font-mono font-bold">
                  {menuEngineeringData.items.filter((i) => i.classification === 'puzzle').length}
                </span>
              </div>
              <div className="text-xs font-bold text-sky-800">ขายน้อย แต่กำไรดี</div>
              <p className="text-[11px] text-sky-700 leading-snug">
                ให้พนักงานแนะนำลูกค้า, ทำป้ายเชียร์ขาย หรือนำมาจัดโปรโมชั่นเซ็ต
              </p>
            </div>

            {/* Dogs */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-rose-900 font-extrabold text-sm">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  🐶 Dog (ตัวปัญหา)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-xs font-mono font-bold">
                  {menuEngineeringData.items.filter((i) => i.classification === 'dog').length}
                </span>
              </div>
              <div className="text-xs font-bold text-rose-800">ขายน้อย & กำไรต่ำ</div>
              <p className="text-[11px] text-rose-700 leading-snug">
                พิจารณาถอดออกจากเมนูเพื่อลดสต็อกของสดเหลือทิ้ง หรือปรับสูตรใหม่
              </p>
            </div>
          </div>

          {/* Filter Toolbar & Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#6B7280] font-semibold">กลุ่มเมนู:</span>
                <select
                  value={menuMatrixFilter}
                  onChange={(e) => setMenuMatrixFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl font-bold text-[#1F2937] bg-white outline-none"
                >
                  <option value="all">ทั้งหมด ({menuEngineeringData.items.length})</option>
                  <option value="star">⭐ Star (ขายดี กำไรดี)</option>
                  <option value="plowhorse">🐴 Plowhorse (ขายดี กำไรต่ำ)</option>
                  <option value="puzzle">❓ Puzzle (ขายน้อย กำไรดี)</option>
                  <option value="dog">🐶 Dog (ขายน้อย กำไรต่ำ)</option>
                </select>

                <span className="text-[#6B7280] font-semibold ml-2">เรียงตาม:</span>
                <select
                  value={menuMatrixSort}
                  onChange={(e) => setMenuMatrixSort(e.target.value as any)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-xl font-bold text-[#1F2937] bg-white outline-none"
                >
                  <option value="qty">จำนวนขายสูงสุด (Qty)</option>
                  <option value="profit">กำไรต่อจานสูงสุด (Unit Profit)</option>
                  <option value="revenue">ยอดขายรวมสูงสุด (Revenue)</option>
                </select>
              </div>

              <div className="text-xs text-[#6B7280]">
                แสดง <strong>{displayedMenuEngineering.length}</strong> รายการ
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] font-sans">
                  <tr>
                    <th className="py-2.5 px-3">กลุ่ม</th>
                    <th className="py-2.5 px-3">เมนูอาหาร</th>
                    <th className="py-2.5 px-3 text-right">จำนวนขาย</th>
                    <th className="py-2.5 px-3 text-right">กำไรต่อจาน</th>
                    <th className="py-2.5 px-3 text-right">ยอดขายรวม</th>
                    <th className="py-2.5 px-3 text-right">กำไรรวม</th>
                    <th className="py-2.5 px-4">คำแนะนำการดำเนินการ (Action Hint)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {displayedMenuEngineering.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#9CA3AF] font-sans">
                        ไม่มีข้อมูลเมนูในกลุ่มนี้
                      </td>
                    </tr>
                  ) : (
                    displayedMenuEngineering.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F9FAFB]/70">
                        <td className="py-2.5 px-3 font-sans font-bold whitespace-nowrap">
                          {item.classification === 'star' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              ⭐ Star
                            </span>
                          )}
                          {item.classification === 'plowhorse' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                              🐴 Plowhorse
                            </span>
                          )}
                          {item.classification === 'puzzle' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
                              ❓ Puzzle
                            </span>
                          )}
                          {item.classification === 'dog' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                              🐶 Dog
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-[#1F2937] whitespace-nowrap">
                          {item.nameTh}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-orange-600">
                          {item.quantitySold} จาน
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {item.hasMissingCost ? '-' : `฿${formatMoney(item.unitProfit)}`}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#1F2937]">
                          ฿{formatMoney(item.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {item.hasMissingCost ? '-' : `฿${formatMoney(item.totalProfit)}`}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-xs text-[#4B5563]">
                          {language === 'th' ? item.actionHint.th : item.actionHint.en}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LINE SUMMARY FALLBACK MODAL                                          */}
      {/* ==================================================================== */}
      {isLineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 border border-[#E5E7EB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-[#1F2937]">
                  สรุปยอดสำหรับส่ง LINE
                </h3>
              </div>
              <button
                onClick={() => setIsLineModalOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1F2937]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#6B7280]">
              หากเบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ คุณสามารถเลือกข้อความในกล่องด้านล่างแล้วกดคัดลอกด้วยตนเองได้:
            </p>

            <textarea
              readOnly
              rows={14}
              value={generatedLineText}
              className="w-full p-3 font-mono text-xs bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[#1F2937] leading-relaxed focus:outline-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsLineModalOpen(false)}
                className="px-4 py-2 border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#6B7280] hover:bg-[#F9FAFB]"
              >
                ปิด
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(generatedLineText);
                    showToast({ title: 'สำเร็จ', message: 'คัดลอกเรียบร้อย', type: 'success' });
                  } catch {
                    showToast({ title: 'โปรดเลือกและคัดลอกเอง', message: 'กรุณาไฮไลต์ข้อความและกด Ctrl+C / Cmd+C', type: 'info' });
                  }
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                <span>คัดลอกข้อความ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
