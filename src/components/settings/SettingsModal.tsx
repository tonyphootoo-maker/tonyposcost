import React, { useState, useEffect, useRef } from 'react';
import { RestaurantSettings } from '../../types';
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
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'store' | 'promptpay' | 'tax' | 'receipt' | 'backup'>('store');
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [promptPayQRDataUrl, setPromptPayQRDataUrl] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const s = await dbGet<RestaurantSettings>('settings', 'current_settings');
    if (s) {
      setSettings(s);
      generateQRPreview(s.promptPayId);
    }
  };

  const generateQRPreview = async (promptPayId: string) => {
    if (!promptPayId) {
      setPromptPayQRDataUrl('');
      return;
    }
    try {
      const payload = generatePromptPayPayload(promptPayId, 100); // 100 THB test
      const qrUrl = await QRCode.toDataURL(payload, {
        width: 200,
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
    await dbPut('settings', settings);
    setIsSaving(false);
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setImportStatus(language === 'th' ? 'กำลังกู้คืนข้อมูล...' : 'Restoring data...');
      const success = await importDatabaseFromJSON(content);
      if (success) {
        setImportStatus(language === 'th' ? 'กู้คืนสำเร็จ! กำลังโหลดใหม่...' : 'Restored successfully! Reloading...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setImportStatus(language === 'th' ? 'ล้มเหลว: รูปแบบไฟล์ไม่ถูกต้อง' : 'Failed: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const handleResetPresets = async () => {
    const confirmed = window.confirm(
      language === 'th'
        ? 'ต้องการรีเซ็ตข้อมูลเป็นชุดตัวอย่างตั้งต้นของร้าน Tony\'s Kitchen หรือไม่? (ข้อมูลการขายปัจจุบันจะถูกแทนที่)'
        : 'Reset all data back to Tony\'s Kitchen default presets?'
    );
    if (!confirmed) return;

    await initializeDatabase(true);
    window.location.reload();
  };

  if (!isOpen || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t.settingsTitle}</h2>
              <p className="text-xs text-neutral-400">
                {language === 'th' ? 'ระบบขายหน้าร้าน, ภาษี, พร้อมเพย์ และการสำรองข้อมูล' : 'POS configs, PromptPay, VAT & Backup'}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 px-6 bg-neutral-950/30 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'store'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Store className="w-4 h-4" />
            {language === 'th' ? 'ข้อมูลร้านค้า' : 'Store Profile'}
          </button>
          <button
            onClick={() => setActiveTab('promptpay')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'promptpay'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrIcon className="w-4 h-4" />
            {language === 'th' ? 'พร้อมเพย์ QR' : 'PromptPay QR'}
          </button>
          <button
            onClick={() => setActiveTab('tax')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'tax'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Percent className="w-4 h-4" />
            {language === 'th' ? 'VAT & เซอร์วิสชาร์จ' : 'VAT & Service Charge'}
          </button>
          <button
            onClick={() => setActiveTab('receipt')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'receipt'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            {language === 'th' ? 'แบบพิมพ์ใบเสร็จ' : 'Receipt Format'}
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Database className="w-4 h-4" />
            {language === 'th' ? 'สำรอง & กู้คืน' : 'Backup & Restore'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: STORE PROFILE */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    {language === 'th' ? 'ชื่อร้าน (ภาษาไทย)' : 'Store Name (Thai)'}
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameTh}
                    onChange={(e) => setSettings({ ...settings, restaurantNameTh: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    {language === 'th' ? 'ชื่อร้าน (English)' : 'Store Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={settings.restaurantNameEn}
                    onChange={(e) => setSettings({ ...settings, restaurantNameEn: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                  {language === 'th' ? 'สโลแกน / คำอธิบายร้าน' : 'Tagline / Bio'}
                </label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    {language === 'th' ? 'เบอร์โทรศัพท์ติดต่อ' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    {language === 'th' ? 'เลขประจำตัวผู้เสียภาษี 13 หลัก' : 'Tax Identification Number (13 digits)'}
                  </label>
                  <input
                    type="text"
                    value={settings.taxId}
                    onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                  {language === 'th' ? 'ที่อยู่ร้านค้า (ภาษาไทย)' : 'Address (Thai)'}
                </label>
                <textarea
                  rows={2}
                  value={settings.addressTh}
                  onChange={(e) => setSettings({ ...settings, addressTh: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PROMPTPAY */}
          {activeTab === 'promptpay' && (
            <div className="space-y-4">
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 text-xs text-amber-200/90 leading-relaxed">
                {language === 'th'
                  ? 'ระบบจะสร้าง QR Code พร้อมเพย์มาตรฐาน EMVCo แบบไดนามิกตามยอดรวมของแต่ละบิลอัตโนมัติ เพื่อให้ลูกค้าสแกนจ่ายผ่านแอปธนาคารไทยได้ทุกธนาคาร'
                  : 'The system dynamically produces standard EMVCo PromptPay QR codes with exact bill amounts for seamless scanning by any Thai mobile banking app.'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                      {t.promptpayIdLabel}
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
                      className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {language === 'th'
                        ? 'เบอร์มือถือ 10 หลัก (เช่น 0891234567) หรือ เลข ปชช./นิติบุคคล 13 หลัก'
                        : '10-digit mobile number or 13-digit Thai national ID/corporate tax ID.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                      {language === 'th' ? 'ชื่อบัญชีร้านที่แสดง' : 'PromptPay Account Name'}
                    </label>
                    <input
                      type="text"
                      value={settings.promptPayName}
                      onChange={(e) => setSettings({ ...settings, promptPayName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* QR Code Preview */}
                <div className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="text-xs font-semibold text-neutral-400 mb-2">
                    {language === 'th' ? 'ตัวอย่าง QR Code พร้อมเพย์' : 'Live PromptPay QR Preview'}
                  </div>
                  {promptPayQRDataUrl ? (
                    <div className="bg-white p-3 rounded-lg shadow-md flex flex-col items-center">
                      <img src={promptPayQRDataUrl} alt="PromptPay Preview" className="w-36 h-36" />
                      <div className="text-neutral-900 font-bold text-xs mt-1">THB 100.00 (Test)</div>
                    </div>
                  ) : (
                    <div className="w-36 h-36 bg-neutral-800/60 rounded-lg flex items-center justify-center text-xs text-neutral-500 text-center px-4">
                      {language === 'th' ? 'กรุณาระบุเลขพร้อมเพย์' : 'Enter PromptPay ID'}
                    </div>
                  )}
                  <span className="text-[10px] text-emerald-400 mt-2 font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" /> EMVCo Compliant
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAX & SERVICE CHARGE */}
          {activeTab === 'tax' && (
            <div className="space-y-5">
              {/* VAT Setting */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {language === 'th' ? 'ระบบภาษีมูลค่าเพิ่ม (VAT 7%)' : 'Value Added Tax (VAT 7%)'}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      {language === 'th' ? 'คำนวณและแสดงภาษีในใบเสร็จ' : 'Calculate & display VAT in receipts'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.vatEnabled}
                      onChange={(e) => setSettings({ ...settings, vatEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
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
                          className="accent-amber-500"
                        />
                        <span className="text-neutral-200">{t.vatIncludedNote}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          checked={!settings.vatInclusive}
                          onChange={() => setSettings({ ...settings, vatInclusive: false })}
                          className="accent-amber-500"
                        />
                        <span className="text-neutral-200">{t.vatExcludedNote}</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 w-48">
                      <span className="text-xs text-neutral-400">อัตราภาษี:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.vatRate}
                        onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded text-center text-white"
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge Setting */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {language === 'th' ? 'ค่าบริการ (Service Charge)' : 'Service Charge'}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      {language === 'th' ? 'คิดค่าบริการเพิ่มสำหรับลูกค้าทานที่ร้าน (Dine-in)' : 'Add service charge for dine-in tables'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.serviceChargeEnabled}
                      onChange={(e) => setSettings({ ...settings, serviceChargeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {settings.serviceChargeEnabled && (
                  <div className="pt-3 border-t border-neutral-800 flex items-center gap-2 w-48">
                    <span className="text-xs text-neutral-400">อัตราเซอร์วิสชาร์จ:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.serviceChargeRate}
                      onChange={(e) => setSettings({ ...settings, serviceChargeRate: Number(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-sm bg-neutral-900 border border-neutral-700 rounded text-center text-white"
                    />
                    <span className="text-xs text-neutral-400">%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: RECEIPT FORMAT */}
          {activeTab === 'receipt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                  {t.receiptFormat}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '80mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.receiptWidth === '80mm'
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">{t.receipt80mm}</div>
                      <div className="text-xs text-neutral-500">มาตรฐานเครื่องพิมพ์ความร้อนทั่วไป (Epson, Sunmi, Xprinter)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, receiptWidth: '58mm' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.receiptWidth === '58mm'
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Receipt className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">{t.receipt58mm}</div>
                      <div className="text-xs text-neutral-500">เครื่องพกพาไร้สายบลูทูธ ขนาดกะทัดรัด</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                  {language === 'th' ? 'ข้อความหัวใบเสร็จ' : 'Receipt Header Note'}
                </label>
                <input
                  type="text"
                  value={settings.receiptHeaderMessage}
                  onChange={(e) => setSettings({ ...settings, receiptHeaderMessage: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                  {language === 'th' ? 'ข้อความท้ายใบเสร็จ (คำขอบคุณ/Wi-Fi/ติดต่อ)' : 'Receipt Footer Greeting'}
                </label>
                <input
                  type="text"
                  value={settings.receiptFooterMessage}
                  onChange={(e) => setSettings({ ...settings, receiptFooterMessage: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Download className="w-4 h-4 text-emerald-400" />
                    {language === 'th' ? 'ส่งออกข้อมูลสำรอง (Backup)' : 'Export Full Backup'}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {language === 'th'
                      ? 'ดาวน์โหลดไฟล์ .json บันทึกข้อมูลเมนู สูตรอาหาร สต็อก ประวัติการขาย และการตั้งค่าทั้งหมดไว้บนคอมพิวเตอร์ของคุณ'
                      : 'Download a complete JSON snapshot of all recipes, ingredients, orders, tables, and settings to your computer.'}
                  </p>
                  <button
                    onClick={handleExport}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    {t.export}
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Upload className="w-4 h-4 text-sky-400" />
                    {language === 'th' ? 'กู้คืนข้อมูล (Restore)' : 'Restore from Backup'}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {language === 'th'
                      ? 'นำเข้าไฟล์ .json ที่สำรองไว้ เพื่อกู้คืนข้อมูลทั้งหมดกลับมาในเบราว์เซอร์'
                      : 'Upload a previously exported JSON backup file to restore all tables, recipes, and transactions.'}
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
                    className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    {t.import}
                  </button>
                  {importStatus && (
                    <div className="text-xs text-amber-400 text-center font-medium mt-1">{importStatus}</div>
                  )}
                </div>
              </div>

              {/* Danger Zone: Reset presets */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {t.dangerZone}
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {language === 'th'
                    ? 'หากต้องการล้างข้อมูลและเริ่มต้นใหม่ สามารถโหลดชุดตัวอย่างอาหารไทยสูตรมาตรฐานของ Tony\'s Kitchen (ผัดไทย, ต้มยำ, ข้าวเหนียวมะม่วง ฯลฯ) กลับมาได้ทันที'
                    : 'Reset and repopulate the database with Tony\'s Kitchen default authentic Thai menu and food cost formulas.'}
                </p>
                <button
                  onClick={handleResetPresets}
                  className="py-2 px-3 bg-neutral-900 hover:bg-rose-900/50 border border-rose-800/60 text-rose-300 font-medium rounded-lg text-xs flex items-center gap-2 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {language === 'th' ? 'โหลดข้อมูลตัวอย่างเริ่มต้นของร้านใหม่' : 'Reset to Default Thai Sample Data'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/60">
          <div className="text-xs text-neutral-500">
            {language === 'th' ? 'บันทึกในเครื่องทันที (Local IndexedDB)' : 'Saved locally in IndexedDB'}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              {isSaving ? '...' : t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
