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
import { initializeDatabase, isDatabaseInitialized, dbGet, dbGetAll } from './db';
import { RestaurantSettings, Shift, RestaurantTable, Order } from './types';
import { ChefHat, Sparkles, FileText, AlertCircle, Database, Check } from 'lucide-react';

function AppContent() {
  const { t, language } = useTranslation();
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
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isInitializingData, setIsInitializingData] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    const initialized = await isDatabaseInitialized();
    if (!initialized) {
      setIsWelcomeModalOpen(true);
      setIsReady(true);
      return;
    }

    await loadSettingsAndShift();
    await updatePendingOrdersCount();
    setIsReady(true);
  };

  const handleStartChoice = async (loadSample: boolean) => {
    setIsInitializingData(true);
    await initializeDatabase(loadSample, true);
    await loadSettingsAndShift();
    await updatePendingOrdersCount();
    setIsWelcomeModalOpen(false);
    setIsInitializingData(false);
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

      {/* First Launch Welcome Dialog (Section 8.4) */}
      {isWelcomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-6 text-[#1F2937] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
                <ChefHat className="w-9 h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] tracking-tight">
                ยินดีต้อนรับสู่ Tony's Kitchen
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] max-w-md mx-auto leading-relaxed">
                ระบบจัดการร้านอาหารและคิดต้นทุน Food Cost แม่นยำระดับจานต่อจาน ทำงานบนเบราว์เซอร์เครื่องนี้ 100%
              </p>
            </div>

            {/* Choices */}
            <div className="space-y-3.5">
              <button
                type="button"
                disabled={isInitializingData}
                onClick={() => handleStartChoice(true)}
                className="w-full text-left p-4 sm:p-5 rounded-2xl border-2 border-orange-500 bg-orange-50/40 hover:bg-orange-50 transition-all shadow-xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-orange-950">
                        โหลดข้อมูลตัวอย่าง (แนะนำ) / Load Sample Data
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-900 text-[10px] font-bold">
                        ยอดนิยม
                      </span>
                    </div>
                    <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">
                      วัตถุดิบไทย 12 ชนิด, สูตรย่อย "น้ำจิ้มซีฟู้ด", 4 เมนูพร้อมตัวเลือก (ความเผ็ด, ไข่ดาว +฿10, ไซซ์), ผังโต๊ะ 8 โต๊ะใน 2 โซน, สมาชิก 3 คน, และบิลขายจริงย้อนหลัง ~30 บิลตลอด 14 วัน เพื่อดูรายงาน P&L และ Menu Engineering ได้ทันที
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={isInitializingData}
                onClick={() => handleStartChoice(false)}
                className="w-full text-left p-4 sm:p-5 rounded-2xl border border-[#FED7AA] bg-[#FFFBF5] hover:bg-orange-50/30 transition-all shadow-xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0 border border-stone-200 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm sm:text-base text-[#1F2937]">
                      เริ่มแบบว่าง / Start Empty
                    </div>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      เริ่มต้นระบบร้านค้าแบบว่างเปล่า พร้อมผังโต๊ะ 8 โต๊ะ และการตั้งค่าพื้นฐาน สำหรับร้านที่ต้องการสร้างสูตรอาหารและใส่สินค้าของตนเองตั้งแต่ต้น
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Clear Bilingual Note (Strictly required by Section 8.4) */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <div>
                  <strong>ข้อควรทราบ:</strong> ข้อมูลทั้งหมดถูกจัดเก็บไว้ในเบราว์เซอร์บนเครื่องนี้เท่านั้น (IndexedDB) ไม่มีการส่งข้อมูลขึ้นเซิร์ฟเวอร์ภายนอก หากล้างประวัติเบราว์เซอร์ (Clear Browser Data) ข้อมูลจะสูญหาย กรุณากดปุ่ม <strong>"Export ข้อมูล (JSON)"</strong> ในหน้าตั้งค่าเป็นประจำ
                </div>
                <div className="text-[11px] text-amber-900/80 pt-1 border-t border-amber-200/60">
                  <em>Note: All data is saved strictly inside this browser on this device. Clearing browser history will erase it. Please back up regularly via "Export JSON" in Settings.</em>
                </div>
              </div>
            </div>

            {isInitializingData && (
              <div className="text-center text-xs font-bold text-orange-600 animate-pulse">
                กำลังจัดเตรียมข้อมูลระบบ กรุณารอสักครู่...
              </div>
            )}
          </div>
        </div>
      )}

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
