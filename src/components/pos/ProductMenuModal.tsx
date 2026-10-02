import React, { useState, useEffect, useRef } from 'react';
import { Product, ProductCategory, Recipe, ModifierGroup, ProductVariant, PosGroup } from '../../types';
import { dbGetAll, dbPut } from '../../db';
import { useTranslation } from '../../i18n';
import { compressImage } from '../../utils/imageCompressor';
import {
  X,
  Plus,
  Trash2,
  UtensilsCrossed,
  Image as ImageIcon,
  Link,
  Layers,
  Sparkles,
  Printer,
  ChevronDown,
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
  const [groups, setGroups] = useState<PosGroup[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'pick_recipe' or 'create_inline'
  const [creationMode, setCreationMode] = useState<'pick_recipe' | 'create_inline'>('create_inline');

  const [formData, setFormData] = useState<Product>({
    id: '',
    nameTh: '',
    nameEn: '',
    descriptionTh: '',
    descriptionEn: '',
    categoryId: '',
    groupId: undefined,
    price: 120,
    cost: 40,
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
        setCreationMode(productToEdit.recipeId ? 'pick_recipe' : 'create_inline');
      } else {
        setFormData({
          id: `prod_${Date.now()}`,
          nameTh: '',
          nameEn: '',
          descriptionTh: '',
          descriptionEn: '',
          categoryId: '',
          groupId: undefined,
          price: 120,
          cost: 40,
          recipeId: '',
          isAvailable: true,
          image: '',
          kitchenStation: 'kitchen',
          variants: [],
          modifierGroups: [],
        });
        setCreationMode('create_inline');
      }
    }
  }, [isOpen, productToEdit]);

  const loadDependencies = async () => {
    const [cats, recs, allProds] = await Promise.all([
      dbGetAll<ProductCategory>('categories'),
      dbGetAll<Recipe>('recipes'),
      dbGetAll<Product>('products'),
    ]);
    setCategories(cats);
    // Menu recipes only
    setRecipes(recs.filter((r) => r.type === 'menu' || r.type === 'dish'));

    // Extract groups
    const grpList: PosGroup[] = [];
    allProds.forEach((p) => {
      if (p.groupId && p.groupName && !grpList.some((g) => g.id === p.groupId)) {
        grpList.push({
          id: p.groupId,
          categoryId: p.categoryId,
          name: { th: p.groupName, en: p.groupName },
          nameTh: p.groupName,
          nameEn: p.groupName,
          sortOrder: 1,
        });
      }
    });
    setGroups(grpList);

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
        cost: selected.totalCostPerPortion || 0,
        price: selected.actualSellingPrice || selected.suggestedSellingPrice || prev.price,
        nameTh: selected.nameTh || prev.nameTh,
        nameEn: selected.nameEn || prev.nameEn,
        categoryId: prev.categoryId || categories[0]?.id || '',
      }));
    } else {
      setFormData((prev) => ({ ...prev, recipeId: '' }));
    }
  };

  const handleAddVariant = () => {
    const newVariant: ProductVariant = {
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
    const newGroup: ModifierGroup = {
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
    if (!formData.nameTh.trim()) {
      alert(language === 'th' ? 'กรุณาระบุชื่อเมนูภาษาไทย' : 'Please provide item Thai name');
      return;
    }

    let linkedRecipeId = formData.recipeId;

    // Single source of truth: If creating new menu inline without a selected recipe, create the Recipe 1:1
    if (!linkedRecipeId || creationMode === 'create_inline') {
      if (!linkedRecipeId) {
        linkedRecipeId = `rec_${Date.now()}`;
        const newRecipe: Recipe = {
          id: linkedRecipeId,
          nameTh: formData.nameTh.trim(),
          nameEn: formData.nameEn.trim() || formData.nameTh.trim(),
          type: 'menu',
          category: formData.categoryId,
          portionsYield: 1,
          items: [],
          actualSellingPrice: formData.price,
          suggestedSellingPrice: formData.price,
          totalCostPerPortion: formData.cost,
          totalRawCost: 0,
          laborCostPerPortion: 0,
          packagingCostPerPortion: 0,
          targetFoodCostPct: 30,
          grossMarginPct: Number((((formData.price - formData.cost) / (formData.price || 1)) * 100).toFixed(1)),
          updatedAt: new Date().toISOString(),
        };
        await dbPut('recipes', newRecipe);
      } else {
        // Update linked recipe's name and price
        const existingRec = recipes.find((r) => r.id === linkedRecipeId);
        if (existingRec) {
          const updatedRec: Recipe = {
            ...existingRec,
            nameTh: formData.nameTh.trim(),
            nameEn: formData.nameEn.trim() || formData.nameTh.trim(),
            actualSellingPrice: formData.price,
            totalCostPerPortion: formData.cost,
            updatedAt: new Date().toISOString(),
          };
          await dbPut('recipes', updatedRec);
        }
      }
    }

    const productToSave: Product = {
      ...formData,
      recipeId: linkedRecipeId,
      nameTh: formData.nameTh.trim(),
      nameEn: formData.nameEn.trim() || formData.nameTh.trim(),
    };

    await dbPut('products', productToSave);
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-[#111827] text-lg">
              {productToEdit
                ? language === 'th' ? 'แก้ไขสินค้าหน้าร้าน (POS Product)' : 'Edit POS Product'
                : language === 'th' ? 'เพิ่มสินค้าหน้าร้านใหม่' : 'Add New POS Product'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FFFFFF]">
          {/* Creation Mode Toggle (Pick existing vs Create new inline) */}
          {!productToEdit && (
            <div className="flex border border-[#FED7AA] rounded-xl overflow-hidden bg-[#FFF8EE] p-1">
              <button
                type="button"
                onClick={() => setCreationMode('create_inline')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  creationMode === 'create_inline'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'text-[#374151] hover:text-[#111827]'
                }`}
              >
                {language === 'th' ? '✨ สร้างเมนูใหม่ทันที (Inline)' : '✨ Create New Menu Inline'}
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('pick_recipe')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                  creationMode === 'pick_recipe'
                    ? 'bg-[#EA580C] text-white shadow-xs'
                    : 'text-[#374151] hover:text-[#111827]'
                }`}
              >
                {language === 'th' ? '🔗 เลือกจากสูตรอาหารเดิม' : '🔗 Link Existing Recipe'}
              </button>
            </div>
          )}

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
                className="w-32 h-32 rounded-2xl border-2 border-dashed border-[#FDBA74] hover:border-[#EA580C] bg-[#FFF8EE] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group"
              >
                {formData.image ? (
                  <>
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                      {language === 'th' ? 'เปลี่ยนรูป' : 'Change'}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center p-2 text-[#6B7280]">
                    <ImageIcon className="w-8 h-8 text-[#F97316] mb-1" />
                    <span className="text-[12px] font-bold text-[#111827]">
                      {language === 'th' ? 'อัปโหลดรูป' : 'Upload photo'}
                    </span>
                    <span className="text-[10px] text-[#6B7280]">ย่อรูปอัตโนมัติ</span>
                  </div>
                )}
              </div>
              {formData.image && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, image: '' })}
                  className="text-xs text-[#DC2626] hover:underline mt-1 font-bold cursor-pointer"
                >
                  {language === 'th' ? 'ลบรูปภาพ' : 'Remove photo'}
                </button>
              )}
            </div>

            {/* Recipe Connection */}
            <div className="sm:col-span-2 p-3.5 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#9A3412]">
                <Link className="w-4 h-4 text-[#EA580C]" />
                <span>
                  {language === 'th'
                    ? 'ผูกกับสูตรอาหารมาตรฐาน (Single Source of Truth)'
                    : 'Linked to Menu Recipe'}
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                {language === 'th'
                  ? 'ชื่อเมนู ราคา และต้นทุนต่อจานจะอิงจากสูตรอาหารมาตรฐานเป็นแหล่งข้อมูลหลัก (1:1)'
                  : 'Name, price and cost always sync from the linked Recipe (single source of truth).'}
              </p>
              {creationMode === 'pick_recipe' || formData.recipeId ? (
                <select
                  value={formData.recipeId || ''}
                  onChange={(e) => handleSelectRecipe(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#FDBA74] rounded-lg text-[#111827] focus:ring-2 focus:ring-[#F97316]"
                >
                  <option value="">
                    {language === 'th' ? '-- เลือกสูตรอาหารเมนู --' : '-- Select Menu Recipe --'}
                  </option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameTh} (ราคา: ฿{r.actualSellingPrice || r.suggestedSellingPrice} | ต้นทุน: ฿{r.totalCostPerPortion?.toFixed(2)})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-[#EA580C] font-semibold bg-[#FFEDD5] p-2 rounded-lg">
                  {language === 'th'
                    ? '✓ ระบบจะสร้างสูตรอาหารเมนูให้โดยอัตโนมัติเมื่อกดบันทึก สามารถใส่ส่วนผสมต้นทุนได้ในหน้าสูตรอาหารภายหลัง'
                    : '✓ A recipe of type "menu" will be created automatically upon save.'}
                </div>
              )}
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'ชื่อเมนู (ภาษาไทย) *' : 'Item Name (Thai) *'}
              </label>
              <input
                type="text"
                required
                value={formData.nameTh}
                onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                className="w-full h-[44px] px-3 text-sm bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
                placeholder="เช่น ผัดกะเพราเนื้อโคขุน"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'ชื่อเมนู (English)' : 'Item Name (English)'}
              </label>
              <input
                type="text"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full h-[44px] px-3 text-sm bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
                placeholder="e.g. Beef Holy Basil"
              />
            </div>
          </div>

          {/* Category & Kitchen Station & Group */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'หมวดหมู่สินค้า *' : 'Category *'}
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full h-[44px] px-3 text-sm bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'กลุ่มย่อย (Optional Group)' : 'Sub Group'}
              </label>
              <input
                type="text"
                value={formData.groupName || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    groupName: e.target.value,
                    groupId: e.target.value.trim() ? `grp_${Date.now()}` : undefined,
                  })
                }
                placeholder="เช่น ชุดเซ็ตสุดคุ้ม, Delivery >"
                className="w-full h-[44px] px-3 text-sm bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'สเตชั่นส่งทำ (Kitchen Station)' : 'Kitchen Station'}
              </label>
              <select
                value={formData.kitchenStation}
                onChange={(e) => setFormData({ ...formData, kitchenStation: e.target.value as any })}
                className="w-full h-[44px] px-3 text-sm bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
              >
                <option value="kitchen">ครัวหลัก (Kitchen)</option>
                <option value="bar">บาร์น้ำ (Bar)</option>
                <option value="grill">สเตชั่นเตาย่าง (Grill)</option>
                <option value="dessert">ของหวาน (Dessert)</option>
              </select>
            </div>
          </div>

          {/* Price & Cost */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl">
            <div>
              <label className="block text-xs font-bold text-[#111827] mb-1">
                {language === 'th' ? 'ราคาขายหน้าร้าน (฿) *' : 'Selling Price (฿) *'}
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
                className="w-full h-[48px] px-3.5 text-xl font-bold bg-[#FFFFFF] border border-[#FDBA74] rounded-xl text-[#EA580C] focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                {language === 'th' ? 'ต้นทุนอาหารต่อจาน (฿)' : 'Food Cost (฿)'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) || 0 })}
                className="w-full h-[48px] px-3.5 text-xl font-bold bg-[#FFFFFF] border border-[#FED7AA] rounded-xl text-[#111827] focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          {/* Variants (e.g. Regular / Extra) */}
          <div className="space-y-2 border border-[#FED7AA] rounded-xl p-3.5 bg-[#FFFFFF]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">
                {language === 'th' ? 'ขนาด / ตัวเลือกไซซ์ (Variants)' : 'Variants'}
              </span>
              <button
                type="button"
                onClick={handleAddVariant}
                className="text-xs text-[#EA580C] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'เพิ่มไซซ์' : 'Add Variant'}</span>
              </button>
            </div>
            {formData.variants && formData.variants.length > 0 && (
              <div className="space-y-2 pt-1">
                {formData.variants.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 bg-[#FFF8EE] p-2 rounded-lg border border-[#FED7AA]">
                    <input
                      type="text"
                      placeholder="ชื่อไซซ์ (ไทย)"
                      value={v.nameTh}
                      onChange={(e) => {
                        const copy = [...formData.variants!];
                        copy[i].nameTh = e.target.value;
                        setFormData({ ...formData, variants: copy });
                      }}
                      className="flex-1 h-[36px] px-2 text-xs bg-[#FFFFFF] border border-[#FED7AA] rounded-lg"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-[#6B7280]">+฿</span>
                      <input
                        type="number"
                        placeholder="เพิ่มราคา"
                        value={v.priceDelta}
                        onChange={(e) => {
                          const copy = [...formData.variants!];
                          copy[i].priceDelta = Number(e.target.value) || 0;
                          setFormData({ ...formData, variants: copy });
                        }}
                        className="w-20 h-[36px] px-2 text-xs bg-[#FFFFFF] border border-[#FED7AA] rounded-lg font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(v.id)}
                      className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modifier Groups */}
          <div className="space-y-2 border border-[#FED7AA] rounded-xl p-3.5 bg-[#FFFFFF]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">
                {language === 'th' ? 'กลุ่มท็อปปิ้ง / ระดับความเผ็ด (Modifier Groups)' : 'Modifier Groups'}
              </span>
              <button
                type="button"
                onClick={handleAddModifierGroup}
                className="text-xs text-[#EA580C] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'th' ? 'เพิ่มกลุ่มตัวเลือก' : 'Add Group'}</span>
              </button>
            </div>
            {formData.modifierGroups && formData.modifierGroups.length > 0 && (
              <div className="space-y-2 pt-1">
                {formData.modifierGroups.map((grp, gi) => (
                  <div key={grp.id} className="p-2.5 bg-[#FFF8EE] rounded-lg border border-[#FED7AA] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="ชื่อกลุ่ม เช่น ระดับความเผ็ด"
                        value={grp.nameTh}
                        onChange={(e) => {
                          const copy = [...formData.modifierGroups!];
                          copy[gi].nameTh = e.target.value;
                          setFormData({ ...formData, modifierGroups: copy });
                        }}
                        className="flex-1 h-[36px] px-2 text-xs font-bold bg-[#FFFFFF] border border-[#FED7AA] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveModifierGroup(grp.id)}
                        className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-2">
                      {grp.options.map((opt) => (
                        <span key={opt.id} className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#FED7AA] text-[11px] text-[#374151]">
                          {opt.nameTh} {opt.priceDelta > 0 && `(+฿${opt.priceDelta})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-[#FED7AA]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFFFFF] hover:bg-neutral-100 text-[#374151] font-bold text-sm cursor-pointer"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-sm shadow-sm cursor-pointer"
            >
              {language === 'th' ? 'บันทึกสินค้า' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
