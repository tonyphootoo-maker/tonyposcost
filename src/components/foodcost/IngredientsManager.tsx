import React, { useState, useEffect } from 'react';
import { Ingredient, UnitType, CustomUnit, PriceHistoryEntry, Recipe, Settings } from '../../types';
import { dbGetAll, dbPut, dbDelete, dbGet } from '../../db';
import { useTranslation } from '../../i18n';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  Package,
  History,
  Copy,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';
import {
  calcIngredientCostPerBaseUnit,
  formatMoney,
  formatPercent,
} from '../../utils/calc';
import { generateUUID } from '../../utils/uuid';
import { DEFAULT_INGREDIENT_CATEGORIES } from '../../types';

interface IngredientsManagerProps {
  onIngredientsUpdated?: () => void;
}

export const IngredientsManager: React.FC<IngredientsManagerProps> = ({ onIngredientsUpdated }) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'cost'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);

  // History & Usage Modal
  const [historyModalItem, setHistoryModalItem] = useState<Ingredient | null>(null);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualPrice, setManualPrice] = useState<number>(0);
  const [manualNote, setManualNote] = useState('');

  // Blocked Delete Modal
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{
    ingredientName: string;
    usedInRecipes: string[];
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    nameTh: string;
    nameEn: string;
    category: string;
    purchasePrice: number;
    purchaseUnit: UnitType;
    purchaseQty: number;
    baseUnit: 'g' | 'ml' | 'pcs';
    baseUnitsPerPurchaseUnit: number;
    yieldPercent: number;
    supplier: string;
    notes: string;
    customUnits: CustomUnit[];
  }>({
    nameTh: '',
    nameEn: '',
    category: 'เนื้อสัตว์',
    purchasePrice: 100,
    purchaseUnit: 'kg',
    purchaseQty: 1,
    baseUnit: 'g',
    baseUnitsPerPurchaseUnit: 1000,
    yieldPercent: 100,
    supplier: '',
    notes: '',
    customUnits: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [ingList, recList, savedSettings] = await Promise.all([
      dbGetAll<Ingredient>('ingredients'),
      dbGetAll<Recipe>('recipes'),
      dbGet<Settings>('settings', 'current_settings'),
    ]);
    setIngredients(ingList);
    setRecipes(recList);
    if (savedSettings) {
      setSettings(savedSettings);
    }
  };

  const categories =
    settings?.ingredientCategories && settings.ingredientCategories.length > 0
      ? settings.ingredientCategories
      : DEFAULT_INGREDIENT_CATEGORIES;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      nameTh: '',
      nameEn: '',
      category: categories[0] || 'เนื้อสัตว์',
      purchasePrice: 100,
      purchaseUnit: 'kg',
      purchaseQty: 1,
      baseUnit: 'g',
      baseUnitsPerPurchaseUnit: 1000,
      yieldPercent: 100,
      supplier: '',
      notes: '',
      customUnits: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Ingredient) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      nameTh: item.nameTh || item.name || '',
      nameEn: item.nameEn || '',
      category: item.category || categories[0],
      purchasePrice: item.purchasePrice || 0,
      purchaseUnit: (item.purchaseUnit as UnitType) || 'kg',
      purchaseQty: item.purchaseQty || 1,
      baseUnit: (item.baseUnit as 'g' | 'ml' | 'pcs') || (item.usageUnit as any) || 'g',
      baseUnitsPerPurchaseUnit: item.baseUnitsPerPurchaseUnit || item.packSize || 1000,
      yieldPercent: item.yieldPercent || item.yieldPercentage || 100,
      supplier: item.supplier || '',
      notes: item.notes || item.note || '',
      customUnits: item.customUnits ? [...item.customUnits] : [],
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = async (item: Ingredient) => {
    const duplicated: Ingredient = {
      ...item,
      id: generateUUID(),
      name: `${item.nameTh || item.name} (สำเนา)`,
      nameTh: `${item.nameTh || item.name} (สำเนา)`,
      nameEn: item.nameEn ? `${item.nameEn} (Copy)` : '',
      updatedAt: new Date().toISOString(),
      priceHistory: item.priceHistory ? [...item.priceHistory] : [],
    };
    await dbPut('ingredients', duplicated);
    showToast({
      title: 'คัดลอกวัตถุดิบสำเร็จ',
      message: `สร้างสำเนา "${duplicated.nameTh}" เรียบร้อย`,
      type: 'success',
    });
    await loadData();
    onIngredientsUpdated?.();
  };

  const handleDelete = async (id: string, name: string) => {
    // 6.1 BLOCK deletion of an ingredient used in any recipe
    const usedIn = recipes.filter((r) => {
      const inIngredients = r.ingredients?.some(
        (line) => line.sourceType === 'ingredient' && line.sourceId === id
      );
      const inItems = r.items?.some((item) => item.ingredientId === id);
      return inIngredients || inItems;
    });

    if (usedIn.length > 0) {
      setBlockedDeleteInfo({
        ingredientName: name,
        usedInRecipes: usedIn.map((r) => r.nameTh || r.name || ''),
      });
      return;
    }

    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบวัตถุดิบ "${name}"?`)) return;

    await dbDelete('ingredients', id);
    showToast({
      title: 'ลบสำเร็จ',
      message: `ลบวัตถุดิบ "${name}" เรียบร้อยแล้ว`,
      type: 'info',
    });
    await loadData();
    onIngredientsUpdated?.();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameTh.trim()) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกชื่อวัตถุดิบ', type: 'error' });
      return;
    }

    const now = new Date().toISOString();
    const isNew = !formData.id;
    const ingredientId = formData.id || generateUUID();

    let history: PriceHistoryEntry[] = editingItem?.priceHistory ? [...editingItem.priceHistory] : [];

    // Auto-append price history when purchase price changes
    if (editingItem) {
      const priceChanged = editingItem.purchasePrice !== formData.purchasePrice;
      const qtyChanged = (editingItem.purchaseQty || 1) !== formData.purchaseQty;
      if (priceChanged || qtyChanged) {
        history.unshift({
          date: now,
          price: formData.purchasePrice,
          note: `ปรับราคาซื้อจาก ฿${editingItem.purchasePrice} เป็น ฿${formData.purchasePrice}`,
        });
      }
    } else {
      // First price entry
      history.push({
        date: now,
        price: formData.purchasePrice,
        note: 'ราคาเริ่มต้นบันทึกครั้งแรก',
      });
    }

    // Calculate effective unit cost
    const tempIng: Ingredient = {
      id: ingredientId,
      name: formData.nameTh.trim(),
      nameTh: formData.nameTh.trim(),
      nameEn: formData.nameEn.trim(),
      category: formData.category,
      purchasePrice: Number(formData.purchasePrice),
      purchaseUnit: formData.purchaseUnit,
      purchaseQty: Number(formData.purchaseQty) || 1,
      baseUnit: formData.baseUnit,
      baseUnitsPerPurchaseUnit: Number(formData.baseUnitsPerPurchaseUnit) || 1,
      yieldPercent: Number(formData.yieldPercent) || 100,
      yieldPercentage: Number(formData.yieldPercent) || 100,
      supplier: formData.supplier.trim() || undefined,
      note: formData.notes.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      customUnits: formData.customUnits,
      priceHistory: history,
      packSize: Number(formData.baseUnitsPerPurchaseUnit) || 1,
      usageUnit: formData.baseUnit as UnitType,
      unitCost: 0,
      currentStock: editingItem?.currentStock ?? 1000,
      minStock: editingItem?.minStock ?? 200,
      updatedAt: now,
    };

    const calculatedCost = calcIngredientCostPerBaseUnit(tempIng) || 0;
    tempIng.unitCost = Number(calculatedCost.toFixed(4));

    await dbPut('ingredients', tempIng);
    showToast({
      title: isNew ? 'เพิ่มวัตถุดิบสำเร็จ' : 'แก้ไขวัตถุดิบสำเร็จ',
      message: `${tempIng.nameTh} (ต้นทุนจริง ฿${tempIng.unitCost}/${tempIng.baseUnit})`,
      type: 'success',
    });

    setIsModalOpen(false);
    await loadData();
    onIngredientsUpdated?.();
  };

  // Add custom unit in form
  const handleAddCustomUnit = () => {
    setFormData((prev) => ({
      ...prev,
      customUnits: [...prev.customUnits, { name: '', baseUnitsPer: 1 }],
    }));
  };

  const handleUpdateCustomUnit = (index: number, field: keyof CustomUnit, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.customUnits];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, customUnits: updated };
    });
  };

  const handleRemoveCustomUnit = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customUnits: prev.customUnits.filter((_, i) => i !== index),
    }));
  };

  // Manual back-dated price entry
  const handleAddManualHistory = async () => {
    if (!historyModalItem || manualPrice <= 0) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกราคาที่ถูกต้อง', type: 'error' });
      return;
    }

    const newEntry: PriceHistoryEntry = {
      date: new Date(manualDate).toISOString(),
      price: manualPrice,
      note: manualNote.trim() || 'บันทึกประวัติย้อนหลัง',
    };

    const updatedHistory = [...(historyModalItem.priceHistory || []), newEntry].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const updatedIngredient: Ingredient = {
      ...historyModalItem,
      priceHistory: updatedHistory,
    };

    await dbPut('ingredients', updatedIngredient);
    setHistoryModalItem(updatedIngredient);
    setManualNote('');
    setManualPrice(0);
    showToast({ title: 'บันทึกประวัติราคาแล้ว', message: 'เพิ่มรายการประวัติย้อนหลังเรียบร้อย', type: 'success' });
    await loadData();
  };

  // Live preview calculation inside form
  const previewDenominator = (formData.purchaseQty || 1) * (formData.baseUnitsPerPurchaseUnit || 1);
  const rawBaseCost = previewDenominator > 0 ? formData.purchasePrice / previewDenominator : 0;
  const yieldDivisor = (formData.yieldPercent || 100) / 100;
  const effectiveBaseCost = yieldDivisor > 0 ? rawBaseCost / yieldDivisor : 0;

  // Filter & Sort
  const filtered = ingredients
    .filter((ing) => {
      const matchesSearch =
        (ing.nameTh || ing.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (ing.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
        (ing.supplier || '').toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === 'all' || ing.category === categoryFilter;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const valA = a.nameTh || a.name || '';
        const valB = b.nameTh || b.name || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortBy === 'price') {
        return sortOrder === 'asc' ? a.purchasePrice - b.purchasePrice : b.purchasePrice - a.purchasePrice;
      }
      if (sortBy === 'cost') {
        const costA = a.unitCost || 0;
        const costB = b.unitCost || 0;
        return sortOrder === 'asc' ? costA - costB : costB - costA;
      }
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-500" />
            {t.ingredients || 'วัตถุดิบและต้นทุนพื้นฐาน (Ingredients)'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            จัดการรายการวัตถุดิบ คำนวณต้นทุนต่อหน่วยฐานหลังหัก Yield และติดตามประวัติราคาซื้อ
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มวัตถุดิบใหม่</span>
        </button>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อวัตถุดิบ หรือผู้จัดจำหน่าย..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap min-h-[36px] ${
                categoryFilter === 'all'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-[#6B7280] border-[#FED7AA] hover:bg-orange-50'
              }`}
            >
              ทั้งหมด ({ingredients.length})
            </button>
            {categories.map((cat) => {
              const count = ingredients.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap min-h-[36px] ${
                    categoryFilter === cat
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-[#6B7280] border-[#FED7AA] hover:bg-orange-50'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-[#6B7280]">
          <span>เรียงโดย:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1.5 bg-white border border-[#FED7AA] rounded-lg text-xs font-bold text-[#1F2937] min-h-[36px]"
          >
            <option value="name">ชื่อวัตถุดิบ</option>
            <option value="price">ราคาซื้อ</option>
            <option value="cost">ต้นทุนจริง/หน่วยฐาน</option>
          </select>
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 bg-white border border-[#FED7AA] rounded-lg text-[#1F2937] hover:bg-orange-50 min-h-[36px] flex items-center justify-center"
            title="สลับลำดับ"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ingredients List Table */}
      <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
              <tr>
                <th className="p-3.5">ชื่อวัตถุดิบ</th>
                <th className="p-3.5">หมวดหมู่</th>
                <th className="p-3.5 text-right">ราคาซื้อล่าสุด</th>
                <th className="p-3.5 text-center">หน่วยซื้อ → หน่วยฐาน</th>
                <th className="p-3.5 text-center">Yield %</th>
                <th className="p-3.5 text-right">ต้นทุนต่อหน่วยฐาน</th>
                <th className="p-3.5 text-right font-extrabold text-orange-700">ต้นทุนจริงหลังหัก Yield</th>
                <th className="p-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    {t.emptyState || 'ไม่พบรายการวัตถุดิบ'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const baseUnit = item.baseUnit || item.usageUnit || 'g';
                  const baseQty = item.baseUnitsPerPurchaseUnit || item.packSize || 1;
                  const purchaseQty = item.purchaseQty || 1;
                  const rawBase = item.purchasePrice / (purchaseQty * baseQty);
                  const effectiveCost = calcIngredientCostPerBaseUnit(item) || item.unitCost || 0;

                  return (
                    <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-[#1F2937]">{item.nameTh || item.name}</div>
                        {item.nameEn && <div className="text-xs text-[#6B7280]">{item.nameEn}</div>}
                        {item.supplier && (
                          <div className="text-[11px] text-orange-600 mt-0.5">ผู้จัดจำหน่าย: {item.supplier}</div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold">
                          {item.category}
                        </span>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-[#1F2937]">
                        {formatCurrency(item.purchasePrice)} / {purchaseQty > 1 ? `${purchaseQty} ` : ''}{item.purchaseUnit}
                      </td>

                      <td className="p-3.5 text-center text-xs text-[#6B7280]">
                        1 {item.purchaseUnit} = {baseQty.toLocaleString()} {baseUnit}
                        {item.customUnits && item.customUnits.length > 0 && (
                          <div className="text-[10px] text-orange-600 mt-0.5">
                            +{item.customUnits.length} หน่วยพิเศษ
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs ${
                            (item.yieldPercent || item.yieldPercentage || 100) >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : (item.yieldPercent || item.yieldPercentage || 100) >= 75
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.yieldPercent || item.yieldPercentage || 100}%
                        </span>
                      </td>

                      <td className="p-3.5 text-right font-mono text-xs text-[#6B7280]">
                        ฿{rawBase.toFixed(4)}/{baseUnit}
                      </td>

                      <td className="p-3.5 text-right font-mono font-extrabold text-orange-600">
                        ฿{effectiveCost.toFixed(4)} / {baseUnit}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setHistoryModalItem(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="ดูประวัติราคาและสูตรที่ใช้"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(item)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="คัดลอกวัตถุดิบ (Duplicate)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.nameTh || item.name || '')}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden text-[#1F2937]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFFBF5]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-[#1F2937]">
                  {editingItem ? 'แก้ไขข้อมูลวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[#6B7280] hover:text-[#1F2937] rounded-lg hover:bg-orange-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">
                    ชื่อภาษาไทย <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nameTh}
                    onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    placeholder="เช่น กุ้งขาวสด, สันนอกหมู"
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">ชื่อภาษาอังกฤษ</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Fresh White Shrimp"
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">หมวดหมู่วัตถุดิบ</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7280] mb-1">ผู้จัดจำหน่าย (Supplier)</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="เช่น แม็คโคร, ตลาดสี่มุมเมือง"
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Purchase Details */}
              <div className="p-4 bg-orange-50/40 border border-orange-200 rounded-xl space-y-3">
                <div className="font-bold text-xs text-orange-950 flex items-center gap-1.5">
                  <span>ข้อมูลการซื้อและหน่วยคำนวณ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">
                      ราคาซื้อ (฿) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm font-mono font-bold text-[#1F2937] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">จำนวนที่ซื้อ (แพ็ค/ลัง)</label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={formData.purchaseQty}
                      onChange={(e) => setFormData({ ...formData, purchaseQty: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm font-mono min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">หน่วยซื้อ</label>
                    <select
                      value={formData.purchaseUnit}
                      onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value as UnitType })}
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm min-h-[44px]"
                    >
                      <option value="kg">กิโลกรัม (kg)</option>
                      <option value="g">กรัม (g)</option>
                      <option value="l">ลิตร (l)</option>
                      <option value="ml">มิลลิลิตร (ml)</option>
                      <option value="pack">แพ็ค (pack)</option>
                      <option value="piece">ชิ้น (pcs/piece)</option>
                      <option value="bottle">ขวด (bottle)</option>
                      <option value="can">กระป๋อง (can)</option>
                      <option value="box">กล่อง/ลัง (box)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">หน่วยฐาน (Base Unit)</label>
                    <select
                      value={formData.baseUnit}
                      onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm font-bold min-h-[44px]"
                    >
                      <option value="g">กรัม (g)</option>
                      <option value="ml">มิลลิลิตร (ml)</option>
                      <option value="pcs">ชิ้น (pcs)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">
                      จำนวนหน่วยฐาน / 1 หน่วยซื้อ
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={formData.baseUnitsPerPurchaseUnit}
                      onChange={(e) =>
                        setFormData({ ...formData, baseUnitsPerPurchaseUnit: Number(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm font-mono min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">
                      Yield % (1–100) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.yieldPercent}
                      onChange={(e) =>
                        setFormData({ ...formData, yieldPercent: Math.min(100, Math.max(1, Number(e.target.value) || 100)) })
                      }
                      className="w-full px-3 py-2 bg-white border border-[#FED7AA] rounded-lg text-sm font-mono font-bold min-h-[44px]"
                    />
                  </div>
                </div>

                {/* LIVE PREVIEW BOX (strictly mandated by Section 6.1) */}
                <div className="p-3 bg-white border border-orange-300 rounded-xl grid grid-cols-2 gap-3 text-xs shadow-xs">
                  <div>
                    <span className="text-[#6B7280] block">ต้นทุนก่อน Yield:</span>
                    <span className="font-mono font-bold text-[#1F2937]">
                      ฿{rawBaseCost.toFixed(4)} / {formData.baseUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-700 font-bold block">ต้นทุนจริงหลังหัก Yield:</span>
                    <span className="font-mono font-extrabold text-orange-600 text-sm">
                      ฿{effectiveBaseCost.toFixed(4)} / {formData.baseUnit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Units Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1F2937]">
                    หน่วยแบบกำหนดเอง (Custom Units e.g. ถ้วย, ทัพพี, ช้อนโต๊ะ)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCustomUnit}
                    className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มหน่วยพิเศษ
                  </button>
                </div>

                {formData.customUnits.map((cu, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อหน่วย เช่น ทัพพี, ฟอง"
                      value={cu.name}
                      onChange={(e) => handleUpdateCustomUnit(idx, 'name', e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs"
                    />
                    <span className="text-xs text-[#6B7280]">=</span>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder="จำนวนหน่วยฐาน"
                      value={cu.baseUnitsPer}
                      onChange={(e) => handleUpdateCustomUnit(idx, 'baseUnitsPer', Number(e.target.value) || 1)}
                      className="w-24 px-3 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-xs font-mono"
                    />
                    <span className="text-xs text-[#6B7280]">{formData.baseUnit}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomUnit(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">หมายเหตุ / บันทึกเพิ่มเติม</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="เช่น เก็บในตู้แช่แข็ง -18°C, สั่งซื้อทุกวันจันทร์"
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#FED7AA]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] font-bold rounded-xl text-xs min-h-[44px]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px]"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICE HISTORY & USAGE MODAL (Section 6.1) */}
      {historyModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden text-[#1F2937]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFFBF5]">
              <div>
                <h2 className="text-base font-extrabold text-[#1F2937]">
                  ประวัติราคาและสูตรที่ใช้งาน: {historyModalItem.nameTh || historyModalItem.name}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  ติดตามความเคลื่อนไหวของราคาซื้อ และตรวจสอบเมนูอาหารที่ใช้วัตถุดิบนี้
                </p>
              </div>
              <button
                onClick={() => setHistoryModalItem(null)}
                className="p-1.5 text-[#6B7280] hover:text-[#1F2937] rounded-lg hover:bg-orange-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Add Manual Back-Dated Entry */}
              <div className="p-4 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-orange-950 block">บันทึกประวัติราคาย้อนหลังด้วยตนเอง:</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#FED7AA] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="ราคาซื้อ (฿)"
                      value={manualPrice || ''}
                      onChange={(e) => setManualPrice(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#FED7AA] rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="หมายเหตุ..."
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#FED7AA] rounded-lg text-xs"
                    />
                  </div>
                  <button
                    onClick={handleAddManualHistory}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs min-h-[36px]"
                  >
                    บันทึกประวัติ
                  </button>
                </div>
              </div>

              {/* Price History Table with Up/Down Arrows & % Change */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                  ประวัติราคาซื้อ ({historyModalItem.priceHistory?.length || 0} รายการ)
                </h3>
                <div className="bg-white border border-[#FED7AA] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FFFBF5] text-[#6B7280] border-b border-[#FED7AA]">
                      <tr>
                        <th className="p-2.5">วันที่</th>
                        <th className="p-2.5 text-right">ราคาซื้อ</th>
                        <th className="p-2.5 text-center">การเปลี่ยนแปลง</th>
                        <th className="p-2.5">บันทึก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FED7AA]">
                      {!historyModalItem.priceHistory || historyModalItem.priceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-[#6B7280]">
                            ยังไม่มีประวัติราคา
                          </td>
                        </tr>
                      ) : (
                        historyModalItem.priceHistory.map((h, i, arr) => {
                          const prev = arr[i + 1];
                          let changePct: number | null = null;
                          if (prev && prev.price > 0) {
                            changePct = ((h.price - prev.price) / prev.price) * 100;
                          }

                          return (
                            <tr key={i} className="hover:bg-orange-50/20">
                              <td className="p-2.5 text-[#6B7280]">{formatDate(h.date)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-[#1F2937]">
                                ฿{h.price.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">
                                {changePct !== null ? (
                                  changePct > 0 ? (
                                    <span className="text-red-600 font-bold flex items-center justify-center gap-0.5">
                                      <TrendingUp className="w-3.5 h-3.5" />
                                      +{changePct.toFixed(1)}%
                                    </span>
                                  ) : changePct < 0 ? (
                                    <span className="text-emerald-600 font-bold flex items-center justify-center gap-0.5">
                                      <TrendingDown className="w-3.5 h-3.5" />
                                      {changePct.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">คงที่</span>
                                  )
                                ) : (
                                  <span className="text-neutral-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-[#6B7280]">{h.note || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recipes using this ingredient */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  สูตรอาหารที่ใช้วัตถุดิบนี้ (Recipes using this ingredient)
                </h3>
                {(() => {
                  const usedIn = recipes.filter((r) => {
                    const inIng = r.ingredients?.some(
                      (line) => line.sourceType === 'ingredient' && line.sourceId === historyModalItem.id
                    );
                    const inItems = r.items?.some((item) => item.ingredientId === historyModalItem.id);
                    return inIng || inItems;
                  });

                  if (usedIn.length === 0) {
                    return (
                      <div className="p-4 bg-orange-50/30 border border-orange-100 rounded-xl text-xs text-[#6B7280] text-center">
                        ยังไม่มีสูตรอาหารใดใช้วัตถุดิบนี้
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {usedIn.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-3 bg-white border border-[#FED7AA] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-[#1F2937]">{rec.nameTh || rec.name}</div>
                            <div className="text-[11px] text-[#6B7280]">
                              ประเภท: {rec.type === 'sub' || rec.type === 'sub_recipe' ? 'สูตรย่อย' : 'เมนูขาย'}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-orange-600">
                            ฿{(rec.actualSellingPrice || rec.sellPrice || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCKED DELETE MODAL (Section 6.1) */}
      {blockedDeleteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-2 border-red-300 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">ไม่สามารถลบวัตถุดิบได้</h3>
                <p className="text-xs text-red-600 font-semibold">วัตถุดิบกำลังถูกใช้งานอยู่ในสูตรอาหาร</p>
              </div>
            </div>

            <p className="text-xs text-[#1F2937] leading-relaxed">
              วัตถุดิบ <strong className="text-red-700">"{blockedDeleteInfo.ingredientName}"</strong> ถูกใช้อยู่ใน{' '}
              <strong>{blockedDeleteInfo.usedInRecipes.length}</strong> สูตรอาหารต่อไปนี้ กรุณาลบวัตถุดิบออกจากสูตรดังกล่าวก่อน:
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
