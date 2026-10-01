import React, { useState, useEffect } from 'react';
import { Order, OrderItem, KitchenStatus } from '../../types';
import { dbGetAll, dbPut } from '../../db';
import { useTranslation } from '../../i18n';
import {
  ChefHat,
  Clock,
  CheckCircle,
  Printer,
  AlertCircle,
  Filter,
  Flame,
  Coffee,
  IceCream,
  Utensils,
  Check,
} from 'lucide-react';

export const KitchenKDSView: React.FC = () => {
  const { t, language, formatTime } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stationFilter, setStationFilter] = useState<'all' | 'kitchen' | 'bar' | 'grill' | 'dessert'>('all');
  const [activePrintingOrder, setActivePrintingOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    const all = await dbGetAll<Order>('orders');
    // Active orders in kitchen
    const active = all.filter(
      (o) => o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served'
    );
    // Sort oldest first (FIFO - First in First Out in kitchens)
    active.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setOrders(active);
  };

  const handleUpdateItemStatus = async (orderId: string, itemId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const nextStatus: Record<KitchenStatus, KitchenStatus> = {
      pending: 'cooking',
      preparing: 'cooking',
      cooking: 'ready',
      ready: 'served',
      served: 'ready',
    };

    const updatedItems = targetOrder.items.map((item) => {
      if (item.id === itemId) {
        return { ...item, kitchenStatus: nextStatus[item.kitchenStatus] || 'ready' };
      }
      return item;
    });

    // Check if all are ready/served
    const allReady = updatedItems.every((i) => i.kitchenStatus === 'ready' || i.kitchenStatus === 'served');

    const updatedOrder: Order = {
      ...targetOrder,
      items: updatedItems,
      status: allReady ? 'served' : 'kitchen_preparing',
    };

    await dbPut('orders', updatedOrder);
    await loadOrders();
  };

  const handleMarkAllReady = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const updatedItems = targetOrder.items.map((i) => ({
      ...i,
      kitchenStatus: 'ready' as KitchenStatus,
    }));

    const updatedOrder: Order = {
      ...targetOrder,
      items: updatedItems,
      status: 'served',
    };

    await dbPut('orders', updatedOrder);
    await loadOrders();
  };

  const handlePrintKOT = (order: Order) => {
    setActivePrintingOrder(order);
    setTimeout(() => {
      window.print();
      setActivePrintingOrder(null);
    }, 200);
  };

  const stations = [
    { id: 'all', label: language === 'th' ? 'ทุกสเตชั่น' : 'All Stations', icon: <ChefHat className="w-3.5 h-3.5" /> },
    { id: 'kitchen', label: t.stationKitchen, icon: <Flame className="w-3.5 h-3.5 text-rose-500" /> },
    { id: 'bar', label: t.stationBar, icon: <Coffee className="w-3.5 h-3.5 text-sky-400" /> },
    { id: 'grill', label: t.stationGrill, icon: <Utensils className="w-3.5 h-3.5 text-amber-500" /> },
    { id: 'dessert', label: t.stationDessert, icon: <IceCream className="w-3.5 h-3.5 text-pink-400" /> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ChefHat className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-tight">{t.kitchenDisplay}</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold">
              {orders.length} {language === 'th' ? 'บิลรอทำ' : 'Active Tickets'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {language === 'th'
              ? 'แตะที่รายการอาหารเพื่อเปลี่ยนสถานะ (รอทำ → กำลังปรุง → เสร็จพร้อมเสิร์ฟ) หรือพิมพ์ใบสั่งครัว (KOT)'
              : 'Tap items to advance cooking status (Pending → Cooking → Ready → Served).'}
          </p>
        </div>

        {/* Station Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {stations.map((st) => (
            <button
              key={st.id}
              onClick={() => setStationFilter(st.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                stationFilter === st.id
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {st.icon}
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket Grid */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
          <ChefHat className="w-12 h-12 text-neutral-700 mx-auto mb-3 stroke-1" />
          <h3 className="text-sm font-bold text-neutral-400">
            {language === 'th' ? 'ไม่มีออเดอร์ค้างในครัว' : 'All clear! No active kitchen orders'}
          </h3>
          <p className="text-xs text-neutral-600 mt-1">
            {language === 'th' ? 'ออเดอร์ใหม่จากหน้าร้านจะแสดงที่นี่แบบเรียลไทม์' : 'New orders will automatically appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {orders.map((order) => {
            const diffMinutes = Math.floor(
              (Date.now() - new Date(order.createdAt).getTime()) / 60000
            );
            const isLate = diffMinutes >= 15;
            const isUrgent = diffMinutes >= 25;

            // Filter items for chosen station
            const displayItems = order.items.filter(
              (item) => stationFilter === 'all' || item.kitchenStation === stationFilter
            );

            if (displayItems.length === 0) return null;

            return (
              <div
                key={order.id}
                className={`bg-neutral-900 border rounded-2xl flex flex-col shadow-xl overflow-hidden transition ${
                  isUrgent
                    ? 'border-rose-500/80 shadow-rose-950/40 ring-1 ring-rose-500/40'
                    : isLate
                    ? 'border-amber-500/70 shadow-amber-950/40'
                    : 'border-neutral-800'
                }`}
              >
                {/* Ticket Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between ${
                    isUrgent
                      ? 'bg-rose-950/70 border-rose-900/60'
                      : isLate
                      ? 'bg-amber-950/60 border-amber-900/60'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div>
                    <div className="font-black text-white text-sm">
                      {order.tableName || (order.orderType === 'takeaway' ? 'กลับบ้าน' : 'เดลิเวอรี่')}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono font-semibold">
                      {order.orderNumber}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                        isUrgent
                          ? 'bg-rose-900 text-rose-200 animate-pulse'
                          : isLate
                          ? 'bg-amber-900 text-amber-200'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{diffMinutes} นาที</span>
                    </div>

                    <button
                      onClick={() => handlePrintKOT(order)}
                      className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition"
                      title="พิมพ์ใบสั่งครัว (KOT)"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="p-3 flex-1 space-y-2 overflow-y-auto max-h-[300px]">
                  {displayItems.map((item) => {
                    const isReady = item.kitchenStatus === 'ready';
                    const isCooking = item.kitchenStatus === 'cooking';
                    const isServed = item.kitchenStatus === 'served';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleUpdateItemStatus(order.id, item.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer select-none transition ${
                          isServed
                            ? 'bg-neutral-950/40 border-neutral-900 opacity-40 line-through'
                            : isReady
                            ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                            : isCooking
                            ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-200 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-extrabold text-sm text-white font-mono">
                              {item.quantity}x
                            </span>
                            <div>
                              <span className="font-bold text-xs">
                                {language === 'th' ? item.productNameTh : item.productNameEn}
                              </span>
                              {item.selectedVariant && (
                                <div className="text-[10px] text-amber-400">
                                  + {item.selectedVariant.nameTh}
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                              isReady
                                ? 'bg-emerald-900 text-emerald-300'
                                : isCooking
                                ? 'bg-amber-900 text-amber-300'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {isReady
                              ? t.itemStatusReady
                              : isCooking
                              ? t.itemStatusCooking
                              : t.itemStatusPending}
                          </span>
                        </div>

                        {item.notes && (
                          <div className="text-[11px] text-rose-300 font-bold mt-1 bg-rose-950/40 px-2 py-0.5 rounded">
                            ⚠️ {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer action */}
                <div className="p-2.5 bg-neutral-950/80 border-t border-neutral-800 flex justify-between items-center text-xs">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    สั่ง: {formatTime(order.createdAt)}
                  </span>
                  <button
                    onClick={() => handleMarkAllReady(order.id)}
                    className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <Check className="w-3 h-3" />
                    <span>{t.markAllReady}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printable Thermal Kitchen Ticket (KOT) */}
      {activePrintingOrder && (
        <div id="printable-receipt" className="max-w-[80mm] p-2 bg-white text-black font-mono text-xs">
          <div className="text-center font-bold text-sm pb-1 border-b border-black uppercase">
            *** ใบสั่งครัว (KOT) ***
          </div>
          <div className="py-1 border-b border-black text-[10px]">
            <div className="font-bold text-sm">
              {activePrintingOrder.tableName || activePrintingOrder.orderType.toUpperCase()}
            </div>
            <div>บิล: {activePrintingOrder.orderNumber}</div>
            <div>เวลา: {formatTime(activePrintingOrder.createdAt)}</div>
          </div>
          <div className="py-2 space-y-1.5 text-xs font-bold">
            {activePrintingOrder.items.map((item, idx) => (
              <div key={idx} className="border-b border-dashed border-neutral-400 pb-1">
                <div className="text-sm">
                  {item.quantity}x {item.productNameTh}
                </div>
                {item.selectedVariant && <div>+ {item.selectedVariant.nameTh}</div>}
                {item.notes && <div className="text-xs">*** {item.notes} ***</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
