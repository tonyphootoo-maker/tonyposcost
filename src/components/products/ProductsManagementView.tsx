import React, { useState, useEffect } from 'react';
import { Product, ProductCategory } from '../../types';
import { dbGetAll, dbPut, dbDelete } from '../../db';
import { useTranslation } from '../../i18n';
import { ProductMenuModal } from '../pos/ProductMenuModal';
import {
  Utensils,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Tag,
  CheckCircle,
  XCircle,
  FolderPlus,
} from 'lucide-react';

export const ProductsManagementView: React.FC = () => {
  const { t, language, formatCurrency } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  // Category management modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatNameTh, setNewCatNameTh] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pList, cList] = await Promise.all([
      dbGetAll<Product>('products'),
      dbGetAll<ProductCategory>('categories'),
    ]);
    setProducts(pList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    setCategories(cList.sort((a, b) => a.sortOrder - b.sortOrder));
  };

  const handleOpenAdd = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleEdit = (prod: Product) => {
    setProductToEdit(prod);
    setIsProductModalOpen(true);
  };

  const handleDelete = async (id: string, nameTh: string) => {
    if (!confirm(t.confirmDeleteMsg || `คุณต้องการลบ "${nameTh}" หรือไม่?`)) return;
    await dbDelete('products', id);
    loadData();
  };

  const handleToggleAvailability = async (prod: Product) => {
    const updated: Product = { ...prod, isAvailable: !prod.isAvailable };
    await dbPut('products', updated);
    loadData();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatNameTh.trim()) return;

    const newCategory: ProductCategory = {
      id: `cat_${Date.now()}`,
      nameTh: newCatNameTh.trim(),
      nameEn: newCatNameEn.trim() || newCatNameTh.trim(),
      icon: 'Utensils',
      color: '#f97316',
      sortOrder: categories.length + 1,
    };

    await dbPut('categories', newCategory);
    setNewCatNameTh('');
    setNewCatNameEn('');
    setIsCatModalOpen(false);
    loadData();
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`คุณต้องการลบหมวดหมู่ "${catName}" หรือไม่?`)) return;
    await dbDelete('categories', catId);
    loadData();
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nameTh.toLowerCase().includes(search.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'all' || p.categoryId === selectedCat;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#FED7AA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
            <Utensils className="w-6 h-6 text-orange-500" />
            <span>{t.navProducts || 'จัดการสินค้า POS และหมวดหมู่'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">
              {products.length} {t.all ? 'รายการ' : 'items'}
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            เพิ่ม แก้ไข และเชื่อมโยงสูตรอาหารเพื่อคำนวณต้นทุน กำไร และส่วนต่างราคาแบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="px-3.5 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-semibold rounded-xl text-xs min-h-[44px] flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>หมวดหมู่สินค้า</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addProduct || 'เพิ่มเมนูใหม่'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.search || 'ค้นหาชื่อสินค้า, เมนู...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FED7AA] rounded-xl text-sm text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-orange-500 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 bg-white p-1 rounded-xl border border-[#FED7AA]">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition ${
              selectedCat === 'all'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            {t.all || 'ทั้งหมด'}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition ${
                selectedCat === c.id
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#1F2937]'
              }`}
            >
              {language === 'th' ? c.nameTh : c.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-[#FED7AA] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FFFBF5] border-b border-[#FED7AA] text-[#6B7280] font-bold">
                <th className="p-3.5 w-12 text-center">รูป</th>
                <th className="p-3.5">ชื่อเมนู</th>
                <th className="p-3.5">หมวดหมู่</th>
                <th className="p-3.5 text-right">ราคาขาย</th>
                <th className="p-3.5 text-right">ต้นทุน/จาน</th>
                <th className="p-3.5 text-right">มาร์จิ้น (%)</th>
                <th className="p-3.5 text-center">สถานะ</th>
                <th className="p-3.5 text-center w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FED7AA]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-[#6B7280]">
                    {t.emptyState || 'ไม่พบรายการสินค้า'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const marginPct =
                    p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) : '0';

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="p-3 text-center">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.nameTh}
                            className="w-10 h-10 object-cover rounded-lg border border-[#FED7AA] mx-auto"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-orange-50 border border-orange-200 text-orange-400 rounded-lg flex items-center justify-center mx-auto">
                            <Utensils className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#1F2937] text-sm">{p.nameTh}</div>
                        <div className="text-[11px] text-[#6B7280]">{p.nameEn}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-[#FFFBF5] border border-[#FED7AA] text-[11px] text-[#1F2937] font-medium">
                          {cat ? (language === 'th' ? cat.nameTh : cat.nameEn) : '-'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-extrabold text-sm text-[#1F2937]">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="p-3 text-right font-semibold text-neutral-600">
                        {formatCurrency(p.cost)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600">
                        {marginPct}%
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleAvailability(p)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                            p.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}
                        >
                          {p.isAvailable ? 'พร้อมขาย' : 'สินค้าหมด'}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-neutral-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.nameTh)}
                            className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Edit / Add Modal */}
      {isProductModalOpen && (
        <ProductMenuModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          productToEdit={productToEdit}
          onSaved={() => {
            setIsProductModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Category Manager Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#FED7AA]">
              <h2 className="font-bold text-base text-[#1F2937] flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-orange-500" />
                <span>จัดการหมวดหมู่สินค้า</span>
              </h2>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ชื่อหมวดหมู่ (ภาษาไทย) *
                </label>
                <input
                  type="text"
                  required
                  value={newCatNameTh}
                  onChange={(e) => setNewCatNameTh(e.target.value)}
                  placeholder="เช่น กับข้าว, จานเดียว, เครื่องดื่ม"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] mb-1">
                  ชื่อหมวดหมู่ (English)
                </label>
                <input
                  type="text"
                  value={newCatNameEn}
                  onChange={(e) => setNewCatNameEn(e.target.value)}
                  placeholder="e.g. Main Dishes, Drinks"
                  className="w-full px-3 py-2 border border-[#FED7AA] rounded-xl text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                + เพิ่มหมวดหมู่
              </button>
            </form>

            <div className="pt-2">
              <div className="text-xs font-bold text-[#6B7280] mb-2">หมวดหมู่ที่มีอยู่:</div>
              <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-[#FED7AA]">
                {categories.map((c) => (
                  <div key={c.id} className="pt-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1F2937]">
                      {c.nameTh} ({c.nameEn})
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.nameTh)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
