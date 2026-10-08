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
  ArrowRightLeft,
  X,
  Grid,
  Maximize2,
  Circle,
  Square,
  RectangleHorizontal,
  RotateCw,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  Check,
  FolderPlus,
  Armchair,
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

type GridSnapMode = 20 | 10 | 1;

interface QuickPreset {
  labelTh: string;
  labelEn: string;
  shape: TableShape;
  seats: number;
  w: number;
  h: number;
  icon: React.ReactNode;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    labelTh: 'โต๊ะคู่ (2 ที่นั่ง)',
    labelEn: 'Pair Table (2 seats)',
    shape: 'square',
    seats: 2,
    w: 75,
    h: 75,
    icon: <Square className="w-3.5 h-3.5 text-orange-600" />,
  },
  {
    labelTh: 'โต๊ะครอบครัว (4 ที่นั่ง)',
    labelEn: 'Family (4 seats)',
    shape: 'rect',
    seats: 4,
    w: 105,
    h: 70,
    icon: <RectangleHorizontal className="w-3.5 h-3.5 text-orange-600" />,
  },
  {
    labelTh: 'โต๊ะกลม (4 ที่นั่ง)',
    labelEn: 'Round Table (4 seats)',
    shape: 'round',
    seats: 4,
    w: 80,
    h: 80,
    icon: <Circle className="w-3.5 h-3.5 text-orange-600" />,
  },
  {
    labelTh: 'เคาน์เตอร์บาร์ (4 ที่นั่ง)',
    labelEn: 'Bar Counter (4 seats)',
    shape: 'bar',
    seats: 4,
    w: 150,
    h: 50,
    icon: <span className="font-mono text-xs font-bold text-orange-600">━━</span>,
  },
  {
    labelTh: 'บูธโซฟา (4 ที่นั่ง)',
    labelEn: 'Sofa Booth (4 seats)',
    shape: 'booth',
    seats: 4,
    w: 105,
    h: 85,
    icon: <Armchair className="w-3.5 h-3.5 text-orange-600" />,
  },
];

export const TableFloorView: React.FC<TableFloorViewProps> = ({
  onSelectTable,
  onOpenTransferModal,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [gridSnap, setGridSnap] = useState<GridSnapMode>(20);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

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
    shape: 'square',
    w: 80,
    h: 80,
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

  // Preset Add Dropdown
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  // Canvas Dragging State
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragCurrentCoords, setDragCurrentCoords] = useState<{ x: number; y: number } | null>(null);

  // Canvas Resizing State
  const [resizingTableId, setResizingTableId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    pointerX: number;
    pointerY: number;
    w: number;
    h: number;
  }>({ pointerX: 0, pointerY: 0, w: 80, h: 80 });
  const [resizeCurrentDims, setResizeCurrentDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tList, oList] = await Promise.all([
      dbGetAll<RestaurantTable>('tables'),
      dbGetAll<Order>('orders'),
    ]);

    // Ensure all tables have realistic coordinates and compact sizes
    const initializedTables = tList.map((tbl, index) => {
      let x = tbl.x;
      let y = tbl.y;
      if (x === undefined || y === undefined) {
        const col = index % 5;
        const row = Math.floor(index / 5);
        x = 40 + col * 140;
        y = 40 + row * 130;
      }

      const shape: TableShape = tbl.shape || (tbl.seats > 4 ? 'rect' : 'square');
      let defaultW = 80;
      let defaultH = 80;

      if (shape === 'rect') {
        defaultW = tbl.seats >= 6 ? 125 : 105;
        defaultH = 70;
      } else if (shape === 'bar') {
        defaultW = 150;
        defaultH = 50;
      } else if (shape === 'booth') {
        defaultW = 105;
        defaultH = 85;
      } else if (shape === 'round') {
        defaultW = tbl.seats >= 6 ? 95 : 80;
        defaultH = tbl.seats >= 6 ? 95 : 80;
      }

      return {
        ...tbl,
        x,
        y,
        w: tbl.w ? Math.max(55, tbl.w) : defaultW,
        h: tbl.h ? Math.max(45, tbl.h) : defaultH,
        shape,
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

  // ================= DRAG & DROP POSITIONING (ROCK-SOLID WINDOW LISTENERS) =================
  const handlePointerDownTable = (table: RestaurantTable, e: React.PointerEvent) => {
    if (!isEditMode) return;
    // Don't drag if clicking resize handle or toolbar buttons
    const target = e.target as HTMLElement;
    if (target.closest('.no-drag-handle')) return;

    e.preventDefault();
    e.stopPropagation();
    setSelectedTableId(table.id);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const tableX = table.x || 0;
    const tableY = table.y || 0;

    const pointerCanvasX = (e.clientX - canvasRect.left + canvas.scrollLeft) / zoomScale;
    const pointerCanvasY = (e.clientY - canvasRect.top + canvas.scrollTop) / zoomScale;

    setDraggingTableId(table.id);
    setDragOffset({
      x: pointerCanvasX - tableX,
      y: pointerCanvasY - tableY,
    });
    setDragCurrentCoords({ x: tableX, y: tableY });
  };

  // ================= RESIZING HANDLER =================
  const handlePointerDownResize = (table: RestaurantTable, e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedTableId(table.id);

    setResizingTableId(table.id);
    setResizeStart({
      pointerX: e.clientX,
      pointerY: e.clientY,
      w: table.w || 80,
      h: table.h || 80,
    });
    setResizeCurrentDims({ w: table.w || 80, h: table.h || 80 });
  };

  // Attach global window listeners whenever dragging or resizing is active
  useEffect(() => {
    if (!draggingTableId && !resizingTableId) return;

    const onPointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();

      // Handle Resizing
      if (resizingTableId) {
        const deltaX = (e.clientX - resizeStart.pointerX) / zoomScale;
        const deltaY = (e.clientY - resizeStart.pointerY) / zoomScale;

        let newW = resizeStart.w + deltaX;
        let newH = resizeStart.h + deltaY;

        if (gridSnap > 1) {
          newW = Math.round(newW / gridSnap) * gridSnap;
          newH = Math.round(newH / gridSnap) * gridSnap;
        }

        newW = Math.max(55, Math.min(newW, 400));
        newH = Math.max(45, Math.min(newH, 400));

        setResizeCurrentDims({ w: Math.round(newW), h: Math.round(newH) });
        setTables((prev) =>
          prev.map((t) => (t.id === resizingTableId ? { ...t, w: newW, h: newH } : t))
        );
        return;
      }

      // Handle Dragging
      if (draggingTableId) {
        const pointerCanvasX = (e.clientX - canvasRect.left + canvas.scrollLeft) / zoomScale;
        const pointerCanvasY = (e.clientY - canvasRect.top + canvas.scrollTop) / zoomScale;

        let newX = pointerCanvasX - dragOffset.x;
        let newY = pointerCanvasY - dragOffset.y;

        if (gridSnap > 1) {
          newX = Math.round(newX / gridSnap) * gridSnap;
          newY = Math.round(newY / gridSnap) * gridSnap;
        }

        newX = Math.max(10, Math.min(newX, 2800));
        newY = Math.max(10, Math.min(newY, 2000));

        setDragCurrentCoords({ x: Math.round(newX), y: Math.round(newY) });
        setTables((prev) =>
          prev.map((t) => (t.id === draggingTableId ? { ...t, x: newX, y: newY } : t))
        );
      }
    };

    const onPointerUp = async () => {
      if (draggingTableId) {
        const currentDragged = tables.find((t) => t.id === draggingTableId);
        setDraggingTableId(null);
        setDragCurrentCoords(null);
        if (currentDragged) {
          await dbPut('tables', currentDragged);
        }
      }

      if (resizingTableId) {
        const currentResized = tables.find((t) => t.id === resizingTableId);
        setResizingTableId(null);
        setResizeCurrentDims(null);
        if (currentResized) {
          await dbPut('tables', currentResized);
          showToast({
            title: language === 'th' ? 'ปรับขนาดเรียบร้อย' : 'Resized',
            message: `${currentResized.name}: ${Math.round(currentResized.w || 80)} × ${Math.round(currentResized.h || 80)} px`,
            type: 'info',
          });
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [draggingTableId, resizingTableId, dragOffset, gridSnap, zoomScale, resizeStart, tables, language]);

  // ================= ADD & EDIT TABLE MODAL =================
  const handleOpenAddTable = () => {
    setEditingTable(null);
    const newIndex = tables.length + 1;
    const defaultZone = activeZone !== 'all' ? activeZone : 'indoor';
    setTableForm({
      name: `T-${newIndex < 10 ? `0${newIndex}` : newIndex}`,
      zone: defaultZone,
      seats: 4,
      shape: 'square',
      w: 80,
      h: 80,
    });
    setIsEditTableModalOpen(true);
  };

  const handleAddPreset = async (preset: QuickPreset) => {
    const newIndex = tables.length + 1;
    const defaultZone = activeZone !== 'all' ? activeZone : 'indoor';
    const offset = (tables.length % 6) * 35;

    const newTable: RestaurantTable = {
      id: `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `T-${newIndex < 10 ? `0${newIndex}` : newIndex}`,
      zone: defaultZone,
      seats: preset.seats,
      shape: preset.shape,
      w: preset.w,
      h: preset.h,
      x: 50 + offset,
      y: 50 + offset,
      status: 'empty',
    };

    await dbPut('tables', newTable);
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(newTable.id);
    setIsPresetMenuOpen(false);
    showToast({
      title: language === 'th' ? 'เพิ่มโต๊ะสำเร็จ' : 'Table Added',
      message: `${newTable.name} (${preset.labelTh})`,
      type: 'success',
    });
  };

  const handleDuplicateTable = async (table: RestaurantTable, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newIndex = tables.length + 1;
    const duplicated: RestaurantTable = {
      ...table,
      id: `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `T-${newIndex < 10 ? `0${newIndex}` : newIndex}`,
      x: (table.x || 40) + 30,
      y: (table.y || 40) + 30,
      status: 'empty',
      currentOrderId: undefined,
      openedAt: undefined,
      guestCount: undefined,
    };

    await dbPut('tables', duplicated);
    setTables((prev) => [...prev, duplicated]);
    setSelectedTableId(duplicated.id);
    showToast({
      title: language === 'th' ? 'คัดลอกโต๊ะสำเร็จ' : 'Table Duplicated',
      message: `${duplicated.name}`,
      type: 'success',
    });
  };

  const handleRotateTable = async (table: RestaurantTable, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentW = table.w || 80;
    const currentH = table.h || 80;
    // Swap width & height for rotation
    const updated: RestaurantTable = {
      ...table,
      w: currentH,
      h: currentW,
    };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
    showToast({
      title: language === 'th' ? 'หมุนโต๊ะ 90°' : 'Rotated 90°',
      message: `${table.name}: ${currentH} × ${currentW} px`,
      type: 'info',
    });
  };

  const handleCycleShape = async (table: RestaurantTable, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const shapes: TableShape[] = ['square', 'rect', 'round', 'bar', 'booth'];
    const currentIndex = shapes.indexOf(table.shape || 'square');
    const nextShape = shapes[(currentIndex + 1) % shapes.length];

    // Sensible default dimensions per shape
    let nextW = table.w || 80;
    let nextH = table.h || 80;
    if (nextShape === 'bar') {
      nextW = 150;
      nextH = 50;
    } else if (nextShape === 'rect') {
      nextW = 105;
      nextH = 70;
    } else if (nextShape === 'square') {
      nextW = 80;
      nextH = 80;
    } else if (nextShape === 'round') {
      nextW = 80;
      nextH = 80;
    } else if (nextShape === 'booth') {
      nextW = 105;
      nextH = 85;
    }

    const updated: RestaurantTable = {
      ...table,
      shape: nextShape,
      w: nextW,
      h: nextH,
    };

    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
  };

  const handleQuickPresetSize = async (
    table: RestaurantTable,
    size: 'S' | 'M' | 'L' | 'XL',
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    const shape = table.shape || 'square';
    let w = 80;
    let h = 80;

    if (shape === 'square') {
      w = size === 'S' ? 65 : size === 'M' ? 80 : size === 'L' ? 100 : 130;
      h = w;
    } else if (shape === 'rect') {
      if (size === 'S') { w = 85; h = 60; }
      else if (size === 'M') { w = 105; h = 70; }
      else if (size === 'L') { w = 135; h = 80; }
      else { w = 165; h = 90; }
    } else if (shape === 'round') {
      w = size === 'S' ? 65 : size === 'M' ? 80 : size === 'L' ? 105 : 135;
      h = w;
    } else if (shape === 'bar') {
      if (size === 'S') { w = 110; h = 45; }
      else if (size === 'M') { w = 150; h = 50; }
      else if (size === 'L') { w = 200; h = 55; }
      else { w = 260; h = 60; }
    } else if (shape === 'booth') {
      if (size === 'S') { w = 85; h = 75; }
      else if (size === 'M') { w = 105; h = 85; }
      else if (size === 'L') { w = 130; h = 95; }
      else { w = 160; h = 110; }
    }

    const updated: RestaurantTable = { ...table, w, h };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
  };

  const handleDeltaSeats = async (table: RestaurantTable, delta: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSeats = Math.max(1, Math.min(24, (table.seats || 2) + delta));
    const updated = { ...table, seats: newSeats };
    await dbPut('tables', updated);
    setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
  };

  const handleOpenEditTable = (table: RestaurantTable, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTable(table);
    setTableForm({
      id: table.id,
      name: table.name,
      zone: table.zone || 'indoor',
      seats: table.seats || 4,
      shape: table.shape || 'square',
      w: table.w || 80,
      h: table.h || 80,
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
    if (selectedTableId === id) setSelectedTableId(null);
    await loadData();
    setIsEditTableModalOpen(false);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.name.trim()) return;

    let posX = 40;
    let posY = 40;
    if (!editingTable) {
      const offset = (tables.length % 8) * 35;
      posX = 50 + offset;
      posY = 50 + offset;
    } else {
      posX = editingTable.x || 40;
      posY = editingTable.y || 40;
    }

    const table: RestaurantTable = {
      id: tableForm.id || `tbl_${Date.now()}`,
      name: tableForm.name.trim(),
      zone: tableForm.zone,
      seats: Number(tableForm.seats) || 2,
      shape: tableForm.shape,
      w: Number(tableForm.w) || 80,
      h: Number(tableForm.h) || 80,
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
      setSelectedTableId(table.id);
      return;
    }

    // Find active order for this table in POS mode
    const activeOrder = orders.find(
      (o) =>
        o.tableId === table.id &&
        (o.status === 'open' || o.status === 'kitchen_preparing' || o.status === 'served')
    );
    onSelectTable(table, activeOrder);
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

  // ================= CHAIRS RENDERER =================
  const renderChairs = (table: RestaurantTable, isOccupied: boolean, isBilling: boolean) => {
    const shape = table.shape || 'square';
    const seats = Math.max(1, table.seats || 2);
    const w = Math.max(50, table.w || 80);
    const h = Math.max(45, table.h || 80);

    const chairBg = isBilling
      ? 'bg-amber-300 border-amber-600 shadow-amber-200'
      : isOccupied
      ? 'bg-orange-300 border-orange-600 shadow-orange-200'
      : 'bg-[#E5E7EB] border-[#9CA3AF] hover:bg-[#D1D5DB]';

    // 1. Round Table: Radial chairs around circle perimeter
    if (shape === 'round') {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const distance = radius + 9;
      const chairSize = Math.max(11, Math.min(18, (2 * Math.PI * radius) / (seats * 1.5)));

      return (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: seats }).map((_, i) => {
            const angle = (2 * Math.PI * i) / seats - Math.PI / 2;
            const x = cx + distance * Math.cos(angle);
            const y = cy + distance * Math.sin(angle);
            const rotDeg = (angle * 180) / Math.PI + 90;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${chairSize * 1.3}px`,
                  height: `${chairSize * 0.7}px`,
                  transform: `translate(-50%, -50%) rotate(${rotDeg}deg)`,
                  borderRadius: '5px 5px 2px 2px',
                }}
                className={`border transition-all ${chairBg} shadow-2xs`}
              />
            );
          })}
        </div>
      );
    }

    // 2. Bar Counter: Round padded stools along the customer side (bottom)
    if (shape === 'bar') {
      const stoolSize = Math.max(13, Math.min(20, w / (seats * 1.5)));
      const spacing = w / (seats + 1);

      return (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: seats }).map((_, i) => {
            const x = spacing * (i + 1);
            const y = h + 8;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${stoolSize}px`,
                  height: `${stoolSize}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`rounded-full border-2 transition-all ${chairBg} shadow-xs flex items-center justify-center`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
              </div>
            );
          })}
        </div>
      );
    }

    // 3. Sofa Booth: Padded upholstered bench cushions on top & bottom with stitch ribs
    if (shape === 'booth') {
      const benchHeight = Math.max(10, Math.min(16, h * 0.2));
      return (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bench */}
          <div
            style={{
              position: 'absolute',
              top: `-${benchHeight + 3}px`,
              left: '2px',
              right: '2px',
              height: `${benchHeight}px`,
            }}
            className={`rounded-t-lg border-2 ${chairBg} shadow-xs flex items-center justify-around px-1`}
          >
            {Array.from({ length: Math.ceil(seats / 2) }).map((_, i) => (
              <div key={i} className="h-full w-px bg-black/20" />
            ))}
          </div>
          {/* Bottom bench */}
          <div
            style={{
              position: 'absolute',
              bottom: `-${benchHeight + 3}px`,
              left: '2px',
              right: '2px',
              height: `${benchHeight}px`,
            }}
            className={`rounded-b-lg border-2 ${chairBg} shadow-xs flex items-center justify-around px-1`}
          >
            {Array.from({ length: Math.floor(seats / 2) }).map((_, i) => (
              <div key={i} className="h-full w-px bg-black/20" />
            ))}
          </div>
        </div>
      );
    }

    // 4. Square & Rectangular: Chairs distributed symmetrically around edges
    const isSquare = shape === 'square' || Math.abs(w - h) < 15;
    const chairW = Math.max(12, Math.min(22, w * 0.24));
    const chairH = 7;

    let topCount = 0;
    let bottomCount = 0;
    let leftCount = 0;
    let rightCount = 0;

    if (seats === 1) {
      topCount = 1;
    } else if (seats === 2) {
      if (w >= h) {
        topCount = 1;
        bottomCount = 1;
      } else {
        leftCount = 1;
        rightCount = 1;
      }
    } else if (seats === 3) {
      topCount = 1;
      bottomCount = 1;
      leftCount = 1;
    } else if (seats === 4) {
      if (isSquare) {
        topCount = 1;
        bottomCount = 1;
        leftCount = 1;
        rightCount = 1;
      } else if (w >= h) {
        topCount = 2;
        bottomCount = 2;
      } else {
        leftCount = 2;
        rightCount = 2;
      }
    } else {
      if (w >= h) {
        if (seats >= 6) {
          leftCount = 1;
          rightCount = 1;
          topCount = Math.ceil((seats - 2) / 2);
          bottomCount = Math.floor((seats - 2) / 2);
        } else {
          topCount = Math.ceil(seats / 2);
          bottomCount = Math.floor(seats / 2);
        }
      } else {
        if (seats >= 6) {
          topCount = 1;
          bottomCount = 1;
          leftCount = Math.ceil((seats - 2) / 2);
          rightCount = Math.floor((seats - 2) / 2);
        } else {
          leftCount = Math.ceil(seats / 2);
          rightCount = Math.floor(seats / 2);
        }
      }
    }

    return (
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Edge */}
        {Array.from({ length: topCount }).map((_, i) => {
          const spacing = w / (topCount + 1);
          const x = spacing * (i + 1);
          return (
            <div
              key={`top-${i}`}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `-${chairH + 2}px`,
                width: `${chairW}px`,
                height: `${chairH}px`,
                transform: 'translateX(-50%)',
                borderRadius: '4px 4px 1px 1px',
              }}
              className={`border transition-all ${chairBg} shadow-2xs`}
            />
          );
        })}

        {/* Bottom Edge */}
        {Array.from({ length: bottomCount }).map((_, i) => {
          const spacing = w / (bottomCount + 1);
          const x = spacing * (i + 1);
          return (
            <div
              key={`bot-${i}`}
              style={{
                position: 'absolute',
                left: `${x}px`,
                bottom: `-${chairH + 2}px`,
                width: `${chairW}px`,
                height: `${chairH}px`,
                transform: 'translateX(-50%)',
                borderRadius: '1px 1px 4px 4px',
              }}
              className={`border transition-all ${chairBg} shadow-2xs`}
            />
          );
        })}

        {/* Left Edge */}
        {Array.from({ length: leftCount }).map((_, i) => {
          const spacing = h / (leftCount + 1);
          const y = spacing * (i + 1);
          return (
            <div
              key={`left-${i}`}
              style={{
                position: 'absolute',
                left: `-${chairH + 2}px`,
                top: `${y}px`,
                width: `${chairH}px`,
                height: `${chairW}px`,
                transform: 'translateY(-50%)',
                borderRadius: '4px 1px 1px 4px',
              }}
              className={`border transition-all ${chairBg} shadow-2xs`}
            />
          );
        })}

        {/* Right Edge */}
        {Array.from({ length: rightCount }).map((_, i) => {
          const spacing = h / (rightCount + 1);
          const y = spacing * (i + 1);
          return (
            <div
              key={`right-${i}`}
              style={{
                position: 'absolute',
                right: `-${chairH + 2}px`,
                top: `${y}px`,
                width: `${chairH}px`,
                height: `${chairW}px`,
                transform: 'translateY(-50%)',
                borderRadius: '1px 4px 4px 1px',
              }}
              className={`border transition-all ${chairBg} shadow-2xs`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3.5 animate-fade-in flex flex-col h-full select-none">
      {/* Top Banner / Controls Bar */}
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3E0] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#111827] tracking-tight">
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
                    ? '🛠️ โหมดจัดผัง: ลากย้ายตำแหน่งโต๊ะอิสระ, ดึงมุมล่างขวาเพื่อย่อ/ขยายขนาด, สลับรูปทรงเก้าอี้และโต๊ะ'
                    : '🛠️ Edit Mode: Drag freely, pull bottom-right handle to resize, switch shapes & chairs'
                  : language === 'th'
                  ? 'แตะที่โต๊ะเพื่อเปิดออเดอร์ใหม่ สั่งอาหาร หรือคิดเงิน'
                  : 'Tap any table to start order, take orders, or checkout'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-end">
          {/* Snap Grid Toggle */}
          {isEditMode && (
            <div className="flex items-center bg-[#FFF8EE] border border-[#FED7AA] rounded-xl p-0.5 text-xs font-bold text-[#374151]">
              <span className="px-2 text-[11px] text-[#9A3412] flex items-center gap-1">
                <Grid className="w-3 h-3" />
                {language === 'th' ? 'ดูดเส้น:' : 'Snap:'}
              </span>
              <button
                type="button"
                onClick={() => setGridSnap(20)}
                className={`px-2 py-1 rounded-lg transition ${
                  gridSnap === 20 ? 'bg-[#EA580C] text-white shadow-2xs' : 'hover:bg-white/80'
                }`}
              >
                20px
              </button>
              <button
                type="button"
                onClick={() => setGridSnap(10)}
                className={`px-2 py-1 rounded-lg transition ${
                  gridSnap === 10 ? 'bg-[#EA580C] text-white shadow-2xs' : 'hover:bg-white/80'
                }`}
              >
                10px
              </button>
              <button
                type="button"
                onClick={() => setGridSnap(1)}
                className={`px-2 py-1 rounded-lg transition ${
                  gridSnap === 1 ? 'bg-[#EA580C] text-white shadow-2xs' : 'hover:bg-white/80'
                }`}
                title="เคลื่อนย้ายอิสระ 1 พิกเซล"
              >
                {language === 'th' ? 'อิสระ 1px' : 'Free'}
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center bg-white border border-[#FED7AA] rounded-xl p-0.5 text-xs text-[#374151]">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 hover:bg-[#FFF8EE] rounded-lg cursor-pointer"
              title="ซูมออก"
            >
              <ZoomOut className="w-3.5 h-3.5 text-[#9A3412]" />
            </button>
            <span className="px-1.5 font-mono text-[11px] font-bold text-[#6B7280]">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 hover:bg-[#FFF8EE] rounded-lg cursor-pointer"
              title="ซูมเข้า"
            >
              <ZoomIn className="w-3.5 h-3.5 text-[#9A3412]" />
            </button>
            {zoomScale !== 1 && (
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FFEDD5] text-[#9A3412] rounded-md hover:bg-[#FDBA74]"
              >
                100%
              </button>
            )}
          </div>

          {/* Transfer / Merge Button */}
          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FED7AA] bg-[#FFF8EE] hover:bg-[#FFEDD5] text-[#9A3412] text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>{language === 'th' ? 'ย้าย/รวมโต๊ะ' : 'Move/Merge'}</span>
          </button>

          {/* Edit Mode Toggle - Prominent Button */}
          <button
            type="button"
            onClick={() => {
              const nextMode = !isEditMode;
              setIsEditMode(nextMode);
              setSelectedTableId(null);
              if (nextMode) {
                showToast({
                  title: language === 'th' ? 'เข้าสู่โหมดแก้ไขผัง' : 'Edit Mode Active',
                  message: language === 'th' ? 'คลิกลากโต๊ะเพื่อย้าย หรือดึงมุมล่างขวาเพื่อย่อ/ขยายได้ทันที' : 'Drag tables freely or pull bottom-right handle to resize',
                  type: 'info',
                });
              } else {
                showToast({
                  title: language === 'th' ? 'บันทึกผังโต๊ะแล้ว' : 'Layout Saved',
                  message: language === 'th' ? 'บันทึกตำแหน่งและขนาดโต๊ะลงฐานข้อมูลเรียบร้อย' : 'Saved to database',
                  type: 'success',
                });
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-sm cursor-pointer ${
              isEditMode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-3 ring-emerald-300'
                : 'bg-[#EA580C] hover:bg-[#C2410C] text-white ring-2 ring-orange-200'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-4 h-4" />
                <span>{language === 'th' ? '✓ เสร็จสิ้นการจัดผัง' : 'Done Editing'}</span>
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4" />
                <span>{language === 'th' ? '✏️ แก้ไขผังโต๊ะ (ย้าย/ปรับขนาด)' : 'Edit Floor Plan'}</span>
              </>
            )}
          </button>

          {/* Add Table Button */}
          <button
            type="button"
            onClick={handleOpenAddTable}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFF3E0] text-[#EA580C] border-2 border-[#EA580C] text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'th' ? '+ เพิ่มโต๊ะใหม่' : '+ New Table'}</span>
          </button>
        </div>
      </div>

      {/* EDIT MODE BANNER & QUICK TEMPLATE BAR (Visible when in Edit Mode) */}
      {isEditMode && (
        <div className="bg-[#FFF8EE] border-2 border-[#F97316] rounded-2xl p-3 shadow-xs space-y-2.5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#FED7AA] pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#9A3412]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-ping" />
              <span>
                {language === 'th'
                  ? '🛠️ โหมดแก้ไขผังเปิดอยู่: ลากย้ายโต๊ะได้อิสระ • ดึงมุมล่างขวาของโต๊ะเพื่อย่อ/ขยาย • หรือคลิกแม่แบบโต๊ะเพื่อเพิ่มลงผังทันที'
                  : '🛠️ Edit Mode Active: Drag tables freely • Pull bottom-right handle to resize • Click templates below to add'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#6B7280]">
              {language === 'th' ? 'บันทึกอัตโนมัติเมื่อปล่อยมือ' : 'Auto-saves on release'}
            </span>
          </div>

          {/* Visual Table Templates Strip */}
          <div>
            <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>{language === 'th' ? 'ตัวอย่างแบบโต๊ะและเก้าอี้ (คลิกเพื่อเพิ่มลงผังทันที):' : 'Table Templates (Click to add immediately):'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {QUICK_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#FED7AA] hover:border-[#EA580C] hover:bg-[#FFF3E0] transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#FFEDD5] flex items-center justify-center group-hover:scale-110 transition-transform mb-1">
                    {preset.icon}
                  </div>
                  <span className="text-xs font-bold text-[#111827] text-center leading-tight">
                    {preset.labelTh}
                  </span>
                  <span className="text-[10px] text-[#9A3412] font-mono mt-0.5">
                    {preset.w}×{preset.h} px
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Zone Tabs Bar + Manage Zones */}
      <div className="flex items-center justify-between gap-2 border-b border-[#FED7AA]/60 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setActiveZone('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
              activeZone === 'all'
                ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412] shadow-2xs'
                : 'bg-white border-[#FED7AA] text-[#374151] hover:bg-[#FFF8EE]'
            }`}
          >
            {language === 'th' ? 'ทุกโซน' : 'All'} ({tables.length})
          </button>

          {zones.map((z) => {
            const count = tables.filter((t) => t.zone === z.id).length;
            const isActive = activeZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setActiveZone(z.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
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

      {/* Main Floor Canvas */}
      <div
        ref={canvasRef}
        className={`relative flex-1 min-h-[540px] rounded-3xl border-2 overflow-auto bg-[#FFFDF9] transition-all p-4 shadow-inner ${
          isEditMode
            ? 'border-dashed border-[#F97316] bg-[radial-gradient(#FDBA74_1.5px,transparent_1.5px)] [background-size:20px_20px]'
            : 'border-[#FED7AA]'
        }`}
        style={{ touchAction: isEditMode ? 'none' : 'auto' }}
      >
        {/* Dynamic Zoom Container */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top left',
            minWidth: '100%',
            minHeight: '100%',
            position: 'relative',
            width: '2400px',
            height: '1600px',
          }}
        >
          {filteredTables.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-white/70 rounded-2xl m-4 border border-dashed border-[#FED7AA] max-w-md mx-auto mt-20">
              <Coffee className="w-12 h-12 text-[#EA580C] mb-2 opacity-60" />
              <p className="text-base font-bold text-[#111827]">
                {language === 'th' ? 'ยังไม่มีโต๊ะในโซนนี้' : 'No tables in this zone'}
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                กดปุ่ม "+ เพิ่มโต๊ะ" หรือเลือกแม่แบบโต๊ะเพื่อเริ่มจัดวาง
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
              const isSelected = selectedTableId === table.id;
              const isDraggingThis = draggingTableId === table.id;
              const isResizingThis = resizingTableId === table.id;

              // Elapsed time calculation
              let elapsedMinutes: number | null = null;
              if (activeOrder) {
                const diffMs = Date.now() - new Date(activeOrder.createdAt).getTime();
                elapsedMinutes = Math.floor(diffMs / 60000);
              }

              const shape = table.shape || 'square';
              const isRound = shape === 'round';
              const isBar = shape === 'bar';
              const isBooth = shape === 'booth';
              const width = Math.max(55, table.w || 80);
              const height = Math.max(45, table.h || 80);

              return (
                <div
                  key={table.id}
                  onPointerDown={(e) => handlePointerDownTable(table, e)}
                  onClick={() => handleTableClick(table)}
                  style={{
                    position: 'absolute',
                    left: `${table.x || 40}px`,
                    top: `${table.y || 40}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    zIndex: isDraggingThis || isResizingThis ? 50 : isSelected ? 40 : 10,
                  }}
                  className={`group select-none cursor-pointer transition-shadow ${
                    isDraggingThis ? 'opacity-90 shadow-2xl scale-[1.02]' : ''
                  }`}
                >
                  {/* Surrounding Chairs (Visual Silhouette) */}
                  {renderChairs(table, isOccupied, isBilling)}

                  {/* Main Tabletop Surface */}
                  <div
                    className={`relative w-full h-full flex flex-col justify-between p-2 border-2 transition-all ${
                      isRound
                        ? 'rounded-full text-center'
                        : isBar
                        ? 'rounded-xl'
                        : isBooth
                        ? 'rounded-xl'
                        : 'rounded-2xl'
                    } ${
                      isBilling
                        ? 'bg-[#FEFCE8] border-[#EAB308] text-[#854D0E] shadow-sm'
                        : isOccupied
                        ? 'bg-[#FFF8F0] border-[#EA580C] text-[#9A3412] shadow-sm'
                        : 'bg-[#FFFFFF] border-emerald-500 text-emerald-800 shadow-2xs hover:border-emerald-600 hover:shadow-md'
                    } ${
                      isEditMode
                        ? isSelected
                          ? 'ring-3 ring-[#EA580C] ring-offset-2'
                          : 'hover:ring-2 hover:ring-[#F97316]/50'
                        : 'active:scale-95'
                    }`}
                  >
                    {/* Header: Table Name & Seats Icon */}
                    <div
                      className={`flex items-center ${
                        isRound ? 'justify-center pt-0.5' : 'justify-between'
                      }`}
                    >
                      <div className="font-extrabold text-sm sm:text-base text-[#111827] leading-none tracking-tight truncate max-w-[70%]">
                        {table.name}
                      </div>
                      <div className="flex items-center gap-0.5 text-[10px] font-bold text-[#6B7280]">
                        <Users className="w-2.5 h-2.5 text-[#EA580C]" />
                        <span>{table.seats}</span>
                      </div>
                    </div>

                    {/* Middle: Order Details or Free state */}
                    <div className="my-auto text-center overflow-hidden">
                      {isOccupied && activeOrder ? (
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-[#EA580C] font-mono leading-none">
                            {formatCurrency(activeOrder.totalAmount)}
                          </div>
                          {height >= 60 && (
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-[#9A3412] truncate">
                              <Clock className="w-2.5 h-2.5 text-[#EA580C]" />
                              <span>
                                {elapsedMinutes !== null && elapsedMinutes > 0
                                  ? `${elapsedMinutes}น.`
                                  : 'เพิ่งสั่ง'}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5 text-[11px] font-bold text-emerald-700">
                          <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{language === 'th' ? 'ว่าง' : 'Free'}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Zone / Status Label */}
                    {height >= 70 && !isRound && (
                      <div className="text-[9px] font-bold uppercase tracking-wider text-center text-[#9CA3AF] truncate">
                        {table.zone}
                      </div>
                    )}

                    {/* Corner Resize Handle (Edit Mode Only) */}
                    {isEditMode && (
                      <div
                        onPointerDown={(e) => handlePointerDownResize(table, e)}
                        className="no-drag-handle absolute -bottom-2 -right-2 w-5 h-5 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md hover:scale-115 active:scale-95 z-30 transition-transform"
                        title={
                          language === 'th'
                            ? 'คลิกลากเพื่อย่อ-ขยายขนาดโต๊ะ'
                            : 'Drag to resize table'
                        }
                      >
                        <Maximize2 className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Floating Action Toolbar on Selected Table in Edit Mode */}
                  {isEditMode && isSelected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="no-drag-handle absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-xs border border-[#FED7AA] rounded-xl shadow-lg px-2 py-1 flex items-center gap-1.5 z-40 whitespace-nowrap animate-fade-in"
                    >
                      {/* Cycle Shape */}
                      <button
                        type="button"
                        onClick={(e) => handleCycleShape(table, e)}
                        className="p-1 rounded-lg hover:bg-[#FFF3E0] text-[#EA580C] transition"
                        title="เปลี่ยนรูปทรง (Square, Rect, Round, Bar, Booth)"
                      >
                        {shape === 'round' ? (
                          <Circle className="w-3.5 h-3.5" />
                        ) : shape === 'bar' ? (
                          <span className="font-mono text-xs font-bold leading-none">━━</span>
                        ) : shape === 'booth' ? (
                          <Armchair className="w-3.5 h-3.5" />
                        ) : shape === 'rect' ? (
                          <RectangleHorizontal className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Rotate 90° */}
                      <button
                        type="button"
                        onClick={(e) => handleRotateTable(table, e)}
                        className="p-1 rounded-lg hover:bg-[#FFF3E0] text-[#374151] transition"
                        title="หมุนโต๊ะ 90° (สลับแนวตั้ง-แนวนอน)"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Seats Controls */}
                      <div className="flex items-center gap-0.5 border-x border-[#FED7AA] px-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeltaSeats(table, -1, e)}
                          className="w-5 h-5 rounded-md hover:bg-neutral-100 flex items-center justify-center text-xs font-bold text-gray-700"
                          title="ลดที่นั่ง"
                        >
                          -
                        </button>
                        <span className="text-[11px] font-mono font-bold text-[#EA580C] px-1">
                          {table.seats}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeltaSeats(table, 1, e)}
                          className="w-5 h-5 rounded-md hover:bg-neutral-100 flex items-center justify-center text-xs font-bold text-gray-700"
                          title="เพิ่มที่นั่ง"
                        >
                          +
                        </button>
                      </div>

                      {/* Quick Presets Sizes */}
                      <div className="flex items-center gap-0.5">
                        {(['S', 'M', 'L'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={(e) => handleQuickPresetSize(table, sz, e)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold hover:bg-[#FFF8EE] text-[#6B7280]"
                          >
                            {sz}
                          </button>
                        ))}
                      </div>

                      {/* Duplicate Table */}
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateTable(table, e)}
                        className="p-1 rounded-lg hover:bg-[#FFF3E0] text-[#374151] transition"
                        title="คัดลอกโต๊ะนี้"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Details */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditTable(table, e)}
                        className="p-1 rounded-lg hover:bg-[#FFF3E0] text-[#EA580C] transition"
                        title="แก้ไขรายละเอียด"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTable(table.id, table.name, e)}
                        className="p-1 rounded-lg hover:bg-red-50 text-red-600 transition"
                        title="ลบโต๊ะ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Live Coordinates / Dimension Tooltip when Dragging or Resizing */}
                  {(isDraggingThis || isResizingThis) && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-white text-[10px] font-mono px-2 py-0.5 rounded-md shadow-md whitespace-nowrap pointer-events-none z-50">
                      {isResizingThis && resizeCurrentDims
                        ? `📐 ${resizeCurrentDims.w} × ${resizeCurrentDims.h} px`
                        : dragCurrentCoords
                        ? `📍 X: ${dragCurrentCoords.x}, Y: ${dragCurrentCoords.y}`
                        : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit / Add Table Modal with Live Preview */}
      {isEditTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-[#111827] text-base">
                  {editingTable
                    ? language === 'th'
                      ? 'แก้ไขข้อมูลและขนาดโต๊ะ'
                      : 'Edit Table & Dimensions'
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

            <form onSubmit={handleSaveTable} className="space-y-4">
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
                  className="w-full h-[44px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
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
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
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
                    max="24"
                    value={tableForm.seats}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, seats: Number(e.target.value) || 2 })
                    }
                    className="w-full h-[44px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-bold text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Shape Selection with 5 architectural styles */}
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5">
                  {language === 'th' ? 'รูปแบบโต๊ะและเก้าอี้ (Table & Chair Style)' : 'Table & Chair Style'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'square', label: 'จัตุรัส', icon: <Square className="w-4 h-4" /> },
                    { id: 'rect', label: 'ผืนผ้า', icon: <RectangleHorizontal className="w-4 h-4" /> },
                    { id: 'round', label: 'ทรงกลม', icon: <Circle className="w-4 h-4" /> },
                    { id: 'bar', label: 'เคาน์เตอร์', icon: <span className="font-mono font-bold text-xs">━━</span> },
                    { id: 'booth', label: 'บูธโซฟา', icon: <Armchair className="w-4 h-4" /> },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        let w = tableForm.w;
                        let h = tableForm.h;
                        if (s.id === 'bar') { w = 150; h = 50; }
                        else if (s.id === 'rect') { w = 105; h = 70; }
                        else if (s.id === 'square' || s.id === 'round') { w = 80; h = 80; }
                        else if (s.id === 'booth') { w = 105; h = 85; }
                        setTableForm({ ...tableForm, shape: s.id as TableShape, w, h });
                      }}
                      className={`h-[48px] rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                        tableForm.shape === s.id
                          ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412] shadow-2xs'
                          : 'bg-white border-[#FED7AA] text-[#6B7280] hover:bg-[#FFF8EE]'
                      }`}
                    >
                      {s.icon}
                      <span className="text-[11px] leading-none">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimension Controls (Width & Height) */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#9A3412]">
                    {language === 'th' ? 'ปรับขนาดความกว้าง & ความสูง (พิกเซล)' : 'Custom Dimensions (Width & Height in px)'}
                  </span>
                  <div className="flex gap-1">
                    {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          const shape = tableForm.shape;
                          let w = 80;
                          let h = 80;
                          if (shape === 'square') {
                            w = sz === 'S' ? 65 : sz === 'M' ? 80 : sz === 'L' ? 100 : 130;
                            h = w;
                          } else if (shape === 'rect') {
                            if (sz === 'S') { w = 85; h = 60; }
                            else if (sz === 'M') { w = 105; h = 70; }
                            else if (sz === 'L') { w = 135; h = 80; }
                            else { w = 165; h = 90; }
                          } else if (shape === 'round') {
                            w = sz === 'S' ? 65 : sz === 'M' ? 80 : sz === 'L' ? 105 : 135;
                            h = w;
                          } else if (shape === 'bar') {
                            if (sz === 'S') { w = 110; h = 45; }
                            else if (sz === 'M') { w = 150; h = 50; }
                            else if (sz === 'L') { w = 200; h = 55; }
                            else { w = 260; h = 60; }
                          } else if (shape === 'booth') {
                            if (sz === 'S') { w = 85; h = 75; }
                            else if (sz === 'M') { w = 105; h = 85; }
                            else if (sz === 'L') { w = 130; h = 95; }
                            else { w = 160; h = 110; }
                          }
                          setTableForm({ ...tableForm, w, h });
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-[#FED7AA] hover:bg-[#FFEDD5] text-[#9A3412]"
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">
                      {language === 'th' ? 'ความกว้าง (Width px)' : 'Width (px)'}
                    </label>
                    <input
                      type="number"
                      min="55"
                      max="380"
                      value={tableForm.w}
                      onChange={(e) =>
                        setTableForm({ ...tableForm, w: Number(e.target.value) || 80 })
                      }
                      className="w-full h-[40px] px-3 rounded-xl border border-[#FDBA74] bg-white text-[#111827] font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">
                      {language === 'th' ? 'ความสูง (Height px)' : 'Height (px)'}
                    </label>
                    <input
                      type="number"
                      min="45"
                      max="380"
                      value={tableForm.h}
                      onChange={(e) =>
                        setTableForm({ ...tableForm, h: Number(e.target.value) || 80 })
                      }
                      className="w-full h-[40px] px-3 rounded-xl border border-[#FDBA74] bg-white text-[#111827] font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Inside Modal */}
              <div className="flex flex-col items-center justify-center p-6 bg-[#FFFDF9] rounded-2xl border border-dashed border-[#FED7AA]">
                <div className="text-[11px] font-bold text-[#6B7280] mb-3">
                  {language === 'th' ? 'ตัวอย่างการแสดงผลบนผังจริง (Live Preview)' : 'Live Preview'}
                </div>
                <div
                  style={{
                    position: 'relative',
                    width: `${tableForm.w}px`,
                    height: `${tableForm.h}px`,
                  }}
                  className="transition-all"
                >
                  {/* Chairs */}
                  {renderChairs(
                    {
                      id: 'preview',
                      name: tableForm.name || 'T-01',
                      seats: tableForm.seats,
                      shape: tableForm.shape,
                      w: tableForm.w,
                      h: tableForm.h,
                      status: 'empty',
                      zone: tableForm.zone,
                    },
                    false,
                    false
                  )}

                  {/* Surface */}
                  <div
                    className={`w-full h-full flex flex-col items-center justify-center border-2 border-emerald-500 bg-white shadow-sm ${
                      tableForm.shape === 'round'
                        ? 'rounded-full'
                        : tableForm.shape === 'bar' || tableForm.shape === 'booth'
                        ? 'rounded-xl'
                        : 'rounded-2xl'
                    }`}
                  >
                    <span className="font-extrabold text-xs text-[#111827] leading-none">
                      {tableForm.name || 'T-01'}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      {tableForm.seats} ที่นั่ง
                    </span>
                  </div>
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
                className="px-5 py-2.5 rounded-xl bg-[#EA580C] text-white font-bold text-xs cursor-pointer"
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
