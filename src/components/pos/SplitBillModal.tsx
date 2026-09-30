import React, { useState } from 'react';
import { Order, OrderItem } from '../../types';
import { useTranslation } from '../../i18n';
import { X, Split, Users, Check, ArrowRight } from 'lucide-react';

interface SplitBillModalProps {
  isOpen: boolean;
  order: Order;
  onClose: () => void;
  onSplitCompleted: (splitOrders: Order[]) => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  order,
  onClose,
  onSplitCompleted,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('equal');
  const [personCount, setPersonCount] = useState<number>(2);

  // Split by items state: List of item IDs assigned to Bill 2
  const [bill2ItemIds, setBill2ItemIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const equalAmountPerPerson = Number((order.totalAmount / personCount).toFixed(2));

  const toggleItemAssignment = (itemId: string) => {
    setBill2ItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const bill1Items = order.items.filter((i) => !bill2ItemIds.has(i.id));
  const bill2Items = order.items.filter((i) => bill2ItemIds.has(i.id));

  const bill1Subtotal = bill1Items.reduce((acc, i) => acc + i.lineTotal, 0);
  const bill2Subtotal = bill2Items.reduce((acc, i) => acc + i.lineTotal, 0);

  const handleApplySplitByItems = () => {
    if (bill2Items.length === 0 || bill1Items.length === 0) {
      alert(language === 'th' ? 'กรุณาเลือกรายการอาหารอย่างน้อย 1 รายการเพื่อแยกบิล' : 'Select at least 1 item for each split bill');
      return;
    }

    const order1: Order = {
      ...order,
      orderNumber: `${order.orderNumber}-A`,
      items: bill1Items,
      subtotal: bill1Subtotal,
      totalAmount: bill1Subtotal,
    };

    const order2: Order = {
      ...order,
      id: `ord_${Date.now()}`,
      orderNumber: `${order.orderNumber}-B`,
      items: bill2Items,
      subtotal: bill2Subtotal,
      totalAmount: bill2Subtotal,
    };

    onSplitCompleted([order1, order2]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-2">
            <Split className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white text-base">{t.splitBill}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/30 text-xs font-semibold">
          <button
            onClick={() => setSplitMode('equal')}
            className={`py-3 px-3 border-b-2 transition ${
              splitMode === 'equal' ? 'border-sky-400 text-sky-400' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {t.splitEqually}
          </button>
          <button
            onClick={() => setSplitMode('items')}
            className={`py-3 px-3 border-b-2 transition ${
              splitMode === 'items' ? 'border-sky-400 text-sky-400' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {t.splitByItem}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {splitMode === 'equal' ? (
            <div className="space-y-4 text-center">
              <div className="text-xs text-neutral-400">
                {language === 'th' ? 'หารยอดรวมเท่ากันตามจำนวนลูกค้า' : 'Divide total bill equally among guests'}
              </div>

              <div className="flex items-center justify-center gap-3">
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => setPersonCount(num)}
                    className={`w-12 h-12 rounded-2xl font-bold font-mono text-base border transition ${
                      personCount === num
                        ? 'bg-sky-500 text-neutral-950 border-sky-400 shadow-lg shadow-sky-500/20'
                        : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
                <div className="text-xs text-neutral-400">
                  {language === 'th' ? `จ่ายคนละ (${personCount} คน):` : `Amount per guest (${personCount} guests):`}
                </div>
                <div className="text-3xl font-black text-sky-400 font-mono">
                  {formatCurrency(equalAmountPerPerson)}
                </div>
                <div className="text-[11px] text-neutral-500">
                  (จากยอดรวมทั้งสิ้น {formatCurrency(order.totalAmount)})
                </div>
              </div>
            </div>
          ) : (
            // Split by items
            <div className="space-y-4">
              <div className="text-xs text-neutral-400">
                {language === 'th' ? 'แตะรายการอาหารเพื่อย้ายไปบิลที่ 2' : 'Tap items to move them to Ticket B'}
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {/* Bill 1 List */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-amber-400 pb-1 border-b border-neutral-800">
                    <span>บิล A ({bill1Items.length})</span>
                    <span>{formatCurrency(bill1Subtotal)}</span>
                  </div>
                  {bill1Items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItemAssignment(item.id)}
                      className="p-2 bg-neutral-900 rounded-lg text-xs cursor-pointer hover:border-sky-500 border border-transparent flex justify-between"
                    >
                      <span className="text-neutral-200">
                        {item.quantity}x {item.productNameTh}
                      </span>
                      <span className="font-mono text-neutral-400">฿{item.lineTotal}</span>
                    </div>
                  ))}
                </div>

                {/* Bill 2 List */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-sky-400 pb-1 border-b border-neutral-800">
                    <span>บิล B ({bill2Items.length})</span>
                    <span>{formatCurrency(bill2Subtotal)}</span>
                  </div>
                  {bill2Items.length === 0 ? (
                    <div className="text-center py-6 text-[11px] text-neutral-600">
                      แตะรายการฝั่งซ้ายเพื่อย้ายมาที่นี่
                    </div>
                  ) : (
                    bill2Items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleItemAssignment(item.id)}
                        className="p-2 bg-neutral-900 rounded-lg text-xs cursor-pointer hover:border-amber-500 border border-transparent flex justify-between"
                      >
                        <span className="text-neutral-200">
                          {item.quantity}x {item.productNameTh}
                        </span>
                        <span className="font-mono text-neutral-400">฿{item.lineTotal}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplySplitByItems}
                disabled={bill2Items.length === 0}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                <span>ยืนยันแยกเป็น 2 บิล</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
