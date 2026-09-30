import React, { useState, useEffect } from 'react';
import { RestaurantTable, Order } from '../../types';
import { dbGetAll, dbPut } from '../../db';
import { useTranslation } from '../../i18n';
import { X, ArrowRightLeft, Merge, Check } from 'lucide-react';

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
      alert(language === 'th' ? 'ไม่พบออเดอร์ในโต๊ะต้นทาง' : 'No active order on source table');
      return;
    }

    const targetOrder = orders.find(
      (o) => o.tableId === targetTable.id && (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );

    if (actionType === 'move') {
      // Move order from Source to Target
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
    } else if (actionType === 'merge' && targetOrder) {
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
        notes: `รวมเข้ากับโต๊ะ ${targetTable.name}`,
      });

      // Free source table
      await dbPut('tables', {
        ...sourceTable,
        status: 'empty',
        currentOrderId: undefined,
      });
    }

    onCompleted();
    onClose();
  };

  if (!isOpen) return null;

  const occupiedTables = tables.filter((t) => t.status === 'occupied' || t.status === 'billing');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-white text-sm">{t.mergeTable}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Action Choice */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setActionType('move')}
              className={`py-2 rounded-lg font-bold transition ${
                actionType === 'move' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
              }`}
            >
              ย้ายโต๊ะ (Move Table)
            </button>
            <button
              type="button"
              onClick={() => setActionType('merge')}
              className={`py-2 rounded-lg font-bold transition ${
                actionType === 'merge' ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400'
              }`}
            >
              รวมโต๊ะ (Merge Bills)
            </button>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              โต๊ะต้นทาง (ที่มีลูกค้า):
            </label>
            <select
              value={sourceTableId}
              onChange={(e) => setSourceTableId(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-bold"
            >
              {occupiedTables.length === 0 && <option value="">ไม่มีโต๊ะที่มีลูกค้า</option>}
              {occupiedTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.zone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              {actionType === 'move' ? 'ย้ายไปยังโต๊ะปลายทาง:' : 'รวมเข้ากับโต๊ะปลายทาง:'}
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-bold"
            >
              {tables
                .filter((t) => t.id !== sourceTableId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.zone}) - {t.status === 'occupied' ? 'มีลูกค้า' : 'โต๊ะว่าง'}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-xl"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleExecute}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>ยืนยันดำเนินการ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
