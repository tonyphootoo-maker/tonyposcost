import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Search,
  CheckCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  Truck,
  ArrowRight,
  Info,
  X,
  Layers,
  ArrowUpDown,
  Tag,
  Receipt,
  Percent,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { dbGetAll, dbPut, dbGet } from '../../db';
import { Recipe, Product, Settings, Ingredient } from '../../types';
import { showToast } from '../common/ToastContainer';
import {
  analyzeSellingPrice,
  analyzeDeliveryPlatform,
  formatMoney,
  formatPercent,
  calcRecipeCosts,
  roundPriceByStep,
} from '../../utils/calc';
import { DEFAULT_RECIPE_CATEGORIES } from '../../types';

interface PricingSimulatorViewProps {
  initialRecipeId?: string | null;
  onClearInitialRecipeId?: () => void;
}

export const PricingSimulatorView: React.FC<PricingSimulatorViewProps> = ({
  initialRecipeId,
  onClearInitialRecipeId,
}) => {
  const { t, formatCurrency } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'sellPrice' | 'foodCostPct' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Selected menu item opens the detailed side panel (Section 6.3)
  const [selectedMenuRecipe, setSelectedMenuRecipe] = useState<Recipe | null>(null);

  // Panel state
  const [panelSellPrice, setPanelSellPrice] = useState<number>(0);
  const [panelTargetCostPct, setPanelTargetCostPct] = useState<number>(30);
  const [panelDeliveryPrices, setPanelDeliveryPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialRecipeId && recipes.length > 0) {
      const match = recipes.find((r) => r.id === initialRecipeId);
      if (match) {
        handleOpenPanel(match);
        onClearInitialRecipeId?.();
      }
    }
  }, [initialRecipeId, recipes]);

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
  };

  const categories: readonly string[] =
    settings?.recipeCategories && settings.recipeCategories.length > 0
      ? settings.recipeCategories
      : DEFAULT_RECIPE_CATEGORIES;

  const platforms = settings?.platforms && settings.platforms.length > 0
    ? settings.platforms
    : [
        { id: 'grab', name: 'Grab', gpPercent: 30, gpHasVat: false },
        { id: 'lineman', name: 'LINE MAN', gpPercent: 30, gpHasVat: false },
        { id: 'foodpanda', name: 'Foodpanda', gpPercent: 30, gpHasVat: false },
      ];

  // Open side panel for selected menu
  const handleOpenPanel = (rec: Recipe) => {
    setSelectedMenuRecipe(rec);
    setPanelSellPrice(rec.actualSellingPrice || rec.sellPrice || 0);
    setPanelTargetCostPct(
      rec.targetFoodCostOverride || rec.targetFoodCostPct || settings?.defaultTargetFoodCostPercent || 30
    );
    setPanelDeliveryPrices(rec.deliveryPrices ? { ...rec.deliveryPrices } : {});
  };

  // Save changes from side panel
  const handleSavePanel = async () => {
    if (!selectedMenuRecipe) return;

    try {
      const costBreakdown = calcRecipeCosts(selectedMenuRecipe, recipes, ingredients, settings);
      const totalCost = costBreakdown.totalCostPerServing;
      const margin =
        panelSellPrice > 0
          ? Number((((panelSellPrice - totalCost) / panelSellPrice) * 100).toFixed(1))
          : 0;

      // Update recipe
      const updatedRecipe: Recipe = {
        ...selectedMenuRecipe,
        sellPrice: panelSellPrice,
        actualSellingPrice: panelSellPrice,
        targetFoodCostOverride: panelTargetCostPct,
        targetFoodCostPct: panelTargetCostPct,
        deliveryPrices: panelDeliveryPrices,
        grossMarginPct: margin,
        updatedAt: new Date().toISOString(),
      };
      await dbPut('recipes', updatedRecipe);

      // Sync to POS product
      const matchingProd = products.find(
        (p) => p.recipeId === selectedMenuRecipe.id || p.nameTh === selectedMenuRecipe.nameTh
      );
      if (matchingProd) {
        const updatedProd: Product = {
          ...matchingProd,
          price: panelSellPrice,
          cost: totalCost,
        };
        await dbPut('products', updatedProd);
      }

      showToast({
        title: 'บันทึกราคาสำเร็จ',
        message: `${updatedRecipe.nameTh}: ราคา ฿${panelSellPrice} ซิงก์ไปหน้าร้าน POS เรียบร้อยแล้ว`,
        type: 'success',
      });

      setSelectedMenuRecipe(null);
      await loadData();
    } catch {
      showToast({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถบันทึกราคาได้', type: 'error' });
    }
  };

  // Only menu items (not sub-recipes)
  const menuRecipes = recipes.filter((r) => r.type !== 'sub' && r.type !== 'sub_recipe');

  // Compute stats for all menu items
  const menuRows = menuRecipes.map((rec) => {
    const costBreakdown = calcRecipeCosts(rec, recipes, ingredients, settings);
    const ingredientCost = costBreakdown.ingredientCost;
    const totalCost = costBreakdown.totalCostPerServing;
    const sellPrice = rec.actualSellingPrice || rec.sellPrice || 0;
    const analysis = analyzeSellingPrice(sellPrice, ingredientCost, totalCost, rec, settings);

    return {
      recipe: rec,
      ingredientCost,
      totalCost,
      sellPrice,
      analysis,
    };
  });

  // Filter & Sort
  const filtered = menuRows
    .filter((row) => {
      const matchesSearch =
        (row.recipe.nameTh || row.recipe.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (row.recipe.nameEn || '').toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === 'all' || row.recipe.category === categoryFilter;
      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const valA = a.recipe.nameTh || a.recipe.name || '';
        const valB = b.recipe.nameTh || b.recipe.name || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortBy === 'sellPrice') {
        return sortOrder === 'asc' ? a.sellPrice - b.sellPrice : b.sellPrice - a.sellPrice;
      }
      if (sortBy === 'foodCostPct') {
        const pctA = a.analysis.foodCostPercent || 0;
        const pctB = b.analysis.foodCostPercent || 0;
        return sortOrder === 'asc' ? pctA - pctB : pctB - pctA;
      }
      if (sortBy === 'profit') {
        return sortOrder === 'asc'
          ? a.analysis.profitPerPlate - b.analysis.profitPerPlate
          : b.analysis.profitPerPlate - a.analysis.profitPerPlate;
      }
      return 0;
    });

  // Calculate live analysis for the active panel
  let panelAnalysis = null;
  let panelBreakdown = null;
  if (selectedMenuRecipe) {
    panelBreakdown = calcRecipeCosts(selectedMenuRecipe, recipes, ingredients, settings);
    panelAnalysis = analyzeSellingPrice(
      panelSellPrice,
      panelBreakdown.ingredientCost,
      panelBreakdown.totalCostPerServing,
      { ...selectedMenuRecipe, targetFoodCostOverride: panelTargetCostPct },
      settings
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-orange-500" />
            {t.pricingSimulator || 'ตั้งราคาขายและเดลิเวอรี (Pricing)'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            ตารางเมนูขายทั้งหมด: วิเคราะห์ต้นทุนวัตถุดิบ กำไรขั้นต้น คลิกเลือกเมนูเพื่อเปิดแผงคำนวณและตั้งราคาเดลิเวอรี
          </p>
        </div>

        <div className="text-xs text-[#6B7280]">
          พบเมนูขายทั้งหมด <span className="font-bold text-[#1F2937]">{filtered.length}</span> รายการ
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อเมนูอาหาร..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap min-h-[36px] ${
                categoryFilter === 'all'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-[#6B7280] border-[#FED7AA] hover:bg-orange-50'
              }`}
            >
              ทุกหมวด ({menuRecipes.length})
            </button>
            {categories.map((cat) => {
              const count = menuRecipes.filter((r) => r.category === cat).length;
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
            <option value="name">ชื่อเมนู</option>
            <option value="sellPrice">ราคาขาย</option>
            <option value="foodCostPct">Food Cost %</option>
            <option value="profit">กำไรต่อจาน</option>
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

      {/* TABLE OF ALL MENU ITEMS (Section 6.3) */}
      <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
              <tr>
                <th className="p-3.5">เมนูอาหาร</th>
                <th className="p-3.5">หมวดหมู่</th>
                <th className="p-3.5 text-right">ต้นทุนวัตถุดิบ</th>
                <th className="p-3.5 text-right">ต้นทุนรวม/จาน</th>
                <th className="p-3.5 text-right">ราคาขายหน้าร้าน</th>
                <th className="p-3.5 text-center">Food Cost %</th>
                <th className="p-3.5 text-right">กำไรสุทธิต่อจาน (฿)</th>
                <th className="p-3.5 text-center">กำไร %</th>
                <th className="p-3.5 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-[#6B7280]">
                    ไม่พบเมนูขาย
                  </td>
                </tr>
              ) : (
                filtered.map(({ recipe, ingredientCost, totalCost, sellPrice, analysis }) => (
                  <tr
                    key={recipe.id}
                    onClick={() => handleOpenPanel(recipe)}
                    className="hover:bg-orange-50/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937] flex items-center gap-1.5">
                        <span>{recipe.nameTh || recipe.name}</span>
                      </div>
                      {recipe.nameEn && <div className="text-xs text-[#6B7280]">{recipe.nameEn}</div>}
                    </td>

                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold">
                        {recipe.category || 'จานหลัก'}
                      </span>
                    </td>

                    <td className="p-3.5 text-right font-mono text-xs text-[#6B7280]">
                      ฿{ingredientCost.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold text-red-600">
                      ฿{totalCost.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-right font-mono font-extrabold text-orange-600 text-sm">
                      ฿{sellPrice.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-center font-mono font-bold">
                      {formatPercent(analysis.foodCostPercent)}
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      +฿{analysis.profitPerPlate.toFixed(2)}
                    </td>

                    <td className="p-3.5 text-center font-mono font-semibold text-sky-800">
                      {analysis.profitPercent !== null ? `${analysis.profitPercent.toFixed(1)}%` : '-'}
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                          analysis.status === 'on-target'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {analysis.status === 'on-target' ? 'ผ่านเป้า / On target' : 'เกินเป้า / Over target'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================================
          SIDE DRAWER / SLIDE-OVER PANEL (Section 6.3)
      ==================================================================== */}
      {selectedMenuRecipe && panelAnalysis && panelBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-l border-[#FED7AA] w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden text-[#1F2937]">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-[#FED7AA] bg-[#FFFBF5] flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[#1F2937]">
                  {selectedMenuRecipe.nameTh || selectedMenuRecipe.name}
                </h2>
                <p className="text-xs text-[#6B7280]">
                  วิเคราะห์โครงสร้างราคาขาย รายได้สุทธิ และคำนวณราคาขายเดลิเวอรี
                </p>
              </div>
              <button
                onClick={() => setSelectedMenuRecipe(null)}
                className="p-1.5 text-[#6B7280] hover:text-[#1F2937] rounded-lg hover:bg-orange-50 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Cost Summary Badges */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA]">
                  <span className="text-[#6B7280] block">ต้นทุนวัตถุดิบ (Ingredient):</span>
                  <span className="text-base font-extrabold font-mono text-[#1F2937]">
                    ฿{panelBreakdown.ingredientCost.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-red-50/50 rounded-xl border border-red-200">
                  <span className="text-red-700 block">ต้นทุนรวมต่อจาน (Total Cost):</span>
                  <span className="text-base font-extrabold font-mono text-red-600">
                    ฿{panelBreakdown.totalCostPerServing.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Editable Sell Price & Target % */}
              <div className="p-4 bg-orange-50/40 border border-orange-200 rounded-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">
                      ราคาขายหน้าร้าน (฿)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={panelSellPrice}
                        onChange={(e) => setPanelSellPrice(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-[#FED7AA] focus:border-orange-500 rounded-xl text-base font-mono font-bold text-[#1F2937] min-h-[44px]"
                      />
                      <span className="text-xs text-[#6B7280]">฿</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">
                      Target Food Cost % (เฉพาะเมนูนี้)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="5"
                        max="80"
                        value={panelTargetCostPct}
                        onChange={(e) => setPanelTargetCostPct(Number(e.target.value) || 30)}
                        className="w-full px-3 py-2 bg-white border border-[#FED7AA] focus:border-orange-500 rounded-xl text-base font-mono font-bold text-[#1F2937] min-h-[44px]"
                      />
                      <span className="text-xs text-[#6B7280]">%</span>
                    </div>
                  </div>
                </div>

                {/* Suggested Price + Rounded + "ใช้ราคานี้" button (Section 6.3) */}
                <div className="p-3 bg-white border border-orange-300 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#6B7280] block">ราคาแนะนำตามเป้าหมาย ({panelTargetCostPct}%):</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-sm text-[#6B7280]">
                        ฿{panelAnalysis.suggestedPrice?.toFixed(2) || '-'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span className="font-mono font-extrabold text-orange-600 text-base">
                        ฿{panelAnalysis.suggestedPriceRounded || '-'} (ปัดเศษ)
                      </span>
                    </div>
                  </div>

                  {panelAnalysis.suggestedPriceRounded && (
                    <button
                      type="button"
                      onClick={() => setPanelSellPrice(panelAnalysis.suggestedPriceRounded!)}
                      className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs shadow-xs min-h-[36px]"
                    >
                      ใช้ราคานี้
                    </button>
                  )}
                </div>
              </div>

              {/* Profit & Margin Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-white border border-[#FED7AA] rounded-xl">
                  <span className="text-[#6B7280] block">Food Cost %</span>
                  <span className="font-mono font-bold text-[#1F2937] text-sm mt-0.5 block">
                    {formatPercent(panelAnalysis.foodCostPercent)}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#FED7AA] rounded-xl">
                  <span className="text-[#6B7280] block">Total Cost %</span>
                  <span className="font-mono font-bold text-[#1F2937] text-sm mt-0.5 block">
                    {formatPercent(panelAnalysis.totalCostPercent)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-800 block font-bold">กำไรสุทธิต่อจาน</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-sm mt-0.5 block">
                    +฿{panelAnalysis.profitPerPlate.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* CUSTOMER PAYS PREVIEW (VAT & Service Charge Breakdown) */}
              <div className="p-4 bg-white border border-[#FED7AA] rounded-xl space-y-2 text-xs">
                <div className="font-bold text-[#1F2937] flex items-center gap-1.5 pb-2 border-b border-[#FED7AA]">
                  <Receipt className="w-4 h-4 text-orange-500" />
                  <span>โครงสร้างราคาที่ลูกค้าจ่ายจริง (Customer-pays preview)</span>
                </div>

                <div className="flex justify-between text-[#6B7280]">
                  <span>ราคาขายก่อน VAT (Price Ex-VAT):</span>
                  <span className="font-mono font-bold text-[#1F2937]">฿{panelAnalysis.priceExVat.toFixed(2)}</span>
                </div>

                {settings?.serviceCharge?.enabled && (
                  <div className="flex justify-between text-[#6B7280]">
                    <span>ค่าบริการ Service Charge ({settings.serviceCharge.ratePercent}%):</span>
                    <span className="font-mono font-bold text-[#1F2937]">
                      +฿{panelAnalysis.serviceChargeAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                {settings?.vat?.enabled && (
                  <div className="flex justify-between text-[#6B7280]">
                    <span>
                      ภาษี VAT {settings.vat.ratePercent}% ({settings.vat.priceIncludesVat ? 'รวมในราคา' : 'บวกเพิ่ม'}):
                    </span>
                    <span className="font-mono font-bold text-[#1F2937]">
                      {settings.vat.priceIncludesVat ? `(ในราคา ฿${panelAnalysis.vatAmount.toFixed(2)})` : `+฿${panelAnalysis.vatAmount.toFixed(2)}`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-extrabold text-orange-600 pt-1 border-t border-[#FED7AA]">
                  <span>ยอดที่ลูกค้าจ่ายรวมสุทธิ:</span>
                  <span className="font-mono">฿{panelAnalysis.customerGrandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* DELIVERY SECTION (Section 6.3: Grab, LINE MAN, Foodpanda) */}
              <div className="p-4 bg-white border border-[#FED7AA] rounded-xl space-y-3 text-xs">
                <div className="font-bold text-[#1F2937] flex items-center gap-1.5 pb-2 border-b border-[#FED7AA]">
                  <Truck className="w-4 h-4 text-orange-500" />
                  <span>ราคาและกำไรช่องทางเดลิเวอรี (Delivery Platforms)</span>
                </div>

                <div className="space-y-3">
                  {platforms.map((p) => {
                    const savedPrice =
                      panelDeliveryPrices[p.id] !== undefined
                        ? panelDeliveryPrices[p.id]
                        : panelSellPrice;

                    const delivStats = analyzeDeliveryPlatform(
                      p.id,
                      savedPrice,
                      panelBreakdown!.ingredientCost,
                      panelBreakdown!.totalCostPerServing,
                      { ...selectedMenuRecipe, targetFoodCostOverride: panelTargetCostPct },
                      settings
                    );

                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[#1F2937]">
                            {p.name} (GP {p.gpPercent}%{p.gpHasVat ? '+VAT' : ''})
                          </span>
                          <span className="text-[11px] text-[#6B7280]">
                            แนะนำ: <strong>฿{delivStats.suggestedDeliveryPriceRounded || '-'}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                          <div className="text-left">
                            <span className="text-[#6B7280] block text-[10px]">ราคาขายตั้งไว้</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={savedPrice}
                                onChange={(e) =>
                                  setPanelDeliveryPrices({
                                    ...panelDeliveryPrices,
                                    [p.id]: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-2 py-1 bg-white border border-[#FED7AA] rounded-lg font-mono font-bold text-xs"
                              />
                              <span>฿</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[#6B7280] block text-[10px]">รายได้สุทธิ (Net)</span>
                            <span className="font-mono font-bold text-[#1F2937] block mt-1">
                              ฿{delivStats.netRevenue.toFixed(2)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[#6B7280] block text-[10px]">Food Cost %</span>
                            <span
                              className={`font-mono font-bold block mt-1 ${
                                delivStats.foodCostPercent && delivStats.foodCostPercent <= panelTargetCostPct
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }`}
                            >
                              {formatPercent(delivStats.foodCostPercent)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[#6B7280] block text-[10px]">กำไร/จาน</span>
                            <span className="font-mono font-bold text-emerald-700 block mt-1">
                              +฿{delivStats.profitPerPlate.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[#FED7AA] bg-[#FFFBF5] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedMenuRecipe(null)}
                className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] font-bold rounded-xl text-xs min-h-[44px]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSavePanel}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>บันทึกและซิงก์ไปหน้าร้าน POS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
