/**
 * Storage & Database Interface Wrapper
 * Provides safe IndexedDB operations with quota error handling
 */

import { dbGet, dbGetAll, dbPut, dbDelete, getDB, DBStoreName } from '../db';

export { dbGet, dbGetAll, dbPut, dbDelete, getDB };
export type { DBStoreName };

/**
 * ตรวจสอบพื้นที่จัดเก็บที่เหลืออยู่ของเบราว์เซอร์
 */
export async function checkStorageEstimate(): Promise<{
  usageMb: number;
  quotaMb: number;
  percentUsed: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const usageMb = (usage || 0) / (1024 * 1024);
      const quotaMb = (quota || 0) / (1024 * 1024);
      const percentUsed = quotaMb > 0 ? (usageMb / quotaMb) * 100 : 0;
      return {
        usageMb: Math.round(usageMb * 100) / 100,
        quotaMb: Math.round(quotaMb * 100) / 100,
        percentUsed: Math.round(percentUsed * 10) / 10,
      };
    } catch {
      // fallback
    }
  }
  return { usageMb: 0, quotaMb: 0, percentUsed: 0 };
}
