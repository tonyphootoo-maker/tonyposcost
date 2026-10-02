import React, { useState, useEffect } from 'react';
import { RestaurantTable, Order } from '../../types';
import { dbGetAll, dbPut } from '../../db';
import { useTranslation } from '../../i18n';
import { X, ArrowRightLeft, Check, Merge, AlertCircle } from 'lucide-react';
import { showToast } from '../common/ToastContainer';

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export const TableTransferModal: React.FC<TableTransferModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const { t, language } = useTranslation();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sourceTableId, setSourceTableId] = useState<string>('');
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [actionType, setActionType] = useState<'move' | 'merge'>('move');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const [tList, oList] = await Promise.all([
      dbGetAll<RestaurantTable>('tables'),
      dbGetAll<Order>('orders'),
    ]);
    setTables(tList);
    setOrders(oList);

    // Pick first occupied table as default source
    const occupied = tList.filter((t) => t.status === 'occupied' || t.status === 'billing');
    if (occupied.length > 0) {
      setSourceTableId(occupied[0].id);
      const otherTables = tList.filter((t) => t.id !== occupied[0].id);
      if (otherTables.length > 0) setTargetTableId(otherTables[0].id);
    }
  };

  const handleExecute = async () => {
    if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) return;

    const sourceTable = tables.find((t) => t.id === sourceTableId);
    const targetTable = tables.find((t) => t.id === targetTableId);
    if (!sourceTable || !targetTable) return;

    const sourceOrder = orders.find(
      (o) => o.tableId === sourceTable.id && (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );
    if (!sourceOrder) {
      showToast({
        title: language === 'th' ? 'ไม่พบออเดอร์' : 'Order Not Found',
        message: language === 'th' ? 'ไม่พบออเดอร์ที่เปิดค้างอยู่บนโต๊ะต้นทาง' : 'No active order on source table',
        type: 'error',
      });
      return;
    }

    const targetOrder = orders.find(
      (o) => o.tableId === targetTable.id && (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );

    if (actionType === 'move') {
      // Move order from Source to Target table
      const updatedOrder: Order = {
        ...sourceOrder,
        tableId: targetTable.id,
        tableName: targetTable.name,
      };
      await dbPut('orders', updatedOrder);

      // Update tables
      await dbPut('tables', {
        ...sourceTable,
        status: 'empty',
        currentOrderId: undefined,
      });

      await dbPut('tables', {
        ...targetTable,
        status: 'occupied',
        currentOrderId: updatedOrder.id,
      });

      showToast({
        title: language === 'th' ? 'ย้ายโต๊ะสำเร็จ' : 'Table Moved',
        message: language === 'th'
          ? `ย้ายออเดอร์จาก "${sourceTable.name}" ไปยัง "${targetTable.name}" เรียบร้อยแล้ว`
          : `Moved order from "${sourceTable.name}" to "${targetTable.name}"`,
        type: 'success',
      });
    } else if (actionType === 'merge') {
      if (!targetOrder) {
        showToast({
          title: language === 'th' ? 'รวมโต๊ะไม่ได้' : 'Cannot Merge',
          message: language === 'th'
            ? `โต๊ะปลายทาง "${targetTable.name}" ไม่มีออเดอร์เปิดอยู่ (หากต้องการย้าย ให้เลือกฟังก์ชัน "ย้ายโต๊ะ")`
            : `Target table "${targetTable.name}" has no active order. Use "Move Table" instead.`,
          type: 'error',
        });
        return;
      }

      // Merge items from Source Order into Target Order
      const combinedItems = [...targetOrder.items, ...sourceOrder.items];
      const newSubtotal = combinedItems.reduce((acc, i) => acc + i.lineTotal, 0);
      const newCost = combinedItems.reduce((acc, i) => acc + i.unitCost * i.quantity, 0);

      const mergedOrder: Order = {
        ...targetOrder,
        items: combinedItems,
        subtotal: newSubtotal,
        totalAmount: newSubtotal,
        totalCost: newCost,
        grossProfit: newSubtotal - newCost,
      };
      await dbPut('orders', mergedOrder);

      // Cancel / archive source order
      await dbPut('orders', {
        ...sourceOrder,
        status: 'cancelled',
        notes: `รวมเข้ากับโต๊ะ ${targetTable.name} (บิล ${targetOrder.orderNumber})`,
      });

      // Free source table and mark mergedInto
      await dbPut('tables', {
        ...sourceTable,
        status: 'empty',
        currentOrderId: undefined,
        mergedInto: targetTable.id,
      });

      showToast({
        title: language === 'th' ? 'รวมโต๊ะสำเร็จ' : 'Tables Merged',
        message: language === 'th'
          ? `รวมบิลของ "${sourceTable.name}" เข้ากับโต๊ะ "${targetTable.name}" เรียบร้อยแล้ว`
          : `Merged "${sourceTable.name}" into "${targetTable.name}"`,
        type: 'success',
      });
    }

    onCompleted();
    onClose();
  };

  if (!isOpen) return null;

  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.status === 'billing');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF3E0] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#111827] text-base">
                {language === 'th' ? 'จัดการย้ายโต๊ะ / รวมโต๊ะ' : 'Move / Merge Tables'}
              </h3>
              <p className="text-xs text-[#6B7280]">
                {language === 'th' ? 'โอนย้ายออเดอร์หรือรวมบิลระหว่างโต๊ะ' : 'Transfer order or combine bills'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7280] hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Action Choice Pills */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#FFF8EE] rounded-2xl border border-[#FED7AA]">
            <button
              type="button"
              onClick={() => setActionType('move')}
              className={`py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                actionType === 'move'
                  ? 'bg-[#EA580C] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ย้ายโต๊ะ (Move Table)' : 'Move Table'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActionType('merge')}
              className={`py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                actionType === 'merge'
                  ? 'bg-[#EA580C] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Merge className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'รวมโต๊ะ (Merge Bills)' : 'Merge Bills'}</span>
            </button>
          </div>

          {/* Source Table */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#374151]">
              {language === 'th' ? 'โต๊ะต้นทาง (ที่มีลูกค้า/ออเดอร์):' : 'Source Table (Occupied):'}
            </label>
            <select
              value={sourceTableId}
              onChange={(e) => setSourceTableId(e.target.value)}
              className="w-full h-[46px] px-3 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
            >
              {occupiedTables.length === 0 && (
                <option value="">{language === 'th' ? 'ไม่มีโต๊ะที่มีลูกค้า' : 'No occupied tables'}</option>
              )}
              {occupiedTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.zone}) - {t.seats} {language === 'th' ? 'ที่นั่ง' : 'seats'}
                </option>
              ))}
            </select>
          </div>

          {/* Target Table */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#374151]">
              {actionType === 'move'
                ? language === 'th'
                  ? 'ย้ายไปยังโต๊ะปลายทาง (โต๊ะว่าง):'
                  : 'Move to Target Table (Empty):'
                : language === 'th'
                ? 'รวมเข้ากับโต๊ะปลายทาง (ที่มีออเดอร์):'
                : 'Merge into Target Table (Occupied):'}
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full h-[46px] px-3 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
            >
              {tables
                .filter((t) => t.id !== sourceTableId)
                .map((t) => {
                  const isOcc = t.status === 'occupied' || t.status === 'billing';
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.zone}) - {isOcc ? (language === 'th' ? 'มีลูกค้า' : 'Occupied') : (language === 'th' ? 'ว่าง' : 'Available')}
                    </option>
                  );
                })}
            </select>
          </div>

          {actionType === 'merge' && (
            <div className="p-3 bg-[#FEF3C7] rounded-xl border border-[#FCD34D] text-xs text-[#92400E] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <span>
                {language === 'th'
                  ? 'การรวมโต๊ะจะนำรายการอาหารทั้งหมดจากโต๊ะต้นทางไปรวมในบิลของโต๊ะปลายทาง และตั้งสถานะโต๊ะต้นทางเป็นว่าง'
                  : 'Merging will combine all order lines into the target table bill and free up the source table.'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#FED7AA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#FED7AA] bg-white hover:bg-neutral-100 text-[#374151] font-bold text-xs cursor-pointer min-h-[44px]"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleExecute}
              className="px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>{language === 'th' ? 'ยืนยันดำเนินการ' : 'Confirm'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
