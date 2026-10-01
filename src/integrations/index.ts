/**
 * Integration Boundaries for Tony's Kitchen
 * Honest local-first architectural adapters
 */

export interface LineMessagingExport {
  channel: 'line';
  text: string;
}

export interface ThermalReceiptIntegration {
  format: '80mm' | '58mm';
  encoding: 'tis-620' | 'utf-8';
  kioskPrintingSupported: boolean;
}

export interface FutureOnlineOrderWebhookPayload {
  version: '1.0';
  source: 'grab' | 'lineman' | 'foodpanda' | 'custom_web';
  orderId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
}
