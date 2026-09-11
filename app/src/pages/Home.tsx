import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { getMeta, catMeta } from "@/lib/catMeta";
import { uploadProductImage } from "@/lib/supabase";
import type { Product } from "@db/schema";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { ProductStockHistoryModal } from "@/components/ProductStockHistoryModal";
import { GoodsReceivingModal } from "@/components/GoodsReceivingModal";
import { BranchTransferModal } from "@/components/BranchTransferModal";

type Fields = Partial<Pick<Product, "mode" | "qty" | "packs" | "packSize" | "loose" | "orderQty">>;

const arNum = (n: number) => n.toLocaleString("ar-EG");

export default function Home() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { lang, toggleLang, t, getProductName, getCategoryName, getUnitName, getBranchName, getEmployeeName } = useLanguage();
  const { session, logout, selectedBranch, setSelectedBranch, branchesList, sendAdminSubmission } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const listQuery = trpc.inventory.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [selectedCat, setSelectedCat] = useState("ALL");

  const [promptId, setPromptId] = useState<number | null>(null);
  const [promptQty, setPromptQty] = useState("");
  const [promptUnit, setPromptUnit] = useState<"CTN" | "PKT" | "PCS">("CTN");
  const [orderUnits, setOrderUnits] = useState<Record<number, "CTN" | "PKT" | "PCS">>(() => {
    try {
      const saved = localStorage.getItem("dunkin_order_units");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("dunkin_order_units", JSON.stringify(orderUnits));
    } catch {}
  }, [orderUnits]);

  const [showReset, setShowReset] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const transfersQuery = trpc.inventory.listTransfers.useQuery(
    { branchCode: selectedBranch || session?.branch_code },
    { refetchInterval: 15000, enabled: !!session }
  );

  const pendingTransfersCount = useMemo(() => {
    if (!transfersQuery.data) return 0;
    const currentBranch = selectedBranch || session?.branch_code;
    return transfersQuery.data.filter((t) => {
      if (t.toBranchCode === currentBranch && t.status === "in_transit") return true;
      if (t.fromBranchCode === currentBranch && t.status === "approved_by_admin") return true;
      return false;
    }).length;
  }, [transfersQuery.data, selectedBranch, session?.branch_code]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const getSelectedOrderUnitLabel = (id: number, fallbackUnitCode?: string, fallbackUnitLabel?: string) => {
    const u = orderUnits[id];
    if (u === "CTN") return lang === "en" ? "Carton 📦" : "كرتون 📦";
    if (u === "PKT") return lang === "en" ? "Packet 🗂️" : "باكت 🗂️";
    if (u === "PCS") return lang === "en" ? "Piece 낱" : "حبة 낱";
    return getUnitName(fallbackUnitCode, fallbackUnitLabel);
  };

  useEffect(() => {
    if (listQuery.data) setItems(listQuery.data);
  }, [listQuery.data]);

  const updateMut = trpc.inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
    },
    onError: () => {
      notify(lang === "en" ? "Failed to save, check connection" : "تعذر الحفظ، تحقق من الاتصال");
      utils.inventory.list.invalidate();
    },
  });
  const resetMut = trpc.inventory.resetAll.useMutation({
    onError: () => {
      notify(lang === "en" ? "Failed to reset" : "تعذر التصفير");
      utils.inventory.list.invalidate();
    },
  });
  const snapshotMut = trpc.inventory.saveSnapshot.useMutation({
    onSuccess: () => {
      utils.inventory.snapshots.invalidate();
      notify(lang === "en" ? "Inventory saved successfully" : "تم حفظ الجرد بنجاح");
    },
    onError: () => notify(lang === "en" ? "Failed to save inventory" : "تعذر حفظ الجرد")
  });
  const snapshotsQuery = trpc.inventory.snapshots.useQuery(undefined, { enabled: showSnapshots });

  // Debounce direct typing; step buttons save immediately
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patch = (id: number, fields: Fields, debounce = false) => {
    const empName = session?.full_name || (session?.employee_id ? `موظف #${session.employee_id}` : "موظف الفرع");
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const run = () => updateMut.mutate({ id, updatedBy: empName, branchCode: selectedBranch, ...fields });
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
      const catEn = getCategoryName(p.category).toLowerCase();
      const mSearch =
        !term ||
        p.nameAr.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        catEn.includes(term) ||
        p.code.includes(term);
      const mCat = selectedCat === "ALL" || p.category === selectedCat;
      const mUnit = unitFilter === "ALL" || p.unitCode === unitFilter;
      return mSearch && mCat && mUnit;
    });
  }, [items, search, selectedCat, unitFilter, getCategoryName]);

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
      notify(t("copySuccess"));
    } catch (err) {
      notify(t("copyFail"));
    }
    document.body.removeChild(textarea);
  };

  const handleSendOrderToAdmin = async () => {
    if (orderedItems.length === 0) {
      notify(t("orderListEmpty"));
      return;
    }
    const empName = session?.full_name || (lang === "en" ? "Branch Employee" : "موظف الفرع");
    const empId = session?.employee_id || "#101";
    const bCode = selectedBranch || session?.branch_code || "1011125";
    const bObj = branchesList.find((b) => b.branch_code === bCode);
    const bName = bObj ? bObj.branch_name : `فرع ${bCode}`;

    const res = await sendAdminSubmission({
      type: "cargo_order",
      title: lang === "en" ? "Warehouse Cargo Order" : "طلب بضاعة مستودع",
      employee_name: empName,
      employee_id: empId,
      branch_code: bCode,
      branch_name: bName,
      details: {
        item_count: orderedItems.length,
        items: orderedItems.map((p) => ({
          code: p.code,
          nameAr: p.nameAr,
          nameEn: p.nameEn ?? undefined,
          qty: p.orderQty ?? 0,
          unit: getSelectedOrderUnitLabel(p.id, p.unitCode, p.unitLabel),
        })),
      },
    });

    notify(res.message);
    setShowOrder(false);
  };

  const copyOrderText = () => {
    if (orderedItems.length === 0) {
      notify(t("orderListEmpty"));
      return;
    }
    let text = lang === "en" ? "📋 Next Day Cargo Order List:\n\n" : "📋 قائمة طلبات بضاعة الغد:\n\n";
    orderedItems.forEach((p, i) => {
      const pName = getProductName(p);
      const uName = getSelectedOrderUnitLabel(p.id, p.unitCode, p.unitLabel);
      text += `${i + 1}. [${p.code}] ${pName}\n   👈 ${t("requestedQty")}: ${p.orderQty} (${uName})\n\n`;
    });
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => notify(t("copySuccess")))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const printOrderPdf = () => {
    if (orderedItems.length === 0) {
      notify(t("orderListEmpty"));
      return;
    }
    const rows = orderedItems.map((p, i) => `<tr><td>${i + 1}</td><td>${p.code}</td><td><b>${getProductName(p)}</b></td><td>${p.orderQty} ${getSelectedOrderUnitLabel(p.id, p.unitCode, p.unitLabel)}</td></tr>`).join("");
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      notify(lang === "en" ? "Allow popups to generate PDF" : "اسمح بالنوافذ المنبثقة لإنشاء ملف PDF");
      return;
    }
    printWindow.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${t("nextDayOrder")}</title><style>body{font-family:sans-serif;padding:32px;color:#172033}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #cbd5e1;padding:10px;text-align:${lang === 'ar' ? 'right' : 'left'}}th{background:#e2e8f0}</style></head><body><h1>${t("nextDayOrder")}</h1><table><thead><tr><th>#</th><th>${t("code")}</th><th>${t("productCatalog")}</th><th>${t("qty")}</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
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
        <p className="font-bold">{lang === "en" ? "Loading inventory data..." : "جاري تحميل المخزون من قاعدة البيانات..."}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

        {/* Top Floating Language Switcher */}
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={toggleLang}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-amber-400 font-extrabold border border-slate-700/60 shadow-xl backdrop-blur-md transition text-xs md:text-sm hover:scale-105"
          >
            <i className="ph-bold ph-globe text-base"></i>
            <span>{lang === "ar" ? "English (LTR)" : "العربية (RTL)"}</span>
          </button>
        </div>

        <div className="z-10 w-full max-w-md">
          <AuthModal isOpen={true} onClose={() => {}} allowClose={false} />
        </div>
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <i className="ph ph-warning-circle text-5xl text-red-500"></i>
        <p className="font-bold">{lang === "en" ? "Database connection error" : "تعذر الاتصال بقاعدة البيانات"}</p>
        <button
          onClick={() => listQuery.refetch()}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold"
        >
          {lang === "en" ? "Retry" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" dir={lang === "ar" ? "rtl" : "ltr"}>
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
              <h1 className="text-lg md:text-xl font-extrabold text-slate-800 leading-none">{t("appTitle")}</h1>
              <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{selectedBranch} — {items.length} {t("items")} ({lang === "en" ? "Full Count" : "عدد كامل"})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Branch Switcher Dropdown */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
              <i className="ph-bold ph-storefront text-slate-500 text-base"></i>
              <span className="text-[11px] text-slate-500 font-normal">{lang === "en" ? "Branch:" : "الفرع:"}</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent border-none outline-none font-black text-xs cursor-pointer text-slate-900"
                title={lang === "en" ? "Select Branch" : "اختر الفرع لعرض المنتجات بالكامل"}
              >
                {branchesList.map((b) => (
                  <option key={b.branch_code} value={b.branch_code}>
                    {b.branch_code} - {getBranchName(b.branch_code, b.branch_name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Toggle Button */}
            <button
              onClick={toggleLang}
              title={t("langTitle")}
              className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-xl font-extrabold transition flex items-center gap-1.5 shadow-md text-xs md:text-sm"
            >
              <i className="ph-bold ph-globe text-lg"></i>
              <span>{t("langBtn")}</span>
            </button>

            {/* Order Cart Button */}
            <button
              onClick={() => setShowOrder(true)}
              className="relative bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 border border-blue-200 text-xs md:text-sm"
            >
              <i className="ph-bold ph-shopping-cart text-lg"></i> <span className="hidden sm:inline">{t("orderList")}</span>
              {orderedItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                  {orderedItems.length}
                </span>
              )}
            </button>

            {/* Goods Receiving & Stock Inflow Button */}
            <button
              id="btn-goods-receiving"
              onClick={() => {
                if (orderedItems.length === 0) {
                  notify(lang === "en" ? "No pending ordered products to receive. Add items to order first or select products!" : "لا توجد بضاعة في قائمة الطلبات لاستلامها حالياً! حدد كميات الطلب أولاً.");
                  setShowOrder(true);
                } else {
                  setShowReceivingModal(true);
                }
              }}
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-xl font-black transition flex items-center gap-1.5 border border-emerald-300 text-xs md:text-sm shadow-sm"
              title={lang === "en" ? "Receive and Confirm Delivery into Stock" : "استلام المنتجات وتوريد المخزون"}
            >
              <i className="ph-bold ph-package-receive text-lg text-emerald-600"></i>
              <span>{lang === "en" ? "Receive Goods" : "استلام المنتجات"}</span>
              {orderedItems.length > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                  {orderedItems.length}
                </span>
              )}
            </button>

            {/* Branch Transfer Workflow Button */}
            <button
              id="btn-branch-transfers"
              onClick={() => setShowTransferModal(true)}
              className="relative bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-xl font-black transition flex items-center gap-1.5 border border-indigo-200 text-xs md:text-sm shadow-sm"
              title={lang === "en" ? "Inter-Branch Transfer Requests & Inflow" : "طلب بضاعة من فرع آخر / تحويلات الفروع"}
            >
              <i className="ph-bold ph-arrows-left-right text-lg text-indigo-600"></i>
              <span className="hidden sm:inline">{lang === "en" ? "Branch Transfers" : "طلب من فرع"}</span>
              <span className="sm:hidden">{lang === "en" ? "Transfers" : "تحويلات"}</span>
              {pendingTransfersCount > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingTransfersCount}
                </span>
              )}
            </button>

            {/* Operational Audit Button */}
            <button
              id="btn-go-audit"
              onClick={() => navigate("/audit")}
              className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 border border-orange-200 text-xs md:text-sm"
              title={t("operationalAudit")}
            >
              <i className="ph-bold ph-clipboard-text text-lg"></i>
              <span className="hidden sm:inline">{t("operationalAudit")}</span>
            </button>

            {/* Admin Panel Button — STRICTLY FOR ADMIN ONLY */}
            {session?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/30 text-xs md:text-sm animate-in fade-in"
              >
                <i className="ph-bold ph-shield-check text-lg"></i>
                <span>{t("adminPanel")}</span>
              </button>
            )}

            {/* Employee Login / Session Badge */}
            {session ? (
              session.role === "admin" ? (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-900 shadow-sm">
                  <i className="ph-bold ph-shield-check text-lg text-purple-600"></i>
                  <div className="flex flex-col leading-tight">
                    <span className="font-extrabold text-purple-950">{getEmployeeName(session.full_name)}</span>
                    <span className="text-[10px] text-purple-600 font-mono">#{session.employee_id} [{session.branch_code}]</span>
                  </div>
                  <button
                    onClick={logout}
                    title={lang === "en" ? "Logout" : "تسجيل الخروج"}
                    className="mr-1 text-slate-400 hover:text-red-600 transition"
                  >
                    <i className="ph-bold ph-sign-out text-base"></i>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 shadow-sm">
                  <i className="ph-bold ph-user-circle text-lg text-emerald-600"></i>
                  <div className="flex flex-col leading-tight">
                    <span className="font-extrabold">{getEmployeeName(session.full_name)}</span>
                    <span className="text-[10px] text-emerald-600 font-mono">[{session.branch_code}] #{session.employee_id}</span>
                  </div>
                  <button
                    onClick={logout}
                    title={lang === "en" ? "Logout" : "تسجيل الخروج"}
                    className="mr-1 text-slate-400 hover:text-red-600 transition"
                  >
                    <i className="ph-bold ph-sign-out text-base"></i>
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-3 md:p-6 border border-slate-200 shadow-sm mb-4 md:mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <i className={`ph ph-magnifying-glass absolute top-1/2 ${lang === 'ar' ? 'right-4' : 'left-4'} -translate-y-1/2 text-slate-400 text-xl`}></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition text-sm md:text-base`}
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition appearance-none text-sm md:text-base"
            >
              <option value="ALL">{t("allUnits")}</option>
              <option value="CTN">📦 CTN ({lang === 'ar' ? 'كرتون' : 'Carton'})</option>
              <option value="PKT">📑 PKT ({lang === 'ar' ? 'باكيت' : 'Packet'})</option>
              <option value="PCS">✨ PCS ({lang === 'ar' ? 'حبة' : 'Piece'})</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-4 md:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max">
            <TabButton active={selectedCat === "ALL"} onClick={() => setSelectedCat("ALL")}>
              {t("allCategories")}{" "}
              <span className={`px-1.5 rounded-md ml-1 text-xs ${selectedCat === "ALL" ? "bg-white/20" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                {items.length}
              </span>
            </TabButton>
            {categories.map((cat) => {
              const meta = getMeta(cat);
              const count = items.filter((p) => p.category === cat).length;
              const active = selectedCat === cat;
              const catName = getCategoryName(cat);
              return (
                <TabButton key={cat} active={active} onClick={() => setSelectedCat(cat)}>
                  {meta.icon} {catName}{" "}
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
          <h2 className="text-sm md:text-base font-bold text-slate-800">{t("productCatalog")}</h2>
          <span className="bg-blue-100 text-blue-800 py-0.5 px-2.5 rounded-full text-xs font-bold">{filtered.length}</span>
        </div>

        {/* Products Grid */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
            <i className="ph-duotone ph-package text-6xl mb-3 text-slate-300"></i>
            <h3 className="text-lg font-bold text-slate-700 mb-1">{t("searchNoResults")}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                orderUnit={orderUnits[p.id]}
                onPatch={patch}
                onStep={stepField}
                onOrder={(id) => {
                  const prod = items.find((x) => x.id === id);
                  setPromptQty(prod?.orderQty != null ? String(prod.orderQty) : "");
                  setPromptUnit(orderUnits[id] || (prod?.unitCode as any) || "CTN");
                  setPromptId(id);
                }}
                onCopyCode={(code) => {
                  navigator.clipboard.writeText(code);
                  notify((lang === 'en' ? 'Code copied: ' : 'تم نسخ الكود: ') + code);
                }}
                onOpenHistory={(prod) => setHistoryProduct(prod)}
              />
            ))}
          </div>
        )}
      </main>


      {/* MODAL: ORDER QTY & UNIT PROMPT */}
      {promptProd && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setPromptId(null)}>
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl relative modal-content-enter p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <i className="ph-bold ph-shopping-cart text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1 leading-snug">{getProductName(promptProd)}</h3>
            <p className="text-slate-400 text-xs mb-3 font-mono">
              #{promptProd.code} • {lang === "en" ? "Catalog Unit:" : "الوحدة الأساسية:"} {getUnitName(promptProd.unitCode, promptProd.unitLabel)}
            </p>

            {/* UNIT SELECTOR: كرتون / باكت / حبة */}
            <div className="mb-4 text-right" dir={lang === "ar" ? "rtl" : "ltr"}>
              <label className="block text-xs font-black text-slate-700 mb-2">
                {lang === "en" ? "Choose Order Unit:" : "اختر وحدة الطلب (كرتون / باكت / حبة):"}
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPromptUnit("CTN")}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 ${
                    promptUnit === "CTN"
                      ? "bg-white text-blue-700 shadow-md shadow-blue-500/10 border border-blue-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <i className="ph-bold ph-package text-base"></i>
                  <span>{lang === "en" ? "Carton" : "كرتون"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPromptUnit("PKT")}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 ${
                    promptUnit === "PKT"
                      ? "bg-white text-amber-700 shadow-md shadow-amber-500/10 border border-amber-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <i className="ph-bold ph-squares-four text-base"></i>
                  <span>{lang === "en" ? "Packet" : "باكت"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPromptUnit("PCS")}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 ${
                    promptUnit === "PCS"
                      ? "bg-white text-emerald-700 shadow-md shadow-emerald-500/10 border border-emerald-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <i className="ph-bold ph-circle text-base"></i>
                  <span>{lang === "en" ? "Piece / Loose" : "حبة / مفرط"}</span>
                </button>
              </div>
            </div>

            <div className="mb-5 text-right" dir={lang === "ar" ? "rtl" : "ltr"}>
              <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center justify-between">
                <span>{lang === "en" ? "Quantity to Order:" : "الكمية المطلوبة:"}</span>
                <span className="text-[11px] font-bold text-blue-600">
                  {promptUnit === "CTN" ? (lang === "en" ? "in Cartons" : "بالكرتون 📦") : promptUnit === "PKT" ? (lang === "en" ? "in Packets" : "بالباكت 🗂️") : (lang === "en" ? "in Pieces" : "بالحبة 낱")}
                </span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={promptQty}
                onChange={(e) => setPromptQty(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={lang === "en" ? "e.g. 3" : "مثال: 3"}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-center text-xl font-black outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition font-mono"
              />
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setPromptId(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  const val = parseInt(promptQty, 10);
                  if (isNaN(val) || val <= 0) {
                    patch(promptProd.id, { orderQty: null });
                    setOrderUnits((prev) => {
                      const next = { ...prev };
                      delete next[promptProd.id];
                      return next;
                    });
                    notify(lang === "en" ? "Item removed from order list." : "تمت إزالة المنتج من قائمة الطلبات.");
                  } else {
                    patch(promptProd.id, { orderQty: val });
                    setOrderUnits((prev) => ({ ...prev, [promptProd.id]: promptUnit }));
                    const unitTitle = promptUnit === "CTN" ? (lang === "en" ? "Cartons" : "كرتون") : promptUnit === "PKT" ? (lang === "en" ? "Packets" : "باكت") : (lang === "en" ? "Pieces" : "حبة");
                    notify(lang === "en" ? `Ordered: ${val} ${unitTitle}! 🛒` : `تم تحديد الطلب: ${val} ${unitTitle}! 🛒`);
                  }
                  setPromptId(null);
                }}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl transition shadow-lg shadow-blue-600/30 text-sm flex items-center justify-center gap-1.5"
              >
                <i className="ph-bold ph-check"></i>
                <span>{lang === "en" ? "Save to List" : "حفظ في القائمة"}</span>
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
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">
              {lang === "en" ? "Reset All Quantities?" : "تصفير جميع الكميات؟"}
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              {lang === "en" ? "Are you sure you want to clear and reset all inventory numbers?" : "هل أنت متأكد أنك تريد مسح وتصفير جميع الأرقام المدخلة في الجرد؟"}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowReset(false)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition">
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  setItems((prev) => prev.map((p) => ({ ...p, qty: null, packs: null, packSize: null, loose: null, orderQty: null })));
                  resetMut.mutate();
                  setShowReset(false);
                  notify(lang === "en" ? "All quantities reset" : "تم تصفير جميع الكميات");
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-600/30"
              >
                {lang === "en" ? "Yes, Reset" : "نعم، صَفِّر"}
              </button>
            </div>
          </div>
        </div>
      )}



      {showSnapshots && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" onClick={() => setShowSnapshots(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative modal-content-enter flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
              <h3 className="text-lg font-extrabold text-slate-800">
                {lang === "en" ? "Weekly & Monthly Audit History" : "سجل الجرد الأسبوعي والشهري"}
              </h3>
              <button onClick={() => setShowSnapshots(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 border border-slate-200"><i className="ph-bold ph-x"></i></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              {(snapshotsQuery.data ?? []).length === 0 ? (
                <p className="text-center text-slate-400 font-bold py-8">
                  {lang === "en" ? "No saved audits" : "لا توجد جردات محفوظة"}
                </p>
              ) : snapshotsQuery.data?.map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between border border-slate-200 rounded-xl p-3">
                  <span className="font-bold text-slate-700">
                    {snapshot.period === "weekly" ? (lang === "en" ? "Weekly Audit" : "جرد أسبوعي") : (lang === "en" ? "Monthly Audit" : "جرد شهري")}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(snapshot.capturedAt).toLocaleString(lang === "en" ? "en-US" : "ar-EG")}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => saveSnapshot("weekly")} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl">
                {lang === "en" ? "Save Weekly" : "حفظ أسبوعي"}
              </button>
              <button onClick={() => saveSnapshot("monthly")} className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-xl">
                {lang === "en" ? "Save Monthly" : "حفظ شهري"}
              </button>
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
                {t("nextDayOrder")}
              </h3>
              <button onClick={() => setShowOrder(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-200 border border-slate-200 transition">
                <i className="ph-bold ph-x"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {orderedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  {lang === "en" ? "Order list is currently empty. Click on cart (🛒) icon on any product to set order quantity!" : "قائمة الطلبات فارغة حالياً. اضغط على أيقونة السلة (🛒) في أي منتج لتحديد الكمية المطلوبة!"}
                </div>
              ) : (
                orderedItems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">#{p.code}</span>
                        <span className="text-xs font-bold text-slate-500">{getUnitName(p.unitCode, p.unitLabel)}</span>
                      </div>
                      <h5 className="text-sm font-extrabold text-slate-800">{getProductName(p)}</h5>
                      <p className="text-[11px] font-sans text-slate-400" dir="ltr">{lang === "en" ? p.nameAr : p.nameEn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-100 text-amber-950 font-black px-3 py-1.5 rounded-xl text-sm font-sans flex items-center gap-1.5 shadow-sm">
                        <span>{lang === "en" ? `Order: ${p.orderQty}` : `الطلب: ${p.orderQty}`}</span>
                        <span className="text-xs bg-amber-200/90 text-amber-900 px-2 py-0.5 rounded-lg font-bold">
                          {getSelectedOrderUnitLabel(p.id, p.unitCode, p.unitLabel)}
                        </span>
                      </div>
                      <button
                        onClick={() => patch(p.id, { orderQty: null })}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition"
                        title={lang === "en" ? "Remove" : "حذف"}
                      >
                        <i className="ph-bold ph-trash text-base"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-wrap gap-2 bg-white rounded-b-3xl">
              <button onClick={() => setShowOrder(false)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl transition text-xs">
                {t("cancel")}
              </button>
              <button onClick={copyOrderText} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-1 text-xs">
                <i className="ph-bold ph-copy"></i> {t("copySuccess").replace("!", "")}
              </button>
              <button
                onClick={() => {
                  setShowOrder(false);
                  setShowReceivingModal(true);
                }}
                className="flex-[1.4] bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 text-xs"
                title={lang === "en" ? "Check arrived products and intake to stock" : "فحص المنتجات الواصلة وتوريدها للمخزون"}
              >
                <i className="ph-bold ph-package-receive text-base"></i> {lang === "en" ? "Receive Now 📥" : "استلام المنتجات 📥"}
              </button>
              <button onClick={handleSendOrderToAdmin} className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 text-xs">
                <i className="ph-bold ph-paper-plane-tilt text-sm"></i> {lang === "en" ? "Send to Admin 🚀" : "إرسال للأدمن 🚀"}
              </button>
              <button onClick={printOrderPdf} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1 text-xs" title="PDF">
                <i className="ph-bold ph-file-pdf"></i> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goods Receiving & Stock Intake Modal */}
      {showReceivingModal && (
        <GoodsReceivingModal
          isOpen={showReceivingModal}
          onClose={() => setShowReceivingModal(false)}
          orderItems={orderedItems.map((p) => ({
            id: p.id,
            code: p.code,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            orderQty: p.orderQty ?? 1,
            unitLabel: getSelectedOrderUnitLabel(p.id, p.unitCode, p.unitLabel),
            unitCode: orderUnits[p.id] || p.unitCode,
          }))}
          onSuccess={() => {
            notify(lang === "en" ? "Stock successfully received and updated! 🟢" : "تم استلام البضاعة وتوريد الكميات للمخزون بنجاح! 🟢");
          }}
        />
      )}

      {/* Employee Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Product Stock History & Last Update Modal */}
      {historyProduct && (
        <ProductStockHistoryModal
          product={historyProduct}
          branchCode={selectedBranch}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {/* Inter-Branch Transfer Modal */}
      {showTransferModal && (
        <BranchTransferModal
          isOpen={showTransferModal}
          onClose={() => {
            setShowTransferModal(false);
            transfersQuery.refetch();
            utils.inventory.list.invalidate();
          }}
        />
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
  orderUnit,
  onPatch,
  onStep,
  onOrder,
  onCopyCode,
  onOpenHistory,
}: {
  p: Product;
  orderUnit?: "CTN" | "PKT" | "PCS";
  onPatch: (id: number, fields: Fields, debounce?: boolean) => void;
  onStep: (p: Product, field: "qty" | "packs" | "loose", change: number) => void;
  onOrder: (id: number) => void;
  onCopyCode: (code: string) => void;
  onOpenHistory: (p: Product) => void;
}) {
  const { lang, getProductName, getUnitName, t } = useLanguage();
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
    formulaText = t("writeCapacity");
  } else {
    total = loose;
    formulaText = `${loose} ${t("pcs")}`;
  }

  const productName = getProductName(p);
  const secondaryName = lang === "en" ? p.nameAr : p.nameEn;
  const unitName = getUnitName(p.unitCode, p.unitLabel);

  return (
    <div className={`rounded-2xl p-3.5 md:p-4 border transition-all hover:shadow-lg group flex flex-col justify-between h-full ${meta.color} hover:border-blue-500/50 relative`}>
      <div>
        {p.imageUrl && (
          <div
            className="mb-3 overflow-hidden rounded-2xl border border-black/10 bg-white/80 shadow-sm cursor-pointer hover:opacity-95 transition"
            onClick={() => onOpenHistory(p)}
            title={lang === "en" ? "Click to view stock history & latest update" : "اضغط لمعاينة آخر تحديث وسجل الحركات"}
          >
            <img src={p.imageUrl} alt={productName} className="h-28 w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onCopyCode(p.code)} title={lang === "en" ? "Click to copy code" : "اضغط لنسخ الكود"}>
            <span className="text-xs font-mono font-black bg-white/90 border border-black/10 px-2 py-0.5 rounded-md text-slate-800 shadow-sm hover:bg-blue-50 transition">
              #{p.code}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md unit-badge-${p.unitCode} shadow-sm`}>{unitName}</span>
            <button
              onClick={() => onPatch(p.id, { mode: isDetailed ? "simple" : "detailed" })}
              title={lang === "en" ? "Switch view mode" : "تبديل طريقة الجرد"}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-black/10 bg-white/90 hover:bg-white text-slate-600 flex items-center gap-0.5 transition shadow-sm"
            >
              <i className="ph-bold ph-arrows-clockwise text-blue-600"></i> {isDetailed ? (lang === "en" ? "Detailed" : "تفصيلي") : (lang === "en" ? "Simple" : "بسيط")}
            </button>
            <button
              onClick={() => onOrder(p.id)}
              title={lang === "en" ? "Add to order list" : "إضافة لقائمة الطلب"}
              className={`text-xs px-2.5 py-1 rounded-md border transition flex items-center gap-1 ${
                hasOrder ? "bg-blue-600 text-white border-blue-600 shadow-sm font-bold" : "bg-white/90 text-slate-600 border-black/10 hover:bg-slate-100"
              }`}
            >
              <i className="ph-bold ph-shopping-cart text-sm"></i>
              {hasOrder ? (
                <span>
                  {p.orderQty}{" "}
                  <span className="text-[10px] font-semibold opacity-90">
                    {orderUnit === "CTN" ? (lang === "en" ? "CTN" : "كرتون") : orderUnit === "PKT" ? (lang === "en" ? "PKT" : "باكت") : (lang === "en" ? "PCS" : "حبة")}
                  </span>
                </span>
              ) : (
                lang === "en" ? "Order" : "طلب"
              )}
            </button>
          </div>
        </div>

        {/* CRITICAL BOLD PRODUCT NAME REQUIREMENT - Clickable for stock history */}
        <div
          className="cursor-pointer group/title"
          onClick={() => onOpenHistory(p)}
          title={lang === "en" ? "Click to view stock history & latest update" : "اضغط لمعاينة آخر تحديث وسجل الحركات"}
        >
          <h4 className="text-[15px] font-extrabold mb-0.5 leading-snug text-slate-900 group-hover/title:text-blue-600 transition flex items-center justify-between gap-1">
            <span>{productName}</span>
            <i className="ph-bold ph-info text-slate-400 group-hover/title:text-blue-600 text-sm shrink-0"></i>
          </h4>
          <p className="text-[11px] font-sans font-semibold opacity-70 leading-tight line-clamp-1 mb-2">
            {secondaryName}
          </p>
        </div>

        {/* Latest Stock Update Indicator Pill */}
        {p.lastStockUpdate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(p);
            }}
            className="w-full mb-2.5 flex items-center justify-between text-[10.5px] font-bold px-2.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 transition border border-black/10 shadow-sm"
            title={lang === "en" ? "Click to view full stock update details & history" : "اضغط لمعاينة تفاصيل آخر تحديث وسجل الحركات"}
          >
            <span className="flex items-center gap-1 text-slate-500">
              <i className="ph-bold ph-clock text-blue-600"></i>
              <span>{lang === "en" ? "Last Update:" : "آخر تحديث:"}</span>
            </span>
            <span className={`font-black ${p.lastStockUpdate.changeType === "increase" ? "text-emerald-700" : "text-red-600"}`}>
              {p.lastStockUpdate.changeType === "increase" ? `+${p.lastStockUpdate.delta}` : p.lastStockUpdate.delta} {unitName}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHistory(p);
            }}
            className="w-full mb-2.5 flex items-center justify-between text-[10px] font-bold px-2 py-1 rounded-xl bg-black/5 hover:bg-black/10 text-slate-500 transition"
            title={lang === "en" ? "Click to view stock history" : "اضغط لمعاينة سجل حركات الصنف"}
          >
            <span className="flex items-center gap-1">
              <i className="ph-bold ph-clock-counter-clockwise text-slate-400"></i>
              <span>{lang === "en" ? "Stock History" : "سجل الحركات"}</span>
            </span>
            <span className="text-blue-600">{lang === "en" ? "Details ❯" : "التفاصيل ❯"}</span>
          </button>
        )}
      </div>

      <div className="mt-auto space-y-2 pt-2 border-t border-black/5">
        {!isDetailed ? (
          <>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-2 shadow-sm">
              <span className="text-xs font-bold text-slate-700 px-1 flex items-center gap-1">
                <i className="ph-bold ph-tag text-blue-600 text-base"></i> {t("availableQty")} ({unitName}):
              </span>
              <div className="flex items-center gap-1.5">
                {stepBtn("qty", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus", true)}
                {numInput("qty", "w-16 text-lg border-slate-300", "", "0")}
                {stepBtn("qty", 1, "bg-blue-600 hover:bg-blue-700 text-white shadow-sm", "ph-plus", true)}
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block leading-none">{t("totalStock")}</span>
                <span className="text-[10px] text-emerald-400 font-bold">{t("directAudit")}</span>
              </div>
              <span className="text-base font-black font-sans text-amber-300">
                {lang === 'ar' ? arNum(qtyVal) : qtyVal.toLocaleString("en-US")} <span className="text-[10px] text-white font-normal">{unitName}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-700 px-1 flex items-center gap-1">
                <i className="ph-bold ph-package text-blue-600 text-sm"></i> {t("numPacks")}:
              </span>
              <div className="flex items-center gap-1">
                {stepBtn("packs", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus")}
                {numInput("packs", "w-14", "border-slate-300", "0")}
                {stepBtn("packs", 1, "bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600", "ph-plus")}
              </div>
            </div>
            <div className="flex items-center justify-between bg-amber-50/90 border border-amber-300/80 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-amber-900 px-1 flex items-center gap-1">
                <i className="ph-bold ph-squares-four text-amber-600 text-sm"></i> {t("packSizeLabel")}:
              </span>
              <div className="flex items-center pl-0.5">
                {numInput("packSize", "w-24", "border-amber-300 text-amber-900 placeholder:text-[11px] placeholder:font-normal focus:border-amber-500", t("writeCapacity"))}
              </div>
            </div>
            <div className="flex items-center justify-between bg-white/80 border border-black/10 rounded-xl p-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-700 px-1 flex items-center gap-1">
                <i className="ph-bold ph-stack text-emerald-600 text-sm"></i> {t("loosePiecesCount")}:
              </span>
              <div className="flex items-center gap-1">
                {stepBtn("loose", -1, "bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600", "ph-minus")}
                {numInput("loose", "w-14", "border-slate-300", "0")}
                {stepBtn("loose", 1, "bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600", "ph-plus")}
              </div>
            </div>
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block leading-none">{t("actualTotal")}</span>
                <span className="text-[10px] text-amber-400 font-mono">{formulaText}</span>
              </div>
              <span className="text-base font-black font-sans text-amber-300">
                {lang === 'ar' ? arNum(total) : total.toLocaleString("en-US")} <span className="text-[10px] text-white font-normal">{t("pcs")}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AddProductModal({
  title,
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
  const { lang, getCategoryName, t } = useLanguage();
  const modalTitle = title || (lang === "en" ? "Add New Product" : "إضافة منتج جديد");
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

  const unitLabels = {
    CTN: lang === "en" ? "Carton (CTN)" : "كرتون (CTN)",
    PKT: lang === "en" ? "Packet (PKT)" : "باكيت (PKT)",
    PCS: lang === "en" ? "Piece (PCS)" : "حبة (PCS)",
  } as const;

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
    if (!isNumeric) return lang === "en" ? "Code must contain numbers only" : "الكود يجب أن يحتوي على أرقام فقط";
    if (isDuplicate) return lang === "en" ? "This code is already in use by another product" : "هذا الكود مستخدم بالفعل لمنتج آخر";
    return null;
  }, [code, isNumeric, isDuplicate, lang]);

  const valid = code.trim() && nameAr.trim() && nameEn.trim() && isNumeric && !isDuplicate;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 modal-enter" dir={lang === "ar" ? "rtl" : "ltr"} onClick={isLoading ? undefined : onClose}>
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl relative modal-content-enter flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
          <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <i className="ph-bold ph-plus"></i>
            </span>
            {modalTitle}
          </h3>
          <button onClick={onClose} disabled={isLoading} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50">
            <i className="ph-bold ph-x"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {lang === "en" ? "Product Code" : "رقم المنتج (الكود)"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 13011011"
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
              {lang === "en" ? "Product Name (Arabic)" : "اسم المنتج (عربي)"} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={lang === "en" ? "Arabic Name" : "مثال: أكياس تسوق دانكن"} disabled={isLoading} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {lang === "en" ? "Product Name (English)" : "اسم المنتج (إنجليزي)"} <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Shopping Bags" disabled={isLoading} className={fieldCls + " font-sans"} dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {lang === "en" ? "Product Image (Optional)" : "صورة المنتج (اختياري)"}
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
                      setUploadError(error instanceof Error ? error.message : (lang === "en" ? "Failed to upload image" : "تعذر رفع الصورة"));
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                <i className="ph-bold ph-upload-simple"></i>
                {isUploading ? (lang === "en" ? "Uploading image..." : "جاري رفع الصورة...") : (lang === "en" ? "Upload from Gallery" : "رفع من المعرض")}
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
              {lang === "en" ? "Group Category" : "تصنيف المجموعة"} <span className="text-red-500">*</span>
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isLoading} className={fieldCls}>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {getMeta(c).icon} {getCategoryName(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {lang === "en" ? "Unit Type" : "نوع الوحدة"} <span className="text-red-500">*</span>
            </label>
            <select value={unitCode} onChange={(e) => setUnitCode(e.target.value as typeof unitCode)} disabled={isLoading} className={fieldCls}>
              <option value="CTN">{lang === "en" ? "Carton (CTN)" : "كرتون (CTN)"}</option>
              <option value="PKT">{lang === "en" ? "Packet (PKT)" : "باكيت (PKT)"}</option>
              <option value="PCS">{lang === "en" ? "Piece (PCS)" : "حبة (PCS)"}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {lang === "en" ? "Default Audit Mode" : "طريقة الجرد الافتراضية"} <span className="text-red-500">*</span>
            </label>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} disabled={isLoading} className={fieldCls}>
              <option value="simple">{lang === "en" ? "Simple & Direct (Carton or Piece only)" : "جرد بسيط ومباشر (كرتون أو حبة فقط)"}</option>
              <option value="detailed">{lang === "en" ? "Detailed Composite (Packets + Loose Pieces)" : "جرد مركب تفصيلي (باكيتات + حبات مفرطة)"}</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3 bg-white rounded-b-3xl">
          <button onClick={onClose} disabled={isLoading} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold py-3.5 rounded-xl transition">
            {t("cancel")}
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
            {lang === "en" ? "Save Product" : "حفظ المنتج"}
          </button>
        </div>
      </div>
    </div>
  );
}
