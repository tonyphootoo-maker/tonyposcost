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
  AlertCircle,
  Volume2,
  VolumeX,
  FileCode,
  Plus,
  Upload,
  X,
  Download,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { dbGetAll, dbPut } from '../../db';
import { Order, OrderItem } from '../../types';
import { showToast } from '../common/ToastContainer';
import { onlineOrderSource, IngestedOnlineOrder } from '../../integrations/onlineOrders';
import { playOrderAlertChime } from '../../utils/audioAlert';

interface OnlineOrdersViewProps {
  onOrderUpdated?: () => void;
}

export const OnlineOrdersView: React.FC<OnlineOrdersViewProps> = ({ onOrderUpdated }) => {
  const { t, formatCurrency, formatDate, formatTime } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'completed'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Sound toggle (Web Audio)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('tony_online_order_sound') !== 'false';
  });

  // Import JSON Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    loadOnlineOrders();
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('tony_online_order_sound', String(next));
    if (next) {
      playOrderAlertChime();
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
  };

  const loadOnlineOrders = async () => {
    try {
      const allOrders = await dbGetAll<Order>('orders');
      // Filter orders that are delivery or online
      const deliveryOrders = allOrders.filter(
        (o) => o.orderType === 'delivery' || o.source === 'online' || (o.notes && o.notes.includes('Online'))
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

  // (a) Manual "Add test/online order"
  const handleAddTestOrder = async () => {
    const testData = onlineOrderSource.createTestOrder();
    await ingestOrder(testData);
  };

  // Convert IngestedOnlineOrder to Order entity
  const ingestOrder = async (ingested: IngestedOnlineOrder) => {
    const newOrderId = `ord_${Date.now()}`;
    const orderItems: OrderItem[] = ingested.items.map((item, idx) => ({
      id: `line_${Date.now()}_${idx}`,
      productId: item.productId,
      productName: item.name,
      productNameTh: item.name,
      productNameEn: item.name,
      quantity: item.qty,
      basePrice: item.unitPrice,
      unitPrice: item.unitPrice,
      unitCost: item.unitCostSnapshot || 0,
      unitCostSnapshot: item.unitCostSnapshot || 0,
      lineTotal: item.unitPrice * item.qty,
      selectedModifiers: item.modifiers?.map((m, mIdx) => ({
        id: `mod_${mIdx}`,
        groupId: `grp_${mIdx}`,
        name: `${m.groupName}: ${m.optionName}`,
        nameTh: `${m.groupName}: ${m.optionName}`,
        nameEn: `${m.groupName}: ${m.optionName}`,
        priceDelta: m.priceDelta,
      })) || [],
      notes: item.note,
      kitchenStatus: 'pending',
      kitchenStation: 'kitchen',
      orderedAt: new Date().toISOString(),
    }));

    const newOrder: Order = {
      id: newOrderId,
      orderNumber: ingested.externalId,
      orderType: 'delivery',
      platformId: ingested.source,
      source: 'online',
      status: 'open',
      kitchenStatus: 'pending',
      guestCount: 1,
      items: orderItems,
      subtotal: ingested.subtotal,
      discountAmount: 0,
      serviceChargeAmount: 0,
      vatAmount: 0,
      totalAmount: ingested.total,
      totalCost: orderItems.reduce((sum, it) => sum + (it.unitCostSnapshot || 0) * it.quantity, 0),
      grossProfit: ingested.total - orderItems.reduce((sum, it) => sum + (it.unitCostSnapshot || 0) * it.quantity, 0),
      notes: `${ingested.customerName ? `ผู้สั่ง: ${ingested.customerName}` : ''}${
        ingested.customerPhone ? ` (${ingested.customerPhone})` : ''
      }${ingested.note ? `\nหมายเหตุ: ${ingested.note}` : ''}`,
      createdAt: ingested.createdAt,
    };

    await dbPut('orders', newOrder);

    // Sound chime
    if (soundEnabled) {
      playOrderAlertChime();
    }

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`ออเดอร์ออนไลน์ใหม่: ${newOrder.orderNumber}`, {
          body: `${ingested.customerName || 'ลูกค้าออนไลน์'} สั่ง ${newOrder.items.length} รายการ (฿${newOrder.totalAmount})`,
          icon: '/favicon.ico',
        });
      } catch {
        // ignore
      }
    }

    showToast({
      title: 'มีออเดอร์ออนไลน์ใหม่!',
      message: `${newOrder.orderNumber} (${ingested.source.toUpperCase()}) - ฿${newOrder.totalAmount}`,
      type: 'info',
    });

    await loadOnlineOrders();
    setSelectedOrder(newOrder);
    onOrderUpdated?.();
  };

  // (b) Import online orders (JSON)
  const handleImportJson = async () => {
    setImportError('');
    if (!jsonInput.trim()) {
      setImportError('กรุณาวางเนื้อหา JSON');
      return;
    }

    const result = onlineOrderSource.parseJson(jsonInput);
    if (!result.success || !result.orders) {
      setImportError(result.error || 'JSON ไม่ถูกต้อง');
      return;
    }

    for (const ord of result.orders) {
      await ingestOrder(ord);
    }

    showToast({
      title: 'นำเข้าสำเร็จ',
      message: `นำเข้าออเดอร์จำนวน ${result.orders.length} รายการเรียบร้อย`,
      type: 'success',
    });

    setIsImportModalOpen(false);
    setJsonInput('');
  };

  const handleAcceptOrder = async (order: Order) => {
    try {
      const updated: Order = {
        ...order,
        status: 'open',
        kitchenStatus: 'cooking',
        items: order.items.map((item) => ({
          ...item,
          kitchenStatus: 'cooking' as const,
          sentToKitchenAt: new Date().toISOString(),
        })),
      };
      await dbPut('orders', updated);
      showToast({
        title: 'รับออเดอร์แล้ว',
        message: `${order.orderNumber} ส่งเข้าครัวเรียบร้อย`,
        type: 'success',
      });
      await loadOnlineOrders();
      setSelectedOrder(updated);
      onOrderUpdated?.();
    } catch {
      showToast({ title: 'Error', message: 'Failed to accept order', type: 'error' });
    }
  };

  const handleRejectOrder = async (order: Order) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธ/ยกเลิกออเดอร์นี้?')) return;
    try {
      const updated: Order = {
        ...order,
        status: 'cancelled',
        kitchenStatus: 'served',
      };
      await dbPut('orders', updated);
      showToast({ title: 'ยกเลิกสำเร็จ', message: 'ยกเลิกออเดอร์เรียบร้อยแล้ว', type: 'info' });
      await loadOnlineOrders();
      setSelectedOrder(updated);
      onOrderUpdated?.();
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
        paidAt: new Date().toISOString(),
        items: order.items.map((it) => ({ ...it, kitchenStatus: 'served' as const })),
      };
      await dbPut('orders', updated);
      showToast({ title: 'สำเร็จ', message: 'ออเดอร์ชำระเงินและเสร็จสิ้นแล้ว', type: 'success' });
      await loadOnlineOrders();
      setSelectedOrder(updated);
      onOrderUpdated?.();
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
            <span>{t.onlineOrdersTitle || 'กล่องข้อความออเดอร์ออนไลน์ (Online Inbox)'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">
              {orders.filter((o) => o.status === 'open' && o.kitchenStatus === 'pending').length} รอดำเนินการ
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            ศูนย์รวมออเดอร์จาก Grab, LINE MAN, Foodpanda และช่องทางออนไลน์ของร้าน
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={toggleSound}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer min-h-[40px] ${
              soundEnabled
                ? 'bg-orange-50 border-[#FDBA74] text-orange-800'
                : 'bg-neutral-100 border-neutral-300 text-neutral-500'
            }`}
            title="เปิด/ปิด เสียงเตือนเมื่อมีออเดอร์ใหม่"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-orange-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'เสียงเตือน: เปิด' : 'เสียงเตือน: ปิด'}</span>
          </button>

          {/* Browser Notification Button */}
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="px-3 py-2 bg-white hover:bg-orange-50 border border-[#FED7AA] text-[#374151] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer min-h-[40px]"
            title="ขอสิทธิ์แจ้งเตือนบนเบราว์เซอร์"
          >
            <BellRing className="w-4 h-4 text-orange-500" />
            <span>แจ้งเตือน Browser</span>
          </button>

          {/* (a) Add Test Order Button */}
          <button
            type="button"
            onClick={handleAddTestOrder}
            className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ เพิ่มออเดอร์ทดสอบ</span>
          </button>

          {/* (b) Import JSON Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer min-h-[40px]"
          >
            <Upload className="w-4 h-4" />
            <span>นำเข้า JSON</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#FED7AA] overflow-x-auto">
        {(['all', 'pending', 'accepted', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg min-h-[38px] transition whitespace-nowrap cursor-pointer ${
              statusFilter === filter
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            {filter === 'all'
              ? 'ทั้งหมด (' + orders.length + ')'
              : filter === 'pending'
              ? 'รอรับออเดอร์ (' + orders.filter((o) => o.status === 'open' && o.kitchenStatus === 'pending').length + ')'
              : filter === 'accepted'
              ? 'กำลังทำในครัว'
              : 'เสร็จสิ้นแล้ว'}
          </button>
        ))}
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
              placeholder="ค้นหาเลขออเดอร์หรือชื่อผู้สั่ง..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
            />
          </div>

          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#FED7AA] text-center text-[#6B7280]">
                <Truck className="w-10 h-10 mx-auto text-orange-300 mb-2" />
                <p className="font-semibold text-sm">ยังไม่มีออเดอร์ในหมวดนี้</p>
                <p className="text-xs text-neutral-400 mt-1">
                  กดปุ่ม "+ เพิ่มออเดอร์ทดสอบ" หรือ "นำเข้า JSON" เพื่อทดลองระบบ
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
                        ? 'bg-orange-50/70 border-orange-500 shadow-xs'
                        : 'bg-white border-[#FED7AA] hover:bg-orange-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#1F2937] text-sm">{order.orderNumber}</span>
                        {order.platformId && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-orange-100 text-orange-800">
                            {order.platformId}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-orange-600 text-sm">
                        ฿{order.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(order.createdAt)}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isPending
                            ? 'bg-red-100 text-red-700 animate-pulse'
                            : order.kitchenStatus === 'cooking'
                            ? 'bg-amber-100 text-amber-800'
                            : order.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {isPending
                          ? 'รอรับออเดอร์'
                          : order.kitchenStatus === 'cooking'
                          ? 'กำลังทำ'
                          : order.status === 'paid'
                          ? 'เสร็จสิ้น'
                          : order.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Order Detail View */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#FED7AA]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1F2937]">{selectedOrder.orderNumber}</h2>
                    {selectedOrder.platformId && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-100 text-orange-800 uppercase">
                        {selectedOrder.platformId}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#6B7280] mt-0.5">
                    สั่งเมื่อ {formatDate(selectedOrder.createdAt)} {formatTime(selectedOrder.createdAt)}
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2">
                  {selectedOrder.status === 'open' && selectedOrder.kitchenStatus === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAcceptOrder(selectedOrder)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[40px]"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>รับออเดอร์ & ส่งครัว</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectOrder(selectedOrder)}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>ปฏิเสธ</span>
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'open' && selectedOrder.kitchenStatus === 'cooking' && (
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted(selectedOrder)}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer min-h-[40px]"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>ส่งมอบ & ชำระเสร็จสิ้น</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Delivery Info */}
              {selectedOrder.notes && (
                <div className="bg-[#FFF8EE] p-3 rounded-xl border border-[#FED7AA] text-xs text-[#1F2937] space-y-1">
                  <div className="font-bold text-[#EA580C] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    ข้อมูลผู้สั่งและหมายเหตุ:
                  </div>
                  <p className="text-[#374151] pl-5 whitespace-pre-wrap">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-[#6B7280]">
                  รายการอาหาร ({selectedOrder.items.length})
                </h3>
                <div className="border border-[#FED7AA] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FFFBF5] font-bold text-[#6B7280] border-b border-[#FED7AA]">
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
                            <div className="font-bold text-[#1F2937]">{item.productName || item.productNameTh}</div>
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="text-[11px] text-[#6B7280]">
                                {item.selectedModifiers.map((m) => m.name || m.nameTh).join(', ')}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-[11px] text-[#EA580C] italic">โน้ต: {item.notes}</div>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-[#1F2937]">x{item.quantity}</td>
                          <td className="p-3 text-right text-[#6B7280]">
                            ฿{(item.unitPrice ?? item.basePrice).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-bold text-[#1F2937]">
                            ฿{(item.lineTotal || ((item.unitPrice ?? item.basePrice) * item.quantity)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-[#FFFBF5] p-4 rounded-xl border border-[#FED7AA] space-y-1.5 text-xs text-[#1F2937]">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">ยอดรวมอาหาร (Subtotal)</span>
                  <span className="font-bold">฿{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#FED7AA] flex justify-between items-center text-sm font-extrabold text-[#1F2937]">
                  <span>ยอดสุทธิที่ต้องชำระ</span>
                  <span className="text-lg text-orange-600 font-mono">
                    ฿{selectedOrder.totalAmount.toFixed(2)}
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

      {/* Modal: Import JSON (Section 7.5) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-[#111827] text-base">
                  นำเข้าออเดอร์ออนไลน์ผ่าน JSON (OnlineOrderSource)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-[#6B7280] hover:text-[#111827] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-xs text-[#6B7280]">
                วางโครงสร้าง JSON ตามสเปก `IngestedOnlineOrder` ระบบจะตรวจสอบความถูกต้องและนำเข้าออเดอร์เข้าสู่คิวหน้าร้านทันที
              </p>

              {importError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {importError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">JSON Payload</label>
                <textarea
                  rows={8}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{\n  "externalId": "GRAB-9821",\n  "source": "grab",\n  "customerName": "คุณสมชาย",\n  "customerPhone": "0812345678",\n  "items": [\n    { "productId": "p1", "name": "ผัดกะเพราเนื้อ", "qty": 1, "unitPrice": 95 }\n  ],\n  "total": 95\n}`}
                  className="w-full p-3 font-mono text-xs bg-[#FFF8EE] border border-[#FED7AA] rounded-xl focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setJsonInput(JSON.stringify(onlineOrderSource.createTestOrder(), null, 2))
                  }
                  className="text-xs text-orange-600 font-bold hover:underline cursor-pointer"
                >
                  โหลดตัวอย่าง JSON จำลอง
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 border border-[#FED7AA] rounded-xl text-xs font-bold text-[#374151] hover:bg-neutral-100 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleImportJson}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    นำเข้าออเดอร์
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
