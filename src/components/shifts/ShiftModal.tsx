import React, { useState, useEffect } from 'react';
import { Shift, Order } from '../../types';
import { dbGetAll, dbPut, dbQueryByIndex } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import {
  X,
  Clock,
  Banknote,
  DollarSign,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Lock,
  Unlock,
  History,
  Printer,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeShift: Shift | null;
  onShiftChange: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  activeShift,
  onShiftChange,
}) => {
  const { t, language, formatCurrency, formatDate, formatTime } = useTranslation();
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [shiftsHistory, setShiftsHistory] = useState<Shift[]>([]);
  const [startingCashInput, setStartingCashInput] = useState<number>(2000);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState<string>('');

  const [currentShiftLiveStats, setCurrentShiftLiveStats] = useState<{
    cashSales: number;
    promptpaySales: number;
    cardSales: number;
    deliverySales: number;
    totalSales: number;
    orderCount: number;
    dineInCount: number;
    takeawayCount: number;
    deliveryCount: number;
  }>({
    cashSales: 0,
    promptpaySales: 0,
    cardSales: 0,
    deliverySales: 0,
    totalSales: 0,
    orderCount: 0,
    dineInCount: 0,
    takeawayCount: 0,
    deliveryCount: 0,
  });

  useEffect(() => {
    if (isOpen) {
      loadLiveShiftStats();
      loadHistory();
    }
  }, [isOpen, activeShift]);

  const loadLiveShiftStats = async () => {
    if (!activeShift) return;

    // Load orders belonging to this shift or created during shift
    const allOrders = await dbGetAll<Order>('orders');
    const shiftOrders = allOrders.filter(
      (o) => o.shiftId === activeShift.id || (o.paidAt && o.paidAt >= activeShift.openedAt)
    );
    const paidOrders = shiftOrders.filter((o) => o.status === 'paid');

    let cash = 0;
    let promptpay = 0;
    let card = 0;
    let delivery = 0;
    let total = 0;
    let dineIn = 0;
    let takeaway = 0;
    let deliveryCount = 0;

    for (const ord of paidOrders) {
      total += ord.totalAmount;
      if (ord.orderType === 'dine_in') dineIn++;
      else if (ord.orderType === 'takeaway') takeaway++;
      else if (ord.orderType === 'delivery') deliveryCount++;

      if (ord.orderType === 'delivery') {
        delivery += ord.totalAmount;
      } else if (ord.paymentMethod === 'cash') {
        cash += ord.totalAmount;
      } else if (ord.paymentMethod === 'promptpay' || ord.paymentMethod === 'qr_code') {
        promptpay += ord.totalAmount;
      } else {
        card += ord.totalAmount;
      }
    }

    setCurrentShiftLiveStats({
      cashSales: cash,
      promptpaySales: promptpay,
      cardSales: card,
      deliverySales: delivery,
      totalSales: total,
      orderCount: paidOrders.length,
      dineInCount: dineIn,
      takeawayCount: takeaway,
      deliveryCount,
    });
    setActualCashInput(activeShift.startingCash + cash);
  };

  const loadHistory = async () => {
    const all = await dbGetAll<Shift>('shifts');
    all.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    setShiftsHistory(all);
  };

  const handleOpenShift = async () => {
    const all = await dbGetAll<Shift>('shifts');
    const newShiftNumber = all.length + 1;

    const newShift: Shift = {
      id: `shift_${Date.now()}`,
      shiftNumber: newShiftNumber,
      openedAt: new Date().toISOString(),
      startingCash: Number(startingCashInput) || 0,
      openingCash: Number(startingCashInput) || 0,
      status: 'open',
      cashSales: 0,
      promptpaySales: 0,
      cardSales: 0,
      totalSales: 0,
      totalOrders: 0,
      expectedCash: Number(startingCashInput) || 0,
      actualCash: 0,
      cashDifference: 0,
    };

    await dbPut('shifts', newShift);
    showToast({ title: 'เปิดกะสำเร็จ', message: `เปิดกะ #${newShiftNumber} เรียบร้อย`, type: 'success' });
    onShiftChange();
    onClose();
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;

    // Section 7.10: Warn if there are open bills when closing a shift (allow to continue)
    const allOrders = await dbGetAll<Order>('orders');
    const openOrders = allOrders.filter(
      (o) => o.status === 'open' || o.status === 'kitchen_preparing'
    );
    if (openOrders.length > 0) {
      const proceed = window.confirm(
        language === 'th'
          ? `คำเตือน: ยังมีออเดอร์ค้างอยู่ ${openOrders.length} บิลที่ยังไม่ได้ชำระเงิน!\n\nคุณต้องการปิดกะต่อไปหรือไม่?`
          : `Warning: There are ${openOrders.length} open/unpaid bills. Proceed to close shift?`
      );
      if (!proceed) return;
    }

    const expectedCash = activeShift.startingCash + currentShiftLiveStats.cashSales;
    const diff = actualCashInput - expectedCash;

    const updatedShift: Shift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      cashSales: currentShiftLiveStats.cashSales,
      promptpaySales: currentShiftLiveStats.promptpaySales,
      cardSales: currentShiftLiveStats.cardSales,
      totalSales: currentShiftLiveStats.totalSales,
      totalOrders: currentShiftLiveStats.orderCount,
      expectedCash,
      actualCash: actualCashInput,
      countedCash: actualCashInput,
      cashDifference: diff,
      status: 'closed',
      notes: closeNotes || activeShift.notes,
    };

    await dbPut('shifts', updatedShift);
    showToast({ title: 'ปิดกะสำเร็จ', message: `ปิดกะ #${activeShift.shiftNumber} เรียบร้อย`, type: 'success' });
    onShiftChange();
    onClose();
  };

  const handleCopySummary = () => {
    if (!activeShift) return;
    const expected = activeShift.startingCash + currentShiftLiveStats.cashSales;
    const diff = actualCashInput - expected;
    const text = [
      `📊 สรุปกะการขาย #${activeShift.shiftNumber}`,
      `🕒 เปิดกะ: ${formatDate(activeShift.openedAt)} ${formatTime(activeShift.openedAt)}`,
      `🕒 ปิดกะ: ${formatDate(new Date().toISOString())} ${formatTime(new Date().toISOString())}`,
      `--------------------------------`,
      `💵 เงินทอนตั้งต้น: ฿${activeShift.startingCash.toLocaleString()}`,
      `💰 ยอดขายรวม: ฿${currentShiftLiveStats.totalSales.toLocaleString()} (${currentShiftLiveStats.orderCount} บิล)`,
      `  • เงินสด: ฿${currentShiftLiveStats.cashSales.toLocaleString()}`,
      `  • พร้อมเพย์: ฿${currentShiftLiveStats.promptpaySales.toLocaleString()}`,
      `  • บัตร/โอน: ฿${currentShiftLiveStats.cardSales.toLocaleString()}`,
      `  • เดลิเวอรี: ฿${currentShiftLiveStats.deliverySales.toLocaleString()}`,
      `--------------------------------`,
      `🍽️ ประเภทออเดอร์: ทานที่ร้าน ${currentShiftLiveStats.dineInCount} | กลับบ้าน ${currentShiftLiveStats.takeawayCount} | เดลิเวอรี ${currentShiftLiveStats.deliveryCount}`,
      `--------------------------------`,
      `📥 เงินสดที่ควรมี: ฿${expected.toLocaleString()}`,
      `🧮 เงินสดที่นับได้จริง: ฿${actualCashInput.toLocaleString()}`,
      `⚖️ ผลต่างเงินสด: ${diff >= 0 ? '+' : ''}฿${diff.toLocaleString()} (${diff === 0 ? 'ตรงพอดี' : diff > 0 ? 'เงินเกิน' : 'เงินขาด'})`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    showToast({ title: 'คัดลอกสำเร็จ', message: 'คัดลอกสรุปกะไปยังคลิปบอร์ดแล้ว', type: 'info' });
  };

  const handlePrintSummary = () => {
    window.print();
  };

  if (!isOpen) return null;

  const expectedCash = activeShift ? activeShift.startingCash + currentShiftLiveStats.cashSales : 0;
  const cashDifference = actualCashInput - expectedCash;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111827] tracking-tight">
                {language === 'th' ? 'จัดการกะการขาย (Shift Management)' : 'Shift Management'}
              </h2>
              <p className="text-xs text-[#6B7280]">
                ควบคุมเงินทอนลิ้นชัก ตรวจนับเงินสด และสรุปยอดขายแยกตามกะ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switch */}
        <div className="flex border-b border-[#FED7AA] px-6 bg-[#FFFBF5]">
          <button
            onClick={() => setTab('current')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition cursor-pointer ${
              tab === 'current'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{language === 'th' ? 'กะปัจจุบัน' : 'Current Shift'}</span>
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition cursor-pointer ${
              tab === 'history'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{language === 'th' ? 'ประวัติปิดกะย้อนหลัง' : 'Shift History'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FFFFFF]">
          {tab === 'current' ? (
            activeShift ? (
              // ACTIVE SHIFT VIEW
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3.5 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <div>
                      <span className="text-xs font-bold text-emerald-800">
                        {language === 'th'
                          ? `กำลังเปิดกะ #${activeShift.shiftNumber}`
                          : `Shift #${activeShift.shiftNumber} Active`}
                      </span>
                      <div className="text-[11px] text-[#6B7280] mt-0.5">
                        เปิดเมื่อ: {formatDate(activeShift.openedAt)} เวลา {formatTime(activeShift.openedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#6B7280]">เงินทอนตั้งต้น</div>
                    <div className="font-extrabold text-base text-[#111827] font-mono">
                      ฿{activeShift.startingCash.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Sales Breakdown by Payment Method & Order Type */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA]">
                    <span className="text-[11px] text-[#6B7280] block">ยอดขายเงินสด</span>
                    <span className="text-base font-bold font-mono text-emerald-700">
                      ฿{currentShiftLiveStats.cashSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA]">
                    <span className="text-[11px] text-[#6B7280] block">ยอดพร้อมเพย์ QR</span>
                    <span className="text-base font-bold font-mono text-sky-700">
                      ฿{currentShiftLiveStats.promptpaySales.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA]">
                    <span className="text-[11px] text-[#6B7280] block">บัตร / โอนเงิน</span>
                    <span className="text-base font-bold font-mono text-indigo-700">
                      ฿{currentShiftLiveStats.cardSales.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA]">
                    <span className="text-[11px] text-[#6B7280] block">เดลิเวอรี</span>
                    <span className="text-base font-bold font-mono text-orange-600">
                      ฿{currentShiftLiveStats.deliverySales.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Order Type Count */}
                <div className="p-3 bg-[#FFF8EE] rounded-xl border border-[#FED7AA] flex justify-around text-xs text-[#374151]">
                  <span>🍽️ ทานที่ร้าน: <strong>{currentShiftLiveStats.dineInCount}</strong> บิล</span>
                  <span>🛍️ กลับบ้าน: <strong>{currentShiftLiveStats.takeawayCount}</strong> บิล</span>
                  <span>🛵 เดลิเวอรี: <strong>{currentShiftLiveStats.deliveryCount}</strong> บิล</span>
                </div>

                {/* Cash Reconciliation Box (Section 7.10) */}
                <div className="p-4 bg-white border-2 border-orange-200 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase text-[#9A3412]">
                    ตรวจนับเงินสดเพื่อปิดกะ (Cash Reconciliation)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-[#6B7280] block mb-1">
                        เงินสดที่ควรมีในลิ้นชัก (Expected Cash):
                      </span>
                      <div className="p-3 bg-[#FFFBF5] rounded-xl border border-[#FED7AA] font-mono font-bold text-lg text-[#111827]">
                        ฿{expectedCash.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-[#6B7280] mt-1 block">
                        = เงินทอนเริ่ม (฿{activeShift.startingCash.toLocaleString()}) + ยอดขายเงินสด (฿{currentShiftLiveStats.cashSales.toLocaleString()})
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#111827] block mb-1">
                        เงินสดที่นับได้จริง (Counted Cash) *:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={actualCashInput}
                        onChange={(e) => setActualCashInput(Number(e.target.value) || 0)}
                        className="w-full p-3 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl font-mono font-bold text-lg text-[#111827] focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  {/* Over / Short Highlight */}
                  <div
                    className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between ${
                      cashDifference === 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : cashDifference > 0
                        ? 'bg-yellow-50 text-yellow-900 border-yellow-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    <span>ผลต่างเงินสด (Difference):</span>
                    <span className="font-mono text-sm font-extrabold">
                      {cashDifference > 0 ? `+฿${cashDifference.toLocaleString()} (เงินเกิน)` : cashDifference < 0 ? `-฿${Math.abs(cashDifference).toLocaleString()} (เงินขาด)` : '฿0.00 (ตรงพอดี)'}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#374151] block mb-1">
                      หมายเหตุตอนปิดกะ
                    </label>
                    <input
                      type="text"
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="เช่น เงินเกินเนื่องจากลูกค้าไม่รับเงินทอน"
                      className="w-full h-[40px] px-3 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Print & Copy Summary Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="flex-1 py-2.5 px-3 bg-white border border-[#FED7AA] hover:bg-orange-50 text-[#374151] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-orange-600" />
                    <span>คัดลอกสรุปกะ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSummary}
                    className="flex-1 py-2.5 px-3 bg-white border border-[#FED7AA] hover:bg-orange-50 text-[#374151] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-orange-600" />
                    <span>พิมพ์สรุปกะ</span>
                  </button>
                </div>

                {/* Close Shift Submit */}
                <button
                  type="button"
                  onClick={handleCloseShift}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer min-h-[48px]"
                >
                  🔒 ปิดกะการขายและบันทึก
                </button>
              </div>
            ) : (
              // NO ACTIVE SHIFT: OPEN NEW SHIFT FORM
              <div className="space-y-5">
                <div className="p-4 bg-[#FFF8EE] border border-[#FED7AA] rounded-xl text-xs text-[#9A3412] flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <span className="font-bold">ปัจจุบันยังไม่มีกะที่เปิดอยู่</span>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      กรุณาระบุจำนวนเงินสดตั้งต้น (เงินทอนในลิ้นชัก) ก่อนเริ่มเปิดการขาย
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#111827] mb-1">
                    เงินทอนตั้งต้นในลิ้นชัก (Opening Cash Float) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={startingCashInput}
                    onChange={(e) => setStartingCashInput(Number(e.target.value) || 0)}
                    className="w-full h-[48px] px-3.5 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-xl font-mono font-bold text-[#111827] focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenShift}
                  className="w-full py-3.5 bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer min-h-[48px]"
                >
                  🔓 เปิดกะการขายใหม่
                </button>
              </div>
            )
          ) : (
            // HISTORY TAB
            <div className="space-y-3">
              {shiftsHistory.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280] text-xs">ยังไม่มีประวัติการเปิด-ปิดกะ</div>
              ) : (
                shiftsHistory.map((s) => (
                  <div key={s.id} className="p-3.5 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#111827]">กะ #{s.shiftNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-[#6B7280]'
                        }`}
                      >
                        {s.status === 'open' ? 'กำลังเปิด' : 'ปิดแล้ว'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6B7280]">
                      เปิด: {formatDate(s.openedAt)} {formatTime(s.openedAt)}
                      {s.closedAt && ` • ปิด: ${formatTime(s.closedAt)}`}
                    </div>
                    <div className="flex justify-between font-mono pt-1 border-t border-[#FED7AA]/60 text-[11px]">
                      <span>ยอดขาย: ฿{s.totalSales?.toLocaleString()}</span>
                      <span>
                        ผลต่างเงินสด:{' '}
                        <strong className={s.cashDifference && s.cashDifference < 0 ? 'text-red-600' : 'text-emerald-700'}>
                          {s.cashDifference ? `${s.cashDifference >= 0 ? '+' : ''}฿${s.cashDifference}` : '-'}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
