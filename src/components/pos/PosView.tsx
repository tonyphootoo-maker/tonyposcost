import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Product,
  ProductCategory,
  Order,
  OrderItem,
  RestaurantTable,
  RestaurantSettings,
  Shift,
  ProductVariant,
  ProductModifierOption,
} from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { OrderCartPanel } from './OrderCartPanel';
import { PaymentModal } from './PaymentModal';
import { SplitBillModal } from './SplitBillModal';
import { KitchenTicketModal } from '../kitchen/KitchenTicketModal';
import { QuickEditProductModal } from './QuickEditProductModal';
import { showToast } from '../common/ToastContainer';
import {
  Search,
  Plus,
  UtensilsCrossed,
  X,
  Check,
  MoreHorizontal,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  ArrowLeft,
  ShoppingBag,
  Flame,
  Soup,
  Wheat,
  IceCream,
  Coffee,
  Beer,
  Layers,
  Sparkles,
  AlertTriangle,
  Edit3,
} from 'lucide-react';

interface PosViewProps {
  settings: RestaurantSettings | null;
  activeShift: Shift | null;
  onOpenTableFloor: () => void;
  selectedTableForPos?: RestaurantTable | null;
  existingOrderForPos?: Order | null;
  onOpenNavDrawer?: () => void;
  onOpenBillsHistory?: () => void;
  pendingOrdersCount?: number;
}

export const PosView: React.FC<PosViewProps> = ({
  settings,
  activeShift,
  onOpenTableFloor,
  selectedTableForPos,
  existingOrderForPos,
  onOpenNavDrawer,
  onOpenBillsHistory,
  pendingOrdersCount = 0,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Order Sheet toggle
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Active Order State
  const [currentOrder, setCurrentOrder] = useState<Order>(() => {
    if (existingOrderForPos) return existingOrderForPos;
    return createEmptyOrder(selectedTableForPos);
  });

  // Modals
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customizingQty, setCustomizingQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [selectedModifiers, setSelectedModifiers] = useState<ProductModifierOption[]>([]);
  const [customizeNotes, setCustomizeNotes] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isKitchenTicketModalOpen, setIsKitchenTicketModalOpen] = useState(false);
  const [kitchenTicketItems, setKitchenTicketItems] = useState<OrderItem[]>([]);
  const [isKitchenReprint, setIsKitchenReprint] = useState(false);

  // Quick Edit Modal & 2-Second Long-Press
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pressingProductId, setPressingProductId] = useState<string | null>(null);
  const [pressProgress, setPressProgress] = useState<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pressProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const startCoordRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Category Manager Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [catNameTh, setCatNameTh] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catIcon, setCatIcon] = useState('UtensilsCrossed');

  function createEmptyOrder(table?: RestaurantTable | null): Order {
    const orderNum = `#TK-${Date.now().toString().slice(-4)}`;
    return {
      id: `ord_${Date.now()}`,
      orderNumber: orderNum,
      tableId: table ? table.id : undefined,
      tableName: table ? table.name : undefined,
      orderType: table ? 'dine_in' : 'dine_in',
      guestCount: table ? table.seats : 2,
      status: 'open',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      vatAmount: 0,
      serviceChargeAmount: 0,
      totalAmount: 0,
      totalCost: 0,
      grossProfit: 0,
      createdAt: new Date().toISOString(),
      shiftId: activeShift ? activeShift.id : undefined,
    };
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (existingOrderForPos) {
      setCurrentOrder(existingOrderForPos);
    } else if (selectedTableForPos) {
      setCurrentOrder(createEmptyOrder(selectedTableForPos));
    }
  }, [existingOrderForPos, selectedTableForPos]);

  const loadCatalog = async () => {
    const [pList, cList] = await Promise.all([
      dbGetAll<Product>('products'),
      dbGetAll<ProductCategory>('categories'),
    ]);
    // Sort categories by sortOrder
    const sortedCategories = [...cList].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    setProducts(pList);
    setCategories(sortedCategories);
  };

  const handleProductCardClick = (product: Product) => {
    if (!product.isAvailable) return;

    const hasOptions =
      (product.variants && product.variants.length > 0) ||
      (product.modifierGroups && product.modifierGroups.length > 0);

    if (hasOptions) {
      setCustomizingProduct(product);
      setCustomizingQty(1);
      setSelectedVariant(product.variants?.[0]);
      setSelectedModifiers([]);
      setCustomizeNotes('');
    } else {
      addItemToCart(product);
    }
  };

  const addItemToCart = (
    product: Product,
    variant?: ProductVariant,
    modifiers: ProductModifierOption[] = [],
    notes: string = '',
    quantity: number = 1
  ) => {
    const priceDeltaVariant = variant ? variant.priceDelta : 0;
    const priceDeltaModifiers = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = product.price + priceDeltaVariant + priceDeltaModifiers;
    const unitCost = product.cost + (variant?.costDelta || 0);

    const existingIndex = currentOrder.items.findIndex(
      (item) =>
        item.productId === product.id &&
        item.selectedVariant?.id === variant?.id &&
        item.notes === notes &&
        JSON.stringify(item.selectedModifiers) === JSON.stringify(modifiers)
    );

    let updatedItems = [...currentOrder.items];

    if (existingIndex > -1) {
      const existing = updatedItems[existingIndex];
      const newQty = existing.quantity + quantity;
      updatedItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        lineTotal: newQty * existing.basePrice,
      };
    } else {
      const newItem: OrderItem = {
        id: `item_${Date.now()}_${Math.random()}`,
        productId: product.id,
        productNameTh: product.nameTh,
        productNameEn: product.nameEn,
        basePrice: unitPrice,
        unitCost,
        quantity,
        selectedVariant: variant,
        selectedModifiers: modifiers,
        notes: notes.trim(),
        lineTotal: unitPrice * quantity,
        kitchenStatus: 'pending',
        kitchenStation: product.kitchenStation,
        orderedAt: new Date().toISOString(),
      };
      updatedItems.push(newItem);
    }

    recalculateOrderTotals(updatedItems);
  };

  const recalculateOrderTotals = (items: OrderItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCost = items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
    const discountedSubtotal = Math.max(0, subtotal - currentOrder.discountAmount);

    let serviceChargeAmount = 0;
    if (settings?.serviceChargeEnabled && currentOrder.orderType === 'dine_in') {
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
      items,
      subtotal,
      serviceChargeAmount,
      vatAmount,
      totalAmount: Number(totalAmount.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      grossProfit,
    };
    setCurrentOrder(updated);
  };

  const handleSendToKitchen = async (reprint = false) => {
    if (currentOrder.items.length === 0) return;

    if (reprint) {
      setKitchenTicketItems(currentOrder.items);
      setIsKitchenReprint(true);
      setIsKitchenTicketModalOpen(true);
      return;
    }

    const unsentLines = currentOrder.items.filter(
      (i) => !i.sentToKitchenAt || i.kitchenStatus === 'pending'
    );
    const now = new Date().toISOString();

    const preparingItems = currentOrder.items.map((i) => ({
      ...i,
      kitchenStatus: i.kitchenStatus === 'pending' ? ('preparing' as const) : i.kitchenStatus,
      sentToKitchenAt: i.sentToKitchenAt || now,
    }));

    const orderToSave: Order = {
      ...currentOrder,
      status: 'kitchen_preparing',
      items: preparingItems,
    };

    await dbPut('orders', orderToSave);

    if (currentOrder.tableId) {
      const tables = await dbGetAll<RestaurantTable>('tables');
      const tbl = tables.find((t) => t.id === currentOrder.tableId);
      if (tbl) {
        tbl.status = 'occupied';
        tbl.currentOrderId = orderToSave.id;
        tbl.openedAt = tbl.openedAt || now;
        await dbPut('tables', tbl);
      }
    }

    setCurrentOrder(orderToSave);
    setKitchenTicketItems(unsentLines.length > 0 ? unsentLines : preparingItems);
    setIsKitchenReprint(false);
    setIsKitchenTicketModalOpen(true);
  };

  const handleClearOrder = () => {
    if (currentOrder.items.length === 0) return;
    const ok = window.confirm(
      language === 'th' ? 'ต้องการล้างรายการทั้งหมดในออเดอร์นี้หรือไม่?' : 'Clear all items in order?'
    );
    if (!ok) return;

    setCurrentOrder(createEmptyOrder(selectedTableForPos));
  };

  const handleToggleSoldOut = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...product, isAvailable: !product.isAvailable };
    await dbPut('products', updated);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
  };

  // Clear any active 2-second hold timers and animations
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (pressProgressIntervalRef.current) {
      clearInterval(pressProgressIntervalRef.current);
      pressProgressIntervalRef.current = null;
    }
    setPressingProductId(null);
    setPressProgress(0);
  };

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, []);

  // Long-press detection (~2 seconds hold to open quick edit modal)
  const handlePointerDown = (product: Product, e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse/touch button

    clearLongPress();
    isLongPressTriggeredRef.current = false;
    startCoordRef.current = { x: e.clientX, y: e.clientY };
    setPressingProductId(product.id);
    setPressProgress(0);

    const startTime = Date.now();
    const LONG_PRESS_DURATION = 2000; // 2 seconds

    pressProgressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / LONG_PRESS_DURATION) * 100);
      setPressProgress(progress);
    }, 35);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      clearLongPress();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(60);
        } catch {
          // ignore
        }
      }
      setEditingProduct(product);
    }, LONG_PRESS_DURATION);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!longPressTimerRef.current) return;
    // Cancel if movement exceeds 12px (e.g. user is scrolling page on touch screen)
    const dist = Math.hypot(e.clientX - startCoordRef.current.x, e.clientY - startCoordRef.current.y);
    if (dist > 12) {
      clearLongPress();
    }
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  const handlePointerLeave = () => {
    clearLongPress();
  };

  const handlePointerCancel = () => {
    clearLongPress();
  };

  const handleCardClick = (product: Product, e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      // Long press was just triggered, suppress normal cart addition
      isLongPressTriggeredRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!product.isAvailable) return;
    handleProductCardClick(product);
  };

  const handleSaveEditedProduct = async (updated: Product) => {
    await dbPut('products', updated);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

    // If edited product exists in active order cart, update its details
    setCurrentOrder((prev) => {
      const hasItem = prev.items.some((item) => item.productId === updated.id);
      if (!hasItem) return prev;
      const updatedItems = prev.items.map((item) => {
        if (item.productId === updated.id) {
          const varDelta = item.selectedVariant?.priceDelta || 0;
          const modDelta = item.selectedModifiers?.reduce((acc, m) => acc + m.priceDelta, 0) || 0;
          const newUnitPrice = updated.price + varDelta + modDelta;
          return {
            ...item,
            productNameTh: updated.nameTh,
            productNameEn: updated.nameEn,
            basePrice: newUnitPrice,
            unitCost: updated.cost + (item.selectedVariant?.costDelta || 0),
            lineTotal: newUnitPrice * item.quantity,
          };
        }
        return item;
      });

      const subtotal = updatedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalCost = updatedItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
      const discountedSubtotal = Math.max(0, subtotal - prev.discountAmount);
      let serviceChargeAmount = 0;
      if (settings?.serviceChargeEnabled && prev.orderType === 'dine_in') {
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

      return {
        ...prev,
        items: updatedItems,
        subtotal,
        serviceChargeAmount,
        vatAmount,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        grossProfit: Number((totalAmount - totalCost).toFixed(2)),
      };
    });

    showToast(
      language === 'th'
        ? `บันทึกการแก้ไข "${updated.nameTh}" เรียบร้อยแล้ว`
        : `Updated "${updated.nameTh}" successfully`,
      'success'
    );
  };

  const handleDeleteProduct = async (productId: string) => {
    await dbDelete('products', productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    showToast(
      language === 'th' ? 'ลบเมนูอาหารเรียบร้อยแล้ว' : 'Menu item removed',
      'info'
    );
  };

  // Map icons for category tabs
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'UtensilsCrossed':
        return UtensilsCrossed;
      case 'Soup':
        return Soup;
      case 'Wheat':
        return Wheat;
      case 'Flame':
        return Flame;
      case 'IceCream':
        return IceCream;
      case 'Coffee':
        return Coffee;
      case 'Beer':
        return Beer;
      case 'ShoppingBag':
        return ShoppingBag;
      case 'Layers':
        return Layers;
      default:
        return UtensilsCrossed;
    }
  };

  // Extract groups inside selected category
  const groupsInSelectedCategory = useMemo(() => {
    if (selectedCategory === 'all') return [];
    const prods = products.filter((p) => p.categoryId === selectedCategory && p.groupId);
    const groupMap = new Map<string, string>();
    prods.forEach((p) => {
      if (p.groupId && p.groupName) {
        groupMap.set(p.groupId, p.groupName);
      }
    });
    return Array.from(groupMap.entries()).map(([id, name]) => ({ id, name }));
  }, [products, selectedCategory]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.nameTh.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    } else {
      if (activeGroupId) {
        list = list.filter((p) => p.groupId === activeGroupId);
      } else if (selectedCategory !== 'all') {
        list = list.filter((p) => p.categoryId === selectedCategory && !p.groupId);
      }
    }

    return list;
  }, [products, searchQuery, selectedCategory, activeGroupId]);

  // Count item occurrences in current cart
  const getItemCartQuantity = (productId: string): number => {
    return currentOrder.items
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const totalCartCount = currentOrder.items.reduce((sum, item) => sum + item.quantity, 0);

  // Category Manager Actions
  const handleOpenCategoryModal = (cat?: ProductCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCatNameTh(cat.nameTh);
      setCatNameEn(cat.nameEn);
      setCatIcon(cat.icon || 'UtensilsCrossed');
    } else {
      setEditingCategory(null);
      setCatNameTh('');
      setCatNameEn('');
      setCatIcon('UtensilsCrossed');
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameTh.trim()) return;

    if (editingCategory) {
      const updated: ProductCategory = {
        ...editingCategory,
        nameTh: catNameTh.trim(),
        nameEn: catNameEn.trim() || catNameTh.trim(),
        icon: catIcon,
      };
      await dbPut('categories', updated);
    } else {
      const newCat: ProductCategory = {
        id: `cat_${Date.now()}`,
        nameTh: catNameTh.trim(),
        nameEn: catNameEn.trim() || catNameTh.trim(),
        icon: catIcon,
        sortOrder: categories.length + 1,
      };
      await dbPut('categories', newCat);
    }

    await loadCatalog();
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = async (catId: string) => {
    const ok = window.confirm(
      language === 'th' ? 'ต้องการลบหมวดหมู่นี้หรือไม่?' : 'Delete this category?'
    );
    if (!ok) return;

    await dbDelete('categories', catId);
    if (selectedCategory === catId) setSelectedCategory('all');
    await loadCatalog();
  };

  const handleMoveCategory = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const list = [...categories];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    const updatedList = list.map((cat, idx) => ({ ...cat, sortOrder: idx + 1 }));
    for (const c of updatedList) {
      await dbPut('categories', c);
    }
    setCategories(updatedList);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-62px)] bg-[#FFF8EE] select-none overflow-hidden">
      {/* Upper Area: Left Menu Grid (~68%) + Right Order Panel (~32%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: MENU GRID (~68% width on desktop/tablet) */}
        <div className="flex-1 lg:w-[68%] flex flex-col min-w-0 bg-[#FFF8EE] border-r border-[#FED7AA]">
          {/* Top Search & Filter Bar (Large, 48px height) */}
          <div className="p-3 bg-[#FFFFFF] border-b border-[#FED7AA] flex items-center gap-3">
            {activeGroupId ? (
              <button
                type="button"
                onClick={() => {
                  setActiveGroupId(null);
                  setActiveGroupName(null);
                }}
                className="h-[48px] px-4 rounded-xl bg-[#FFEDD5] text-[#9A3412] font-bold text-sm flex items-center gap-1.5 hover:bg-[#FDBA74] transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'th' ? '‹ กลับหมวดหลัก' : '‹ Back'}</span>
              </button>
            ) : null}

            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeGroupName
                    ? `${language === 'th' ? 'ค้นหาในกลุ่ม' : 'Search in'} ${activeGroupName}...`
                    : language === 'th'
                    ? 'ค้นหาชื่อเมนู, วัตถุดิบ, หรือแท็ก...'
                    : 'Search dishes, ingredients, or tags...'
                }
                className="w-full h-[48px] pl-10 pr-10 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-[#111827] text-base placeholder-[#6B7280] focus:ring-2 focus:ring-[#F97316] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111827]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Active Table Quick Indicator */}
            {currentOrder.tableName && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 h-[48px] rounded-xl bg-[#FFEDD5] border border-[#FDBA74] text-[#9A3412] font-bold text-sm shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]"></span>
                <span>{currentOrder.tableName}</span>
              </div>
            )}

            {/* Tip Badge: Hold card 2s to edit menu */}
            <div className="hidden md:flex items-center gap-1.5 px-3 h-[48px] rounded-xl bg-[#FFF8EE] border border-[#FED7AA] text-[#9A3412] text-xs font-semibold shrink-0 shadow-2xs">
              <Edit3 className="w-4 h-4 text-[#EA580C]" />
              <span>{language === 'th' ? 'กดค้างที่การ์ด 2 วิ เพื่อแก้ไขเมนู' : 'Hold card 2s to edit'}</span>
            </div>
          </div>

          {/* Section 7.10: Selling while no shift is open is allowed but shows a soft warning banner */}
          {!activeShift && (
            <div className="bg-[#FEF3C7] border-b border-[#FCD34D] px-4 py-2 flex items-center justify-between text-xs text-[#92400E]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
                <span>
                  <strong>{language === 'th' ? 'ยังไม่ได้เปิดกะการขาย' : 'No shift open'}:</strong>{' '}
                  {language === 'th'
                    ? 'สามารถขายได้ตามปกติ แต่รายการนี้จะไม่ถูกผูกกับกะเงินสด (แนะนำให้เปิดกะก่อนเริ่มขาย)'
                    : 'You can sell, but orders will not be linked to a cash drawer shift.'}
                </span>
              </div>
            </div>
          )}

          {/* Sub-grid Banner if inside a group */}
          {activeGroupName && (
            <div className="bg-[#FFF3E0] px-4 py-2 border-b border-[#FED7AA] flex items-center justify-between">
              <span className="font-bold text-sm text-[#9A3412] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#F97316]" />
                {activeGroupName}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveGroupId(null);
                  setActiveGroupName(null);
                }}
                className="text-xs text-[#EA580C] hover:underline font-bold"
              >
                {language === 'th' ? 'ดูเมนูทั้งหมดในหมวดนี้' : 'View all items'}
              </button>
            </div>
          )}

          {/* Menu Tiles Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Group Tiles (e.g. "ชุดเซ็ตสุดคุ้ม >") if any in this category and not yet inside a group */}
            {!activeGroupId && !searchQuery && groupsInSelectedCategory.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                  {language === 'th' ? 'กลุ่มเมนูพิเศษ / เซ็ต' : 'Special Groups & Sets'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {groupsInSelectedCategory.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => {
                        setActiveGroupId(grp.id);
                        setActiveGroupName(grp.name);
                      }}
                      className="p-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF3E0] hover:bg-[#FFEDD5] active:bg-[#FED7AA] text-left transition-all flex items-center justify-between group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="text-[17px] font-bold text-[#111827] truncate">
                          {grp.name}
                        </span>
                      </div>
                      <span className="text-lg font-black text-[#EA580C] group-hover:translate-x-1 transition-transform">
                        &gt;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Standard Product Tiles: 5 cols (>=1024px), 4 cols (>=768px), 3 cols (large phone), 2 cols (small phone). Gap 12px */}
            {filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FFF3E0] rounded-2xl border border-dashed border-[#FED7AA]">
                <UtensilsCrossed className="w-12 h-12 text-[#F97316] mb-2 opacity-50" />
                <p className="text-[18px] font-bold text-[#111827]">
                  {language === 'th' ? 'ไม่พบรายการอาหาร' : 'No menu items found'}
                </p>
                <p className="text-[14px] text-[#6B7280] mt-1">
                  {language === 'th'
                    ? 'ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น'
                    : 'Try another search term or category'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const inCartQty = getItemCartQuantity(product.id);
                  const isSoldOut = !product.isAvailable;
                  const firstWord = (language === 'th' ? product.nameTh : product.nameEn)
                    .slice(0, 3)
                    .toUpperCase();

                  const isHolding = pressingProductId === product.id;

                  return (
                    <div
                      key={product.id}
                      onPointerDown={(e) => handlePointerDown(product, e)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerLeave}
                      onPointerCancel={handlePointerCancel}
                      onPointerMove={handlePointerMove}
                      onClick={(e) => handleCardClick(product, e)}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
                      className={`group relative bg-[#FFFFFF] rounded-xl border border-[#FDBA74] overflow-hidden flex flex-col transition-all cursor-pointer shadow-xs select-none ${
                        isHolding ? 'ring-4 ring-[#EA580C] scale-[0.98] z-20' : ''
                      } ${
                        isSoldOut ? 'opacity-70 cursor-not-allowed' : 'hover:border-[#EA580C] hover:shadow-sm active:bg-[#FFEDD5]'
                      }`}
                    >
                      {/* Visual Countdown Overlay for 2-Second Hold */}
                      {isHolding && (
                        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-white pointer-events-none transition-all">
                          <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 36 36">
                              <path
                                className="text-white/20"
                                strokeWidth="3.5"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                              <path
                                className="text-[#F97316]"
                                strokeWidth="3.5"
                                strokeDasharray={`${pressProgress}, 100`}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            </svg>
                            <Edit2 className="w-5 h-5 text-[#FED7AA] absolute" />
                          </div>
                          <span className="text-[12px] font-bold mt-2 text-center text-white drop-shadow-md">
                            {language === 'th' ? 'กดค้าง 2 วิ เพื่อแก้ไข' : 'Hold 2s to edit'}
                          </span>
                          <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden mt-1.5 max-w-[100px]">
                            <div
                              className="bg-[#EA580C] h-full transition-all duration-75"
                              style={{ width: `${pressProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Top Photo Section (~65% height, 4:3 aspect ratio) */}
                      <div className="relative aspect-4/3 w-full bg-[#FEF9C3] overflow-hidden flex items-center justify-center">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.nameTh}
                            className={`w-full h-full object-cover transition-transform duration-200 ${
                              isSoldOut ? 'grayscale' : 'group-hover:scale-105'
                            }`}
                          />
                        ) : (
                          /* Warm Placeholder Tile with large bold colored letters */
                          <div className="w-full h-full bg-[#FFEDD5] flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-2xl font-black text-[#EA580C] tracking-wider">
                              {firstWord}
                            </span>
                            <span className="text-[11px] font-semibold text-[#9A3412] mt-0.5 truncate max-w-full">
                              Tony's Special
                            </span>
                          </div>
                        )}

                        {/* Sold-out ("หมด") Red Ribbon */}
                        {isSoldOut && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-[#DC2626] text-white text-xs font-black px-3 py-1 rounded-md shadow-md uppercase tracking-wider">
                              {language === 'th' ? 'หมด' : 'SOLD OUT'}
                            </span>
                          </div>
                        )}

                        {/* Red round quantity badge (top-right) if in current cart */}
                        {inCartQty > 0 && (
                          <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#DC2626] text-white font-black text-sm flex items-center justify-center shadow-md border-2 border-white">
                            {inCartQty}
                          </div>
                        )}

                        {/* Quick edit shortcut button (desktop hover / convenient click) */}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProduct(product);
                          }}
                          className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-white/90 hover:bg-white text-[#EA580C] shadow-xs border border-[#FED7AA] opacity-0 group-hover:opacity-100 sm:opacity-80 transition-opacity cursor-pointer z-10"
                          title={language === 'th' ? 'แก้ไขเมนู (หรือกดค้างที่การ์ด 2 วินาที)' : 'Edit menu (or hold 2s)'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Long-press / sold out toggle button */}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleToggleSoldOut(product, e)}
                          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/80 hover:bg-white text-[#374151] backdrop-blur-xs border border-neutral-300 cursor-pointer z-10"
                          title="สลับสถานะ มีของ/หมด"
                        >
                          {product.isAvailable ? (language === 'th' ? 'มีของ' : 'In stock') : (language === 'th' ? 'หมด' : 'Out')}
                        </button>
                      </div>

                      {/* Solid White Label Strip (No text over photo) */}
                      <div className="p-2.5 bg-[#FFFFFF] flex flex-col justify-between flex-1 min-h-[74px]">
                        {/* Product Name (18-20px semibold, wrap to 2 lines, never truncate with ellipsis!) */}
                        <div className="text-[18px] sm:text-[19px] font-semibold text-[#111827] leading-tight line-clamp-2">
                          {language === 'th' ? product.nameTh : product.nameEn || product.nameTh}
                        </div>

                        {/* Price in primary-dark bold (18px) */}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#FED7AA]/50">
                          <span className="text-[18px] font-bold text-[#9A3412]">
                            {formatCurrency(product.price)}
                          </span>
                          {product.variants && product.variants.length > 0 && (
                            <span className="text-[11px] font-semibold text-[#EA580C] bg-[#FFEDD5] px-1.5 py-0.5 rounded">
                              +ตัวเลือก
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ORDER PANEL (~32% width, min 340px, desktop/tablet) */}
        <div className="hidden lg:flex lg:w-[32%] min-w-[340px] flex-col h-full bg-[#FFFFFF]">
          <OrderCartPanel
            currentOrder={currentOrder}
            settings={settings}
            onUpdateOrder={setCurrentOrder}
            onSendToKitchen={() => handleSendToKitchen(false)}
            onReprintKitchen={() => handleSendToKitchen(true)}
            onOpenCheckout={() => setIsPaymentModalOpen(true)}
            onOpenSplitBill={() => setIsSplitModalOpen(true)}
            onClearOrder={handleClearOrder}
            onChangeTable={onOpenTableFloor}
          />
        </div>
      </div>

      {/* Phone Portrait Sticky Cart Trigger Bar */}
      <div className="lg:hidden bg-[#FFFFFF] border-t-2 border-[#FED7AA] p-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white flex items-center justify-center font-bold text-sm">
            {totalCartCount}
          </div>
          <div>
            <div className="text-xs text-[#6B7280]">
              {language === 'th' ? `${totalCartCount} รายการ` : `${totalCartCount} items`}
            </div>
            <div className="text-lg font-extrabold text-[#111827]">
              {formatCurrency(currentOrder.totalAmount)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="h-[44px] px-4 rounded-xl bg-[#EA580C] text-white text-sm font-bold flex items-center gap-1.5 shadow-sm"
        >
          <span>{language === 'th' ? 'ดูออเดอร์' : 'View Order'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Phone Portrait Bottom Sheet for Order Panel */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#FFFFFF] rounded-t-3xl max-h-[85vh] h-[80vh] flex flex-col shadow-2xl border-t border-[#FED7AA] overflow-hidden">
            <div className="p-3 border-b border-[#FED7AA] flex items-center justify-between bg-[#FFF8EE]">
              <span className="font-extrabold text-base text-[#111827]">
                {language === 'th' ? 'รายการออเดอร์ปัจจุบัน' : 'Current Order'}
              </span>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-neutral-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <OrderCartPanel
                currentOrder={currentOrder}
                settings={settings}
                onUpdateOrder={setCurrentOrder}
                onSendToKitchen={() => {
                  handleSendToKitchen(false);
                  setIsMobileCartOpen(false);
                }}
                onReprintKitchen={() => {
                  handleSendToKitchen(true);
                  setIsMobileCartOpen(false);
                }}
                onOpenCheckout={() => {
                  setIsPaymentModalOpen(true);
                  setIsMobileCartOpen(false);
                }}
                onOpenSplitBill={() => {
                  setIsSplitModalOpen(true);
                  setIsMobileCartOpen(false);
                }}
                onClearOrder={handleClearOrder}
                onChangeTable={() => {
                  onOpenTableFloor();
                  setIsMobileCartOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM CATEGORY TAB BAR (Full width, white, 4px-thick top border, 76-84px tall) */}
      <div className="h-[76px] sm:h-[84px] bg-[#FFFFFF] border-t-4 border-[#FED7AA] flex items-stretch shrink-0 z-10 shadow-md">
        {/* Left Fixed: "•••" Menu Button with online order badge */}
        <button
          type="button"
          onClick={onOpenNavDrawer}
          className="w-[76px] sm:w-[84px] flex flex-col items-center justify-center border-r border-[#FED7AA] text-[#374151] hover:bg-[#FFEDD5] active:bg-[#FED7AA] transition-colors relative cursor-pointer"
          title={language === 'th' ? 'เปิดเมนูหลัก' : 'Main Menu'}
          aria-label="Open Navigation Drawer"
        >
          <MoreHorizontal className="w-7 h-7 text-[#111827]" />
          <span className="text-[12px] font-bold text-[#111827] mt-1">เมนู</span>

          {pendingOrdersCount > 0 && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#DC2626] text-white text-[10px] font-bold min-w-[20px] text-center border-2 border-white animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* Center: Horizontally Scrollable Category Tabs */}
        <div className="flex-1 overflow-x-auto flex items-stretch no-scrollbar scroll-smooth">
          {/* Tab 1: "ทั้งหมด / All" */}
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setActiveGroupId(null);
              setActiveGroupName(null);
            }}
            className={`min-w-[104px] px-3 flex flex-col items-center justify-center transition-all cursor-pointer border-r border-[#FED7AA]/60 ${
              selectedCategory === 'all'
                ? 'bg-[#FFEDD5] border-t-4 border-t-[#F97316] text-[#9A3412] font-bold'
                : 'text-[#374151] hover:bg-[#FFF8EE]'
            }`}
          >
            <Sparkles className="w-7 h-7 mb-1" />
            <span className="text-[16px] font-bold leading-tight text-center">
              {language === 'th' ? 'ทั้งหมด' : 'All'}
            </span>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const IconComponent = getCategoryIcon(cat.icon);
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setActiveGroupId(null);
                  setActiveGroupName(null);
                }}
                className={`min-w-[104px] px-3 flex flex-col items-center justify-center transition-all cursor-pointer border-r border-[#FED7AA]/60 ${
                  isActive
                    ? 'bg-[#FFEDD5] border-t-4 border-t-[#F97316] text-[#9A3412] font-bold'
                    : 'text-[#374151] hover:bg-[#FFF8EE]'
                }`}
              >
                <IconComponent className="w-7 h-7 mb-1" />
                <span className="text-[16px] font-bold leading-tight text-center line-clamp-2">
                  {language === 'th' ? cat.nameTh : cat.nameEn || cat.nameTh}
                </span>
              </button>
            );
          })}

          {/* Plus / Pencil Button at end of tabs to edit categories */}
          <button
            type="button"
            onClick={() => handleOpenCategoryModal()}
            className="min-w-[76px] px-3 flex flex-col items-center justify-center text-[#EA580C] hover:bg-[#FFEDD5] transition-colors border-r border-[#FED7AA]/60 cursor-pointer"
            title={language === 'th' ? 'จัดการหมวดหมู่' : 'Manage Categories'}
          >
            <Plus className="w-6 h-6 mb-0.5" />
            <span className="text-[13px] font-bold">
              {language === 'th' ? '+ เพิ่มหมวด' : '+ Add'}
            </span>
          </button>
        </div>

        {/* Right Fixed: "รายการ / Bills" Button */}
        <button
          type="button"
          onClick={onOpenBillsHistory}
          className="w-[76px] sm:w-[84px] flex flex-col items-center justify-center border-l border-[#FED7AA] text-[#374151] hover:bg-[#FFEDD5] active:bg-[#FED7AA] transition-colors cursor-pointer"
          title={language === 'th' ? 'ประวัติบิล / รายการ' : 'Bills & History'}
        >
          <ReceiptText className="w-7 h-7 text-[#111827]" />
          <span className="text-[12px] font-bold text-[#111827] mt-1">
            {language === 'th' ? 'บิลขาย' : 'Bills'}
          </span>
        </button>
      </div>

      {/* Product Customizer (Variants & Modifiers Modal) */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <div>
                <h3 className="font-bold text-[19px] text-[#111827]">
                  {language === 'th' ? customizingProduct.nameTh : customizingProduct.nameEn}
                </h3>
                <span className="text-[17px] text-[#9A3412] font-bold">
                  {formatCurrency(customizingProduct.price)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Variants Selector */}
            {customizingProduct.variants && customizingProduct.variants.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-bold text-[#111827]">
                  {language === 'th' ? 'เลือกขนาด / รูปแบบ:' : 'Select Size / Variant:'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {customizingProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl border text-left text-sm font-medium transition cursor-pointer ${
                        selectedVariant?.id === v.id
                          ? 'bg-[#FFEDD5] text-[#9A3412] border-[#F97316] font-bold shadow-xs'
                          : 'bg-[#FFF8EE] border-[#FED7AA] text-[#374151]'
                      }`}
                    >
                      <div>{language === 'th' ? v.nameTh : v.nameEn || v.nameTh}</div>
                      <div className="text-xs font-bold text-[#EA580C] mt-0.5">
                        {v.priceDelta > 0 ? `+฿${v.priceDelta}` : (language === 'th' ? 'ราคาปกติ' : 'Regular')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modifier Groups Selector */}
            {customizingProduct.modifierGroups && customizingProduct.modifierGroups.length > 0 && (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {customizingProduct.modifierGroups.map((grp) => {
                  const isSatisfied = !grp.required || selectedModifiers.some((sm) => grp.options.some((opt) => opt.id === sm.id));
                  return (
                    <div key={grp.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#111827]">
                          {language === 'th' ? grp.nameTh : grp.nameEn || grp.nameTh}:
                        </span>
                        {grp.required && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isSatisfied
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-red-50 text-red-700 border-red-300'
                          }`}>
                            {language === 'th' ? (isSatisfied ? 'เลือกแล้ว' : 'จำเป็น *') : (isSatisfied ? 'Selected' : 'Required *')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {grp.options.map((opt) => {
                          const isChosen = selectedModifiers.some((m) => m.id === opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                if (grp.multiSelect) {
                                  if (isChosen) {
                                    setSelectedModifiers((prev) => prev.filter((m) => m.id !== opt.id));
                                  } else {
                                    setSelectedModifiers((prev) => [...prev, opt]);
                                  }
                                } else {
                                  setSelectedModifiers((prev) => [
                                    ...prev.filter(
                                      (m) => !grp.options.some((o) => o.id === m.id)
                                    ),
                                    opt,
                                  ]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                isChosen
                                  ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412] shadow-xs'
                                  : 'bg-[#FFF8EE] border-[#FED7AA] text-[#374151]'
                              }`}
                            >
                              <span>{language === 'th' ? opt.nameTh : opt.nameEn || opt.nameTh}</span>
                              {opt.priceDelta > 0 && (
                                <span className="font-bold text-[#EA580C]">
                                  +฿{opt.priceDelta}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Note Chips (Section 7.1) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[#374151]">
                {language === 'th' ? 'ตัวเลือกข้อความด่วน:' : 'Quick Note Chips:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'เผ็ดน้อย',
                  'ไม่ใส่ผัก',
                  'ขอซอสเพิ่ม',
                  'แยกน้ำ',
                  'ไม่ใส่ชูรส',
                  'หวานน้อย',
                  'เผ็ดมาก',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setCustomizeNotes((prev) => (prev ? `${prev}, ${chip}` : chip));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF3E0] hover:bg-[#FFE0B2] border border-[#FED7AA] text-[12px] font-semibold text-[#9A3412] active:scale-95 transition-all cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Instructions Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#374151]">
                {language === 'th' ? 'ข้อความพิเศษถึงครัว:' : 'Kitchen Note:'}
              </label>
              <input
                type="text"
                value={customizeNotes}
                onChange={(e) => setCustomizeNotes(e.target.value)}
                placeholder={language === 'th' ? 'เช่น เผ็ดน้อย, ไม่ใส่กระเทียม' : 'e.g. Less spicy, no garlic'}
                className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316] focus:outline-none"
              />
            </div>

            {/* Quantity Stepper (Section 7.1) */}
            <div className="flex items-center justify-between bg-[#FFF8EE] p-3 rounded-2xl border border-[#FED7AA]">
              <span className="text-sm font-bold text-[#111827]">
                {language === 'th' ? 'จำนวน (ที่/จาน):' : 'Quantity:'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCustomizingQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-white border border-[#FED7AA] flex items-center justify-center font-bold text-lg text-[#111827] hover:bg-[#FFEDD5] active:bg-[#FED7AA] transition cursor-pointer"
                >
                  -
                </button>
                <span className="w-8 text-center text-xl font-black text-[#111827]">
                  {customizingQty}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomizingQty((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-white border border-[#FED7AA] flex items-center justify-center font-bold text-lg text-[#111827] hover:bg-[#FFEDD5] active:bg-[#FED7AA] transition cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Missing Required Warning if any */}
            {(() => {
              const missing = (customizingProduct.modifierGroups || []).find(
                (grp) => grp.required && !selectedModifiers.some((sm) => grp.options.some((opt) => opt.id === sm.id))
              );
              if (!missing) return null;
              return (
                <div className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">
                  ⚠️ {language === 'th'
                    ? `กรุณาเลือก "${missing.nameTh}" ก่อนเพิ่มรายการ (จำเป็น)`
                    : `Please select "${missing.nameEn || missing.nameTh}" before adding (Required)`}
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-[#FED7AA]">
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="flex-1 h-[48px] rounded-xl border border-[#FED7AA] bg-[#FFFFFF] hover:bg-neutral-100 text-[#374151] font-semibold text-sm cursor-pointer"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={Boolean(
                  (customizingProduct.modifierGroups || []).some(
                    (grp) => grp.required && !selectedModifiers.some((sm) => grp.options.some((opt) => opt.id === sm.id))
                  )
                )}
                onClick={() => {
                  addItemToCart(
                    customizingProduct,
                    selectedVariant,
                    selectedModifiers,
                    customizeNotes,
                    customizingQty
                  );
                  setCustomizingProduct(null);
                }}
                className="flex-1 h-[48px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {language === 'th' ? `เพิ่มลงออเดอร์ (${customizingQty})` : `Add to Order (${customizingQty})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h3 className="font-bold text-[19px] text-[#111827]">
                {editingCategory
                  ? language === 'th'
                    ? 'แก้ไขหมวดหมู่'
                    : 'Edit Category'
                  : language === 'th'
                  ? 'เพิ่มหมวดหมู่สินค้าใหม่'
                  : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form to Add or Edit */}
            <form onSubmit={handleSaveCategory} className="space-y-3 bg-[#FFF8EE] p-3.5 rounded-2xl border border-[#FED7AA]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#374151]">
                    {language === 'th' ? 'ชื่อหมวดหมู่ (ไทย) *' : 'Name (TH) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={catNameTh}
                    onChange={(e) => setCatNameTh(e.target.value)}
                    placeholder="เช่น อาหารทานเล่น"
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151]">
                    {language === 'th' ? 'ชื่อหมวดหมู่ (อังกฤษ)' : 'Name (EN)'}
                  </label>
                  <input
                    type="text"
                    value={catNameEn}
                    onChange={(e) => setCatNameEn(e.target.value)}
                    placeholder="e.g. Appetizers"
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFFFFF] text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151]">
                  {language === 'th' ? 'เลือกไอคอน' : 'Select Icon'}
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[
                    'UtensilsCrossed',
                    'Soup',
                    'Wheat',
                    'Flame',
                    'IceCream',
                    'Coffee',
                    'Beer',
                    'ShoppingBag',
                  ].map((ic) => {
                    const Ic = getCategoryIcon(ic);
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCatIcon(ic)}
                        className={`p-2 rounded-xl border flex items-center justify-center ${
                          catIcon === ic
                            ? 'bg-[#FFEDD5] border-[#F97316] text-[#9A3412]'
                            : 'bg-white border-[#FED7AA] text-[#374151]'
                        }`}
                      >
                        <Ic className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setCatNameTh('');
                      setCatNameEn('');
                    }}
                    className="px-3 py-2 text-xs font-bold text-[#6B7280]"
                  >
                    {language === 'th' ? 'ยกเลิกแก้ไข' : 'Cancel Edit'}
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-sm"
                >
                  {editingCategory
                    ? language === 'th'
                      ? 'บันทึกการแก้ไข'
                      : 'Update Category'
                    : language === 'th'
                    ? '+ บันทึกหมวดใหม่'
                    : '+ Save Category'}
                </button>
              </div>
            </form>

            {/* List of existing categories with reorder & delete */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                {language === 'th' ? 'ลำดับหมวดหมู่ปัจจุบัน' : 'Current Categories'}
              </h4>
              <div className="space-y-1.5 divide-y divide-[#FED7AA]/60">
                {categories.map((cat, idx) => {
                  const Ic = getCategoryIcon(cat.icon);
                  return (
                    <div
                      key={cat.id}
                      className="pt-1.5 flex items-center justify-between p-2 rounded-xl hover:bg-[#FFF8EE]"
                    >
                      <div className="flex items-center gap-2">
                        <Ic className="w-5 h-5 text-[#F97316]" />
                        <span className="font-bold text-sm text-[#111827]">
                          {cat.nameTh} ({cat.nameEn})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCategory(idx, 'left')}
                          className="p-1.5 rounded-lg border border-[#FED7AA] disabled:opacity-30 hover:bg-[#FFEDD5]"
                          title="เลื่อนซ้าย"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === categories.length - 1}
                          onClick={() => handleMoveCategory(idx, 'right')}
                          className="p-1.5 rounded-lg border border-[#FED7AA] disabled:opacity-30 hover:bg-[#FFEDD5]"
                          title="เลื่อนขวา"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCategoryModal(cat)}
                          className="p-1.5 rounded-lg text-[#EA580C] hover:bg-[#FFEDD5]"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2]"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Checkout Modal */}
      {isPaymentModalOpen && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          order={currentOrder}
          settings={settings}
          activeShift={activeShift}
          onClose={() => setIsPaymentModalOpen(false)}
          onPaymentSuccess={() => {
            setIsPaymentModalOpen(false);
            setCurrentOrder(createEmptyOrder(null));
          }}
        />
      )}

      {/* Split Bill Modal */}
      {isSplitModalOpen && (
        <SplitBillModal
          isOpen={isSplitModalOpen}
          order={currentOrder}
          onClose={() => setIsSplitModalOpen(false)}
          onSplitCompleted={(splitOrders: Order[]) => {
            if (splitOrders.length > 0) {
              setCurrentOrder(splitOrders[0]);
            }
            setIsSplitModalOpen(false);
          }}
        />
      )}

      {/* Kitchen & Bar Station Ticket Modal (Section 7.3) */}
      {isKitchenTicketModalOpen && (
        <KitchenTicketModal
          isOpen={isKitchenTicketModalOpen}
          order={currentOrder}
          itemsToPrint={kitchenTicketItems}
          settings={settings}
          isReprint={isKitchenReprint}
          onClose={() => setIsKitchenTicketModalOpen(false)}
        />
      )}

      {/* Quick Edit Product Modal (Triggered by 2-second hold on food card or quick edit button) */}
      {editingProduct && (
        <QuickEditProductModal
          key={editingProduct.id}
          product={editingProduct}
          categories={categories}
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveEditedProduct}
          onDelete={handleDeleteProduct}
        />
      )}
    </div>
  );
};
