/**
 * Pure Calculation Module for Tony's Kitchen
 * Implements Section 5 Calculation Rules for Food Cost and POS
 * Strictly typed, zero 'any', guarded divisions, and Thai comments on key formulas.
 */

import {
  Ingredient,
  Recipe,
  Settings,
  CustomUnit,
  Order,
  OrderLine,
  Promotion,
  Member,
  Shift,
} from '../types';

// ============================================================================
// a) Unit Conversion
// ============================================================================

export interface ConversionResult {
  success: boolean;
  qtyInBase: number;
  warning?: {
    th: string;
    en: string;
  };
}

/**
 * แปลงหน่วยปริมาณเป็นหน่วยฐาน (g, ml, pcs)
 * รองรับ g↔kg (1,000) และ ml↔l (1,000) ในตัว พร้อมหน่วยแบบกำหนดเอง (customUnits)
 */
export function convertToBaseUnit(
  qty: number,
  fromUnit: string,
  baseUnit: string,
  customUnits?: CustomUnit[]
): ConversionResult {
  if (typeof qty !== 'number' || isNaN(qty) || qty < 0) {
    return {
      success: false,
      qtyInBase: 0,
      warning: {
        th: 'จำนวนไม่ถูกต้อง',
        en: 'Invalid quantity',
      },
    };
  }

  const from = fromUnit.trim().toLowerCase();
  const base = baseUnit.trim().toLowerCase();

  // หน่วยเดียวกัน ไม่ต้องแปลง
  if (from === base) {
    return { success: true, qtyInBase: qty };
  }

  // 1) ระบบน้ำหนัก: g <-> kg
  if ((from === 'kg' || from === 'กิโลกรัม') && (base === 'g' || base === 'กรัม')) {
    return { success: true, qtyInBase: qty * 1000 };
  }
  if ((from === 'g' || from === 'กรัม') && (base === 'kg' || base === 'กิโลกรัม')) {
    return { success: true, qtyInBase: qty / 1000 };
  }

  // 2) ระบบปริมาตร: ml <-> l
  if ((from === 'l' || from === 'ลิตร') && (base === 'ml' || base === 'มิลลิลิตร')) {
    return { success: true, qtyInBase: qty * 1000 };
  }
  if ((from === 'ml' || from === 'มิลลิลิตร') && (base === 'l' || base === 'ลิตร')) {
    return { success: true, qtyInBase: qty / 1000 };
  }

  // 3) ระบบชิ้น/หน่วยนับ: pcs <-> piece
  if (
    (from === 'pcs' || from === 'piece' || from === 'ชิ้น') &&
    (base === 'pcs' || base === 'piece' || base === 'ชิ้น')
  ) {
    return { success: true, qtyInBase: qty };
  }

  // 4) ค้นหาใน customUnits ของวัตถุดิบ
  if (customUnits && customUnits.length > 0) {
    const matched = customUnits.find(
      (c) => c.name.trim().toLowerCase() === from
    );
    if (matched && matched.baseUnitsPer > 0) {
      return { success: true, qtyInBase: qty * matched.baseUnitsPer };
    }
  }

  // ไม่สามารถแปลงหน่วยได้: แสดงคำเตือนสองภาษา และไม่ทำให้โปรแกรมล่ม
  return {
    success: false,
    qtyInBase: 0,
    warning: {
      th: `ไม่สามารถแปลงหน่วย "${fromUnit}" เป็น "${baseUnit}" ได้`,
      en: `Cannot convert unit "${fromUnit}" to "${baseUnit}"`,
    },
  };
}

// ============================================================================
// b) Ingredient Cost Per Base Unit
// ============================================================================

/**
 * คำนวณต้นทุนวัตถุดิบต่อหน่วยฐาน
 * สูตร: (ราคาซื้อ ÷ (จำนวนซื้อ × ตัวคูณหน่วยฐาน)) ÷ (Yield% ÷ 100)
 */
export function calcIngredientCostPerBaseUnit(
  ingredient: Ingredient,
  overrideYieldPercent?: number
): number | null {
  const purchasePrice = ingredient.purchasePrice;
  const purchaseQty = ingredient.purchaseQty && ingredient.purchaseQty > 0 ? ingredient.purchaseQty : 1;
  const baseUnitsPerPurchase =
    ingredient.baseUnitsPerPurchaseUnit && ingredient.baseUnitsPerPurchaseUnit > 0
      ? ingredient.baseUnitsPerPurchaseUnit
      : ingredient.packSize && ingredient.packSize > 0
      ? ingredient.packSize
      : 1;

  const yieldPct =
    typeof overrideYieldPercent === 'number' && overrideYieldPercent > 0
      ? overrideYieldPercent
      : ingredient.yieldPercent && ingredient.yieldPercent > 0
      ? ingredient.yieldPercent
      : ingredient.yieldPercentage && ingredient.yieldPercentage > 0
      ? ingredient.yieldPercentage
      : 100;

  // ป้องกันการหารด้วยศูนย์
  const denominator = purchaseQty * baseUnitsPerPurchase;
  if (denominator <= 0 || yieldPct <= 0 || isNaN(purchasePrice) || purchasePrice < 0) {
    return null;
  }

  // ต้นทุนต่อหน่วยฐานก่อนคิด Yield
  const rawCostPerBase = purchasePrice / denominator;
  // ต้นทุนต่อหน่วยฐานหลังหักการสูญเสีย (Yield Loss)
  const effectiveCost = rawCostPerBase / (yieldPct / 100);

  return isFinite(effectiveCost) ? effectiveCost : null;
}

// ============================================================================
// c & d) Recipe Line Cost & Total Ingredient Cost (with Cycle Detection)
// ============================================================================

export interface RecipeCostBreakdown {
  ingredientCost: number;
  extraCost: number;
  overheadCost: number;
  totalCostPerServing: number;
  warnings: string[];
  hasCycle: boolean;
}

/**
 * คำนวณต้นทุนวัตถุดิบในสูตรอาหาร (รองรับ Sub-recipe และตรวจจับ Circular Reference)
 * สูตร: รวมต้นทุนแต่ละบรรทัด (qtyConvertedToBase × costPerBase)
 */
export function calcRecipeCosts(
  recipe: Recipe,
  allRecipes: Recipe[],
  allIngredients: Ingredient[],
  settings?: Settings | null,
  visitedRecipeIds: Set<string> = new Set()
): RecipeCostBreakdown {
  const warnings: string[] = [];
  let ingredientCostTotal = 0;
  let hasCycle = false;

  if (visitedRecipeIds.has(recipe.id)) {
    return {
      ingredientCost: 0,
      extraCost: 0,
      overheadCost: 0,
      totalCostPerServing: 0,
      warnings: [`สูตร "${recipe.nameTh || recipe.name}" มีการอ้างอิงวนซ้ำ (Circular Reference)`],
      hasCycle: true,
    };
  }

  const nextVisited = new Set(visitedRecipeIds);
  nextVisited.add(recipe.id);

  // 1) คำนวณวัตถุดิบตามโครงสร้าง Section 4 (recipe.ingredients)
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    for (const line of recipe.ingredients) {
      if (line.sourceType === 'ingredient') {
        const ing = allIngredients.find((i) => i.id === line.sourceId);
        if (!ing) {
          warnings.push(`ไม่พบวัตถุดิบรหัส ${line.sourceId}`);
          continue;
        }

        const baseUnit = (ing.baseUnit || ing.usageUnit || 'g').toString();
        const conv = convertToBaseUnit(line.qty, line.unit, baseUnit, ing.customUnits);
        if (!conv.success) {
          if (conv.warning) warnings.push(`${ing.nameTh || ing.name}: ${conv.warning.th}`);
          continue;
        }

        const costPerBase = calcIngredientCostPerBaseUnit(ing, line.yieldOverridePercent);
        if (costPerBase === null) {
          warnings.push(`ไม่สามารถคำนวณต้นทุนของ ${ing.nameTh || ing.name} ได้`);
          continue;
        }

        ingredientCostTotal += conv.qtyInBase * costPerBase;
      } else if (line.sourceType === 'recipe') {
        // สูตรย่อย (Sub-recipe)
        const subRecipe = allRecipes.find((r) => r.id === line.sourceId);
        if (!subRecipe) {
          warnings.push(`ไม่พบสูตรย่อยรหัส ${line.sourceId}`);
          continue;
        }

        const subBreakdown = calcRecipeCosts(
          subRecipe,
          allRecipes,
          allIngredients,
          settings,
          nextVisited
        );

        if (subBreakdown.hasCycle) {
          hasCycle = true;
          warnings.push(...subBreakdown.warnings);
          continue;
        }

        const outputQty = subRecipe.outputQty && subRecipe.outputQty > 0 ? subRecipe.outputQty : 1;
        const subBaseUnit = (subRecipe.outputUnit || 'portion').trim().toLowerCase();
        const lineUnit = line.unit.trim().toLowerCase();

        let convertedQty = line.qty;
        if (subBaseUnit !== lineUnit) {
          const conv = convertToBaseUnit(line.qty, line.unit, subBaseUnit);
          if (conv.success) {
            convertedQty = conv.qtyInBase;
          } else {
            warnings.push(
              `หน่วย "${line.unit}" ไม่ตรงกับหน่วยผลผลิตของสูตรย่อย "${subRecipe.nameTh || subRecipe.name}" (${subBaseUnit})`
            );
          }
        }

        // ต้นทุนสูตรย่อยต่อหน่วยผลผลิต
        const subCostPerBase = subBreakdown.totalCostPerServing / outputQty;
        ingredientCostTotal += convertedQty * subCostPerBase;
      }
    }
  } else if (recipe.items && recipe.items.length > 0) {
    // รองรับโครงสร้างสูตรเดิม (items)
    for (const item of recipe.items) {
      const ing = allIngredients.find((i) => i.id === item.ingredientId);
      if (ing) {
        ingredientCostTotal += item.lineCost || (item.quantity * (ing.unitCost || 0));
      }
    }
  }

  // 2) ต้นทุนต่อเสิร์ฟ (สำหรับสูตรจานหลัก outputQty = 1, สำหรับสูตรย่อยหารด้วย outputQty)
  const outputPortions =
    recipe.type === 'sub' || recipe.type === 'sub_recipe'
      ? recipe.outputQty && recipe.outputQty > 0
        ? recipe.outputQty
        : 1
      : recipe.portionsYield && recipe.portionsYield > 0
      ? recipe.portionsYield
      : 1;

  const ingredientCostPerPortion = ingredientCostTotal / outputPortions;

  // e) Extra costs (ต้นทุนแฝง/บรรจุภัณฑ์)
  let extraCostPerPortion = 0;
  if (recipe.extraCosts && recipe.extraCosts.length > 0) {
    extraCostPerPortion = recipe.extraCosts.reduce((acc, c) => acc + (c.amount || 0), 0);
  } else {
    extraCostPerPortion = (recipe.packagingCostPerPortion || 0) + (recipe.laborCostPerPortion || 0);
  }

  // f) Overhead (ค่าโสหุ้ย) = (ต้นทุนวัตถุดิบ + ต้นทุนแฝง) × Overhead% ÷ 100
  const defaultOverhead = settings?.defaultOverheadPercent ?? 0;
  const overheadPct =
    typeof recipe.overheadPercentOverride === 'number'
      ? recipe.overheadPercentOverride
      : defaultOverhead;

  const overheadCost = ((ingredientCostPerPortion + extraCostPerPortion) * overheadPct) / 100;

  // g) Total cost per serving = วัตถุดิบ + แฝง + โสหุ้ย
  const totalCostPerServing = ingredientCostPerPortion + extraCostPerPortion + overheadCost;

  return {
    ingredientCost: ingredientCostPerPortion,
    extraCost: extraCostPerPortion,
    overheadCost,
    totalCostPerServing,
    warnings,
    hasCycle,
  };
}

// ============================================================================
// h, i, j, k) Selling Price, Revenue, Food Cost %, Profit & Suggested Price
// ============================================================================

export interface PriceAnalysis {
  sellPrice: number;
  priceExVat: number;
  serviceChargeAmount: number;
  vatAmount: number;
  customerGrandTotal: number;
  revenuePerPlate: number;
  foodCostPercent: number | null;
  totalCostPercent: number | null;
  profitPerPlate: number;
  profitPercent: number | null;
  suggestedPrice: number | null;
  suggestedPriceRounded: number | null;
  status: 'on-target' | 'over-target' | 'unknown';
}

/**
 * ปัดเศษราคาขึ้นตามขั้นที่ตั้งไว้ (1, 5, 10 บาท)
 */
export function roundPriceByStep(price: number, step: 1 | 5 | 10): number {
  if (price <= 0 || isNaN(price)) return 0;
  return Math.ceil(price / step) * step;
}

/**
 * วิเคราะห์ราคาขาย, กำไร, และสัดส่วนต้นทุนอาหาร (Food Cost %)
 */
export function analyzeSellingPrice(
  sellPrice: number,
  ingredientCost: number,
  totalCost: number,
  recipe: Recipe,
  settings: Settings | null
): PriceAnalysis {
  const vatEnabled = settings?.vat?.enabled ?? false;
  const vatRate = (settings?.vat?.ratePercent ?? 7) / 100;
  const priceIncludesVat = settings?.vat?.priceIncludesVat ?? true;

  const scEnabled = settings?.serviceCharge?.enabled ?? false;
  const scRate = (settings?.serviceCharge?.ratePercent ?? 10) / 100;
  const scAsRevenue = settings?.serviceCharge?.countAsRevenue ?? false;

  // 1) คำนวณราคาขายก่อน VAT (Price Ex-VAT)
  let priceExVat = sellPrice;
  if (vatEnabled && priceIncludesVat && vatRate > 0) {
    priceExVat = sellPrice / (1 + vatRate);
  }

  // 2) เมื่อเปิด Service Charge
  const serviceChargeAmount = scEnabled ? priceExVat * scRate : 0;
  const taxableAmount = priceExVat + serviceChargeAmount;
  const vatAmount = vatEnabled ? taxableAmount * vatRate : 0;
  const customerGrandTotal = taxableAmount + vatAmount;

  // 3) รายได้ต่อจาน (Revenue per plate) = ราคาขายก่อน VAT (+ Service Charge เฉพาะเมื่อนับเป็นรายได้)
  const revenuePerPlate = priceExVat + (scAsRevenue ? serviceChargeAmount : 0);

  // 4) Food Cost % และ Total Cost % (ป้องกันการหารด้วยศูนย์)
  let foodCostPercent: number | null = null;
  let totalCostPercent: number | null = null;
  let profitPercent: number | null = null;

  if (revenuePerPlate > 0) {
    foodCostPercent = (ingredientCost / revenuePerPlate) * 100;
    totalCostPercent = (totalCost / revenuePerPlate) * 100;
    const profit = revenuePerPlate - totalCost;
    profitPercent = (profit / revenuePerPlate) * 100;
  }

  const profitPerPlate = revenuePerPlate - totalCost;

  // 5) ราคาแนะนำ (Suggested price) = ต้นทุนวัตถุดิบ ÷ (เป้าหมาย% ÷ 100)
  const targetPct =
    recipe.targetFoodCostOverride ??
    recipe.targetFoodCostPct ??
    settings?.defaultTargetFoodCostPercent ??
    30;

  let suggestedPrice: number | null = null;
  let suggestedPriceRounded: number | null = null;

  if (targetPct > 0 && ingredientCost > 0) {
    const rawSuggestedExVat = ingredientCost / (targetPct / 100);
    // หากร้านตั้งราคาแบบรวม VAT (Price Includes VAT) แปลงกลับให้เป็นราคาขายหน้าร้าน
    if (vatEnabled && priceIncludesVat) {
      suggestedPrice = rawSuggestedExVat * (1 + vatRate);
    } else {
      suggestedPrice = rawSuggestedExVat;
    }

    const roundingStep = settings?.priceRounding ?? 5;
    suggestedPriceRounded = roundPriceByStep(suggestedPrice, roundingStep);
  }

  // 6) สถานะเทียบกับเป้าหมาย
  let status: 'on-target' | 'over-target' | 'unknown' = 'unknown';
  if (foodCostPercent !== null) {
    status = foodCostPercent <= targetPct ? 'on-target' : 'over-target';
  }

  return {
    sellPrice,
    priceExVat,
    serviceChargeAmount,
    vatAmount,
    customerGrandTotal,
    revenuePerPlate,
    foodCostPercent,
    totalCostPercent,
    profitPerPlate,
    profitPercent,
    suggestedPrice,
    suggestedPriceRounded,
    status,
  };
}

// ============================================================================
// l) Delivery Platform Pricing & Net Revenue
// ============================================================================

export interface DeliveryAnalysis {
  platformId: string;
  platformName: string;
  deliveryPrice: number;
  effectiveGpPercent: number;
  platformFee: number;
  netRevenue: number;
  foodCostPercent: number | null;
  profitPerPlate: number;
  suggestedDeliveryPrice: number | null;
  suggestedDeliveryPriceRounded: number | null;
}

/**
 * คำนวณราคาขาย กำไร และค่าธรรมเนียม GP ของแพลตฟอร์มเดลิเวอรี
 * สูตร GP มี VAT: Effective GP = GP% × 1.07
 * Net Revenue = ราคาเดลิเวอรี × (1 - Effective GP% ÷ 100)
 */
export function analyzeDeliveryPlatform(
  platformId: string,
  deliveryPrice: number,
  ingredientCost: number,
  totalCost: number,
  recipe: Recipe,
  settings: Settings | null
): DeliveryAnalysis {
  const platform = settings?.platforms.find((p) => p.id === platformId) || {
    id: platformId,
    name: platformId.toUpperCase(),
    gpPercent: 30,
    gpHasVat: false,
  };

  // หาก GP มี VAT: ตัวคูณ 1.07
  const effectiveGpPercent = platform.gpHasVat
    ? platform.gpPercent * 1.07
    : platform.gpPercent;

  const platformFee = deliveryPrice * (effectiveGpPercent / 100);
  const netRevenue = deliveryPrice * (1 - effectiveGpPercent / 100);

  let foodCostPercent: number | null = null;
  if (netRevenue > 0) {
    foodCostPercent = (ingredientCost / netRevenue) * 100;
  }

  const profitPerPlate = netRevenue - totalCost;

  // ราคาเดลิเวอรีแนะนำ: ต้นทุนวัตถุดิบ ÷ (เป้าหมาย% ÷ 100 × (1 - Effective GP% ÷ 100))
  const targetPct =
    recipe.targetFoodCostOverride ??
    recipe.targetFoodCostPct ??
    settings?.defaultTargetFoodCostPercent ??
    30;

  let suggestedDeliveryPrice: number | null = null;
  let suggestedDeliveryPriceRounded: number | null = null;

  const divisor = (targetPct / 100) * (1 - effectiveGpPercent / 100);
  if (divisor > 0 && ingredientCost > 0) {
    suggestedDeliveryPrice = ingredientCost / divisor;
    const rounding = settings?.priceRounding ?? 5;
    suggestedDeliveryPriceRounded = roundPriceByStep(suggestedDeliveryPrice, rounding);
  }

  return {
    platformId,
    platformName: platform.name,
    deliveryPrice,
    effectiveGpPercent,
    platformFee,
    netRevenue,
    foodCostPercent,
    profitPerPlate,
    suggestedDeliveryPrice,
    suggestedDeliveryPriceRounded,
  };
}

// ============================================================================
// n) Display Formatting (Money 2 Decimals, Percent 1 Decimal)
// ============================================================================

const thCurrencyFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '-';
  }
  return thCurrencyFormatter.format(amount);
}

export function formatPercent(percent: number | null | undefined): string {
  if (typeof percent !== 'number' || isNaN(percent)) {
    return '-';
  }
  return `${percent.toFixed(1)}%`;
}

// ============================================================================
// o & p) POS Bill Calculation & Promotions Evaluation
// ============================================================================

export interface BillCalculationBreakdown {
  linesSubtotal: number;
  itemDiscountsTotal: number;
  billDiscountsTotal: number;
  loyaltyDiscountTotal: number;
  totalDiscounts: number;
  discountedSubtotal: number;
  serviceChargeAmount: number;
  vatAmount: number;
  taxableAmount: number;
  grandTotal: number;
  payableTotal: number;
  appliedPromotionNames: string[];
}

/**
 * คำนวณยอดบิล POS ตามลำดับที่ระบุในสเปกข้อ o:
 * 1) Line Subtotal (unitPrice + modifier deltas) × qty
 * 2) Promotions & Discounts (Item-level -> Bill-level -> Loyalty Redemption)
 * 3) Service Charge บนยอดหลังหักส่วนลด
 * 4) VAT บน (ยอดหลังหักส่วนลด + Service Charge)
 */
export function calculateOrderBill(
  lines: OrderLine[],
  promotions: Promotion[] = [],
  member: Member | null = null,
  pointsToRedeem = 0,
  couponCode?: string,
  settings?: Settings | null,
  roundPayableToBaht = false
): BillCalculationBreakdown {
  // 1) คำนวณราคารวมรายการทั้งหมด
  let linesSubtotal = 0;
  for (const line of lines) {
    if (line.voided) continue;
    const qty = line.qty ?? line.quantity ?? 1;
    const basePrice = line.unitPrice ?? line.basePrice ?? 0;
    const modDelta = line.modifiers
      ? line.modifiers.reduce((sum, m) => sum + (m.priceDelta || 0), 0)
      : line.selectedModifiers
      ? line.selectedModifiers.reduce((sum, m) => sum + (m.priceDelta || 0), 0)
      : 0;

    linesSubtotal += (basePrice + modDelta) * qty;
  }

  // 2) ตรวจสอบและคำนวณโปรโมชัน
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentHourMinute = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const appliedPromoNames: string[] = [];
  let itemDiscountsTotal = 0;
  let billDiscountsTotal = 0;

  // คัดกรองโปรโมชันที่เปิดใช้งาน
  const activePromos = promotions.filter(
    (p) => (p.enabled ?? p.isActive) !== false
  );

  // 2.1) Item-level: Happy Hour & BOGO
  for (const p of activePromos) {
    if (p.type === 'happy-hour') {
      const matchDay = !p.activeDays || p.activeDays.length === 0 || p.activeDays.includes(currentDay);
      const matchTime =
        (!p.activeStartTime || currentHourMinute >= p.activeStartTime) &&
        (!p.activeEndTime || currentHourMinute <= p.activeEndTime);

      if (matchDay && matchTime) {
        let promoDiscount = 0;
        for (const line of lines) {
          if (line.voided) continue;
          const matchProduct =
            !p.applicableProductIds ||
            p.applicableProductIds.length === 0 ||
            p.applicableProductIds.includes(line.productId);

          if (matchProduct) {
            const qty = line.qty ?? line.quantity ?? 1;
            const linePrice = (line.unitPrice ?? line.basePrice ?? 0) * qty;
            const discount =
              p.discountKind === 'percent'
                ? linePrice * (p.value / 100)
                : Math.min(linePrice, p.value * qty);
            promoDiscount += discount;
          }
        }
        if (promoDiscount > 0) {
          itemDiscountsTotal += promoDiscount;
          appliedPromoNames.push(p.name || p.nameTh || 'Happy Hour');
        }
      }
    } else if (p.type === 'bogo') {
      // Buy 1 Get 1: ฟรี 1 รายการเมื่อซื้อครบ 2 ชิ้น
      for (const line of lines) {
        if (line.voided) continue;
        const matchProduct =
          !p.applicableProductIds ||
          p.applicableProductIds.length === 0 ||
          p.applicableProductIds.includes(line.productId);

        const qty = line.qty ?? line.quantity ?? 1;
        if (matchProduct && qty >= 2) {
          const freeQty = Math.floor(qty / 2);
          const freeAmount = (line.unitPrice ?? line.basePrice ?? 0) * freeQty;
          itemDiscountsTotal += freeAmount;
          appliedPromoNames.push(`${p.name || p.nameTh || 'BOGO'} (ฟรี ${freeQty} จาน)`);
        }
      }
    }
  }

  const subtotalAfterItemDiscount = Math.max(0, linesSubtotal - itemDiscountsTotal);

  // 2.2) Bill-level discounts & Coupon
  for (const p of activePromos) {
    if (p.type === 'bill-discount') {
      const minSpend = p.minSpend || 0;
      if (subtotalAfterItemDiscount >= minSpend) {
        const discount =
          p.discountKind === 'percent'
            ? subtotalAfterItemDiscount * (p.value / 100)
            : Math.min(subtotalAfterItemDiscount, p.value);

        if (discount > 0) {
          billDiscountsTotal += discount;
          appliedPromoNames.push(p.name || p.nameTh || 'Bill Discount');
        }
      }
    } else if (p.type === 'coupon' && couponCode && p.couponCode) {
      if (p.couponCode.trim().toUpperCase() === couponCode.trim().toUpperCase()) {
        const minSpend = p.minSpend || 0;
        if (subtotalAfterItemDiscount >= minSpend) {
          const discount =
            p.discountKind === 'percent'
              ? subtotalAfterItemDiscount * (p.value / 100)
              : Math.min(subtotalAfterItemDiscount, p.value);

          if (discount > 0) {
            billDiscountsTotal += discount;
            appliedPromoNames.push(`คูปอง: ${p.couponCode.toUpperCase()}`);
          }
        }
      }
    }
  }

  // 2.3) Loyalty Point Redemption
  let loyaltyDiscountTotal = 0;
  if (member && pointsToRedeem > 0 && settings?.loyalty?.enabled) {
    const minRedeem = settings.loyalty.minRedeemPoints || 10;
    const bahtPerPoint = settings.loyalty.bahtPerPoint || 1;
    if (pointsToRedeem >= minRedeem && member.points >= pointsToRedeem) {
      const maxDiscountPossible = subtotalAfterItemDiscount - billDiscountsTotal;
      loyaltyDiscountTotal = Math.min(
        pointsToRedeem * bahtPerPoint,
        Math.max(0, maxDiscountPossible)
      );
      if (loyaltyDiscountTotal > 0) {
        appliedPromoNames.push(`แลกแต้มสมาชิก ${pointsToRedeem} แต้ม`);
      }
    }
  }

  const totalDiscounts = itemDiscountsTotal + billDiscountsTotal + loyaltyDiscountTotal;
  const discountedSubtotal = Math.max(0, linesSubtotal - totalDiscounts);

  // 3) Service Charge
  const scEnabled = settings?.serviceCharge?.enabled ?? false;
  const scRate = (settings?.serviceCharge?.ratePercent ?? 10) / 100;
  const serviceChargeAmount = scEnabled ? discountedSubtotal * scRate : 0;

  // 4) VAT (รองรับทั้ง VAT รวมในราคา และ VAT แยกนอกราคา)
  const vatEnabled = settings?.vat?.enabled ?? false;
  const vatRate = (settings?.vat?.ratePercent ?? 7) / 100;
  const priceIncludesVat = settings?.vat?.priceIncludesVat ?? true;

  let vatAmount = 0;
  let grandTotal = 0;
  let taxableAmount = discountedSubtotal + serviceChargeAmount;

  if (vatEnabled) {
    if (priceIncludesVat) {
      // ราคาขายรวม VAT ไว้แล้ว: ถอดภาษีออกจากยอดรวม (VAT = ยอดรวม × vatRate ÷ (1 + vatRate))
      vatAmount = taxableAmount - taxableAmount / (1 + vatRate);
      grandTotal = taxableAmount;
    } else {
      // ราคาขายยังไม่รวม VAT: คำนวณ VAT บวกเพิ่มบน (ยอดอาหาร + Service Charge)
      vatAmount = taxableAmount * vatRate;
      grandTotal = taxableAmount + vatAmount;
    }
  } else {
    grandTotal = taxableAmount;
  }

  let payableTotal = grandTotal;
  if (roundPayableToBaht) {
    payableTotal = Math.round(grandTotal);
  }

  return {
    linesSubtotal,
    itemDiscountsTotal,
    billDiscountsTotal,
    loyaltyDiscountTotal,
    totalDiscounts,
    discountedSubtotal,
    serviceChargeAmount,
    vatAmount,
    taxableAmount,
    grandTotal,
    payableTotal,
    appliedPromotionNames: appliedPromoNames,
  };
}

// ============================================================================
// q) Loyalty Points Calculation
// ============================================================================

export function calcPointsEarned(paidAmount: number, settings: Settings | null): number {
  if (!settings?.loyalty?.enabled) return 0;
  const spendPerPoint = settings.loyalty.spendPerPoint || 25;
  if (spendPerPoint <= 0 || paidAmount <= 0) return 0;
  return Math.floor(paidAmount / spendPerPoint);
}

// ============================================================================
// s) Split Bill Rules
// ============================================================================

/**
 * แยกบิลตามจำนวนคน: หารเท่ากัน โดยเศษสตางค์ที่เหลือจะถูกปัดไปให้คนสุดท้าย
 * เช่น ยอด 100.00 บาท หาร 3 คน -> คนที่ 1: 33.33, คนที่ 2: 33.33, คนที่ 3: 33.34 (รวมได้ 100.00 พอดี)
 */
export function splitBillByGuests(total: number, guestCount: number): number[] {
  if (guestCount <= 1 || total <= 0) return [total];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / guestCount);
  const remainderCents = totalCents - baseCents * guestCount;

  const result: number[] = [];
  for (let i = 0; i < guestCount; i++) {
    const isLast = i === guestCount - 1;
    const shareCents = isLast ? baseCents + remainderCents : baseCents;
    result.push(shareCents / 100);
  }

  return result;
}

// ============================================================================
// t) Cash Tendered & Change Calculations
// ============================================================================

export interface ChangeResult {
  change: number;
  isValid: boolean;
}

export function calcChange(tendered: number, payable: number): ChangeResult {
  const change = tendered - payable;
  return {
    change: Math.max(0, change),
    isValid: tendered >= payable,
  };
}

/**
 * สร้างคำแนะนำปุ่มลัดรับเงินสด (Exact, 20, 50, 100, 500, 1,000 หรือแบงก์ที่พอดีถัดไป)
 */
export function getCashSuggestions(payable: number): number[] {
  if (payable <= 0) return [20, 50, 100, 500, 1000];

  const suggestions = new Set<number>();
  suggestions.add(payable); // ปุ่มยอดพอดี (Exact)

  const denominations = [20, 50, 100, 500, 1000];
  for (const denom of denominations) {
    if (denom >= payable) {
      suggestions.add(denom);
    }
  }

  // คำนวณแบงก์ร้อย หรือแบงก์ห้าร้อยถัดไป
  if (payable > 100) {
    const nextHundred = Math.ceil(payable / 100) * 100;
    suggestions.add(nextHundred);
  }
  if (payable > 500) {
    const nextFiveHundred = Math.ceil(payable / 500) * 500;
    suggestions.add(nextFiveHundred);
  }
  if (payable > 1000) {
    const nextThousand = Math.ceil(payable / 1000) * 1000;
    suggestions.add(nextThousand);
  }

  return Array.from(suggestions).sort((a, b) => a - b);
}

// ============================================================================
// v) Shift Cash Reconciliation
// ============================================================================

export interface ShiftReconciliationResult {
  expectedCash: number;
  difference: number | null;
  status: 'balanced' | 'over' | 'short' | 'pending';
}

/**
 * คำนวณเงินสดที่ควรมีในลิ้นชัก (Expected Cash) และผลต่างเงินสด (Difference)
 * สูตร: expectedCash = เงินเปิดกะ + ยอดขายเงินสดที่ได้รับระหว่างกะ
 */
export function calcShiftReconciliation(shift: Shift): ShiftReconciliationResult {
  const openingCash = shift.openingCash ?? shift.startingCash ?? 0;
  const cashSales = shift.cashSales ?? 0;
  const expectedCash = openingCash + cashSales;

  if (typeof shift.countedCash !== 'number' && typeof shift.actualCash !== 'number') {
    return {
      expectedCash,
      difference: null,
      status: 'pending',
    };
  }

  const counted = shift.countedCash ?? shift.actualCash ?? 0;
  const difference = counted - expectedCash;

  let status: 'balanced' | 'over' | 'short' = 'balanced';
  if (difference > 0.01) {
    status = 'over';
  } else if (difference < -0.01) {
    status = 'short';
  }

  return {
    expectedCash,
    difference,
    status,
  };
}

// ============================================================================
// x) Reporting Cost Snapshot
// ============================================================================

export interface OrderReportingCost {
  totalCost: number | null;
  hasMissingCost: boolean;
  missingItemsCount: number;
}

/**
 * รวมต้นทุนสำหรับรายงานยอดขายจาก snapshot ณ เวลาขายจริง
 * สูตร: sum(line.unitCostSnapshot × qty)
 * รายการที่ไม่มีข้อมูลต้นทุนจะถูกบันทึกเตือนและแสดง "ไม่มีต้นทุน" แทนที่จะนับเป็นศูนย์
 */
export function calcOrderReportingCost(order: Order): OrderReportingCost {
  const lines = order.lines || order.items || [];
  let totalCost = 0;
  let hasMissingCost = false;
  let missingItemsCount = 0;

  for (const line of lines) {
    if (line.voided) continue;
    const qty = line.qty ?? line.quantity ?? 1;
    const cost = line.unitCostSnapshot ?? line.unitCost;

    if (typeof cost !== 'number' || isNaN(cost)) {
      hasMissingCost = true;
      missingItemsCount++;
    } else {
      totalCost += cost * qty;
    }
  }

  return {
    totalCost: hasMissingCost ? null : totalCost,
    hasMissingCost,
    missingItemsCount,
  };
}
