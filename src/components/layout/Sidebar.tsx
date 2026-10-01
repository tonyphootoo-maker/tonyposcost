import React from 'react';
import {
  Store,
  Grid,
  BellRing,
  ReceiptText,
  PieChart,
  Package,
  BookOpen,
  DollarSign,
  Utensils,
  Users,
  Tag,
  Clock,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  X,
  ChefHat
} from 'lucide-react';
import { useTranslation } from '../../i18n';

export type NavTab =
  | 'sell'
  | 'tables'
  | 'online_orders'
  | 'bills'
  | 'fc_dashboard'
  | 'fc_ingredients'
  | 'fc_recipes'
  | 'fc_pricing'
  | 'products'
  | 'members'
  | 'promotions'
  | 'shifts'
  | 'expenses'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingOrdersCount?: number;
  hideDesktopSidebar?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  pendingOrdersCount = 0,
  hideDesktopSidebar = false,
}) => {
  const { t } = useTranslation();

  const handleTabClick = (tab: NavTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const navGroups = [
    {
      title: t.navGroupSell || 'ขาย / Sell',
      items: [
        { id: 'sell' as NavTab, label: t.navSell || 'หน้าขาย', icon: Store },
        { id: 'tables' as NavTab, label: t.navTables || 'ผังโต๊ะ', icon: Grid },
        {
          id: 'online_orders' as NavTab,
          label: t.navOnlineOrders || 'ออเดอร์ออนไลน์',
          icon: BellRing,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
        },
        { id: 'bills' as NavTab, label: t.navBills || 'บิล/ประวัติ', icon: ReceiptText },
      ],
    },
    {
      title: t.navGroupFoodCost || 'ต้นทุน / Food Cost',
      items: [
        { id: 'fc_dashboard' as NavTab, label: t.navFcDashboard || 'ภาพรวม', icon: PieChart },
        { id: 'fc_ingredients' as NavTab, label: t.navFcIngredients || 'วัตถุดิบ', icon: Package },
        { id: 'fc_recipes' as NavTab, label: t.navFcRecipes || 'สูตร/เมนู', icon: BookOpen },
        { id: 'fc_pricing' as NavTab, label: t.navFcPricing || 'ตั้งราคา', icon: DollarSign },
      ],
    },
    {
      title: t.navGroupManage || 'จัดการ / Manage',
      items: [
        { id: 'products' as NavTab, label: t.navProducts || 'สินค้า POS', icon: Utensils },
        { id: 'members' as NavTab, label: t.navMembers || 'สมาชิก', icon: Users },
        { id: 'promotions' as NavTab, label: t.navPromotions || 'โปรโมชัน', icon: Tag },
        { id: 'shifts' as NavTab, label: t.navShifts || 'กะ', icon: Clock },
        { id: 'expenses' as NavTab, label: t.navExpenses || 'รายจ่าย', icon: Wallet },
        { id: 'reports' as NavTab, label: t.navReports || 'รายงาน', icon: BarChart3 },
        { id: 'settings' as NavTab, label: t.navSettings || 'ตั้งค่า', icon: SettingsIcon },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#FED7AA]">
      {/* Brand Header inside Sidebar */}
      <div className="p-4 border-b border-[#FED7AA] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-600 shadow-xs">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-base text-[#1F2937] leading-tight">Tony's Kitchen</div>
            <div className="text-[11px] text-[#6B7280]">POS & Food Cost Suite</div>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <div className="px-3 py-1 text-xs font-bold tracking-wider uppercase text-neutral-400">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                      isActive
                        ? 'bg-orange-50 text-orange-600 border border-orange-200 font-semibold shadow-xs'
                        : 'text-[#1F2937] hover:bg-orange-50/60 hover:text-orange-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : 'text-neutral-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#FED7AA] bg-[#FFFBF5]/60 text-[11px] text-[#6B7280] text-center">
        <span>Offline-First • Local IndexedDB</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (hidden on Sell screen) */}
      {!hideDesktopSidebar && (
        <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
          {sidebarContent}
        </aside>
      )}

      {/* Navigation Drawer Backdrop & Slide-out */}
      {isOpenMobile && (
        <div className={`fixed inset-0 z-50 flex ${!hideDesktopSidebar ? 'lg:hidden' : ''}`}>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 bg-white">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
