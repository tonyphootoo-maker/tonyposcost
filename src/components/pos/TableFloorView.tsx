import React, { useState, useEffect } from 'react';
import { RestaurantTable, Order, TableStatus } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import {
  LayoutGrid,
  Users,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Coffee,
  Sparkles,
  ArrowRightLeft,
  X,
  CreditCard,
  DollarSign,
} from 'lucide-react';

interface TableFloorViewProps {
  onSelectTable: (table: RestaurantTable, existingOrder?: Order) => void;
  onOpenTransferModal?: () => void;
}

export const TableFloorView: React.FC<TableFloorViewProps> = ({
  onSelectTable,
  onOpenTransferModal,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  const [tableForm, setTableForm] = useState<{
    id?: string;
    name: string;
    zone: 'indoor' | 'outdoor' | 'bar' | 'vip';
    seats: number;
  }>({
    name: '',
    zone: 'indoor',
    seats: 4,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tList, oList] = await Promise.all([
      dbGetAll<RestaurantTable>('tables'),
      dbGetAll<Order>('orders'),
    ]);
    setTables(tList);
    setOrders(oList);
  };

  const zones = [
    { id: 'all', label: language === 'th' ? 'ทุกโซน' : 'All Zones' },
    { id: 'indoor', label: language === 'th' ? 'ห้องแอร์ (Indoor)' : 'Indoor' },
    { id: 'outdoor', label: language === 'th' ? 'ระเบียง (Outdoor)' : 'Outdoor' },
    { id: 'bar', label: language === 'th' ? 'บาร์ (Bar)' : 'Bar' },
    { id: 'vip', label: language === 'th' ? 'ห้อง VIP' : 'VIP Room' },
  ];

  const handleOpenAddTable = () => {
    setEditingTable(null);
    setTableForm({
      name: `T-${tables.length + 1}`,
      zone: 'indoor',
      seats: 4,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditTable = (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setTableForm({
      id: table.id,
      name: table.name,
      zone: table.zone as any,
      seats: table.seats,
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteTable = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      language === 'th' ? `ต้องการลบโต๊ะ "${name}" หรือไม่?` : `Delete table "${name}"?`
    );
    if (!confirmed) return;

    await dbDelete('tables', id);
    await loadData();
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.name.trim()) return;

    const table: RestaurantTable = {
      id: tableForm.id || `tbl_${Date.now()}`,
      name: tableForm.name.trim(),
      zone: tableForm.zone,
      seats: tableForm.seats,
      status: editingTable ? editingTable.status : 'empty',
      currentOrderId: editingTable ? editingTable.currentOrderId : undefined,
    };

    await dbPut('tables', table);
    setIsEditModalOpen(false);
    await loadData();
  };

  const handleTableClick = (table: RestaurantTable) => {
    // Find active order for this table
    const activeOrder = orders.find(
      (o) => o.tableId === table.id && (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );
    onSelectTable(table, activeOrder);
  };

  const filteredTables = tables.filter((t) => activeZone === 'all' || t.zone === activeZone);

  // Stats calculation
  const totalSeats = tables.reduce((acc, t) => acc + t.seats, 0);
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner / Zone Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-tight">{t.navTables}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                ว่าง {tables.length - occupiedCount} โต๊ะ
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                ไม่ว่าง {occupiedCount} โต๊ะ
              </span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {language === 'th'
              ? 'แตะที่โต๊ะเพื่อเปิดบิลใหม่ สั่งอาหารเพิ่มเติม หรือเรียกเช็คบิล'
              : 'Tap any table to start a new ticket, add items or request checkout.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTransferModal && (
            <button
              onClick={onOpenTransferModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.mergeTable}</span>
            </button>
          )}

          <button
            onClick={handleOpenAddTable}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'th' ? 'เพิ่มโต๊ะอาหาร' : 'Add Table'}</span>
          </button>
        </div>
      </div>

      {/* Zone Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => setActiveZone(z.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeZone === z.id
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {z.label}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredTables.map((table) => {
          const activeOrder = orders.find(
            (o) => o.tableId === table.id && (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
          );
          const isOccupied = table.status === 'occupied' || !!activeOrder;
          const isBilling = table.status === 'billing';

          // Calculate elapsed minutes if order opened
          let elapsedMinutes: number | null = null;
          if (activeOrder) {
            const diffMs = Date.now() - new Date(activeOrder.createdAt).getTime();
            elapsedMinutes = Math.floor(diffMs / 60000);
          }

          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`group relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 transform hover:-translate-y-1 shadow-lg ${
                isBilling
                  ? 'bg-gradient-to-b from-sky-950/60 to-neutral-950 border-sky-500/60 shadow-sky-950/40 ring-1 ring-sky-500/40'
                  : isOccupied
                  ? 'bg-gradient-to-b from-amber-950/50 to-neutral-950 border-amber-500/60 shadow-amber-950/40 ring-1 ring-amber-500/40'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80 shadow-black/40'
              }`}
            >
              {/* Header: Table Name & Seat count */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-black text-white tracking-tight">{table.name}</div>
                  <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                    {table.zone}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded-lg border border-neutral-800">
                  <Users className="w-3 h-3" />
                  <span>{table.seats}</span>
                </div>
              </div>

              {/* Middle: Order Status / Bill Details */}
              <div className="my-3 min-h-[46px] flex flex-col justify-center">
                {isOccupied && activeOrder ? (
                  <div>
                    <div className="text-base font-extrabold text-amber-400 font-mono">
                      {formatCurrency(activeOrder.totalAmount)}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>{elapsedMinutes !== null ? `${elapsedMinutes} นาที` : 'เพิ่งสั่ง'}</span>
                      <span>• {activeOrder.items.length} รายการ</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'โต๊ะว่าง (พร้อมรับแขก)' : 'Available'}</span>
                  </div>
                )}
              </div>

              {/* Footer: Quick status badge & Edit/Delete on hover */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isBilling
                      ? 'bg-sky-900/60 text-sky-300'
                      : isOccupied
                      ? 'bg-amber-900/60 text-amber-300'
                      : 'bg-emerald-950 text-emerald-400'
                  }`}
                >
                  {isBilling
                    ? language === 'th' ? 'รอเช็คบิล' : 'Billing'
                    : isOccupied
                    ? language === 'th' ? 'มีลูกค้านั่ง' : 'Occupied'
                    : language === 'th' ? 'ว่าง' : 'Empty'}
                </span>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                  <button
                    onClick={(e) => handleOpenEditTable(table, e)}
                    className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                    title={t.edit}
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTable(table.id, table.name, e)}
                    className="p-1 text-neutral-400 hover:text-rose-400 rounded hover:bg-neutral-800"
                    title={t.delete}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Table Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-white text-sm">
                {editingTable
                  ? language === 'th' ? 'แก้ไขโต๊ะอาหาร' : 'Edit Table'
                  : language === 'th' ? 'เพิ่มโต๊ะอาหารใหม่' : 'Add New Table'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {language === 'th' ? 'ชื่อ / หมายเลขโต๊ะ *' : 'Table Number/Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น T-01, Out-02, Bar-1"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {language === 'th' ? 'โซนที่ตั้ง' : 'Floor Zone'}
                </label>
                <select
                  value={tableForm.zone}
                  onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value as any })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                >
                  <option value="indoor">ห้องแอร์ (Indoor)</option>
                  <option value="outdoor">ระเบียงภายนอก (Outdoor)</option>
                  <option value="bar">บาร์เครื่องดื่ม (Bar)</option>
                  <option value="vip">ห้อง VIP</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  {language === 'th' ? 'จำนวนที่นั่ง (Seats)' : 'Seat Capacity'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tableForm.seats}
                  onChange={(e) => setTableForm({ ...tableForm, seats: Number(e.target.value) || 2 })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
