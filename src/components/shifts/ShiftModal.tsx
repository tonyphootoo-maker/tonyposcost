import React, { useState, useEffect } from 'react';
import { Shift, Order } from '../../types';
import { dbGetAll, dbPut, dbQueryByIndex } from '../../db';
import { useTranslation } from '../../i18n';
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
    totalSales: number;
    orderCount: number;
  }>({
    cashSales: 0,
    promptpaySales: 0,
    cardSales: 0,
    totalSales: 0,
    orderCount: 0,
  });

  useEffect(() => {
    if (isOpen) {
      loadLiveShiftStats();
      loadHistory();
    }
  }, [isOpen, activeShift]);

  const loadLiveShiftStats = async () => {
    if (!activeShift) return;

    // Load orders belonging to this shift
    const orders = await dbQueryByIndex<Order>('orders', 'by-shiftId', activeShift.id);
    const paidOrders = orders.filter((o) => o.status === 'paid');

    let cash = 0;
    let promptpay = 0;
    let card = 0;
    let total = 0;

    for (const ord of paidOrders) {
      total += ord.totalAmount;
      if (ord.paymentMethod === 'cash') cash += ord.totalAmount;
      else if (ord.paymentMethod === 'promptpay' || ord.paymentMethod === 'qr_code') promptpay += ord.totalAmount;
      else if (ord.paymentMethod === 'credit_card' || ord.paymentMethod === 'transfer') card += ord.totalAmount;
    }

    setCurrentShiftLiveStats({
      cashSales: cash,
      promptpaySales: promptpay,
      cardSales: card,
      totalSales: total,
      orderCount: paidOrders.length,
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
      startingCash: startingCashInput,
      cashSales: 0,
      promptpaySales: 0,
      cardSales: 0,
      totalSales: 0,
      totalOrders: 0,
      expectedCash: startingCashInput,
      status: 'open',
      notes: `เปิดกะที่ #${newShiftNumber} เงินทอนเริ่มต้น ${startingCashInput} บาท`,
    };

    await dbPut('shifts', newShift);
    onShiftChange();
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;

    // Check for open bills in this shift (Section 10 Edge Cases)
    const shiftOrders = await dbQueryByIndex<Order>('orders', 'by-shiftId', activeShift.id);
    const openOrders = shiftOrders.filter((o) => o.status === 'open' || o.status === 'kitchen_preparing');
    if (openOrders.length > 0) {
      const confirmClose = window.confirm(
        language === 'th'
          ? `⚠️ คำเตือน: ยังมีบิลค้างชำระอยู่ ${openOrders.length} บิลในกะนี้!\nคุณต้องการปิดกะขายนี้หรือไม่? (แนะนำให้คิดเงินหรือเคลียร์บิลที่เปิดอยู่ก่อนปิดกะ)`
          : `⚠️ Warning: There are ${openOrders.length} open unpaid orders in this shift!\nDo you still want to close this shift?`
      );
      if (!confirmClose) return;
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
      expectedCash: expectedCash,
      actualCash: actualCashInput,
      cashDifference: diff,
      status: 'closed',
      notes: closeNotes || activeShift.notes,
    };

    await dbPut('shifts', updatedShift);
    onShiftChange();
  };

  if (!isOpen) return null;

  const expectedCash = activeShift ? activeShift.startingCash + currentShiftLiveStats.cashSales : 0;
  const cashDifference = actualCashInput - expectedCash;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t.shiftManagement}</h2>
              <p className="text-xs text-neutral-400">
                {language === 'th' ? 'ควบคุมเงินทอนลิ้นชักและตัดรอบยอดขาย' : 'Cash float, register balance & shift close'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/30">
          <button
            onClick={() => setTab('current')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-sm font-medium transition ${
              tab === 'current' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            {language === 'th' ? 'กะปัจจุบัน' : 'Current Shift'}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-sm font-medium transition ${
              tab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            {language === 'th' ? 'ประวัติปิดกะย้อนหลัง' : 'Shift History'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'current' ? (
            activeShift ? (
              // ACTIVE SHIFT SCREEN
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <div>
                      <span className="text-xs font-semibold text-emerald-300">
                        {language === 'th' ? `กำลังเปิดกะ #${activeShift.shiftNumber}` : `Shift #${activeShift.shiftNumber} Active`}
                      </span>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        {language === 'th' ? 'เปิดเมื่อ: ' : 'Opened: '} {formatDate(activeShift.openedAt)} {formatTime(activeShift.openedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-400">{t.startingCash}</div>
                    <div className="text-sm font-bold text-white font-mono">{formatCurrency(activeShift.startingCash)}</div>
                  </div>
                </div>

                {/* Sales Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                    <div className="text-[11px] text-neutral-400">{language === 'th' ? 'ยอดขายเงินสด' : 'Cash Sales'}</div>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                      {formatCurrency(currentShiftLiveStats.cashSales)}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                    <div className="text-[11px] text-neutral-400">{language === 'th' ? 'พร้อมเพย์ QR' : 'PromptPay'}</div>
                    <div className="text-base font-bold text-sky-400 font-mono mt-1">
                      {formatCurrency(currentShiftLiveStats.promptpaySales)}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                    <div className="text-[11px] text-neutral-400">{language === 'th' ? 'บัตร/โอน' : 'Card/Transfer'}</div>
                    <div className="text-base font-bold text-amber-400 font-mono mt-1">
                      {formatCurrency(currentShiftLiveStats.cardSales)}
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                    <div className="text-[11px] text-neutral-400">{language === 'th' ? 'ยอดขายรวม' : 'Total Sales'}</div>
                    <div className="text-base font-bold text-white font-mono mt-1">
                      {formatCurrency(currentShiftLiveStats.totalSales)}
                    </div>
                  </div>
                </div>

                {/* Close shift reconciliation form */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Lock className="w-4 h-4 text-rose-400" />
                    {language === 'th' ? 'ตรวจสอบเงินสดและทำการปิดกะ' : 'Cash Float Count & Close Shift'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                      <div className="text-xs text-neutral-400 mb-1">{t.expectedCash}</div>
                      <div className="text-lg font-bold text-white font-mono">{formatCurrency(expectedCash)}</div>
                      <div className="text-[10px] text-neutral-500 mt-1">
                        (เงินทอน {formatCurrency(activeShift.startingCash)} + เงินสด {formatCurrency(currentShiftLiveStats.cashSales)})
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        {t.actualCashCounted}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={actualCashInput}
                          onChange={(e) => setActualCashInput(Number(e.target.value) || 0)}
                          className="w-full pl-3 pr-8 py-2 text-base font-bold font-mono bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-mono">฿</span>
                      </div>
                      <div
                        className={`text-xs mt-1.5 flex items-center gap-1 font-mono font-semibold ${
                          cashDifference === 0
                            ? 'text-emerald-400'
                            : cashDifference > 0
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {cashDifference === 0 ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                        {language === 'th' ? 'ส่วนต่าง: ' : 'Difference: '}
                        {cashDifference > 0 ? `+${formatCurrency(cashDifference)} (เงินเกิน)` : cashDifference < 0 ? `${formatCurrency(cashDifference)} (เงินขาด)` : 'เงินตรงเป๊ะ (0.00)'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1">
                      {language === 'th' ? 'หมายเหตุการปิดกะ (ถ้ามี)' : 'Closing notes (optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={language === 'th' ? 'เช่น ส่งเงินสดเข้าเซฟ 5,000 บ., คงเงินทอนไว้ 2,000 บ.' : 'e.g. Deposited cash to safe...'}
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    onClick={handleCloseShift}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition"
                  >
                    <Lock className="w-4 h-4" />
                    {t.closeShift}
                  </button>
                </div>
              </div>
            ) : (
              // NO SHIFT OPEN - OPEN SHIFT SCREEN
              <div className="space-y-5 text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                  <Unlock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t.openShift}</h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                    {language === 'th'
                      ? 'ยังไม่มีกะการขายที่เปิดอยู่ ระบุเงินทอนตั้งต้นในลิ้นชักเพื่อเริ่มรับออเดอร์หน้าร้าน'
                      : 'No shift currently active. Set starting float cash to start taking orders.'}
                  </p>
                </div>

                <div className="max-w-xs mx-auto text-left">
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    {t.startingCash}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={startingCashInput}
                      onChange={(e) => setStartingCashInput(Number(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 text-lg font-bold font-mono bg-neutral-950 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3.5 top-3 text-sm text-neutral-400 font-mono">฿</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[1000, 1500, 2000, 3000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setStartingCashInput(preset)}
                        className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 font-mono transition"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleOpenShift}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm inline-flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
                  >
                    <Unlock className="w-4 h-4" />
                    {language === 'th' ? 'เปิดกะขายทันที' : 'Start Shift Now'}
                  </button>
                </div>
              </div>
            )
          ) : (
            // HISTORY TAB
            <div className="space-y-3">
              {shiftsHistory.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs">
                  {language === 'th' ? 'ยังไม่มีประวัติกะ' : 'No shift records found'}
                </div>
              ) : (
                shiftsHistory.map((s) => (
                  <div key={s.id} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">กะ #{s.shiftNumber}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            s.status === 'open' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {s.status === 'open' ? t.shiftActive : t.shiftClosed}
                        </span>
                      </div>
                      <span className="text-neutral-500">
                        {formatDate(s.openedAt)} {formatTime(s.openedAt)} {s.closedAt && `- ${formatTime(s.closedAt)}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-neutral-800/60 text-[11px]">
                      <div>
                        <span className="text-neutral-500">ยอดขายรวม:</span>
                        <div className="font-mono font-semibold text-white">{formatCurrency(s.totalSales)}</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">เงินทอนเริ่ม:</span>
                        <div className="font-mono text-neutral-300">{formatCurrency(s.startingCash)}</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">นับจริง:</span>
                        <div className="font-mono text-neutral-300">{s.actualCash ? formatCurrency(s.actualCash) : '-'}</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">ส่วนต่าง:</span>
                        <div
                          className={`font-mono font-semibold ${
                            (s.cashDifference || 0) < 0
                              ? 'text-rose-400'
                              : (s.cashDifference || 0) > 0
                              ? 'text-sky-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {s.cashDifference !== undefined ? formatCurrency(s.cashDifference) : '-'}
                        </div>
                      </div>
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
