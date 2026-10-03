import React, { useState, useEffect, useRef } from 'react';
import {
  RestaurantSettings,
  PlatformConfig,
  PrinterStation,
  PaymentMethodConfig,
  Language,
  Order,
} from '../../types';
import {
  dbGet,
  dbPut,
  dbGetAll,
  dbClear,
  exportDatabaseToJSON,
  importDatabaseFromJSON,
  initializeDatabase,
} from '../../db';
import { useTranslation } from '../../i18n';
import { generatePromptPayPayload } from '../../utils/promptpay';
import { exportToCSV } from '../../utils/csv';
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
  Edit2,
  FileSpreadsheet,
  HardDrive,
  Info,
  Calendar,
} from 'lucide-react';
import { showToast } from '../common/ToastContainer';
import {
  DEFAULT_INGREDIENT_CATEGORIES,
  DEFAULT_RECIPE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_DELIVERY_PLATFORMS,
} from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

type SettingsTab =
  | 'store'
  | 'tax_service'
  | 'foodcost_platforms'
  | 'receipt_printers'
  | 'promptpay'
  | 'payment_methods'
  | 'categories_loyalty'
  | 'backup';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const { t, language, setLanguage, useBuddhistYear, setUseBuddhistYear, formatCurrency } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [promptPayQRDataUrl, setPromptPayQRDataUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage Health State (Section 8.4)
  const [storageEstimate, setStorageEstimate] = useState<{
    usageMb: number;
    quotaMb: number;
    percent: number;
    persisted: boolean;
  }>({ usageMb: 0, quotaMb: 0, percent: 0, persisted: false });

  // CSV Date Range Export State
  const [csvStartDate, setCsvStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [csvEndDate, setCsvEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // JSON Import Summary Confirmation Modal State
  const [pendingImportData, setPendingImportData] = useState<{
    rawJson: string;
    counts: {
      ingredients: number;
      recipes: number;
      products: number;
      orders: number;
      members: number;
      categories: number;
      tables: number;
    };
    version: number;
    exportedAt?: string;
  } | null>(null);

  // Clear All Data 2-Step Confirmation State
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  // Form Inputs for Adding New Items
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformGP, setNewPlatformGP] = useState(30);
  const [newPlatformHasVat, setNewPlatformHasVat] = useState(false);

  const [newCategoryType, setNewCategoryType] = useState<'ingredient' | 'recipe' | 'expense'>('ingredient');
  const [newCategoryValue, setNewCategoryValue] = useState('');

  const [newStationName, setNewStationName] = useState('');
  const [newStationWidth, setNewStationWidth] = useState<number>(80);

  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      checkStorageHealth();
    }
  }, [isOpen]);

  const checkStorageHealth = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageMb = Number(((est.usage || 0) / (1024 * 1024)).toFixed(2));
        const quotaMb = Number(((est.quota || 1) / (1024 * 1024)).toFixed(2));
        const percent = Number((((est.usage || 0) / (est.quota || 1)) * 100).toFixed(2));
        let persisted = false;
        if (navigator.storage.persisted) {
          persisted = await navigator.storage.persisted();
        }
        setStorageEstimate({ usageMb, quotaMb, percent, persisted });
      } catch (err) {
        console.error('Storage estimate error:', err);
      }
    }
  };

  const loadSettings = async () => {
    const s = await dbGet<RestaurantSettings>('settings', 'current_settings');
    if (s) {
      const filled: RestaurantSettings = {
        ...s,
        defaultTargetFoodCostPercent: s.defaultTargetFoodCostPercent ?? 30,
        defaultOverheadPercent: s.defaultOverheadPercent ?? 0,
        priceRounding: s.priceRounding ?? 1,
        platforms: s.platforms && s.platforms.length > 0 ? s.platforms : [...DEFAULT_DELIVERY_PLATFORMS],
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
              { id: 'kitchen', name: 'ครัวหลัก', paperWidthMm: 80 },
              { id: 'bar', name: 'บาร์เครื่องดื่ม', paperWidthMm: 58 },
            ],
        paymentMethods: s.paymentMethods && s.paymentMethods.length > 0
          ? s.paymentMethods
          : [...DEFAULT_PAYMENT_METHODS],
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
      const url = await QRCode.toDataURL(payload, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setPromptPayQRDataUrl(url);
    } catch {
      setPromptPayQRDataUrl('');
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await dbPut('settings', settings);
      showToast({
        title: language === 'th' ? 'บันทึกสำเร็จ' : 'Settings Saved',
        message: language === 'th' ? 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว' : 'Settings updated successfully',
        type: 'success',
      });
      onSettingsUpdated();
      onClose();
    } catch {
      showToast({
        title: 'Error',
        message: language === 'th' ? 'ไม่สามารถบันทึกการตั้งค่าได้' : 'Failed to save settings',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Section 8.4: Export JSON Backup (Blob + Anchor)
  const handleExportJSON = async () => {
    try {
      const jsonStr = await exportDatabaseToJSON();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `tonys-kitchen-backup-${dateStr}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update settings state with new lastBackupAt
      const now = new Date().toISOString();
      if (settings) {
        setSettings({ ...settings, lastBackupAt: now });
      }

      showToast({
        title: language === 'th' ? 'สำรองข้อมูลสำเร็จ' : 'Export Complete',
        message: `ดาวน์โหลดไฟล์ ${filename} แล้ว`,
        type: 'success',
      });
    } catch {
      showToast({
        title: 'Error',
        message: language === 'th' ? 'ไม่สามารถส่งออกข้อมูลได้' : 'Export failed',
        type: 'error',
      });
    }
  };

  // Section 8.4: Import JSON with Validation & Confirmation Summary
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation check
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        const counts = {
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.length : 0,
          recipes: Array.isArray(parsed.recipes) ? parsed.recipes.length : 0,
          products: Array.isArray(parsed.products) ? parsed.products.length : 0,
          orders: Array.isArray(parsed.orders) ? parsed.orders.length : 0,
          members: Array.isArray(parsed.members) ? parsed.members.length : 0,
          categories: Array.isArray(parsed.categories) ? parsed.categories.length : 0,
          tables: Array.isArray(parsed.tables) ? parsed.tables.length : 0,
        };

        const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
        if (totalItems === 0 && !parsed.settings) {
          throw new Error(
            language === 'th'
              ? 'ไฟล์ไม่มีข้อมูลร้านอาหารที่ถูกต้อง (ไม่พบตารางข้อมูลใดๆ)'
              : 'Invalid backup file: no database tables found'
          );
        }

        setPendingImportData({
          rawJson: text,
          counts,
          version: parsed.version || 1,
          exportedAt: parsed.exportedAt,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'โครงสร้างไฟล์เสียหาย';
        alert(
          language === 'th'
            ? `❌ ไฟล์สำรองข้อมูลไม่ถูกต้อง:\n${errorMsg} ไม่สามารถนำเข้าได้ ข้อมูลเดิมจะไม่ได้รับผลกระทบ`
            : `❌ Invalid backup file:\n${errorMsg}. Existing data untouched.`
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingImportData) return;
    try {
      const ok = await importDatabaseFromJSON(pendingImportData.rawJson);
      if (ok) {
        showToast({
          title: language === 'th' ? 'กู้คืนข้อมูลสำเร็จ' : 'Import Complete',
          message: language === 'th' ? 'นำเข้าข้อมูลสำรองเข้าสู่ระบบเรียบร้อยแล้ว' : 'Data imported successfully',
          type: 'success',
        });
        setPendingImportData(null);
        await loadSettings();
        onSettingsUpdated();
      }
    } catch {
      showToast({ title: 'Error', message: 'Import failed', type: 'error' });
    }
  };

  // Section 8.4: Export Bills CSV (date range, UTF-8 BOM for Thai Excel)
  const handleExportBillsCSV = async () => {
    try {
      const allOrders = await dbGetAll<Order>('orders');
      const inRange = allOrders.filter((o) => {
        const d = (o.paidAt || o.createdAt || '').split('T')[0];
        return d >= csvStartDate && d <= csvEndDate;
      });

      if (inRange.length === 0) {
        showToast({
          title: language === 'th' ? 'ไม่พบข้อมูล' : 'No Data',
          message: language === 'th' ? 'ไม่มีบิลการขายในช่วงวันที่เลือก' : 'No bills found in selected date range',
          type: 'info',
        });
        return;
      }

      const headers = [
        'เลขที่บิล (Bill No)',
        'วันที่ (Date)',
        'เวลา (Time)',
        'ประเภทออเดอร์ (Type)',
        'โต๊ะ/คิว (Table/Queue)',
        'ช่องทางชำระเงิน (Payment)',
        'ยอดรวมอาหาร (Subtotal)',
        'ส่วนลด (Discount)',
        'Service Charge',
        'ภาษีมูลค่าเพิ่ม VAT',
        'ยอดสุทธิ (Total Amount)',
        'ต้นทุนอาหารรวม (Cost)',
        'กำไรขั้นต้น (Gross Profit)',
        'สถานะ (Status)',
      ];

      const rows = inRange.map((o) => {
        const dateObj = new Date(o.paidAt || o.createdAt);
        const dateStr = dateObj.toLocaleDateString('th-TH');
        const timeStr = dateObj.toLocaleTimeString('th-TH');
        return [
          o.orderNumber || o.id,
          dateStr,
          timeStr,
          o.orderType,
          o.tableName || o.queueNo || '-',
          o.paymentMethod || o.platformId || '-',
          o.subtotal || 0,
          o.discountAmount || 0,
          o.serviceChargeAmount || 0,
          o.vatAmount || 0,
          o.totalAmount || 0,
          o.totalCost || 0,
          o.grossProfit || 0,
          o.status,
        ];
      });

      const filename = `tonys-kitchen-bills-${csvStartDate}-to-${csvEndDate}.csv`;
      exportToCSV(filename, headers, rows);
      showToast({
        title: language === 'th' ? 'ส่งออก CSV สำเร็จ' : 'CSV Exported',
        message: `ดาวน์โหลด ${filename} (พร้อม UTF-8 BOM เปิดใน Excel ภาษาไทยได้ทันที)`,
        type: 'success',
      });
    } catch {
      showToast({ title: 'Error', message: 'Failed to export CSV', type: 'error' });
    }
  };

  // Section 8.4: Load Sample Data
  const handleLoadSampleData = async () => {
    const ok = window.confirm(
      language === 'th'
        ? 'ต้องการโหลดข้อมูลตัวอย่างสำหรับร้านอาหารไทย (วัตถุดิบ 12 รายการ, สูตรอาหาร, เมนู POS, ผังโต๊ะ 8 โต๊ะ, สมาชิก และบิลย้อนหลัง 30 รายการ) หรือไม่? \n(ข้อมูลปัจจุบันจะถูกรีเซ็ต)'
        : 'Load authentic Thai bistro sample data? (Existing data will be reset)'
    );
    if (!ok) return;

    await initializeDatabase(true);
    await loadSettings();
    showToast({
      title: language === 'th' ? 'โหลดตัวอย่างสำเร็จ' : 'Sample Data Loaded',
      message: language === 'th' ? 'พร้อมใช้งานข้อมูลจำลองในทุกโมดูล' : 'Sample bistro data loaded successfully',
      type: 'success',
    });
    onSettingsUpdated();
    onClose();
  };

  // Section 8.4: Clear All Data (2-Step confirmation)
  const handleExecuteClearAll = async () => {
    if (clearConfirmText !== 'DELETE') {
      alert(language === 'th' ? 'กรุณาพิมพ์คำว่า "DELETE" ให้ถูกต้องเพื่อยืนยัน' : 'Please type "DELETE" to confirm');
      return;
    }

    try {
      const stores = [
        'ingredients',
        'recipes',
        'categories',
        'products',
        'tables',
        'orders',
        'shifts',
        'members',
        'promotions',
        'expenses',
      ] as const;

      for (const st of stores) {
        await dbClear(st);
      }

      setIsClearAllModalOpen(false);
      setClearConfirmText('');
      showToast({
        title: language === 'th' ? 'ล้างข้อมูลสำเร็จ' : 'All Data Cleared',
        message: language === 'th' ? 'ล้างฐานข้อมูลทั้งหมดเรียบร้อย' : 'Database completely cleared',
        type: 'info',
      });
      onSettingsUpdated();
      onClose();
    } catch {
      showToast({ title: 'Error', message: 'Failed to clear data', type: 'error' });
    }
  };

  // Category Add/Delete
  const handleAddCategory = () => {
    if (!settings || !newCategoryValue.trim()) return;
    const val = newCategoryValue.trim();
    if (newCategoryType === 'ingredient') {
      const cur = settings.ingredientCategories || [];
      if (!cur.includes(val)) {
        setSettings({ ...settings, ingredientCategories: [...cur, val] });
      }
    } else if (newCategoryType === 'recipe') {
      const cur = settings.recipeCategories || [];
      if (!cur.includes(val)) {
        setSettings({ ...settings, recipeCategories: [...cur, val] });
      }
    } else {
      const cur = settings.expenseCategories || [];
      if (!cur.includes(val)) {
        setSettings({ ...settings, expenseCategories: [...cur, val] });
      }
    }
    setNewCategoryValue('');
  };

  const handleDeleteCategory = (type: 'ingredient' | 'recipe' | 'expense', name: string) => {
    if (!settings) return;
    if (type === 'ingredient') {
      setSettings({
        ...settings,
        ingredientCategories: (settings.ingredientCategories || []).filter((c) => c !== name),
      });
    } else if (type === 'recipe') {
      setSettings({
        ...settings,
        recipeCategories: (settings.recipeCategories || []).filter((c) => c !== name),
      });
    } else {
      setSettings({
        ...settings,
        expenseCategories: (settings.expenseCategories || []).filter((c) => c !== name),
      });
    }
  };

  // Delivery Platform Add/Delete
  const handleAddPlatform = () => {
    if (!settings || !newPlatformName.trim()) return;
    const newPlat: PlatformConfig = {
      id: `plat_${Date.now()}`,
      name: newPlatformName.trim(),
      gpPercent: Number(newPlatformGP) || 0,
      gpHasVat: newPlatformHasVat,
    };
    setSettings({
      ...settings,
      platforms: [...(settings.platforms || []), newPlat],
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

  // Printer Station Add/Delete
  const handleAddPrinterStation = () => {
    if (!settings || !newStationName.trim()) return;
    const newSt: PrinterStation = {
      id: `st_${Date.now()}`,
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

  // Payment Method Add/Toggle
  const handleTogglePaymentMethod = (id: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      paymentMethods: (settings.paymentMethods || []).map((pm) =>
        pm.id === id ? { ...pm, enabled: !pm.enabled } : pm
      ),
    });
  };

  const handleAddPaymentMethod = () => {
    if (!settings || !newPaymentMethodName.trim()) return;
    const newPm: PaymentMethodConfig = {
      id: `pm_${Date.now()}`,
      type: 'wallet',
      name: newPaymentMethodName.trim(),
      enabled: true,
    };
    setSettings({
      ...settings,
      paymentMethods: [...(settings.paymentMethods || []), newPm],
    });
    setNewPaymentMethodName('');
  };

  if (!isOpen || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3E0] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#111827]">
                {language === 'th' ? 'การตั้งค่า & สำรองข้อมูล (Settings & Backup)' : 'Settings & Backup'}
              </h2>
              <p className="text-xs text-[#6B7280]">
                {language === 'th'
                  ? 'ข้อมูลร้านค้า, ต้นทุน, ภาษี, พร้อมเพย์, เครื่องพิมพ์, และการสำรองข้อมูล'
                  : 'Shop profile, food cost defaults, tax, promptpay, printers, and backup'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Horizontal Navigation Tabs (Section 3A Warm Light Theme) */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[#FED7AA] bg-[#FFFBF5] overflow-x-auto no-scrollbar">
          {[
            { id: 'store', label: language === 'th' ? 'ข้อมูลร้านค้า' : 'Shop Info', icon: Store },
            { id: 'tax_service', label: language === 'th' ? 'ภาษี & บริการ' : 'Tax & Service', icon: Percent },
            { id: 'foodcost_platforms', label: language === 'th' ? 'ต้นทุน & เดลิเวอรี' : 'Cost & Delivery', icon: Truck },
            { id: 'receipt_printers', label: language === 'th' ? 'ใบเสร็จ & ครัว' : 'Receipt & Printer', icon: Receipt },
            { id: 'promptpay', label: language === 'th' ? 'พร้อมเพย์ QR' : 'PromptPay QR', icon: QrIcon },
            { id: 'payment_methods', label: language === 'th' ? 'การชำระเงิน' : 'Payment Methods', icon: DollarSign },
            { id: 'categories_loyalty', label: language === 'th' ? 'หมวดหมู่ & สมาชิก' : 'Categories & CRM', icon: Tag },
            { id: 'backup', label: language === 'th' ? 'สำรองข้อมูล & รีเซ็ต' : 'Backup & Storage', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#FFFFFF] border-t-2 border-t-[#EA580C] text-[#EA580C] shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#FFF8EE]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#FFFFFF] space-y-6">
          {/* TAB 1: STORE / SHOP INFO */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'ชื่อร้านค้า (ภาษาไทย) *' : 'Restaurant Name (TH) *'}
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameTh}
                    onChange={(e) => setSettings({ ...settings, restaurantNameTh: e.target.value })}
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'ชื่อร้านค้า (ภาษาอังกฤษ)' : 'Restaurant Name (EN)'}
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameEn}
                    onChange={(e) => setSettings({ ...settings, restaurantNameEn: e.target.value })}
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm font-semibold focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  {language === 'th' ? 'สโลแกน / คำอธิบายร้าน' : 'Tagline'}
                </label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'เบอร์โทรศัพท์ร้าน' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-mono text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1">
                    {language === 'th' ? 'เลขประจำตัวผู้เสียภาษี (Tax ID 13 หลัก)' : 'Tax ID'}
                  </label>
                  <input
                    type="text"
                    value={settings.taxId}
                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                    className="w-full h-[44px] px-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] font-mono text-sm focus:ring-2 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1">
                  {language === 'th' ? 'ที่อยู่ร้านค้า (แสดงบนหัวใบเสร็จ)' : 'Address for Receipt'}
                </label>
                <textarea
                  rows={2}
                  value={settings.addressTh}
                  onChange={(e) => setSettings({ ...settings, addressTh: e.target.value })}
                  className="w-full p-3 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-[#111827] text-sm focus:ring-2 focus:ring-[#F97316]"
                />
              </div>

              <div className="pt-3 border-t border-[#FED7AA] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {language === 'th' ? 'ภาษาของระบบ (Language)' : 'Language'}
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    เลือกภาษาแสดงผลภาษาไทย หรือ English
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, language: 'th' });
                      setLanguage('th');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      settings.language === 'th'
                        ? 'bg-[#EA580C] text-white shadow-xs'
                        : 'bg-[#FFF8EE] border border-[#FED7AA] text-[#6B7280]'
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
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      settings.language === 'en'
                        ? 'bg-[#EA580C] text-white shadow-xs'
                        : 'bg-[#FFF8EE] border border-[#FED7AA] text-[#6B7280]'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#FED7AA] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {language === 'th' ? 'ปีพุทธศักราช (พ.ศ.)' : 'Buddhist Era Year (B.E.)'}
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    แสดงปี พ.ศ. (+543) ในเอกสาร ใบเสร็จ และรายงานสรุป
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBuddhistYear}
                    onChange={(e) => setUseBuddhistYear(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA580C]"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-[#FED7AA] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#111827]">
                    {language === 'th' ? 'ขนาดตัวอักษรทั้งระบบ (Text Size)' : 'Text Size'}
                  </div>
                  <div className="text-xs text-[#6B7280]">
                    ปรับขนาดตัวอักษรเพื่อความคมชัดบนแท็บเล็ตและจอขาย
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'normal', th: 'ปกติ (100%)', en: 'Normal' },
                      { id: 'large', th: 'ใหญ่ (115%)', en: 'Large' },
                      { id: 'xlarge', th: 'ใหญ่มาก (130%)', en: 'XL' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const updated = { ...settings, textSize: opt.id };
                        setSettings(updated);
                        document.documentElement.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
                        document.documentElement.classList.add(`text-size-${opt.id}`);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        (settings.textSize || 'large') === opt.id
                          ? 'bg-[#EA580C] text-white shadow-xs'
                          : 'bg-[#FFF8EE] border border-[#FED7AA] text-[#6B7280]'
                      }`}
                    >
                      {language === 'th' ? opt.th : opt.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAX & SERVICE CHARGE */}
          {activeTab === 'tax_service' && (
            <div className="space-y-5">
              {/* VAT Settings */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-[#EA580C]" />
                    <span className="font-bold text-sm text-[#111827]">ภาษีมูลค่าเพิ่ม (VAT)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.vatEnabled}
                      onChange={(e) => setSettings({ ...settings, vatEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA580C]"></div>
                  </label>
                </div>

                {settings.vatEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#FED7AA]">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1">
                        อัตราภาษี (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={settings.vatRate}
                        onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) || 7 })}
                        className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1">
                        รูปแบบราคาขาย
                      </label>
                      <select
                        value={settings.vatInclusive ? 'include' : 'exclude'}
                        onChange={(e) => setSettings({ ...settings, vatInclusive: e.target.value === 'include' })}
                        className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold"
                      >
                        <option value="include">VAT Include (ราคารวมภาษีแล้ว - สกัด VAT ออก)</option>
                        <option value="exclude">VAT Exclude (ราคาไม่รวมภาษี - บวกเพิ่มตอนชำระเงิน)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge Settings */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#EA580C]" />
                    <span className="font-bold text-sm text-[#111827]">ค่าบริการ (Service Charge)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.serviceChargeEnabled}
                      onChange={(e) => setSettings({ ...settings, serviceChargeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA580C]"></div>
                  </label>
                </div>

                {settings.serviceChargeEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#FED7AA]">
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1">
                        อัตราค่าบริการ (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={settings.serviceChargeRate}
                        onChange={(e) => setSettings({ ...settings, serviceChargeRate: Number(e.target.value) || 10 })}
                        className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#374151] mb-1">
                        นับเป็นรายได้ร้าน (Count as Revenue)
                      </label>
                      <select
                        value={settings.serviceChargeCountAsRevenue ? 'true' : 'false'}
                        onChange={(e) => setSettings({ ...settings, serviceChargeCountAsRevenue: e.target.value === 'true' })}
                        className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold"
                      >
                        <option value="false">ไม่นับเป็นรายได้ (เป็นกองกลางทิปพนักงาน)</option>
                        <option value="true">นับเป็นรายได้ร้าน (รวมคำนวณในกำไรสุทธิ)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FOOD COST & DELIVERY PLATFORMS */}
          {activeTab === 'foodcost_platforms' && (
            <div className="space-y-5">
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'ค่ามาตรฐานการคำนวณต้นทุน' : 'Food Cost Standards'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      เป้าหมาย Food Cost %
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="80"
                      value={settings.defaultTargetFoodCostPercent || 30}
                      onChange={(e) => setSettings({ ...settings, defaultTargetFoodCostPercent: Number(e.target.value) || 30 })}
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      ค่าโสหุ้ยร้าน (Overhead %)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={settings.defaultOverheadPercent || 0}
                      onChange={(e) => setSettings({ ...settings, defaultOverheadPercent: Number(e.target.value) || 0 })}
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      การปัดเศษราคาขาย (฿)
                    </label>
                    <select
                      value={settings.priceRounding || 1}
                      onChange={(e) => setSettings({ ...settings, priceRounding: Number(e.target.value) as 1 | 5 | 10 })}
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold"
                    >
                      <option value={1}>ปัดขึ้นทีละ 1 บาท</option>
                      <option value={5}>ปัดขึ้นทีละ 5 บาท (เช่น 125, 130)</option>
                      <option value={10}>ปัดขึ้นทีละ 10 บาท (เช่น 120, 130)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Delivery Platforms Management */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'แพลตฟอร์มเดลิเวอรี & ส่วนแบ่ง GP' : 'Delivery Platforms'}
                </h4>
                <div className="space-y-2">
                  {(settings.platforms || []).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white border border-[#FED7AA] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-[#111827]">{p.name}</span>
                        <span className="ml-2 font-mono font-bold text-[#EA580C]">
                          GP: {p.gpPercent}% {p.gpHasVat ? '(GP มี VAT 7%)' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePlatform(p.id)}
                        className="p-1 text-[#DC2626] hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Platform Form */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-[#FED7AA]">
                  <input
                    type="text"
                    placeholder="ชื่อแพลตฟอร์ม เช่น Robinhood"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    className="sm:col-span-2 h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs font-semibold"
                  />
                  <div className="flex items-center gap-1.5 bg-white border border-[#FDBA74] rounded-xl px-2 h-[44px]">
                    <span className="text-xs font-bold text-[#6B7280]">GP%</span>
                    <input
                      type="number"
                      value={newPlatformGP}
                      onChange={(e) => setNewPlatformGP(Number(e.target.value) || 0)}
                      className="w-full text-xs font-bold font-mono focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPlatform}
                    className="h-[44px] bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มแพลตฟอร์ม</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECEIPT & PRINTERS */}
          {activeTab === 'receipt_printers' && (
            <div className="space-y-5">
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'การพิมพ์ใบเสร็จความร้อน' : 'Thermal Receipt'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '80mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      settings.receiptWidth === '80mm'
                        ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412] font-bold shadow-xs'
                        : 'border-[#FED7AA] bg-white text-[#6B7280]'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-[#EA580C] shrink-0" />
                    <div>
                      <div className="font-bold text-sm">80 มม. (Standard POS)</div>
                      <div className="text-[11px] text-[#6B7280]">เครื่องพิมพ์สลิปตั้งโต๊ะมาตรฐาน</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '58mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                      settings.receiptWidth === '58mm'
                        ? 'border-[#EA580C] bg-[#FFEDD5] text-[#9A3412] font-bold shadow-xs'
                        : 'border-[#FED7AA] bg-white text-[#6B7280]'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-[#EA580C] shrink-0" />
                    <div>
                      <div className="font-bold text-sm">58 มม. (Compact Mobile)</div>
                      <div className="text-[11px] text-[#6B7280]">เครื่องพิมพ์พกพาไร้สายบลูทูธ</div>
                    </div>
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      ข้อความหัวใบเสร็จ
                    </label>
                    <input
                      type="text"
                      value={settings.receiptHeaderMessage}
                      onChange={(e) => setSettings({ ...settings, receiptHeaderMessage: e.target.value })}
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      ข้อความท้ายใบเสร็จ
                    </label>
                    <input
                      type="text"
                      value={settings.receiptFooterMessage}
                      onChange={(e) => setSettings({ ...settings, receiptFooterMessage: e.target.value })}
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Printer Stations */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'จุดพิมพ์ใบสั่งทำอาหาร (Printer Stations)' : 'Printer Stations'}
                </h4>
                <div className="space-y-2">
                  {(settings.printerStations || []).map((st) => (
                    <div
                      key={st.id}
                      className="p-3 bg-white border border-[#FED7AA] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-[#EA580C]" />
                        <span className="font-bold text-sm text-[#111827]">{st.name}</span>
                        <span className="font-mono text-[#6B7280]">({st.paperWidthMm}mm)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePrinterStation(st.id)}
                        className="p-1 text-[#DC2626] hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#FED7AA]">
                  <input
                    type="text"
                    placeholder="ชื่อจุดพิมพ์ เช่น ครัวของทอด"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    className="flex-1 h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs"
                  />
                  <select
                    value={newStationWidth}
                    onChange={(e) => setNewStationWidth(Number(e.target.value))}
                    className="h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs font-mono font-bold"
                  >
                    <option value={80}>80 มม.</option>
                    <option value={58}>58 มม.</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPrinterStation}
                    className="h-[44px] px-4 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มสเตชั่น</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PROMPTPAY QR */}
          {activeTab === 'promptpay' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      หมายเลขพร้อมเพย์ (เบอร์โทร 10 หลัก หรือ เลขบัตร ปชช. 13 หลัก) *
                    </label>
                    <input
                      type="text"
                      value={settings.promptPayId}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSettings({ ...settings, promptPayId: val });
                        generateQRPreview(val);
                      }}
                      placeholder="0891234567 หรือ 0105562089123"
                      className="w-full h-[46px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] font-mono text-base font-bold focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
                      ชื่อบัญชีพร้อมเพย์ (แสดงให้ลูกค้าตรวจสอบ)
                    </label>
                    <input
                      type="text"
                      value={settings.promptPayName}
                      onChange={(e) => setSettings({ ...settings, promptPayName: e.target.value })}
                      placeholder="ชื่อร้าน หรือ ชื่อเจ้าของบัญชี"
                      className="w-full h-[44px] px-3.5 rounded-xl border border-[#FDBA74] bg-[#FFF8EE] text-sm focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>

                  <div className="p-3 bg-[#FEF3C7] rounded-xl border border-[#FCD34D] text-xs text-[#92400E] leading-relaxed">
                    💡 <strong>หมายเหตุ:</strong> ระบบจะคำนวณและสร้าง QR Code พร้อมเพย์ตามมาตรฐาน EMVCo พร้อมยอดเงินจริงของแต่ละบิลอัตโนมัติ และแคชเชียร์จะตรวจสอบสลิปการโอนเงินด้วยตนเองก่อนกดยืนยันชำระ
                  </div>
                </div>

                {/* QR Preview Card */}
                <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-xs">
                  <div className="text-xs font-bold text-[#9A3412] mb-3">
                    ตัวอย่าง Dynamic PromptPay QR (ยอด ฿100.00)
                  </div>
                  {promptPayQRDataUrl ? (
                    <div className="bg-white p-3 rounded-2xl border border-[#FED7AA] shadow-sm">
                      <img src={promptPayQRDataUrl} alt="PromptPay QR" className="w-44 h-44 object-contain" />
                    </div>
                  ) : (
                    <div className="w-44 h-44 bg-white rounded-2xl border-2 border-dashed border-[#FED7AA] flex flex-col items-center justify-center text-[#6B7280] text-xs p-4">
                      <QrIcon className="w-8 h-8 text-[#F97316] mb-1" />
                      <span>กรุณากรอกเลขพร้อมเพย์เพื่อดูตัวอย่าง QR</span>
                    </div>
                  )}
                  {settings.promptPayName && (
                    <div className="text-xs font-bold text-[#111827] mt-2">
                      {settings.promptPayName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PAYMENT METHODS */}
          {activeTab === 'payment_methods' && (
            <div className="space-y-4">
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'ช่องทางการชำระเงินที่เปิดใช้งาน' : 'Enabled Payment Methods'}
                </h4>
                <div className="space-y-2">
                  {(settings.paymentMethods || []).map((pm) => (
                    <div
                      key={pm.id}
                      className="p-3 bg-white border border-[#FED7AA] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#EA580C]" />
                        <span className="font-bold text-sm text-[#111827]">{pm.name}</span>
                        <span className="text-[#6B7280]">({pm.type})</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pm.enabled}
                          onChange={() => handleTogglePaymentMethod(pm.id)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA580C]"></div>
                      </label>
                    </div>
                  ))}
                </div>

                {/* Add Custom E-Wallet */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#FED7AA]">
                  <input
                    type="text"
                    placeholder="เพิ่ม E-Wallet เช่น TrueMoney Wallet, Rabbit LINE Pay"
                    value={newPaymentMethodName}
                    onChange={(e) => setNewPaymentMethodName(e.target.value)}
                    className="flex-1 h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="h-[44px] px-4 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มช่องทาง</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: CATEGORIES & LOYALTY */}
          {activeTab === 'categories_loyalty' && (
            <div className="space-y-5">
              {/* Category Management */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-[#111827]">
                  {language === 'th' ? 'จัดการหมวดหมู่ของระบบ' : 'Category Management'}
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value as any)}
                    className="h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs font-bold"
                  >
                    <option value="ingredient">หมวดวัตถุดิบ</option>
                    <option value="recipe">หมวดสูตร/เมนูขาย</option>
                    <option value="expense">หมวดรายจ่าย</option>
                  </select>
                  <input
                    type="text"
                    placeholder="ชื่อหมวดหมู่ใหม่"
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    className="flex-1 h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="h-[44px] px-4 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                  >
                    + เพิ่ม
                  </button>
                </div>

                <div className="space-y-3 pt-2 text-xs">
                  <div>
                    <div className="font-bold text-[#374151] mb-1">หมวดวัตถุดิบ (Ingredient Categories):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.ingredientCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-white border border-[#FED7AA] rounded-lg text-[#111827] font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('ingredient', c)}
                            className="text-red-500 hover:text-red-700 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-[#374151] mb-1">หมวดสูตรอาหาร (Recipe Categories):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.recipeCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-white border border-[#FED7AA] rounded-lg text-[#111827] font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('recipe', c)}
                            className="text-red-500 hover:text-red-700 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-[#374151] mb-1">หมวดรายจ่าย (Expense Categories):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.expenseCategories || []).map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 bg-white border border-[#FED7AA] rounded-lg text-[#111827] font-semibold flex items-center gap-1 shadow-2xs"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory('expense', c)}
                            className="text-red-500 hover:text-red-700 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Loyalty CRM Settings */}
              <div className="bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#EA580C]" />
                    <span className="font-bold text-sm text-[#111827]">ระบบสะสมแต้มสมาชิก (Loyalty Program)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.loyalty?.enabled ?? true}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          loyalty: {
                            ...(settings.loyalty || { spendPerPoint: 25, bahtPerPoint: 1, minRedeemPoints: 10 }),
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA580C]"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#FED7AA]">
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
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
                            ...(settings.loyalty || { enabled: true, bahtPerPoint: 1, minRedeemPoints: 10 }),
                            spendPerPoint: Number(e.target.value) || 25,
                          },
                        })
                      }
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
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
                            ...(settings.loyalty || { enabled: true, spendPerPoint: 25, minRedeemPoints: 10 }),
                            bahtPerPoint: Number(e.target.value) || 1,
                          },
                        })
                      }
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#374151] mb-1">
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
                            ...(settings.loyalty || { enabled: true, spendPerPoint: 25, bahtPerPoint: 1 }),
                            minRedeemPoints: Number(e.target.value) || 10,
                          },
                        })
                      }
                      className="w-full h-[44px] px-3 bg-white border border-[#FDBA74] rounded-xl text-sm font-bold font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: BACKUP, EXPORT & STORAGE HEALTH (Section 8.4) */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Storage Health Card (Section 8.4) */}
              <div className="p-4 bg-[#FFF8EE] border border-[#FED7AA] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#111827]">
                      {language === 'th' ? 'สุขภาพพื้นที่จัดเก็บ (Storage Health)' : 'Storage Health'}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      ใช้งานไป: <strong className="text-[#111827]">{storageEstimate.usageMb} MB</strong> / {storageEstimate.quotaMb} MB ({storageEstimate.percent}%)
                      {storageEstimate.persisted ? ' • ปลอดภัยจากการล้างอัตโนมัติ (Persisted)' : ''}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-semibold text-[#EA580C] bg-white px-3 py-1.5 rounded-xl border border-[#FED7AA] self-start sm:self-auto">
                  สำรองล่าสุด: {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('th-TH') : 'ยังไม่เคยสำรอง'}
                </div>
              </div>

              {/* Clear Bilingual Notice Card */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>ข้อมูลบันทึกในเบราว์เซอร์ของอุปกรณ์นี้เท่านั้น (Local Storage):</strong> หากท่านล้างประวัติการท่องเว็บ (Clear Browser Data) หรือเปลี่ยนอุปกรณ์ ข้อมูลทั้งหมดจะสูญหาย กรุณากดปุ่ม <strong>"Export ข้อมูล (JSON)"</strong> เป็นประจำเพื่อเก็บไฟล์สำรองไว้อย่างปลอดภัย
                </div>
              </div>

              {/* Dual Cards: Export JSON & Import JSON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export JSON Card */}
                <div className="p-4 bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#111827]">
                    <Download className="w-5 h-5 text-emerald-600" />
                    <span>ส่งออกข้อมูลสำรอง (Export JSON)</span>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    ดาวน์โหลดไฟล์ <strong className="text-[#111827]">tonys-kitchen-backup-YYYY-MM-DD.json</strong> รวมทุกตารางข้อมูล (สูตร, วัตถุดิบ, เมนู, โต๊ะ, ออเดอร์, กะ, สมาชิก, รายจ่าย และรูปภาพ)
                  </p>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="w-full h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export ข้อมูล (JSON)</span>
                  </button>
                </div>

                {/* Import JSON Card */}
                <div className="p-4 bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#111827]">
                    <Upload className="w-5 h-5 text-[#EA580C]" />
                    <span>กู้คืนข้อมูลสำรอง (Import JSON)</span>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    นำเข้าไฟล์ .json ที่สำรองไว้ พร้อมระบบตรวจสอบความถูกต้องและสรุปจำนวนรายการก่อนยืนยันนำเข้าทับข้อมูลเดิม
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelected}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-[46px] bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import ข้อมูล (JSON)</span>
                  </button>
                </div>
              </div>

              {/* Export Bills CSV (date range) (Section 8.4) */}
              <div className="p-4 bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#111827]">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <span>ส่งออกรายงานบิลขาย (Export Bills CSV)</span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  ส่งออกไฟล์ .csv สำหรับฝ่ายบัญชี (มี UTF-8 BOM เปิดใน Microsoft Excel ภาษาไทยได้ทันทีโดยไม่เป็นภาษาต่างดาว)
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-xs font-bold text-[#6B7280]">ตั้งแต่วันที่:</span>
                    <input
                      type="date"
                      value={csvStartDate}
                      onChange={(e) => setCsvStartDate(e.target.value)}
                      className="h-[44px] px-3 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-xs font-bold text-[#6B7280]">ถึงวันที่:</span>
                    <input
                      type="date"
                      value={csvEndDate}
                      onChange={(e) => setCsvEndDate(e.target.value)}
                      className="h-[44px] px-3 bg-[#FFF8EE] border border-[#FDBA74] rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExportBillsCSV}
                    className="h-[44px] px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer w-full sm:w-auto ml-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลด CSV</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone: Load Sample Data & Clear All Data */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-red-800">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>จัดการข้อมูลระบบ & ข้อมูลตัวอย่าง</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    className="flex-1 h-[44px] px-3 bg-white border border-[#FED7AA] hover:bg-[#FFEDD5] text-[#9A3412] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="w-4 h-4 text-[#EA580C]" />
                    <span>โหลดข้อมูลตัวอย่าง (Load sample data)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsClearAllModalOpen(true);
                      setClearConfirmText('');
                    }}
                    className="flex-1 h-[44px] px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>ล้างข้อมูลทั้งหมด (Clear all data)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#FED7AA] bg-[#FFF8EE]">
          <div className="text-xs text-[#6B7280]">
            Tony's Kitchen • Offline-First Restaurant Engine
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#FED7AA] bg-white hover:bg-neutral-100 text-[#374151] font-bold text-xs cursor-pointer min-h-[44px]"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : language === 'th' ? 'บันทึกการตั้งค่า' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* JSON Import Confirmation Modal (Section 8.4) */}
      {pendingImportData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-base font-extrabold text-[#111827]">
              <Upload className="w-5 h-5 text-[#EA580C]" />
              <span>ยืนยันการนำเข้าข้อมูลสำรอง (Confirm Import)</span>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              ตรวจพบไฟล์สำรองข้อมูลที่ถูกต้อง ตารางข้อมูลที่จะถูกนำเข้ามาแทนที่ข้อมูลปัจจุบัน:
            </p>
            <div className="p-3 bg-[#FFF8EE] rounded-xl border border-[#FED7AA] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>วัตถุดิบ (Ingredients):</span>
                <strong className="font-mono">{pendingImportData.counts.ingredients} รายการ</strong>
              </div>
              <div className="flex justify-between">
                <span>สูตรอาหาร (Recipes):</span>
                <strong className="font-mono">{pendingImportData.counts.recipes} รายการ</strong>
              </div>
              <div className="flex justify-between">
                <span>สินค้าขาย POS (Products):</span>
                <strong className="font-mono">{pendingImportData.counts.products} รายการ</strong>
              </div>
              <div className="flex justify-between">
                <span>บิลการขาย (Orders):</span>
                <strong className="font-mono">{pendingImportData.counts.orders} บิล</strong>
              </div>
              <div className="flex justify-between">
                <span>สมาชิกสะสมแต้ม (Members):</span>
                <strong className="font-mono">{pendingImportData.counts.members} คน</strong>
              </div>
              <div className="flex justify-between">
                <span>โต๊ะอาหาร (Tables):</span>
                <strong className="font-mono">{pendingImportData.counts.tables} โต๊ะ</strong>
              </div>
            </div>
            <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold">
              ⚠️ การนำเข้าจะเขียนทับข้อมูลปัจจุบันของร้านทั้งหมด กรุณายืนยันหากท่านต้องการดำเนินการ
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingImportData(null)}
                className="px-4 py-2 rounded-xl border border-[#FED7AA] bg-white text-xs font-bold text-[#6B7280]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-xs"
              >
                ยืนยันเขียนทับและนำเข้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Data 2-Step Confirmation Modal (Section 8.4) */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-red-300 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-base font-extrabold text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <span>ยืนยันล้างข้อมูลทั้งหมด (Clear All Data)</span>
            </div>
            <p className="text-xs text-[#374151] leading-relaxed">
              การดำเนินการนี้จะล้างข้อมูลวัตถุดิบ สูตรอาหาร สินค้า บิลการขาย โต๊ะ สมาชิก และประวัติรายจ่ายทั้งหมดในเบราว์เซอร์นี้
            </p>
            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1">
                พิมพ์คำว่า <span className="text-red-600 font-mono font-black">DELETE</span> เพื่อยืนยัน:
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full h-[44px] px-3 border border-red-300 rounded-xl font-mono font-bold text-center text-red-600 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#FED7AA] bg-white text-xs font-bold text-[#6B7280]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={clearConfirmText !== 'DELETE'}
                onClick={handleExecuteClearAll}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs disabled:opacity-40"
              >
                ล้างข้อมูลทั้งหมดทันที
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
