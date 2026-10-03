import React, { useState, useEffect } from 'react';
import { Expense, RecurringExpense, RestaurantSettings } from '../../types';
import { dbGetAll, dbPut, dbDelete, dbGet } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import {
  Wallet,
  Plus,
  Search,
  Trash2,
  Calendar,
  Filter,
  Repeat,
  Info,
  DollarSign,
  Tag,
  Edit2,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';
import { generateUUID } from '../../utils/uuid';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../types';

export const ExpensesView: React.FC = () => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [activeTab, setActiveTab] = useState<'daily' | 'recurring' | 'categories'>('daily');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Daily Expense Modal State
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dailyForm, setDailyForm] = useState<{
    id?: string;
    title: string;
    category: string;
    amount: number;
    paymentMethod: string;
    notes: string;
    date: string;
  }>({
    title: '',
    category: 'ค่าเช่า',
    amount: 500,
    paymentMethod: 'cash',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Recurring Expense Modal State (Section 8.1)
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState<{
    id?: string;
    name: string;
    categoryId: string;
    amountPerMonth: number;
    dayOfMonth: number;
    startDate: string;
    endDate?: string;
  }>({
    name: '',
    categoryId: 'ค่าเช่า',
    amountPerMonth: 15000,
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  // Category Management State
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const [expList, metaRec, savedSettings] = await Promise.all([
      dbGetAll<Expense>('expenses'),
      dbGet<{ id: string; list: RecurringExpense[] }>('meta', 'recurring_expenses'),
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

    setExpenses(expList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setRecurringExpenses(Array.isArray(loadedRec) ? loadedRec : []);
    if (savedSettings) {
      setSettings(savedSettings);
    }
  };

  const categories: string[] =
    settings?.expenseCategories && settings.expenseCategories.length > 0
      ? settings.expenseCategories
      : [...DEFAULT_EXPENSE_CATEGORIES];

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const catName = newCategoryName.trim();
    if (categories.includes(catName)) {
      showToast({ title: 'หมวดหมู่นี้มีอยู่แล้ว', message: `หมวดหมู่ "${catName}" มีอยู่ในระบบแล้ว`, type: 'info' });
      return;
    }

    const updatedCategories = [...categories, catName];
    const updatedSettings: RestaurantSettings = {
      ...(settings || ({} as RestaurantSettings)),
      id: 'current_settings',
      restaurantNameTh: settings?.restaurantNameTh || "Tony's Kitchen",
      restaurantNameEn: settings?.restaurantNameEn || "Tony's Kitchen",
      tagline: settings?.tagline || '',
      addressTh: settings?.addressTh || '',
      addressEn: settings?.addressEn || '',
      phone: settings?.phone || '',
      taxId: settings?.taxId || '',
      promptPayId: settings?.promptPayId || '',
      promptPayName: settings?.promptPayName || '',
      currency: settings?.currency || 'THB',
      vatEnabled: settings?.vatEnabled ?? false,
      vatRate: settings?.vatRate ?? 7,
      vatInclusive: settings?.vatInclusive ?? true,
      serviceChargeEnabled: settings?.serviceChargeEnabled ?? false,
      serviceChargeRate: settings?.serviceChargeRate ?? 10,
      receiptHeaderMessage: settings?.receiptHeaderMessage || '',
      receiptFooterMessage: settings?.receiptFooterMessage || '',
      receiptWidth: settings?.receiptWidth || '80mm',
      language: settings?.language || 'th',
      defaultTableZone: settings?.defaultTableZone || 'indoor',
      soundEnabled: settings?.soundEnabled ?? true,
      expenseCategories: updatedCategories,
    };

    setSettings(updatedSettings);
    await dbPut('settings', updatedSettings);
    setNewCategoryName('');
    showToast({ title: 'เพิ่มหมวดหมู่สำเร็จ', message: `เพิ่มหมวดหมู่ "${catName}" เรียบร้อย`, type: 'success' });
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!confirm(`คุณต้องการลบหมวดหมู่ "${catName}" หรือไม่?`)) return;
    const updatedCategories = categories.filter((c) => c !== catName);
    const updatedSettings: RestaurantSettings = {
      ...(settings || ({} as RestaurantSettings)),
      id: 'current_settings',
      restaurantNameTh: settings?.restaurantNameTh || "Tony's Kitchen",
      restaurantNameEn: settings?.restaurantNameEn || "Tony's Kitchen",
      tagline: settings?.tagline || '',
      addressTh: settings?.addressTh || '',
      addressEn: settings?.addressEn || '',
      phone: settings?.phone || '',
      taxId: settings?.taxId || '',
      promptPayId: settings?.promptPayId || '',
      promptPayName: settings?.promptPayName || '',
      currency: settings?.currency || 'THB',
      vatEnabled: settings?.vatEnabled ?? false,
      vatRate: settings?.vatRate ?? 7,
      vatInclusive: settings?.vatInclusive ?? true,
      serviceChargeEnabled: settings?.serviceChargeEnabled ?? false,
      serviceChargeRate: settings?.serviceChargeRate ?? 10,
      receiptHeaderMessage: settings?.receiptHeaderMessage || '',
      receiptFooterMessage: settings?.receiptFooterMessage || '',
      receiptWidth: settings?.receiptWidth || '80mm',
      language: settings?.language || 'th',
      defaultTableZone: settings?.defaultTableZone || 'indoor',
      soundEnabled: settings?.soundEnabled ?? true,
      expenseCategories: updatedCategories.length > 0 ? updatedCategories : [...DEFAULT_EXPENSE_CATEGORIES],
    };

    setSettings(updatedSettings);
    await dbPut('settings', updatedSettings);
    showToast({ title: 'ลบหมวดหมู่แล้ว', message: `ลบหมวดหมู่ "${catName}" เรียบร้อย`, type: 'info' });
  };

  // Save Daily Expense
  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyForm.title.trim() || dailyForm.amount <= 0) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกข้อมูลรายจ่ายให้ครบถ้วน', type: 'error' });
      return;
    }

    const exp: Expense = {
      id: dailyForm.id || generateUUID(),
      date: dailyForm.date ? new Date(dailyForm.date).toISOString() : new Date().toISOString(),
      title: dailyForm.title.trim(),
      categoryId: dailyForm.category,
      category: dailyForm.category,
      amount: Number(dailyForm.amount),
      paymentMethod: dailyForm.paymentMethod,
      notes: dailyForm.notes.trim(),
      note: dailyForm.notes.trim(),
    };

    await dbPut('expenses', exp);
    showToast({ title: 'บันทึกสำเร็จ', message: `บันทึก "${exp.title}" ฿${exp.amount} เรียบร้อย`, type: 'success' });
    setIsDailyModalOpen(false);
    setDailyForm({
      title: '',
      category: categories[0] || 'ค่าเช่า',
      amount: 500,
      paymentMethod: 'cash',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    loadAllData();
  };

  // Delete Daily Expense
  const handleDeleteDaily = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบรายการ "${title}" หรือไม่?`)) return;
    await dbDelete('expenses', id);
    showToast({ title: 'ลบรายการแล้ว', message: `ลบ "${title}" เรียบร้อย`, type: 'info' });
    loadAllData();
  };

  // Save Recurring Expense (Section 8.1)
  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.name.trim() || recurringForm.amountPerMonth <= 0) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกชื่อและยอดเงินต่อเดือน', type: 'error' });
      return;
    }

    const recExp: RecurringExpense = {
      id: recurringForm.id || generateUUID(),
      name: recurringForm.name.trim(),
      categoryId: recurringForm.categoryId,
      amountPerMonth: Number(recurringForm.amountPerMonth),
      dayOfMonth: Number(recurringForm.dayOfMonth) || 1,
      startDate: recurringForm.startDate || new Date().toISOString().split('T')[0],
      endDate: recurringForm.endDate?.trim() || undefined,
    };

    // Store in meta store and local storage
    const currentRec = [...recurringExpenses.filter((r) => r.id !== recExp.id), recExp];
    setRecurringExpenses(currentRec);
    await dbPut('meta', { id: 'recurring_expenses', list: currentRec });
    try {
      localStorage.setItem('tonys_recurring_expenses', JSON.stringify(currentRec));
    } catch {
      // ignore
    }

    showToast({
      title: 'บันทึกรายจ่ายประจำสำเร็จ',
      message: `${recExp.name}: ฿${recExp.amountPerMonth}/เดือน (กระจายคิดใน P&L อัตโนมัติ)`,
      type: 'success',
    });
    setIsRecurringModalOpen(false);
  };

  // Delete Recurring Expense
  const handleDeleteRecurring = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบรายจ่ายประจำ "${name}" หรือไม่?`)) return;
    const updated = recurringExpenses.filter((r) => r.id !== id);
    setRecurringExpenses(updated);
    await dbPut('meta', { id: 'recurring_expenses', list: updated });
    try {
      localStorage.setItem('tonys_recurring_expenses', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast({ title: 'ลบรายการแล้ว', message: `ลบ "${name}" เรียบร้อย`, type: 'info' });
  };

  // Load recurring from localStorage fallback if needed
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tonys_recurring_expenses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecurringExpenses(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const filteredDaily = expenses.filter((e) => {
    const matchesSearch =
      (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      ((e.notes || e.note || '').toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || e.category === categoryFilter || e.categoryId === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalDailyFiltered = filteredDaily.reduce((acc, cur) => acc + (cur.amount || 0), 0);
  const totalRecurringMonthly = recurringExpenses.reduce((acc, cur) => acc + (cur.amountPerMonth || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-orange-500" />
            <span>{t.navExpenses || 'บันทึกและจัดการรายจ่าย (Expenses)'}</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            บันทึกค่าใช้จ่ายประจำวันและค่าใช้จ่ายประจำรายเดือน (Recurring) เพื่อนำไปหักกำไรขาดทุนสุทธิ (P&L) แบบเฉลี่ยวัน
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeTab === 'daily' ? (
            <button
              onClick={() => {
                setDailyForm({
                  title: '',
                  category: categories[0] || 'ค่าเช่า',
                  amount: 500,
                  paymentMethod: 'cash',
                  notes: '',
                  date: new Date().toISOString().split('T')[0],
                });
                setIsDailyModalOpen(true);
              }}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกรายจ่ายรายวัน</span>
            </button>
          ) : activeTab === 'recurring' ? (
            <button
              onClick={() => {
                setRecurringForm({
                  name: '',
                  categoryId: categories[0] || 'ค่าเช่า',
                  amountPerMonth: 10000,
                  dayOfMonth: 1,
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: '',
                });
                setIsRecurringModalOpen(true);
              }}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายจ่ายประจำเดือน</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs Selector: รายจ่ายประจำวัน vs รายจ่ายประจำเดือน (Recurring) */}
      <div className="flex items-center gap-2 border-b border-[#FED7AA] pb-1">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'bg-white border-t-2 border-orange-500 text-orange-600 shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>รายจ่ายประจำวัน (Daily Entries)</span>
          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px]">
            {expenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'recurring'
              ? 'bg-white border-t-2 border-orange-500 text-orange-600 shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>รายจ่ายประจำรายเดือน (Recurring Expenses)</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px]">
            {recurringExpenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'categories'
              ? 'bg-white border-t-2 border-orange-500 text-orange-600 shadow-xs'
              : 'text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>จัดการหมวดหมู่ (Categories)</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
            {categories.length}
          </span>
        </button>
      </div>

      {/* SPREAD RULE NOTICE (Strictly required by Section 8.1) */}
      <div className="p-3.5 bg-orange-50/60 border border-orange-200 rounded-xl flex items-start gap-2.5 text-xs text-orange-950">
        <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>กฎการกระจายต้นทุนรายจ่ายประจำ (Recurring Spread Rule):</strong> ค่าใช้จ่ายประจำรายเดือน (เช่น ค่าเช่าร้าน ฿30,000/เดือน) จะถูกเฉลี่ยหารจำนวนวันของเดือนนั้นอัตโนมัติ (เช่น ฿1,000/วัน) เมื่อเปิดดูรายงานสรุปกำไรขาดทุน (P&L) รายวันและรายเดือน เพื่อให้สะท้อนกำไรสุทธิแท้จริงในแต่ละวันโดยไม่ต้องคีย์ซ้ำทุกวัน
        </div>
      </div>

      {activeTab === 'daily' ? (
        // ================= TAB 1: DAILY EXPENSES =================
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารายการ หรือบันทึกช่วยจำ..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap min-h-[36px] ${
                  categoryFilter === 'all'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-[#6B7280] border-[#FED7AA] hover:bg-orange-50'
                }`}
              >
                ทุกหมวด
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap min-h-[36px] ${
                    categoryFilter === cat
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-[#6B7280] border-[#FED7AA] hover:bg-orange-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Table */}
          <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
                  <tr>
                    <th className="p-3.5">วันที่</th>
                    <th className="p-3.5">รายการ</th>
                    <th className="p-3.5">หมวดหมู่</th>
                    <th className="p-3.5 text-right">จำนวนเงิน (฿)</th>
                    <th className="p-3.5 text-center">ช่องทางชำระ</th>
                    <th className="p-3.5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FED7AA]">
                  {filteredDaily.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#6B7280]">
                        ยังไม่มีรายการรายจ่ายประจำวัน
                      </td>
                    </tr>
                  ) : (
                    filteredDaily.map((item) => (
                      <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                        <td className="p-3.5 text-xs text-[#6B7280]">{formatDate(item.date)}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-[#1F2937]">{item.title}</div>
                          {(item.notes || item.note) && (
                            <div className="text-[11px] text-[#6B7280] mt-0.5">{item.notes || item.note}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 text-xs font-semibold border border-orange-200">
                            {item.category || item.categoryId}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-red-600">
                          -฿{item.amount.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="text-xs uppercase text-[#6B7280] font-mono">
                            {item.paymentMethod || 'cash'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteDaily(item.id, item.title)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#FFFBF5] border-t border-[#FED7AA] flex justify-between items-center text-xs font-bold text-[#1F2937]">
              <span>ยอดรวมรายจ่ายที่แสดง ({filteredDaily.length} รายการ):</span>
              <span className="font-mono text-base text-red-600">฿{totalDailyFiltered.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'recurring' ? (
        // ================= TAB 2: RECURRING EXPENSES (Section 8.1) =================
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
              <span className="text-xs text-[#6B7280] font-bold block">รายการรายจ่ายประจำ</span>
              <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
                {recurringExpenses.length} รายการ
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
              <span className="text-xs text-[#6B7280] font-bold block">รวมยอดรายจ่ายประจำ/เดือน</span>
              <div className="text-2xl font-black text-red-600 font-mono mt-1">
                ฿{totalRecurringMonthly.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
              <span className="text-xs text-[#6B7280] font-bold block">เฉลี่ยคิดต้นทุนต่อวัน</span>
              <div className="text-2xl font-black text-orange-600 font-mono mt-1">
                ฿{(totalRecurringMonthly / 30).toFixed(0)} / วัน
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
                  <tr>
                    <th className="p-3.5">ชื่อรายจ่ายประจำ</th>
                    <th className="p-3.5">หมวดหมู่</th>
                    <th className="p-3.5 text-right">ยอดเงินต่อเดือน (฿)</th>
                    <th className="p-3.5 text-center">วันครบกำหนดของเดือน</th>
                    <th className="p-3.5 text-center">ช่วงเวลาที่คิด P&L</th>
                    <th className="p-3.5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FED7AA]">
                  {recurringExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#6B7280]">
                        ยังไม่มีรายการรายจ่ายประจำเดือน กดปุ่ม "เพิ่มรายจ่ายประจำเดือน" เพื่อบันทึกค่าเช่า เงินเดือน ค่าน้ำไฟ
                      </td>
                    </tr>
                  ) : (
                    recurringExpenses.map((r) => (
                      <tr key={r.id} className="hover:bg-orange-50/20 transition-colors">
                        <td className="p-3.5 font-bold text-[#1F2937]">{r.name}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 text-xs font-semibold border border-orange-200">
                            {r.categoryId}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-red-600">
                          ฿{r.amountPerMonth.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          วันที่ {r.dayOfMonth} ของทุกเดือน
                        </td>
                        <td className="p-3.5 text-center text-xs text-[#6B7280]">
                          ตั้งแต่ {r.startDate} {r.endDate ? `ถึง ${r.endDate}` : '(ต่อเนื่อง)'}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteRecurring(r.id, r.name)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // ================= TAB 3: CATEGORY MANAGEMENT =================
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs">
            <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-orange-500" />
              <span>เพิ่มหมวดหมู่รายจ่ายใหม่</span>
            </h3>
            <form onSubmit={handleAddCategory} className="flex gap-2 text-xs">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="ระบุชื่อหมวดหมู่ใหม่ เช่น ค่าบรรจุภัณฑ์, ซ่อมแซม..."
                className="flex-1 px-3.5 py-2.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500 min-h-[44px]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs min-h-[44px] flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหมวดหมู่</span>
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
            <div className="p-4 bg-[#FFFBF5] border-b border-[#FED7AA] flex justify-between items-center text-xs font-bold text-[#1F2937]">
              <span>หมวดหมู่รายจ่ายทั้งหมด ({categories.length} หมวด)</span>
              <span className="text-[#6B7280]">หมวดหมู่เหล่านี้จะแสดงในเมนูบันทึกรายจ่ายและงบ P&L</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">ชื่อหมวดหมู่รายจ่าย</th>
                    <th className="p-3.5 text-center">จำนวนรายการที่ใช้</th>
                    <th className="p-3.5 text-right">ยอดรวมรายจ่ายในหมวด (฿)</th>
                    <th className="p-3.5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FED7AA]">
                  {categories.map((cat, idx) => {
                    const matchedExpenses = expenses.filter((e) => e.category === cat || e.categoryId === cat);
                    const totalAmt = matchedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                    return (
                      <tr key={cat} className="hover:bg-orange-50/20 transition-colors">
                        <td className="p-3.5 text-xs text-[#6B7280] font-mono">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-[#1F2937]">
                          <span className="px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 text-xs font-semibold border border-orange-200">
                            {cat}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono text-xs text-[#6B7280]">
                          {matchedExpenses.length} รายการ
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-red-600">
                          {totalAmt > 0 ? `฿${totalAmt.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบหมวดหมู่"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DAILY MODAL */}
      {isDailyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4 text-[#1F2937]">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h3 className="font-extrabold text-base">บันทึกรายจ่ายรายวัน</h3>
              <button onClick={() => setIsDailyModalOpen(false)} className="text-[#6B7280] hover:text-[#1F2937]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDaily} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">วันที่จ่าย</label>
                <input
                  type="date"
                  required
                  value={dailyForm.date}
                  onChange={(e) => setDailyForm({ ...dailyForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">ชื่อรายการรายจ่าย <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ซื้อผักสดเพิ่มเติม, ค่าน้ำแข็งหลอด"
                  value={dailyForm.title}
                  onChange={(e) => setDailyForm({ ...dailyForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">หมวดหมู่</label>
                  <select
                    value={dailyForm.category}
                    onChange={(e) => setDailyForm({ ...dailyForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">จำนวนเงิน (฿) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={dailyForm.amount}
                    onChange={(e) => setDailyForm({ ...dailyForm, amount: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl font-mono font-bold min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">วิธีชำระเงิน</label>
                <select
                  value={dailyForm.paymentMethod}
                  onChange={(e) => setDailyForm({ ...dailyForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                >
                  <option value="cash">เงินสดในลิ้นชัก</option>
                  <option value="promptpay">PromptPay / โอนเงิน</option>
                  <option value="card">บัตรเครดิต</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  placeholder="เช่น มีใบเสร็จร้านค้ากำกับ..."
                  value={dailyForm.notes}
                  onChange={(e) => setDailyForm({ ...dailyForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDailyModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] font-bold rounded-xl min-h-[44px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs min-h-[44px]"
                >
                  บันทึกรายจ่าย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECURRING MODAL (Section 8.1) */}
      {isRecurringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4 text-[#1F2937]">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h3 className="font-extrabold text-base">เพิ่มรายจ่ายประจำรายเดือน</h3>
              <button onClick={() => setIsRecurringModalOpen(false)} className="text-[#6B7280] hover:text-[#1F2937]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecurring} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">ชื่อรายจ่ายประจำ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ค่าเช่าพื้นที่ร้าน, เงินเดือนเชฟ"
                  value={recurringForm.name}
                  onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">หมวดหมู่</label>
                  <select
                    value={recurringForm.categoryId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">ยอดเงินต่อเดือน (฿) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={recurringForm.amountPerMonth}
                    onChange={(e) => setRecurringForm({ ...recurringForm, amountPerMonth: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl font-mono font-bold min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">วันครบกำหนดของเดือน (1–31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringForm.dayOfMonth}
                  onChange={(e) => setRecurringForm({ ...recurringForm, dayOfMonth: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">วันที่เริ่มต้นคิด P&L</label>
                  <input
                    type="date"
                    required
                    value={recurringForm.startDate}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">วันที่สิ้นสุด (ถ้ามี)</label>
                  <input
                    type="date"
                    value={recurringForm.endDate || ''}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecurringModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] font-bold rounded-xl min-h-[44px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs min-h-[44px]"
                >
                  บันทึกรายจ่ายประจำ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
