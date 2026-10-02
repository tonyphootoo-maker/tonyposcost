import React, { useState, useEffect } from 'react';
import { Promotion, PromotionType, Product, ProductCategory } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import {
  Tag,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Sparkles,
  ShoppingBag,
  Zap,
  X,
} from 'lucide-react';

export const PromotionsView: React.FC = () => {
  const { t, language, formatCurrency } = useTranslation();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PromotionType>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  // Form State
  const [formType, setFormType] = useState<Promotion['type']>('bill-discount');
  const [formNameTh, setFormNameTh] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCouponCode, setFormCouponCode] = useState('');
  const [formDiscountKind, setFormDiscountKind] = useState<'percent' | 'amount'>('percent');
  const [formValue, setFormValue] = useState<number>(10);
  const [formMinSpend, setFormMinSpend] = useState<number>(0);

  // Happy Hour specific fields
  const [formActiveDays, setFormActiveDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [formStartTime, setFormStartTime] = useState<string>('14:00');
  const [formEndTime, setFormEndTime] = useState<string>('17:00');

  // Applicable products
  const [formApplicableProductIds, setFormApplicableProductIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [promoList, prodList, catList] = await Promise.all([
      dbGetAll<Promotion>('promotions'),
      dbGetAll<Product>('products'),
      dbGetAll<ProductCategory>('categories'),
    ]);
    setPromotions(promoList);
    setProducts(prodList);
    setCategories(catList);
  };

  const handleOpenAdd = () => {
    setEditingPromo(null);
    setFormType('bill-discount');
    setFormNameTh('');
    setFormNameEn('');
    setFormCouponCode(`DISC${Math.floor(Math.random() * 90 + 10)}`);
    setFormDiscountKind('percent');
    setFormValue(10);
    setFormMinSpend(0);
    setFormActiveDays([1, 2, 3, 4, 5]);
    setFormStartTime('14:00');
    setFormEndTime('17:00');
    setFormApplicableProductIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Promotion) => {
    setEditingPromo(p);
    setFormType(p.type);
    setFormNameTh(p.nameTh || p.name || '');
    setFormNameEn(p.nameEn || '');
    setFormCouponCode(p.couponCode || p.code || '');
    setFormDiscountKind(p.discountKind || 'percent');
    setFormValue(p.value || 0);
    setFormMinSpend(p.minSpend || 0);
    setFormActiveDays(p.activeDays || [1, 2, 3, 4, 5]);
    setFormStartTime(p.activeStartTime || '14:00');
    setFormEndTime(p.activeEndTime || '17:00');
    setFormApplicableProductIds(p.applicableProductIds || []);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameTh.trim()) {
      showToast({ title: 'กรุณากรอกชื่อโปรโมชัน', message: 'ระบุชื่อโปรโมชันภาษาไทย', type: 'error' });
      return;
    }
    if (formType === 'coupon' && !formCouponCode.trim()) {
      showToast({ title: 'กรุณาระบุรหัสคูปอง', message: 'เช่น TONY10', type: 'error' });
      return;
    }

    const promo: Promotion = {
      id: editingPromo ? editingPromo.id : `promo_${Date.now()}`,
      name: formNameTh.trim(),
      nameTh: formNameTh.trim(),
      nameEn: formNameEn.trim() || formNameTh.trim(),
      code: formCouponCode.trim().toUpperCase(),
      couponCode: formType === 'coupon' ? formCouponCode.trim().toUpperCase() : undefined,
      type: formType,
      enabled: editingPromo ? (editingPromo.enabled ?? editingPromo.isActive ?? true) : true,
      isActive: editingPromo ? (editingPromo.enabled ?? editingPromo.isActive ?? true) : true,
      discountKind: formType === 'bogo' ? 'percent' : formDiscountKind,
      value: formType === 'bogo' ? 100 : Number(formValue) || 0,
      minSpend: Number(formMinSpend) || 0,
      activeDays: formType === 'happy-hour' ? formActiveDays : undefined,
      activeStartTime: formType === 'happy-hour' ? formStartTime : undefined,
      activeEndTime: formType === 'happy-hour' ? formEndTime : undefined,
      applicableProductIds:
        formType === 'happy-hour' || formType === 'bogo' ? formApplicableProductIds : undefined,
    };

    await dbPut('promotions', promo);
    showToast({ title: 'บันทึกโปรโมชันเรียบร้อย', message: promo.nameTh, type: 'success' });
    setIsModalOpen(false);
    await loadData();
  };

  const handleToggleEnable = async (p: Promotion) => {
    const isCurrentlyEnabled = (p.enabled ?? p.isActive) !== false;
    const updated: Promotion = {
      ...p,
      enabled: !isCurrentlyEnabled,
      isActive: !isCurrentlyEnabled,
    };
    await dbPut('promotions', updated);
    await loadData();
  };

  const handleDelete = async (id: string, nameTh: string) => {
    if (!confirm(`คุณต้องการลบโปรโมชัน "${nameTh}" หรือไม่?`)) return;
    await dbDelete('promotions', id);
    showToast({ title: 'ลบสำเร็จ', message: 'ลบโปรโมชันเรียบร้อยแล้ว', type: 'info' });
    await loadData();
  };

  // Helper to check if a promotion is active RIGHT NOW (Section 7.9)
  const isCurrentlyActive = (p: Promotion): boolean => {
    if ((p.enabled ?? p.isActive) === false) return false;

    if (p.type === 'happy-hour') {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const matchesDay = !p.activeDays || p.activeDays.length === 0 || p.activeDays.includes(currentDay);
      const matchesTime =
        (!p.activeStartTime || currentTime >= p.activeStartTime) &&
        (!p.activeEndTime || currentTime <= p.activeEndTime);

      return matchesDay && matchesTime;
    }

    return true;
  };

  const daysLabel = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  const filtered = promotions.filter((p) => {
    const matchesSearch =
      (p.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.nameTh || p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.nameEn || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Tag className="w-6 h-6 text-orange-500" />
            <span>{t.navPromotions || 'โปรโมชันและส่วนลด (Promotions)'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">
              {promotions.length} แคมเปญ
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            จัดการโปรโมชัน 4 รูปแบบ: Happy Hour, 1 แถม 1 (BOGO), ส่วนลดตามยอดบิล, และคูปองโค้ด
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มโปรโมชันใหม่</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อโปรโมชัน หรือรหัสคูปอง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#FED7AA] overflow-x-auto">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
              typeFilter === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setTypeFilter('happy-hour')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
              typeFilter === 'happy-hour' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            ⚡ Happy Hour
          </button>
          <button
            onClick={() => setTypeFilter('bogo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
              typeFilter === 'bogo' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            🎁 1 แถม 1 (BOGO)
          </button>
          <button
            onClick={() => setTypeFilter('bill-discount')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
              typeFilter === 'bill-discount' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            🧾 ส่วนลดบิล
          </button>
          <button
            onClick={() => setTypeFilter('coupon')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap min-h-[38px] cursor-pointer ${
              typeFilter === 'coupon' ? 'bg-orange-500 text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            🎟️ คูปองโค้ด
          </button>
        </div>
      </div>

      {/* Promotions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
            <Tag className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="font-semibold text-sm">ไม่พบรายการโปรโมชัน</p>
          </div>
        ) : (
          filtered.map((p) => {
            const activeNow = isCurrentlyActive(p);
            const isEnabled = (p.enabled ?? p.isActive) !== false;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border transition-all ${
                  isEnabled
                    ? activeNow
                      ? 'bg-white border-[#FDBA74] shadow-xs ring-1 ring-orange-400/40'
                      : 'bg-white border-[#FED7AA] shadow-2xs'
                    : 'bg-neutral-50 border-neutral-200 opacity-60'
                }`}
              >
                {/* Header Row: Type Badge + Active Now indicator + Toggle */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-[#FFEDD5] text-[#9A3412]">
                      {p.type === 'happy-hour'
                        ? '⚡ Happy Hour'
                        : p.type === 'bogo'
                        ? '🎁 1 แถม 1'
                        : p.type === 'bill-discount'
                        ? '🧾 ลดท้ายบิล'
                        : '🎟️ คูปอง'}
                    </span>
                    {activeNow && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        ใช้งานได้ตอนนี้
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleEnable(p)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-neutral-100 text-neutral-500 border-neutral-300'
                    }`}
                  >
                    {isEnabled ? 'เปิดใช้งาน' : 'ปิด'}
                  </button>
                </div>

                {/* Promo Title & Code */}
                <div>
                  <h3 className="font-bold text-sm text-[#111827]">{p.nameTh || p.name}</h3>
                  {p.couponCode && (
                    <div className="mt-1 inline-block font-mono font-bold text-xs px-2 py-0.5 bg-neutral-100 text-[#111827] rounded border border-neutral-300">
                      โค้ด: {p.couponCode}
                    </div>
                  )}
                </div>

                {/* Details breakdown */}
                <div className="mt-3 pt-3 border-t border-[#FED7AA]/60 text-xs space-y-1 text-[#4B5563]">
                  {p.type === 'bogo' ? (
                    <div>🎁 ซื้อ 1 แถม 1 เมนูที่กำหนด</div>
                  ) : (
                    <div>
                      💰 ส่วนลด:{' '}
                      <span className="font-extrabold text-[#EA580C]">
                        {p.discountKind === 'percent' ? `${p.value}%` : `฿${p.value}`}
                      </span>
                      {p.minSpend && p.minSpend > 0 ? ` (ขั้นต่ำ ฿${p.minSpend})` : ''}
                    </div>
                  )}

                  {p.type === 'happy-hour' && (
                    <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        เวลา: {p.activeStartTime || '14:00'} - {p.activeEndTime || '17:00'} (
                        {p.activeDays?.map((d) => daysLabel[d]).join(', ') || 'ทุกวัน'})
                      </span>
                    </div>
                  )}

                  {p.applicableProductIds && p.applicableProductIds.length > 0 && (
                    <div className="text-[11px] text-[#6B7280]">
                      ใช้ได้กับ {p.applicableProductIds.length} รายการอาหาร
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-3 pt-2.5 border-t border-[#FED7AA]/40 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 text-[#4B5563] hover:text-[#EA580C] hover:bg-[#FFEDD5] rounded-lg transition cursor-pointer"
                    title="แก้ไขโปรโมชัน"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.nameTh || p.name || 'Promotion')}
                    className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition cursor-pointer"
                    title="ลบโปรโมชัน"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
              <h3 className="font-bold text-[#111827] text-base flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-600" />
                <span>{editingPromo ? 'แก้ไขโปรโมชัน' : 'เพิ่มโปรโมชันใหม่'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111827] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  รูปแบบโปรโมชัน (4 รูปแบบมาตรฐาน) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('happy-hour')}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left cursor-pointer transition ${
                      formType === 'happy-hour'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    ⚡ Happy Hour (ตามช่วงเวลา)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('bogo')}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left cursor-pointer transition ${
                      formType === 'bogo'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    🎁 1 แถม 1 (BOGO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('bill-discount')}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left cursor-pointer transition ${
                      formType === 'bill-discount'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    🧾 ส่วนลดท้ายบิล
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('coupon')}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left cursor-pointer transition ${
                      formType === 'coupon'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    🎟️ คูปองโค้ด (กรอกตอนคิดเงิน)
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  ชื่อโปรโมชัน (ภาษาไทย) *
                </label>
                <input
                  type="text"
                  required
                  value={formNameTh}
                  onChange={(e) => setFormNameTh(e.target.value)}
                  placeholder="เช่น Happy Hour ช่วงบ่าย ลด 20%"
                  className="w-full h-[44px] px-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-sm text-[#111827] focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Coupon Code Input if Coupon */}
              {formType === 'coupon' && (
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    รหัสคูปอง (Coupon Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCouponCode}
                    onChange={(e) => setFormCouponCode(e.target.value.toUpperCase())}
                    placeholder="เช่น TONY10, VIP20"
                    className="w-full h-[44px] px-3 font-mono font-bold bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-sm text-[#111827] uppercase focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}

              {/* Discount Kind & Value (Not needed for BOGO) */}
              {formType !== 'bogo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      วิธีลดราคา
                    </label>
                    <select
                      value={formDiscountKind}
                      onChange={(e) => setFormDiscountKind(e.target.value as any)}
                      className="w-full h-[44px] px-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-xs font-bold text-[#111827]"
                    >
                      <option value="percent">เปอร์เซ็นต์ (%)</option>
                      <option value="amount">จำนวนเงิน (฿)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      มูลค่าลด {formDiscountKind === 'percent' ? '(%)' : '(฿)'} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formValue}
                      onChange={(e) => setFormValue(Number(e.target.value))}
                      className="w-full h-[44px] px-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-base font-bold text-[#EA580C]"
                    />
                  </div>
                </div>
              )}

              {/* Min Spend */}
              {(formType === 'bill-discount' || formType === 'coupon') && (
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    ยอดสั่งซื้อขั้นต่ำ (0 = ไม่มีขั้นต่ำ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinSpend}
                    onChange={(e) => setFormMinSpend(Number(e.target.value))}
                    placeholder="0"
                    className="w-full h-[44px] px-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-sm"
                  />
                </div>
              )}

              {/* Happy Hour Specific Days and Time */}
              {formType === 'happy-hour' && (
                <div className="p-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl space-y-3">
                  <div className="text-xs font-bold text-[#9A3412]">
                    กำหนดช่วงเวลา Happy Hour
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-[#6B7280] block mb-1">เวลาเริ่มต้น</span>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full h-[38px] px-2 text-xs bg-white border border-[#FED7AA] rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#6B7280] block mb-1">เวลาสิ้นสุด</span>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full h-[38px] px-2 text-xs bg-white border border-[#FED7AA] rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#6B7280] block mb-1">วันที่ใช้งานได้:</span>
                    <div className="flex flex-wrap gap-1">
                      {daysLabel.map((dayName, dayIndex) => {
                        const isSelected = formActiveDays.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormActiveDays(formActiveDays.filter((d) => d !== dayIndex));
                              } else {
                                setFormActiveDays([...formActiveDays, dayIndex].sort());
                              }
                            }}
                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition ${
                              isSelected
                                ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                                : 'bg-white text-[#6B7280] border-[#FED7AA]'
                            }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-[#FED7AA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#374151] rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  บันทึกโปรโมชัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
