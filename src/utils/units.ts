/**
 * Unit Conversion & Validation Module
 * Pure functions with Thai comments
 */

import { CustomUnit, UnitType } from '../types';

export const BASE_UNITS = ['g', 'ml', 'pcs'] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const CONVERTIBLE_MASS_UNITS = ['g', 'kg'] as const;
export const CONVERTIBLE_VOLUME_UNITS = ['ml', 'l'] as const;
export const CONVERTIBLE_COUNT_UNITS = ['pcs', 'ฟอง', 'ชิ้น', 'ใบ', 'ขวด', 'กระป๋อง', 'แพ็ค', 'ถุง'] as const;

export interface UnitConversionResult {
  success: boolean;
  qtyInBase: number;
  warning?: {
    th: string;
    en: string;
  };
}

/**
 * แปลงหน่วยปริมาณเป็นหน่วยฐาน (g, ml, pcs)
 * รองรับ g↔kg (1,000) และ ml↔l (1,000) พร้อมหน่วยกำหนดเอง (customUnits)
 */
export function convertUnit(
  qty: number,
  fromUnit: string,
  baseUnit: string,
  customUnits?: CustomUnit[]
): UnitConversionResult {
  if (typeof qty !== 'number' || isNaN(qty) || qty < 0) {
    return {
      success: false,
      qtyInBase: 0,
      warning: {
        th: 'ปริมาณไม่ถูกต้อง',
        en: 'Invalid quantity',
      },
    };
  }

  const from = fromUnit.trim().toLowerCase();
  const to = baseUnit.trim().toLowerCase();

  // หน่วยเดียวกัน
  if (from === to) {
    return { success: true, qtyInBase: qty };
  }

  // มวล: kg -> g (คูณ 1,000)
  if (from === 'kg' && to === 'g') {
    return { success: true, qtyInBase: qty * 1000 };
  }
  // มวล: g -> kg (หาร 1,000)
  if (from === 'g' && to === 'kg') {
    return { success: true, qtyInBase: qty / 1000 };
  }

  // ปริมาตร: l -> ml (คูณ 1,000)
  if ((from === 'l' || from === 'ลิตร') && to === 'ml') {
    return { success: true, qtyInBase: qty * 1000 };
  }
  // ปริมาตร: ml -> l (หาร 1,000)
  if (from === 'ml' && (to === 'l' || to === 'ลิตร')) {
    return { success: true, qtyInBase: qty / 1000 };
  }

  // ตรวจสอบ Custom Units ของวัตถุดิบ
  if (customUnits && customUnits.length > 0) {
    const matched = customUnits.find(
      (c) => c.name.trim().toLowerCase() === from
    );
    if (matched && matched.baseUnitsPer > 0) {
      return { success: true, qtyInBase: qty * matched.baseUnitsPer };
    }
  }

  // กรณีแปลงไม่ได้
  return {
    success: false,
    qtyInBase: 0,
    warning: {
      th: `ไม่สามารถแปลงหน่วย "${fromUnit}" ไปเป็น "${baseUnit}" ได้`,
      en: `Cannot convert unit "${fromUnit}" to "${baseUnit}"`,
    },
  };
}

/**
 * ดึงรายการหน่วยที่สามารถเลือกได้ตาม base unit
 */
export function getAvailableUnitsForBase(
  baseUnit: 'g' | 'ml' | 'pcs',
  customUnits?: CustomUnit[]
): string[] {
  const result: string[] = [];

  if (baseUnit === 'g') {
    result.push('g', 'kg');
  } else if (baseUnit === 'ml') {
    result.push('ml', 'l');
  } else {
    result.push('pcs', 'ชิ้น', 'ฟอง', 'ใบ', 'กระป๋อง', 'ขวด');
  }

  if (customUnits && customUnits.length > 0) {
    customUnits.forEach((c) => {
      if (!result.includes(c.name)) {
        result.push(c.name);
      }
    });
  }

  return result;
}
