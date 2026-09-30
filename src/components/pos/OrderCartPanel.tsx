import React, { useState } from 'react';
import {
  Order,
  OrderItem,
  OrderType,
  DeliveryPlatform,
  RestaurantSettings,
  Member,
  Promotion,
} from '../../types';
import { useTranslation } from '../../i18n';
import {
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Plus,
  Minus,
  Trash2,
  Send,
  CreditCard,
  Percent,
  MessageSquare,
  Users,
  Split,
  ChevronDown,
  X,
  FileText,
} from 'lucide-react';

interface OrderCartPanelProps {
  currentOrder: Order;
  settings: RestaurantSettings | null;
  onUpdateOrder: (updated: Order) => void;
  onSendToKitchen: () => void;
  onOpenCheckout: () => void;
  onOpenSplitBill: () => void;
  onClearOrder: () => void;
  onChangeTable: () => void;
}

export const OrderCartPanel: React.FC<OrderCartPanelProps> = ({
  currentOrder,
  settings,
  onUpdateOrder,
  onSendToKitchen,
  onOpenCheckout,
  onOpenSplitBill,
  onClearOrder,
  onChangeTable,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  // Handle changing item quantity
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const updatedItems = currentOrder.items
      .map((item) => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            lineTotal: newQty * item.basePrice,
          };
        }
        return item;
      })
      .filter(Boolean) as OrderItem[];

    recalculateAndNotify(updatedItems, currentOrder.orderType, currentOrder.discountAmount);
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = currentOrder.items.filter((item) => item.id !== itemId);
    recalculateAndNotify(updatedItems, currentOrder.orderType, currentOrder.discountAmount);
  };

  const handleOpenNoteModal = (item: OrderItem) => {
    setEditingNoteItemId(item.id);
    setTempNoteText(item.notes || '');
  };

  const handleSaveNote = () => {
    if (!editingNoteItemId) return;
    const updatedItems = currentOrder.items.map((item) => {
      if (item.id === editingNoteItemId) {
        return { ...item, notes: tempNoteText.trim() };
      }
      return item;
    });
    setEditingNoteItemId(null);
    recalculateAndNotify(updatedItems, currentOrder.orderType, currentOrder.discountAmount);
  };

  const handleChangeOrderType = (type: OrderType) => {
    recalculateAndNotify(currentOrder.items, type, currentOrder.discountAmount);
  };

  const recalculateAndNotify = (
    items: OrderItem[],
    type: OrderType,
    discountAmount: number
  ) => {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    let serviceChargeAmount = 0;
    if (settings?.serviceChargeEnabled && type === 'dine_in') {
      serviceChargeAmount = Number(
        ((discountedSubtotal * (settings.serviceChargeRate || 10)) / 100).toFixed(2)
      );
    }

    let vatAmount = 0;
    let totalAmount = discountedSubtotal + serviceChargeAmount;

    if (settings?.vatEnabled) {
      const vatRate = settings.vatRate || 7;
      if (settings.vatInclusive) {
        // Price already includes VAT
        vatAmount = Number(
          ((totalAmount * vatRate) / (100 + vatRate)).toFixed(2)
        );
      } else {
        // Price excludes VAT -> Add on top
        vatAmount = Number(((totalAmount * vatRate) / 100).toFixed(2));
        totalAmount += vatAmount;
      }
    }

    const grossProfit = Number((totalAmount - totalCost).toFixed(2));

    onUpdateOrder({
      ...currentOrder,
      orderType: type,
      items,
      subtotal,
      discountAmount,
      serviceChargeAmount,
      vatAmount,
      totalAmount: Number(totalAmount.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      grossProfit,
    });
  };

  const isDineIn = currentOrder.orderType === 'dine_in';
  const isTakeaway = currentOrder.orderType === 'takeaway';
  const isDelivery = currentOrder.orderType === 'delivery';

  // Check if any items are unprinted to kitchen
  const pendingKitchenItems = currentOrder.items.filter((i) => i.kitchenStatus === 'pending');

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden">
      {/* Top Header: Order Type and Table Info */}
      <div className="p-4 bg-neutral-950/80 border-b border-neutral-800 space-y-3">
        {/* Order Type Toggle */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-900 rounded-xl border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleChangeOrderType('dine_in')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              isDineIn ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>{t.dineIn}</span>
          </button>
          <button
            type="button"
            onClick={() => handleChangeOrderType('takeaway')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              isTakeaway ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{t.takeaway}</span>
          </button>
          <button
            type="button"
            onClick={() => handleChangeOrderType('delivery')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              isDelivery ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>{t.delivery}</span>
          </button>
        </div>

        {/* Dynamic Context Header (Table / Delivery details) */}
        <div className="flex items-center justify-between text-xs">
          {isDineIn ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onChangeTable}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-lg border border-neutral-700"
              >
                <span>{currentOrder.tableName || 'เลือกโต๊ะ'}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              <div className="flex items-center gap-1 text-neutral-400">
                <Users className="w-3.5 h-3.5" />
                <select
                  value={currentOrder.guestCount || 2}
                  onChange={(e) =>
                    onUpdateOrder({ ...currentOrder, guestCount: Number(e.target.value) || 1 })
                  }
                  className="bg-transparent text-white font-semibold focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((g) => (
                    <option key={g} value={g} className="bg-neutral-900 text-white">
                      {g} {t.guests}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : isDelivery ? (
            <div className="flex items-center gap-2">
              <select
                value={currentOrder.deliveryPlatform || 'grab'}
                onChange={(e) =>
                  onUpdateOrder({
                    ...currentOrder,
                    deliveryPlatform: e.target.value as DeliveryPlatform,
                  })
                }
                className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-emerald-400 font-bold text-xs"
              >
                <option value="grab">GrabFood</option>
                <option value="lineman">LINE MAN</option>
                <option value="shopeefood">ShopeeFood</option>
                <option value="robinhood">Robinhood</option>
                <option value="direct">ร้านส่งเอง (Direct)</option>
              </select>

              <input
                type="text"
                placeholder="เลขออเดอร์..."
                value={currentOrder.deliveryReference || ''}
                onChange={(e) =>
                  onUpdateOrder({ ...currentOrder, deliveryReference: e.target.value })
                }
                className="w-24 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-neutral-200 text-xs font-mono"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-300">บิลกลับบ้าน:</span>
              <input
                type="text"
                placeholder="ชื่อลูกค้า / เบอร์"
                value={currentOrder.customerName || ''}
                onChange={(e) =>
                  onUpdateOrder({ ...currentOrder, customerName: e.target.value })
                }
                className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-white text-xs w-36"
              />
            </div>
          )}

          <span className="font-mono text-neutral-500 font-semibold">
            {currentOrder.orderNumber}
          </span>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {currentOrder.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
            <UtensilsCrossed className="w-10 h-10 text-neutral-700 mb-2 stroke-1" />
            <div className="text-sm font-semibold text-neutral-400">{t.cartEmpty}</div>
            <p className="text-xs text-neutral-600 mt-1 max-w-[200px]">
              {language === 'th' ? 'แตะรายการอาหารทางซ้ายเพื่อเริ่มสั่ง' : 'Tap dishes on the menu to add'}
            </p>
          </div>
        ) : (
          currentOrder.items.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-2 transition hover:border-neutral-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-bold text-white text-xs leading-snug">
                    {language === 'th' ? item.productNameTh : item.productNameEn}
                  </div>

                  {/* Selected variant or modifiers */}
                  {item.selectedVariant && (
                    <div className="text-[11px] text-amber-400 font-medium">
                      + {language === 'th' ? item.selectedVariant.nameTh : item.selectedVariant.nameEn}
                    </div>
                  )}

                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <div className="text-[10px] text-neutral-400">
                      {item.selectedModifiers.map((m) => m.nameTh).join(', ')}
                    </div>
                  )}

                  {/* Custom Note */}
                  {item.notes ? (
                    <div
                      onClick={() => handleOpenNoteModal(item)}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-300/90 bg-amber-950/40 px-2 py-0.5 rounded cursor-pointer mt-1"
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{item.notes}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenNoteModal(item)}
                      className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mt-0.5"
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{language === 'th' ? '+ โน้ตครัว' : '+ note'}</span>
                    </button>
                  )}
                </div>

                {/* Line total */}
                <div className="font-mono font-bold text-xs text-white text-right shrink-0">
                  {formatCurrency(item.lineTotal)}
                </div>
              </div>

              {/* Quantity Stepper & Delete */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-xs">
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                  <span>@{formatCurrency(item.basePrice)}</span>
                  {item.kitchenStatus !== 'pending' && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-semibold">
                      ส่งครัวแล้ว
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="w-6 h-6 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <span className="font-bold text-white font-mono w-5 text-center">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="w-6 h-6 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 text-neutral-500 hover:text-rose-400 ml-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Financial Summary */}
      <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-2 text-xs">
        <div className="flex justify-between text-neutral-400">
          <span>{t.subtotal}</span>
          <span className="font-mono">{formatCurrency(currentOrder.subtotal)}</span>
        </div>

        {currentOrder.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-400 font-medium">
            <span>{t.discount} {currentOrder.promotionName && `(${currentOrder.promotionName})`}</span>
            <span className="font-mono">-{formatCurrency(currentOrder.discountAmount)}</span>
          </div>
        )}

        {currentOrder.serviceChargeAmount > 0 && (
          <div className="flex justify-between text-neutral-400">
            <span>{t.serviceCharge} ({settings?.serviceChargeRate}%)</span>
            <span className="font-mono">{formatCurrency(currentOrder.serviceChargeAmount)}</span>
          </div>
        )}

        {settings?.vatEnabled && (
          <div className="flex justify-between text-neutral-400">
            <span>
              {t.tax} ({settings.vatRate}%) {settings.vatInclusive && '(รวมในราคาแล้ว)'}
            </span>
            <span className="font-mono">{formatCurrency(currentOrder.vatAmount)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-neutral-800 flex items-baseline justify-between">
          <span className="font-extrabold text-sm text-white">{t.total}</span>
          <div className="text-right">
            <span className="font-black text-2xl text-amber-400 font-mono">
              {formatCurrency(currentOrder.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 bg-neutral-950/90 border-t border-neutral-800 grid grid-cols-2 gap-2">
        {/* Send to Kitchen / KOT */}
        <button
          type="button"
          onClick={onSendToKitchen}
          disabled={currentOrder.items.length === 0}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            pendingKitchenItems.length > 0
              ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/40 animate-pulse'
              : 'bg-neutral-800/60 text-neutral-400 border border-neutral-800 hover:text-white'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t.sendToKitchen} {pendingKitchenItems.length > 0 && `(${pendingKitchenItems.length})`}</span>
        </button>

        {/* Split Bill */}
        <button
          type="button"
          onClick={onOpenSplitBill}
          disabled={currentOrder.items.length === 0}
          className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
        >
          <Split className="w-3.5 h-3.5 text-sky-400" />
          <span>{t.splitBill}</span>
        </button>

        {/* Clear Order */}
        <button
          type="button"
          onClick={onClearOrder}
          className="py-2.5 px-3 bg-neutral-900 hover:bg-rose-950/50 hover:border-rose-800 text-neutral-400 hover:text-rose-300 border border-neutral-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.clearCart}</span>
        </button>

        {/* Primary Checkout Button */}
        <button
          type="button"
          onClick={onOpenCheckout}
          disabled={currentOrder.items.length === 0}
          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 transition"
        >
          <CreditCard className="w-4 h-4" />
          <span>{t.checkout}</span>
        </button>
      </div>

      {/* Note Editor Modal */}
      {editingNoteItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-xs font-bold text-white">ระบุข้อความพิเศษสำหรับครัว</span>
              <button onClick={() => setEditingNoteItemId(null)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={2}
              value={tempNoteText}
              onChange={(e) => setTempNoteText(e.target.value)}
              placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผักชี, ขอช้อนส้อม 2 คู่"
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white resize-none focus:outline-none focus:border-amber-500"
            />

            {/* Quick preset note tags */}
            <div className="flex flex-wrap gap-1">
              {['เผ็ดน้อย', 'ไม่เผ็ด', 'ไม่ใส่ผักชี', 'ไม่ใส่กระเทียม', 'หวานน้อย', 'แยกน้ำแข็ง'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTempNoteText((prev) => (prev ? `${prev}, ${tag}` : tag))}
                  className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded"
                >
                  +{tag}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setEditingNoteItemId(null)}
                className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-4 py-1 text-xs bg-amber-500 font-bold text-neutral-950 rounded-lg"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
