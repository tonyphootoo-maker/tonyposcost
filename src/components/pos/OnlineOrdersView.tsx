import React, { useState, useEffect } from 'react';
import {
  BellRing,
  CheckCircle,
  XCircle,
  Truck,
  Phone,
  MapPin,
  Clock,
  Search,
  AlertCircle
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { dbGetAll, dbPut, dbGet } from '../../db';
import { Order, OrderItem } from '../../types';
import { showToast } from '../common/ToastContainer';

interface OnlineOrdersViewProps {
  onOrderUpdated?: () => void;
}

export const OnlineOrdersView: React.FC<OnlineOrdersViewProps> = ({ onOrderUpdated }) => {
  const { t, formatCurrency, formatDate, formatTime } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'completed'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOnlineOrders();
  }, []);

  const loadOnlineOrders = async () => {
    try {
      const allOrders = await dbGetAll<Order>('orders');
      // Filter orders that are delivery or takeaway online orders
      const deliveryOrders = allOrders.filter(
        (o) => o.orderType === 'delivery' || (o.notes && o.notes.includes('Online'))
      );
      // Sort newest first
      deliveryOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(deliveryOrders);
      if (deliveryOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(deliveryOrders[0]);
      }
    } catch {
      showToast({ title: 'Error', message: 'Failed to load online orders', type: 'error' });
    }
  };

  const handleAcceptOrder = async (order: Order) => {
    try {
      const updated: Order = {
        ...order,
        status: 'kitchen_preparing',
        kitchenStatus: 'cooking',
        items: order.items.map((item) => ({ ...item, kitchenStatus: 'cooking' as const })),
      };
      await dbPut('orders', updated);
      showToast({ title: t.saveSuccess || 'สำเร็จ', message: t.kitchenSent || 'ส่งรายการเข้าครัวแล้ว', type: 'success' });
      loadOnlineOrders();
      if (onOrderUpdated) onOrderUpdated();
    } catch {
      showToast({ title: 'Error', message: 'Failed to accept order', type: 'error' });
    }
  };

  const handleRejectOrder = async (order: Order) => {
    if (!confirm(t.confirmDeleteMsg || 'คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธ/ยกเลิกออเดอร์นี้?')) return;
    try {
      const updated: Order = {
        ...order,
        status: 'cancelled',
        kitchenStatus: 'served',
      };
      await dbPut('orders', updated);
      showToast({ title: t.deleteSuccess || 'สำเร็จ', message: 'ยกเลิกออเดอร์แล้ว', type: 'success' });
      loadOnlineOrders();
      if (onOrderUpdated) onOrderUpdated();
    } catch {
      showToast({ title: 'Error', message: 'Failed to reject order', type: 'error' });
    }
  };

  const handleMarkCompleted = async (order: Order) => {
    try {
      const updated: Order = {
        ...order,
        status: 'paid',
        kitchenStatus: 'served',
        items: order.items.map((it) => ({ ...it, kitchenStatus: 'served' as const })),
      };
      await dbPut('orders', updated);
      showToast({ title: t.saveSuccess || 'สำเร็จ', message: 'เสร็จสิ้นออเดอร์แล้ว', type: 'success' });
      loadOnlineOrders();
      if (onOrderUpdated) onOrderUpdated();
    } catch {
      showToast({ title: 'Error', message: 'Failed to update order', type: 'error' });
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes && o.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'pending') {
      return matchesSearch && o.status === 'open' && o.kitchenStatus === 'pending';
    }
    if (statusFilter === 'accepted') {
      return matchesSearch && o.status === 'open' && o.kitchenStatus === 'cooking';
    }
    if (statusFilter === 'completed') {
      return matchesSearch && o.status === 'paid';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <BellRing className="w-6 h-6 text-orange-500" />
            {t.onlineOrdersTitle || 'กล่องข้อความออเดอร์ออนไลน์ (Inbox)'}
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            จัดการคำสั่งซื้อเดลิเวอรี่และสั่งกลับบ้านจากช่องทางออนไลน์
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#FFFBF5] p-1 rounded-xl border border-[#FED7AA]">
          {(['all', 'pending', 'accepted', 'completed'] as const).map((filter) => (
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
                : filter === 'pending'
                ? 'รอรับ (' + orders.filter((o) => o.status === 'open' && o.kitchenStatus === 'pending').length + ')'
                : filter === 'accepted'
                ? 'กำลังทำ'
                : 'เสร็จแล้ว'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Orders List & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search || 'ค้นหาเลขออเดอร์หรือที่อยู่...'}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
                <Truck className="w-10 h-10 mx-auto text-orange-300 mb-2" />
                <p className="font-semibold text-sm">{t.emptyState || 'ยังไม่มีออเดอร์'}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  เมื่อมีลูกค้าสั่งผ่านช่องทางเดลิเวอรี่จะปรากฏที่นี่
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isPending = order.status === 'open' && order.kitchenStatus === 'pending';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-orange-50/60 border-orange-500 shadow-xs'
                        : 'bg-white border-[#FED7AA] hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1F2937]">#{order.orderNumber}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-100 text-orange-700">
                          {order.orderType === 'delivery' ? 'Delivery' : 'Takeaway'}
                        </span>
                      </div>
                      <span className="font-extrabold text-sm text-orange-600">
                        {formatCurrency(order.netTotal ?? order.totalAmount)}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-[#6B7280] flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {formatTime(order.createdAt)}
                      </span>
                      <span className="font-medium text-[#1F2937]">
                        {order.items.length} {t.all ? 'รายการ' : 'items'}
                      </span>
                    </div>

                    {isPending && (
                      <div className="mt-2 pt-2 border-t border-orange-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                          รอการกดรับ
                        </span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleRejectOrder(order)}
                            className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg min-h-[36px]"
                          >
                            ปฏิเสธ
                          </button>
                          <button
                            onClick={() => handleAcceptOrder(order)}
                            className="px-3 py-1 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-xs min-h-[36px]"
                          >
                            รับออเดอร์
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Order Details */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#FED7AA]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1F2937]">
                      ออเดอร์ #{selectedOrder.orderNumber}
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selectedOrder.status === 'paid'
                        ? 'ชำระเงินแล้ว'
                        : selectedOrder.kitchenStatus === 'cooking'
                        ? 'กำลังทำอาหาร'
                        : 'รอรับออเดอร์'}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    สั่งเมื่อ: {formatDate(selectedOrder.createdAt)} {formatTime(selectedOrder.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.status === 'open' && (
                    <>
                      {selectedOrder.kitchenStatus === 'pending' ? (
                        <button
                          onClick={() => handleAcceptOrder(selectedOrder)}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {t.acceptOrder || 'รับออเดอร์ & ส่งครัว'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkCompleted(selectedOrder)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          ทำเสร็จและจัดส่งแล้ว
                        </button>
                      )}
                      <button
                        onClick={() => handleRejectOrder(selectedOrder)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold rounded-xl text-sm min-h-[44px] flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        {t.rejectOrder || 'ปฏิเสธ'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Delivery Info */}
              {selectedOrder.notes && (
                <div className="bg-orange-50/60 p-3 rounded-xl border border-orange-200 text-xs text-[#1F2937] space-y-1">
                  <div className="font-bold text-orange-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    ข้อมูลการจัดส่งและผู้ติดต่อ:
                  </div>
                  <p className="text-[#1F2937] pl-5 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-wider uppercase text-[#6B7280]">
                  รายการอาหาร ({selectedOrder.items.length})
                </h3>
                <div className="border border-[#FED7AA] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#FFFBF5] text-xs font-bold text-[#6B7280] border-b border-[#FED7AA]">
                      <tr>
                        <th className="p-3">เมนู</th>
                        <th className="p-3 text-center">จำนวน</th>
                        <th className="p-3 text-right">ราคา</th>
                        <th className="p-3 text-right">รวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FED7AA]">
                      {selectedOrder.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-[#1F2937]">{item.productName || item.productNameTh}</div>
                            {(item.variantName || item.selectedVariant?.nameTh) && (
                              <div className="text-xs text-orange-600 font-medium">
                                ({item.variantName || item.selectedVariant?.nameTh})
                              </div>
                            )}
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="text-xs text-[#6B7280]">
                                {item.selectedModifiers.map((m) => m.name || m.nameTh).join(', ')}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-xs text-amber-700 italic">โน้ต: {item.notes}</div>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-[#1F2937]">x{item.quantity}</td>
                          <td className="p-3 text-right text-[#6B7280]">
                            {formatCurrency(item.unitPrice ?? item.basePrice)}
                          </td>
                          <td className="p-3 text-right font-bold text-[#1F2937]">
                            {formatCurrency(item.subtotal ?? item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-[#FFFBF5] p-3.5 rounded-xl border border-[#FED7AA] space-y-1.5 text-xs text-[#1F2937]">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">ยอดรวมย่อย (Subtotal)</span>
                  <span className="font-semibold">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {((selectedOrder.discountTotal ?? selectedOrder.discountAmount) > 0) && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>ส่วนลด (Discount)</span>
                    <span>-{formatCurrency(selectedOrder.discountTotal ?? selectedOrder.discountAmount)}</span>
                  </div>
                )}
                {((selectedOrder.taxTotal ?? selectedOrder.vatAmount) > 0) && (
                  <div className="flex justify-between text-[#6B7280]">
                    <span>ภาษี (VAT)</span>
                    <span>{formatCurrency(selectedOrder.taxTotal ?? selectedOrder.vatAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#FED7AA] flex justify-between items-center text-sm font-extrabold text-[#1F2937]">
                  <span>ยอดสุทธิทั้งหมด</span>
                  <span className="text-base text-orange-600">
                    {formatCurrency(selectedOrder.netTotal ?? selectedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
              <BellRing className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
              <p className="font-semibold text-sm">เลือกออเดอร์ทางซ้ายเพื่อดูรายละเอียด</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
