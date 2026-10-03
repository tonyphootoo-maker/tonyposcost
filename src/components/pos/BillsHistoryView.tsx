import React, { useState, useEffect, useMemo } from 'react';
import {
  ReceiptText,
  Search,
  Printer,
  Trash2,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  XCircle,
  Clock,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { dbGetAll, dbPut, dbGet, getOrdersByDateRange } from '../../db';
import { Order, RestaurantSettings } from '../../types';
import { showToast } from '../common/ToastContainer';

export const BillsHistoryView: React.FC = () => {
  const { t, formatCurrency, formatDate, formatTime } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'cancelled'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(50);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadBills();
    loadSettings();
  }, [dateRangeFilter]);

  const loadSettings = async () => {
    const s = await dbGet<RestaurantSettings>('settings', 'current_settings');
    if (s) setSettings(s);
  };

  const loadBills = async () => {
    try {
      let allOrders: Order[] = [];
      const now = new Date();

      if (dateRangeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        allOrders = await getOrdersByDateRange(todayStr, todayStr);
      } else if (dateRangeFilter === '7days') {
        const past7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        allOrders = await getOrdersByDateRange(past7, todayStr);
      } else if (dateRangeFilter === '30days') {
        const past30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        allOrders = await getOrdersByDateRange(past30, todayStr);
      } else {
        allOrders = await dbGetAll<Order>('orders');
      }

      // Show latest bills first
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(allOrders);
      if (allOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(allOrders[0]);
      }
    } catch {
      showToast({ title: 'Error', message: 'Failed to load bills', type: 'error' });
    }
  };

  const handleReprint = (order: Order) => {
    setSelectedOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleVoidBill = async (order: Order) => {
    if (!confirm(t.confirmDeleteMsg || 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกบิลนี้?')) return;
    try {
      const updated: Order = {
        ...order,
        status: 'cancelled',
      };
      await dbPut('orders', updated);
      showToast({ title: t.saveSuccess || 'สำเร็จ', message: t.voidBill || 'ยกเลิกบิลเรียบร้อยแล้ว', type: 'success' });
      loadBills();
    } catch {
      showToast({ title: 'Error', message: 'Failed to void bill', type: 'error' });
    }
  };

  // Pure memoized filtering for high performance with thousands of bills
  const filteredBills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.tableName && o.tableName.toLowerCase().includes(q)) ||
        (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q));

      if (statusFilter === 'paid') return matchesSearch && o.status === 'paid';
      if (statusFilter === 'cancelled') return matchesSearch && o.status === 'cancelled';
      return matchesSearch;
    });
  }, [orders, searchQuery, statusFilter]);

  const visibleBills = useMemo(() => {
    return filteredBills.slice(0, displayLimit);
  }, [filteredBills, displayLimit]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-orange-500" />
            {t.navBills || 'บิล & ประวัติการขาย'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            ค้นหา ตรวจสอบ พิมพ์ใบเสร็จย้อนหลัง หรือจัดการยกเลิกบิล
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#FFFBF5] p-1 rounded-xl border border-[#FED7AA]">
          {(['all', 'paid', 'cancelled'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[38px] transition-all capitalize ${
                statusFilter === filter
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              {filter === 'all'
                ? t.all || 'ทั้งหมด'
                : filter === 'paid'
                ? t.billStatusPaid || 'ชำระแล้ว'
                : t.billStatusCancelled || 'ยกเลิกแล้ว'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: List & Receipt Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Bills List */}
        <div className="lg:col-span-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search || 'ค้นหาเลขที่บิล, โต๊ะ...'}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {filteredBills.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
                <ReceiptText className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
                <p className="font-semibold text-sm">{t.emptyState || 'ไม่พบบิลตามเงื่อนไข'}</p>
              </div>
            ) : (
              filteredBills.map((bill) => {
                const isSelected = selectedOrder?.id === bill.id;
                return (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedOrder(bill)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50/60 border-orange-500 shadow-xs'
                        : 'bg-white border-[#FED7AA] hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#1F2937]">#{bill.orderNumber}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                              bill.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : bill.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {bill.status === 'paid'
                              ? 'ชำระแล้ว'
                              : bill.status === 'cancelled'
                              ? 'ยกเลิก'
                              : 'รอชำระ'}
                          </span>
                        </div>
                        <div className="text-xs text-[#6B7280] mt-1 flex items-center gap-2">
                          <span>{bill.tableName || 'Takeaway/Delivery'}</span>
                          <span>•</span>
                          <span>{bill.items.length} รายการ</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-base text-orange-600">
                          {formatCurrency(bill.netTotal ?? bill.totalAmount)}
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">
                          {formatTime(bill.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Thermal Receipt Preview & Actions */}
        <div className="lg:col-span-6">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
                <div>
                  <h2 className="font-bold text-base text-[#1F2937]">
                    พรีวิวใบเสร็จ (Receipt Preview)
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    บิลเลขที่: #{selectedOrder.orderNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReprint(selectedOrder)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    {t.printReceipt || 'พิมพ์ใบเสร็จ'}
                  </button>

                  {selectedOrder.status === 'paid' && (
                    <button
                      onClick={() => handleVoidBill(selectedOrder)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold rounded-xl text-sm min-h-[44px] flex items-center gap-1.5 transition-colors"
                      title={t.voidBill || 'ยกเลิกบิล'}
                    >
                      <XCircle className="w-4 h-4" />
                      {t.voidBill || 'ยกเลิกบิล'}
                    </button>
                  )}
                </div>
              </div>

              {/* Printable Receipt Card */}
              <div
                id="printable-receipt"
                className="bg-white p-6 rounded-xl border border-dashed border-[#FED7AA] max-w-[340px] mx-auto text-xs text-[#1F2937] font-mono leading-relaxed"
              >
                {/* Header */}
                <div className="text-center pb-3 border-b border-dashed border-neutral-300">
                  <div className="font-bold text-base text-[#1F2937]">
                    {settings?.name || settings?.restaurantNameTh || "Tony's Kitchen"}
                  </div>
                  {(settings?.address || settings?.addressTh) && (
                    <div className="text-[10px] text-[#6B7280]">{settings.address || settings.addressTh}</div>
                  )}
                  {settings?.phone && (
                    <div className="text-[10px] text-[#6B7280]">โทร: {settings.phone}</div>
                  )}
                  {settings?.taxId && (
                    <div className="text-[10px] text-[#6B7280]">เลขประจำตัวผู้เสียภาษี: {settings.taxId}</div>
                  )}
                </div>

                {/* Metadata */}
                <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ</span>
                  </div>
                  <div className="flex justify-between">
                    <span>เลขที่บิล:</span>
                    <span className="font-bold">#{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>วันที่:</span>
                    <span>{formatDate(selectedOrder.createdAt)} {formatTime(selectedOrder.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>โต๊ะ / การสั่ง:</span>
                    <span className="font-semibold">{selectedOrder.tableName || 'Takeaway'}</span>
                  </div>
                  {selectedOrder.customerName && (
                    <div className="flex justify-between">
                      <span>ลูกค้า:</span>
                      <span>{selectedOrder.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1.5">
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px]">
                      <div className="flex-1 pr-2">
                        <div>{it.productName || it.productNameTh}</div>
                        {(it.variantName || it.selectedVariant?.nameTh) && (
                          <div className="text-[10px] text-neutral-500">({it.variantName || it.selectedVariant?.nameTh})</div>
                        )}
                        <div className="text-[10px] text-neutral-500">
                          {it.quantity} x {formatCurrency(it.unitPrice ?? it.basePrice)}
                        </div>
                      </div>
                      <div className="font-bold">{formatCurrency(it.subtotal ?? it.lineTotal)}</div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>ยอดรวม (Subtotal)</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {((selectedOrder.discountTotal ?? selectedOrder.discountAmount) > 0) && (
                    <div className="flex justify-between text-red-600">
                      <span>ส่วนลด (Discount)</span>
                      <span>-{formatCurrency(selectedOrder.discountTotal ?? selectedOrder.discountAmount)}</span>
                    </div>
                  )}
                  {((selectedOrder.serviceChargeTotal ?? selectedOrder.serviceChargeAmount) > 0) && (
                    <div className="flex justify-between">
                      <span>ค่าบริการ (Service Charge)</span>
                      <span>{formatCurrency(selectedOrder.serviceChargeTotal ?? selectedOrder.serviceChargeAmount)}</span>
                    </div>
                  )}
                  {((selectedOrder.taxTotal ?? selectedOrder.vatAmount) > 0) && (
                    <div className="flex justify-between">
                      <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                      <span>{formatCurrency(selectedOrder.taxTotal ?? selectedOrder.vatAmount)}</span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-dashed border-neutral-300 flex justify-between font-extrabold text-sm text-[#1F2937]">
                    <span>ยอดสุทธิ (Total)</span>
                    <span className="text-orange-600">{formatCurrency(selectedOrder.netTotal ?? selectedOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Payment info */}
                <div className="pt-2 text-[10px] text-neutral-500 space-y-0.5 text-center">
                  <div>ชำระโดย: {selectedOrder.payments?.[0]?.method?.toUpperCase() || selectedOrder.paymentMethod?.toUpperCase() || 'CASH'}</div>
                  <div>ขอบคุณที่ใช้บริการ / Thank you!</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
              <ReceiptText className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
              <p className="font-semibold text-sm">เลือกบิลทางซ้ายเพื่อดูใบเสร็จ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
