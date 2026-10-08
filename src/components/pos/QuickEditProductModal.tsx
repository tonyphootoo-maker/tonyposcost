import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductCategory } from '../../types';
import { useTranslation } from '../../i18n';
import { compressImage } from '../../utils/imageCompressor';
import { X, Check, Trash2, Edit3, DollarSign, Tag, UtensilsCrossed, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react';

interface QuickEditProductModalProps {
  product: Product;
  categories: ProductCategory[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Product) => Promise<void>;
  onDelete?: (productId: string) => Promise<void>;
}

export const QuickEditProductModal: React.FC<QuickEditProductModalProps> = ({
  product,
  categories,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const { language, formatCurrency } = useTranslation();

  const [nameTh, setNameTh] = useState(product.nameTh);
  const [nameEn, setNameEn] = useState(product.nameEn || '');
  const [price, setPrice] = useState<number>(product.price);
  const [cost, setCost] = useState<number>(product.cost || 0);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [isAvailable, setIsAvailable] = useState<boolean>(product.isAvailable ?? true);
  const [kitchenStation, setKitchenStation] = useState<'kitchen' | 'bar' | 'grill' | 'dessert'>(
    product.kitchenStation || 'kitchen'
  );
  const [descriptionTh, setDescriptionTh] = useState(product.descriptionTh || '');
  const [image, setImage] = useState(product.image || '');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever product prop changes
  useEffect(() => {
    setNameTh(product.nameTh);
    setNameEn(product.nameEn || '');
    setPrice(product.price);
    setCost(product.cost || 0);
    setCategoryId(product.categoryId);
    setIsAvailable(product.isAvailable ?? true);
    setKitchenStation(product.kitchenStation || 'kitchen');
    setDescriptionTh(product.descriptionTh || '');
    setImage(product.image || '');
  }, [product]);

  if (!isOpen) return null;

  const profitMargin = price > 0 ? Number((((price - cost) / price) * 100).toFixed(1)) : 0;
  const unitProfit = Number((price - cost).toFixed(2));

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameTh.trim()) return;

    setIsSaving(true);
    try {
      const updated: Product = {
        ...product,
        nameTh: nameTh.trim(),
        nameEn: nameEn.trim() || nameTh.trim(),
        name: nameTh.trim(),
        price: Number(price) || 0,
        cost: Number(cost) || 0,
        categoryId,
        isAvailable,
        kitchenStation,
        descriptionTh: descriptionTh.trim(),
        image: image || undefined,
      };
      await onSave(updated);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = window.confirm(
      language === 'th'
        ? `ต้องการลบเมนู "${product.nameTh}" ออกจากรายการอาหารหรือไม่?`
        : `Delete menu item "${product.nameTh}"?`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await onDelete(product.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-[#FFFFFF] border-2 border-[#FED7AA] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#FED7AA] bg-[#FFF8EE] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[#111827] leading-tight">
                {language === 'th' ? 'แก้ไขเมนูอาหาร' : 'Edit Menu Item'}
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {language === 'th'
                  ? 'แก้ไขชื่อและราคาขายได้ทันที โดยไม่ต้องเข้าหน้าตั้งค่า'
                  : 'Quickly edit name and price without opening settings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7280] hover:bg-neutral-100 hover:text-[#111827] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Image & Quick Photo Row */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FFF8EE] border border-[#FED7AA]">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#FDBA74] bg-[#FFEDD5] flex items-center justify-center shrink-0">
              {image ? (
                <img src={image} alt={nameTh} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-[#EA580C]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'รูปภาพเมนู' : 'Menu Photo'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-[#FED7AA] hover:bg-[#FFEDD5] text-[#EA580C] text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{image ? (language === 'th' ? 'เปลี่ยนรูป' : 'Change') : (language === 'th' ? 'เพิ่มรูป' : 'Upload')}</span>
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="px-2 py-1.5 rounded-lg text-neutral-500 hover:text-red-600 text-xs font-semibold cursor-pointer transition"
                  >
                    {language === 'th' ? 'ลบรูป' : 'Remove'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Row 1: Name TH & Name EN */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'ชื่ออาหาร (ภาษาไทย) *' : 'Dish Name (Thai) *'}
              </label>
              <input
                type="text"
                required
                value={nameTh}
                onChange={(e) => setNameTh(e.target.value)}
                placeholder="เช่น กะเพราหมูสับราดข้าวหอมมะลิ"
                className="w-full h-[46px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'ชื่ออาหาร (ภาษาอังกฤษ)' : 'Dish Name (English)'}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Pad Kra Pao Minced Pork"
                className="w-full h-[44px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316] transition"
              />
            </div>
          </div>

          {/* Row 2: Price & Cost with live Profit margin */}
          <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#9A3412] mb-1">
                  {language === 'th' ? 'ราคาขายหน้าร้าน (฿) *' : 'Selling Price (฿) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-[#9A3412]">
                    ฿
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                    className="w-full h-[44px] pl-8 pr-3 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-[#111827] font-black text-base focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">
                  {language === 'th' ? 'ต้นทุนอาหารต่อจาน (฿)' : 'Food Cost per Serving (฿)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-[#6B7280]">
                    ฿
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value) || 0)}
                    className="w-full h-[44px] pl-8 pr-3 rounded-xl border border-[#FED7AA] bg-[#FFFFFF] text-[#111827] font-bold text-base focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>
            </div>

            {/* Live Profit Preview */}
            <div className="flex items-center justify-between pt-1 border-t border-[#FED7AA]/60 text-xs">
              <span className="text-[#6B7280] font-semibold">
                {language === 'th' ? 'กำไรขั้นต้นประมาณการ:' : 'Estimated Gross Margin:'}
              </span>
              <div className="flex items-center gap-2 font-bold">
                <span className="text-emerald-700 font-mono">
                  +฿{unitProfit.toFixed(2)}/จาน
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                    profitMargin >= 65
                      ? 'bg-emerald-100 text-emerald-800'
                      : profitMargin >= 50
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {profitMargin}% กำไร
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Category & Kitchen Station */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'หมวดหมู่อาหาร' : 'Category'}
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameTh} ({cat.nameEn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'สเตชันจัดทำ / ครัว' : 'Kitchen Station'}
              </label>
              <select
                value={kitchenStation}
                onChange={(e) => setKitchenStation(e.target.value as any)}
                className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
              >
                <option value="kitchen">🍳 ครัวหลัก (Kitchen)</option>
                <option value="bar">🍹 บาร์น้ำ (Beverage Bar)</option>
                <option value="grill">🔥 เตาย่าง (Grill)</option>
                <option value="dessert">🍨 ของหวาน (Dessert)</option>
              </select>
            </div>
          </div>

          {/* Row 4: Availability Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF8EE] border border-[#FED7AA]">
            <div>
              <span className="block text-xs font-bold text-[#111827]">
                {language === 'th' ? 'สถานะการจำหน่าย' : 'Availability Status'}
              </span>
              <span className="text-[11px] text-[#6B7280]">
                {isAvailable
                  ? language === 'th'
                    ? 'เปิดจำหน่ายตามปกติ (มีของ)'
                    : 'Available for order'
                  : language === 'th'
                  ? 'ปิดจำหน่ายชั่วคราว (สินค้าหมด)'
                  : 'Temporarily sold out'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAvailable(!isAvailable)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isAvailable
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  : 'bg-red-50 border-red-400 text-red-800'
              }`}
            >
              {isAvailable ? '✓ มีของ (พร้อมขาย)' : '✕ หมด (Sold Out)'}
            </button>
          </div>

          {/* Row 5: Description */}
          <div>
            <label className="block text-xs font-bold text-[#374151] mb-1">
              {language === 'th' ? 'คำอธิบายหรือส่วนประกอบหลัก (ถ้ามี)' : 'Description (Optional)'}
            </label>
            <textarea
              rows={2}
              value={descriptionTh}
              onChange={(e) => setDescriptionTh(e.target.value)}
              placeholder="เช่น หมูสับอนามัย ผัดกะเพราป่าแท้ รสชาติเข้มข้น หอมใบกะเพราสด..."
              className="w-full p-2.5 rounded-xl border border-[#FED7AA] bg-[#FFFFFF] text-[#111827] text-xs focus:ring-2 focus:ring-[#F97316] resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[#FED7AA] gap-2">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'ลบเมนูนี้' : 'Delete'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl border border-[#FED7AA] bg-white hover:bg-neutral-100 text-[#374151] font-bold text-xs cursor-pointer min-h-[44px]"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-xs shadow-sm cursor-pointer min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : language === 'th' ? 'บันทึกค่าที่แก้ไข' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
