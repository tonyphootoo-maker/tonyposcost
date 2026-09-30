import { openDB, IDBPDatabase } from 'idb';
import {
  RestaurantSettings,
  Ingredient,
  Recipe,
  ProductCategory,
  Product,
  RestaurantTable,
  Order,
  Shift,
  Member,
  Promotion,
  Expense,
  AppMetadata,
} from '../types';

const DB_NAME = 'tonys-kitchen';
const DB_VERSION = 1;

export type DBStoreName =
  | 'settings'
  | 'ingredients'
  | 'recipes'
  | 'categories'
  | 'products'
  | 'tables'
  | 'orders'
  | 'shifts'
  | 'members'
  | 'promotions'
  | 'expenses'
  | 'meta';

type ToastListener = (type: 'error' | 'success' | 'info', messageTh: string, messageEn: string) => void;
const toastListeners: Set<ToastListener> = new Set();

export function subscribeToDBToasts(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function notifyToast(type: 'error' | 'success' | 'info', messageTh: string, messageEn: string) {
  toastListeners.forEach((listener) => {
    try {
      listener(type, messageTh, messageEn);
    } catch {
      // Ignore listener errors
    }
  });
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, _transaction) {
        // Create stores if they do not exist
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ingredients')) {
          db.createObjectStore('ingredients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recipes')) {
          db.createObjectStore('recipes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('by-createdAt', 'createdAt');
          orderStore.createIndex('by-shiftId', 'shiftId');
          orderStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('shifts')) {
          const shiftStore = db.createObjectStore('shifts', { keyPath: 'id' });
          shiftStore.createIndex('by-openedAt', 'openedAt');
          shiftStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('members')) {
          const memberStore = db.createObjectStore('members', { keyPath: 'id' });
          memberStore.createIndex('by-phone', 'phone', { unique: false });
        }
        if (!db.objectStoreNames.contains('promotions')) {
          db.createObjectStore('promotions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('by-date', 'date');
          expenseStore.createIndex('by-category', 'category');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' });
        }
      },
    });

    // Request persistent storage
    if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {
        // Ignore persist failure
      });
    }
  }
  return dbPromise;
}

export async function dbGet<T>(storeName: DBStoreName, key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return (await db.get(storeName, key)) as T;
  } catch (error) {
    console.error(`[DB Error] get on ${storeName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการโหลดข้อมูล (${storeName})`, `Database load error (${storeName})`);
    return undefined;
  }
}

export async function dbGetAll<T>(storeName: DBStoreName): Promise<T[]> {
  try {
    const db = await getDB();
    return (await db.getAll(storeName)) as T[];
  } catch (error) {
    console.error(`[DB Error] getAll on ${storeName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการดึงข้อมูลทั้งหมด (${storeName})`, `Failed to get records (${storeName})`);
    return [];
  }
}

export async function dbPut<T>(storeName: DBStoreName, value: T): Promise<boolean> {
  try {
    const db = await getDB();
    await db.put(storeName, value);
    return true;
  } catch (error) {
    console.error(`[DB Error] put on ${storeName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการบันทึกข้อมูล (${storeName})`, `Failed to save record (${storeName})`);
    return false;
  }
}

export async function dbDelete(storeName: DBStoreName, key: string): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete(storeName, key);
    return true;
  } catch (error) {
    console.error(`[DB Error] delete on ${storeName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการลบข้อมูล (${storeName})`, `Failed to delete record (${storeName})`);
    return false;
  }
}

export async function dbClear(storeName: DBStoreName): Promise<boolean> {
  try {
    const db = await getDB();
    await db.clear(storeName);
    return true;
  } catch (error) {
    console.error(`[DB Error] clear on ${storeName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการล้างข้อมูล (${storeName})`, `Failed to clear (${storeName})`);
    return false;
  }
}

export async function dbQueryByIndex<T>(
  storeName: DBStoreName,
  indexName: string,
  query?: IDBKeyRange | IDBValidKey
): Promise<T[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.store.index(indexName);
    return (await index.getAll(query)) as T[];
  } catch (error) {
    console.error(`[DB Error] queryByIndex ${storeName}.${indexName}:`, error);
    notifyToast('error', `เกิดข้อผิดพลาดในการค้นหาข้อมูล`, `Query by index failed`);
    return [];
  }
}

// Full Export / Backup to JSON
export async function exportDatabaseToJSON(): Promise<string> {
  try {
    const db = await getDB();
    const stores: DBStoreName[] = [
      'settings',
      'ingredients',
      'recipes',
      'categories',
      'products',
      'tables',
      'orders',
      'shifts',
      'members',
      'promotions',
      'expenses',
      'meta',
    ];

    const data: Record<string, unknown> = {
      app: 'tonys-kitchen',
      version: 1,
      exportedAt: new Date().toISOString(),
    };

    for (const store of stores) {
      data[store] = await db.getAll(store);
    }

    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('[DB Export Error]:', error);
    notifyToast('error', 'ไม่สามารถส่งออกฐานข้อมูลได้', 'Database export failed');
    throw error;
  }
}

// Full Import / Restore from JSON
export async function importDatabaseFromJSON(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON backup file');
    }

    const db = await getDB();
    const stores: DBStoreName[] = [
      'settings',
      'ingredients',
      'recipes',
      'categories',
      'products',
      'tables',
      'orders',
      'shifts',
      'members',
      'promotions',
      'expenses',
      'meta',
    ];

    for (const store of stores) {
      if (Array.isArray(data[store])) {
        const tx = db.transaction(store, 'readwrite');
        await tx.store.clear();
        for (const item of data[store]) {
          await tx.store.put(item);
        }
        await tx.done;
      }
    }

    notifyToast('success', 'กู้คืนข้อมูลสำเร็จเรียบร้อย', 'Data restored successfully');
    return true;
  } catch (error) {
    console.error('[DB Import Error]:', error);
    notifyToast('error', 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล กรุณาตรวจสอบไฟล์', 'Database import failed. Check file format.');
    return false;
  }
}

// Initial Preset Seed Data (Thai restaurant authentic menu & recipes)
export const DEFAULT_SETTINGS: RestaurantSettings = {
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
  receiptHeaderMessage: "ยินดีต้อนรับสู่ Tony's Kitchen / Welcome to Tony's Kitchen",
  receiptFooterMessage: "ขอบคุณที่มาอุดหนุน / Thank you for visiting us! สอบถามบริการโทร 089-123-4567",
  receiptWidth: '80mm',
  language: 'th',
  defaultTableZone: 'indoor',
  soundEnabled: true,
};

export const INITIAL_CATEGORIES: ProductCategory[] = [
  { id: 'cat_main', nameTh: 'จานหลัก / ผัดแกง', nameEn: 'Main Dishes', icon: 'UtensilsCrossed', color: '#f97316', sortOrder: 1 },
  { id: 'cat_soup', nameTh: 'ต้มยำ & แกง', nameEn: 'Soups & Curries', icon: 'Soup', color: '#ef4444', sortOrder: 2 },
  { id: 'cat_rice_noodle', nameTh: 'ข้าว & เส้นจานเดียว', nameEn: 'Rice & Noodles', icon: 'Wheat', color: '#eab308', sortOrder: 3 },
  { id: 'cat_appetizer', nameTh: 'ทานเล่น & ยำแซ่บ', nameEn: 'Appetizers & Salads', icon: 'Flame', color: '#10b981', sortOrder: 4 },
  { id: 'cat_dessert', nameTh: 'ของหวานไทย', nameEn: 'Desserts', icon: 'IceCream', color: '#ec4899', sortOrder: 5 },
  { id: 'cat_beverage', nameTh: 'เครื่องดื่ม', nameEn: 'Beverages', icon: 'Coffee', color: '#06b6d4', sortOrder: 6 },
];

export const INITIAL_INGREDIENTS: Ingredient[] = [
  {
    id: 'ing_shrimp',
    nameTh: 'กุ้งขาวสดแกะเปลือก',
    nameEn: 'Fresh White Shrimp',
    category: 'meat',
    purchasePrice: 280,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 75, // 25% waste from head/shell
    unitCost: Number(((280 / 1000) / 0.75).toFixed(4)), // ~0.3733 THB/g
    currentStock: 12000, // 12 kg
    minStock: 3000,
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
    unitCost: Number(((95 / 1000) / 0.92).toFixed(4)), // ~0.1033 THB/g
    currentStock: 15000,
    minStock: 4000,
    supplier: 'เบทาโกร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_pork_belly',
    nameTh: 'หมูสามชั้นสด',
    nameEn: 'Pork Belly',
    category: 'meat',
    purchasePrice: 210,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 82,
    unitCost: Number(((210 / 1000) / 0.82).toFixed(4)),
    currentStock: 10000,
    minStock: 2500,
    supplier: 'ซีพี มาร์เก็ต',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_chantaburi_noodle',
    nameTh: 'เส้นจันท์แห้ง',
    nameEn: 'Chanthaburi Rice Noodles',
    category: 'dry_goods',
    purchasePrice: 50,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: 0.05,
    currentStock: 25000,
    minStock: 5000,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_egg',
    nameTh: 'ไข่ไก่สดเบอร์ 2',
    nameEn: 'Fresh Egg (#2)',
    category: 'dry_goods',
    purchasePrice: 135,
    purchaseUnit: 'pack', // 30 eggs
    packSize: 30,
    usageUnit: 'piece',
    yieldPercentage: 100,
    unitCost: 4.5, // 4.5 THB per egg
    currentStock: 180,
    minStock: 60,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_tofu',
    nameTh: 'เต้าหู้เหลืองแข็ง',
    nameEn: 'Firm Yellow Tofu',
    category: 'dry_goods',
    purchasePrice: 20,
    purchaseUnit: 'piece',
    packSize: 1,
    usageUnit: 'piece',
    yieldPercentage: 95,
    unitCost: 21.05,
    currentStock: 30,
    minStock: 10,
    supplier: 'ร้านเต้าหู้เยาวราช',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_tamarind_paste',
    nameTh: 'น้ำมะขามเปียกเข้มข้น',
    nameEn: 'Concentrated Tamarind Paste',
    category: 'seasoning',
    purchasePrice: 45,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: 0.045,
    currentStock: 8000,
    minStock: 2000,
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
    unitCost: 0.065,
    currentStock: 10000,
    minStock: 2000,
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
    unitCost: 0.06,
    currentStock: 14000,
    minStock: 2800,
    supplier: 'ร้านของชำเจริญผล',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_coconut_milk',
    nameTh: 'หัวกะทิแท้ 100%',
    nameEn: 'Coconut Milk 100%',
    category: 'seasoning',
    purchasePrice: 78,
    purchaseUnit: 'box',
    packSize: 1000,
    usageUnit: 'ml',
    yieldPercentage: 100,
    unitCost: 0.078,
    currentStock: 15000,
    minStock: 3000,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_tomyum_paste',
    nameTh: 'น้ำพริกเผาฉบับครัวโทนี่',
    nameEn: 'Thai Chili Paste',
    category: 'seasoning',
    purchasePrice: 90,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: 0.09,
    currentStock: 6000,
    minStock: 1500,
    supplier: 'ตลาดสี่มุมเมือง',
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
    unitCost: 0.2375,
    currentStock: 4000,
    minStock: 1000,
    supplier: 'ชาตรามือ',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_condensed_milk',
    nameTh: 'นมข้นหวาน',
    nameEn: 'Sweetened Condensed Milk',
    category: 'beverage',
    purchasePrice: 32,
    purchaseUnit: 'can',
    packSize: 380,
    usageUnit: 'g',
    yieldPercentage: 98,
    unitCost: 0.086,
    currentStock: 12000,
    minStock: 3000,
    supplier: 'แม็คโคร',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_mango',
    nameTh: 'มะม่วงน้ำดอกไม้สุก',
    nameEn: 'Ripe Nam Dok Mai Mango',
    category: 'vegetable',
    purchasePrice: 85,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 68, // peeled & seeded
    unitCost: Number(((85 / 1000) / 0.68).toFixed(4)),
    currentStock: 8000,
    minStock: 2000,
    supplier: 'ตลาดไท',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_sticky_rice',
    nameTh: 'ข้าวเหนียวเขี้ยวงูมูนกะทิ',
    nameEn: 'Sweet Coconut Sticky Rice',
    category: 'dry_goods',
    purchasePrice: 60,
    purchaseUnit: 'kg',
    packSize: 1000,
    usageUnit: 'g',
    yieldPercentage: 100,
    unitCost: 0.06,
    currentStock: 9000,
    minStock: 2000,
    supplier: 'ตลาดสี่มุมเมือง',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing_takeaway_box',
    nameTh: 'กล่องอาหารกระดาษคราฟท์',
    nameEn: 'Kraft Food Box Packaging',
    category: 'packaging',
    purchasePrice: 180,
    purchaseUnit: 'pack',
    packSize: 50,
    usageUnit: 'piece',
    yieldPercentage: 100,
    unitCost: 3.6,
    currentStock: 350,
    minStock: 100,
    supplier: 'โรงพิมพ์แพ็คเกจจิ้ง',
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rec_pad_thai',
    nameTh: 'ผัดไทยกุ้งสดโบราณ',
    nameEn: 'Pad Thai Goong Sod',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_shrimp', quantity: 90, unitCost: 0.3733, lineCost: 33.6 },
      { ingredientId: 'ing_chantaburi_noodle', quantity: 120, unitCost: 0.05, lineCost: 6.0 },
      { ingredientId: 'ing_egg', quantity: 1, unitCost: 4.5, lineCost: 4.5 },
      { ingredientId: 'ing_tofu', quantity: 0.25, unitCost: 21.05, lineCost: 5.26 },
      { ingredientId: 'ing_tamarind_paste', quantity: 30, unitCost: 0.045, lineCost: 1.35 },
      { ingredientId: 'ing_palm_sugar', quantity: 20, unitCost: 0.065, lineCost: 1.3 },
      { ingredientId: 'ing_fish_sauce', quantity: 15, unitCost: 0.06, lineCost: 0.9 },
    ],
    laborCostPerPortion: 6.0,
    packagingCostPerPortion: 3.6,
    totalRawCost: 52.91,
    totalCostPerPortion: 62.51,
    targetFoodCostPct: 35,
    suggestedSellingPrice: 178,
    actualSellingPrice: 165,
    grossMarginPct: Number((((165 - 62.51) / 165) * 100).toFixed(1)), // ~62.1%
    instructions: 'แช่เส้นจันท์ 20 นาที ตั้งกระทะให้ร้อนจัด ผัดกุ้งพอสุกแล้วตักพัก ใส่เต้าหู้ เส้น และซอสมะขาม ผัดจนเส้นนุ่ม ตอกไข่ ใส่ถั่วงอก เสิร์ฟพร้อมมะนาวและถั่วคั่ว',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_tom_yum',
    nameTh: 'ต้มยำกุ้งแม่น้ำน้ำข้น',
    nameEn: 'Tom Yum Goong Creamy Soup',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_shrimp', quantity: 140, unitCost: 0.3733, lineCost: 52.26 },
      { ingredientId: 'ing_coconut_milk', quantity: 150, unitCost: 0.078, lineCost: 11.7 },
      { ingredientId: 'ing_tomyum_paste', quantity: 40, unitCost: 0.09, lineCost: 3.6 },
      { ingredientId: 'ing_fish_sauce', quantity: 25, unitCost: 0.06, lineCost: 1.5 },
    ],
    laborCostPerPortion: 8.0,
    packagingCostPerPortion: 4.5,
    totalRawCost: 69.06,
    totalCostPerPortion: 81.56,
    targetFoodCostPct: 35,
    suggestedSellingPrice: 235,
    actualSellingPrice: 220,
    grossMarginPct: Number((((220 - 81.56) / 220) * 100).toFixed(1)),
    instructions: 'ต้มน้ำสต็อกสมุนไพรเดือดจัด ใส่เห็ดฟาง พริกเผา และกะทิ ใส่กุ้งแม่น้ำ ปรุงรสน้ำปลาและมะนาวตอนปิดไฟ',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_green_curry',
    nameTh: 'แกงเขียวหวานไก่ยอดมะพร้าว',
    nameEn: 'Green Curry with Tender Chicken',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_chicken', quantity: 160, unitCost: 0.1033, lineCost: 16.53 },
      { ingredientId: 'ing_coconut_milk', quantity: 220, unitCost: 0.078, lineCost: 17.16 },
      { ingredientId: 'ing_palm_sugar', quantity: 15, unitCost: 0.065, lineCost: 0.98 },
      { ingredientId: 'ing_fish_sauce', quantity: 20, unitCost: 0.06, lineCost: 1.2 },
    ],
    laborCostPerPortion: 7.0,
    packagingCostPerPortion: 4.0,
    totalRawCost: 35.87,
    totalCostPerPortion: 46.87,
    targetFoodCostPct: 30,
    suggestedSellingPrice: 155,
    actualSellingPrice: 150,
    grossMarginPct: Number((((150 - 46.87) / 150) * 100).toFixed(1)),
    instructions: 'เคี่ยวหัวกะทิให้แตกมัน ผัดพริกแกงเขียวหวานจนหอม นำเนื้อไก่ลงผัดจนสุก ตามด้วยหางกะทิและยอดมะพร้าวอ่อน',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_thai_tea',
    nameTh: 'ชาไทยเย็นพรีเมียมเข้มข้น',
    nameEn: 'Iced Thai Milk Tea Signature',
    type: 'beverage',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_thai_tea_mix', quantity: 25, unitCost: 0.2375, lineCost: 5.94 },
      { ingredientId: 'ing_condensed_milk', quantity: 45, unitCost: 0.086, lineCost: 3.87 },
      { ingredientId: 'ing_coconut_milk', quantity: 30, unitCost: 0.078, lineCost: 2.34 },
    ],
    laborCostPerPortion: 3.0,
    packagingCostPerPortion: 3.5, // Cup + lid + straw
    totalRawCost: 12.15,
    totalCostPerPortion: 18.65,
    targetFoodCostPct: 28,
    suggestedSellingPrice: 65,
    actualSellingPrice: 65,
    grossMarginPct: Number((((65 - 18.65) / 65) * 100).toFixed(1)), // ~71.3%
    instructions: 'ชงใบชาด้วยน้ำร้อนอุณหภูมิ 92 องศา สกัด 4 นาที ผสมนมข้นหวาน ราดด้วยนมสด/กะทิด้านบน',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec_mango_sticky_rice',
    nameTh: 'ข้าวเหนียวมะม่วงน้ำดอกไม้',
    nameEn: 'Mango Sticky Rice Dessert',
    type: 'dish',
    portionsYield: 1,
    items: [
      { ingredientId: 'ing_mango', quantity: 220, unitCost: 0.125, lineCost: 27.5 },
      { ingredientId: 'ing_sticky_rice', quantity: 150, unitCost: 0.06, lineCost: 9.0 },
      { ingredientId: 'ing_coconut_milk', quantity: 60, unitCost: 0.078, lineCost: 4.68 },
    ],
    laborCostPerPortion: 4.0,
    packagingCostPerPortion: 3.5,
    totalRawCost: 41.18,
    totalCostPerPortion: 48.68,
    targetFoodCostPct: 35,
    suggestedSellingPrice: 140,
    actualSellingPrice: 135,
    grossMarginPct: Number((((135 - 48.68) / 135) * 100).toFixed(1)),
    instructions: 'จัดมะม่วงสุกหั่นชิ้นเคียงข้าวเหนียวมูน ราดกะทิสดเคี่ยวเกลือ โรยถั่วทองทอดกรอบ',
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_pad_thai',
    nameTh: 'ผัดไทยกุ้งสดโบราณ',
    nameEn: 'Pad Thai Goong Sod',
    descriptionTh: 'เส้นจันท์เหนียวนุ่ม ผัดซอสมะขามเปียกเข้มข้น กุ้งขาวสด 3 ตัวใหญ่',
    descriptionEn: 'Stir-fried rice noodles with tamarind sauce, jumbo shrimp, tofu, bean sprouts',
    categoryId: 'cat_rice_noodle',
    price: 165,
    cost: 62.51,
    recipeId: 'rec_pad_thai',
    isAvailable: true,
    kitchenStation: 'kitchen',
    variants: [
      { id: 'var_regular', nameTh: 'ธรรมดา', nameEn: 'Regular', priceDelta: 0 },
      { id: 'var_extra', nameTh: 'พิเศษกุ้ง 5 ตัว', nameEn: 'Extra Shrimp (5 pcs)', priceDelta: 45, costDelta: 18 },
    ],
    modifierGroups: [
      {
        id: 'mod_spicy',
        nameTh: 'ระดับความเผ็ด',
        nameEn: 'Spiciness Level',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'spicy_none', nameTh: 'ไม่เผ็ดเลย', nameEn: 'Non-spicy', priceDelta: 0 },
          { id: 'spicy_mild', nameTh: 'เผ็ดน้อย', nameEn: 'Mild', priceDelta: 0 },
          { id: 'spicy_medium', nameTh: 'เผ็ดปกติ', nameEn: 'Medium', priceDelta: 0 },
          { id: 'spicy_hot', nameTh: 'เผ็ดมาก (พริกคั่วพิเศษ)', nameEn: 'Extra Spicy', priceDelta: 0 },
        ],
      },
      {
        id: 'mod_coriander',
        nameTh: 'ผักเครื่องเคียง',
        nameEn: 'Veggies Preference',
        minSelect: 0,
        maxSelect: 2,
        options: [
          { id: 'opt_no_sprout', nameTh: 'ไม่ใส่ถั่วงอก', nameEn: 'No Bean Sprouts', priceDelta: 0 },
          { id: 'opt_no_chives', nameTh: 'ไม่ใส่ใบกุยช่าย', nameEn: 'No Garlic Chives', priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: 'prod_tom_yum',
    nameTh: 'ต้มยำกุ้งแม่น้ำน้ำข้น',
    nameEn: 'Tom Yum Goong Creamy Soup',
    descriptionTh: 'ต้มยำสูตรเข้มข้น หอมกลิ่นมะนาวแท้ พริกขี้หนูสวน และกุ้งแม่น้ำเนื้อเด้ง',
    descriptionEn: 'Signature spicy & sour soup with river prawns, mushrooms, fresh galangal & lime',
    categoryId: 'cat_soup',
    price: 220,
    cost: 81.56,
    recipeId: 'rec_tom_yum',
    isAvailable: true,
    kitchenStation: 'kitchen',
    modifierGroups: [
      {
        id: 'mod_soup_style',
        nameTh: 'ประเภทน้ำต้มยำ',
        nameEn: 'Soup Base',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'style_creamy', nameTh: 'น้ำข้น (ใส่นม/กะทิ)', nameEn: 'Creamy Broth', priceDelta: 0 },
          { id: 'style_clear', nameTh: 'น้ำใส (สมุนไพรแท้)', nameEn: 'Clear Broth', priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: 'prod_green_curry',
    nameTh: 'แกงเขียวหวานไก่ยอดมะพร้าว',
    nameEn: 'Green Curry Chicken',
    descriptionTh: 'แกงเขียวหวานกะทิคั้นสด อกไก่นุ่ม ยอดมะพร้าวอ่อนกรอบ หอมใบโหระพา',
    descriptionEn: 'Rich coconut green curry with chicken breast, young coconut shoots, Thai basil',
    categoryId: 'cat_main',
    price: 150,
    cost: 46.87,
    recipeId: 'rec_green_curry',
    isAvailable: true,
    kitchenStation: 'kitchen',
    variants: [
      { id: 'var_chicken', nameTh: 'ไก่สด', nameEn: 'Chicken', priceDelta: 0 },
      { id: 'var_pork', nameTh: 'หมูสามชั้น', nameEn: 'Pork Belly', priceDelta: 20, costDelta: 8 },
      { id: 'var_shrimp', nameTh: 'กุ้งสด', nameEn: 'Shrimp', priceDelta: 40, costDelta: 16 },
    ],
  },
  {
    id: 'prod_som_tum',
    nameTh: 'ส้มตำไทยไข่เค็ม',
    nameEn: 'Som Tum Thai with Salted Egg',
    descriptionTh: 'เส้นมะละกอกรอบ ตำสดครกต่อครก รสชาติกลมกล่อม เปรี้ยวหวานเค็มลงตัว',
    descriptionEn: 'Green papaya salad with salted egg, roasted peanuts, long beans, lime juice',
    categoryId: 'cat_appetizer',
    price: 95,
    cost: 32.5,
    isAvailable: true,
    kitchenStation: 'kitchen',
    modifierGroups: [
      {
        id: 'mod_chili_count',
        nameTh: 'จำนวนพริก',
        nameEn: 'Chili count',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'chili_1', nameTh: 'พริก 1 เม็ด (เผ็ดอนุบาล)', nameEn: '1 Chili', priceDelta: 0 },
          { id: 'chili_3', nameTh: 'พริก 3 เม็ด (เผ็ดกำลังดี)', nameEn: '3 Chilies', priceDelta: 0 },
          { id: 'chili_5', nameTh: 'พริก 5 เม็ด (แซ่บสะใจ)', nameEn: '5 Chilies', priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: 'prod_mango_dessert',
    nameTh: 'ข้าวเหนียวมะม่วงน้ำดอกไม้',
    nameEn: 'Mango Sticky Rice',
    descriptionTh: 'ข้าวเหนียวมูนหัวกะทิเคี่ยวเข้มข้น มะม่วงน้ำดอกไม้หวานฉ่ำ',
    descriptionEn: 'Sweet sticky rice served with sweet ripe mango, coconut cream topping',
    categoryId: 'cat_dessert',
    price: 135,
    cost: 48.68,
    recipeId: 'rec_mango_sticky_rice',
    isAvailable: true,
    kitchenStation: 'dessert',
  },
  {
    id: 'prod_thai_tea',
    nameTh: 'ชาไทยเย็นพรีเมียม',
    nameEn: 'Signature Thai Iced Tea',
    descriptionTh: 'ชาไทยสูตรเฉพาะของโทนี่ หอมกรุ่น นุ่มละมุน หวานมันกลมกล่อม',
    descriptionEn: 'Authentic Thai brewed iced tea with creamy sweetened milk',
    categoryId: 'cat_beverage',
    price: 65,
    cost: 18.65,
    recipeId: 'rec_thai_tea',
    isAvailable: true,
    kitchenStation: 'bar',
    modifierGroups: [
      {
        id: 'mod_sweetness',
        nameTh: 'ระดับความหวาน',
        nameEn: 'Sweetness',
        minSelect: 0,
        maxSelect: 1,
        options: [
          { id: 'sweet_100', nameTh: 'หวานปกติ (100%)', nameEn: 'Regular (100%)', priceDelta: 0 },
          { id: 'sweet_50', nameTh: 'หวานน้อย (50%)', nameEn: 'Less Sweet (50%)', priceDelta: 0 },
          { id: 'sweet_25', nameTh: 'หวานน้อยมาก (25%)', nameEn: 'Low Sweet (25%)', priceDelta: 0 },
          { id: 'sweet_0', nameTh: 'ไม่หวานเลย (0%)', nameEn: 'Unsweetened (0%)', priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: 'prod_lemon_grass_drink',
    nameTh: 'น้ำตะไคร้ใบเตยหอมเย็น',
    nameEn: 'Iced Lemongrass Pandan',
    descriptionTh: 'เครื่องดื่มสมุนไพรต้มสด ชื่นใจ ดับกระหายคลายร้อน',
    descriptionEn: 'Fresh brewed lemongrass and aromatic pandan herbal iced tea',
    categoryId: 'cat_beverage',
    price: 50,
    cost: 12.0,
    isAvailable: true,
    kitchenStation: 'bar',
  },
];

export const INITIAL_TABLES: RestaurantTable[] = [
  { id: 'tbl_t1', name: 'T-01', zone: 'indoor', seats: 4, status: 'empty' },
  { id: 'tbl_t2', name: 'T-02', zone: 'indoor', seats: 4, status: 'empty' },
  { id: 'tbl_t3', name: 'T-03', zone: 'indoor', seats: 2, status: 'empty' },
  { id: 'tbl_t4', name: 'T-04', zone: 'indoor', seats: 6, status: 'empty' },
  { id: 'tbl_t5', name: 'T-05', zone: 'indoor', seats: 4, status: 'empty' },
  { id: 'tbl_out1', name: 'Out-01', zone: 'outdoor', seats: 4, status: 'empty' },
  { id: 'tbl_out2', name: 'Out-02', zone: 'outdoor', seats: 4, status: 'empty' },
  { id: 'tbl_bar1', name: 'Bar-01', zone: 'bar', seats: 2, status: 'empty' },
  { id: 'tbl_bar2', name: 'Bar-02', zone: 'bar', seats: 2, status: 'empty' },
  { id: 'tbl_vip1', name: 'VIP Room', zone: 'vip', seats: 10, status: 'empty' },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem_1',
    code: 'TK-1001',
    name: 'คุณสมชาย ใจดี',
    phone: '0812345678',
    points: 120,
    tier: 'gold',
    totalSpent: 4850,
    visitCount: 6,
    notes: 'ชอบนั่งโต๊ะ Out-01 ทานเผ็ดปกติ',
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
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'promo_lunch_10',
    code: 'LUNCH10',
    nameTh: 'ส่วนลดมื้อกลางวัน 10%',
    nameEn: 'Lunch Special 10% Off',
    type: 'percent',
    value: 10,
    minSpend: 300,
    isActive: true,
  },
  {
    id: 'promo_grand_50',
    code: 'TONY50',
    nameTh: 'คูปองฉลองเปิดร้าน ลด ฿50',
    nameEn: 'Grand Opening ฿50 Off',
    type: 'amount',
    value: 50,
    minSpend: 400,
    isActive: true,
  },
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    title: 'ซื้อวัตถุดิบอาหารสด ตลาดสี่มุมเมือง',
    category: 'raw_materials',
    amount: 3450,
    paymentMethod: 'promptpay',
    notes: 'กุ้งสด หมูสามชั้น ผักชี ถั่วงอก มะนาว',
  },
  {
    id: 'exp_2',
    date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    title: 'ค่ากล่องใส่อาหารและแก้วเดลิเวอรี่',
    category: 'packaging',
    amount: 1200,
    paymentMethod: 'cash',
    notes: 'กล่องคราฟท์ 300 ใบ หลอด แก้วกาแฟ',
  },
  {
    id: 'exp_3',
    date: new Date().toISOString().split('T')[0],
    title: 'ค่าน้ำแข็งหลอดบริสุทธิ์',
    category: 'raw_materials',
    amount: 180,
    paymentMethod: 'cash',
  },
];

// Initialize and seed database if not yet populated
export async function initializeDatabase(forceReset: boolean = false): Promise<void> {
  const db = await getDB();
  const meta = await db.get('meta', 'app_meta');

  if (meta && !forceReset) {
    return; // Already initialized
  }

  // Clear existing if force reset
  if (forceReset) {
    const stores: DBStoreName[] = [
      'settings',
      'ingredients',
      'recipes',
      'categories',
      'products',
      'tables',
      'orders',
      'shifts',
      'members',
      'promotions',
      'expenses',
      'meta',
    ];
    for (const store of stores) {
      await db.clear(store);
    }
  }

  // Populate Default Settings
  await db.put('settings', DEFAULT_SETTINGS);

  // Populate Categories
  for (const cat of INITIAL_CATEGORIES) {
    await db.put('categories', cat);
  }

  // Populate Ingredients
  for (const ing of INITIAL_INGREDIENTS) {
    await db.put('ingredients', ing);
  }

  // Populate Recipes
  for (const rec of INITIAL_RECIPES) {
    await db.put('recipes', rec);
  }

  // Populate Products
  for (const prod of INITIAL_PRODUCTS) {
    await db.put('products', prod);
  }

  // Populate Tables
  for (const tbl of INITIAL_TABLES) {
    await db.put('tables', tbl);
  }

  // Populate Members
  for (const mem of INITIAL_MEMBERS) {
    await db.put('members', mem);
  }

  // Populate Promotions
  for (const promo of INITIAL_PROMOTIONS) {
    await db.put('promotions', promo);
  }

  // Populate Expenses
  for (const exp of INITIAL_EXPENSES) {
    await db.put('expenses', exp);
  }

  // Create an initial active Shift so POS is ready to sell right away!
  const initialShift: Shift = {
    id: `shift_${Date.now()}`,
    shiftNumber: 1,
    openedAt: new Date().toISOString(),
    startingCash: 2000,
    cashSales: 0,
    promptpaySales: 0,
    cardSales: 0,
    totalSales: 0,
    totalOrders: 0,
    expectedCash: 2000,
    status: 'open',
    notes: 'กะเปิดร้านตอนเช้า - เงินทอนเริ่มต้น ฿2,000',
  };
  await db.put('shifts', initialShift);

  // Create a couple of completed sample orders for realistic reports
  const sampleOrder1: Order = {
    id: `ord_${Date.now() - 7200000}`,
    orderNumber: '#TK-101',
    tableName: 'T-01',
    tableId: 'tbl_t1',
    orderType: 'dine_in',
    guestCount: 2,
    status: 'paid',
    items: [
      {
        id: 'item_1',
        productId: 'prod_pad_thai',
        productNameTh: 'ผัดไทยกุ้งสดโบราณ',
        productNameEn: 'Pad Thai Goong Sod',
        basePrice: 165,
        unitCost: 62.51,
        quantity: 2,
        lineTotal: 330,
        kitchenStatus: 'served',
        kitchenStation: 'kitchen',
        orderedAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'item_2',
        productId: 'prod_thai_tea',
        productNameTh: 'ชาไทยเย็นพรีเมียม',
        productNameEn: 'Signature Thai Iced Tea',
        basePrice: 65,
        unitCost: 18.65,
        quantity: 2,
        lineTotal: 130,
        kitchenStatus: 'served',
        kitchenStation: 'bar',
        orderedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    subtotal: 460,
    discountAmount: 0,
    vatAmount: 30.09, // 7% inclusive
    serviceChargeAmount: 0,
    totalAmount: 460,
    totalCost: 162.32,
    grossProfit: 297.68,
    paymentMethod: 'promptpay',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    paidAt: new Date(Date.now() - 6000000).toISOString(),
    shiftId: initialShift.id,
  };
  await db.put('orders', sampleOrder1);

  // Update shift stats with sample order
  initialShift.totalSales = 460;
  initialShift.promptpaySales = 460;
  initialShift.totalOrders = 1;
  await db.put('shifts', initialShift);

  // Store metadata
  const appMeta: AppMetadata = {
    schemaVersion: 1,
    initializedAt: new Date().toISOString(),
    lastBackupAt: undefined,
  };
  await db.put('meta', { id: 'app_meta', ...appMeta });

  notifyToast('success', 'เริ่มต้นระบบและโหลดข้อมูลตัวอย่างเรียบร้อย', 'Database initialized with sample data');
}
