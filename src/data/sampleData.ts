/**
 * Authentic Thai Bistro Preset Sample Data for Tony's Kitchen
 * Section 8.4 Specification:
 * - ~12 Thai ingredients
 * - Sub-recipe "น้ำจิ้มซีฟู้ด"
 * - 3–4 menus (กะเพราหมูสับ, ข้าวผัดกุ้ง, ชาเย็น, ผัดไทย) with realistic prices
 * - POS sample: 4 categories, products linked with modifiers (ความเผ็ด, ไข่ดาว +฿10, ไซซ์)
 * - 8 tables in 2 zones (Indoor 4 tables, Outdoor 4 tables)
 * - 2 promotions
 * - 3 members
 * - ~30 sample paid bills over the past 14 days (with cost snapshots)
 */

import {
  Ingredient,
  Recipe,
  ProductCategory,
  Product,
  RestaurantTable,
  Promotion,
  Member,
  Expense,
  Order,
  OrderLine,
  RestaurantSettings,
  RecurringExpense,
} from '../types';

export const SAMPLE_SETTINGS: RestaurantSettings = {
  id: 'current_settings',
  restaurantNameTh: "Tony's Kitchen (ครัวโทนี่)",
  restaurantNameEn: "Tony's Kitchen Thai Bistro",
  tagline: "รสชาติไทยแท้ ต้นทุนแม่นยำ ขายคล่อง กำไรชัดเจน",
  addressTh: "128/9 สุขุมวิท 38 แขวงพระโขนง เขตคลองเตย กรุงเทพมหานคร 10110",
  addressEn: "128/9 Sukhumvit 38, Phra Khanong, Khlong Toei, Bangkok 10110",
  phone: "089-123-4567",
  taxId: "0105562089123",
  promptPayId: "0891234567",
  promptPayName: "Tony Kitchen Bistro Co., Ltd.",
  currency: "฿",
  vatEnabled: true,
  vatRate: 7,
  vatInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 10,
  serviceChargeCountAsRevenue: false,
  receiptHeaderMessage: "ยินดีต้อนรับสู่ Tony's Kitchen / Welcome to Tony's Kitchen",
  receiptFooterMessage: "ขอบคุณที่มาอุดหนุน / Thank you for visiting us! สอบถามบริการโทร 089-123-4567",
  receiptWidth: '80mm',
  language: 'th',
  defaultTableZone: 'indoor',
  soundEnabled: true,
  textSize: 'large',
  defaultTargetFoodCostPercent: 30,
  defaultOverheadPercent: 0,
  priceRounding: 1,
  platforms: [
    { id: 'grab', name: 'GrabFood', gpPercent: 30, gpHasVat: false },
    { id: 'lineman', name: 'LINE MAN', gpPercent: 30, gpHasVat: false },
    { id: 'foodpanda', name: 'Foodpanda', gpPercent: 30, gpHasVat: false },
  ],
  ingredientCategories: [
    'เนื้อสัตว์',
    'อาหารทะเล',
    'ผัก/ผลไม้',
    'เครื่องปรุง',
    'ของแห้ง/แป้ง',
    'เครื่องดื่ม',
    'บรรจุภัณฑ์',
    'อื่นๆ',
  ],
  recipeCategories: [
    'จานหลัก',
    'ของทานเล่น',
    'เครื่องดื่ม',
    'ของหวาน',
    'สูตรย่อย/ซอส',
  ],
  expenseCategories: [
    'ค่าเช่า',
    'เงินเดือน/ค่าแรง',
    'ค่าน้ำ-ไฟ',
    'ค่าแก๊ส',
    'การตลาด',
    'ซ่อมบำรุง',
    'อื่นๆ',
  ],
  printerStations: [
    { id: 'station_kitchen', name: 'ครัว/Kitchen', paperWidthMm: 80 },
    { id: 'station_bar', name: 'บาร์/Bar', paperWidthMm: 80 },
  ],
  paymentMethods: [
    { id: 'pm_cash', type: 'cash', name: 'เงินสด', enabled: true },
    { id: 'pm_promptpay', type: 'promptpay', name: 'PromptPay QR', enabled: true },
    { id: 'pm_card', type: 'card', name: 'บัตรเครดิต', enabled: true },
    { id: 'pm_wallet', type: 'wallet', name: 'TrueMoney / e-Wallet', enabled: true },
  ],
  loyalty: {
    enabled: true,
    spendPerPoint: 25,
    bahtPerPoint: 1,
    minRedeemPoints: 10,
  },
};

// ---------------------------------------------------------------------------
// 1. ~12 Thai Authentic Ingredients
// ---------------------------------------------------------------------------
export const SAMPLE_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing_pork_minced',
    nameTh: 'เนื้อหมูสับอนามัย',
    nameEn: 'Hygienic Minced Pork',
    category: 'meat',
    purchasePrice: 160,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 95,
    unitCost: Number(((160 / 1000) / 0.95).toFixed(4)), // ~0.1684 ฿/g
    currentStock: 12000,
    minStock: 3000,
    supplier: 'เบทาโกร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_shrimp',
    nameTh: 'กุ้งขาวสดแกะเปลือก',
    nameEn: 'Fresh White Shrimp',
    category: 'meat',
    purchasePrice: 280,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 75,
    unitCost: Number(((280 / 1000) / 0.75).toFixed(4)), // ~0.3733 ฿/g
    currentStock: 8000,
    minStock: 2500,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_chicken',
    nameTh: 'เนื้ออกไก่สด',
    nameEn: 'Fresh Chicken Breast',
    category: 'meat',
    purchasePrice: 95,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 92,
    unitCost: Number(((95 / 1000) / 0.92).toFixed(4)), // ~0.1033 ฿/g
    currentStock: 10000,
    minStock: 3000,
    supplier: 'เบทาโกร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_basil',
    nameTh: 'ใบกะเพราป่าสดหอม',
    nameEn: 'Wild Holy Basil',
    category: 'vegetable',
    purchasePrice: 40,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 70, // เด็ดยอด
    unitCost: Number(((40 / 1000) / 0.70).toFixed(4)), // ~0.0571 ฿/g
    currentStock: 3000,
    minStock: 1000,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_chili_prik_kee_noo',
    nameTh: 'พริกขี้หนูสวนจินดา',
    nameEn: 'Bird\'s Eye Chili',
    category: 'vegetable',
    purchasePrice: 120,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 90,
    unitCost: Number(((120 / 1000) / 0.90).toFixed(4)), // ~0.1333 ฿/g
    currentStock: 2500,
    minStock: 800,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_garlic',
    nameTh: 'กระเทียมไทยแกะกลีบ',
    nameEn: 'Thai Fragrant Garlic',
    category: 'vegetable',
    purchasePrice: 90,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 85,
    unitCost: Number(((90 / 1000) / 0.85).toFixed(4)), // ~0.1059 ฿/g
    currentStock: 4000,
    minStock: 1000,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_lime',
    nameTh: 'มะนาวแป้นสดคั้นน้ำ',
    nameEn: 'Fresh Key Lime',
    category: 'vegetable',
    purchasePrice: 70,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'ml',
    yieldPercentage: 45, // น้ำมะนาว 45%
    unitCost: Number(((70 / 1000) / 0.45).toFixed(4)), // ~0.1556 ฿/ml
    currentStock: 3000,
    minStock: 800,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_fish_sauce',
    nameTh: 'น้ำปลาแท้เกรดพรีเมียม',
    nameEn: 'Premium Fish Sauce',
    category: 'seasoning',
    purchasePrice: 42,
    purchaseUnit: 'bottle',
    packSize: 700,
    usageUnit: 'ml',
    yieldPercentage: 100,
    unitCost: Number((42 / 700).toFixed(4)), // 0.06 ฿/ml
    currentStock: 8400,
    minStock: 2100,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_palm_sugar',
    nameTh: 'น้ำตาลปี๊บแท้แม่กลอง',
    nameEn: 'Organic Palm Sugar',
    category: 'seasoning',
    purchasePrice: 65,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: Number((65 / 1000).toFixed(4)), // 0.065 ฿/g
    currentStock: 6000,
    minStock: 1500,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_jasmine_rice',
    nameTh: 'ข้าวสวยหอมมะลิหุงสุก',
    nameEn: 'Cooked Jasmine Rice',
    category: 'dry_goods',
    purchasePrice: 45,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 230, // 1kg uncooked -> 2.3kg cooked
    unitCost: Number(((45 / 1000) / 2.3).toFixed(4)), // ~0.0196 ฿/g
    currentStock: 25000,
    minStock: 6000,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_egg',
    nameTh: 'ไข่ไก่สดเบอร์ 2',
    nameEn: 'Fresh Egg (#2)',
    category: 'dry_goods',
    purchasePrice: 135,
    purchaseUnit: 'pack',
    packSize: 30,
    usageUnit: 'piece',
    yieldPercentage: 100,
    unitCost: 4.5, // 4.50 ฿/piece
    currentStock: 150,
    minStock: 30,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_thai_tea_mix',
    nameTh: 'ใบชาไทยสูตรโบราณ',
    nameEn: 'Thai Tea Leaves Blend',
    category: 'beverage',
    purchasePrice: 95,
    purchaseUnit: 'pack',
    packSize: 400,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: Number((95 / 400).toFixed(4)), // ~0.2375 ฿/g
    currentStock: 3200,
    minStock: 800,
    supplier: 'ชาตรามือ',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_condensed_milk',
    nameTh: 'นมข้นหวานสูตรเข้มข้น',
    nameEn: 'Sweetened Condensed Milk',
    category: 'beverage',
    purchasePrice: 32,
    purchaseUnit: 'can',
    packSize: 380,
    usageUnit: 'g',
    yieldPercentage: 98,
    unitCost: Number(((32 / 380) / 0.98).toFixed(4)), // ~0.086 ฿/g
    currentStock: 7600,
    minStock: 1900,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// 2. Sub-recipe: น้ำจิ้มซีฟู้ด + 4 Menus
// ---------------------------------------------------------------------------
export const SAMPLE_RECIPES: Recipe[] = [
  // Sub-Recipe: น้ำจิ้มซีฟู้ดรสเด็ด (10 portions yield)
  {
    id: 'rec_seafood_dip',
    nameTh: 'น้ำจิ้มซีฟู้ดรสเด็ด (สูตรย่อย)',
    nameEn: 'Spicy Seafood Dipping Sauce',
    type: 'sub_recipe',
    portionsYield: 10,
    items: [
      { ingredientId: 'ing_chili_prik_kee_noo', quantity: 100, unitCost: 0.1333, lineCost: 13.33 },
      { ingredientId: 'ing_garlic', quantity: 80, unitCost: 0.1059, lineCost: 8.47 },
      { ingredientId: 'ing_lime', quantity: 120, unitCost: 0.1556, lineCost: 18.67 },
      { ingredientId: 'ing_fish_sauce', quantity: 100, unitCost: 0.06, lineCost: 6.00 },
      { ingredientId: 'ing_palm_sugar', quantity: 60, unitCost: 0.065, lineCost: 3.90 },
    ],
    laborCostPerPortion: 1.0,
    packagingCostPerPortion: 0.5,
    totalRawCost: 50.37,
    totalCostPerPortion: Number(((50.37 / 10) + 1.5).toFixed(2)), // ~6.54 ฿/portion
    targetFoodCostPct: 30,
    suggestedSellingPrice: 20,
    actualSellingPrice: 20,
    grossMarginPct: 67.3,
    instructions: 'ปั่นพริกขี้หนูสวนกับกระเทียมไทย ปรุงรสน้ำมะนาวแท้ น้ำปลา และน้ำตาลปี๊บจนละลายเข้ากัน เก็บในโถสุญญากาศ',
    updatedAt: new Date().toISOString(),
  },
  // Menu 1: กะเพราหมูสับราดข้าว (Pad Kra Pao Minced Pork)
  {
    id: 'rec_krapao_pork',
    nameTh: 'กะเพราหมูสับราดข้าวหอมมะลิ',
    nameEn: 'Pad Kra Pao Minced Pork Rice',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_pork_minced', quantity: 110, unitCost: 0.1684, lineCost: 18.52 },
      { ingredientId: 'ing_basil', quantity: 25, unitCost: 0.0571, lineCost: 1.43 },
      { ingredientId: 'ing_chili_prik_kee_noo', quantity: 15, unitCost: 0.1333, lineCost: 2.00 },
      { ingredientId: 'ing_garlic', quantity: 15, unitCost: 0.1059, lineCost: 1.59 },
      { ingredientId: 'ing_fish_sauce', quantity: 10, unitCost: 0.06, lineCost: 0.60 },
      { ingredientId: 'ing_jasmine_rice', quantity: 180, unitCost: 0.0196, lineCost: 3.53 },
    ],
    laborCostPerPortion: 4.5,
    packagingCostPerPortion: 2.0,
    totalRawCost: 27.67,
    totalCostPerPortion: 34.17,
    targetFoodCostPct: 35,
    suggestedSellingPrice: 75,
    actualSellingPrice: 65,
    grossMarginPct: Number((((65 - 34.17) / 65) * 100).toFixed(1)), // ~47.4%
    instructions: 'โขลกพริกกระเทียมพอหยาบ ผัดในกระทะไฟแรงจนหอม นำหมูสับลงผัด ปรุงรสน้ำปลาแท้ ใส่ใบกะเพราป่าตบท้าย เสิร์ฟราดข้าวหอมมะลิร้อนๆ',
    updatedAt: new Date().toISOString(),
  },
  // Menu 2: ข้าวผัดกุ้งสดโบราณ (Shrimp Fried Rice)
  {
    id: 'rec_shrimp_fried_rice',
    nameTh: 'ข้าวผัดกุ้งสดโบราณ',
    nameEn: 'Traditional Shrimp Fried Rice',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_shrimp', quantity: 80, unitCost: 0.3733, lineCost: 29.86 },
      { ingredientId: 'ing_egg', quantity: 1, unitCost: 4.5, lineCost: 4.50 },
      { ingredientId: 'ing_jasmine_rice', quantity: 200, unitCost: 0.0196, lineCost: 3.92 },
      { ingredientId: 'ing_garlic', quantity: 10, unitCost: 0.1059, lineCost: 1.06 },
      { ingredientId: 'ing_fish_sauce', quantity: 10, unitCost: 0.06, lineCost: 0.60 },
    ],
    laborCostPerPortion: 5.0,
    packagingCostPerPortion: 2.5,
    totalRawCost: 39.94,
    totalCostPerPortion: 47.44,
    targetFoodCostPct: 35,
    suggestedSellingPrice: 95,
    actualSellingPrice: 85,
    grossMarginPct: Number((((85 - 47.44) / 85) * 100).toFixed(1)), // ~44.2%
    instructions: 'ตั้งกระทะเหล็กให้ร้อนจัด ผัดกุ้งพอสุก ตอกไข่ยีให้ทั่ว ใส่ข้าวสวยค้างคืน ผัดด้วยไฟแรงให้เมล็ดข้าวดีดหอมกลิ่นกระทะ',
    updatedAt: new Date().toISOString(),
  },
  // Menu 3: ชาไทยเย็นพรีเมียม (Signature Thai Iced Tea)
  {
    id: 'rec_thai_tea',
    nameTh: 'ชาไทยเย็นพรีเมียมเข้มข้น',
    nameEn: 'Signature Thai Iced Tea',
    type: 'beverage',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_thai_tea_mix', quantity: 25, unitCost: 0.2375, lineCost: 5.94 },
      { ingredientId: 'ing_condensed_milk', quantity: 45, unitCost: 0.086, lineCost: 3.87 },
    ],
    laborCostPerPortion: 3.0,
    packagingCostPerPortion: 3.5,
    totalRawCost: 9.81,
    totalCostPerPortion: 16.31,
    targetFoodCostPct: 25,
    suggestedSellingPrice: 65,
    actualSellingPrice: 65,
    grossMarginPct: Number((((65 - 16.31) / 65) * 100).toFixed(1)), // ~74.9%
    instructions: 'สกัดใบชาด้วยน้ำร้อน 92 องศา ผสมนมข้นหวาน เทใส่น้ำแข็งหลอดเต็มแก้ว ราดนมสดด้านบน',
    updatedAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// 3. 4 POS Categories
// ---------------------------------------------------------------------------
export const SAMPLE_CATEGORIES: ProductCategory[] = [
  { id: 'cat_main', nameTh: 'จานหลัก / ผัดกะเพรา', nameEn: 'Main Dishes', icon: 'UtensilsCrossed', color: '#f97316', sortOrder: 1 },
  { id: 'cat_rice_noodle', nameTh: 'ข้าวผัด & อาหารจานเดียว', nameEn: 'Fried Rice & Specials', icon: 'Wheat', color: '#eab308', sortOrder: 2 },
  { id: 'cat_appetizer', nameTh: 'ทานเล่น & ซอสยำ', nameEn: 'Appetizers & Dips', icon: 'Flame', color: '#10b981', sortOrder: 3 },
  { id: 'cat_beverage', nameTh: 'เครื่องดื่ม & ชงสด', nameEn: 'Beverages', icon: 'Coffee', color: '#06b6d4', sortOrder: 4 },
];

// ---------------------------------------------------------------------------
// 4. Products linked with Modifiers (ความเผ็ด, ไข่ดาว +฿10, ไซซ์)
// ---------------------------------------------------------------------------
export const SAMPLE_PRODUCTS: Product[] = [
  // Product 1: กะเพราหมูสับราดข้าว
  {
    id: 'prod_krapao_pork',
    nameTh: 'กะเพราหมูสับราดข้าวหอมมะลิ',
    nameEn: 'Pad Kra Pao Minced Pork Rice',
    descriptionTh: 'ผัดกะเพราพริกแห้งใบกะเพราป่า หอมฉุนรสจัดจ้าน หมูสับอนามัยแท้ 100%',
    descriptionEn: 'Spicy stir-fried minced pork with Thai holy basil over jasmine rice',
    categoryId: 'cat_main',
    price: 65,
    cost: 34.17,
    recipeId: 'rec_krapao_pork',
    isAvailable: true,
    kitchenStation: 'kitchen',
    variants: [
      { id: 'var_std', nameTh: 'ธรรมดา', nameEn: 'Regular', priceDelta: 0 },
      { id: 'var_special', nameTh: 'พิเศษ (เพิ่มหมูสับ + ข้าว)', nameEn: 'Special (+Pork & Rice)', priceDelta: 20, costDelta: 10 },
    ],
    modifierGroups: [
      {
        id: 'mod_spicy',
        nameTh: 'ระดับความเผ็ด',
        nameEn: 'Spiciness Level',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: 'spicy_none', nameTh: 'ไม่เผ็ดเลย', nameEn: 'No Chili', priceDelta: 0 },
          { id: 'spicy_mild', nameTh: 'เผ็ดน้อย (พริก 1 เม็ด)', nameEn: 'Mild (1 Chili)', priceDelta: 0 },
          { id: 'spicy_norm', nameTh: 'เผ็ดปกติ (พริก 3 เม็ด)', nameEn: 'Medium (3 Chilies)', priceDelta: 0 },
          { id: 'spicy_hot', nameTh: 'เผ็ดจัดจ้าน (พริก 5 เม็ด)', nameEn: 'Extra Spicy', priceDelta: 0 },
        ],
      },
      {
        id: 'mod_egg',
        nameTh: 'ไข่ดาวเสริม',
        nameEn: 'Add Fried Egg',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'egg_none', nameTh: 'ไม่รับไข่ดาว', nameEn: 'No Egg', priceDelta: 0 },
          { id: 'egg_runny', nameTh: 'ไข่ดาวไม่สุก (ไข่แดงเยิ้ม)', nameEn: 'Sunny Side Up (Runny)', priceDelta: 10, costDelta: 4.5 },
          { id: 'egg_crispy', nameTh: 'ไข่ดาวกรอบสุก', nameEn: 'Crispy Fried Egg', priceDelta: 10, costDelta: 4.5 },
        ],
      },
    ],
  },
  // Product 2: ข้าวผัดกุ้งสดโบราณ
  {
    id: 'prod_shrimp_fried_rice',
    nameTh: 'ข้าวผัดกุ้งสดโบราณ',
    nameEn: 'Traditional Shrimp Fried Rice',
    descriptionTh: 'ข้าวผัดเม็ดร่วนหอมกลิ่นกระทะเหล็ก กุ้งขาวสดเนื้อเด้ง 3 ตัว',
    descriptionEn: 'Wok-fried jasmine rice with eggs and fresh white shrimp',
    categoryId: 'cat_rice_noodle',
    price: 85,
    cost: 47.44,
    recipeId: 'rec_shrimp_fried_rice',
    isAvailable: true,
    kitchenStation: 'kitchen',
    variants: [
      { id: 'var_std', nameTh: 'ธรรมดา (กุ้ง 3 ตัว)', nameEn: 'Regular (3 Prawns)', priceDelta: 0 },
      { id: 'var_special', nameTh: 'พิเศษ (กุ้ง 5 ตัว)', nameEn: 'Special (5 Prawns)', priceDelta: 30, costDelta: 15 },
    ],
    modifierGroups: [
      {
        id: 'mod_egg',
        nameTh: 'ไข่ดาวเสริม',
        nameEn: 'Add Fried Egg',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'egg_runny', nameTh: 'ไข่ดาวไม่สุก', nameEn: 'Sunny Side Up', priceDelta: 10, costDelta: 4.5 },
          { id: 'egg_crispy', nameTh: 'ไข่ดาวสุกกรอบ', nameEn: 'Crispy Fried Egg', priceDelta: 10, costDelta: 4.5 },
        ],
      },
    ],
  },
  // Product 3: น้ำจิ้มซีฟู้ดถ้วยเล็ก (Appetizer / Dip)
  {
    id: 'prod_seafood_dip',
    nameTh: 'น้ำจิ้มซีฟู้ดรสเด็ด (ถ้วยแยก)',
    nameEn: 'Spicy Seafood Dip Portion',
    descriptionTh: 'น้ำมะนาวแท้ พริกขี้หนูสวนสด รสแซ่บครบรส',
    descriptionEn: 'Fresh lime and bird\'s eye chili spicy dipping sauce',
    categoryId: 'cat_appetizer',
    price: 20,
    cost: 6.54,
    recipeId: 'rec_seafood_dip',
    isAvailable: true,
    kitchenStation: 'kitchen',
  },
  // Product 4: ชาไทยเย็นพรีเมียม
  {
    id: 'prod_thai_tea',
    nameTh: 'ชาไทยเย็นพรีเมียม',
    nameEn: 'Signature Thai Iced Tea',
    descriptionTh: 'ชาไทยใบชาคัดพิเศษ หอมกรุ่น นมข้นหวานมัน ชงสดทุกแก้ว',
    descriptionEn: 'Authentic Thai brewed iced tea with rich sweetened milk',
    categoryId: 'cat_beverage',
    price: 65,
    cost: 16.31,
    recipeId: 'rec_thai_tea',
    isAvailable: true,
    kitchenStation: 'bar',
    modifierGroups: [
      {
        id: 'mod_sweetness',
        nameTh: 'ระดับความหวาน',
        nameEn: 'Sweetness Level',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: 'sweet_100', nameTh: 'หวานปกติ (100%)', nameEn: 'Regular (100%)', priceDelta: 0 },
          { id: 'sweet_50', nameTh: 'หวานน้อย (50%)', nameEn: 'Less Sweet (50%)', priceDelta: 0 },
          { id: 'sweet_0', nameTh: 'ไม่หวานเลย (0%)', nameEn: 'Unsweetened (0%)', priceDelta: 0 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 5. 8 Tables in 2 Zones (Indoor 4 tables, Outdoor 4 tables)
// ---------------------------------------------------------------------------
export const SAMPLE_TABLES: RestaurantTable[] = [
  // Zone 1: Indoor (ห้องแอร์)
  { id: 'tbl_t1', name: 'T-01', zone: 'indoor', seats: 2, shape: 'square', x: 40, y: 40, w: 75, h: 75, status: 'empty' },
  { id: 'tbl_t2', name: 'T-02', zone: 'indoor', seats: 4, shape: 'rect', x: 160, y: 40, w: 105, h: 70, status: 'empty' },
  { id: 'tbl_t3', name: 'T-03', zone: 'indoor', seats: 4, shape: 'round', x: 310, y: 35, w: 80, h: 80, status: 'empty' },
  { id: 'tbl_t4', name: 'T-04', zone: 'indoor', seats: 6, shape: 'booth', x: 430, y: 40, w: 110, h: 85, status: 'empty' },
  { id: 'tbl_b1', name: 'Bar-01', zone: 'indoor', seats: 4, shape: 'bar', x: 40, y: 175, w: 150, h: 50, status: 'empty' },
  { id: 'tbl_t5', name: 'T-05', zone: 'indoor', seats: 4, shape: 'rect', x: 230, y: 165, w: 105, h: 70, status: 'empty' },
  // Zone 2: Outdoor (ระเบียงสวน)
  { id: 'tbl_o1', name: 'O-01', zone: 'outdoor', seats: 2, shape: 'round', x: 40, y: 40, w: 75, h: 75, status: 'empty' },
  { id: 'tbl_o2', name: 'O-02', zone: 'outdoor', seats: 4, shape: 'square', x: 160, y: 40, w: 80, h: 80, status: 'empty' },
  { id: 'tbl_o3', name: 'O-03', zone: 'outdoor', seats: 4, shape: 'rect', x: 290, y: 40, w: 105, h: 70, status: 'empty' },
  { id: 'tbl_o4', name: 'O-04', zone: 'outdoor', seats: 6, shape: 'booth', x: 440, y: 40, w: 115, h: 85, status: 'empty' },
];

// ---------------------------------------------------------------------------
// 6. 2 Promotions
// ---------------------------------------------------------------------------
export const SAMPLE_PROMOTIONS: Promotion[] = [
  {
    id: 'promo_lunch_10',
    code: 'LUNCH10',
    nameTh: 'ส่วนลดมื้อกลางวัน 10%',
    nameEn: 'Lunch Special 10% Off',
    type: 'percent',
    value: 10,
    minSpend: 200,
    isActive: true,
  },
  {
    id: 'promo_grand_50',
    code: 'TONY50',
    nameTh: 'คูปองฉลองเปิดร้าน ลด ฿50',
    nameEn: 'Grand Opening ฿50 Off',
    type: 'amount',
    value: 50,
    minSpend: 300,
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// 7. 3 Members
// ---------------------------------------------------------------------------
export const SAMPLE_MEMBERS: Member[] = [
  {
    id: 'mem_1',
    code: 'TK-1001',
    name: 'คุณสมชาย ใจดี',
    phone: '0812345678',
    points: 120,
    tier: 'gold',
    totalSpent: 4850,
    visitCount: 6,
    notes: 'ชอบนั่งโต๊ะ T-01 ทานเผ็ดปกติ ชอบไข่ดาวไม่สุก',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem_2',
    code: 'TK-1002',
    name: 'คุณพัชรา วิเศษสุข',
    phone: '0898765432',
    points: 45,
    tier: 'silver',
    totalSpent: 1800,
    visitCount: 2,
    notes: 'ชอบสั่งชาไทยหวานน้อย 50%',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem_3',
    code: 'TK-1003',
    name: 'คุณอานนท์ มั่นคง',
    phone: '0861112233',
    points: 20,
    tier: 'bronze',
    totalSpent: 750,
    visitCount: 1,
    notes: 'ลูกค้าประจำสั่งผ่าน Grab และหน้าร้าน',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// 8. Sample Expenses (Daily + Recurring)
// ---------------------------------------------------------------------------
export const SAMPLE_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    title: 'ซื้อผักสดและเนื้อหมู ตลาดสี่มุมเมือง',
    category: 'ค่าวัตถุดิบเพิ่มเติม',
    categoryId: 'ค่าวัตถุดิบเพิ่มเติม',
    amount: 1450,
    paymentMethod: 'promptpay',
    notes: 'หมูสับ ใบกะเพรา พริกขี้หนู มะนาว',
  },
  {
    id: 'exp_2',
    date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    title: 'ค่าน้ำแข็งหลอดบริสุทธิ์',
    category: 'อื่นๆ',
    categoryId: 'อื่นๆ',
    amount: 240,
    paymentMethod: 'cash',
  },
  {
    id: 'exp_3',
    date: new Date(Date.now() - 8 * 86400000).toISOString().split('T')[0],
    title: 'แก๊สหุงต้ม ปตท. 15 กิโลกรัม',
    category: 'ค่าแก๊ส',
    categoryId: 'ค่าแก๊ส',
    amount: 430,
    paymentMethod: 'cash',
  },
];

export const SAMPLE_RECURRING_EXPENSES: RecurringExpense[] = [
  {
    id: 'rec_rent',
    name: 'ค่าเช่าพื้นที่ร้าน (รายเดือน)',
    categoryId: 'ค่าเช่า',
    amountPerMonth: 15000,
    dayOfMonth: 1,
    startDate: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
  },
  {
    id: 'rec_salary',
    name: 'เงินเดือนผู้ช่วยเชฟ',
    categoryId: 'เงินเดือน/ค่าแรง',
    amountPerMonth: 12000,
    dayOfMonth: 28,
    startDate: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
  },
  {
    id: 'rec_wifi',
    name: 'ค่าอินเทอร์เน็ตไฟเบอร์ POS',
    categoryId: 'ค่าน้ำ-ไฟ',
    amountPerMonth: 799,
    dayOfMonth: 15,
    startDate: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
  },
];

// ---------------------------------------------------------------------------
// 9. ~30 Sample Paid Bills across past 14 days (with cost snapshots)
// ---------------------------------------------------------------------------
export function generate30SampleBills(): Order[] {
  const bills: Order[] = [];
  const now = Date.now();
  const ONE_DAY = 86400000;

  // Configuration of templates for items
  const krapaoLine: OrderLine = {
    id: 'line_krapao',
    productId: 'prod_krapao_pork',
    productNameTh: 'กะเพราหมูสับราดข้าวหอมมะลิ',
    productNameEn: 'Pad Kra Pao Minced Pork Rice',
    basePrice: 65,
    unitPrice: 75, // +ไข่ดาว ฿10
    unitCost: 34.17 + 4.5,
    unitCostSnapshot: 38.67,
    quantity: 1,
    qty: 1,
    lineTotal: 75,
    kitchenStatus: 'served',
    kitchenStation: 'kitchen',
    orderedAt: new Date().toISOString(),
    selectedModifiers: [
      { id: 'spicy_norm', nameTh: 'เผ็ดปกติ', nameEn: 'Medium', priceDelta: 0 },
      { id: 'egg_runny', nameTh: 'ไข่ดาวไม่สุก', nameEn: 'Sunny Side Up', priceDelta: 10 },
    ],
  };

  const friedRiceLine: OrderLine = {
    id: 'line_fried_rice',
    productId: 'prod_shrimp_fried_rice',
    productNameTh: 'ข้าวผัดกุ้งสดโบราณ',
    productNameEn: 'Traditional Shrimp Fried Rice',
    basePrice: 85,
    unitPrice: 85,
    unitCost: 47.44,
    unitCostSnapshot: 47.44,
    quantity: 1,
    qty: 1,
    lineTotal: 85,
    kitchenStatus: 'served',
    kitchenStation: 'kitchen',
    orderedAt: new Date().toISOString(),
  };

  const thaiTeaLine: OrderLine = {
    id: 'line_tea',
    productId: 'prod_thai_tea',
    productNameTh: 'ชาไทยเย็นพรีเมียม',
    productNameEn: 'Signature Thai Iced Tea',
    basePrice: 65,
    unitPrice: 65,
    unitCost: 16.31,
    unitCostSnapshot: 16.31,
    quantity: 1,
    qty: 1,
    lineTotal: 65,
    kitchenStatus: 'served',
    kitchenStation: 'bar',
    orderedAt: new Date().toISOString(),
  };

  const dipLine: OrderLine = {
    id: 'line_dip',
    productId: 'prod_seafood_dip',
    productNameTh: 'น้ำจิ้มซีฟู้ดรสเด็ด (ถ้วยแยก)',
    productNameEn: 'Spicy Seafood Dip',
    basePrice: 20,
    unitPrice: 20,
    unitCost: 6.54,
    unitCostSnapshot: 6.54,
    quantity: 1,
    qty: 1,
    lineTotal: 20,
    kitchenStatus: 'served',
    kitchenStation: 'kitchen',
    orderedAt: new Date().toISOString(),
  };

  // Generate 32 realistic orders distributed across past 14 days
  // 14 days, ~2-3 orders per day
  let billCounter = 101;

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersTodayCount = dayOffset === 0 ? 3 : dayOffset % 2 === 0 ? 3 : 2;

    for (let i = 0; i < ordersTodayCount; i++) {
      billCounter++;
      const hour = 11 + i * 3; // 11:00, 14:00, 17:00, 20:00
      const minute = 15 + (billCounter % 40);
      const billTime = new Date(now - dayOffset * ONE_DAY);
      billTime.setHours(hour, minute, 0, 0);
      const isoTime = billTime.toISOString();

      // Variations in order patterns
      let orderType: 'dine_in' | 'takeaway' | 'delivery' = 'dine_in';
      let tableName = `T-0${(billCounter % 4) + 1}`;
      let paymentMethod: 'cash' | 'promptpay' | 'card' = 'promptpay';
      let platformId: string | undefined = undefined;

      if (billCounter % 5 === 0) {
        orderType = 'delivery';
        tableName = 'Grab';
        platformId = 'grab';
        paymentMethod = 'card';
      } else if (billCounter % 7 === 0) {
        orderType = 'delivery';
        tableName = 'LINE MAN';
        platformId = 'lineman';
        paymentMethod = 'promptpay';
      } else if (billCounter % 4 === 0) {
        orderType = 'takeaway';
        tableName = 'Takeaway';
        paymentMethod = 'cash';
      } else if (billCounter % 3 === 0) {
        tableName = `O-0${(billCounter % 4) + 1}`;
        paymentMethod = 'card';
      }

      // Mix items
      const items: OrderLine[] = [];
      if (billCounter % 2 === 0) {
        items.push({ ...krapaoLine, id: `item_${billCounter}_1`, orderedAt: isoTime });
        items.push({ ...thaiTeaLine, id: `item_${billCounter}_2`, orderedAt: isoTime });
      } else if (billCounter % 3 === 0) {
        items.push({ ...friedRiceLine, id: `item_${billCounter}_1`, orderedAt: isoTime });
        items.push({ ...dipLine, id: `item_${billCounter}_2`, orderedAt: isoTime });
        items.push({ ...thaiTeaLine, id: `item_${billCounter}_3`, orderedAt: isoTime });
      } else {
        items.push({ ...krapaoLine, id: `item_${billCounter}_1`, quantity: 2, qty: 2, lineTotal: 150, orderedAt: isoTime });
        items.push({ ...thaiTeaLine, id: `item_${billCounter}_2`, quantity: 2, qty: 2, lineTotal: 130, orderedAt: isoTime });
      }

      const subtotal = items.reduce((sum, item) => sum + (item.lineTotal || (item.unitPrice || 0) * (item.quantity || 1)), 0);
      const discount = (billCounter % 6 === 0) ? 20 : 0;
      const netAfterDiscount = subtotal - discount;
      const vatAmount = Number(((netAfterDiscount * 7) / 107).toFixed(2));
      const totalCost = items.reduce((sum, item) => sum + ((item.unitCostSnapshot || item.unitCost) * (item.quantity || 1)), 0);
      const grossProfit = Number((netAfterDiscount - totalCost).toFixed(2));

      bills.push({
        id: `ord_seed_${billCounter}`,
        orderNumber: `#TK-${billCounter}`,
        tableName,
        tableId: tableName.startsWith('T') ? 'tbl_t1' : tableName.startsWith('O') ? 'tbl_o1' : undefined,
        orderType,
        mode: orderType === 'dine_in' ? 'table' : 'pay-now',
        status: 'paid',
        guestCount: (billCounter % 3) + 1,
        items,
        lines: items,
        subtotal,
        discountAmount: discount,
        discountTotal: discount,
        vatAmount,
        serviceChargeAmount: 0,
        totalAmount: netAfterDiscount,
        totalCost: Number(totalCost.toFixed(2)),
        grossProfit,
        paymentMethod,
        platformId,
        createdAt: isoTime,
        paidAt: isoTime,
        shiftId: 'shift_init',
        source: platformId ? 'online' : 'pos',
      });
    }
  }

  return bills;
}

export {
  SAMPLE_SETTINGS as DEFAULT_SETTINGS,
  SAMPLE_CATEGORIES as INITIAL_CATEGORIES,
  SAMPLE_INGREDIENTS as INITIAL_INGREDIENTS,
  SAMPLE_RECIPES as INITIAL_RECIPES,
  SAMPLE_PRODUCTS as INITIAL_PRODUCTS,
  SAMPLE_TABLES as INITIAL_TABLES,
  SAMPLE_PROMOTIONS as INITIAL_PROMOTIONS,
  SAMPLE_MEMBERS as INITIAL_MEMBERS,
  SAMPLE_EXPENSES as INITIAL_EXPENSES,
};
