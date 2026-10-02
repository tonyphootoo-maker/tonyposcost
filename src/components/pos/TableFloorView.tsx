import React, { useState, useEffect, useRef } from 'react';
import { RestaurantTable, Order, TableStatus, TableShape } from '../../types';
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
  Grid,
  Move,
  Maximize2,
  Minimize2,
  Circle,
  Square,
  Check,
  FolderPlus,
  AlertTriangle,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';
import { TableTransferModal } from './TableTransferModal';

interface TableFloorViewProps {
  onSelectTable: (table: RestaurantTable, existingOrder?: Order) => void;
  onOpenTransferModal?: () => void;
}

interface ZoneItem {
  id: string;
  name: string;
}

export const TableFloorView: React.FC<TableFloorViewProps> = ({
  onSelectTable,
  onOpenTransferModal,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Transfer / Merge Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Table Edit/Add Modal
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableForm, setTableForm] = useState<{
    id?: string;
    name: string;
    zone: string;
    seats: number;
    shape: TableShape;
    w: number;
    h: number;
  }>({
    name: '',
    zone: 'indoor',
    seats: 4,
    shape: 'rect',
    w: 120,
    h: 120,
  });

  // Zones Management
  const [zones, setZones] = useState<ZoneItem[]>([
    { id: 'indoor', name: 'ห้องแอร์ (Indoor)' },
    { id: 'outdoor', name: 'ระเบียง (Outdoor)' },
    { id: 'bar', name: 'บาร์ (Bar)' },
    { id: 'vip', name: 'ห้อง VIP' },
  ]);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState('');

  // Canvas Dragging State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tList, oList] = await Promise.all([
      dbGetAll<RestaurantTable>('tables'),
      dbGetAll<Order>('orders'),
    ]);

    // Ensure all tables have basic coordinates for canvas view
    const initializedTables = tList.map((tbl, index) => {
      let x = tbl.x;
      let y = tbl.y;
      if (x === undefined || y === undefined) {
        const col = index % 5;
        const row = Math.floor(index / 5);
        x = 30 + col * 150;
        y = 30 + row * 150;
      }
      return {
        ...tbl,
        x,
        y,
        w: tbl.w || 120,
        h: tbl.h || 120,
        shape: tbl.shape || 'rect',
        zone: tbl.zone || 'indoor',
      };
    });

    setTables(initializedTables);
    setOrders(oList);

    // Extract dynamic zones from existing tables
    const uniqueZones = new Set<string>();
    initializedTables.forEach((t) => {
      if (t.zone) uniqueZones.add(t.zone);
    });

    const standardZoneNames: Record<string, string> = {
      indoor: 'ห้องแอร์ (Indoor)',
      outdoor: 'ระเบียง (Outdoor)',
      bar: 'บาร์ (Bar)',
      vip: 'ห้อง VIP',
    };

    const resolvedZones: ZoneItem[] = Array.from(uniqueZones).map((zid) => ({
      id: zid,
      name: standardZoneNames[zid] || zid,
    }));

    if (resolvedZones.length > 0) {
      setZones(resolvedZones);
    }
  };

  // Dragging handlers for Edit mode
  const handlePointerDownTable = (table: RestaurantTable, e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const tableX = table.x || 0;
    const tableY = table.y || 0;

    const pointerCanvasX = e.clientX - canvasRect.left + canvas.scrollLeft;
    const pointerCanvasY = e.clientY - canvasRect.top + canvas.scrollTop;

    setDraggingTableId(table.id);
    setDragOffset({
      x: pointerCanvasX - tableX,
      y: pointerCanvasY - tableY,
    });

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!isEditMode || !draggingTableId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const pointerCanvasX = e.clientX - canvasRect.left + canvas.scrollLeft;
    const pointerCanvasY = e.clientY - canvasRect.top + canvas.scrollTop;

    let newX = pointerCanvasX - dragOffset.x;
    let newY = pointerCanvasY - dragOffset.y;

    if (snapToGrid) {
      newX = Math.round(newX / 20) * 20;
      newY = Math.round(newY / 20) * 20;
    }

    newX = Math.max(10, Math.min(newX, 2400));
    newY = Math.max(10, Math.min(newY, 1800));

    setTables((prev) =>
      prev.map((t) => (t.id === draggingTableId ? { ...t, x: newX, y: newY } : t))
    );
  };

  const handlePointerUpCanvas = async () => {
    if (!isEditMode || !draggingTableId) return;
    const draggedTable = tables.find((t) => t.id === draggingTableId);
    setDraggingTableId(null);

    if (draggedTable) {
      await dbPut('tables', draggedTable);
    }
  };

  const handleOpenAddTable = () => {
    setEditingTable(null);
    const newIndex = tables.length + 1;
    const defaultZone = activeZone !== 'all' ? activeZone : 'indoor';
    setTableForm({
      name: `T-${newIndex < 10 ? `0${newIndex}` : newIndex}`,
      zone: defaultZone,
      seats: 4,
      shape: 'rect',
      w: 120,
      h: 120,
    });
    setIsEditTableModalOpen(true);
  };

  const handleOpenEditTable = (table: RestaurantTable, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTable(table);
    setTableForm({
      id: table.id,
      name: table.name,
      zone: table.zone || 'indoor',
      seats: table.seats || 4,
      shape: table.shape || 'rect',
      w: table.w || 120,
      h: table.h || 120,
    });
    setIsEditTableModalOpen(true);
  };

  const handleDeleteTable = async (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetTable = tables.find((t) => t.id === id);
    const hasOpenOrder = orders.some(
      (o) => o.tableId === id && o.status !== 'paid' && o.status !== 'cancelled'
    );
    if (hasOpenOrder || targetTable?.status === 'occupied' || targetTable?.status === 'billing') {
      alert(
        language === 'th'
          ? `❌ ไม่สามารถลบโต๊ะ "${name}" ได้ เนื่องจากยังมีออเดอร์ที่ยังไม่ปิดบิลหรือลูกค้านั่งอยู่ (กรุณาย้ายออเดอร์หรือชำระเงินก่อน)`
          : `❌ Cannot delete table "${name}" with an active open order.`
      );
      return;
    }

    const confirmed = window.confirm(
      language === 'th' ? `ต้องการลบโต๊ะ "${name}" หรือไม่?` : `Delete table "${name}"?`
    );
    if (!confirmed) return;

    await dbDelete('tables', id);
    showToast({
      title: language === 'th' ? 'ลบโต๊ะสำเร็จ' : 'Table Deleted',
      message: `${name}`,
      type: 'success',
    });
    await loadData();
    setIsEditTableModalOpen(false);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.name.trim()) return;

    // Default position if new table
    let posX = 30;
    let posY = 30;
    if (!editingTable) {
      const offset = (tables.length % 8) * 30;
      posX = 50 + offset;
      posY = 50 + offset;
    } else {
      posX = editingTable.x || 30;
      posY = editingTable.y || 30;
    }

    const table: RestaurantTable = {
      id: tableForm.id || `tbl_${Date.now()}`,
      name: tableForm.name.trim(),
      zone: tableForm.zone,
      seats: Number(tableForm.seats) || 4,
      shape: tableForm.shape,
      w: Number(tableForm.w) || 120,
      h: Number(tableForm.h) || 120,
      x: posX,
      y: posY,
      status: editingTable ? editingTable.status : 'empty',
      currentOrderId: editingTable ? editingTable.currentOrderId : undefined,
    };

    await dbPut('tables', table);
    showToast({
      title: language === 'th' ? 'บันทึกสำเร็จ' : 'Saved',
      message: `โต๊ะ ${table.name}`,
      type: 'success',
    });
    setIsEditTableModalOpen(false);
    await loadData();
  };

  const handleTableClick = (table: RestaurantTable) => {
    if (isEditMode) {
      handleOpenEditTable(table);
      return;
    }

    // Find active order for this table
    const activeOrder = orders.find(
      (o) =>
        o.tableId === table.id &&
        (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );
    onSelectTable(table, activeOrder);
  };

  // Quick shape toggle in edit mode
  const handleToggleShape = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    const newShape: TableShape = table.shape === 'round' ? 'rect' : 'round';
    const updated = { ...table, shape: newShape };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
  };

  // Quick resize in edit mode (+ / - seats)
  const handleDeltaSeats = async (table: RestaurantTable, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSeats = Math.max(1, (table.seats || 4) + delta);
    const updated = { ...table, seats: newSeats };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
  };

  // Zone Management Handlers
  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    const id = `zone_${Date.now()}`;
    const updated = [...zones, { id, name: newZoneName.trim() }];
    setZones(updated);
    setNewZoneName('');
    showToast({ title: 'สำเร็จ', message: `เพิ่มโซน ${newZoneName.trim()}`, type: 'success' });
  };

  const handleUpdateZone = (id: string) => {
    if (!editingZoneName.trim()) return;
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, name: editingZoneName.trim() } : z))
    );
    setEditingZoneId(null);
    setEditingZoneName('');
  };

  const handleDeleteZone = (id: string) => {
    const isUsed = tables.some((t) => t.zone === id);
    if (isUsed) {
      alert(
        language === 'th'
          ? 'ไม่สามารถลบโซนนี้ได้ เนื่องจากยังมีโต๊ะที่จัดอยู่ในโซนนี้'
          : 'Cannot delete zone containing tables.'
      );
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
    if (activeZone === id) setActiveZone('all');
  };

  const filteredTables = tables.filter((t) => activeZone === 'all' || t.zone === activeZone);

  // Stats
  const totalSeats = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
  const occupiedCount = tables.filter(
    (t) =>
      t.status === 'occupied' ||
      orders.some(
        (o) =>
          o.tableId === t.id &&
          (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
      )
  ).length;
  const billingCount = tables.filter((t) => t.status === 'billing').length;
  const freeCount = Math.max(0, tables.length - occupiedCount);

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-full select-none">
      {/* Top Banner / Zone Switcher / Mode Switcher (Section 3A Warm Light Theme) */}
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3E0] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">
                  {language === 'th' ? 'ผังโต๊ะอาหาร (Floor Plan)' : 'Table Floor Plan'}
                </h2>
                {/* Status Badges */}
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                    {language === 'th' ? `ว่าง ${freeCount}` : `Free ${freeCount}`}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFEDD5] text-[#9A3412] border border-[#FDBA74]">
                    {language === 'th' ? `มีลูกค้า ${occupiedCount}` : `Occupied ${occupiedCount}`}
                  </span>
                  {billingCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FEF08A] text-[#854D0E] border border-[#FACC15]">
                      {language === 'th' ? `รอเช็คบิล ${billingCount}` : `Billing ${billingCount}`}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {isEditMode
                  ? language === 'th'
                    ? '🛠️ โหมดแก้ไขผัง: ลากย้ายตำแหน่งโต๊ะบนผัง, ปรับรูปทรงกลม/เหลี่ยม หรือเพิ่มโต๊ะใหม่'
                    : '🛠️ Edit Mode: Drag tables freely, change shape/seats, or add new tables'
                  : language === 'th'
                  ? 'แตะที่โต๊ะเพื่อเปิดออเดอร์ใหม่ สั่งอาหาร หรือจัดการเช็คบิล'
                  : 'Tap any table to start a new order, add items, or checkout'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
          {/* Snap to grid toggle (Edit mode only) */}
          {isEditMode && (
            <button
              type="button"
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                snapToGrid
                  ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
                  : 'bg-white border-[#FED7AA] text-[#6B7280]'
              }`}
              title="สลับการดูดเส้นตาราง (Snap to Grid)"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{language === 'th' ? 'ดูดเส้นตาราง' : 'Snap Grid'}</span>
            </button>
          )}

          {/* Transfer / Merge Button */}
          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF8EE] hover:bg-[#FFEDD5] text-[#9A3412] text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-[#EA580C]" />
            <span>{language === 'th' ? 'ย้าย / รวมโต๊ะ' : 'Move / Merge'}</span>
          </button>

          {/* Mode Toggle Button: View Mode vs Edit Mode */}
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              isEditMode
                ? 'bg-[#111827] text-white hover:bg-neutral-800'
                : 'bg-white border-2 border-[#EA580C] text-[#EA580C] hover:bg-[#FFEDD5]'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-4 h-4" />
                <span>{language === 'th' ? 'เสร็จสิ้นการจัดผัง' : 'Done Editing'}</span>
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4" />
                <span>{language === 'th' ? 'จัดผังโต๊ะ (Edit Mode)' : 'Edit Layout'}</span>
              </>
            )}
          </button>

          {/* Add Table Button */}
          <button
            type="button"
            onClick={handleOpenAddTable}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'th' ? '+ เพิ่มโต๊ะ' : '+ Add Table'}</span>
          </button>
        </div>
      </div>

      {/* Zone Tabs Bar + Manage Zones */}
      <div className="flex items-center justify-between gap-2 border-b border-[#FED7AA]/60 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setActiveZone('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
              activeZone === 'all'
                ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412] shadow-2xs'
                : 'bg-white border-[#FED7AA] text-[#374151] hover:bg-[#FFF8EE]'
            }`}
          >
            {language === 'th' ? 'ทุกโซน (All Zones)' : 'All Zones'} ({tables.length})
          </button>

          {zones.map((z) => {
            const count = tables.filter((t) => t.zone === z.id).length;
            const isActive = activeZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setActiveZone(z.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                  isActive
                    ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412] shadow-2xs'
                    : 'bg-white border-[#FED7AA] text-[#374151] hover:bg-[#FFF8EE]'
                }`}
              >
                {z.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Manage Zones Button */}
        {isEditMode && (
          <button
            type="button"
            onClick={() => setIsZoneModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#EA580C] bg-[#FFF3E0] hover:bg-[#FFEDD5] border border-[#FED7AA] shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{language === 'th' ? 'จัดการโซน' : 'Manage Zones'}</span>
          </button>
        )}
      </div>

      {/* Main Floor Canvas (Free-form layout with mouse/touch drag in edit mode) */}
      <div
        ref={canvasRef}
        onPointerMove={handlePointerMoveCanvas}
        onPointerUp={handlePointerUpCanvas}
        onPointerLeave={handlePointerUpCanvas}
        className={`relative flex-1 min-h-[520px] rounded-3xl border-2 overflow-auto bg-[#FFFBF5] transition-all p-4 shadow-inner ${
          isEditMode
            ? 'border-dashed border-[#F97316] bg-[radial-gradient(#FDBA74_1px,transparent_1px)] [background-size:20px_20px]'
            : 'border-[#FED7AA]'
        }`}
      >
        {filteredTables.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-white/70 rounded-2xl m-4 border border-dashed border-[#FED7AA]">
            <Coffee className="w-12 h-12 text-[#EA580C] mb-2 opacity-60" />
            <p className="text-base font-bold text-[#111827]">
              {language === 'th' ? 'ยังไม่มีโต๊ะในโซนนี้' : 'No tables in this zone'}
            </p>
            <p className="text-xs text-[#6B7280] mt-1">
              กดปุ่ม "+ เพิ่มโต๊ะ" ด้านบนเพื่อเริ่มสร้างโต๊ะอาหาร
            </p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const activeOrder = orders.find(
              (o) =>
                o.tableId === table.id &&
                (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
            );
            const isOccupied = table.status === 'occupied' || !!activeOrder;
            const isBilling = table.status === 'billing';

            // Elapsed time calculation
            let elapsedMinutes: number | null = null;
            if (activeOrder) {
              const diffMs = Date.now() - new Date(activeOrder.createdAt).getTime();
              elapsedMinutes = Math.floor(diffMs / 60000);
            }

            const isRound = table.shape === 'round';
            const width = Math.max(110, table.w || 130);
            const height = Math.max(110, table.h || 130);

            return (
              <div
                key={table.id}
                onPointerDown={(e) => handlePointerDownTable(table, e)}
                onClick={() => handleTableClick(table)}
                style={{
                  position: 'absolute',
                  left: `${table.x || 30}px`,
                  top: `${table.y || 30}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  zIndex: draggingTableId === table.id ? 40 : 10,
                }}
                className={`group flex flex-col justify-between p-3.5 transition-shadow select-none ${
                  isRound ? 'rounded-full text-center' : 'rounded-3xl'
                } border-2 cursor-pointer shadow-md ${
                  isBilling
                    ? 'bg-[#FEFCE8] border-[#EAB308] text-[#854D0E] ring-2 ring-[#FACC15]'
                    : isOccupied
                    ? 'bg-[#FFF8EE] border-[#EA580C] text-[#9A3412] shadow-orange-100 ring-2 ring-[#F97316]'
                    : 'bg-[#FFFFFF] border-emerald-400 text-emerald-800 hover:border-emerald-600 hover:shadow-lg'
                } ${isEditMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-[#EA580C]' : 'active:scale-95'}`}
              >
                {/* Header: Table Name & Seats */}
                <div
                  className={`flex items-center ${
                    isRound ? 'justify-center flex-col pt-1' : 'justify-between'
                  }`}
                >
                  <div className="font-black text-lg sm:text-xl text-[#111827] leading-none tracking-tight">
                    {table.name}
                  </div>
                  <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#6B7280]">
                    <Users className="w-3 h-3 text-[#EA580C]" />
                    <span>{table.seats}</span>
                  </div>
                </div>

                {/* Middle: Order Details or Free state */}
                <div className="my-auto">
                  {isOccupied && activeOrder ? (
                    <div className="space-y-0.5">
                      <div className="text-base sm:text-lg font-black text-[#EA580C] font-mono leading-none">
                        {formatCurrency(activeOrder.totalAmount)}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#9A3412]">
                        <Clock className="w-3 h-3 text-[#EA580C]" />
                        <span>
                          {elapsedMinutes !== null && elapsedMinutes > 0
                            ? `${elapsedMinutes}น.`
                            : 'เพิ่งสั่ง'}
                        </span>
                        <span>• {activeOrder.items?.length || 0}จาน</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'th' ? 'ว่าง' : 'Free'}</span>
                    </div>
                  )}
                </div>

                {/* Footer or Quick Edit Controls */}
                {isEditMode ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 pt-1 border-t border-[#FED7AA]/50"
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleShape(table, e)}
                      className="p-1 rounded-md bg-white border border-[#FED7AA] hover:bg-[#FFEDD5] text-[#374151]"
                      title="สลับรูปทรง กลม/เหลี่ยม"
                    >
                      {isRound ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeltaSeats(table, -1, e)}
                      className="w-5 h-5 rounded-md bg-white border border-[#FED7AA] flex items-center justify-center text-xs font-bold"
                      title="ลดที่นั่ง"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeltaSeats(table, 1, e)}
                      className="w-5 h-5 rounded-md bg-white border border-[#FED7AA] flex items-center justify-center text-xs font-bold"
                      title="เพิ่มที่นั่ง"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditTable(table, e)}
                      className="p-1 rounded-md bg-white border border-[#FED7AA] hover:bg-[#FFEDD5] text-[#EA580C]"
                      title="แก้ไขข้อมูลโต๊ะ"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-center text-[#6B7280] truncate">
                    {table.zone}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit / Add Table Modal */}
      {isEditTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-[#111827] text-base">
                  {editingTable
                    ? language === 'th'
                      ? 'แก้ไขข้อมูลโต๊ะอาหาร'
                      : 'Edit Table'
                    : language === 'th'
                    ? 'เพิ่มโต๊ะอาหารใหม่'
                    : 'Add New Table'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTableModalOpen(false)}
                className="p-1 text-[#6B7280] hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  {language === 'th' ? 'ชื่อ / หมายเลขโต๊ะ *' : 'Table Name / Number *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น T-01, Out-02, Bar-1"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  className="w-full h-[46px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'โซนที่ตั้ง' : 'Floor Zone'}
                  </label>
                  <select
                    value={tableForm.zone}
                    onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })}
                    className="w-full h-[46px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'จำนวนที่นั่ง (Seats)' : 'Seats'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tableForm.seats}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, seats: Number(e.target.value) || 2 })
                    }
                    className="w-full h-[46px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Shape Selection */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  {language === 'th' ? 'รูปทรงโต๊ะ' : 'Table Shape'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTableForm({ ...tableForm, shape: 'rect' })}
                    className={`h-[44px] rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                      tableForm.shape === 'rect'
                        ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    <Square className="w-4 h-4" />
                    <span>{language === 'th' ? 'สี่เหลี่ยม (Rectangle)' : 'Rectangle'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableForm({ ...tableForm, shape: 'round' })}
                    className={`h-[44px] rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                      tableForm.shape === 'round'
                        ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
                        : 'bg-white border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    <Circle className="w-4 h-4" />
                    <span>{language === 'th' ? 'ทรงกลม (Round)' : 'Round'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 pt-3 border-t border-[#FED7AA]">
                {editingTable ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(editingTable.id, editingTable.name)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] cursor-pointer"
                  >
                    {language === 'th' ? 'ลบโต๊ะนี้' : 'Delete Table'}
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditTableModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#FED7AA] bg-white hover:bg-neutral-100 text-[#374151] font-bold text-xs cursor-pointer min-h-[44px]"
                  >
                    {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-xs cursor-pointer min-h-[44px]"
                  >
                    {language === 'th' ? 'บันทึก' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zone Management Modal */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h3 className="font-extrabold text-[#111827] text-base">
                {language === 'th' ? 'จัดการโซนร้านอาหาร' : 'Manage Floor Zones'}
              </h3>
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="p-1 text-[#6B7280] hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Zone Form */}
            <form onSubmit={handleAddZone} className="flex gap-2">
              <input
                type="text"
                placeholder={language === 'th' ? 'ชื่อโซนใหม่ เช่น ชั้น 2, ริมสระ' : 'New zone name'}
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="flex-1 h-[44px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316]"
              />
              <button
                type="submit"
                className="px-4 h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs cursor-pointer"
              >
                {language === 'th' ? '+ เพิ่ม' : '+ Add'}
              </button>
            </form>

            {/* List of Zones */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between p-2.5 bg-[#FFF8EE] rounded-xl border border-[#FED7AA]"
                >
                  {editingZoneId === z.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editingZoneName}
                        onChange={(e) => setEditingZoneName(e.target.value)}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-[#FDBA74] bg-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateZone(z.id)}
                        className="p-1.5 rounded-lg bg-[#EA580C] text-white font-bold text-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-bold text-sm text-[#111827]">{z.name}</span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingZoneId(z.id);
                        setEditingZoneName(z.name);
                      }}
                      className="p-1.5 text-[#6B7280] hover:text-[#EA580C] rounded-lg"
                      title="แก้ไขชื่อโซน"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteZone(z.id)}
                      className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg"
                      title="ลบโซน"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#FED7AA]">
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#EA580C] text-white font-bold text-xs"
              >
                {language === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move / Merge Table Modal */}
      {isTransferModalOpen && (
        <TableTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          onCompleted={() => loadData()}
        />
      )}
    </div>
  );
};
