import React, { useState } from 'react';
import {
  Order,
  OrderItem,
  OrderType,
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
  MessageSquare,
  Users,
  ChevronDown,
  X,
  GripVertical,
  ChevronUp,
  Search,
  Printer,
  PauseCircle,
} from 'lucide-react';
import { dbGetAll, dbPut } from '../../db';
import { showToast } from '../common/ToastContainer';

interface OrderCartPanelProps {
  currentOrder: Order;
  settings: RestaurantSettings | null;
  onUpdateOrder: (updated: Order) => void;
  onSendToKitchen: () => void;
  onReprintKitchen?: () => void;
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
  onReprintKitchen,
  onOpenCheckout,
  onClearOrder,
  onChangeTable,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberPhoneInput, setMemberPhoneInput] = useState('');
  const [foundMember, setFoundMember] = useState<Member | null>(null);
  const [memberSearchError, setMemberSearchError] = useState('');

  // Update item quantity
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
    const targetItem = currentOrder.items.find((item) => item.id === itemId);
    if (!targetItem) return;

    const wasSentToKitchen = Boolean(
      targetItem.sentToKitchenAt ||
      targetItem.kitchenStatus === 'cooking' ||
      targetItem.kitchenStatus === 'ready' ||
      targetItem.kitchenStatus === 'preparing'
    );

    if (wasSentToKitchen) {
      if (
        !confirm(
          language === 'th'
            ? `รายการ "${targetItem.productNameTh || targetItem.name}" ส่งเข้าครัวแล้ว ต้องการยกเลิก (VOID) ใช่หรือไม่?`
            : `Item "${targetItem.productNameTh || targetItem.name}" was already sent to kitchen. Confirm VOID?`
        )
      ) {
        return;
      }
      showToast({
        title: language === 'th' ? 'ยกเลิกรายการส่งครัว (VOID)' : 'Item Voided',
        message:
          language === 'th'
            ? `ส่งใบยกเลิก (VOID Ticket) ไปยังครัวแล้ว: ${targetItem.productNameTh || targetItem.name}`
            : `Sent VOID ticket to kitchen: ${targetItem.productNameTh || targetItem.name}`,
        type: 'info',
      });
    }

    const updatedItems = currentOrder.items.filter((item) => item.id !== itemId);
    recalculateAndNotify(updatedItems, currentOrder.orderType, currentOrder.discountAmount);
  };

  // Reorder item up / down
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.items.length) return;

    const newItems = [...currentOrder.items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    recalculateAndNotify(newItems, currentOrder.orderType, currentOrder.discountAmount);
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
    const isDelivery = type === 'delivery';
    const isTakeaway = type === 'takeaway';
    const nextMode: 'table' | 'pay-now' = (isDelivery || isTakeaway) ? 'pay-now' : (currentOrder.mode || 'table');
    recalculateAndNotify(
      currentOrder.items,
      type,
      currentOrder.discountAmount,
      undefined,
      nextMode,
      (nextMode === 'pay-now' || isTakeaway)
        ? (currentOrder.queueNo ? String(currentOrder.queueNo) : `Q-${Date.now().toString().slice(-3)}`)
        : (currentOrder.queueNo ? String(currentOrder.queueNo) : undefined)
    );
  };

  const handleChangeMode = (mode: 'table' | 'pay-now') => {
    const updated: Order = {
      ...currentOrder,
      mode,
      queueNo: mode === 'pay-now' ? (currentOrder.queueNo || `Q-${Date.now().toString().slice(-3)}`) : undefined,
    };
    onUpdateOrder(updated);
  };

  const handleHoldOrder = async () => {
    if (currentOrder.items.length === 0) return;
    try {
      const orderToHold: Order = {
        ...currentOrder,
        status: 'open',
      };
      await dbPut('orders', orderToHold);
      showToast({
        title: language === 'th' ? 'พักบิลเรียบร้อย' : 'Order Held',
        message: language === 'th'
          ? `บันทึกบิล ${orderToHold.orderNumber} แล้ว สามารถเปิดต่อได้จากเมนูบิลขาย`
          : `Saved order ${orderToHold.orderNumber}. Can resume from Bills view.`,
        type: 'success',
      });
      onClearOrder();
    } catch {
      showToast({ title: 'Error', message: 'Failed to hold order', type: 'error' });
    }
  };

  // Member search
  const handleSearchMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberSearchError('');
    setFoundMember(null);
    if (!memberPhoneInput.trim()) return;

    try {
      const allMembers = await dbGetAll<Member>('members');
      const cleanPhone = memberPhoneInput.trim().replace(/[-\s]/g, '');
      const match = allMembers.find((m) => m.phone.replace(/[-\s]/g, '') === cleanPhone);

      if (match) {
        setFoundMember(match);
      } else {
        setMemberSearchError(language === 'th' ? 'ไม่พบข้อมูลสมาชิกรหัสนี้' : 'Member not found');
      }
    } catch {
      setMemberSearchError(language === 'th' ? 'เกิดข้อผิดพลาดในการค้นหา' : 'Search failed');
    }
  };

  const handleApplyMember = (member: Member | null) => {
    let discount = currentOrder.discountAmount;
    // Apply discount rule based on member tier if present
    if (member) {
      if (member.tier === 'gold') discount = Math.round(currentOrder.subtotal * 0.1);
      else if (member.tier === 'silver') discount = Math.round(currentOrder.subtotal * 0.05);
      else if (member.tier === 'platinum') discount = Math.round(currentOrder.subtotal * 0.15);
    } else {
      discount = 0;
    }

    const updated: Order = {
      ...currentOrder,
      memberId: member ? member.id : undefined,
      memberName: member ? member.name : undefined,
      memberPhone: member ? member.phone : undefined,
      discountAmount: discount,
    };
    recalculateAndNotify(updated.items, updated.orderType, discount, member || undefined);
    setIsMemberModalOpen(false);
  };

  // Recalculate totals
  const recalculateAndNotify = (
    items: OrderItem[],
    type: OrderType,
    discountAmount: number,
    member?: Member,
    mode?: 'table' | 'pay-now',
    platformId?: string,
    queueNo?: string
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
        vatAmount = Number(((totalAmount * vatRate) / (100 + vatRate)).toFixed(2));
      } else {
        vatAmount = Number(((totalAmount * vatRate) / 100).toFixed(2));
        totalAmount += vatAmount;
      }
    }

    const grossProfit = Number((totalAmount - totalCost).toFixed(2));

    const updated: Order = {
      ...currentOrder,
      orderType: type,
      mode: mode !== undefined ? mode : currentOrder.mode,
      platformId: platformId !== undefined ? platformId : currentOrder.platformId,
      queueNo: queueNo !== undefined ? queueNo : currentOrder.queueNo,
      items,
      subtotal,
      discountAmount,
      serviceChargeAmount,
      vatAmount,
      totalAmount: Number(totalAmount.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      grossProfit,
      memberId: member !== undefined ? member?.id : currentOrder.memberId,
      memberName: member !== undefined ? member?.name : currentOrder.memberName,
      memberPhone: member !== undefined ? member?.phone : currentOrder.memberPhone,
    };

    onUpdateOrder(updated);
  };

  const totalItemsCount = currentOrder.items.reduce((sum, item) => sum + item.quantity, 0);
  const isOrderEmpty = currentOrder.items.length === 0;

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-l border-[#FED7AA] shadow-xs select-none">
      {/* Top Header Section: Order Type, Mode, Table/Queue/Platform & Member (Section 7.1) */}
      <div className="p-3 border-b border-[#FED7AA] bg-[#FFFFFF] space-y-2">
        {/* Row 1: Order Type & Mode Selectors (Both >= 44px) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Order Type Selector */}
          <div className="relative">
            <select
              value={currentOrder.orderType}
              onChange={(e) => handleChangeOrderType(e.target.value as OrderType)}
              className="w-full h-[44px] pl-3 pr-7 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-xs font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="dine_in">🍽️ {language === 'th' ? 'ทานที่ร้าน' : 'Dine-in'}</option>
              <option value="takeaway">🛍️ {language === 'th' ? 'กลับบ้าน' : 'Takeaway'}</option>
              <option value="delivery">🛵 {language === 'th' ? 'เดลิเวอรี' : 'Delivery'}</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] pointer-events-none" />
          </div>

          {/* Mode Selector (Section 7.1: เลือกโต๊ะ Fine Dining vs จ่ายทันที Quick Service) */}
          <div className="relative">
            <select
              value={currentOrder.mode || (currentOrder.orderType === 'dine_in' ? 'table' : 'pay-now')}
              onChange={(e) => handleChangeMode(e.target.value as 'table' | 'pay-now')}
              className="w-full h-[44px] pl-3 pr-7 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-xs font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-[#F97316]"
            >
              <option value="table">🛎️ {language === 'th' ? 'เลือกโต๊ะ (บิลค้าง)' : 'Table (Check Later)'}</option>
              <option value="pay-now">⚡ {language === 'th' ? 'จ่ายทันที (รับคิว)' : 'Pay Now (Queue)'}</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] pointer-events-none" />
          </div>
        </div>

        {/* Row 2: Table / Queue / Delivery Platform + Member CRM */}
        <div className="flex items-center gap-2">
          {currentOrder.orderType === 'delivery' ? (
            /* Delivery Platform Selector */
            <div className="flex-1 relative">
              <select
                value={currentOrder.platformId || currentOrder.deliveryPlatform || 'grab'}
                onChange={(e) => {
                  const plat = e.target.value as any;
                  onUpdateOrder({
                    ...currentOrder,
                    platformId: plat,
                    deliveryPlatform: plat,
                  });
                }}
                className="w-full h-[44px] pl-3 pr-7 rounded-xl border border-[#FDBA74] bg-[#FFF3E0] text-[#9A3412] text-xs font-bold appearance-none cursor-pointer"
              >
                <option value="grab">🛵 Grab Food</option>
                <option value="lineman">🛵 LINE MAN</option>
                <option value="shopeefood">🛵 ShopeeFood</option>
                <option value="robinhood">🛵 Robinhood</option>
                <option value="direct">🏠 ร้านส่งเอง (Direct)</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9A3412] pointer-events-none" />
            </div>
          ) : (currentOrder.mode === 'pay-now' || currentOrder.orderType === 'takeaway') ? (
            /* Quick Service Queue Badge / Input */
            <div className="flex-1 flex items-center gap-2 h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE]">
              <span className="text-xs font-bold text-[#EA580C] shrink-0">
                {language === 'th' ? 'คิวที่:' : 'Queue:'}
              </span>
              <input
                type="text"
                value={currentOrder.queueNo || `Q-${currentOrder.orderNumber.slice(-3)}`}
                onChange={(e) => {
                  onUpdateOrder({
                    ...currentOrder,
                    queueNo: e.target.value,
                  });
                }}
                placeholder="Q-01"
                className="w-full font-mono font-black text-sm text-[#111827] bg-transparent focus:outline-none"
              />
            </div>
          ) : (
            /* Select Table Button */
            <button
              type="button"
              onClick={onChangeTable}
              className="flex-1 h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] hover:bg-[#FFEDD5] text-[#111827] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C] shrink-0"></span>
                <span className="truncate">
                  {currentOrder.tableName
                    ? currentOrder.tableName
                    : language === 'th'
                    ? 'เลือกโต๊ะ'
                    : 'Select Table'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            </button>
          )}

          {/* Member CRM Chip */}
          <button
            type="button"
            onClick={() => setIsMemberModalOpen(true)}
            className={`h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              currentOrder.memberName
                ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
                : 'bg-[#FFF8EE] border-[#FED7AA] text-[#374151] hover:bg-[#FFEDD5]'
            }`}
            title="ค้นหา / ผูกสมาชิก CRM"
          >
            <Users className="w-4 h-4 text-[#F97316]" />
            <span className="truncate max-w-[80px]">
              {currentOrder.memberName || (language === 'th' ? 'สมาชิก' : 'Member')}
            </span>
          </button>
        </div>
      </div>

      {/* Middle: Scrollable Order Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-[#FED7AA]/50">
        {isOrderEmpty ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#FFF3E0] rounded-xl m-2 border border-dashed border-[#FED7AA]">
            <div className="w-16 h-16 rounded-full bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center mb-3">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <p className="text-[17px] font-bold text-[#111827]">
              {language === 'th'
                ? 'ยังไม่มีรายการ แตะเมนูทางซ้ายเพื่อเพิ่ม'
                : 'No items in order. Tap menu on left to add.'}
            </p>
            <p className="text-[14px] text-[#6B7280] mt-1">
              {language === 'th'
                ? 'สามารถเลือกโต๊ะ สมาชิก หรือเปลี่ยนประเภทออเดอร์ได้'
                : 'You can select a table, member, or change order type.'}
            </p>
          </div>
        ) : (
          currentOrder.items.map((item, idx) => (
            <div
              key={item.id}
              className="pt-2.5 first:pt-0 flex flex-col gap-1.5 hover:bg-[#FFF8EE] p-2 rounded-xl transition-colors"
            >
              {/* Item Header: Drag handle, Name, Reorder buttons, Remove button */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="text-[#9CA3AF] cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[18px] font-semibold text-[#111827] leading-tight break-words">
                      {language === 'th' ? item.productNameTh : item.productNameEn || item.productNameTh}
                    </div>

                    {/* Modifiers & Variant info */}
                    <div className="text-[14px] text-[#374151] mt-0.5 space-y-0.5">
                      {item.selectedVariant && (
                        <div>• {item.selectedVariant.nameTh || item.selectedVariant.nameEn}</div>
                      )}
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div>
                          • {item.selectedModifiers.map((m) => m.nameTh || m.nameEn).join(', ')}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[#EA580C] italic font-medium">
                          ✎ {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Up/Down Reorder & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(idx, 'up')}
                      className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 cursor-pointer"
                      title="เลื่อนขึ้น"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentOrder.items.length - 1}
                      onClick={() => handleMoveItem(idx, 'down')}
                      className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 cursor-pointer"
                      title="เลื่อนลง"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenNoteModal(item)}
                    className="p-2 text-[#6B7280] hover:text-[#EA580C] rounded-lg hover:bg-[#FFEDD5] transition cursor-pointer"
                    title="บันทึกข้อความพิเศษ"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-2 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition cursor-pointer"
                    title="ลบรายการ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom line: Stepper (- qty +) and Line Total */}
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#FED7AA]/40">
                {/* Stepper with touch targets >= 36px */}
                <div className="flex items-center border border-[#FED7AA] rounded-lg bg-[#FFFFFF] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, -1)}
                    className="w-9 h-9 flex items-center justify-center text-[#111827] hover:bg-[#FFEDD5] active:bg-[#FDBA74] transition font-bold cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-9 text-center text-[18px] font-bold text-[#111827]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateQuantity(item.id, 1)}
                    className="w-9 h-9 flex items-center justify-center text-[#111827] hover:bg-[#FFEDD5] active:bg-[#FDBA74] transition font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Line Price in 18px bold */}
                <div className="text-right">
                  <span className="text-[18px] font-bold text-[#111827]">
                    {formatCurrency(item.lineTotal)}
                  </span>
                  {item.quantity > 1 && (
                    <div className="text-[12px] text-[#6B7280]">
                      @{formatCurrency(item.basePrice)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Sticky Section: Clear button, Subtotal, Grand Total, and Dual Buttons */}
      <div className="p-3 bg-[#FFFFFF] border-t-2 border-[#FED7AA] space-y-3">
        {/* Top bar: Ghost red clear button + Hold button + Total items count & Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isOrderEmpty}
              onClick={onClearOrder}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] font-semibold text-xs disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ล้าง' : 'Clear'}</span>
            </button>
            <button
              type="button"
              disabled={isOrderEmpty}
              onClick={handleHoldOrder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#EA580C] bg-[#FFF3E0] hover:bg-[#FFEDD5] border border-[#FED7AA] font-bold text-xs disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer shadow-2xs"
              title="พักบิลนี้เพื่อไปรับออเดอร์อื่นก่อน"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'พักบิล' : 'Hold'}</span>
            </button>
          </div>
          <div className="text-[#374151] font-semibold text-[15px]">
            {language === 'th'
              ? `ทั้งหมด (${totalItemsCount} รายการ)`
              : `Total (${totalItemsCount} items)`}
            <span className="ml-2 font-bold text-[#111827]">
              {formatCurrency(currentOrder.subtotal)}
            </span>
          </div>
        </div>

        {/* Discounts or Extras summary if any */}
        {(currentOrder.discountAmount > 0 || currentOrder.serviceChargeAmount > 0) && (
          <div className="space-y-1 text-xs text-[#374151] bg-[#FFF8EE] p-2 rounded-lg border border-[#FED7AA]">
            {currentOrder.discountAmount > 0 && (
              <div className="flex justify-between text-[#DC2626]">
                <span>{language === 'th' ? 'ส่วนลด' : 'Discount'}:</span>
                <span className="font-bold">-{formatCurrency(currentOrder.discountAmount)}</span>
              </div>
            )}
            {currentOrder.serviceChargeAmount > 0 && (
              <div className="flex justify-between">
                <span>Service Charge:</span>
                <span className="font-bold">+{formatCurrency(currentOrder.serviceChargeAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Grand Total ฿ in 32-36px bold */}
        <div className="flex items-baseline justify-between pt-1 border-t border-[#FED7AA]/60">
          <span className="text-[17px] font-bold text-[#374151]">
            {language === 'th' ? 'ยอดสุทธิ' : 'Grand Total'}:
          </span>
          <span className="text-[32px] sm:text-[36px] font-extrabold text-[#111827] tracking-tight">
            {formatCurrency(currentOrder.totalAmount)}
          </span>
        </div>

        {/* Dual action buttons row (Equal width, both >= 56px tall, disabled while order empty) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Button 1: Main Action FILLED primary-strong button */}
          <button
            type="button"
            disabled={isOrderEmpty}
            onClick={onSendToKitchen}
            className="h-[56px] px-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] active:bg-[#9A3412] text-white text-[18px] sm:text-[19px] font-semibold flex items-center justify-center gap-2 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Send className="w-5 h-5" />
            <span>{language === 'th' ? 'ส่งครัว' : 'Kitchen'}</span>
          </button>

          {/* Button 2: OUTLINED orange button */}
          <button
            type="button"
            disabled={isOrderEmpty}
            onClick={onOpenCheckout}
            className="h-[56px] px-3 rounded-xl border-2 border-[#F97316] bg-[#FFFFFF] hover:bg-[#FFEDD5] active:bg-[#FDBA74] text-[#EA580C] text-[18px] sm:text-[19px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:border-[#FED7AA] disabled:text-[#9CA3AF] disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <CreditCard className="w-5 h-5 text-[#F97316]" />
            <span>{language === 'th' ? 'ชำระเงิน' : 'Pay'}</span>
          </button>
        </div>

        {/* Section 7.3: Reprint Kitchen Ticket Button */}
        {currentOrder.items.some((i) => i.sentToKitchenAt || i.kitchenStatus !== 'pending') && onReprintKitchen && (
          <button
            type="button"
            onClick={onReprintKitchen}
            className="w-full py-2 px-3 text-xs font-bold text-[#EA580C] bg-[#FFF8EE] hover:bg-[#FFEDD5] rounded-xl border border-[#FED7AA] flex items-center justify-center gap-2 transition cursor-pointer mt-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'พิมพ์ซ้ำใบสั่งครัว (Reprint Kitchen Ticket)' : 'Reprint Kitchen Ticket'}</span>
          </button>
        )}
      </div>

      {/* Note Edit Modal */}
      {editingNoteItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-lg">
            <h4 className="font-bold text-[17px] text-[#111827]">
              {language === 'th' ? 'บันทึกพิเศษในครัว' : 'Kitchen Special Note'}
            </h4>
            <input
              type="text"
              autoFocus
              value={tempNoteText}
              onChange={(e) => setTempNoteText(e.target.value)}
              placeholder={language === 'th' ? 'เช่น เผ็ดน้อย, ไม่ใส่ผักชี, แยกน้ำ' : 'e.g. Less spicy, no cilantro'}
              className="w-full h-[48px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316] focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingNoteItemId(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7280] hover:bg-neutral-100"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-4 py-2 rounded-xl bg-[#EA580C] text-white text-sm font-semibold hover:bg-[#C2410C]"
              >
                {language === 'th' ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Phone CRM Search Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h3 className="font-bold text-[18px] text-[#111827] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#F97316]" />
                <span>{language === 'th' ? 'ค้นหาสมาชิกสะสมแต้ม' : 'Member Loyalty CRM'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchMember} className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={memberPhoneInput}
                onChange={(e) => setMemberPhoneInput(e.target.value)}
                placeholder={language === 'th' ? 'ค้นหาด้วยเบอร์โทรศัพท์' : 'Search by phone number'}
                className="flex-1 h-[48px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-base focus:ring-2 focus:ring-[#F97316] focus:outline-none"
              />
              <button
                type="submit"
                className="h-[48px] px-4 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>{language === 'th' ? 'ค้นหา' : 'Search'}</span>
              </button>
            </form>

            {memberSearchError && (
              <p className="text-sm text-[#DC2626] font-medium">{memberSearchError}</p>
            )}

            {foundMember && (
              <div className="p-3.5 rounded-xl bg-[#FFEDD5] border border-[#FDBA74] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[17px] text-[#111827]">{foundMember.name}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-[#FACC15] text-[#1F2937]">
                    {foundMember.tier}
                  </span>
                </div>
                <div className="text-sm text-[#374151]">เบอร์โทร: {foundMember.phone}</div>
                <div className="text-sm font-semibold text-[#EA580C]">
                  แต้มสะสม: {foundMember.points} แต้ม
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleApplyMember(foundMember)}
                    className="flex-1 h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-sm"
                  >
                    {language === 'th' ? 'ผูกสมาชิกนี้กับบิล' : 'Apply Member to Order'}
                  </button>
                </div>
              </div>
            )}

            {currentOrder.memberName && !foundMember && (
              <div className="pt-2 border-t border-[#FED7AA] flex justify-between items-center">
                <div className="text-sm text-[#374151]">
                  สมาชิกปัจจุบัน: <span className="font-bold">{currentOrder.memberName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyMember(null)}
                  className="text-xs text-[#DC2626] hover:underline font-bold"
                >
                  {language === 'th' ? 'ยกเลิกการผูกสมาชิก' : 'Remove Member'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
