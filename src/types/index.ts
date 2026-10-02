/**
 * Shared Data Model for Tony's Kitchen
 * Section 4 Canonical Shared Data Model (TypeScript, strict, avoid any)
 */

export type Language = 'th' | 'en';

// ---------------------------------------------------------------------------
// Food Cost Entities
// ---------------------------------------------------------------------------

export type UnitType = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'piece' | 'can' | 'bottle' | 'pack' | 'box';

export interface CustomUnit {
  name: string;
  baseUnitsPer: number;
}

export interface PriceHistoryEntry {
  date: string; // ISO date
  price: number; // purchasePrice+purchaseQty snapshot or normalized
  note?: string;
}

/**
 * Ingredient
 * { id, name, category, supplier?, note?, purchaseUnit, purchaseQty (default 1),
 *   purchasePrice, baseUnit ("g"|"ml"|"pcs"), baseUnitsPerPurchaseUnit,
 *   yieldPercent (default 100, 1–100), customUnits: [{name, baseUnitsPer}],
 *   priceHistory: [{date ISO, price (purchasePrice+purchaseQty snapshot or normalized), note?}] }
 */
export interface Ingredient {
  id: string;
  name?: string;
  nameTh: string;
  nameEn: string;
  category: string;
  supplier?: string;
  note?: string;
  notes?: string;
  purchaseUnit: UnitType;
  purchaseQty?: number; // default 1
  purchasePrice: number;
  baseUnit?: 'g' | 'ml' | 'pcs' | UnitType;
  baseUnitsPerPurchaseUnit?: number;
  yieldPercent?: number; // default 100, 1–100
  yieldPercentage: number;
  customUnits?: CustomUnit[];
  priceHistory?: PriceHistoryEntry[];

  // App specific inventory & cost fields
  packSize: number;
  usageUnit: UnitType;
  unitCost: number;
  currentStock: number;
  minStock: number;
  minStockAlert?: number;
  updatedAt: string;
}

export type RecipeType = 'menu' | 'sub' | 'dish' | 'sauce' | 'beverage' | 'sub_recipe';

export interface RecipeIngredient {
  id: string;
  sourceType: 'ingredient' | 'recipe';
  sourceId: string;
  qty: number;
  unit: string;
  yieldOverridePercent?: number;
}

export interface ExtraCost {
  id: string;
  name: string;
  amount: number;
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
}

/**
 * Recipe
 * { id, name, type ("menu"|"sub"), category,
 *   ingredients: [{id, sourceType ("ingredient"|"recipe"), sourceId, qty, unit, yieldOverridePercent?}],
 *   outputQty/outputUnit (REQUIRED for "sub"; for "menu" = 1 serving),
 *   extraCosts: [{id,name,amount}], overheadPercentOverride?, targetFoodCostOverride?,
 *   sellPrice, deliveryPrices: {[platformId]: number}, note? }
 */
export interface Recipe {
  id: string;
  name?: string;
  nameTh: string;
  nameEn: string;
  type: RecipeType;
  category?: string;
  ingredients?: RecipeIngredient[];
  outputQty?: number; // REQUIRED for "sub"; for "menu" = 1 serving
  outputUnit?: string;
  extraCosts?: ExtraCost[];
  overheadPercentOverride?: number;
  targetFoodCostOverride?: number;
  sellPrice?: number;
  deliveryPrices?: Record<string, number>;
  note?: string;

  // App specific / computed fields
  portionsYield: number;
  items: RecipeItem[];
  laborCostPerPortion: number;
  packagingCostPerPortion: number;
  totalRawCost: number;
  totalCostPerPortion: number;
  targetFoodCostPct: number;
  suggestedSellingPrice: number;
  actualSellingPrice: number;
  grossMarginPct: number;
  instructions?: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Settings (shared by both modules)
// ---------------------------------------------------------------------------

export interface VatSettings {
  enabled: boolean;
  ratePercent: number; // e.g. 7
  priceIncludesVat: boolean;
}

export interface ServiceChargeSettings {
  enabled: boolean;
  ratePercent: number; // e.g. 10
  countAsRevenue: boolean;
}

export interface PlatformConfig {
  id: string;
  name: string;
  gpPercent: number; // e.g. 30
  gpHasVat: boolean;
}

export interface ReceiptSettings {
  shopAddress?: string;
  phone?: string;
  taxId?: string;
  footerText?: string;
  paperWidthMm: 58 | 80;
}

export interface PrinterStation {
  id: string;
  name: string;
  paperWidthMm: number;
}

export interface PaymentMethodConfig {
  id: string;
  type: 'cash' | 'promptpay' | 'card' | 'wallet';
  name: string;
  enabled: boolean;
}

export interface LoyaltySettings {
  enabled: boolean;
  spendPerPoint: number; // 25
  bahtPerPoint: number; // 1
  minRedeemPoints: number; // 10
}

/**
 * Settings (shared by both modules)
 * { shopName ("Tony's Kitchen"), language ("th"|"en"), defaultTargetFoodCostPercent (30),
 *   defaultOverheadPercent (0), vat {enabled, ratePercent 7, priceIncludesVat},
 *   serviceCharge {enabled, ratePercent 10, countAsRevenue false},
 *   platforms [{id,name,gpPercent 30,gpHasVat false}] defaulting to Grab, LINE MAN, Foodpanda,
 *   priceRounding (1|5|10), ingredientCategories, recipeCategories, lastBackupAt?,
 *   plus POS settings: promptPayId, receipt, printerStations, paymentMethods, loyalty, defaultOrderMode? }
 */
export interface Settings {
  id?: string;
  shopName: string; // "Tony's Kitchen"
  language: Language;
  defaultTargetFoodCostPercent: number; // 30
  defaultOverheadPercent: number; // 0
  vat: VatSettings;
  serviceCharge: ServiceChargeSettings;
  platforms: PlatformConfig[];
  priceRounding: 1 | 5 | 10;
  ingredientCategories: string[];
  recipeCategories: string[];
  lastBackupAt?: string;
  promptPayId?: string;
  receipt: ReceiptSettings;
  printerStations: PrinterStation[];
  paymentMethods: PaymentMethodConfig[];
  loyalty: LoyaltySettings;
  defaultOrderMode?: 'table' | 'pay-now';
}

export interface RestaurantSettings {
  id: string;
  restaurantNameTh: string;
  restaurantNameEn: string;
  name?: string;
  shopName?: string;
  tagline: string;
  addressTh: string;
  addressEn: string;
  address?: string;
  phone: string;
  taxId: string;
  promptPayId: string;
  promptPayName: string;
  currency: string;
  vatEnabled: boolean;
  vatRate: number;
  vatInclusive: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  serviceChargeCountAsRevenue?: boolean;
  receiptHeaderMessage: string;
  receiptFooterMessage: string;
  receiptWidth: '58mm' | '80mm';
  language: Language;
  defaultTableZone: string;
  soundEnabled: boolean;
  // Food cost & operations settings
  defaultTargetFoodCostPercent?: number;
  defaultOverheadPercent?: number;
  priceRounding?: 1 | 5 | 10;
  platforms?: PlatformConfig[];
  ingredientCategories?: string[];
  recipeCategories?: string[];
  expenseCategories?: string[];
  printerStations?: PrinterStation[];
  paymentMethods?: PaymentMethodConfig[];
  loyalty?: LoyaltySettings;
  lastBackupAt?: string;
  textSize?: 'normal' | 'large' | 'xlarge'; // ปกติ (100%) / ใหญ่ (115%, default) / ใหญ่มาก (130%)
  // Shared sub-objects for calc module
  vat?: VatSettings;
  serviceCharge?: ServiceChargeSettings;
  receipt?: ReceiptSettings;
}

// ---------------------------------------------------------------------------
// POS Entities
// ---------------------------------------------------------------------------

/**
 * PosCategory
 * { id, name{th,en}, icon?, sortOrder }
 */
export interface PosCategory {
  id: string;
  name?: { th: string; en: string } | string;
  nameTh: string;
  nameEn: string;
  icon?: string;
  color?: string;
  sortOrder: number;
}

export type ProductCategory = PosCategory;

/**
 * PosGroup (optional sub-grid tile inside a category, e.g. "Delivery >")
 * { id, categoryId, name{th,en}, imageId?, sortOrder }
 */
export interface PosGroup {
  id: string;
  categoryId: string;
  name: { th: string; en: string };
  nameTh?: string;
  nameEn?: string;
  imageId?: string;
  sortOrder: number;
}

export interface ModifierOption {
  id: string;
  name?: string;
  nameTh: string;
  nameEn: string;
  priceDelta: number; // ฿, default 0
}

export type ProductModifierOption = ModifierOption;

/**
 * ModifierGroup
 * { id, name, required, multiSelect, options: [{id, name, priceDelta (฿, default 0)}] }
 */
export interface ModifierGroup {
  id: string;
  name?: string;
  nameTh: string;
  nameEn: string;
  required?: boolean;
  multiSelect?: boolean;
  options: ModifierOption[];
  minSelect?: number;
  maxSelect?: number;
}

export type ProductModifierGroup = ModifierGroup;

export interface ProductVariant {
  id: string;
  nameTh: string;
  nameEn: string;
  priceDelta: number;
  costDelta?: number;
}

/**
 * Product (POS product, linked 1:1 to a menu Recipe of type "menu")
 * { id, recipeId, categoryId, imageId?, stationId (printer station),
 *   modifierGroups: ModifierGroup[], available (bool), sortOrder, nameEn? }
 */
export interface Product {
  id: string;
  recipeId?: string;
  categoryId: string;
  imageId?: string;
  stationId?: string;
  modifierGroups?: ModifierGroup[];
  available?: boolean;
  isAvailable: boolean;
  sortOrder?: number;
  nameEn: string;
  nameTh: string;
  name?: string;
  descriptionTh?: string;
  descriptionEn?: string;
  price: number;
  cost: number;
  image?: string;
  barcode?: string;
  kitchenStation: 'kitchen' | 'bar' | 'grill' | 'dessert';
  variants?: ProductVariant[];
  tags?: string[];
  groupId?: string;
  groupName?: string;
}

export type TableShape = 'rect' | 'round';
export type TableStatus = 'empty' | 'occupied' | 'billing' | 'reserved';

/**
 * Table & Zone
 * Table: { id, name, zoneId, shape ("rect"|"round"), x, y, w, h, seats, mergedInto? }
 * Zone: { id, name, sortOrder }
 */
export interface Table {
  id: string;
  name: string;
  zoneId?: string;
  shape?: TableShape;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  seats: number;
  mergedInto?: string;
  // App specific table view properties
  zone: 'indoor' | 'outdoor' | 'aircon' | 'bar' | 'vip' | string;
  status: TableStatus;
  currentOrderId?: string;
  openedAt?: string;
  guestCount?: number;
}

export type RestaurantTable = Table;

export interface Zone {
  id: string;
  name: string;
  sortOrder: number;
}

export type OrderType = 'dine-in' | 'takeaway' | 'delivery' | 'dine_in';
export type OrderMode = 'table' | 'pay-now';
export type OrderStatus = 'open' | 'paid' | 'cancelled' | 'kitchen_preparing' | 'served';
export type KitchenStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'preparing';
export type DeliveryPlatform = 'grab' | 'lineman' | 'shopeefood' | 'foodpanda' | 'robinhood' | 'direct';

export interface OrderModifierSnapshot {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

/**
 * OrderLine
 * { id, productId, recipeId, name (snapshot), qty, unitPrice (snapshot at time of sale),
 *   unitCostSnapshot (ingredient cost per serving at time of sale),
 *   modifiers: [{groupName, optionName, priceDelta}], note?, sentToKitchenAt?, stationId, sortOrder, voided? }
 */
export interface OrderLine {
  id: string;
  productId: string;
  recipeId?: string;
  name?: string;
  productNameTh: string;
  productNameEn: string;
  productName?: string;
  qty?: number;
  quantity: number;
  unitPrice?: number;
  basePrice: number;
  unitCost: number;
  unitCostSnapshot?: number;
  lineTotal: number;
  subtotal?: number;
  modifiers?: OrderModifierSnapshot[];
  selectedModifiers?: ProductModifierOption[];
  selectedVariant?: ProductVariant;
  variantName?: string;
  note?: string;
  notes?: string;
  sentToKitchenAt?: string;
  stationId?: string;
  kitchenStation: 'kitchen' | 'bar' | 'grill' | 'dessert';
  kitchenStatus: KitchenStatus;
  sortOrder?: number;
  orderedAt: string;
  voided?: boolean;
}

export type OrderItem = OrderLine;

export type PaymentMethod = 'cash' | 'promptpay' | 'card' | 'wallet' | 'credit_card' | 'transfer' | 'qr_code';

/**
 * Payment
 * { id, methodId, type, amount, tendered? (cash), change?, paidAt }
 */
export interface Payment {
  id: string;
  methodId?: string;
  type?: 'cash' | 'promptpay' | 'card' | 'wallet' | string;
  amount: number;
  tendered?: number; // cash
  change?: number;
  paidAt?: string;
  method?: string;
  time?: string;
}

export interface AppliedDiscount {
  id: string;
  type: 'percent' | 'amount' | 'bogo' | 'coupon' | 'happy-hour' | 'bill-discount';
  name: string;
  amount: number;
  promotionId?: string;
  couponCode?: string;
}

/**
 * Order
 * { id, billNo (sequential, per year), type ("dine-in"|"takeaway"|"delivery"),
 *   mode ("table"|"pay-now"), tableIds[] (supports merged tables), queueNo? (pay-now),
 *   platformId? (delivery), memberId?, lines: OrderLine[], status ("open"|"paid"|"cancelled"),
 *   createdAt, paidAt?, shiftId?, discounts: AppliedDiscount[], payments: Payment[],
 *   pointsEarned?, pointsRedeemed?, source ("pos"|"online"), note? }
 */
export interface Order {
  id: string;
  orderNumber: string;
  billNo?: string;
  type?: OrderType;
  orderType: OrderType;
  mode?: OrderMode;
  tableId?: string;
  tableName?: string;
  tableIds?: string[];
  queueNo?: number | string;
  platformId?: string;
  deliveryPlatform?: DeliveryPlatform;
  deliveryReference?: string;
  customerName?: string;
  customerPhone?: string;
  guestCount: number;
  lines?: OrderLine[];
  items: OrderItem[];
  status: OrderStatus;
  kitchenStatus?: KitchenStatus;
  subtotal: number;
  totalAmount: number;
  netTotal?: number;
  totalCost: number;
  grossProfit: number;
  discounts?: AppliedDiscount[];
  payments?: Payment[];
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  discountAmount: number;
  discountTotal?: number;
  promotionId?: string;
  promotionName?: string;
  memberId?: string;
  memberName?: string;
  memberPhone?: string;
  memberPointsEarned?: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  vatAmount: number;
  taxTotal?: number;
  serviceChargeAmount: number;
  serviceChargeTotal?: number;
  paymentMethod?: PaymentMethod;
  cashReceived?: number;
  cashChange?: number;
  createdAt: string;
  paidAt?: string;
  shiftId?: string;
  source?: 'pos' | 'online';
  onlineStatus?: 'new' | 'accepted' | 'rejected';
  note?: string;
  notes?: string;
}

/**
 * Member
 * { id, phone (unique, primary lookup), name, points, totalSpent, createdAt, note? }
 */
export interface Member {
  id: string;
  phone: string;
  name: string;
  points: number;
  totalSpent: number;
  createdAt: string;
  note?: string;
  notes?: string;
  code: string;
  tier: 'bronze' | 'silver' | 'gold' | 'vip' | 'platinum';
  visitCount: number;
  updatedAt: string;
}

export type PromotionType = 'happy-hour' | 'bogo' | 'bill-discount' | 'coupon';

/**
 * Promotion
 * { id, name, type ("happy-hour"|"bogo"|"bill-discount"|"coupon"), enabled,
 *   active days/time window (for happy-hour), discountKind ("percent"|"amount"),
 *   value, applicableProductIds/categoryIds (happy-hour & bogo), couponCode? (coupon),
 *   minSpend?, startDate?, endDate? }
 */
export interface Promotion {
  id: string;
  code: string;
  name?: string;
  nameTh: string;
  nameEn: string;
  type: PromotionType | 'percent' | 'amount';
  enabled?: boolean;
  isActive: boolean;
  activeDays?: number[];
  activeStartTime?: string;
  activeEndTime?: string;
  discountKind?: 'percent' | 'amount';
  value: number;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  couponCode?: string;
  minSpend?: number;
  startDate?: string;
  endDate?: string;
  validUntil?: string;
}

/**
 * Shift
 * { id, openedAt, closedAt?, openingCash, countedCash?, expectedCash?, difference?, note? }
 */
export interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCash?: number;
  startingCash: number;
  countedCash?: number;
  expectedCash: number;
  difference?: number;
  cashDifference?: number;
  note?: string;
  notes?: string;
  shiftNumber: number;
  cashSales: number;
  promptpaySales: number;
  cardSales: number;
  totalSales: number;
  totalOrders: number;
  actualCash?: number;
  status: 'open' | 'closed';
}

export type ExpenseCategory =
  | 'raw_materials'
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'packaging'
  | 'gas_electric'
  | 'marketing'
  | 'maintenance'
  | 'other';

/**
 * Expense
 * { id, date, categoryId, amount, note?, recurringId? }
 */
export interface Expense {
  id: string;
  date: string;
  categoryId?: string;
  category: ExpenseCategory | string;
  amount: number;
  title: string;
  paymentMethod: string;
  note?: string;
  notes?: string;
  recurringId?: string;
}

/**
 * RecurringExpense
 * { id, categoryId, name, amountPerMonth, dayOfMonth, startDate, endDate? }
 */
export interface RecurringExpense {
  id: string;
  categoryId: string;
  name: string;
  amountPerMonth: number;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
}

/**
 * OnlineOrderInbox
 * Reuses Order with source: "online", status: "open", plus onlineStatus ("new"|"accepted"|"rejected")
 */
export interface OnlineOrderInbox extends Order {
  source: 'online';
  status: 'open';
  onlineStatus: 'new' | 'accepted' | 'rejected';
}

export interface AppMetadata {
  schemaVersion: number;
  lastBackupAt?: string;
  initializedAt?: string;
}

// ---------------------------------------------------------------------------
// Default Categories & Preset Constants as defined in Section 4
// ---------------------------------------------------------------------------

export const DEFAULT_INGREDIENT_CATEGORIES = [
  'เนื้อสัตว์',
  'อาหารทะเล',
  'ผัก/ผลไม้',
  'เครื่องปรุง',
  'ของแห้ง/แป้ง',
  'เครื่องดื่ม',
  'บรรจุภัณฑ์',
  'อื่นๆ',
] as const;

export const DEFAULT_RECIPE_CATEGORIES = [
  'จานหลัก',
  'ของทานเล่น',
  'เครื่องดื่ม',
  'ของหวาน',
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'ค่าเช่า',
  'เงินเดือน/ค่าแรง',
  'ค่าน้ำ-ไฟ',
  'ค่าแก๊ส',
  'การตลาด',
  'ซ่อมบำรุง',
  'อื่นๆ',
] as const;

export const DEFAULT_PRINTER_STATIONS: PrinterStation[] = [
  { id: 'station_kitchen', name: 'ครัว/Kitchen', paperWidthMm: 80 },
  { id: 'station_bar', name: 'บาร์/Bar', paperWidthMm: 80 },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pm_cash', type: 'cash', name: 'เงินสด', enabled: true },
  { id: 'pm_promptpay', type: 'promptpay', name: 'PromptPay QR', enabled: true },
  { id: 'pm_card', type: 'card', name: 'บัตรเครดิต', enabled: true },
  { id: 'pm_wallet', type: 'wallet', name: 'กระเป๋าดิจิทัล', enabled: true },
];

export const DEFAULT_DELIVERY_PLATFORMS: PlatformConfig[] = [
  { id: 'grab', name: 'Grab', gpPercent: 30, gpHasVat: false },
  { id: 'lineman', name: 'LINE MAN', gpPercent: 30, gpHasVat: false },
  { id: 'foodpanda', name: 'Foodpanda', gpPercent: 30, gpHasVat: false },
];
