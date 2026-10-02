import React, { useState } from 'react';
import { Order, OrderItem, RestaurantSettings, PrinterStation } from '../../types';
import { useTranslation } from '../../i18n';
import { Printer, X, CheckCircle, RotateCcw, AlertTriangle, Eye } from 'lucide-react';

interface KitchenTicketModalProps {
  isOpen: boolean;
  order: Order;
  itemsToPrint: OrderItem[];
  voidedItems?: OrderItem[];
  settings: RestaurantSettings | null;
  onClose: () => void;
  isReprint?: boolean;
}

export const KitchenTicketModal: React.FC<KitchenTicketModalProps> = ({
  isOpen,
  order,
  itemsToPrint,
  voidedItems = [],
  settings,
  onClose,
  isReprint = false,
}) => {
  const { t, formatTime, formatDate, language } = useTranslation();
  const [selectedStation, setSelectedStation] = useState<string>('all');

  if (!isOpen) return null;

  const paperWidth = settings?.receiptWidth || '80mm';

  // Available stations
  const configuredStations: PrinterStation[] = settings?.printerStations || [
    { id: 'kitchen', name: 'ครัวหลัก (Kitchen)', paperWidthMm: 80 },
    { id: 'bar', name: 'บาร์เครื่องดื่ม (Bar)', paperWidthMm: 58 },
  ];

  // Group items by station
  const stationMap: Record<string, { name: string; items: OrderItem[]; voided: OrderItem[] }> = {};

  // Default fallback stations
  stationMap['kitchen'] = { name: 'ครัวหลัก (Kitchen)', items: [], voided: [] };
  stationMap['bar'] = { name: 'บาร์เครื่องดื่ม (Bar)', items: [], voided: [] };

  configuredStations.forEach((st) => {
    if (!stationMap[st.id]) {
      stationMap[st.id] = { name: st.name, items: [], voided: [] };
    }
  });

  itemsToPrint.forEach((item) => {
    const stId = item.kitchenStation || (item as any).stationId || 'kitchen';
    if (!stationMap[stId]) {
      stationMap[stId] = { name: stId.toUpperCase(), items: [], voided: [] };
    }
    stationMap[stId].items.push(item);
  });

  voidedItems.forEach((item) => {
    const stId = item.kitchenStation || (item as any).stationId || 'kitchen';
    if (!stationMap[stId]) {
      stationMap[stId] = { name: stId.toUpperCase(), items: [], voided: [] };
    }
    stationMap[stId].voided.push(item);
  });

  // Filter stations that have items
  const activeStations = Object.entries(stationMap).filter(
    ([_, data]) => data.items.length > 0 || data.voided.length > 0
  );

  const stationsToRender =
    selectedStation === 'all'
      ? activeStations
      : activeStations.filter(([id]) => id === selectedStation);

  const handlePrint = () => {
    window.print();
  };

  const getOrderTypeLabel = () => {
    if (order.orderType === 'dine_in') return '🍽️ ทานที่ร้าน (Dine-in)';
    if (order.orderType === 'takeaway') return '🛍️ สั่งกลับบ้าน (Takeaway)';
    return `🛵 เดลิเวอรี (${(order.platformId || 'Delivery').toUpperCase()})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FFFFFF] border border-[#FED7AA] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FED7AA] bg-[#FFF8EE]">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#EA580C]" />
            <h3 className="font-bold text-[#111827] text-base">
              {isReprint
                ? 'พิมพ์ซ้ำใบสั่งทำอาหาร (Reprint Kitchen Ticket)'
                : 'พิมพ์ใบสั่งทำอาหารเข้าครัว/บาร์ (Kitchen & Bar Ticket)'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-neutral-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar for Station preview */}
        <div className="px-6 py-2.5 bg-[#FFFBF5] border-b border-[#FED7AA] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#374151]">สเตชั่นที่พิมพ์:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSelectedStation('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  selectedStation === 'all'
                    ? 'bg-[#EA580C] text-white shadow-2xs'
                    : 'bg-white border border-[#FED7AA] text-[#6B7280]'
                }`}
              >
                ทุกสเตชั่น ({activeStations.length})
              </button>
              {activeStations.map(([id, data]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedStation(id)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedStation === id
                      ? 'bg-[#EA580C] text-white shadow-2xs'
                      : 'bg-white border border-[#FED7AA] text-[#6B7280]'
                  }`}
                >
                  {data.name}
                </button>
              ))}
            </div>
          </div>

          <span className="font-mono text-[#6B7280]">ขนาดกระดาษ: {paperWidth}</span>
        </div>

        {/* Ticket Previews (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-100 space-y-6">
          {stationsToRender.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-neutral-300 text-neutral-500">
              ไม่มีรายการอาหารใหม่สำหรับสเตชั่นนี้
            </div>
          ) : (
            stationsToRender.map(([stId, data]) => (
              <div
                key={stId}
                className="max-w-[340px] mx-auto bg-white border border-neutral-300 shadow-md p-5 text-neutral-900 font-mono rounded-lg relative"
              >
                {/* Station Ticket Header */}
                <div className="text-center border-b-2 border-dashed border-neutral-800 pb-3 mb-3">
                  {isReprint && (
                    <div className="inline-block px-2 py-0.5 mb-1 text-[11px] font-black bg-neutral-200 border border-neutral-800 rounded">
                      *** ใบพิมพ์ซ้ำ / REPRINT ***
                    </div>
                  )}
                  <div className="text-lg font-black tracking-wide uppercase">{data.name}</div>
                  <div className="text-xl font-black mt-1">
                    {order.tableName ? `โต๊ะ: ${order.tableName}` : `คิว: ${order.orderNumber}`}
                  </div>
                  <div className="text-xs font-bold mt-0.5">{getOrderTypeLabel()}</div>
                  <div className="text-[11px] text-neutral-600 mt-1 flex justify-between">
                    <span>บิล: {order.orderNumber}</span>
                    <span>{formatTime(new Date().toISOString())}</span>
                  </div>
                </div>

                {/* Items to Cook */}
                {data.items.length > 0 && (
                  <div className="space-y-3 pb-3 border-b-2 border-dashed border-neutral-800">
                    {data.items.map((item, idx) => (
                      <div key={idx} className="leading-tight">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xl font-black shrink-0">x{item.quantity}</span>
                          <span className="text-base font-black flex-1 text-left">
                            {item.productNameTh || item.productName || item.name}
                          </span>
                        </div>
                        {/* Modifiers & Notes */}
                        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                          <div className="pl-6 text-xs font-bold text-neutral-700">
                            {item.selectedModifiers.map((m, mi) => (
                              <div key={mi}>• {m.nameTh || m.name}</div>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <div className="pl-6 text-xs font-black text-rose-600 underline mt-0.5">
                            โน้ต: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* VOID / CANCELLED SECTION (Section 7.3) */}
                {data.voided.length > 0 && (
                  <div className="pt-3 text-red-600">
                    <div className="text-center font-black text-xs border border-red-600 py-0.5 mb-2 bg-red-50">
                      *** VOID / รายการที่ยกเลิก ***
                    </div>
                    <div className="space-y-2">
                      {data.voided.map((vItem, vIdx) => (
                        <div key={vIdx} className="line-through flex items-start justify-between text-xs font-bold">
                          <span>x{vItem.quantity} {vItem.productNameTh || vItem.name}</span>
                          <span>(ยกเลิก)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center text-[10px] text-neutral-500 pt-3">
                  --- จบรายการส่งครัว ---
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-[#FFFFFF] border-t border-[#FED7AA] flex items-center justify-between">
          <div className="text-xs text-[#6B7280]">
            กดพิมพ์เพื่อส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ใบเสร็จ/ครัวผ่านเบราว์เซอร์
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFFFFF] hover:bg-neutral-100 text-[#374151] font-bold text-xs cursor-pointer min-h-[44px]"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-xs flex items-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบส่งครัว (Print Tickets)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print-Only DOM for @media print (Section 7.3) */}
      <div id="printable-kitchen-ticket" className="hidden print:block font-mono text-black">
        {stationsToRender.map(([stId, data]) => (
          <div
            key={stId}
            style={{ width: paperWidth === '58mm' ? '54mm' : '76mm' }}
            className="p-2 mx-auto leading-tight break-after-page text-black"
          >
            <div className="text-center border-b pb-2 mb-2">
              {isReprint && <div className="text-xs font-black">*** REPRINT ***</div>}
              <div className="text-lg font-black uppercase">{data.name}</div>
              <div className="text-xl font-black mt-1">
                {order.tableName ? `โต๊ะ: ${order.tableName}` : `คิว: ${order.orderNumber}`}
              </div>
              <div className="text-xs font-bold">{getOrderTypeLabel()}</div>
              <div className="text-[10px] mt-1 flex justify-between">
                <span>บิล: {order.orderNumber}</span>
                <span>{formatTime(new Date().toISOString())}</span>
              </div>
            </div>

            <div className="space-y-2 pb-2 border-b">
              {data.items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-start justify-between">
                    <span className="text-lg font-black mr-2">x{item.quantity}</span>
                    <span className="text-base font-black flex-1">
                      {item.productNameTh || item.name}
                    </span>
                  </div>
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <div className="pl-4 text-xs font-bold">
                      {item.selectedModifiers.map((m, mi) => (
                        <div key={mi}>• {m.nameTh || m.name}</div>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="pl-4 text-xs font-black underline">
                      โน้ต: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {data.voided.length > 0 && (
              <div className="pt-2 text-xs">
                <div className="text-center font-black">*** VOID / ยกเลิก ***</div>
                {data.voided.map((v, vi) => (
                  <div key={vi} className="line-through">
                    x{v.quantity} {v.productNameTh || v.name}
                  </div>
                ))}
              </div>
            )}

            <div className="text-center text-[9px] pt-2">--- จบรายการ ---</div>
          </div>
        ))}
      </div>
    </div>
  );
};
