import React, { useState, useEffect } from 'react';
import { Shift } from '../../types';
import { dbGetAll } from '../../db';
import { useTranslation } from '../../i18n';
import { Clock, Plus, CheckCircle2, AlertTriangle, Calendar, DollarSign } from 'lucide-react';

interface ShiftsViewProps {
  activeShift: Shift | null;
  onOpenShiftModal: () => void;
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
  activeShift,
  onOpenShiftModal,
}) => {
  const { t, formatCurrency, formatDate, formatTime } = useTranslation();
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    loadShifts();
  }, [activeShift]);

  const loadShifts = async () => {
    const list = await dbGetAll<Shift>('shifts');
    setShifts(list.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-500" />
            <span>{t.navShifts || 'ประวัติและจัดการกะการขาย'}</span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            ตรวจนับเงินสดลิ้นชัก ติดตามยอดขายแยกตามกะ และสรุปผลต่างเงินสดตอนปิดกะ
          </p>
        </div>

        <button
          onClick={onOpenShiftModal}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
        >
          <Clock className="w-4 h-4" />
          <span>{activeShift ? 'สรุป / ปิดกะปัจจุบัน' : 'เปิดกะใหม่'}</span>
        </button>
      </div>

      {/* Active Shift Card if open */}
      {activeShift && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                #{activeShift.shiftNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-emerald-950">กะที่กำลังเปิดขาย</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800 animate-pulse">
                    ACTIVE
                  </span>
                </div>
                <div className="text-xs text-emerald-700">
                  เปิดเมื่อ {formatDate(activeShift.openedAt)} เวลา {formatTime(activeShift.openedAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <div className="text-[11px] text-emerald-800">เงินทอนตั้งต้น</div>
                <div className="font-extrabold text-base text-emerald-950">
                  {formatCurrency(activeShift.startingCash)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-800">ยอดขายรวม</div>
                <div className="font-extrabold text-base text-orange-600">
                  {formatCurrency(activeShift.totalSales)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shifts History Table */}
      <div className="bg-white border border-[#FED7AA] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFFBF5] border-b border-[#FED7AA] text-[#6B7280] font-bold">
                <th className="p-3.5">กะที่</th>
                <th className="p-3.5">เวลาเปิดกะ</th>
                <th className="p-3.5">เวลาปิดกะ</th>
                <th className="p-3.5 text-right">เงินทอนเริ่ม</th>
                <th className="p-3.5 text-right">ยอดขายเงินสด</th>
                <th className="p-3.5 text-right">ยอดขายรวม</th>
                <th className="p-3.5 text-right">ผลต่างเงินสด</th>
                <th className="p-3.5 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    ยังไม่มีประวัติกะ
                  </td>
                </tr>
              ) : (
                shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="p-3.5 font-bold text-[#1F2937]">#{s.shiftNumber}</td>
                    <td className="p-3.5 text-[#6B7280]">
                      {formatDate(s.openedAt)} {formatTime(s.openedAt)}
                    </td>
                    <td className="p-3.5 text-[#6B7280]">
                      {s.closedAt ? `${formatDate(s.closedAt)} ${formatTime(s.closedAt)}` : '-'}
                    </td>
                    <td className="p-3.5 text-right font-medium">
                      {formatCurrency(s.startingCash)}
                    </td>
                    <td className="p-3.5 text-right font-medium">
                      {formatCurrency(s.cashSales)}
                    </td>
                    <td className="p-3.5 text-right font-extrabold text-orange-600">
                      {formatCurrency(s.totalSales)}
                    </td>
                    <td className="p-3.5 text-right font-bold">
                      {s.cashDifference !== undefined ? (
                        <span
                          className={
                            s.cashDifference === 0
                              ? 'text-emerald-600'
                              : s.cashDifference > 0
                              ? 'text-blue-600'
                              : 'text-red-600'
                          }
                        >
                          {s.cashDifference > 0 ? '+' : ''}
                          {formatCurrency(s.cashDifference)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          s.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {s.status === 'open' ? 'กำลังเปิด' : 'ปิดแล้ว'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
