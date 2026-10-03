/**
 * OnlineOrderSource Interface & Parser
 * Section 7.5: Clean ingestion adapter for future shop-owned online ordering apps
 * Pure client-side validator and parser, zero fake network calls.
 */

export interface OnlineOrderItemPayload {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitCostSnapshot?: number;
  modifiers?: Array<{ groupName: string; optionName: string; priceDelta: number }>;
  note?: string;
}

export interface IngestedOnlineOrder {
  externalId: string;
  source: 'grab' | 'lineman' | 'foodpanda' | 'custom_web' | 'online';
  customerName?: string;
  customerPhone?: string;
  items: OnlineOrderItemPayload[];
  subtotal: number;
  deliveryFee?: number;
  total: number;
  note?: string;
  createdAt: string;
}

export interface OnlineOrderValidationResult {
  valid: boolean;
  error?: string;
  order?: IngestedOnlineOrder;
}

export interface OnlineOrderSource {
  validatePayload(raw: unknown): OnlineOrderValidationResult;
  parseJson(jsonString: string): { success: boolean; error?: string; orders?: IngestedOnlineOrder[] };
  createTestOrder(): IngestedOnlineOrder;
}

export class LocalOnlineOrderSource implements OnlineOrderSource {
  validatePayload(raw: unknown): OnlineOrderValidationResult {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'ข้อมูลออเดอร์ต้องเป็น JSON Object ที่ถูกต้อง' };
    }

    const obj = raw as Record<string, unknown>;

    if (!obj.externalId || typeof obj.externalId !== 'string') {
      return { valid: false, error: 'ต้องระบุ externalId (รหัสอ้างอิงออเดอร์จากระบบออนไลน์)' };
    }

    if (!Array.isArray(obj.items) || obj.items.length === 0) {
      return { valid: false, error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ (items array)' };
    }

    const parsedItems: OnlineOrderItemPayload[] = [];
    for (let i = 0; i < obj.items.length; i++) {
      const item = obj.items[i];
      if (!item || typeof item !== 'object') {
        return { valid: false, error: `รายการสินค้าที่ ${i + 1} ไม่ถูกต้อง` };
      }
      const itemObj = item as Record<string, unknown>;
      if (!itemObj.name || typeof itemObj.name !== 'string') {
        return { valid: false, error: `รายการที่ ${i + 1} ต้องมีชื่อสินค้า (name)` };
      }
      const qty = Number(itemObj.qty) || 1;
      const unitPrice = Number(itemObj.unitPrice) || 0;

      parsedItems.push({
        productId: (itemObj.productId as string) || `ext_${Date.now()}_${i}`,
        name: itemObj.name,
        qty,
        unitPrice,
        unitCostSnapshot: typeof itemObj.unitCostSnapshot === 'number' ? itemObj.unitCostSnapshot : undefined,
        modifiers: Array.isArray(itemObj.modifiers)
          ? (itemObj.modifiers as Array<Record<string, unknown>>).map((m) => ({
              groupName: String(m.groupName || 'ตัวเลือก'),
              optionName: String(m.optionName || ''),
              priceDelta: Number(m.priceDelta) || 0,
            }))
          : undefined,
        note: itemObj.note ? String(itemObj.note) : undefined,
      });
    }

    const subtotal =
      typeof obj.subtotal === 'number'
        ? obj.subtotal
        : parsedItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

    const deliveryFee = typeof obj.deliveryFee === 'number' ? obj.deliveryFee : 0;
    const total = typeof obj.total === 'number' ? obj.total : subtotal + deliveryFee;

    const validSources = ['grab', 'lineman', 'foodpanda', 'custom_web', 'online'] as const;
    const sourceCandidate = String(obj.source || 'online');
    const source = (validSources as readonly string[]).includes(sourceCandidate)
      ? (sourceCandidate as IngestedOnlineOrder['source'])
      : 'online';

    return {
      valid: true,
      order: {
        externalId: obj.externalId,
        source,
        customerName: obj.customerName ? String(obj.customerName) : 'ลูกค้าออนไลน์',
        customerPhone: obj.customerPhone ? String(obj.customerPhone) : undefined,
        items: parsedItems,
        subtotal,
        deliveryFee,
        total,
        note: obj.note ? String(obj.note) : undefined,
        createdAt: (obj.createdAt as string) || new Date().toISOString(),
      },
    };
  }

  parseJson(jsonString: string): { success: boolean; error?: string; orders?: IngestedOnlineOrder[] } {
    try {
      const parsed = JSON.parse(jsonString);
      const itemsToValidate = Array.isArray(parsed) ? parsed : [parsed];
      const validOrders: IngestedOnlineOrder[] = [];

      for (let i = 0; i < itemsToValidate.length; i++) {
        const result = this.validatePayload(itemsToValidate[i]);
        if (!result.valid || !result.order) {
          return { success: false, error: `ลำดับที่ ${i + 1}: ${result.error}` };
        }
        validOrders.push(result.order);
      }

      return { success: true, orders: validOrders };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SyntaxError';
      return { success: false, error: `รูปแบบ JSON ไม่ถูกต้อง: ${msg}` };
    }
  }

  createTestOrder(): IngestedOnlineOrder {
    const timestamp = Date.now();
    const sources: Array<'grab' | 'lineman' | 'foodpanda'> = ['grab', 'lineman', 'foodpanda'];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    const mockItems = [
      { name: 'ผัดกะเพราเนื้อสับไข่ดาว', price: 95, cost: 35 },
      { name: 'ต้มยำกุ้งน้ำข้น', price: 180, cost: 65 },
      { name: 'ชาไทยเย็นพรีเมียม', price: 65, cost: 18 },
    ];
    const picked = mockItems.slice(0, Math.floor(Math.random() * 2) + 1);

    const items: OnlineOrderItemPayload[] = picked.map((item, idx) => ({
      productId: `test_prod_${idx}`,
      name: item.name,
      qty: Math.floor(Math.random() * 2) + 1,
      unitPrice: item.price,
      unitCostSnapshot: item.cost,
      modifiers: [
        { groupName: 'ระดับความเผ็ด', optionName: 'เผ็ดปกติ', priceDelta: 0 },
      ],
      note: 'ไม่ใส่ผงชูรส',
    }));

    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

    return {
      externalId: `ONL-${timestamp.toString().slice(-6)}`,
      source: randomSource,
      customerName: 'คุณสมชาย (ทดสอบออเดอร์)',
      customerPhone: '0812345678',
      items,
      subtotal,
      deliveryFee: 25,
      total: subtotal + 25,
      note: 'วางไว้ที่ป้อมยามหน้าหมู่บ้าน',
      createdAt: new Date().toISOString(),
    };
  }
}

export const onlineOrderSource = new LocalOnlineOrderSource();
