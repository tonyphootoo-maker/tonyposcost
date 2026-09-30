import React, { useState, useEffect } from 'react';
import { Promotion } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import { Tag, Plus, Search, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';

export const PromotionsView: React.FC = () => {
  const { t, language, formatCurrency } = useTranslation();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const [formCode, setFormCode] = useState('');
  const [formNameTh, setFormNameTh] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formType, setFormType] = useState<'percent' | 'amount'>('percent');
  const [formValue, setFormValue] = useState<number>(10);
  const [formMinSpend, setFormMinSpend] = useState<number>(0);

  useEffect(() => {
    loadPromos();
  }, []);

  const loadPromos = async () => {
    const list = await dbGetAll<Promotion>('promotions');
    setPromotions(list);
  };

  const handleOpenAdd = () => {
    setEditingPromo(null);
    setFormCode(`DISCOUNT${Math.floor(Math.random() * 90 + 10)}`);
    setFormNameTh('');
    setFormNameEn('');
    setFormType('percent');
    setFormValue(10);
    setFormMinSpend(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Promotion) => {
    setEditingPromo(p);
    setFormCode(p.code);
    setFormNameTh(p.nameTh);
    setFormNameEn(p.nameEn);
    setFormType((p.discountKind as 'percent' | 'amount') || (p.type === 'amount' ? 'amount' : 'percent'));
    setFormValue(p.value);
    setFormMinSpend(p.minSpend || 0);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formNameTh.trim()) {
      showToast('กรุณากรอกรหัสและชื่อโปรโมชัน', 'Please fill required fields', 'error');
      return;
    }

    const promo: Promotion = {
      id: editingPromo ? editingPromo.id : `promo_${Date.now()}`,
      code: formCode.trim().toUpperCase(),
      name: formNameTh.trim(),
      nameTh: formNameTh.trim(),
      nameEn: formNameEn.trim() || formNameTh.trim(),
      type: formType,
      enabled: editingPromo ? (editingPromo.enabled ?? editingPromo.isActive) : true,
      discountKind: formType === 'amount' ? 'amount' : 'percent',
      value: Number(formValue),
      minSpend: Number(formMinSpend) || 0,
      isActive: editingPromo ? editingPromo.isActive : true,
    };

    await dbPut('promotions', promo);
    showToast('บันทึกโปรโมชันเรียบร้อย', 'Promotion saved', 'success');
    setIsModalOpen(false);
    loadPromos();
  };

  const handleToggleActive = async (p: Promotion) => {
    const updated: Promotion = { ...p, isActive: !p.isActive };
    await dbPut('promotions', updated);
    loadPromos();
  };

  const handleDelete = async (id: string, nameTh: string) => {
    if (!confirm(`คุณต้องการลบโปรโมชัน "${nameTh}" หรือไม่?`)) return;
    await dbDelete('promotions', id);
    showToast('ลบโปรโมชันแล้ว', 'Promotion deleted', 'info');
    loadPromos();
  };

  const filtered = promotions.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.nameTh.toLowerCase().includes(search.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Tag className="w-6 h-6 text-orange-500" />
            <span>{t.navPromotions || 'โปรโมชันและส่วนลด'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">
              {promotions.length} รายการ
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            สร้างโค้ดส่วนลดแบบเปอร์เซ็นต์หรือบาท เพื่อนำไปใช้ลดราคาในหน้าขาย POS
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มโปรโมชันใหม่</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={t.search || 'ค้นหารหัสโปรโมชัน หรือชื่อส่วนลด...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-orange-500 min-h-[44px]"
        />
      </div>

      {/* Promotions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
            <Tag className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="font-semibold text-sm">ยังไม่มีโปรโมชัน</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition-all ${
                p.isActive
                  ? 'bg-white border-[#FED7AA] shadow-xs'
                  : 'bg-neutral-50 border-neutral-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 border border-orange-200">
                    {p.code}
                  </span>
                  <div className="font-bold text-sm text-[#1F2937] mt-2">
                    {language === 'th' ? p.nameTh : p.nameEn}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(p)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                    p.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-neutral-100 text-neutral-500 border-neutral-300'
                  }`}
                >
                  {p.isActive ? 'เปิดใช้งาน' : 'ปิด'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-[#FED7AA]/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#6B7280]">ส่วนลด: </span>
                  <span className="font-extrabold text-orange-600 text-sm">
                    {p.type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}
                  </span>
                </div>
                {p.minSpend ? (
                  <div className="text-[11px] text-[#6B7280]">
                    ขั้นต่ำ: {formatCurrency(p.minSpend)}
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-dashed border-[#FED7AA]/60">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.nameTh)}
                  className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h2 className="font-bold text-base text-[#1F2937] flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" />
                <span>{editingPromo ? 'แก้ไขโปรโมชัน' : 'เพิ่มโปรโมชันใหม่'}</span>
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
                  รหัสคูปอง / โค้ดส่วนลด (เช่น SUMMER10) *
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl font-mono text-sm uppercase focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ชื่อโปรโมชัน (ภาษาไทย) *
                </label>
                <input
                  type="text"
                  required
                  value={formNameTh}
                  onChange={(e) => setFormNameTh(e.target.value)}
                  placeholder="เช่น ลด 10% ลูกค้าใหม่"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ชื่อโปรโมชัน (English)
                </label>
                <input
                  type="text"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="e.g. 10% Off New Customers"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    ประเภทส่วนลด
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-xs bg-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="percent">เปอร์เซ็นต์ (%)</option>
                    <option value="amount">จำนวนเงิน (฿)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                    มูลค่า {formType === 'percent' ? '(%)' : '(฿)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ยอดสั่งซื้อขั้นต่ำ (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formMinSpend}
                  onChange={(e) => setFormMinSpend(Number(e.target.value))}
                  placeholder="0 = ไม่มียอดขั้นต่ำ"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
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
