import React, { useState, useEffect } from 'react';
import { Order, Expense, ExpenseCategory, Product, Recipe } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  Users,
  Calendar,
  Plus,
  Trash2,
  Sparkles,
  Award,
  HelpCircle,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Filter,
  X,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { t, language, formatCurrency, formatDate } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [activeReportTab, setActiveReportTab] = useState<'overview' | 'pnl' | 'menu_matrix' | 'expenses'>('overview');

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{
    title: string;
    category: ExpenseCategory;
    amount: number;
    paymentMethod: string;
    notes: string;
  }>({
    title: '',
    category: 'raw_materials',
    amount: 500,
    paymentMethod: 'promptpay',
    notes: '',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const [ordList, expList, prodList, recList] = await Promise.all([
      dbGetAll<Order>('orders'),
      dbGetAll<Expense>('expenses'),
      dbGetAll<Product>('products'),
      dbGetAll<Recipe>('recipes'),
    ]);
    setOrders(ordList);
    setExpenses(expList);
    setProducts(prodList);
    setRecipes(recList);
  };

  // Filter orders by time range
  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    if (o.status !== 'paid') return false;
    const orderDate = new Date(o.paidAt || o.createdAt);
    if (timeRange === 'today') {
      return orderDate.toDateString() === now.toDateString();
    } else if (timeRange === '7days') {
      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    } else if (timeRange === '30days') {
      const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    }
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    const expDate = new Date(e.date);
    if (timeRange === 'today') {
      return expDate.toDateString() === now.toDateString();
    } else if (timeRange === '7days') {
      const diffDays = (now.getTime() - expDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    } else if (timeRange === '30days') {
      const diffDays = (now.getTime() - expDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    }
    return true;
  });

  // Financial Calculations
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCOGS = filteredOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  const totalOperatingExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalOperatingExpenses;
  const netMarginPct = totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

  const totalTickets = filteredOrders.length;
  const avgOrderValue = totalTickets > 0 ? totalRevenue / totalTickets : 0;
  const totalGuests = filteredOrders.reduce((sum, o) => sum + (o.guestCount || 1), 0);
  const avgSpendPerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;

  // Payment Breakdown
  const paymentBreakdown = {
    cash: filteredOrders.filter((o) => o.paymentMethod === 'cash').reduce((sum, o) => sum + o.totalAmount, 0),
    promptpay: filteredOrders
      .filter((o) => o.paymentMethod === 'promptpay' || o.paymentMethod === 'qr_code')
      .reduce((sum, o) => sum + o.totalAmount, 0),
    card: filteredOrders
      .filter((o) => o.paymentMethod === 'credit_card' || o.paymentMethod === 'transfer')
      .reduce((sum, o) => sum + o.totalAmount, 0),
  };

  // Order Type Breakdown
  const orderTypeBreakdown = {
    dineIn: filteredOrders.filter((o) => o.orderType === 'dine_in').reduce((sum, o) => sum + o.totalAmount, 0),
    takeaway: filteredOrders.filter((o) => o.orderType === 'takeaway').reduce((sum, o) => sum + o.totalAmount, 0),
    delivery: filteredOrders.filter((o) => o.orderType === 'delivery').reduce((sum, o) => sum + o.totalAmount, 0),
  };

  // Dish Sales Volume & Menu Engineering
  const itemSalesMap: Record<
    string,
    { productId: string; name: string; quantity: number; revenue: number; cost: number; profit: number }
  > = {};

  filteredOrders.forEach((ord) => {
    ord.items.forEach((item) => {
      if (!itemSalesMap[item.productId]) {
        itemSalesMap[item.productId] = {
          productId: item.productId,
          name: language === 'th' ? item.productNameTh : item.productNameEn,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }
      const lineCost = item.unitCost * item.quantity;
      itemSalesMap[item.productId].quantity += item.quantity;
      itemSalesMap[item.productId].revenue += item.lineTotal;
      itemSalesMap[item.productId].cost += lineCost;
      itemSalesMap[item.productId].profit += item.lineTotal - lineCost;
    });
  });

  const dishSalesList = Object.values(itemSalesMap).sort((a, b) => b.quantity - a.quantity);

  // Menu Engineering Matrix Calculations (Stars, Plowhorses, Puzzles, Dogs)
  const avgQuantitySold =
    dishSalesList.length > 0
      ? dishSalesList.reduce((acc, d) => acc + d.quantity, 0) / dishSalesList.length
      : 0;

  const avgProfitPerDish =
    dishSalesList.length > 0
      ? dishSalesList.reduce((acc, d) => acc + (d.quantity > 0 ? d.profit / d.quantity : 0), 0) /
        dishSalesList.length
      : 0;

  const categorizedDishes = dishSalesList.map((dish) => {
    const unitProfit = dish.quantity > 0 ? dish.profit / dish.quantity : 0;
    const isHighPopularity = dish.quantity >= avgQuantitySold;
    const isHighProfit = unitProfit >= avgProfitPerDish;

    let quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog';
    if (isHighPopularity && isHighProfit) quadrant = 'star';
    else if (isHighPopularity && !isHighProfit) quadrant = 'plowhorse';
    else if (!isHighPopularity && isHighProfit) quadrant = 'puzzle';
    else quadrant = 'dog';

    return {
      ...dish,
      unitProfit,
      quadrant,
    };
  });

  // Handle Add Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) return;

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      title: expenseForm.title.trim(),
      category: expenseForm.category,
      amount: expenseForm.amount,
      paymentMethod: expenseForm.paymentMethod,
      notes: expenseForm.notes.trim(),
    };

    await dbPut('expenses', newExpense);
    setIsExpenseModalOpen(false);
    setExpenseForm({
      title: '',
      category: 'raw_materials',
      amount: 500,
      paymentMethod: 'promptpay',
      notes: '',
    });
    await loadAllData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('ต้องการลบรายการค่าใช้จ่ายนี้หรือไม่?')) return;
    await dbDelete('expenses', id);
    await loadAllData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Time Range Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-tight">{t.financialReports}</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {language === 'th'
              ? 'สรุปรายได้ ยอดขาย ต้นทุนอาหาร (COGS) กำไรสุทธิ (P&L) และวิเคราะห์เมนูทำเงิน'
              : 'Real-time sales, Cost of Goods Sold (COGS), P&L statement, and Menu Engineering.'}
          </p>
        </div>

        {/* Time range pills */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
          {[
            { id: 'today', label: language === 'th' ? 'วันนี้' : 'Today' },
            { id: '7days', label: language === 'th' ? '7 วันล่าสุด' : '7 Days' },
            { id: '30days', label: language === 'th' ? '30 วันล่าสุด' : '30 Days' },
            { id: 'all', label: language === 'th' ? 'ทั้งหมด' : 'All Time' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeRange(item.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                timeRange === item.id
                  ? 'bg-amber-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-neutral-800 text-xs font-semibold gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveReportTab('overview')}
          className={`py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
            activeReportTab === 'overview'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          {language === 'th' ? 'ภาพรวมยอดขาย' : 'Sales Overview'}
        </button>
        <button
          onClick={() => setActiveReportTab('pnl')}
          className={`py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
            activeReportTab === 'pnl'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          {language === 'th' ? 'งบกำไรขาดทุน (P&L)' : 'Profit & Loss (P&L)'}
        </button>
        <button
          onClick={() => setActiveReportTab('menu_matrix')}
          className={`py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
            activeReportTab === 'menu_matrix'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          {t.menuEngineering}
        </button>
        <button
          onClick={() => setActiveReportTab('expenses')}
          className={`py-2.5 px-4 border-b-2 transition whitespace-nowrap ${
            activeReportTab === 'expenses'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          {language === 'th' ? 'บันทึกค่าใช้จ่ายร้าน' : 'Store Expenses'}
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeReportTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400">{t.salesRevenue}</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                จาก {totalTickets} บิลชำระเงินแล้ว
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400">{t.cogsCost}</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">
                {formatCurrency(totalCOGS)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                Food Cost สุทธิ {totalRevenue > 0 ? ((totalCOGS / totalRevenue) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400">{t.grossProfit}</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {formatCurrency(grossProfit)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                Gross Margin {grossMarginPct}%
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400">{t.netProfit}</div>
              <div
                className={`text-2xl font-black font-mono mt-1 ${
                  netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(netProfit)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                (หักค่าใช้จ่าย ฿{totalOperatingExpenses.toLocaleString()})
              </div>
            </div>
          </div>

          {/* Breakdown Section: Payment Methods & Order Types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Method Chart Cards */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {language === 'th' ? 'ช่องทางการชำระเงิน' : 'Payment Methods Breakdown'}
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.promptpay} (QR)</span>
                    <span className="font-mono font-bold text-sky-400">
                      {formatCurrency(paymentBreakdown.promptpay)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.promptpay / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.cash}</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(paymentBreakdown.cash)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.cash / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.creditCard} / โอน</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(paymentBreakdown.card)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.card / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Order Type Distribution */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {language === 'th' ? 'สัดส่วนประเภทการขาย' : 'Order Channels'}
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.dineIn}</span>
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(orderTypeBreakdown.dineIn)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (orderTypeBreakdown.dineIn / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.takeaway}</span>
                    <span className="font-mono font-bold text-sky-400">
                      {formatCurrency(orderTypeBreakdown.takeaway)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (orderTypeBreakdown.takeaway / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-neutral-300 mb-1">
                    <span>{t.delivery}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(orderTypeBreakdown.delivery)}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${totalRevenue > 0 ? (orderTypeBreakdown.delivery / totalRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Items Table */}
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {t.topSellingDishes}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">เมนูอาหาร</th>
                    <th className="py-2.5 px-3 text-right">จำนวนที่ขาย</th>
                    <th className="py-2.5 px-3 text-right">ยอดขายรวม</th>
                    <th className="py-2.5 px-3 text-right">กำไรขั้นต้นรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 font-sans">
                  {dishSalesList.slice(0, 5).map((dish, idx) => (
                    <tr key={dish.productId} className="hover:bg-neutral-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-neutral-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{dish.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                        {dish.quantity} จาน
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-200">
                        {formatCurrency(dish.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(dish.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: P&L STATEMENT */}
      {activeReportTab === 'pnl' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white">งบกำไรขาดทุน (Profit & Loss Statement)</h3>
            <p className="text-xs text-neutral-400">
              คำนวณจากยอดขายจริง หักลบด้วยต้นทุนวัตถุดิบและค่าใช้จ่ายดำเนินงานทั้งหมด
            </p>
          </div>

          <div className="space-y-4 max-w-xl text-xs font-mono">
            {/* Revenue */}
            <div className="flex justify-between items-center py-2 border-b border-neutral-800">
              <span className="font-bold text-white text-sm">1. รายได้จากการขายอาหารและเครื่องดื่ม</span>
              <span className="font-bold text-amber-400 text-sm">{formatCurrency(totalRevenue)}</span>
            </div>

            {/* COGS */}
            <div className="flex justify-between items-center py-2 border-b border-neutral-800/60 pl-4 text-neutral-300">
              <span>หัก: ต้นทุนขายวัตถุดิบอาหารจริง (COGS)</span>
              <span className="text-rose-400">-{formatCurrency(totalCOGS)}</span>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between items-center py-2 bg-neutral-950 px-3 rounded-lg border border-neutral-800">
              <span className="font-bold text-emerald-400 text-sm">กำไรขั้นต้น (Gross Profit)</span>
              <span className="font-bold text-emerald-400 text-sm">{formatCurrency(grossProfit)} ({grossMarginPct}%)</span>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1.5 pl-4 pt-2">
              <span className="font-bold text-neutral-300 block mb-1">2. ค่าใช้จ่ายดำเนินงานร้าน (Operating Expenses):</span>
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="flex justify-between text-neutral-400 text-[11px]">
                  <span>• {exp.title} ({exp.category})</span>
                  <span>{formatCurrency(exp.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-neutral-300 pt-1 border-t border-neutral-800">
                <span>รวมค่าใช้จ่ายดำเนินงาน:</span>
                <span className="text-rose-400">-{formatCurrency(totalOperatingExpenses)}</span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="flex justify-between items-center py-3 bg-neutral-950 px-4 rounded-xl border border-neutral-700 pt-3">
              <span className="font-black text-white text-base">กำไรสุทธิ (Net Operating Profit)</span>
              <span
                className={`font-black text-xl ${
                  netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MENU ENGINEERING MATRIX (BCG) */}
      {activeReportTab === 'menu_matrix' && (
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>{t.menuEngineering}</span>
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl">
              การจัดกลุ่มเมนูอาหาร 4 มิติ โดยเปรียบเทียบระหว่าง <strong>ความนิยม (ยอดขายจาน)</strong> กับ <strong>ความสามารถในการทำกำไรต่อจาน</strong> เพื่อวางกลยุทธ์การขายที่แม่นยำ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stars */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Award className="w-4 h-4" />
                <span>{t.starItem}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                ขายดีมาก & กำไรต่อจานสูง → รักษามาตรฐานสูตรและรสชาติให้คงที่, ให้ตำแหน่งเด่นที่สุดในเมนู
              </p>
              <div className="space-y-1.5 pt-2">
                {categorizedDishes.filter((d) => d.quadrant === 'star').map((d) => (
                  <div key={d.productId} className="flex justify-between text-xs p-2 bg-neutral-950 rounded-lg">
                    <span className="font-bold text-white">{d.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {d.quantity} จาน • กำไร ฿{d.unitProfit.toFixed(0)}/จาน
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plowhorses */}
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Flame className="w-4 h-4" />
                <span>{t.plowhorseItem}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                ขายดีมากแต่กำไรต่ำ → พิจารณาปรับขึ้นราคา 5-10 บ. หรือหาวิธีลดต้นทุนวัตถุดิบ/ปรับ Portion
              </p>
              <div className="space-y-1.5 pt-2">
                {categorizedDishes.filter((d) => d.quadrant === 'plowhorse').map((d) => (
                  <div key={d.productId} className="flex justify-between text-xs p-2 bg-neutral-950 rounded-lg">
                    <span className="font-bold text-white">{d.name}</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {d.quantity} จาน • กำไร ฿{d.unitProfit.toFixed(0)}/จาน
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Puzzles */}
            <div className="p-4 bg-sky-950/20 border border-sky-800/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <HelpCircle className="w-4 h-4" />
                <span>{t.puzzleItem}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                กำไรต่อจานสูงแต่ยอดขายน้อย → ให้พนักงานแนะนำลูกค้า, จัดทำป้ายแนะนำ, หรือนำมาจัดโปรโมชั่นเซ็ต
              </p>
              <div className="space-y-1.5 pt-2">
                {categorizedDishes.filter((d) => d.quadrant === 'puzzle').map((d) => (
                  <div key={d.productId} className="flex justify-between text-xs p-2 bg-neutral-950 rounded-lg">
                    <span className="font-bold text-white">{d.name}</span>
                    <span className="font-mono text-sky-400 font-bold">
                      {d.quantity} จาน • กำไร ฿{d.unitProfit.toFixed(0)}/จาน
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dogs */}
            <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{t.dogItem}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                ยอดขายน้อยและกำไรต่ำ → พิจารณาถอดออกจากเมนูเพื่อลดสต็อกของสดเหลือทิ้ง หรือปรับสูตรใหม่
              </p>
              <div className="space-y-1.5 pt-2">
                {categorizedDishes.filter((d) => d.quadrant === 'dog').map((d) => (
                  <div key={d.productId} className="flex justify-between text-xs p-2 bg-neutral-950 rounded-lg">
                    <span className="font-bold text-white">{d.name}</span>
                    <span className="font-mono text-rose-400 font-bold">
                      {d.quantity} จาน • กำไร ฿{d.unitProfit.toFixed(0)}/จาน
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXPENSES TRACKER */}
      {activeReportTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">บันทึกค่าใช้จ่ายร้าน (Operating Expenses)</h3>
              <p className="text-xs text-neutral-400">บันทึกค่าเช่า ค่าจ้าง ค่าน้ำค่าไฟ บรรจุภัณฑ์ เพื่อนำไปหักกำไรสุทธิ</p>
            </div>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addExpense}</span>
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th className="py-2.5 px-4">วันที่</th>
                  <th className="py-2.5 px-3">รายการ</th>
                  <th className="py-2.5 px-3">หมวดหมู่</th>
                  <th className="py-2.5 px-3 text-right">จำนวนเงิน (฿)</th>
                  <th className="py-2.5 px-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      ยังไม่มีรายการค่าใช้จ่ายในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-neutral-800/40">
                      <td className="py-2.5 px-4 font-mono text-neutral-400">{formatDate(exp.date)}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {exp.title}
                        {exp.notes && <div className="text-[10px] text-neutral-500 font-normal">{exp.notes}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-neutral-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1 text-neutral-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="font-bold text-white text-sm">บันทึกค่าใช้จ่ายใหม่</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">ชื่อรายการค่าใช้จ่าย *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ค่าบรรจุภัณฑ์, ค่าน้ำแข็ง, ค่าแก๊ส"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">หมวดหมู่</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  <option value="raw_materials">ซื้อวัตถุดิบอาหารสดหน้าร้าน</option>
                  <option value="packaging">บรรจุภัณฑ์ / กล่อง / แก้ว</option>
                  <option value="utilities">ค่าน้ำ / ค่าไฟ / ค่าแก๊ส</option>
                  <option value="salary">ค่าแรง / ค่าจ้างพนักงาน</option>
                  <option value="rent">ค่าเช่าร้าน</option>
                  <option value="maintenance">ค่าซ่อมบำรุง / อุปกรณ์</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">จำนวนเงิน (฿) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
