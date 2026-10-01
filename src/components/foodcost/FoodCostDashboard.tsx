import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Package,
  BookOpen,
  DollarSign,
  ArrowRight,
  TrendingDown,
  Clock,
  Download,
  AlertCircle,
  ReceiptText,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { dbGetAll, dbGet } from '../../db';
import { Recipe, Ingredient, Product, Order, Settings } from '../../types';
import {
  analyzeSellingPrice,
  calcRecipeCosts,
  formatMoney,
  formatPercent,
} from '../../utils/calc';

import { NavTab } from '../layout/Sidebar';

interface FoodCostDashboardProps {
  onNavigateTab?: (tab: NavTab) => void;
}

export const FoodCostDashboard: React.FC<FoodCostDashboardProps> = ({ onNavigateTab }) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [recList, ingList, savedSettings, orderList] = await Promise.all([
      dbGetAll<Recipe>('recipes'),
      dbGetAll<Ingredient>('ingredients'),
      dbGet<Settings>('settings', 'current_settings'),
      dbGetAll<Order>('orders'),
    ]);

    setRecipes(recList);
    setIngredients(ingList);
    if (savedSettings) setSettings(savedSettings);

    // Filter today's paid orders
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = orderList.filter((o) => {
      const orderDate = (o.paidAt || o.createdAt || '').split('T')[0];
      return orderDate === todayStr && o.status === 'paid';
    });
    setTodayOrders(todaySales);
  };

  // Filter menu items (exclude sub-recipes)
  const menuRecipes = recipes.filter((r) => r.type !== 'sub' && r.type !== 'sub_recipe');

  // Analyze each menu recipe
  const analyzedMenus = menuRecipes.map((r) => {
    const costBreakdown = calcRecipeCosts(r, recipes, ingredients, settings);
    const sellPrice = r.actualSellingPrice || r.sellPrice || 0;
    const analysis = analyzeSellingPrice(
      sellPrice,
      costBreakdown.ingredientCost,
      costBreakdown.totalCostPerServing,
      r,
      settings
    );
    return {
      recipe: r,
      totalCost: costBreakdown.totalCostPerServing,
      ingredientCost: costBreakdown.ingredientCost,
      sellPrice,
      analysis,
    };
  });

  // 1) 4 KPI Stat Cards (Section 6.4)
  const totalMenuItems = menuRecipes.length;
  const totalIngredients = ingredients.length;

  const pricedMenus = analyzedMenus.filter((m) => m.sellPrice > 0 && m.analysis.foodCostPercent !== null);
  const avgFoodCostPct =
    pricedMenus.length > 0
      ? pricedMenus.reduce((sum, m) => sum + (m.analysis.foodCostPercent || 0), 0) / pricedMenus.length
      : 0;

  const menusOverTarget = analyzedMenus.filter((m) => m.analysis.status === 'over-target').length;

  // 2) Top 5 Highest & Lowest Profit per plate (฿)
  const sortedByProfit = [...analyzedMenus].sort(
    (a, b) => b.analysis.profitPerPlate - a.analysis.profitPerPlate
  );
  const top5Profitable = sortedByProfit.slice(0, 5);
  const bottom5Profitable = [...sortedByProfit].reverse().slice(0, 5);

  // 3) Top 5 Recent Ingredient Price Increases
  const recentIncreases: Array<{
    ingredient: Ingredient;
    currentPrice: number;
    prevPrice: number;
    pctChange: number;
    date: string;
  }> = [];

  ingredients.forEach((ing) => {
    if (ing.priceHistory && ing.priceHistory.length >= 2) {
      const sortedHistory = [...ing.priceHistory].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latest = sortedHistory[0];
      const prev = sortedHistory[1];
      if (latest && prev && prev.price > 0 && latest.price > prev.price) {
        const pct = ((latest.price - prev.price) / prev.price) * 100;
        recentIncreases.push({
          ingredient: ing,
          currentPrice: latest.price,
          prevPrice: prev.price,
          pctChange: pct,
          date: latest.date,
        });
      }
    }
  });

  recentIncreases.sort((a, b) => b.pctChange - a.pctChange);
  const top5Increases = recentIncreases.slice(0, 5);

  // 4) Check Backup Age (Older than 7 days or never)
  const lastBackupStr = settings?.lastBackupAt;
  let isBackupOverdue = true;
  let daysSinceBackup = 999;
  if (lastBackupStr) {
    const lastDate = new Date(lastBackupStr);
    const diffMs = Date.now() - lastDate.getTime();
    daysSinceBackup = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    isBackupOverdue = daysSinceBackup >= 7;
  }

  // Today's Sales Calculation
  const todayTotalSales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Backup Alert Banner (Soft Yellow Banner) */}
      {isBackupOverdue && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-yellow-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div>
              <div className="font-extrabold text-xs sm:text-sm">
                {lastBackupStr
                  ? `สำรองข้อมูลล่าสุดเมื่อ ${daysSinceBackup} วันที่แล้ว (เกินกำหนด 7 วัน)`
                  : 'ยังไม่เคยทำการสำรองข้อมูลฐานข้อมูล (Backup)'}
              </div>
              <p className="text-[11px] text-yellow-800 mt-0.5">
                ข้อมูลทั้งหมดถูกจัดเก็บบนเบราว์เซอร์นี้ แนะนำให้ส่งออกไฟล์สำรองข้อมูลเป็นประจำเพื่อป้องกันข้อมูลสูญหาย
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab?.('settings')}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-neutral-950 font-bold rounded-lg text-xs self-start sm:self-auto shadow-xs whitespace-nowrap"
          >
            สำรองข้อมูลตอนนี้
          </button>
        </div>
      )}

      {/* Top Banner & Quick Links */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            {t.foodCostDashboard || 'ภาพรวมต้นทุนอาหาร (Food Cost Dashboard)'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            ตรวจเช็คสุขภาพต้นทุนอาหาร สัดส่วนกำไรขั้นต้น เมนูที่ควรปรับราคา และความเคลื่อนไหวราคาสินค้า
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab?.('fc_recipes')}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[40px] flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {t.recipes || 'สูตรอาหาร'}
          </button>
          <button
            onClick={() => onNavigateTab?.('fc_pricing')}
            className="px-3.5 py-2 bg-[#FFFBF5] hover:bg-orange-50 text-orange-700 border border-[#FED7AA] font-bold rounded-xl text-xs min-h-[40px] flex items-center gap-1.5 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            {t.navFcPricing || 'ตั้งราคาขาย'}
          </button>
        </div>
      </div>

      {/* 4 STAT CARDS (Section 6.4) + TODAY'S SALES COMPACT CARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Menu Items */}
        <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-semibold">
            <span>เมนูขายทั้งหมด</span>
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
            {totalMenuItems}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-0.5">
            + {recipes.length - totalMenuItems} สูตรย่อย
          </div>
        </div>

        {/* KPI 2: Total Ingredients */}
        <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-semibold">
            <span>วัตถุดิบทั้งหมด</span>
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1F2937] font-mono mt-1">
            {totalIngredients}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-0.5">
            พร้อมบันทึก Yield
          </div>
        </div>

        {/* KPI 3: Average Food Cost % */}
        <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-semibold">
            <span>Food Cost เฉลี่ย</span>
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-600 font-mono mt-1">
            {avgFoodCostPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-[#6B7280] mt-0.5">
            เป้าหมาย: {settings?.defaultTargetFoodCostPercent || 30}%
          </div>
        </div>

        {/* KPI 4: Menus Over Target */}
        <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-semibold">
            <span>เมนูเกินเป้าหมาย</span>
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 font-mono mt-1">
            {menusOverTarget}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-0.5">
            เมนูที่ควรปรับราคา
          </div>
        </div>

        {/* COMPACT CARD: Today's Sales (linking to Reports) */}
        <div
          onClick={() => onNavigateTab?.('reports')}
          className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 shadow-xs cursor-pointer hover:bg-emerald-50 transition-colors"
        >
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
            <span>ยอดขายวันนี้</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ReceiptText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 font-mono mt-1">
            ฿{todayTotalSales.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
            <span>{todayOrders.length} บิลเสร็จสิ้น</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 2 PANELS: TOP 5 HIGHEST & TOP 5 LOWEST PROFIT DISHES (Section 6.4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Most Profitable */}
        <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 bg-[#FFFBF5] border-b border-[#FED7AA] flex items-center justify-between">
            <h2 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>เมนูกำไรสูงสุด 5 อันดับ (Top 5 Profit)</span>
            </h2>
            <span className="text-[11px] text-[#6B7280]">คลิกเพื่อตั้งราคา</span>
          </div>

          <div className="divide-y divide-[#FED7AA]">
            {top5Profitable.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">ยังไม่มีข้อมูลเมนูอาหาร</div>
            ) : (
              top5Profitable.map((item, idx) => (
                <div
                  key={item.recipe.id}
                  onClick={() => onNavigateTab?.('fc_pricing')}
                  className="p-3.5 hover:bg-orange-50/40 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#1F2937]">{item.recipe.nameTh || item.recipe.name}</div>
                      <div className="text-[11px] text-[#6B7280]">
                        ราคา ฿{item.sellPrice.toFixed(2)} • ต้นทุน ฿{item.totalCost.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-extrabold text-emerald-700">
                      +฿{item.analysis.profitPerPlate.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-[#6B7280]">
                      กำไร {item.analysis.profitPercent ? `${item.analysis.profitPercent.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top 5 Lowest Profit / Need Adjustment */}
        <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 bg-[#FFFBF5] border-b border-[#FED7AA] flex items-center justify-between">
            <h2 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span>เมนูกำไรต่ำสุด / ควรปรับราคา 5 อันดับ</span>
            </h2>
            <span className="text-[11px] text-[#6B7280]">คลิกเพื่อตั้งราคา</span>
          </div>

          <div className="divide-y divide-[#FED7AA]">
            {bottom5Profitable.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">ยังไม่มีข้อมูลเมนูอาหาร</div>
            ) : (
              bottom5Profitable.map((item, idx) => (
                <div
                  key={item.recipe.id}
                  onClick={() => onNavigateTab?.('fc_pricing')}
                  className="p-3.5 hover:bg-orange-50/40 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-800 font-mono font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-[#1F2937]">{item.recipe.nameTh || item.recipe.name}</div>
                      <div className="text-[11px] text-[#6B7280]">
                        ราคา ฿{item.sellPrice.toFixed(2)} • ต้นทุน ฿{item.totalCost.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-red-600">
                      +฿{item.analysis.profitPerPlate.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-red-500 font-semibold">
                      FC {item.analysis.foodCostPercent ? `${item.analysis.foodCostPercent.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* TOP 5 RECENT INGREDIENT PRICE INCREASES (Section 6.4) */}
      <div className="bg-white rounded-xl border border-[#FED7AA] overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-[#FFFBF5] border-b border-[#FED7AA] flex items-center justify-between">
          <h2 className="font-extrabold text-xs text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-500" />
            <span>วัตถุดิบที่ราคาขึ้นล่าสุด (Recent Price Increases)</span>
          </h2>
          <span className="text-[11px] text-[#6B7280]">อัตราการเพิ่มขึ้นล่าสุด</span>
        </div>

        <div className="divide-y divide-[#FED7AA]">
          {top5Increases.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6B7280]">
              ยังไม่มีประวัติการปรับขึ้นราคาของวัตถุดิบ
            </div>
          ) : (
            top5Increases.map((inc, i) => (
              <div key={i} className="p-3.5 flex items-center justify-between text-xs hover:bg-orange-50/20">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold">
                    ▲
                  </div>
                  <div>
                    <div className="font-bold text-[#1F2937]">{inc.ingredient.nameTh || inc.ingredient.name}</div>
                    <div className="text-[11px] text-[#6B7280]">
                      วันที่: {formatDate(inc.date)} • ผู้จัดจำหน่าย: {inc.ingredient.supplier || '-'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-red-600">
                    ฿{inc.prevPrice.toFixed(2)} → ฿{inc.currentPrice.toFixed(2)} (+{inc.pctChange.toFixed(1)}%)
                  </div>
                  <div className="text-[10px] text-[#6B7280]">
                    ต่อ {inc.ingredient.purchaseUnit}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
