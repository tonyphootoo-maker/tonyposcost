import React, { useState, useEffect } from 'react';
import {
  Recipe,
  Ingredient,
  RecipeIngredient,
  ExtraCost,
  RecipeType,
  Settings,
  Product,
} from '../../types';
import { dbGetAll, dbPut, dbDelete, dbGet } from '../../db';
import { useTranslation } from '../../i18n';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Save,
  Percent,
  Search,
  Copy,
  AlertTriangle,
  X,
  Layers,
  ChefHat,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Info,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';
import {
  calcRecipeCosts,
  calcIngredientCostPerBaseUnit,
  convertToBaseUnit,
  formatMoney,
  formatPercent,
  analyzeSellingPrice,
} from '../../utils/calc';
import { generateUUID } from '../../utils/uuid';
import { DEFAULT_RECIPE_CATEGORIES } from '../../types';

interface FoodCostViewProps {
  onRecipesUpdated?: () => void;
}

export const FoodCostView: React.FC<FoodCostViewProps> = ({ onRecipesUpdated }) => {
  const { t, formatCurrency } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'menu' | 'sub'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Blocked Delete Modal (Section 6.2)
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{
    subRecipeName: string;
    usedInRecipes: string[];
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Recipe>({
    id: '',
    name: '',
    nameTh: '',
    nameEn: '',
    type: 'menu',
    category: 'จานหลัก',
    ingredients: [],
    outputQty: 1,
    outputUnit: 'จาน',
    extraCosts: [],
    overheadPercentOverride: undefined,
    targetFoodCostOverride: 30,
    sellPrice: 100,
    actualSellingPrice: 100,
    suggestedSellingPrice: 100,
    deliveryPrices: {},
    note: '',
    portionsYield: 1,
    items: [],
    laborCostPerPortion: 0,
    packagingCostPerPortion: 0,
    totalRawCost: 0,
    totalCostPerPortion: 0,
    targetFoodCostPct: 30,
    grossMarginPct: 0,
    updatedAt: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [recList, ingList, prodList, savedSettings] = await Promise.all([
      dbGetAll<Recipe>('recipes'),
      dbGetAll<Ingredient>('ingredients'),
      dbGetAll<Product>('products'),
      dbGet<Settings>('settings', 'current_settings'),
    ]);
    setRecipes(recList);
    setIngredients(ingList);
    setProducts(prodList);
    if (savedSettings) {
      setSettings(savedSettings);
    }

    if (recList.length > 0 && !selectedRecipe) {
      setSelectedRecipe(recList[0]);
    }
  };

  const categories =
    settings?.recipeCategories && settings.recipeCategories.length > 0
      ? settings.recipeCategories
      : DEFAULT_RECIPE_CATEGORIES;

  const handleSelectRecipe = (rec: Recipe) => {
    setSelectedRecipe(rec);
    setIsEditing(false);
  };

  const handleCreateNew = () => {
    const newId = generateUUID();
    const newRec: Recipe = {
      id: newId,
      name: '',
      nameTh: '',
      nameEn: '',
      type: 'menu',
      category: categories[0] || 'จานหลัก',
      ingredients: [],
      outputQty: 1,
      outputUnit: 'จาน',
      extraCosts: [
        { id: generateUUID(), name: 'บรรจุภัณฑ์/กล่อง', amount: 3 },
        { id: generateUUID(), name: 'ค่าพลังงาน/แก๊ส', amount: 2 },
      ],
      overheadPercentOverride: undefined,
      targetFoodCostOverride: settings?.defaultTargetFoodCostPercent || 30,
      sellPrice: 120,
      actualSellingPrice: 120,
      suggestedSellingPrice: 120,
      deliveryPrices: {},
      note: '',
      portionsYield: 1,
      items: [],
      laborCostPerPortion: 0,
      packagingCostPerPortion: 0,
      totalRawCost: 0,
      totalCostPerPortion: 0,
      targetFoodCostPct: 30,
      grossMarginPct: 0,
      updatedAt: new Date().toISOString(),
    };

    setFormData(newRec);
    setSelectedRecipe(newRec);
    setIsEditing(true);
  };

  const handleStartEdit = () => {
    if (!selectedRecipe) return;
    setFormData({
      ...selectedRecipe,
      ingredients: selectedRecipe.ingredients ? [...selectedRecipe.ingredients] : [],
      extraCosts: selectedRecipe.extraCosts ? [...selectedRecipe.extraCosts] : [],
    });
    setIsEditing(true);
  };

  const handleDuplicate = async (rec: Recipe) => {
    const duplicated: Recipe = {
      ...rec,
      id: generateUUID(),
      name: `${rec.nameTh || rec.name} (สำเนา)`,
      nameTh: `${rec.nameTh || rec.name} (สำเนา)`,
      nameEn: rec.nameEn ? `${rec.nameEn} (Copy)` : '',
      ingredients: rec.ingredients ? [...rec.ingredients] : [],
      extraCosts: rec.extraCosts ? [...rec.extraCosts] : [],
      updatedAt: new Date().toISOString(),
    };

    await dbPut('recipes', duplicated);
    showToast({
      title: 'คัดลอกสูตรสำเร็จ',
      message: `สร้างสำเนา "${duplicated.nameTh}" เรียบร้อย`,
      type: 'success',
    });
    await loadData();
    setSelectedRecipe(duplicated);
    setIsEditing(false);
    onRecipesUpdated?.();
  };

  const handleDelete = async (rec: Recipe) => {
    // 6.2 Deleting a sub-recipe used elsewhere is blocked with an explanation
    const isSub = rec.type === 'sub' || rec.type === 'sub_recipe';
    if (isSub) {
      const usedIn = recipes.filter((r) =>
        r.id !== rec.id &&
        r.ingredients?.some((line) => line.sourceType === 'recipe' && line.sourceId === rec.id)
      );

      if (usedIn.length > 0) {
        setBlockedDeleteInfo({
          subRecipeName: rec.nameTh || rec.name || '',
          usedInRecipes: usedIn.map((r) => r.nameTh || r.name || ''),
        });
        return;
      }
    }

    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสูตร "${rec.nameTh || rec.name || ''}"?`)) return;

    await dbDelete('recipes', rec.id);
    showToast({
      title: 'ลบสำเร็จ',
      message: `ลบสูตร "${rec.nameTh || rec.name}" เรียบร้อยแล้ว`,
      type: 'info',
    });

    const remaining = recipes.filter((r) => r.id !== rec.id);
    setRecipes(remaining);
    setSelectedRecipe(remaining.length > 0 ? remaining[0] : null);
    setIsEditing(false);
    onRecipesUpdated?.();
  };

  // Add line to recipe editor
  const handleAddIngredientLine = () => {
    if (ingredients.length === 0) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณาสร้างวัตถุดิบก่อน', type: 'error' });
      return;
    }

    const firstIng = ingredients[0];
    const newLine: RecipeIngredient = {
      id: generateUUID(),
      sourceType: 'ingredient',
      sourceId: firstIng.id,
      qty: 100,
      unit: (firstIng.baseUnit || firstIng.usageUnit || 'g').toString(),
    };

    setFormData((prev) => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), newLine],
    }));
  };

  const handleUpdateLine = (index: number, updates: Partial<RecipeIngredient>) => {
    setFormData((prev) => {
      const lines = [...(prev.ingredients || [])];
      lines[index] = { ...lines[index], ...updates };

      // If sourceId changed to another ingredient, reset unit to that ingredient's base unit
      if (updates.sourceId && lines[index].sourceType === 'ingredient') {
        const targetIng = ingredients.find((i) => i.id === updates.sourceId);
        if (targetIng) {
          lines[index].unit = (targetIng.baseUnit || targetIng.usageUnit || 'g').toString();
        }
      } else if (updates.sourceId && lines[index].sourceType === 'recipe') {
        const targetRec = recipes.find((r) => r.id === updates.sourceId);
        if (targetRec) {
          lines[index].unit = targetRec.outputUnit || 'portion';
        }
      }

      return { ...prev, ingredients: lines };
    });
  };

  const handleRemoveLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter((_, i) => i !== index),
    }));
  };

  // Extra Costs
  const handleAddExtraCost = () => {
    setFormData((prev) => ({
      ...prev,
      extraCosts: [
        ...(prev.extraCosts || []),
        { id: generateUUID(), name: '', amount: 0 },
      ],
    }));
  };

  const handleUpdateExtraCost = (index: number, field: keyof ExtraCost, val: string | number) => {
    setFormData((prev) => {
      const extras = [...(prev.extraCosts || [])];
      extras[index] = { ...extras[index], [field]: val };
      return { ...prev, extraCosts: extras };
    });
  };

  const handleRemoveExtraCost = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      extraCosts: (prev.extraCosts || []).filter((_, i) => i !== index),
    }));
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameTh.trim()) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกชื่อสูตรอาหาร', type: 'error' });
      return;
    }

    // Calculate costs
    const breakdown = calcRecipeCosts(formData, recipes, ingredients, settings);
    const totalCost = breakdown.totalCostPerServing;

    const toSave: Recipe = {
      ...formData,
      name: formData.nameTh.trim(),
      nameTh: formData.nameTh.trim(),
      nameEn: formData.nameEn?.trim() || '',
      totalCostPerPortion: Number(totalCost.toFixed(2)),
      actualSellingPrice: formData.sellPrice || formData.actualSellingPrice || 0,
      suggestedSellingPrice: Math.round(totalCost / ((formData.targetFoodCostOverride || 30) / 100)),
      updatedAt: new Date().toISOString(),
    };

    await dbPut('recipes', toSave);
    showToast({
      title: 'บันทึกสูตรสำเร็จ',
      message: `${toSave.nameTh} (ต้นทุนรวม ฿${toSave.totalCostPerPortion}/เสิร์ฟ)`,
      type: 'success',
    });

    setIsEditing(false);
    setSelectedRecipe(toSave);
    await loadData();
    onRecipesUpdated?.();
  };

  // Filtered recipes list
  const filtered = recipes.filter((r) => {
    const isSub = r.type === 'sub' || r.type === 'sub_recipe';
    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'menu' && !isSub) ||
      (typeFilter === 'sub' && isSub);
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesSearch =
      (r.nameTh || r.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.nameEn || '').toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesCat && matchesSearch;
  });

  // Calculate live breakdown for selected or editing recipe
  const activeRecipe = isEditing ? formData : selectedRecipe;
  const currentBreakdown = activeRecipe
    ? calcRecipeCosts(activeRecipe, recipes, ingredients, settings)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-500" />
            {t.recipes || 'สูตรอาหารและสูตรย่อย (Recipes)'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            สร้างและวิเคราะห์โครงสร้างต้นทุนอาหารทั้ง "เมนูขาย" และ "สูตรย่อย" พร้อมคำนวณต้นทุนต่อเสิร์ฟอัตโนมัติ
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างสูตรอาหารใหม่</span>
        </button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Recipes Directory (5 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อสูตรอาหาร..."
                className="w-full pl-9 pr-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500 min-h-[40px]"
              />
            </div>

            {/* Type Filter Tabs: All, Menu, Sub-recipe */}
            <div className="grid grid-cols-3 gap-1 bg-[#FFFBF5] p-1 rounded-lg border border-[#FED7AA]">
              <button
                onClick={() => setTypeFilter('all')}
                className={`py-1.5 text-xs font-bold rounded-md transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setTypeFilter('menu')}
                className={`py-1.5 text-xs font-bold rounded-md transition-colors ${
                  typeFilter === 'menu'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                เมนูขาย
              </button>
              <button
                onClick={() => setTypeFilter('sub')}
                className={`py-1.5 text-xs font-bold rounded-md transition-colors ${
                  typeFilter === 'sub'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                สูตรย่อย
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md border whitespace-nowrap ${
                  categoryFilter === 'all'
                    ? 'bg-orange-100 border-orange-300 text-orange-900'
                    : 'bg-white border-[#FED7AA] text-[#6B7280]'
                }`}
              >
                ทุกหมวด
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md border whitespace-nowrap ${
                    categoryFilter === c
                      ? 'bg-orange-100 border-orange-300 text-orange-900'
                      : 'bg-white border-[#FED7AA] text-[#6B7280]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Recipes Scrollable List */}
          <div className="bg-white rounded-xl border border-[#FED7AA] shadow-xs divide-y divide-[#FED7AA] max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280] text-xs">
                {t.emptyState || 'ไม่พบรายการสูตรอาหาร'}
              </div>
            ) : (
              filtered.map((rec) => {
                const isSelected = selectedRecipe?.id === rec.id;
                const isSub = rec.type === 'sub' || rec.type === 'sub_recipe';
                const cost = rec.totalCostPerPortion || 0;

                return (
                  <div
                    key={rec.id}
                    onClick={() => handleSelectRecipe(rec)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-orange-50/80 border-l-4 border-orange-500' : 'hover:bg-orange-50/30'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-[#1F2937] flex items-center gap-1.5">
                        <span>{rec.nameTh || rec.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isSub
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isSub ? 'สูตรย่อย' : 'เมนูขาย'}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5">
                        หมวด: {rec.category || 'จานหลัก'} • {rec.ingredients?.length || rec.items?.length || 0} รายการ
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-red-600">
                        ต้นทุน ฿{cost.toFixed(2)}
                      </div>
                      {!isSub && (
                        <div className="text-xs font-mono text-orange-600 font-extrabold">
                          ขาย ฿{(rec.actualSellingPrice || rec.sellPrice || 0).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Recipe Editor & Cost Breakdown (7 Cols) */}
        <div className="lg:col-span-8">
          {!selectedRecipe && !isEditing ? (
            <div className="bg-white p-12 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
              <ChefHat className="w-12 h-12 mx-auto text-orange-300 mb-3" />
              <p className="font-bold text-sm">เลือกสูตรอาหารทางซ้ายเพื่อดูรายละเอียด หรือกดสร้างสูตรใหม่</p>
            </div>
          ) : isEditing ? (
            // ================= RECIPE EDITOR (Section 6.2) =================
            <form onSubmit={handleSaveRecipe} className="bg-white p-6 rounded-xl border border-[#FED7AA] shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#FED7AA]">
                <h2 className="text-base font-extrabold text-[#1F2937]">
                  {formData.id ? 'แก้ไขข้อมูลสูตรอาหาร' : 'สร้างสูตรอาหารใหม่'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-[#6B7280] hover:text-[#1F2937]"
                >
                  ยกเลิก
                </button>
              </div>

              {/* General Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">
                    ชื่อสูตร (TH) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameTh}
                    onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    placeholder="เช่น ต้มยำกุ้งแม่น้ำ, ซอสผัดไทย"
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500 min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">ชื่อภาษาอังกฤษ</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Tom Yum Goong"
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500 min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">ประเภทสูตร</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as RecipeType })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs font-bold min-h-[40px]"
                  >
                    <option value="menu">เมนูขาย (Menu Dish)</option>
                    <option value="sub">สูตรย่อย (Sub-recipe ซอส/น้ำสต็อก)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">หมวดหมู่อาหาร</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs min-h-[40px]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-recipe Output Qty & Unit (Required for sub) */}
                {(formData.type === 'sub' || formData.type === 'sub_recipe') ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">
                        ปริมาณผลผลิตที่ได้ (Output Qty) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        required
                        value={formData.outputQty}
                        onChange={(e) => setFormData({ ...formData, outputQty: Math.max(0.1, Number(e.target.value) || 1) })}
                        className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-mono font-bold min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">หน่วยผลผลิต (Output Unit)</label>
                      <input
                        type="text"
                        required
                        value={formData.outputUnit}
                        onChange={(e) => setFormData({ ...formData, outputUnit: e.target.value })}
                        placeholder="เช่น g, ml, ถ้วย, ลิตร"
                        className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-bold min-h-[40px]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#1F2937] mb-1">ราคาขายหน้าร้าน (฿)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={formData.sellPrice}
                        onChange={(e) => setFormData({ ...formData, sellPrice: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs font-mono font-bold min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1F2937] mb-1">Target Food Cost %</label>
                      <input
                        type="number"
                        min="5"
                        max="80"
                        value={formData.targetFoodCostOverride || 30}
                        onChange={(e) => setFormData({ ...formData, targetFoodCostOverride: Number(e.target.value) || 30 })}
                        className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs font-mono min-h-[40px]"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* INGREDIENT LINES (Section 6.2: ingredient OR sub-recipe) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                    รายการวัตถุดิบและสูตรย่อย ({formData.ingredients?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddIngredientLine}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มวัตถุดิบ</span>
                  </button>
                </div>

                <div className="bg-[#FFFBF5] p-3 rounded-xl border border-[#FED7AA] space-y-2">
                  {(formData.ingredients || []).length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#6B7280]">
                      ยังไม่มีรายการวัตถุดิบ กดปุ่ม "เพิ่มวัตถุดิบ" ด้านบนเพื่อเริ่มระบุสูตร
                    </div>
                  ) : (
                    (formData.ingredients || []).map((line, idx) => {
                      const isSub = line.sourceType === 'recipe';
                      // Options for unit
                      let availableUnits: string[] = ['g', 'kg'];
                      if (!isSub) {
                        const ing = ingredients.find((i) => i.id === line.sourceId);
                        if (ing) {
                          const base = ing.baseUnit || ing.usageUnit || 'g';
                          if (base === 'g') availableUnits = ['g', 'kg'];
                          else if (base === 'ml') availableUnits = ['ml', 'l'];
                          else if (base === 'pcs') availableUnits = ['pcs', 'piece'];
                          if (ing.customUnits) {
                            availableUnits.push(...ing.customUnits.map((c) => c.name));
                          }
                        }
                      } else {
                        const sub = recipes.find((r) => r.id === line.sourceId);
                        availableUnits = [sub?.outputUnit || 'portion'];
                      }

                      return (
                        <div
                          key={line.id}
                          className="bg-white p-3 rounded-xl border border-[#FED7AA] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                        >
                          {/* Type Select */}
                          <div className="sm:col-span-2">
                            <select
                              value={line.sourceType}
                              onChange={(e) =>
                                handleUpdateLine(idx, {
                                  sourceType: e.target.value as any,
                                  sourceId: e.target.value === 'recipe' ? (recipes[0]?.id || '') : (ingredients[0]?.id || ''),
                                })
                              }
                              className="w-full px-2 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs font-bold"
                            >
                              <option value="ingredient">วัตถุดิบ</option>
                              <option value="recipe">สูตรย่อย</option>
                            </select>
                          </div>

                          {/* Source Item Select */}
                          <div className="sm:col-span-4">
                            <select
                              value={line.sourceId}
                              onChange={(e) => handleUpdateLine(idx, { sourceId: e.target.value })}
                              className="w-full px-2 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs font-bold"
                            >
                              {line.sourceType === 'ingredient' ? (
                                ingredients.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.nameTh || i.name} (฿{i.unitCost}/{i.baseUnit || 'g'})
                                  </option>
                                ))
                              ) : (
                                recipes
                                  .filter((r) => r.id !== formData.id && (r.type === 'sub' || r.type === 'sub_recipe'))
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.nameTh || r.name} (฿{r.totalCostPerPortion}/{r.outputUnit || 'เสิร์ฟ'})
                                    </option>
                                  ))
                              )}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              value={line.qty}
                              onChange={(e) => handleUpdateLine(idx, { qty: Number(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs font-mono font-bold text-center"
                            />
                          </div>

                          {/* Unit Selector (Convertible Units) */}
                          <div className="sm:col-span-2">
                            <select
                              value={line.unit}
                              onChange={(e) => handleUpdateLine(idx, { unit: e.target.value })}
                              className="w-full px-2 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs"
                            >
                              {availableUnits.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Line Action */}
                          <div className="sm:col-span-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                              title="ลบแถวนี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* UNLIMITED EXTRA COSTS (Section 6.2) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                    ต้นทุนแฝงและบรรจุภัณฑ์ต่อจาน (Extra Costs)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddExtraCost}
                    className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มรายการต้นทุนแฝง
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.extraCosts || []).map((ex, idx) => (
                    <div key={ex.id || idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ชื่อต้นทุนแฝง เช่น กล่องกระดาษ, ช้อนส้อม"
                        value={ex.name}
                        onChange={(e) => handleUpdateExtraCost(idx, 'name', e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={ex.amount}
                          onChange={(e) => handleUpdateExtraCost(idx, 'amount', Number(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs font-mono font-bold text-right"
                        />
                        <span className="text-xs text-[#6B7280]">฿</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraCost(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overhead % Override */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">
                    Overhead % เฉพาะสูตรนี้ (เว้นว่างเพื่อใช้ค่าเริ่มต้นของร้าน: {settings?.defaultOverheadPercent || 0}%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={`ค่าเริ่มต้น (${settings?.defaultOverheadPercent || 0}%)`}
                    value={formData.overheadPercentOverride ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        overheadPercentOverride: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs font-mono min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">บันทึกขั้นตอนการทำ (Instructions/Notes)</label>
                  <textarea
                    rows={2}
                    value={formData.note || ''}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="เช่น ลวกกุ้ง 45 วินาที, ตั้งไฟกลาง..."
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#FED7AA] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] font-bold rounded-xl text-xs min-h-[44px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกสูตรอาหาร</span>
                </button>
              </div>
            </form>
          ) : selectedRecipe ? (
            // ================= RECIPE DETAIL & COST BREAKDOWN VIEW =================
            <div className="bg-white p-6 rounded-xl border border-[#FED7AA] shadow-xs space-y-6">
              {/* Header Info & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#FED7AA] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-[#1F2937]">
                      {selectedRecipe.nameTh || selectedRecipe.name}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        selectedRecipe.type === 'sub' || selectedRecipe.type === 'sub_recipe'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {selectedRecipe.type === 'sub' || selectedRecipe.type === 'sub_recipe' ? 'สูตรย่อย' : 'เมนูขาย'}
                    </span>
                  </div>
                  {selectedRecipe.nameEn && (
                    <p className="text-xs text-[#6B7280] mt-0.5">{selectedRecipe.nameEn}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(selectedRecipe)}
                    className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold rounded-xl text-xs min-h-[40px] flex items-center gap-1.5 transition-colors"
                    title="คัดลอกสูตรอาหาร"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกสูตร</span>
                  </button>

                  <button
                    onClick={handleStartEdit}
                    className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[40px] flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>แก้ไขสูตร</span>
                  </button>

                  <button
                    onClick={() => handleDelete(selectedRecipe)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors"
                    title="ลบสูตรนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4 Cost Summary Cards (Section 6.2) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FFFBF5] p-3.5 rounded-xl border border-[#FED7AA]">
                  <span className="text-[11px] text-[#6B7280] font-bold block">1. วัตถุดิบ (Ingredient)</span>
                  <div className="text-base font-extrabold font-mono text-[#1F2937] mt-0.5">
                    ฿{(currentBreakdown?.ingredientCost || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#FFFBF5] p-3.5 rounded-xl border border-[#FED7AA]">
                  <span className="text-[11px] text-[#6B7280] font-bold block">2. ต้นทุนแฝง (Extra)</span>
                  <div className="text-base font-extrabold font-mono text-[#1F2937] mt-0.5">
                    ฿{(currentBreakdown?.extraCost || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#FFFBF5] p-3.5 rounded-xl border border-[#FED7AA]">
                  <span className="text-[11px] text-[#6B7280] font-bold block">3. ค่าโสหุ้ย (Overhead)</span>
                  <div className="text-base font-extrabold font-mono text-[#1F2937] mt-0.5">
                    ฿{(currentBreakdown?.overheadCost || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-300">
                  <span className="text-[11px] text-orange-800 font-bold block">ต้นทุนรวม/เสิร์ฟ (Total Cost)</span>
                  <div className="text-lg font-black font-mono text-orange-600 mt-0.5">
                    ฿{(currentBreakdown?.totalCostPerServing || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Cost Breakdown Table (% Share per line) */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                  รายละเอียดสัดส่วนต้นทุนวัตถุดิบ (Cost Breakdown Table)
                </h3>
                <div className="border border-[#FED7AA] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FFFBF5] text-[#6B7280] border-b border-[#FED7AA]">
                      <tr>
                        <th className="p-3">รายการ</th>
                        <th className="p-3 text-center">ประเภท</th>
                        <th className="p-3 text-right">ปริมาณ</th>
                        <th className="p-3 text-right">ต้นทุนต่อหน่วย</th>
                        <th className="p-3 text-right">ต้นทุนรวม (฿)</th>
                        <th className="p-3 text-center">สัดส่วน (% Share)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FED7AA]">
                      {(!selectedRecipe.ingredients || selectedRecipe.ingredients.length === 0) ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-[#6B7280]">
                            ไม่มีข้อมูลวัตถุดิบ
                          </td>
                        </tr>
                      ) : (
                        selectedRecipe.ingredients.map((line) => {
                          const isSub = line.sourceType === 'recipe';
                          let name = '';
                          let unitCost = 0;
                          let lineCost = 0;

                          if (!isSub) {
                            const ing = ingredients.find((i) => i.id === line.sourceId);
                            name = ing ? (ing.nameTh || ing.name || '') : line.sourceId;
                            if (ing) {
                              const baseUnit = (ing.baseUnit || ing.usageUnit || 'g').toString();
                              const conv = convertToBaseUnit(line.qty, line.unit, baseUnit, ing.customUnits);
                              const costPerBase = calcIngredientCostPerBaseUnit(ing, line.yieldOverridePercent) || 0;
                              unitCost = costPerBase;
                              lineCost = conv.qtyInBase * costPerBase;
                            }
                          } else {
                            const sub = recipes.find((r) => r.id === line.sourceId);
                            name = sub ? (sub.nameTh || sub.name || '') : line.sourceId;
                            if (sub) {
                              const subCost = sub.totalCostPerPortion || 0;
                              const outQty = sub.outputQty || 1;
                              unitCost = subCost / outQty;
                              lineCost = line.qty * unitCost;
                            }
                          }

                          const totalIngCost = currentBreakdown?.ingredientCost || 1;
                          const sharePct = totalIngCost > 0 ? (lineCost / totalIngCost) * 100 : 0;

                          return (
                            <tr key={line.id} className="hover:bg-orange-50/20">
                              <td className="p-3 font-bold text-[#1F2937]">{name}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${isSub ? 'bg-blue-50 text-blue-800' : 'bg-orange-50 text-orange-800'}`}>
                                  {isSub ? 'สูตรย่อย' : 'วัตถุดิบ'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono">
                                {line.qty} {line.unit}
                              </td>
                              <td className="p-3 text-right font-mono text-[#6B7280]">
                                ฿{unitCost.toFixed(4)}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-red-600">
                                ฿{lineCost.toFixed(2)}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-orange-600">
                                {sharePct.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* BLOCKED DELETE MODAL (Section 6.2) */}
      {blockedDeleteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-red-300 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">ไม่สามารถลบสูตรย่อยได้</h3>
                <p className="text-xs text-red-600 font-semibold">สูตรย่อยถูกใช้งานอยู่ในเมนูอาหารอื่น</p>
              </div>
            </div>

            <p className="text-xs text-[#1F2937] leading-relaxed">
              สูตรย่อย <strong className="text-red-700">"{blockedDeleteInfo.subRecipeName}"</strong> ถูกใช้อยู่ใน{' '}
              <strong>{blockedDeleteInfo.usedInRecipes.length}</strong> สูตรอาหารต่อไปนี้ กรุณาลบการเชื่อมโยงออกก่อน:
            </p>

            <div className="max-h-48 overflow-y-auto bg-red-50/50 p-3 rounded-xl border border-red-200 divide-y divide-red-200 text-xs">
              {blockedDeleteInfo.usedInRecipes.map((rName, i) => (
                <div key={i} className="py-1.5 font-bold text-red-900 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {rName}
                </div>
              ))}
            </div>

            <button
              onClick={() => setBlockedDeleteInfo(null)}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl text-xs min-h-[44px]"
            >
              รับทราบ (ปิดหน้าต่าง)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
