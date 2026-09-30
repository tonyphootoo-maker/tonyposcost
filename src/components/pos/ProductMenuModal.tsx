import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductCategory, Recipe } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { compressImage } from '../../utils/imageCompressor';
import {
  X,
  Upload,
  Plus,
  Trash2,
  UtensilsCrossed,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Sparkles,
  Link,
} from 'lucide-react';

interface ProductMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  onSaved: () => void;
}

export const ProductMenuModal: React.FC<ProductMenuModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  onSaved,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Product>({
    id: '',
    nameTh: '',
    nameEn: '',
    descriptionTh: '',
    descriptionEn: '',
    categoryId: '',
    price: 100,
    cost: 35,
    recipeId: '',
    isAvailable: true,
    image: '',
    kitchenStation: 'kitchen',
    variants: [],
    modifierGroups: [],
  });

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      if (productToEdit) {
        setFormData({ ...productToEdit });
      } else {
        setFormData({
          id: `prod_${Date.now()}`,
          nameTh: '',
          nameEn: '',
          descriptionTh: '',
          descriptionEn: '',
          categoryId: '',
          price: 120,
          cost: 40,
          recipeId: '',
          isAvailable: true,
          image: '',
          kitchenStation: 'kitchen',
          variants: [],
          modifierGroups: [],
        });
      }
    }
  }, [isOpen, productToEdit]);

  const loadDependencies = async () => {
    const [cats, recs] = await Promise.all([
      dbGetAll<ProductCategory>('categories'),
      dbGetAll<Recipe>('recipes'),
    ]);
    setCategories(cats);
    setRecipes(recs);
    if (!formData.categoryId && cats.length > 0) {
      setFormData((prev) => ({ ...prev, categoryId: cats[0].id }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImage(file);
      setFormData((prev) => ({ ...prev, image: compressedDataUrl }));
    } catch (err) {
      console.error('Failed to compress image:', err);
    }
  };

  const handleSelectRecipe = (recipeId: string) => {
    const selected = recipes.find((r) => r.id === recipeId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        recipeId: selected.id,
        cost: selected.totalCostPerPortion,
        price: prev.price || selected.actualSellingPrice,
        nameTh: prev.nameTh || selected.nameTh,
        nameEn: prev.nameEn || selected.nameEn,
      }));
    } else {
      setFormData((prev) => ({ ...prev, recipeId: '' }));
    }
  };

  const handleAddVariant = () => {
    const newVariant = {
      id: `var_${Date.now()}`,
      nameTh: 'พิเศษ',
      nameEn: 'Extra',
      priceDelta: 20,
      costDelta: 8,
    };
    setFormData((prev) => ({
      ...prev,
      variants: [...(prev.variants || []), newVariant],
    }));
  };

  const handleRemoveVariant = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: (prev.variants || []).filter((v) => v.id !== id),
    }));
  };

  const handleAddModifierGroup = () => {
    const newGroup = {
      id: `mod_${Date.now()}`,
      nameTh: 'ระดับความเผ็ด',
      nameEn: 'Spiciness',
      minSelect: 0,
      maxSelect: 1,
      options: [
        { id: `opt_${Date.now()}_1`, nameTh: 'เผ็ดน้อย', nameEn: 'Mild', priceDelta: 0 },
        { id: `opt_${Date.now()}_2`, nameTh: 'เผ็ดปกติ', nameEn: 'Medium', priceDelta: 0 },
        { id: `opt_${Date.now()}_3`, nameTh: 'เผ็ดมาก', nameEn: 'Hot', priceDelta: 0 },
      ],
    };
    setFormData((prev) => ({
      ...prev,
      modifierGroups: [...(prev.modifierGroups || []), newGroup],
    }));
  };

  const handleRemoveModifierGroup = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      modifierGroups: (prev.modifierGroups || []).filter((g) => g.id !== id),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameTh.trim()) return;

    await dbPut('products', formData);
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-white text-base">
              {productToEdit
                ? language === 'th' ? 'แก้ไขรายการอาหาร' : 'Edit Menu Item'
                : language === 'th' ? 'เพิ่มเมนูอาหารใหม่' : 'Add New Menu Item'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Photo and Link to Recipe */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Image Preview & Upload */}
            <div className="flex flex-col items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-amber-500 bg-neutral-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group"
              >
                {formData.image ? (
                  <>
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition">
                      {language === 'th' ? 'เปลี่ยนรูป' : 'Change'}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-neutral-500">
                    <ImageIcon className="w-8 h-8 text-neutral-600 mb-1" />
                    <span className="text-[11px] font-semibold text-neutral-400">{language === 'th' ? 'อัปโหลดรูป' : 'Upload photo'}</span>
                    <span className="text-[9px] text-neutral-600">ย่อรูปอัตโนมัติ</span>
                  </div>
                )}
              </div>
              {formData.image && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, image: '' })}
                  className="text-[11px] text-rose-400 hover:underline mt-1"
                >
                  {language === 'th' ? 'ลบรูปภาพ' : 'Remove photo'}
                </button>
              )}
            </div>

            {/* Recipe Connection */}
            <div className="sm:col-span-2 p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Link className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'เชื่อมต่อกับสูตรอาหารมาตรฐาน (Food Cost)' : 'Link with Standard Recipe'}</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {language === 'th'
                  ? 'เมื่อเชื่อมกับสูตร ต้นทุนของเมนูนี้จะถูกคำนวณและอัปเดตให้อัตโนมัติเมื่อราคาวัตถุดิบเปลี่ยน'
                  : 'Syncs food cost dynamically whenever raw ingredient prices change.'}
              </p>
              <select
                value={formData.recipeId || ''}
                onChange={(e) => handleSelectRecipe(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-white"
              >
                <option value="">{language === 'th' ? '-- ไม่ระบุสูตร (กำหนดต้นทุนเอง) --' : '-- No recipe link --'}</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameTh} (ต้นทุน: ฿{r.totalCostPerPortion.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {language === 'th' ? 'ชื่อเมนู (ภาษาไทย) *' : 'Item Name (Thai) *'}
              </label>
              <input
                type="text"
                required
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {language === 'th' ? 'ชื่อเมนู (English)' : 'Item Name (English)'}
              </label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Category & Kitchen Station */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {language === 'th' ? 'หมวดหมู่อาหาร' : 'Category'}
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {language === 'th' ? 'สเตชั่นส่งทำ (Kitchen Station)' : 'Kitchen Station'}
              </label>
              <select
                value={formData.kitchenStation}
                onChange={(e) => setFormData({ ...formData, kitchenStation: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white"
              >
                <option value="kitchen">{t.stationKitchen}</option>
                <option value="bar">{t.stationBar}</option>
                <option value="grill">{t.stationGrill}</option>
                <option value="dessert">{t.stationDessert}</option>
              </select>
            </div>
          </div>

          {/* Price & Cost */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                {language === 'th' ? 'ราคาขายหน้าร้าน (฿)' : 'Selling Price (฿)'}
              </label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-base font-bold bg-neutral-900 border border-neutral-700 rounded-lg text-emerald-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1">
                {language === 'th' ? 'ต้นทุนอาหารต่อจาน (฿)' : 'Food Cost (฿)'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-base font-bold bg-neutral-900 border border-neutral-700 rounded-lg text-rose-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1">
                {language === 'th' ? 'กำไรขั้นต้น (Margin)' : 'Gross Margin'}
              </label>
              <div className="text-base font-bold text-sky-400 font-mono py-2">
                {formData.price > 0
                  ? `${(((formData.price - formData.cost) / formData.price) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div>
              <span className="text-xs font-bold text-white">
                {language === 'th' ? 'เปิดให้สั่งอาหารได้ (พร้อมจำหน่าย)' : 'In Stock & Available to Order'}
              </span>
              <p className="text-[11px] text-neutral-500">
                {language === 'th' ? 'ปิดสวิตช์หากวัตถุดิบหมดหน้าร้าน' : 'Toggle off if item is sold out'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Variants Manager */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                {language === 'th' ? 'ตัวเลือกขนาด / ชนิดเนื้อสัตว์ (Variants)' : 'Size & Protein Variants'}
              </span>
              <button
                type="button"
                onClick={handleAddVariant}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'th' ? 'เพิ่มตัวเลือก' : 'Add Variant'}
              </button>
            </div>

            {formData.variants && formData.variants.length > 0 && (
              <div className="space-y-2">
                {formData.variants.map((variant, idx) => (
                  <div key={variant.id} className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs">
                    <input
                      type="text"
                      placeholder="ชื่อตัวเลือก (ไทย)"
                      value={variant.nameTh}
                      onChange={(e) => {
                        const updated = [...(formData.variants || [])];
                        updated[idx].nameTh = e.target.value;
                        setFormData({ ...formData, variants: updated });
                      }}
                      className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white"
                    />
                    <input
                      type="number"
                      placeholder="เพิ่มราคา (+฿)"
                      value={variant.priceDelta}
                      onChange={(e) => {
                        const updated = [...(formData.variants || [])];
                        updated[idx].priceDelta = Number(e.target.value) || 0;
                        setFormData({ ...formData, variants: updated });
                      }}
                      className="w-24 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-right font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(variant.id)}
                      className="p-1 text-neutral-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modifier Groups Manager */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                {language === 'th' ? 'ตัวเลือกเพิ่มเติม / ความหวาน / ความเผ็ด (Modifiers)' : 'Modifier Groups'}
              </span>
              <button
                type="button"
                onClick={handleAddModifierGroup}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'th' ? 'เพิ่มกลุ่มตัวเลือก' : 'Add Modifier Group'}
              </button>
            </div>

            {formData.modifierGroups && formData.modifierGroups.length > 0 && (
              <div className="space-y-3">
                {formData.modifierGroups.map((group, gIdx) => (
                  <div key={group.id} className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={group.nameTh}
                        onChange={(e) => {
                          const updated = [...(formData.modifierGroups || [])];
                          updated[gIdx].nameTh = e.target.value;
                          setFormData({ ...formData, modifierGroups: updated });
                        }}
                        className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveModifierGroup(group.id)}
                        className="p-1 text-neutral-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {group.options.map((opt) => (
                        <span key={opt.id} className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-300">
                          {opt.nameTh} {opt.priceDelta > 0 && `(+฿${opt.priceDelta})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-lg shadow-amber-500/20 transition"
            >
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
