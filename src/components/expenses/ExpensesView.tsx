import React, { useState, useEffect } from 'react';
import { Expense, ExpenseCategory } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import { Wallet, Plus, Search, Trash2, Calendar, Filter, PieChart } from 'lucide-react';

const CATEGORY_LABELS: Record<ExpenseCategory, { th: string; en: string }> = {
  raw_materials: { th: 'วัตถุดิบ/อาหารสด', en: 'Raw Materials' },
  salary: { th: 'เงินเดือน/ค่าจ้างพนักงาน', en: 'Staff Salary' },
  rent: { th: 'ค่าเช่าสถานที่', en: 'Store Rent' },
  utilities: { th: 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต', en: 'Utilities' },
  packaging: { th: 'กล่อง/ถุง/บรรจุภัณฑ์', en: 'Packaging' },
  gas_electric: { th: 'แก๊สหุงต้ม/เชื้อเพลิง', en: 'Cooking Gas' },
  marketing: { th: 'การตลาด/ป้ายโฆษณา', en: 'Marketing' },
  maintenance: { th: 'ซ่อมบำรุง/อุปกรณ์', en: 'Maintenance' },
  other: { th: 'ค่าใช้จ่ายอื่นๆ', en: 'Other' },
};

export const ExpensesView: React.FC = () => {
  const { t, language, formatCurrency, formatDate } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('raw_materials');
  const [formAmount, setFormAmount] = useState<number>(500);
  const [formMethod, setFormMethod] = useState('promptpay');
  const [formNotes, setFormNotes] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const list = await dbGetAll<Expense>('expenses');
    setExpenses(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formAmount <= 0) {
      showToast('กรุณากรอกข้อมูลรายจ่ายให้ครบถ้วน', 'Please fill required fields', 'error');
      return;
    }

    const exp: Expense = {
      id: `exp_${Date.now()}`,
      date: formDate ? new Date(formDate).toISOString() : new Date().toISOString(),
      title: formTitle.trim(),
      category: formCategory,
      amount: Number(formAmount),
      paymentMethod: formMethod,
      notes: formNotes.trim(),
    };

    await dbPut('expenses', exp);
    showToast('บันทึกรายจ่ายเรียบร้อย', 'Expense recorded', 'success');
    setIsModalOpen(false);
    setFormTitle('');
    setFormAmount(500);
    setFormNotes('');
    loadExpenses();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`คุณต้องการลบรายการ "${title}" หรือไม่?`)) return;
    await dbDelete('expenses', id);
    showToast('ลบรายการรายจ่ายแล้ว', 'Expense deleted', 'info');
    loadExpenses();
  };

  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.notes && e.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalExpense = filtered.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-orange-500" />
            <span>{t.navExpenses || 'บันทึกรายจ่ายร้านอาหาร'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
              รวม {formatCurrency(totalExpense)}
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            บันทึกต้นทุนดำเนินงาน ค่าเช่า ค่าน้ำไฟ เงินเดือน เพื่อนำไปคำนวณกำไรขาดทุนสุทธิ (P&L)
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึกรายจ่ายใหม่</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.search || 'ค้นหาชื่อรายการรายจ่าย...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-orange-500 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-xs font-semibold text-[#1F2937] min-h-[44px] focus:outline-none focus:border-orange-500"
          >
            <option value="all">ทุกหมวดหมู่ ({expenses.length})</option>
            {Object.entries(CATEGORY_LABELS).map(([catKey, labels]) => (
              <option key={catKey} value={catKey}>
                {language === 'th' ? labels.th : labels.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-[#FED7AA] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFFBF5] border-b border-[#FED7AA] text-[#6B7280] font-bold">
                <th className="p-3.5">วันที่</th>
                <th className="p-3.5">รายการ</th>
                <th className="p-3.5">หมวดหมู่</th>
                <th className="p-3.5">วิธีชำระ</th>
                <th className="p-3.5 text-right">จำนวนเงิน</th>
                <th className="p-3.5 text-center w-20">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[#6B7280]">
                    ยังไม่มีรายการรายจ่าย
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const label = (CATEGORY_LABELS as Record<string, { th: string; en: string }>)[e.category] || { th: e.category, en: e.category };
                  return (
                    <tr key={e.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-3.5 whitespace-nowrap text-[#6B7280]">
                        {formatDate(e.date)}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-[#1F2937] text-sm">{e.title}</div>
                        {e.notes && <div className="text-[11px] text-[#6B7280]">{e.notes}</div>}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-semibold">
                          {language === 'th' ? label.th : label.en}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#6B7280] uppercase text-[11px] font-mono">
                        {e.paymentMethod}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-sm text-red-600">
                        -{formatCurrency(e.amount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDelete(e.id, e.title)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h2 className="font-bold text-base text-[#1F2937] flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" />
                <span>บันทึกรายจ่ายใหม่</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ชื่อรายการรายจ่าย *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="เช่น ซื้อแก๊สหุงต้ม 2 ถัง, ค่าผักตลาดสด"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    หมวดหมู่ *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {language === 'th' ? v.th : v.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    จำนวนเงิน (บาท) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm font-bold text-red-600 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    วันที่ทำรายการ
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    ช่องทางจ่าย
                  </label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="cash">เงินสด (Cash)</option>
                    <option value="promptpay">พร้อมเพย์ (PromptPay)</option>
                    <option value="transfer">โอนเงินธนาคาร</option>
                    <option value="credit_card">บัตรเครดิต</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="เช่น ใบเสร็จเล่มที่ #042 หรือชื่อร้านค้า"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-neutral-600 rounded-xl text-xs font-semibold"
                >
                  {t.cancel || 'ยกเลิก'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  {t.save || 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
