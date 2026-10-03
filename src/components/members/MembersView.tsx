import React, { useState, useEffect } from 'react';
import { Member } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { showToast } from '../common/ToastContainer';
import {
  Users,
  Plus,
  Search,
  Trash2,
  Edit2,
  Award,
  Phone,
  Calendar,
  X,
  CheckCircle,
} from 'lucide-react';

export const MembersView: React.FC = () => {
  const { t, language, formatCurrency, formatDate } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [formData, setFormData] = useState<{
    id?: string;
    code: string;
    name: string;
    phone: string;
    points: number;
    tier: 'bronze' | 'silver' | 'gold' | 'vip';
    notes: string;
  }>({
    code: '',
    name: '',
    phone: '',
    points: 0,
    tier: 'bronze',
    notes: '',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    const list = await dbGetAll<Member>('members');
    list.sort((a, b) => b.points - a.points);
    setMembers(list);
  };

  const handleOpenAdd = () => {
    setEditingMember(null);
    const nextNum = members.length + 1001;
    setFormData({
      code: `TK-${nextNum}`,
      name: '',
      phone: '',
      points: 0,
      tier: 'bronze',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setFormData({
      id: m.id,
      code: m.code,
      name: m.name,
      phone: m.phone,
      points: m.points,
      tier: m.tier as any,
      notes: m.notes || m.note || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ต้องการลบข้อมูลสมาชิก "${name}" หรือไม่?`)) return;
    await dbDelete('members', id);
    showToast({
      title: language === 'th' ? 'ลบสมาชิกแล้ว' : 'Member Deleted',
      message: `ลบข้อมูล "${name}" เรียบร้อย`,
      type: 'info',
    });
    await loadMembers();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    // Edge Case check: Duplicate phone number
    const cleanPhone = formData.phone.trim();
    const existingWithPhone = members.find(
      (m) => m.phone === cleanPhone && m.id !== formData.id
    );
    if (existingWithPhone) {
      showToast({
        title: language === 'th' ? 'เบอร์โทรศัพท์ซ้ำ' : 'Duplicate Phone Number',
        message:
          language === 'th'
            ? `เบอร์โทรศัพท์ ${cleanPhone} ได้ลงทะเบียนไว้แล้วในชื่อ "${existingWithPhone.name}"`
            : `Phone ${cleanPhone} is already registered under "${existingWithPhone.name}"`,
        type: 'error',
      });
      return;
    }

    const member: Member = {
      id: formData.id || `mem_${Date.now()}`,
      code: formData.code,
      name: formData.name.trim(),
      phone: cleanPhone,
      points: Number(formData.points) || 0,
      tier: formData.tier,
      totalSpent: editingMember ? editingMember.totalSpent : 0,
      visitCount: editingMember ? editingMember.visitCount : 0,
      notes: formData.notes.trim(),
      note: formData.notes.trim(),
      createdAt: editingMember ? editingMember.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbPut('members', member);
    showToast({
      title: language === 'th' ? 'บันทึกสำเร็จ' : 'Saved',
      message: `บันทึกข้อมูลสมาชิก "${member.name}" เรียบร้อย`,
      type: 'success',
    });
    setIsModalOpen(false);
    await loadMembers();
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in text-[#111827]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-[#FED7AA] rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-[#1F2937] tracking-tight">{t.memberManagement || 'จัดการข้อมูลสมาชิก'}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-mono font-bold">
              {members.length} {language === 'th' ? 'คน' : 'members'}
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            {language === 'th'
              ? 'ระบบค้นหาสมาชิกด้วยเบอร์โทรศัพท์ สะสมคะแนน (1 แต้ม ทุก ฿25) และให้ส่วนลดตามระดับสมาชิก'
              : 'Search members by phone number, reward points, and tier discounts.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs min-h-[44px] transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addMember || 'เพิ่มสมาชิกใหม่'}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={language === 'th' ? 'ค้นหาชื่อสมาชิก, เบอร์โทรศัพท์, รหัส...' : 'Search by name, phone or code...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-[#FED7AA] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-orange-500 min-h-[44px] shadow-xs"
        />
      </div>

      {/* Members Grid / Table */}
      <div className="bg-white border border-[#FED7AA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FFFBF5] border-b border-[#FED7AA] text-[#6B7280] font-bold">
              <tr>
                <th className="py-3 px-4">{t.memberCode || 'รหัส'}</th>
                <th className="py-3 px-3">{t.memberName || 'ชื่อสมาชิก'}</th>
                <th className="py-3 px-3">{t.phoneNumber || 'เบอร์โทรศัพท์'}</th>
                <th className="py-3 px-3">{t.tier || 'ระดับ'}</th>
                <th className="py-3 px-3">{t.points || 'แต้มสะสม'}</th>
                <th className="py-3 px-3">ยอดใช้จ่ายสะสม</th>
                <th className="py-3 px-3 text-right">{t.actions || 'จัดการ'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#6B7280]">
                    {language === 'th' ? 'ไม่พบข้อมูลสมาชิก' : 'No members found'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const tierColors: Record<string, string> = {
                    bronze: 'bg-stone-100 text-stone-800 border border-stone-300',
                    silver: 'bg-slate-100 text-slate-800 border border-slate-300',
                    gold: 'bg-amber-100 text-amber-900 border border-amber-300',
                    vip: 'bg-purple-100 text-purple-900 border border-purple-300',
                  };

                  return (
                    <tr key={m.id} className="hover:bg-orange-50/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">{m.code}</td>
                      <td className="py-3 px-3 font-bold text-[#1F2937]">
                        {m.name}
                        {(m.notes || m.note) && <div className="text-[10px] text-[#6B7280] font-normal">{m.notes || m.note}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#4B5563]">{m.phone}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tierColors[m.tier] || ''}`}>
                          {m.tier}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600">
                        {m.points} แต้ม
                      </td>
                      <td className="py-3 px-3 font-mono text-[#1F2937]">
                        {formatCurrency(m.totalSpent)} ({m.visitCount} ครั้ง)
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-[#6B7280] hover:text-[#1F2937] rounded-lg hover:bg-orange-50"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                            title="ลบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#FED7AA] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#FED7AA]">
              <h3 className="font-bold text-[#1F2937] text-sm">
                {editingMember ? 'แก้ไขข้อมูลสมาชิก' : t.addMember || 'เพิ่มสมาชิกใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6B7280] hover:text-[#1F2937]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1F2937] font-semibold mb-1">รหัสสมาชิก</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[#1F2937] font-semibold mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณสมชาย ใจดี"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[#1F2937] font-semibold mb-1">เบอร์โทรศัพท์ (ใช้ค้นหาตอนสั่งซื้อ) <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  required
                  placeholder="เช่น 0812345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] font-mono focus:outline-none focus:border-orange-500 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#1F2937] font-semibold mb-1">ระดับสมาชิก</label>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
                  >
                    <option value="bronze">Bronze (ทั่วไป)</option>
                    <option value="silver">Silver (เงิน)</option>
                    <option value="gold">Gold (ทอง)</option>
                    <option value="vip">VIP (พิเศษ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#1F2937] font-semibold mb-1">แต้มสะสม</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] font-mono focus:outline-none focus:border-orange-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#1F2937] font-semibold mb-1">บันทึกเพิ่มเติม (Notes)</label>
                <input
                  type="text"
                  placeholder="เช่น ชอบนั่งโต๊ะริมหน้าต่าง, ไม่ทานเนื้อวัว"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FFFBF5] border border-[#FED7AA] rounded-xl text-[#1F2937] focus:outline-none focus:border-orange-500 min-h-[44px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#FED7AA] text-[#6B7280] font-bold rounded-xl min-h-[44px]"
                >
                  {t.cancel || 'ยกเลิก'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs min-h-[44px]"
                >
                  {t.save || 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
