import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { getMeta, catMeta } from "@/lib/catMeta";
import { uploadProductImage } from "@/lib/supabase";
import type { Product } from "@db/schema";

type Fields = Partial<Pick<Product, "mode" | "qty" | "packs" | "packSize" | "loose" | "orderQty">>;

const arNum = (n: number) => n.toLocaleString("ar-EG");

export default function Home() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const listQuery = trpc.inventory.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [selectedCat, setSelectedCat] = useState("ALL");

  const [promptId, setPromptId] = useState<number | null>(null);
  const [promptQty, setPromptQty] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (listQuery.data) setItems(listQuery.data);
  }, [listQuery.data]);

  const updateMut = trpc.inventory.update.useMutation({
    onError: () => {
      notify("تعذر الحفظ، تحقق من الاتصال");
      utils.inventory.list.invalidate();
    },
  });
  const addMut = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setShowAdd(false);
      notify("تمت إضافة المنتج بنجاح! 🎉");
    },
    onError: () => notify("تعذر إضافة المنتج (ربما الكود مكرر أو هناك مشكلة بالاتصال)"),
  });
  const resetMut = trpc.inventory.resetAll.useMutation({
    onError: () => {
      notify("تعذر التصفير");
      utils.inventory.list.invalidate();
    },
  });
  const editMut = trpc.inventory.edit.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setEditingProduct(null);
      notify("تم تعديل المنتج بنجاح");
    },
    onError: () => notify("تعذر تعديل المنتج (ربما الكود مكرر)")
  });
  const removeMut = trpc.inventory.remove.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      notify("تم حذف المنتج");
    },
    onError: () => notify("تعذر حذف المنتج")
  });
  const snapshotMut = trpc.inventory.saveSnapshot.useMutation({
    onSuccess: () => {
      utils.inventory.snapshots.invalidate();
      notify("تم حفظ الجرد بنجاح");
    },
    onError: () => notify("تعذر حفظ الجرد")
  });
  const snapshotsQuery = trpc.inventory.snapshots.useQuery(undefined, { enabled: showSnapshots });

  // Debounce direct typing; step buttons save immediately
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patch = (id: number, fields: Fields, debounce = false) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const run = () => updateMut.mutate({ id, ...fields });
    const key = `${id}:${Object.keys(fields).join(",")}`;
    if (debounce) {
      clearTimeout(debounceTimers.current.get(key));
      debounceTimers.current.set(key, setTimeout(run, 600));
    } else {
      clearTimeout(debounceTimers.current.get(key));
      run();
    }
  };

  const stepField = (p: Product, field: "qty" | "packs" | "loose", change: number) => {
    const next = Math.max(0, (p[field] ?? 0) + change);
    patch(p.id, { [field]: next } as Fields);
  };

  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category))), [items]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return items.filter((p) => {
      const mSearch =
        !term ||
        p.nameAr.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.code.includes(term);
      const mCat = selectedCat === "ALL" || p.category === selectedCat;
      const mUnit = unitFilter === "ALL" || p.unitCode === unitFilter;
      return mSearch && mCat && mUnit;
    });
  }, [items, search, selectedCat, unitFilter]);

  const orderedItems = items.filter((p) => p.orderQty != null && p.orderQty > 0);
  const promptProd = promptId != null ? items.find((p) => p.id === promptId) : undefined;

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed"; // Avoid scrolling to bottom
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      notify("تم نسخ قائمة الطلبات بنجاح! يمكنك لصقها في الواتساب الآن.");
    } catch (err) {
      notify("فشل النسخ التلقائي. يرجى نسخ النص يدوياً.");
    }
    document.body.removeChild(textarea);
  };

  const copyOrderText = () => {
    if (orderedItems.length === 0) {
      notify("القائمة فارغة!");
      return;
    }
    let text = "📋 قائمة طلبات بضاعة الغد:\n\n";
    orderedItems.forEach((p, i) => {
      text += `${i + 1}. [${p.code}] ${p.nameAr}\n   👈 الكمية المطلوبة: ${p.orderQty} (${p.unitLabel})\n\n`;
    });
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => notify("تم نسخ قائمة الطلبات بنجاح! يمكنك لصقها في الواتساب الآن."))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const printOrderPdf = () => {
    if (orderedItems.length === 0) {
      notify("القائمة فارغة!");
      return;
    }
    const rows = orderedItems.map((p, i) => `<tr><td>${i + 1}</td><td>${p.code}</td><td>${p.nameAr}</td><td>${p.orderQty} ${p.unitLabel}</td></tr>`).join("");
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      notify("اسمح بالنوافذ المنبثقة لإنشاء ملف PDF");
      return;
    }
    printWindow.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>قائمة طلبات دانكن</title><style>body{font-family:Arial;padding:32px;color:#172033}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #cbd5e1;padding:10px;text-align:right}th{background:#e2e8f0}</style></head><body><h1>قائمة طلبات بضاعة الغد</h1><table><thead><tr><th>#</th><th>الكود</th><th>المنتج</th><th>الكمية</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const saveSnapshot = (period: "weekly" | "monthly") => {
    snapshotMut.mutate({ period, data: JSON.stringify(items) });
  };

  if (listQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <i className="ph ph-package text-5xl animate-bounce text-blue-500"></i>
        <p className="font-bold">جاري تحميل المخزون من قاعدة البيانات...</p>
      </div>
    );
  }
  if (listQuery.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <i className="ph ph-warning-circle text-5xl text-red-500"></i>
        <p className="font-bold">تعذر الاتصال بقاعدة البيانات</p>
        <button
          onClick={() => listQuery.refetch()}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm modal-content-enter">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <i className="ph ph-package text-2xl"></i>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-slate-800 leading-none">إدارة وجرد المخزون</h1>
              <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                محفوظ سحابيًا — {items.length} صنف
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOrder(true)}
              className="relative bg-blue-50 text-blue-600 hover:bg-blue-100 px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 border border-blue-200 text-xs md:text-sm"
            >
              <i className="ph-bold ph-shopping-cart text-lg"></i> <span className="hidden sm:inline">قائمة الطلب</span>
              {orderedItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                  {orderedItems.length}
                </span>
              )}
            </button>
            <button onClick={() => saveSnapshot("weekly")} title="حفظ جرد أسبوعي" className="hidden md:flex w-10 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl items-center justify-center transition border border-emerald-200">
              <i className="ph-bold ph-calendar-check text-lg"></i>
            </button>
            <button onClick={() => saveSnapshot("monthly")} title="حفظ جرد شهري" className="hidden md:flex w-10 h-10 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl items-center justify-center transition border border-amber-200">
              <i className="ph-bold ph-calendar-blank text-lg"></i>
            </button>
            <button onClick={() => setShowSnapshots(true)} title="سجل الجرد" className="w-10 h-10 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl flex items-center justify-center transition border border-slate-200">
              <i className="ph-bold ph-clock-counter-clockwise text-lg"></i>
            </button>
            <button
              onClick={() => setShowReset(true)}
              title="تصفير كل الكميات"
              className="w-10 h-10 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl flex items-center justify-center transition border border-red-200"
            >
              <i className="ph-bold ph-trash text-lg"></i>
            </button>
            <button
              onClick={() => navigate("/admin")}
              className="bg-violet-50 text-violet-700 hover:bg-violet-100 px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 border border-violet-200 text-xs md:text-sm"
            >
              <i className="ph-bold ph-gear text-lg"></i> لوحة الإدارة
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="hidden sm:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-lg shadow-slate-900/20"
            >
              <i className="ph-bold ph-plus"></i> إضافة منتج
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="sm:hidden w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"
            >
              <i className="ph-bold ph-plus text-lg"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-3 md:p-6 border border-slate-200 shadow-sm mb-4 md:mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <i className="ph ph-magnifying-glass absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 text-xl"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم المنتج، الاسم بالعربي، أو بالإنجليزي..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm md:text-base"
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition appearance-none text-sm md:text-base"
            >
              <option value="ALL">جميع وحدات القياس</option>
              <option value="CTN">📦 كرتون (CTN)</option>
              <option value="PKT">📑 باكيت (PKT)</option>
              <option value="PCS">✨ حبة (PCS)</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-4 md:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max">
            <TabButton active={selectedCat === "ALL"} onClick={() => setSelectedCat("ALL")}>
              الكل{" "}
              <span className={`px-1.5 rounded-md ml-1 text-xs ${selectedCat === "ALL" ? "bg-white/20" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                {items.length}
              </span>
            </TabButton>
            {categories.map((cat) => {
              const meta = getMeta(cat);
              const count = items.filter((p) => p.category === cat).length;
              const active = selectedCat === cat;
              return (
                <TabButton key={cat} active={active} onClick={() => setSelectedCat(cat)}>
                  {meta.icon} {cat}{" "}
                  <span className={`px-1.5 py-0.5 rounded-md ml-1 text-[11px] ${active ? "bg-white/20" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                    {count}
                  </span>
                </TabButton>
              );
            })}
          </div>
        </div>

        {/* Results Status */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm md:text-base font-bold text-slate-800">المنتجات المسجلة في المخزون</h2>
          <span className="bg-blue-100 text-blue-800 py-0.5 px-2.5 rounded-full text-xs font-bold">{filtered.length}</span>
        </div>

        {/* Products Grid */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
            <i className="ph-duotone ph-package text-6xl mb-3 text-slate-300"></i>
            <h3 className="text-lg font-bold text-slate-700 mb-1">لا توجد نتائج مطابقة!</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                onPatch={patch}
                onStep={stepField}
                onOrder={(id) => {
                  const prod = items.find((x) => x.id === id);
                  setPromptQty(prod?.orderQty != null ? String(prod.orderQty) : "");
                  setPromptId(id);
                }}
                onEdit={setEditingProduct}
                onDelete={(id) => {
                  if (window.confirm("هل تريد حذف هذا المنتج نهائيًا؟")) removeMut.mutate({ id });
                }}
                onCopyCode={(code) => {
                  navigator.clipboard.writeText(code);
                  notify("تم نسخ الكود: " + code);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* MODAL: ORDER QTY PROMPT */}
      {promptProd && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setPromptId(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl relative modal-content-enter p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <i className="ph-bold ph-shopping-cart text-2xl"></i>
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">{promptProd.nameAr}</h3>
            <p className="text-slate-400 text-xs mb-4">
              الوحدة: {promptProd.unitLabel} (#{promptProd.code})
            </p>
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-2">أدخل الكمية المراد طلبها:</label>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={promptQty}
                onChange={(e) => setPromptQty(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="مثال: 3"
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-center text-xl font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition"
              />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setPromptId(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                إلغاء
              </button>
              <button
                onClick={() => {
                  const val = parseInt(promptQty, 10);
                  if (isNaN(val) || val <= 0) {
                    patch(promptProd.id, { orderQty: null });
                    notify("تمت إزالة المنتج من قائمة الطلبات.");
                  } else {
                    patch(promptProd.id, { orderQty: val });
                    notify(`تم تحديد الكمية (${val}) بنجاح! 🛒`);
                  }
                  setPromptId(null);
                }}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/30 text-sm"
              >
                حفظ في القائمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET WARNING */}
      {showReset && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setShowReset(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl relative modal-content-enter p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ph-bold ph-warning text-3xl"></i>
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">تصفير جميع الكميات؟</h3>
            <p className="text-slate-500 text-sm mb-6">هل أنت متأكد أنك تريد مسح وتصفير جميع الأرقام المدخلة في الجرد؟</p>
            <div className="flex gap-3">
              <button onClick={() => setShowReset(false)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition">
                إلغاء
              </button>
              <button
                onClick={() => {
                  setItems((prev) => prev.map((p) => ({ ...p, qty: null, packs: null, packSize: null, loose: null, orderQty: null })));
                  resetMut.mutate();
                  setShowReset(false);
                  notify("تم تصفير جميع الكميات");
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-600/30"
              >
                نعم، صَفِّر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {showAdd && (
        <AddProductModal
          categories={categories}
          existingCodes={items.map((p) => p.code)}
          onClose={() => setShowAdd(false)}
          onSave={(input) => addMut.mutate(input)}
          isLoading={addMut.isPending}
        />
      )}

      {editingProduct && (
        <AddProductModal
          title="تعديل المنتج"
          product={editingProduct}
          categories={categories}
          existingCodes={items.filter((p) => p.id !== editingProduct.id).map((p) => p.code)}
          onClose={() => setEditingProduct(null)}
          onSave={(input) => editMut.mutate({ id: editingProduct.id, ...input })}
          isLoading={editMut.isPending}
        />
      )}

      {showSnapshots && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setShowSnapshots(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative modal-content-enter flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
              <h3 className="text-lg font-extrabold text-slate-800">سجل الجرد الأسبوعي والشهري</h3>
              <button onClick={() => setShowSnapshots(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 border border-slate-200"><i className="ph-bold ph-x"></i></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              {(snapshotsQuery.data ?? []).length === 0 ? <p className="text-center text-slate-400 font-bold py-8">لا توجد جردات محفوظة</p> : snapshotsQuery.data?.map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between border border-slate-200 rounded-xl p-3">
                  <span className="font-bold text-slate-700">{snapshot.period === "weekly" ? "جرد أسبوعي" : "جرد شهري"}</span>
                  <span className="text-xs text-slate-400">{new Date(snapshot.capturedAt).toLocaleString("ar-EG")}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => saveSnapshot("weekly")} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl">حفظ أسبوعي</button>
              <button onClick={() => saveSnapshot("monthly")} className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-xl">حفظ شهري</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ORDER LIST */}
      {showOrder && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setShowOrder(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative modal-content-enter flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
              <h3 className="text-lg md:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <i className="ph-bold ph-shopping-cart"></i>
                </span>
                قائمة طلبات الغد
              </h3>
              <button onClick={() => setShowOrder(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-200 border border-slate-200 transition">
                <i className="ph-bold ph-x"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {orderedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  قائمة الطلبات فارغة حالياً. اضغط على أيقونة السلة (🛒) في أي منتج لتحديد الكمية المطلوبة!
                </div>
              ) : (
                orderedItems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">#{p.code}</span>
                        <span className="text-xs font-bold text-slate-500">{p.unitLabel}</span>
                      </div>
                      <h5 className="text-sm font-extrabold text-slate-800">{p.nameAr}</h5>
                      <p className="text-[11px] font-sans text-slate-400" dir="ltr">{p.nameEn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-100 text-amber-950 font-black px-3 py-1.5 rounded-xl text-sm font-sans">الطلب: {p.orderQty}</div>
                      <button
                        onClick={() => patch(p.id, { orderQty: null })}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition"
                        title="حذف"
                      >
                        <i className="ph-bold ph-trash text-base"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-white rounded-b-3xl">
              <button onClick={() => setShowOrder(false)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                إغلاق
              </button>
              <button onClick={copyOrderText} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-sm">
                <i className="ph-bold ph-copy"></i> نسخ القائمة للطلب
              </button>
              <button onClick={printOrderPdf} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm" title="طباعة أو حفظ PDF">
                <i className="ph-bold ph-file-pdf"></i> PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
        active
          ? "bg-slate-900 text-white shadow-md border border-transparent"
          : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({
  p,
  onPatch,
  onStep,
  onOrder,
  onEdit,
  onDelete,
  onCopyCode,
}: {
  p: Product;
  onPatch: (id: number, fields: Fields, debounce?: boolean) => void;
  onStep: (p: Product, field: "qty" | "packs" | "loose", change: number) => void;
  onOrder: (id: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  onCopyCode: (code: string) => void;
}) {
  const meta = getMeta(p.category);
  const isDetailed = p.mode === "detailed";
  const hasOrder = p.orderQty != null && p.orderQty > 0;

  const numInput = (
    field: "qty" | "packs" | "packSize" | "loose",
    w: string,
    extraCls: string,
    placeholder: string,
  ) => (
    <input
      type="number"
      inputMode="numeric"
      value={p[field] ?? ""}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.trim();
        onPatch(p.id, { [field]: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0) } as Fields, true);
      }}
      className={`card-input ${w} bg-white border text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none ${extraCls}`}
    />
  );

  const stepBtn = (field: "qty" | "packs" | "loose", change: number, cls: string, icon: string, big = false) => (
    <button
      onClick={() => onStep(p, field, change)}
      className={`${big ? "w-8 h-8 text-sm" : "w-7 h-7 text-xs"} rounded-lg font-bold flex items-center justify-center active:scale-95 transition ${cls}`}
    >
      <i className={`ph-bold ${icon}`}></i>
    </button>
  );

  const qtyVal = p.qty ?? 0;
  const packs = p.packs ?? 0;
  const packSize = p.packSize ?? 0;
  const loose = p.loose ?? 0;

  let total = 0;
  let formulaText = "";
  if (packs > 0 && packSize > 0) {
    total = packs * packSize + loose;
    formulaText = `(${packs} × ${packSize}) + ${loose}`;
  } else if (packs > 0) {
    total = loose;
    formulaText = "أدخل سعة الباكيت";
  } else {
    total = loose;
    formulaText = `${loose} حبة`;
  }

  return (
    <div className={`rounded-2xl p-3.5 md:p-4 border transition-all hover:shadow-lg group flex flex-col justify-between h-full ${meta.color} hover:border-blue-500/50 relative`}>
      <div>
        {p.imageUrl ? (
          <div className="mb-3 overflow-hidden rounded-2xl border border-black/10 bg-white/80 shadow-sm">
            <img src={p.imageUrl} alt={p.nameAr} className="h-28 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        ) : (
          <div className="mb-3 flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 text-slate-400">
            <i className="ph-bold ph-image text-3xl"></i>
          </div>
        )}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onCopyCode(p.code)} title="اضغط لنسخ الكود">
            <span className="text-xs font-mono font-black bg-white/90 border border-black/10 px-2 py-0.5 rounded-md text-slate-800 shadow-sm hover:bg-blue-50 transition">
              #{p.code}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md unit-badge-${p.unitCode} shadow-sm`}>{p.unitLabel}</span>
            <button
              onClick={() => onPatch(p.id, { mode: isDetailed ? "simple" : "detailed" })}
              title="تبديل طريقة الجرد"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-black/10 bg-white/90 hover:bg-white text-slate-600 flex items-center gap-0.5 transition shadow-sm"
            >
              <i className="ph-bold ph-arrows-clockwise text-blue-600"></i> {isDetailed ? "تفصيلي" : "بسيط"}
            </button>
            <button
              onClick={() => onOrder(p.id)}
              title="إضافة لقائمة الطلب"
              className={`text-xs px-2.5 py-1 rounded-md border transition ${
                hasOrder ? "bg-blue-600 text-white border-blue-600 shadow-sm font-bold" : "bg-white/90 text-slate-600 border-black/10 hover:bg-slate-100"
              }`}
            >
              <i className="ph-bold ph-shopping-cart text-sm"></i> {hasOrder ? p.orderQty : "طلب"}
            </button>
            <button onClick={() => onEdit(p)} title="تعديل المنتج" className="text-xs px-2 py-1 rounded-md border border-black/10 bg-white/90 text-slate-600 hover:bg-blue-50 transition">
              <i className="ph-bold ph-pencil-simple"></i>
            </button>
            <button onClick={() => onDelete(p.id)} title="حذف المنتج" className="text-xs px-2 py-1 rounded-md border border-red-200 bg-white/90 text-red-600 hover:bg-red-50 transition">
              <i className="ph-bold ph-trash"></i>
            </button>
          </div>
        </div>
        <h4 className="text-[14px] font-extrabold mb-0.5 leading-snug text-slate-900">{p.nameAr}</h4>
        <p className="text-[11px] font-sans font-semibold opacity-70 leading-tight line-clamp-1 mb-3" dir="ltr">
          {p.nameEn}
        </p>
      </div>

      <div className="mt-auto space-y-2 pt-2 border-t border-black/5">
        {!isDetailed ? (
          <>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-2 shadow-sm">
              <span className="text-xs font-bold text-slate-700 pr-1 flex items-center gap-1">
                <i className="ph-bold ph-tag text-blue-600 text-base"></i> العدد المتوفر ({p.unitLabel}):
              </span>
              <div className="flex items-center gap-1.5">
                {stepBtn("qty", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus", true)}
                {numInput("qty", "w-16 text-lg border-slate-300", "", "0")}
                {stepBtn("qty", 1, "bg-blue-600 hover:bg-blue-700 text-white shadow-sm", "ph-plus", true)}
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block leading-none">الرصيد الكلي</span>
                <span className="text-[10px] text-emerald-400 font-bold">جرد مباشر</span>
              </div>
              <span className="text-base font-black font-sans text-amber-300">
                {arNum(qtyVal)} <span className="text-[10px] text-white font-normal">{p.unitLabel}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-700 pr-1 flex items-center gap-1">
                <i className="ph-bold ph-package text-blue-600 text-sm"></i> عدد الباكيتات:
              </span>
              <div className="flex items-center gap-1">
                {stepBtn("packs", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus")}
                {numInput("packs", "w-14", "border-slate-300", "0")}
                {stepBtn("packs", 1, "bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600", "ph-plus")}
              </div>
            </div>
            <div className="flex items-center justify-between bg-amber-50/90 border border-amber-300/80 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-amber-900 pr-1 flex items-center gap-1">
                <i className="ph-bold ph-squares-four text-amber-600 text-sm"></i> حبات في الباكيت:
              </span>
              <div className="flex items-center pl-0.5">
                {numInput("packSize", "w-24", "border-amber-300 text-amber-900 placeholder:text-[11px] placeholder:font-normal focus:border-amber-500", "اكتب السعة")}
              </div>
            </div>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-700 pr-1 flex items-center gap-1">
                <i className="ph-bold ph-stack text-emerald-600 text-sm"></i> حبات مفرطة:
              </span>
              <div className="flex items-center gap-1">
                {stepBtn("loose", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus")}
                {numInput("loose", "w-14", "border-slate-300", "0")}
                {stepBtn("loose", 1, "bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600", "ph-plus")}
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block leading-none">الإجمالي الفعلي</span>
                <span className="text-[10px] text-amber-400 font-mono">{formulaText}</span>
              </div>
              <span className="text-base font-black font-sans text-amber-300">
                {arNum(total)} <span className="text-[10px] text-white font-normal">حبة</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AddProductModal({
  title = "إضافة منتج جديد",
  product,
  categories,
  existingCodes,
  onClose,
  onSave,
  isLoading,
}: {
  title?: string;
  product?: Product;
  categories: string[];
  existingCodes: string[];
  onClose: () => void;
  onSave: (input: {
    code: string;
    nameAr: string;
    nameEn: string;
    category: string;
    mode: "simple" | "detailed";
    unitCode: "CTN" | "PKT" | "PCS";
    unitLabel: string;
    imageUrl?: string | null;
  }) => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(product?.code ?? "");
  const [nameAr, setNameAr] = useState(product?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(product?.nameEn ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const allCategories = useMemo(() => {
    const predefined = Object.keys(catMeta);
    return Array.from(new Set([...predefined, ...categories]));
  }, [categories]);

  const [category, setCategory] = useState(product?.category ?? allCategories[0] ?? "عام");
  const [unitCode, setUnitCode] = useState<"CTN" | "PKT" | "PCS">(product?.unitCode ?? "CTN");
  const [mode, setMode] = useState<"simple" | "detailed">(product?.mode ?? "simple");

  const unitLabels = { CTN: "كرتون (CTN)", PKT: "باكيت (PKT)", PCS: "حبة (PCS)" } as const;

  const fieldCls =
    "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 transition-all outline-none text-base focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20";

  const isDuplicate = useMemo(() => {
    return existingCodes.includes(code.trim());
  }, [code, existingCodes]);

  const isNumeric = useMemo(() => {
    return /^\d+$/.test(code.trim());
  }, [code]);

  const codeError = useMemo(() => {
    if (!code.trim()) return null;
    if (!isNumeric) return "الكود يجب أن يحتوي على أرقام فقط";
    if (isDuplicate) return "هذا الكود مستخدم بالفعل لمنتج آخر";
    return null;
  }, [code, isNumeric, isDuplicate]);

  const valid = code.trim() && nameAr.trim() && nameEn.trim() && isNumeric && !isDuplicate;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={isLoading ? undefined : onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative modal-content-enter flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
          <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <i className="ph-bold ph-plus"></i>
            </span>
            {title}
          </h3>
          <button onClick={onClose} disabled={isLoading} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50">
            <i className="ph-bold ph-x"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              رقم المنتج (الكود) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="مثال: 13011011"
              disabled={isLoading}
              className={`${fieldCls} font-sans ${codeError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""}`}
              dir="ltr"
            />
            {codeError && (
              <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
                <i className="ph-bold ph-warning-circle"></i>
                {codeError}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              اسم المنتج (عربي) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: أكياس تسوق دانكن" disabled={isLoading} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              اسم المنتج (إنجليزي) <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Shopping Bags" disabled={isLoading} className={fieldCls + " font-sans"} dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              صورة المنتج (اختياري)
            </label>
            <div className="space-y-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/product.jpg"
                disabled={isLoading || isUploading}
                className={fieldCls + " font-sans"}
                dir="ltr"
              />
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setIsUploading(true);
                      setUploadError(null);
                      const publicUrl = await uploadProductImage(file);
                      setImageUrl(publicUrl);
                    } catch (error) {
                      setUploadError(error instanceof Error ? error.message : "تعذر رفع الصورة");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                <i className="ph-bold ph-upload-simple"></i>
                {isUploading ? "جاري رفع الصورة..." : "رفع من المعرض"}
              </label>
              {uploadError && <p className="text-xs font-bold text-red-500">{uploadError}</p>}
            </div>
            {imageUrl.trim() && (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                <img src={imageUrl} alt="Product preview" className="h-24 w-full object-cover rounded-lg" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              تصنيف المجموعة <span className="text-red-500">*</span>
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isLoading} className={fieldCls}>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {getMeta(c).icon} {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              نوع الوحدة <span className="text-red-500">*</span>
            </label>
            <select value={unitCode} onChange={(e) => setUnitCode(e.target.value as typeof unitCode)} disabled={isLoading} className={fieldCls}>
              <option value="CTN">كرتون (CTN)</option>
              <option value="PKT">باكيت (PKT)</option>
              <option value="PCS">حبة (PCS)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              طريقة الجرد الافتراضية <span className="text-red-500">*</span>
            </label>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={isLoading} className={fieldCls}>
              <option value="simple">جرد بسيط ومباشر (كرتون أو حبة فقط)</option>
              <option value="detailed">جرد مركب تفصيلي (باكيتات + حبات مفرطة)</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 bg-white rounded-b-3xl">
          <button onClick={onClose} disabled={isLoading} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold py-3.5 rounded-xl transition">
            إلغاء
          </button>
          <button
            disabled={!valid || isLoading}
            onClick={() => onSave({ code: code.trim(), nameAr: nameAr.trim(), nameEn: nameEn.trim(), category, mode, unitCode, unitLabel: unitLabels[unitCode], imageUrl: imageUrl.trim() || null })}
            className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <i className="ph-bold ph-check"></i>
            )}
            حفظ المنتج
          </button>
        </div>
      </div>
    </div>
  );
}
