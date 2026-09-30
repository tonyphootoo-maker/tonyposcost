import React from 'react';
import {
  ChefHat,
  Menu,
  Bell,
  Clock,
  Globe
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Shift, RestaurantSettings } from '../../types';
import { NavTab } from './Sidebar';

export type ActiveTab = NavTab;

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
  activeShift: Shift | null;
  onOpenShiftModal: () => void;
  onNavigateTab?: (tab: NavTab) => void;
  activeTab?: NavTab;
  setActiveTab?: (tab: NavTab) => void;
  onOpenSettingsModal?: () => void;
  pendingOrdersCount?: number;
  settings?: RestaurantSettings | null;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  activeShift,
  onOpenShiftModal,
  onNavigateTab,
  activeTab,
  setActiveTab,
  onOpenSettingsModal,
  pendingOrdersCount = 0,
}) => {
  const { language, setLanguage, t } = useTranslation();

  const handleNavigate = (tab: NavTab) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#FED7AA] px-4 py-2.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Menu Toggle + Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[#1F2937] hover:bg-orange-50 hover:text-orange-600 border border-[#FED7AA] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => handleNavigate('sell')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs group-hover:bg-orange-600 transition-colors">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-[#1F2937] tracking-tight group-hover:text-orange-600 transition-colors">
              Tony's Kitchen
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-orange-100 text-orange-700">
              POS & Food Cost
            </span>
          </div>
        </div>
      </div>

      {/* Right: Shift Status, Online Orders Bell, Language Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Shift Status Indicator */}
        <button
          onClick={onOpenShiftModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold min-h-[44px] transition-all cursor-pointer ${
            activeShift
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
          }`}
          title={t.openShiftPrompt || 'จัดการกะ'}
        >
          <span className="relative flex h-2.5 w-2.5">
            {activeShift && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                activeShift ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <Clock className="w-3.5 h-3.5 hidden sm:inline" />
          <span className="truncate max-w-[120px] sm:max-w-none">
            {activeShift ? t.shiftOpen || 'เปิดกะขายอยู่' : t.shiftClosed || 'ยังไม่เปิดกะ'}
          </span>
        </button>

        {/* Online Orders Notification Bell */}
        <button
          onClick={() => handleNavigate('online_orders')}
          className="relative p-2.5 rounded-xl border border-[#FED7AA] text-[#1F2937] hover:bg-orange-50 hover:text-orange-600 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          title={t.onlineOrdersBell || 'ออเดอร์ออนไลน์'}
          aria-label={t.onlineOrdersBell || 'ออเดอร์ออนไลน์'}
        >
          <Bell className="w-5 h-5" />
          {pendingOrdersCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-red-600 text-white min-w-[18px] text-center border-2 border-white animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* Bilingual TH | EN Toggle (Always Visible) */}
        <div className="flex items-center bg-[#FFFBF5] p-1 rounded-xl border border-[#FED7AA]">
          <button
            onClick={() => setLanguage('th')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
              language === 'th'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            TH
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
              language === 'en'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
};
