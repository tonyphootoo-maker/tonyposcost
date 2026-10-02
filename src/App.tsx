import React, { useState, useEffect } from 'react';
import { I18nProvider, useTranslation } from './i18n';
import { ToastContainer } from './components/common/ToastContainer';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { PosView } from './components/pos/PosView';
import { TableFloorView } from './components/pos/TableFloorView';
import { OnlineOrdersView } from './components/pos/OnlineOrdersView';
import { BillsHistoryView } from './components/pos/BillsHistoryView';
import { FoodCostDashboard } from './components/foodcost/FoodCostDashboard';
import { IngredientsManager } from './components/foodcost/IngredientsManager';
import { FoodCostView } from './components/foodcost/FoodCostView';
import { PricingSimulatorView } from './components/foodcost/PricingSimulatorView';
import { ProductsManagementView } from './components/products/ProductsManagementView';
import { MembersView } from './components/members/MembersView';
import { PromotionsView } from './components/promotions/PromotionsView';
import { ShiftsView } from './components/shifts/ShiftsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsModal } from './components/settings/SettingsModal';
import { ShiftModal } from './components/shifts/ShiftModal';
import { TableTransferModal } from './components/pos/TableTransferModal';
import { initializeDatabase, dbGet, dbGetAll } from './db';
import { RestaurantSettings, Shift, RestaurantTable, Order } from './types';
import { ChefHat } from 'lucide-react';

function AppContent() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<NavTab>('sell');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  // Cross-view state: Table selected from Floor plan to open in POS
  const [selectedTableForPos, setSelectedTableForPos] = useState<RestaurantTable | null>(null);
  const [existingOrderForPos, setExistingOrderForPos] = useState<Order | null>(null);

  // Cross-view state: Recipe clicked from Dashboard to open in Pricing Simulator
  const [selectedRecipeIdForPricing, setSelectedRecipeIdForPricing] = useState<string | null>(null);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    // 1. Initialize IndexedDB database if first load
    await initializeDatabase(false);

    // 2. Load settings and active shift
    await loadSettingsAndShift();
    await updatePendingOrdersCount();

    setIsReady(true);
  };

  const loadSettingsAndShift = async () => {
    const s = await dbGet<RestaurantSettings>('settings', 'current_settings');
    if (s) setSettings(s);

    const shifts = await dbGetAll<Shift>('shifts');
    const open = shifts.find((sh) => sh.status === 'open');
    setActiveShift(open || null);
  };

  // Text size scaling on <html>
  useEffect(() => {
    const size = settings?.textSize || 'large';
    document.documentElement.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
    document.documentElement.classList.add(`text-size-${size}`);
  }, [settings?.textSize]);

  const updatePendingOrdersCount = async () => {
    try {
      const orders = await dbGetAll<Order>('orders');
      const pending = orders.filter(
        (o) =>
          o.orderType === 'delivery' &&
          (o.status === 'open' || o.status === 'kitchen_preparing')
      );
      setPendingOrdersCount(pending.length);
    } catch {
      // ignore
    }
  };

  const handleSelectTableFromFloor = (table: RestaurantTable, existingOrder?: Order) => {
    setSelectedTableForPos(table);
    setExistingOrderForPos(existingOrder || null);
    setActiveTab('sell');
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#FFFBF5] flex flex-col items-center justify-center text-[#1F2937]">
        <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg animate-bounce">
          <ChefHat className="w-8 h-8" />
        </div>
        <p className="mt-4 text-sm font-bold tracking-wider text-orange-600">
          กำลังเตรียมระบบ Tony's Kitchen...
        </p>
        <p className="mt-1 text-xs text-[#6B7280]">
          ระบบออฟไลน์ 100% พร้อมฐานข้อมูลในเครื่องของคุณ
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8EE] text-[#111827] flex flex-row">
      {/* Persistent Left Sidebar on Desktop / Slide-out on Mobile (Hidden on Sell screen) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        pendingOrdersCount={pendingOrdersCount}
        hideDesktopSidebar={activeTab === 'sell'}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header Navigation */}
        <Header
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          activeShift={activeShift}
          onOpenShiftModal={() => setIsShiftModalOpen(true)}
          onNavigateTab={handleTabChange}
          pendingOrdersCount={pendingOrdersCount}
          settings={settings}
        />

        {/* Dynamic Main View Area (Full screen on Sell view) */}
        <main className={`flex-1 w-full ${activeTab === 'sell' ? 'p-0 overflow-hidden' : 'p-4 md:p-6 max-w-7xl mx-auto'}`}>
          {/* Sell / ขาย Group */}
          {activeTab === 'sell' && (
            <PosView
              settings={settings}
              activeShift={activeShift}
              onOpenTableFloor={() => setActiveTab('tables')}
              selectedTableForPos={selectedTableForPos}
              existingOrderForPos={existingOrderForPos}
              onOpenNavDrawer={() => setIsMobileMenuOpen(true)}
              onOpenBillsHistory={() => setActiveTab('bills')}
              pendingOrdersCount={pendingOrdersCount}
            />
          )}

          {activeTab === 'tables' && (
            <TableFloorView
              onSelectTable={handleSelectTableFromFloor}
              onOpenTransferModal={() => setIsTransferModalOpen(true)}
            />
          )}

          {activeTab === 'online_orders' && (
            <OnlineOrdersView onOrderUpdated={updatePendingOrdersCount} />
          )}

          {activeTab === 'bills' && <BillsHistoryView />}

          {/* Food Cost / ต้นทุน Group */}
          {activeTab === 'fc_dashboard' && (
            <FoodCostDashboard
              onNavigateTab={handleTabChange}
              onNavigateToPricing={(recipeId) => {
                setSelectedRecipeIdForPricing(recipeId);
                setActiveTab('fc_pricing');
              }}
            />
          )}

          {activeTab === 'fc_ingredients' && <IngredientsManager />}

          {activeTab === 'fc_recipes' && <FoodCostView />}

          {activeTab === 'fc_pricing' && (
            <PricingSimulatorView
              initialRecipeId={selectedRecipeIdForPricing}
              onClearInitialRecipeId={() => setSelectedRecipeIdForPricing(null)}
            />
          )}

          {/* Manage / จัดการ Group */}
          {activeTab === 'products' && <ProductsManagementView />}

          {activeTab === 'members' && <MembersView />}

          {activeTab === 'promotions' && <PromotionsView />}

          {activeTab === 'shifts' && (
            <ShiftsView
              activeShift={activeShift}
              onOpenShiftModal={() => setIsShiftModalOpen(true)}
            />
          )}

          {activeTab === 'expenses' && <ExpensesView />}

          {activeTab === 'reports' && <ReportsView />}
        </main>
      </div>

      {/* Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={loadSettingsAndShift}
      />

      {/* Shift Drawer / Modal */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        activeShift={activeShift}
        onShiftChange={loadSettingsAndShift}
      />

      {/* Table Transfer / Merge Modal */}
      <TableTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onCompleted={loadSettingsAndShift}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
