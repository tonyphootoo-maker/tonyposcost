import React, { useState, useEffect, useRef } from 'react';
import {
  RestaurantSettings,
  PlatformConfig,
  PrinterStation,
  PaymentMethodConfig,
  Language,
} from '../../types';
import { dbGet, dbPut, exportDatabaseToJSON, importDatabaseFromJSON, initializeDatabase } from '../../db';
import { useTranslation } from '../../i18n';
import { generatePromptPayPayload } from '../../utils/promptpay';
import QRCode from 'qrcode';
import {
  X,
  Store,
  QrCode as QrIcon,
  Receipt,
  Database,
  Download,
  Upload,
  RotateCcw,
  Check,
  Percent,
  Sliders,
  AlertTriangle,
  Truck,
  Plus,
  Trash2,
  Globe,
  Printer,
  DollarSign,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';
import {
  DEFAULT_INGREDIENT_CATEGORIES,
  DEFAULT_RECIPE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

type SettingsTab =
  | 'store'
  | 'foodcost_platforms'
  | 'tax_service'
  | 'promptpay'
  | 'receipt_printers'
  | 'categories_loyalty'
  | 'backup';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const { t, language, setLanguage, useBuddhistYear, setUseBuddhistYear } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [promptPayQRDataUrl, setPromptPayQRDataUrl] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Category / Platform / Station Inputs
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformGP, setNewPlatformGP] = useState(30);
  const [newPlatformHasVat, setNewPlatformHasVat] = useState(false);

  const [newCategoryType, setNewCategoryType] = useState<'ingredient' | 'recipe' | 'expense'>('ingredient');
  const [newCategoryValue, setNewCategoryValue] = useState('');

  const [newStationName, setNewStationName] = useState('');
  const [newStationWidth, setNewStationWidth] = useState<number>(80);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const s = await dbGet<RestaurantSettings>('settings', 'current_settings');
    if (s) {
      // Ensure defaults for all Section 8.4 fields
      const filled: RestaurantSettings = {
        ...s,
        defaultTargetFoodCostPercent: s.defaultTargetFoodCostPercent ?? 30,
        defaultOverheadPercent: s.defaultOverheadPercent ?? 0,
        priceRounding: s.priceRounding ?? 1,
        platforms: s.platforms && s.platforms.length > 0
          ? s.platforms
          : [
              { id: 'grab', name: 'GrabFood', gpPercent: 30, gpHasVat: false },
              { id: 'lineman', name: 'LINE MAN', gpPercent: 30, gpHasVat: false },
              { id: 'foodpanda', name: 'Foodpanda', gpPercent: 30, gpHasVat: false },
            ],
        ingredientCategories: s.ingredientCategories && s.ingredientCategories.length > 0
          ? s.ingredientCategories
          : [...DEFAULT_INGREDIENT_CATEGORIES],
        recipeCategories: s.recipeCategories && s.recipeCategories.length > 0
          ? s.recipeCategories
          : [...DEFAULT_RECIPE_CATEGORIES],
        expenseCategories: s.expenseCategories && s.expenseCategories.length > 0
          ? s.expenseCategories
          : [...DEFAULT_EXPENSE_CATEGORIES],
        printerStations: s.printerStations && s.printerStations.length > 0
          ? s.printerStations
          : [
              { id: 'cashier', name: 'แคชเชียร์หน้าร้าน', paperWidthMm: 80 },
              { id: 'kitchen', name: 'ครัวร้อน', paperWidthMm: 80 },
              { id: 'bar', name: 'บาร์เครื่องดื่ม', paperWidthMm: 58 },
            ],
        loyalty: s.loyalty ?? {
          enabled: true,
          spendPerPoint: 25,
          bahtPerPoint: 1,
          minRedeemPoints: 10,
        },
      };

      setSettings(filled);
      generateQRPreview(filled.promptPayId);
    }
  };

  const generateQRPreview = async (promptPayId: string) => {
    if (!promptPayId) {
      setPromptPayQRDataUrl('');
      return;
    }
    try {
      const payload = generatePromptPayPayload(promptPayId, 100);
      const qrUrl = await QRCode.toDataURL(payload, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setPromptPayQRDataUrl(qrUrl);
    } catch {
      setPromptPayQRDataUrl('');
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);

    // Sync sub-objects for pure calc functions
    const toSave: RestaurantSettings = {
      ...settings,
      vat: {
        enabled: settings.vatEnabled,
        ratePercent: settings.vatRate,
        priceIncludesVat: settings.vatInclusive,
      },
      serviceCharge: {
        enabled: settings.serviceChargeEnabled,
        ratePercent: settings.serviceChargeRate,
        countAsRevenue: settings.serviceChargeCountAsRevenue ?? false,
      },
      receipt: {
        shopAddress: settings.addressTh,
        phone: settings.phone,
        taxId: settings.taxId,
        footerText: settings.receiptFooterMessage,
        paperWidthMm: settings.receiptWidth === '58mm' ? 58 : 80,
      },
    };

    await dbPut('settings', toSave);
    setIsSaving(false);
    showToast({ title: 'บันทึกการตั้งค่าแล้ว', message: 'อัปเดตข้อมูลระบบเรียบร้อย', type: 'success' });
    onSettingsUpdated();
    onClose();
  };

  const handleExport = async () => {
    try {
      const jsonStr = await exportDatabaseToJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `tonys-kitchen-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Refresh lastBackupAt locally
      const updated = { ...settings!, lastBackupAt: new Date().toISOString() };
      setSettings(updated);
      onSettingsUpdated();
      showToast({ title: 'ส่งออกสำเร็จ', message: 'ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อย', type: 'success' });
    } catch (err) {
      console.error(err);
      showToast({ title: 'ส่งออกล้มเหลว', message: 'ไม่สามารถสร้างไฟล์สำรองได้', type: 'error' });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setImportStatus(language === 'th' ? 'กำลังตรวจสอบและกู้คืนข้อมูล...' : 'Validating & restoring data...');
      const success = await importDatabaseFromJSON(content);
      if (success) {
        setImportStatus(language === 'th' ? 'กู้คืนสำเร็จ! กำลังโหลดใหม่...' : 'Restored successfully! Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setImportStatus(language === 'th' ? 'ล้มเหลว: รูปแบบไฟล์ไม่ถูกต้อง' : 'Failed: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const handleResetPresets = async () => {
    const confirmed = window.confirm(
      language === 'th'
        ? 'ต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นมาตรฐานของร้าน Tony\'s Kitchen หรือไม่?'
        : 'Reset all data back to Tony\'s Kitchen default presets?'
    );
    if (!confirmed) return;

    await initializeDatabase(true);
    window.location.reload();
  };

  // Add Delivery Platform
  const handleAddPlatform = () => {
    if (!newPlatformName.trim() || !settings) return;
    const newP: PlatformConfig = {
      id: newPlatformName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
      name: newPlatformName.trim(),
      gpPercent: Number(newPlatformGP) || 30,
      gpHasVat: newPlatformHasVat,
    };
    setSettings({
      ...settings,
      platforms: [...(settings.platforms || []), newP],
    });
    setNewPlatformName('');
    setNewPlatformGP(30);
    setNewPlatformHasVat(false);
  };

  const handleDeletePlatform = (id: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      platforms: (settings.platforms || []).filter((p) => p.id !== id),
    });
  };

  // Add Category
  const handleAddCategory = () => {
    if (!newCategoryValue.trim() || !settings) return;
    const val = newCategoryValue.trim();

    if (newCategoryType === 'ingredient') {
      const list = settings.ingredientCategories || [];
      if (!list.includes(val)) {
        setSettings({ ...settings, ingredientCategories: [...list, val] });
      }
    } else if (newCategoryType === 'recipe') {
      const list = settings.recipeCategories || [];
      if (!list.includes(val)) {
        setSettings({ ...settings, recipeCategories: [...list, val] });
      }
    } else {
      const list = settings.expenseCategories || [];
      if (!list.includes(val)) {
        setSettings({ ...settings, expenseCategories: [...list, val] });
      }
    }
    setNewCategoryValue('');
  };

  const handleDeleteCategory = (type: 'ingredient' | 'recipe' | 'expense', cat: string) => {
    if (!settings) return;
    if (type === 'ingredient') {
      setSettings({
        ...settings,
        ingredientCategories: (settings.ingredientCategories || []).filter((c) => c !== cat),
      });
    } else if (type === 'recipe') {
      setSettings({
        ...settings,
        recipeCategories: (settings.recipeCategories || []).filter((c) => c !== cat),
      });
    } else {
      setSettings({
        ...settings,
        expenseCategories: (settings.expenseCategories || []).filter((c) => c !== cat),
      });
    }
  };

  // Add Printer Station
  const handleAddPrinterStation = () => {
    if (!newStationName.trim() || !settings) return;
    const newSt: PrinterStation = {
      id: `station_${Date.now()}`,
      name: newStationName.trim(),
      paperWidthMm: newStationWidth,
    };
    setSettings({
      ...settings,
      printerStations: [...(settings.printerStations || []), newSt],
    });
    setNewStationName('');
  };

  const handleDeletePrinterStation = (id: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      printerStations: (settings.printerStations || []).filter((s) => s.id !== id),
    });
  };

  if (!isOpen || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-[#E5E7EB]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {t.settingsTitle || 'การตั้งค่าระบบ & สำรองข้อมูล'}
              </h2>
              <p className="text-xs text-neutral-400">
                ข้อมูลร้านค้า, ต้นทุนอาหาร, แพลตฟอร์ม GP, ภาษี, ใบเสร็จ และสำรองข้อมูล
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Section 8.4) */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/40 overflow-x-auto text-xs font-semibold gap-1">
          {[
            { id: 'store', label: 'ข้อมูลร้านค้า', icon: Store },
            { id: 'foodcost_platforms', label: 'ต้นทุน & เดลิเวอรี', icon: Truck },
            { id: 'tax_service', label: 'VAT & เซอร์วิสชาร์จ', icon: Percent },
            { id: 'promptpay', label: 'พร้อมเพย์ QR', icon: QrIcon },
            { id: 'receipt_printers', label: 'ใบเสร็จ & เครื่องพิมพ์', icon: Receipt },
            { id: 'categories_loyalty', label: 'หมวดหมู่ & สมาชิก', icon: Tag },
            { id: 'backup', label: 'สำรอง & กู้คืน', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-400 font-bold'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: STORE PROFILE & LANGUAGE */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    ชื่อร้านอาหาร (ภาษาไทย)
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameTh}
                    onChange={(e) => setSettings({ ...settings, restaurantNameTh: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    ชื่อร้านอาหาร (English)
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameEn}
                    onChange={(e) => setSettings({ ...settings, restaurantNameEn: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  สโลแกนร้าน / คำโปรย
                </label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    เลขประจำตัวผู้เสียภาษี (Tax ID 13 หลัก)
                  </label>
                  <input
                    type="text"
                    value={settings.taxId}
                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  ที่อยู่ร้านค้า (สำหรับหัวใบเสร็จ)
                </label>
                <textarea
                  rows={2}
                  value={settings.addressTh}
                  onChange={(e) => setSettings({ ...settings, addressTh: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">ภาษาหลักของระบบ (Language)</div>
                  <div className="text-[11px] text-neutral-400">เลือกภาษาแสดงผลของเมนูและหน้าจอ</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, language: 'th' });
                      setLanguage('th');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      settings.language === 'th'
                        ? 'bg-orange-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    ภาษาไทย
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, language: 'en' });
                      setLanguage('en');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      settings.language === 'en'
                        ? 'bg-orange-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <div>
                  <div className="text-xs font-semibold text-white">
                    {language === 'th' ? 'ปีพุทธศักราช (พ.ศ.)' : 'Buddhist Era Year (B.E.)'}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {language === 'th' ? 'แสดงปี พ.ศ. (+543) ในเอกสารและรายงานเมื่อใช้ภาษาไทย' : 'Display Buddhist year (+543) when Thai language is active'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBuddhistYear}
                    onChange={(e) => setUseBuddhistYear(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              {/* Text Size Setting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-neutral-800 gap-2">
                <div>
                  <div className="text-xs font-semibold text-white">
                    {language === 'th' ? 'ขนาดตัวอักษร (Text Size)' : 'Text Size'}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    {language === 'th'
                      ? 'ปรับขนาดฟอนต์ของทั้งระบบเพื่อความชัดเจนบนหน้าจอแท็บเล็ต'
                      : 'Scale app-wide typography for maximum tablet legibility'}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'normal', th: 'ปกติ (100%)', en: 'Normal (100%)' },
                      { id: 'large', th: 'ใหญ่ (115%)', en: 'Large (115%)' },
                      { id: 'xlarge', th: 'ใหญ่มาก (130%)', en: 'Extra Large (130%)' },
                    ] as const
                  ).map((sizeOpt) => {
                    const isSelected = (settings.textSize || 'large') === sizeOpt.id;
                    return (
                      <button
                        key={sizeOpt.id}
                        type="button"
                        onClick={() => {
                          const updated = { ...settings, textSize: sizeOpt.id };
                          setSettings(updated);
                          document.documentElement.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
                          document.documentElement.classList.add(`text-size-${sizeOpt.id}`);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                          isSelected
                            ? 'bg-orange-500 text-neutral-950 shadow-xs'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {language === 'th' ? sizeOpt.th : sizeOpt.en}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOOD COST, OVERHEAD & DELIVERY PLATFORMS */}
          {activeTab === 'foodcost_platforms' && (
            <div className="space-y-6">
              {/* Cost Defaults */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-orange-400" />
                  <span>ค่ามาตรฐานการคำนวณต้นทุนอาหาร (Food Cost Standards)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">
                      เป้าหมายต้นทุนอาหารเริ่มต้น (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.defaultTargetFoodCostPercent || 30}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultTargetFoodCostPercent: Number(e.target.value) || 30,
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-mono font-bold"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">ค่ามาตรฐานทั่วไปคือ 30%</p>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">
                      ค่าโสหุ้ยร้านเริ่มต้น (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.defaultOverheadPercent || 0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultOverheadPercent: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-mono font-bold"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">ค่าน้ำมัน แก๊ส สิ้นเปลืองแฝง</p>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">
                      การปัดเศษราคาขายที่แนะนำ
                    </label>
                    <select
                      value={settings.priceRounding || 1}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          priceRounding: Number(e.target.value) as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-mono font-bold"
                    >
                      <option value={1}>ปัดขึ้นเป็นจำนวนเต็ม 1 บาท (เช่น 89.-)</option>
                      <option value={5}>ปัดขึ้นเป็นเลข 5 บาท (เช่น 85.-, 90.-)</option>
                      <option value={10}>ปัดขึ้นเป็นเลข 10 บาท (เช่น 90.-, 100.-)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Delivery Platforms Management (Section 8.4) */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-400" />
                      <span>จัดการแพลตฟอร์มเดลิเวอรี (GP & ภาษี GP)</span>
                    </h3>
                    <p className="text-xs text-neutral-400">
                      ตั้งค่าส่วนแบ่งเปอร์เซ็นต์ GP และ VAT ของ GP เพื่อคำนวณราคาขายและงบกำไรขาดทุนอย่างถูกต้อง
                    </p>
                  </div>
                </div>

                {/* Platform Table */}
                <div className="border border-neutral-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
                      <tr>
                        <th className="py-2.5 px-3">ชื่อแพลตฟอร์ม</th>
                        <th className="py-2.5 px-3 text-right">ส่วนแบ่ง GP (%)</th>
                        <th className="py-2.5 px-3 text-center">VAT ใน GP (x1.07)</th>
                        <th className="py-2.5 px-3 text-right">GP สุทธิ</th>
                        <th className="py-2.5 px-3 text-right">ลบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono">
                      {(settings.platforms || []).map((p) => {
                        const effective = p.gpHasVat ? p.gpPercent * 1.07 : p.gpPercent;
                        return (
                          <tr key={p.id} className="hover:bg-neutral-900/40">
                            <td className="py-2 px-3 font-sans font-bold text-white">{p.name}</td>
                            <td className="py-2 px-3 text-right font-bold text-orange-400">
                              {p.gpPercent}%
                            </td>
                            <td className="py-2 px-3 text-center font-sans">
                              {p.gpHasVat ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                  มี VAT (+7%)
                                </span>
                              ) : (
                                <span className="text-neutral-500 text-[10px]">ไม่มี</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">
                              {effective.toFixed(2)}%
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeletePlatform(p.id)}
                                className="p-1 text-neutral-500 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Platform Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <input
                    type="text"
                    placeholder="ชื่อแพลตฟอร์ม เช่น ShopeeFood"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-400">GP:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newPlatformGP}
                      onChange={(e) => setNewPlatformGP(Number(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white font-mono text-center"
                    />
                    <span className="text-neutral-400">%</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlatformHasVat}
                      onChange={(e) => setNewPlatformHasVat(e.target.checked)}
                      className="accent-orange-500"
                    />
                    <span>GP มี VAT</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPlatform}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่ม</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAX & SERVICE CHARGE */}
          {activeTab === 'tax_service' && (
            <div className="space-y-5">
              {/* VAT Setting */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      ระบบภาษีมูลค่าเพิ่ม (VAT 7%)
                    </h3>
                    <p className="text-xs text-neutral-400">
                      คำนวณและแสดงภาษีในบิลขายหน้าร้านและใบเสร็จ
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.vatEnabled}
                      onChange={(e) => setSettings({ ...settings, vatEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {settings.vatEnabled && (
                  <div className="pt-3 border-t border-neutral-800 space-y-3">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          checked={settings.vatInclusive}
                          onChange={() => setSettings({ ...settings, vatInclusive: true })}
                          className="accent-orange-500"
                        />
                        <span className="text-neutral-200">
                          ราคาสินค้ารวม VAT แล้ว (VAT Inclusive - ถอดภาษีออก)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          checked={!settings.vatInclusive}
                          onChange={() => setSettings({ ...settings, vatInclusive: false })}
                          className="accent-orange-500"
                        />
                        <span className="text-neutral-200">
                          ราคาไม่รวม VAT (VAT Exclusive - บวกภาษีเพิ่มในบิล)
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 w-48 text-xs">
                      <span className="text-neutral-400">อัตราภาษี:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.vatRate}
                        onChange={(e) =>
                          setSettings({ ...settings, vatRate: Number(e.target.value) || 0 })
                        }
                        className="w-16 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-center text-white font-mono"
                      />
                      <span className="text-neutral-400">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge Setting */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      ค่าบริการ (Service Charge)
                    </h3>
                    <p className="text-xs text-neutral-400">
                      คิดค่าบริการเพิ่มสำหรับลูกค้าทานที่ร้าน (Dine-in)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.serviceChargeEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, serviceChargeEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                {settings.serviceChargeEnabled && (
                  <div className="pt-3 border-t border-neutral-800 space-y-3 text-xs">
                    <div className="flex items-center gap-2 w-48">
                      <span className="text-neutral-400">อัตราเซอร์วิสชาร์จ:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.serviceChargeRate}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceChargeRate: Number(e.target.value) || 0,
                          })
                        }
                        className="w-16 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-center text-white font-mono"
                      />
                      <span className="text-neutral-400">%</span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input
                        type="checkbox"
                        checked={settings.serviceChargeCountAsRevenue ?? false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceChargeCountAsRevenue: e.target.checked,
                          })
                        }
                        className="accent-orange-500"
                      />
                      <span>นับค่าบริการเป็นรายได้ร้านในงบกำไรขาดทุน (Count as revenue in P&L)</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROMPTPAY */}
          {activeTab === 'promptpay' && (
            <div className="space-y-4">
              <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4 text-xs text-orange-200/90 leading-relaxed">
                ระบบสร้าง QR Code พร้อมเพย์มาตรฐาน EMVCo แบบไดนามิกตามยอดของบิลอัตโนมัติ เพื่อให้ลูกค้าสแกนจ่ายผ่านแอปธนาคารไทยได้ทุกธนาคาร
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      หมายเลขพร้อมเพย์ร้าน (PromptPay ID)
                    </label>
                    <input
                      type="text"
                      placeholder="0812345678 หรือ 0105562089123"
                      value={settings.promptPayId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings({ ...settings, promptPayId: val });
                        generateQRPreview(val);
                      }}
                      className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      เบอร์มือถือ 10 หลัก หรือเลขบัตร ปชช./นิติบุคคล 13 หลัก
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      ชื่อบัญชีร้านที่แสดง
                    </label>
                    <input
                      type="text"
                      value={settings.promptPayName}
                      onChange={(e) => setSettings({ ...settings, promptPayName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* QR Code Preview */}
                <div className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="text-xs font-semibold text-neutral-400 mb-2">
                    ตัวอย่าง QR Code พร้อมเพย์
                  </div>
                  {promptPayQRDataUrl ? (
                    <div className="bg-white p-3 rounded-lg shadow-md flex flex-col items-center">
                      <img src={promptPayQRDataUrl} alt="PromptPay Preview" className="w-32 h-32" />
                      <div className="text-neutral-900 font-bold text-xs mt-1">THB 100.00 (Test)</div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-neutral-800/60 rounded-lg flex items-center justify-center text-xs text-neutral-500 text-center px-4">
                      กรุณาระบุเลขพร้อมเพย์
                    </div>
                  )}
                  <span className="text-[10px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" /> EMVCo Compliant
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RECEIPT & PRINTER STATIONS */}
          {activeTab === 'receipt_printers' && (
            <div className="space-y-6">
              {/* Paper Width & Messages */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  <span>ขนาดกระดาษ & ข้อความใบเสร็จ</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '80mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.receiptWidth === '80mm'
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">80 มม. (80mm)</div>
                      <div className="text-[11px] text-neutral-400">มาตรฐานเครื่องพิมพ์ความร้อนหน้าร้าน (Epson, Sunmi, Xprinter)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '58mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.receiptWidth === '58mm'
                        ? 'border-orange-500 bg-orange-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">58 มม. (58mm)</div>
                      <div className="text-[11px] text-neutral-400">เครื่องพิมพ์พกพาไร้สายบลูทูธ ขนาดกะทัดรัด</div>
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      ข้อความหัวใบเสร็จ
                    </label>
                    <input
                      type="text"
                      value={settings.receiptHeaderMessage}
                      onChange={(e) => setSettings({ ...settings, receiptHeaderMessage: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      ข้อความท้ายใบเสร็จ
                    </label>
                    <input
                      type="text"
                      value={settings.receiptFooterMessage}
                      onChange={(e) => setSettings({ ...settings, receiptFooterMessage: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Printer Stations (Section 8.4) */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Printer className="w-4 h-4 text-orange-400" />
                    <span>จุดพิมพ์ใบออเดอร์ (Printer Stations)</span>
                  </h3>
                </div>

                <div className="divide-y divide-neutral-800/80 border border-neutral-800 rounded-xl overflow-hidden">
                  {(settings.printerStations || []).map((station) => (
                    <div
                      key={station.id}
                      className="p-3 flex items-center justify-between text-xs bg-neutral-900/60"
                    >
                      <div className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-neutral-400" />
                        <span className="font-bold text-white">{station.name}</span>
                        <span className="text-neutral-500 font-mono">({station.paperWidthMm}mm)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePrinterStation(station.id)}
                        className="text-neutral-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="ชื่อจุดพิมพ์ เช่น ครัวของทอด"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white"
                  />
                  <select
                    value={newStationWidth}
                    onChange={(e) => setNewStationWidth(Number(e.target.value))}
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white font-mono"
                  >
                    <option value={80}>80 มม.</option>
                    <option value={58}>58 มม.</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPrinterStation}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่ม</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CATEGORIES & LOYALTY */}
          {activeTab === 'categories_loyalty' && (
            <div className="space-y-6">
              {/* Category Management */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-400" />
                  <span>จัดการหมวดหมู่ของระบบ (Categories Management)</span>
                </h3>

                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value as any)}
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white font-semibold"
                  >
                    <option value="ingredient">หมวดวัตถุดิบ (Ingredient)</option>
                    <option value="recipe">หมวดสูตร/เมนูขาย (Recipe)</option>
                    <option value="expense">หมวดรายจ่าย (Expense)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="ชื่อหมวดหมู่ใหม่"
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มหมวด</span>
                  </button>
                </div>

                {/* Display Current Categories */}
                <div className="space-y-3 pt-2 text-xs">
                  <div>
                    <div className="font-semibold text-neutral-400 mb-1.5">หมวดวัตถุดิบ:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.ingredientCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 flex items-center gap-1.5"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('ingredient', c)}
                            className="hover:text-rose-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-neutral-400 mb-1.5">หมวดสูตร/เมนู:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.recipeCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 flex items-center gap-1.5"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('recipe', c)}
                            className="hover:text-rose-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-neutral-400 mb-1.5">หมวดรายจ่าย:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.expenseCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 flex items-center gap-1.5"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('expense', c)}
                            className="hover:text-rose-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Loyalty Program Settings */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <span>ระบบสะสมแต้มสมาชิก (Loyalty Program)</span>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.loyalty?.enabled ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          loyalty: {
                            ...(settings.loyalty || {
                              spendPerPoint: 25,
                              bahtPerPoint: 1,
                              minRedeemPoints: 10,
                            }),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  <div>
                    <label className="block text-neutral-300 font-sans font-semibold mb-1">
                      ยอดซื้อต่อ 1 แต้ม (฿)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.loyalty?.spendPerPoint || 25}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          loyalty: {
                            ...(settings.loyalty || {
                              enabled: true,
                              bahtPerPoint: 1,
                              minRedeemPoints: 10,
                            }),
                            spendPerPoint: Number(e.target.value) || 25,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-sans font-semibold mb-1">
                      มูลค่าลดต่อ 1 แต้ม (฿)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={settings.loyalty?.bahtPerPoint || 1}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          loyalty: {
                            ...(settings.loyalty || {
                              enabled: true,
                              spendPerPoint: 25,
                              minRedeemPoints: 10,
                            }),
                            bahtPerPoint: Number(e.target.value) || 1,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-sans font-semibold mb-1">
                      แต้มขั้นต่ำในการแลก
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.loyalty?.minRedeemPoints || 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          loyalty: {
                            ...(settings.loyalty || {
                              enabled: true,
                              spendPerPoint: 25,
                              bahtPerPoint: 1,
                            }),
                            minRedeemPoints: Number(e.target.value) || 10,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Last Backup Notice */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>
                    สำรองข้อมูลล่าสุด:{' '}
                    <strong className="text-white font-mono">
                      {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('th-TH') : 'ยังไม่เคยสำรองข้อมูล'}
                    </strong>
                  </span>
                </div>
                {settings.lastBackupAt && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> ล่าสุด
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>ส่งออกข้อมูลสำรอง (Export JSON)</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    ดาวน์โหลดไฟล์ <strong className="text-neutral-200">tonys-kitchen-backup-YYYY-MM-DD.json</strong> ซึ่งรวมทุกตาราง:
                    สูตรอาหาร วัตถุดิบ รายการสินค้า โต๊ะ ออเดอร์ กะสมาชิก และรูปภาพทั้งหมด
                  </p>
                  <button
                    onClick={handleExport}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export ข้อมูล (JSON)</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>กู้คืนข้อมูลสำรอง (Import JSON)</span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    นำเข้าไฟล์ .json ที่สำรองไว้ เพื่อกู้คืนข้อมูลหรือย้ายข้อมูลมาเปิดใช้งานบนเครื่องใหม่
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileImport}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import ข้อมูล (JSON)</span>
                  </button>
                  {importStatus && (
                    <div className="text-xs text-orange-400 text-center font-bold mt-1">{importStatus}</div>
                  )}
                </div>
              </div>

              {/* Danger Zone: Reset presets */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>เขตระวัง (Danger Zone)</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  หากต้องการล้างข้อมูลและเริ่มต้นใหม่ สามารถโหลดชุดตัวอย่างอาหารไทยสูตรมาตรฐานของ Tony's Kitchen กลับมาได้ทันที
                </p>
                <button
                  onClick={handleResetPresets}
                  className="py-2 px-3 bg-neutral-900 hover:bg-rose-900/50 border border-rose-800/60 text-rose-300 font-bold rounded-lg text-xs flex items-center gap-2 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>โหลดข้อมูลตัวอย่างเริ่มต้นของร้านใหม่</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/70">
          <div className="text-xs text-neutral-500">
            ระบบบันทึกในเบราว์เซอร์ของคุณ (Offline IndexedDB)
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition"
            >
              {t.cancel || 'ยกเลิก'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-neutral-950 bg-orange-500 hover:bg-orange-400 rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : t.save || 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
