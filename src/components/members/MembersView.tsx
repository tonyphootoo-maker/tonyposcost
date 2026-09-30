import React, { useState, useEffect } from 'react';
import { Member } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Award,
  Phone,
  Sparkles,
  X,
  CreditCard,
  Gift,
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
    code: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
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
    setMembers(list);
  };

  const handleOpenAdd = () => {
    setEditingMember(null);
    setFormData({
      code: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
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
      tier: m.tier,
      notes: m.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ต้องการลบข้อมูลสมาชิก "${name}" หรือไม่?`)) return;
    await dbDelete('members', id);
    await loadMembers();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;

    const member: Member = {
      id: formData.id || `mem_${Date.now()}`,
      code: formData.code,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      points: formData.points,
      tier: formData.tier,
      totalSpent: editingMember ? editingMember.totalSpent : 0,
      visitCount: editingMember ? editingMember.visitCount : 0,
      notes: formData.notes.trim(),
      createdAt: editingMember ? editingMember.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbPut('members', member);
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
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-white tracking-tight">{t.memberManagement}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
              {members.length} {language === 'th' ? 'คน' : 'members'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {language === 'th'
              ? 'ระบบค้นหาสมาชิกด้วยเบอร์โทรศัพท์ สะสมคะแนน (1 แต้ม ทุก ฿50) และให้ส่วนลดตามระดับสมาชิก'
              : 'Search members by phone number, reward points, and tier discounts.'}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addMember}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
        <input
          type="text"
          placeholder={language === 'th' ? 'ค้นหาชื่อสมาชิก, เบอร์โทรศัพท์, รหัส...' : 'Search by name, phone or code...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Members Grid / Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-3 px-4">{t.memberCode}</th>
                <th className="py-3 px-3">{t.memberName}</th>
                <th className="py-3 px-3">{t.phoneNumber}</th>
                <th className="py-3 px-3">{t.tier}</th>
                <th className="py-3 px-3">{t.points}</th>
                <th className="py-3 px-3">ยอดใช้จ่ายสะสม</th>
                <th className="py-3 px-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    {language === 'th' ? 'ไม่พบข้อมูลสมาชิก' : 'No members found'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const tierColors: Record<string, string> = {
                    bronze: 'bg-neutral-800 text-neutral-300',
                    silver: 'bg-slate-800 text-slate-200 border border-slate-600',
                    gold: 'bg-amber-950 text-amber-300 border border-amber-700',
                    vip: 'bg-purple-950 text-purple-300 border border-purple-700',
                  };

                  return (
                    <tr key={m.id} className="hover:bg-neutral-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{m.code}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        {m.name}
                        {m.notes && <div className="text-[10px] text-neutral-500 font-normal">{m.notes}</div>}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-300">{m.phone}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tierColors[m.tier] || ''}`}>
                          {m.tier}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {m.points} แต้ม
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-200">
                        {formatCurrency(m.totalSpent)} ({m.visitCount} ครั้ง)
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="p-1.5 text-neutral-400 hover:text-rose-400 rounded hover:bg-neutral-800"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="font-bold text-white text-sm">
                {editingMember ? 'แก้ไขข้อมูลสมาชิก' : t.addMember}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">รหัสสมาชิก</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-amber-400 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณสมชาย ใจดี"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">เบอร์โทรศัพท์ *</label>
                <input
                  type="tel"
                  required
                  placeholder="0812345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">ระดับสมาชิก</label>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                    className="w-full px-2.5 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-bold"
                  >
                    <option value="bronze">Bronze (ทั่วไป)</option>
                    <option value="silver">Silver (ลด 5%)</option>
                    <option value="gold">Gold (ลด 10%)</option>
                    <option value="vip">VIP (ลด 15%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">แต้มสะสม</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">หมายเหตุ / ความชอบลูกค้า</label>
                <input
                  type="text"
                  placeholder="เช่น ทานเผ็ดปกติ, ชอบนั่งห้องแอร์"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded-lg"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
