import React, { useState, useEffect } from 'react';
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
import { ProductMenuModal } from './ProductMenuModal';
import {
  Search,
  Plus,
  UtensilsCrossed,
  Filter,
  Layers,
  Settings,
  X,
  Check,
  Flame,
  LayoutGrid,
} from 'lucide-react';

interface PosViewProps {
  settings: RestaurantSettings | null;
  activeShift: Shift | null;
  onOpenTableFloor: () => void;
  selectedTableForPos?: RestaurantTable | null;
  existingOrderForPos?: Order | null;
}

export const PosView: React.FC<PosViewProps> = ({
  settings,
  activeShift,
  onOpenTableFloor,
  selectedTableForPos,
  existingOrderForPos,
}) => {
  const { t, language, formatCurrency } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Order State
  const [currentOrder, setCurrentOrder] = useState<Order>(() => {
    if (existingOrderForPos) return existingOrderForPos;
    return createEmptyOrder(selectedTableForPos);
  });

  // Modals
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [selectedModifiers, setSelectedModifiers] = useState<ProductModifierOption[]>([]);
  const [customizeNotes, setCustomizeNotes] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

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
    setProducts(pList);
    setCategories(cList);
  };

  const handleProductCardClick = (product: Product) => {
    if (!product.isAvailable) return;

    const hasOptions =
      (product.variants && product.variants.length > 0) ||
      (product.modifierGroups && product.modifierGroups.length > 0);

    if (hasOptions) {
      setCustomizingProduct(product);
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
    notes: string = ''
  ) => {
    const priceDeltaVariant = variant ? variant.priceDelta : 0;
    const priceDeltaModifiers = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = product.price + priceDeltaVariant + priceDeltaModifiers;
    const unitCost = product.cost + (variant?.costDelta || 0);

    // Check if duplicate exists with same variant & modifiers
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
      const newQty = existing.quantity + 1;
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
        quantity: 1,
        selectedVariant: variant,
        selectedModifiers: modifiers,
        notes: notes.trim(),
        lineTotal: unitPrice,
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
    // Auto save draft to DB
    dbPut('orders', updated);
  };

  const handleConfirmCustomization = () => {
    if (!customizingProduct) return;
    addItemToCart(customizingProduct, selectedVariant, selectedModifiers, customizeNotes);
    setCustomizingProduct(null);
  };

  const handleSendToKitchen = async () => {
    const updatedItems = currentOrder.items.map((i) => ({
      ...i,
      kitchenStatus: i.kitchenStatus === 'pending' ? ('cooking' as const) : i.kitchenStatus,
    }));
    const updatedOrder: Order = {
      ...currentOrder,
      items: updatedItems,
      status: 'kitchen_preparing',
    };
    setCurrentOrder(updatedOrder);
    await dbPut('orders', updatedOrder);

    // Update table status to occupied
    if (updatedOrder.tableId) {
      const table = await dbGetAll<RestaurantTable>('tables').then((list) =>
        list.find((t) => t.id === updatedOrder.tableId)
      );
      if (table) {
        await dbPut('tables', {
          ...table,
          status: 'occupied',
          currentOrderId: updatedOrder.id,
        });
      }
    }

    alert(language === 'th' ? 'ส่งออเดอร์เข้าครัวเรียบร้อย!' : 'Sent to kitchen display!');
  };

  const handleClearOrder = async () => {
    if (currentOrder.items.length === 0) return;
    const confirmed = window.confirm(
      language === 'th' ? 'ต้องการล้างรายการในบิลนี้หรือไม่?' : 'Clear all items in current ticket?'
    );
    if (!confirmed) return;

    if (currentOrder.id) {
      await dbDelete('orders', currentOrder.id);
    }
    setCurrentOrder(createEmptyOrder(selectedTableForPos));
  };

  const handlePaymentSuccess = async (paidOrder: Order) => {
    // Reset table status if dine-in
    if (paidOrder.tableId) {
      const table = await dbGetAll<RestaurantTable>('tables').then((list) =>
        list.find((t) => t.id === paidOrder.tableId)
      );
      if (table) {
        await dbPut('tables', {
          ...table,
          status: 'empty',
          currentOrderId: undefined,
        });
      }
    }

    // Prepare fresh new ticket
    setCurrentOrder(createEmptyOrder());
  };

  const handleSplitCompleted = (splitOrders: Order[]) => {
    // Put first split order into cart
    setCurrentOrder(splitOrders[0]);
    // Save both
    splitOrders.forEach((o) => dbPut('orders', o));
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.nameTh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-120px)] animate-fade-in">
      {/* Left Menu Selection Panel (7 Cols) */}
      <div className="lg:col-span-7 flex flex-col h-full space-y-3 overflow-hidden">
        {/* Search, Tables trigger, and Add item button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={language === 'th' ? 'ค้นหาอาหาร, สแกนบาร์โค้ด...' : 'Search dish, barcode...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            onClick={onOpenTableFloor}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-bold text-amber-400 transition"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>{currentOrder.tableName || t.table}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProductToEdit(null);
              setIsProductManagerOpen(true);
            }}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl transition"
            title="เพิ่มเมนูอาหาร"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Category Horizontal Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {language === 'th' ? 'ทั้งหมด' : 'All'}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {cat.nameTh}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const marginPct = product.price > 0
                ? Number((((product.price - product.cost) / product.price) * 100).toFixed(0))
                : 0;

              return (
                <div
                  key={product.id}
                  onClick={() => handleProductCardClick(product)}
                  className={`group relative p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer select-none ${
                    !product.isAvailable
                      ? 'bg-neutral-950/60 border-neutral-800/60 opacity-50 cursor-not-allowed'
                      : 'bg-neutral-900 border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 shadow-md'
                  }`}
                >
                  {/* Image or Icon Thumbnail */}
                  <div className="w-full h-24 rounded-xl bg-neutral-950 overflow-hidden mb-2 relative flex items-center justify-center">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.nameTh}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-amber-500">
                        <UtensilsCrossed className="w-5 h-5" />
                      </div>
                    )}

                    {/* Food cost margin tag */}
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-mono text-emerald-400 font-bold">
                      {marginPct}% กำไร
                    </div>

                    {!product.isAvailable && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-rose-400 text-xs font-bold">
                        สินค้าหมด
                      </div>
                    )}
                  </div>

                  {/* Title & Price */}
                  <div>
                    <div className="font-bold text-xs text-white line-clamp-1">
                      {language === 'th' ? product.nameTh : product.nameEn}
                    </div>
                    <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                      {language === 'th' ? product.nameEn : product.nameTh}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/80">
                    <span className="font-black text-sm text-amber-400 font-mono">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ทุน ฿{product.cost.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Cart & Checkout Panel (5 Cols) */}
      <div className="lg:col-span-5 h-full">
        <OrderCartPanel
          currentOrder={currentOrder}
          settings={settings}
          onUpdateOrder={setCurrentOrder}
          onSendToKitchen={handleSendToKitchen}
          onOpenCheckout={() => setIsPaymentModalOpen(true)}
          onOpenSplitBill={() => setIsSplitModalOpen(true)}
          onClearOrder={handleClearOrder}
          onChangeTable={onOpenTableFloor}
        />
      </div>

      {/* Product Customizer (Variants & Modifiers Modal) */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {language === 'th' ? customizingProduct.nameTh : customizingProduct.nameEn}
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {formatCurrency(customizingProduct.price)}
                </span>
              </div>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Variants Selector */}
            {customizingProduct.variants && customizingProduct.variants.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-white">เลือกขนาด / ตัวเลือกหลัก:</span>
                <div className="grid grid-cols-2 gap-2">
                  {customizingProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition ${
                        selectedVariant?.id === v.id
                          ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      <div>{v.nameTh}</div>
                      <div className="text-[10px] font-mono mt-0.5">
                        {v.priceDelta > 0 ? `+฿${v.priceDelta}` : 'ราคาปกติ'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modifier Groups Selector */}
            {customizingProduct.modifierGroups && customizingProduct.modifierGroups.length > 0 && (
              <div className="space-y-3">
                {customizingProduct.modifierGroups.map((grp) => (
                  <div key={grp.id} className="space-y-1.5">
                    <span className="text-xs font-bold text-white">{grp.nameTh}:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {grp.options.map((opt) => {
                        const isChosen = selectedModifiers.some((m) => m.id === opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (isChosen) {
                                setSelectedModifiers((prev) => prev.filter((m) => m.id !== opt.id));
                              } else {
                                // If max 1, remove others in this group
                                const otherGroupOptionIds = grp.options.map((o) => o.id);
                                const cleaned = selectedModifiers.filter(
                                  (m) => !otherGroupOptionIds.includes(m.id)
                                );
                                setSelectedModifiers([...cleaned, opt]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs transition ${
                              isChosen
                                ? 'bg-amber-500 text-neutral-950 font-bold'
                                : 'bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white'
                            }`}
                          >
                            {opt.nameTh} {opt.priceDelta > 0 && `(+฿${opt.priceDelta})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Special Instructions Note */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                โน้ตพิเศษสำหรับเมนูนี้:
              </label>
              <input
                type="text"
                placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผักชี, ขอน้ำจิ้มเพิ่ม"
                value={customizeNotes}
                onChange={(e) => setCustomizeNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setCustomizingProduct(null)}
                className="px-4 py-2 text-xs bg-neutral-800 text-neutral-300 rounded-xl"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomization}
                className="px-5 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                เพิ่มลงบิล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        order={currentOrder}
        settings={settings}
        activeShift={activeShift}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Split Bill Modal */}
      <SplitBillModal
        isOpen={isSplitModalOpen}
        order={currentOrder}
        onClose={() => setIsSplitModalOpen(false)}
        onSplitCompleted={handleSplitCompleted}
      />

      {/* Product / Menu Item Editor */}
      <ProductMenuModal
        isOpen={isProductManagerOpen}
        onClose={() => setIsProductManagerOpen(false)}
        productToEdit={productToEdit}
        onSaved={loadCatalog}
      />
    </div>
  );
};
