import React, { useState, useEffect } from 'react';
import {
  Order,
  RestaurantSettings,
  Settings,
  Member,
  Promotion,
  PaymentMethod,
  Shift,
} from '../../types';
import { dbGetAll, dbPut } from '../../db';
import { useTranslation } from '../../i18n';
import { generatePromptPayPayload } from '../../utils/promptpay';
import {
  calculateOrderBill,
  calcPointsEarned,
  calcChange,
  getCashSuggestions,
  formatMoney,
} from '../../utils/calc';
import QRCode from 'qrcode';
import {
  X,
  CreditCard,
  Banknote,
  QrCode as QrIcon,
  CheckCircle,
  Percent,
  User,
  Printer,
  Receipt,
  Search,
  Check,
  Tag,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';

interface PaymentModalProps {
  isOpen: boolean;
  order: Order;
  settings: RestaurantSettings | null;
  activeShift: Shift | null;
  onClose: () => void;
  onPaymentSuccess: (paidOrder: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  order,
  settings,
  activeShift,
  onClose,
  onPaymentSuccess,
}) => {
  const { t, language, formatCurrency, formatDate, formatTime } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<number>(order.totalAmount);
  const [promptPayQRUrl, setPromptPayQRUrl] = useState<string>('');
  const [isReceiptView, setIsReceiptView] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Member CRM Lookup & Quick Add
  const [memberPhoneInput, setMemberPhoneInput] = useState('');
  const [appliedMember, setAppliedMember] = useState<Member | null>(null);
  const [memberSearchResult, setMemberSearchResult] = useState<string>('');
  const [isQuickAddMember, setIsQuickAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  // Promotion Lookup
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promotionsList, setPromotionsList] = useState<Promotion[]>([]);
  const [promoMessage, setPromoMessage] = useState('');

  // Working copy of order and breakdown
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  useEffect(() => {
    if (isOpen) {
      loadInitialPromotions();
      setCurrentOrder(order);
      setCashReceived(order.totalAmount);
      setIsReceiptView(false);
      setAppliedMember(null);
      setMemberPhoneInput('');
      setMemberSearchResult('');
      setPointsToRedeem(0);
      setPromoCodeInput('');
      setPromoMessage('');
      if (settings?.promptPayId) {
        generatePromptPayQR(order.totalAmount);
      }
    }
  }, [isOpen, order]);

  const loadInitialPromotions = async () => {
    const list = await dbGetAll<Promotion>('promotions');
    setPromotionsList(list);
  };

  const generatePromptPayQR = async (amount: number) => {
    if (!settings?.promptPayId) return;
    try {
      const payload = generatePromptPayPayload(settings.promptPayId, amount);
      const url = await QRCode.toDataURL(payload, {
        width: 250,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setPromptPayQRUrl(url);
    } catch (err) {
      console.error('PromptPay QR Error:', err);
    }
  };

  // Shared settings adapter
  const calculationSettings: Settings = {
    shopName: settings?.restaurantNameTh || "Tony's Kitchen",
    language: settings?.language || 'th',
    defaultTargetFoodCostPercent: 30,
    defaultOverheadPercent: 0,
    vat: {
      enabled: settings?.vatEnabled ?? false,
      ratePercent: settings?.vatRate ?? 7,
      priceIncludesVat: settings?.vatInclusive ?? true,
    },
    serviceCharge: {
      enabled: (settings?.serviceChargeEnabled && order.orderType === 'dine_in') ?? false,
      ratePercent: settings?.serviceChargeRate ?? 10,
      countAsRevenue: false,
    },
    platforms: [],
    priceRounding: 5,
    ingredientCategories: [],
    recipeCategories: [],
    receipt: {
      shopAddress: settings?.addressTh,
      phone: settings?.phone,
      taxId: settings?.taxId,
      footerText: settings?.receiptFooterMessage,
      paperWidthMm: settings?.receiptWidth === '58mm' ? 58 : 80,
    },
    printerStations: [],
    paymentMethods: [],
    loyalty: {
      enabled: true,
      spendPerPoint: 25,
      bahtPerPoint: 1,
      minRedeemPoints: 10,
    },
  };

  // Recalculate bill using Section 5 rules
  const billBreakdown = calculateOrderBill(
    order.lines || order.items || [],
    promotionsList,
    appliedMember,
    pointsToRedeem,
    promoCodeInput.trim(),
    calculationSettings
  );

  const payableAmount = billBreakdown.payableTotal;

  useEffect(() => {
    setCashReceived(payableAmount);
    if (settings?.promptPayId) {
      generatePromptPayQR(payableAmount);
    }
  }, [payableAmount]);

  const handleLookupMember = async () => {
    if (!memberPhoneInput.trim()) return;
    const allMembers = await dbGetAll<Member>('members');
    const cleanPhone = memberPhoneInput.replace(/[^0-9]/g, '');
    const found = allMembers.find((m) => m.phone.replace(/[^0-9]/g, '').includes(cleanPhone));

    if (found) {
      setAppliedMember(found);
      setIsQuickAddMember(false);
      setMemberSearchResult(`พบสมาชิก: ${found.name} (${found.tier.toUpperCase()}) มี ${found.points} แต้ม`);
      showToast({ title: 'พบสมาชิก', message: `${found.name} (${found.phone})`, type: 'info' });
    } else {
      setAppliedMember(null);
      setIsQuickAddMember(true);
      setMemberSearchResult('ไม่พบข้อมูลสมาชิกในระบบ — สามารถกดเพิ่มสมาชิกใหม่ได้ทันที');
    }
  };

  const handleQuickAddMember = async () => {
    if (!newMemberName.trim() || !memberPhoneInput.trim()) {
      showToast({ title: 'ข้อผิดพลาด', message: 'กรุณากรอกชื่อและเบอร์โทร', type: 'error' });
      return;
    }

    const cleanPhone = memberPhoneInput.replace(/[^0-9]/g, '');
    const newMember: Member = {
      id: `mem_${Date.now()}`,
      phone: cleanPhone,
      name: newMemberName.trim(),
      points: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      code: `TK${Math.floor(1000 + Math.random() * 9000)}`,
      tier: 'bronze',
      visitCount: 0,
      updatedAt: new Date().toISOString(),
    };

    await dbPut('members', newMember);
    setAppliedMember(newMember);
    setIsQuickAddMember(false);
    setMemberSearchResult(`สมัครสมาชิกสำเร็จ: ${newMember.name}`);
    showToast({ title: 'สมัครสมาชิกสำเร็จ', message: `${newMember.name} (${newMember.phone})`, type: 'success' });
  };

  const handleApplyPromoCode = () => {
    if (!promoCodeInput.trim()) return;
    const code = promoCodeInput.trim().toUpperCase();
    const matched = promotionsList.find(
      (p) => p.type === 'coupon' && p.couponCode?.toUpperCase() === code && (p.enabled ?? p.isActive)
    );

    if (matched) {
      setPromoMessage(`ใช้คูปองสำเร็จ: ${matched.name || matched.nameTh} (-${matched.value}${matched.discountKind === 'percent' ? '%' : '฿'})`);
      showToast({ title: 'ใช้คูปองสำเร็จ', message: matched.name || matched.nameTh, type: 'success' });
    } else {
      setPromoMessage('รหัสคูปองไม่ถูกต้องหรือหมดอายุ');
      showToast({ title: 'รหัสไม่ถูกต้อง', message: 'กรุณาตรวจสอบรหัสคูปองอีกครั้ง', type: 'error' });
    }
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    const paidAt = new Date().toISOString();

    const changeResult = calcChange(
      selectedMethod === 'cash' ? cashReceived : payableAmount,
      payableAmount
    );

    // Calculate loyalty points earned
    const pointsEarned = calcPointsEarned(payableAmount, calculationSettings);

    const paidOrder: Order = {
      ...currentOrder,
      totalAmount: payableAmount,
      subtotal: billBreakdown.linesSubtotal,
      discountAmount: billBreakdown.totalDiscounts,
      promotionName: billBreakdown.appliedPromotionNames.join(', ') || undefined,
      serviceChargeAmount: billBreakdown.serviceChargeAmount,
      vatAmount: billBreakdown.vatAmount,
      status: 'paid',
      paymentMethod: selectedMethod,
      cashReceived: selectedMethod === 'cash' ? cashReceived : payableAmount,
      cashChange: changeResult.change,
      paidAt,
      shiftId: activeShift ? activeShift.id : undefined,
      memberId: appliedMember?.id,
      memberName: appliedMember?.name,
      pointsEarned,
      pointsRedeemed: pointsToRedeem,
      payments: [
        {
          id: `pay_${Date.now()}`,
          methodId: selectedMethod,
          type: selectedMethod,
          amount: payableAmount,
          tendered: selectedMethod === 'cash' ? cashReceived : payableAmount,
          change: changeResult.change,
          paidAt,
          method: selectedMethod,
        },
      ],
    };

    // Save paid order
    await dbPut('orders', paidOrder);

    // Update active shift stats
    if (activeShift) {
      const isCash = selectedMethod === 'cash';
      const isPromptPay = selectedMethod === 'promptpay';
      const isCard = selectedMethod === 'credit_card' || selectedMethod === 'card';

      const updatedShift: Shift = {
        ...activeShift,
        totalSales: activeShift.totalSales + paidOrder.totalAmount,
        totalOrders: activeShift.totalOrders + 1,
        cashSales: isCash ? activeShift.cashSales + paidOrder.totalAmount : activeShift.cashSales,
        promptpaySales: isPromptPay ? activeShift.promptpaySales + paidOrder.totalAmount : activeShift.promptpaySales,
        cardSales: isCard ? activeShift.cardSales + paidOrder.totalAmount : activeShift.cardSales,
        expectedCash: isCash ? activeShift.expectedCash + paidOrder.totalAmount : activeShift.expectedCash,
      };
      await dbPut('shifts', updatedShift);
    }

    // Update member points and total spent
    if (appliedMember) {
      const updatedMember: Member = {
        ...appliedMember,
        points: Math.max(0, appliedMember.points - pointsToRedeem) + pointsEarned,
        totalSpent: appliedMember.totalSpent + paidOrder.totalAmount,
        visitCount: appliedMember.visitCount + 1,
        updatedAt: new Date().toISOString(),
      };
      await dbPut('members', updatedMember);
    }

    setIsProcessing(false);
    setIsReceiptView(true);
    setCurrentOrder(paidOrder);
    onPaymentSuccess(paidOrder);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const cashSuggestions = getCashSuggestions(payableAmount);
  const changeResult = calcChange(cashReceived, payableAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden text-[#1F2937]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFFBF5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#1F2937]">
                {isReceiptView ? (language === 'th' ? 'ชำระเงินสำเร็จ / ใบเสร็จรับเงิน' : 'Payment Receipt') : t.checkout}
              </h2>
              <p className="text-xs text-[#6B7280]">
                {currentOrder.orderNumber} • {currentOrder.tableName || currentOrder.customerName || t.takeaway}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-[#6B7280] hover:text-[#1F2937] rounded-lg hover:bg-orange-50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FFFBF5]/30">
          {!isReceiptView ? (
            // PAYMENT FLOW
            <div className="space-y-6">
              {/* Grand Total Display */}
              <div className="p-5 bg-white border border-[#FED7AA] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between shadow-xs gap-3">
                <div>
                  <span className="text-xs text-[#6B7280] uppercase font-bold tracking-wider">
                    {t.netTotal} (ยอดชำระสุทธิ)
                  </span>
                  <div className="text-3xl font-black text-orange-600 font-mono mt-0.5">
                    {formatCurrency(payableAmount)}
                  </div>
                  {billBreakdown.totalDiscounts > 0 && (
                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                      ประหยัดรวม: {formatCurrency(billBreakdown.totalDiscounts)}
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="space-y-1 sm:text-right">
                  {billBreakdown.appliedPromotionNames.map((name, idx) => (
                    <div key={idx} className="inline-block px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 text-[11px] font-semibold border border-orange-200 mr-1 sm:mr-0 sm:ml-1">
                      {name}
                    </div>
                  ))}
                  {appliedMember && (
                    <div className="inline-block px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                      สมาชิก: {appliedMember.name} ({appliedMember.points} แต้ม)
                    </div>
                  )}
                </div>
              </div>

              {/* Member CRM Lookup & Coupon Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Member Search */}
                <div className="p-3.5 bg-white border border-[#FED7AA] rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F2937]">
                    <User className="w-3.5 h-3.5 text-orange-500" />
                    <span>ค้นหาสมาชิกสะสมแต้ม</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="เบอร์โทรศัพท์ 10 หลัก..."
                      value={memberPhoneInput}
                      onChange={(e) => setMemberPhoneInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-[#1F2937] font-mono focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleLookupMember}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {memberSearchResult && (
                    <div className="text-[11px] text-orange-700 font-medium">{memberSearchResult}</div>
                  )}

                  {/* Quick-add member if not found */}
                  {isQuickAddMember && (
                    <div className="pt-2 border-t border-dashed border-[#FED7AA] space-y-2">
                      <div className="font-bold text-[#1F2937] flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5 text-orange-500" />
                        <span>สมัครสมาชิกใหม่ทันที</span>
                      </div>
                      <input
                        type="text"
                        placeholder="ชื่อ-นามสกุล สมาชิก..."
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-[#1F2937]"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddMember}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs"
                      >
                        บันทึกสมาชิกใหม่
                      </button>
                    </div>
                  )}

                  {/* Points redemption */}
                  {appliedMember && appliedMember.points >= 10 && (
                    <div className="pt-2 border-t border-dashed border-[#FED7AA] flex items-center justify-between">
                      <span className="text-[#6B7280]">แลกแต้มส่วนลด (1 แต้ม = 1฿):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={appliedMember.points}
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(Math.min(appliedMember.points, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-16 px-2 py-1 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-center font-bold text-xs"
                        />
                        <span className="text-[11px] text-[#6B7280]">แต้ม</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Promotion Coupon Code */}
                <div className="p-3.5 bg-white border border-[#FED7AA] rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F2937]">
                    <Tag className="w-3.5 h-3.5 text-orange-500" />
                    <span>คูปองส่วนลด (Coupon Code)</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="เช่น TONY10, WELCOME..."
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-lg text-[#1F2937] uppercase font-mono focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-xs"
                    >
                      ใช้สิทธิ์
                    </button>
                  </div>
                  {promoMessage && (
                    <div className="text-[11px] text-emerald-700 font-medium">{promoMessage}</div>
                  )}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-[#6B7280] uppercase mb-2">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('cash')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition ${
                      selectedMethod === 'cash'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-50/30'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-orange-600" />
                    <span className="text-xs font-bold">{t.cash}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('promptpay')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition ${
                      selectedMethod === 'promptpay'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-50/30'
                    }`}
                  >
                    <QrIcon className="w-5 h-5 text-sky-600" />
                    <span className="text-xs font-bold">{t.promptpay} QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('credit_card')}
                    className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-2 transition ${
                      selectedMethod === 'credit_card'
                        ? 'bg-orange-50 border-orange-500 text-orange-950 shadow-xs'
                        : 'bg-white border-[#FED7AA] text-[#6B7280] hover:text-[#1F2937] hover:bg-orange-50/30'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold">{t.creditCard}</span>
                  </button>
                </div>
              </div>

              {/* METHOD 1: CASH INTERFACE (Section 5 t) */}
              {selectedMethod === 'cash' && (
                <div className="p-4 bg-white border border-[#FED7AA] rounded-2xl space-y-4 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1F2937] mb-1.5">
                        {t.cashReceived} (จำนวนเงินที่รับมา)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                          className="w-full pl-3 pr-8 py-2.5 text-xl font-bold font-mono bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
                        />
                        <span className="absolute right-3.5 top-3.5 text-xs text-[#6B7280] font-mono">฿</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#6B7280] mb-1.5">
                        {t.cashChange} (เงินทอน)
                      </label>
                      <div className="py-2.5 px-3 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl min-h-[44px] flex items-center">
                        <div className="text-2xl font-black text-emerald-700 font-mono">
                          {formatCurrency(changeResult.change)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Cash Presets (Exact, 20, 50, 100, 500, 1000) */}
                  <div>
                    <span className="text-[11px] text-[#6B7280] font-bold block mb-1.5">
                      {t.quickCash} (ปุ่มลัดรับเงิน):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCashReceived(payableAmount)}
                        className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold rounded-lg border border-orange-300 min-h-[36px]"
                      >
                        {t.exactAmount} ({formatCurrency(payableAmount)})
                      </button>
                      {cashSuggestions.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCashReceived(preset)}
                          className="px-3 py-1.5 bg-white hover:bg-orange-50 text-[#1F2937] text-xs font-mono font-semibold rounded-lg border border-[#FED7AA] min-h-[36px]"
                        >
                          ฿{preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD 2: PROMPTPAY QR (Section 5 u) */}
              {selectedMethod === 'promptpay' && (
                <div className="p-5 bg-white border border-[#FED7AA] rounded-2xl flex flex-col items-center text-center space-y-3 shadow-xs">
                  <div className="text-xs text-[#1F2937] font-bold">
                    สแกน QR Code เพื่อชำระเงินผ่าน Mobile Banking ทุกธนาคาร
                  </div>

                  {promptPayQRUrl ? (
                    <div className="p-4 bg-white rounded-2xl border-2 border-orange-200 shadow-md flex flex-col items-center">
                      <img src={promptPayQRUrl} alt="PromptPay QR" className="w-52 h-52 object-contain" />
                      <div className="text-orange-600 font-extrabold text-base font-mono mt-1">
                        {formatCurrency(payableAmount)}
                      </div>
                      <div className="text-[#6B7280] text-[11px] mt-0.5 font-bold">
                        {settings?.promptPayName || "Tony's Kitchen"}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-[#6B7280] text-xs">
                      กรุณาระบุเลขพร้อมเพย์ (เบอร์โทร/เลขภาษี) ในการตั้งค่าร้าน
                    </div>
                  )}

                  {/* UI Note strictly required by Section 5 u */}
                  <div className="p-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 text-[11px] leading-relaxed flex items-start gap-1.5 max-w-md text-left">
                    <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>หมายเหตุ:</strong> การรับชำระผ่าน PromptPay QR เป็นการตรวจสอบยอดเงินด้วยตนเองโดยพนักงาน (ไม่มีระบบ API เชื่อมต่อธนาคารอัตโนมัติ) กรุณาตรวจสอบสลิปจากลูกค้าก่อนกด "ยืนยันได้รับเงินแล้ว"
                    </span>
                  </div>
                </div>
              )}

              {/* Complete Payment Button */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isProcessing || (selectedMethod === 'cash' && cashReceived < payableAmount)}
                className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition min-h-[44px]"
              >
                <CheckCircle className="w-5 h-5" />
                <span>
                  {selectedMethod === 'promptpay'
                    ? 'ยืนยันได้รับเงินแล้ว (Record Payment)'
                    : language === 'th'
                    ? 'ยืนยันการรับชำระเงิน'
                    : 'Complete & Close Ticket'}
                </span>
              </button>
            </div>
          ) : (
            // PRINTABLE THERMAL RECEIPT PREVIEW (58mm / 80mm)
            <div className="space-y-4 flex flex-col items-center">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                <CheckCircle className="w-4 h-4" />
                <span>{t.paymentSuccess}</span>
              </div>

              {/* The Thermal Slip Container */}
              <div
                id="printable-receipt"
                className={`bg-white text-black p-4 rounded-xl shadow-md font-mono text-[11px] leading-tight border border-neutral-300 w-full ${
                  settings?.receiptWidth === '58mm' ? 'max-w-[280px]' : 'max-w-[340px]'
                }`}
              >
                {/* Store Branding */}
                <div className="text-center space-y-1 pb-2 border-b border-black">
                  <div className="font-extrabold text-sm uppercase">
                    {language === 'th' ? settings?.restaurantNameTh : settings?.restaurantNameEn}
                  </div>
                  <div className="text-[10px] text-neutral-700">
                    {settings?.addressTh || 'Bangkok, Thailand'}
                  </div>
                  <div className="text-[10px]">
                    โทร: {settings?.phone || '089-123-4567'} | Tax: {settings?.taxId || '-'}
                  </div>
                  {settings?.receiptHeaderMessage && (
                    <div className="text-[9px] text-neutral-600 italic mt-1">
                      {settings.receiptHeaderMessage}
                    </div>
                  )}
                </div>

                {/* Ticket Meta */}
                <div className="py-2 border-b border-black/80 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>บิล: {currentOrder.orderNumber}</span>
                    <span>{currentOrder.tableName || (currentOrder.orderType === 'takeaway' ? 'กลับบ้าน' : 'เดลิเวอรี่')}</span>
                  </div>
                  <div className="flex justify-between text-neutral-700">
                    <span>วันที่: {formatDate(currentOrder.paidAt || currentOrder.createdAt)}</span>
                    <span>{formatTime(currentOrder.paidAt || currentOrder.createdAt)}</span>
                  </div>
                  {currentOrder.memberName && (
                    <div className="text-neutral-800">สมาชิก: {currentOrder.memberName}</div>
                  )}
                </div>

                {/* Items */}
                <div className="py-2 border-b border-black/80 space-y-1">
                  {(currentOrder.items || currentOrder.lines || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <div>
                          {item.quantity ?? item.qty}x {item.productNameTh || item.name}
                        </div>
                        {item.selectedVariant && (
                          <div className="text-[9px] text-neutral-600">+ {item.selectedVariant.nameTh}</div>
                        )}
                        {item.notes && (
                          <div className="text-[9px] text-neutral-600">*{item.notes}</div>
                        )}
                      </div>
                      <div className="font-bold shrink-0">
                        {((item.unitPrice || item.basePrice || 0) * (item.quantity ?? item.qty ?? 1)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Financial Totals (Breakdown strictly complying with Section 5 o) */}
                <div className="py-2 border-b border-black/80 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>ยอดรวมรายการ (Subtotal)</span>
                    <span>{billBreakdown.linesSubtotal.toFixed(2)}</span>
                  </div>

                  {billBreakdown.totalDiscounts > 0 && (
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>ส่วนลด ({currentOrder.promotionName || 'Discount'})</span>
                      <span>-{billBreakdown.totalDiscounts.toFixed(2)}</span>
                    </div>
                  )}

                  {billBreakdown.serviceChargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span>ค่าบริการ Service Charge ({settings?.serviceChargeRate}%)</span>
                      <span>{billBreakdown.serviceChargeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {settings?.vatEnabled && (
                    <div className="flex justify-between text-neutral-700">
                      <span>ภาษี VAT {settings.vatRate}% ({settings.vatInclusive ? 'รวมในราคา' : 'เพิ่ม'})</span>
                      <span>{billBreakdown.vatAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-black">
                    <span>ยอดสุทธิ (TOTAL)</span>
                    <span>฿{currentOrder.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment info */}
                <div className="py-2 border-b border-black/80 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>ชำระด้วย:</span>
                    <span className="uppercase font-bold">{currentOrder.paymentMethod}</span>
                  </div>
                  {currentOrder.paymentMethod === 'cash' && (
                    <>
                      <div className="flex justify-between">
                        <span>รับเงินมา:</span>
                        <span>{(currentOrder.cashReceived || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>เงินทอน:</span>
                        <span>{(currentOrder.cashChange || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* PromptPay QR on receipt if available */}
                {promptPayQRUrl && (
                  <div className="pt-2 flex flex-col items-center">
                    <img src={promptPayQRUrl} alt="Receipt QR" className="w-24 h-24" />
                    <span className="text-[8px] text-neutral-600 mt-0.5">Scan to Verify Payment</span>
                  </div>
                )}

                {/* Footer Greeting */}
                <div className="pt-2 text-center text-[9px] text-neutral-700 leading-tight">
                  {settings?.receiptFooterMessage || 'Thank you for your visit! / ขอบคุณที่มาอุดหนุนค่ะ'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.print}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs transition min-h-[44px]"
                >
                  {language === 'th' ? 'เสร็จสิ้น (เปิดบิลถัดไป)' : 'Done (Next Order)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
