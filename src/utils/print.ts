/**
 * Thermal Printer & Browser Print Utilities
 * Supports 58mm and 80mm thermal receipt formats
 */

export interface ReceiptPrintData {
  restaurantNameTh: string;
  restaurantNameEn?: string;
  tagline?: string;
  addressTh?: string;
  phone?: string;
  taxId?: string;
  billNumber: string;
  tableName?: string;
  orderType: string;
  dateStr: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
    modifiers?: string[];
  }>;
  subtotal: number;
  discount: number;
  serviceCharge?: number;
  vat?: number;
  grandTotal: number;
  paymentMethod: string;
  tendered?: number;
  change?: number;
  promptPayQrDataUrl?: string;
  footerMessage?: string;
  paperWidth: '58mm' | '80mm';
}

/**
 * สั่งพิมพ์ผ่าน Browser Print Dialog
 */
export function triggerBrowserPrint(): void {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

/**
 * ตรวจสอบว่าเบราว์เซอร์เปิดโหมด Kiosk Printing อยู่หรือไม่
 */
export function isKioskPrintingAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  // Browser standard check
  return navigator.userAgent.toLowerCase().includes('kiosk');
}
