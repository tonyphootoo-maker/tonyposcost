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
} from 'lucide-react';
import { dbGetAll } from '../../db';

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
    recalculateAndNotify(currentOrder.items, type, currentOrder.discountAmount);
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
    member?: Member
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
      {/* Top Row: Order Type Dropdown + Select Table + Member Chip (All >= 48px) */}
      <div className="p-3 border-b border-[#FED7AA] bg-[#FFFFFF] flex flex-wrap items-center gap-2">
        {/* Order Type Selector */}
        <div className="relative flex-1 min-w-[120px]">
          <select
            value={currentOrder.orderType}
            onChange={(e) => handleChangeOrderType(e.target.value as OrderType)}
            className="w-full h-[48px] pl-9 pr-7 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm font-semibold appearance-none cursor-pointer focus:ring-2 focus:ring-[#F97316] focus:outline-none"
          >
            <option value="dine_in">🍽️ {language === 'th' ? 'ทานที่ร้าน' : 'Dine-in'}</option>
            <option value="takeaway">🛍️ {language === 'th' ? 'กลับบ้าน' : 'Takeaway'}</option>
            <option value="delivery">🛵 {language === 'th' ? 'เดลิเวอรี' : 'Delivery'}</option>
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#F97316]">
            {currentOrder.orderType === 'dine_in' && <UtensilsCrossed className="w-4 h-4" />}
            {currentOrder.orderType === 'takeaway' && <ShoppingBag className="w-4 h-4" />}
            {currentOrder.orderType === 'delivery' && <Bike className="w-4 h-4" />}
          </div>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
        </div>

        {/* Select Table / Queue Button */}
        <button
          type="button"
          onClick={onChangeTable}
          className="h-[48px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] hover:bg-[#FFEDD5] text-[#111827] text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#F97316]"></span>
          <span className="truncate max-w-[120px]">
            {currentOrder.tableName
              ? currentOrder.tableName
              : language === 'th'
              ? 'เลือกโต๊ะ'
              : 'Select Table'}
          </span>
        </button>

        {/* Member Chip Button */}
        <button
          type="button"
          onClick={() => setIsMemberModalOpen(true)}
          className={`h-[48px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            currentOrder.memberName
              ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
              : 'bg-[#FFF8EE] border-[#FED7AA] text-[#374151] hover:bg-[#FFEDD5]'
          }`}
          title="ค้นหา / ผูกสมาชิก CRM"
        >
          <Users className="w-4 h-4 text-[#F97316]" />
          <span className="truncate max-w-[90px]">
            {currentOrder.memberName || (language === 'th' ? 'สมาชิก' : 'Member')}
          </span>
        </button>
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
        {/* Top bar: Ghost red clear button + Total items count & Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={isOrderEmpty}
            onClick={onClearOrder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] font-semibold text-xs disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'ลบทั้งหมด' : 'Clear All'}</span>
          </button>
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
