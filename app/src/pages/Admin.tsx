import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AddProductModal } from "./Home";
import type { Product } from "@db/schema";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";
import { AdminRequestsPanel } from "@/components/AdminRequestsPanel";
import { getMeta } from "@/lib/catMeta";

export default function Admin() {
  const navigate = useNavigate();
  const { lang, toggleLang, t, getProductName, getCategoryName, getBranchName, getUnitName } = useLanguage();
  const { session, logout, selectedBranch, setSelectedBranch, branchesList } = useAuth();

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/");
    }
  }, [session, navigate]);

  if (!session || session.role !== "admin") return null;

  const utils = trpc.useUtils();
  const listQuery = trpc.inventory.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Search & Category filter states
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("ALL");

  const addMut = trpc.inventory.add.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setShowAdd(false);
    },
  });

  const editMut = trpc.inventory.edit.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      setEditing(null);
    },
  });

  const removeMut = trpc.inventory.remove.useMutation({
    onSuccess: () => utils.inventory.list.invalidate(),
  });

  const products = listQuery.data ?? [];
  const allCategories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  // Filter products by search term (name / code) and category tab
  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return products.filter((p) => {
      const catEn = getCategoryName(p.category).toLowerCase();
      const matchSearch =
        !term ||
        p.nameAr.toLowerCase().includes(term) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(term)) ||
        p.code.includes(term) ||
        p.category.toLowerCase().includes(term) ||
        catEn.includes(term);

      const matchCat = selectedCat === "ALL" || p.category === selectedCat;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCat, getCategoryName]);

  // Group filtered products by category
  const groupedProducts = useMemo(() => {
    const groups: { category: string; items: Product[] }[] = [];
    const catsInFiltered = Array.from(new Set(filteredProducts.map((p) => p.category)));

    for (const cat of catsInFiltered) {
      groups.push({
        category: cat,
        items: filteredProducts.filter((p) => p.category === cat),
      });
    }
    return groups;
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 shadow-lg shadow-purple-700/30">
              <i className="ph-bold ph-shield-check text-white text-xl"></i>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Admin Control</p>
              <h1 className="text-xl font-black text-slate-900">{t("adminPanel")}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch Selector Dropdown for Admin */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
              <i className="ph-bold ph-storefront text-slate-500 text-base"></i>
              <span className="text-[11px] text-slate-500 font-normal">{lang === "en" ? "Branch:" : "الفرع:"}</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent border-none outline-none font-black text-xs cursor-pointer text-slate-900"
                title={lang === "en" ? "Select branch to manage all products" : "اختر الفرع للتحكم بمنتجاته بالكامل"}
              >
                {branchesList.map((b) => (
                  <option key={b.branch_code} value={b.branch_code}>
                    {b.branch_code} - {getBranchName(b.branch_code, b.branch_name)}
                  </option>
                ))}
              </select>
            </div>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              title={t("langTitle")}
              className="rounded-xl bg-blue-600 px-3.5 py-2.5 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 text-xs md:text-sm flex items-center gap-1.5"
            >
              <i className="ph-bold ph-globe text-lg"></i>
              <span>{t("langBtn")}</span>
            </button>

            {/* Add product button */}
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-purple-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-700 text-xs md:text-sm flex items-center gap-2"
            >
              <i className="ph-bold ph-plus"></i>
              <span>{t("addProduct")}</span>
            </button>

            {/* Admin session badge + logout */}
            {session && (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-900 shadow-sm">
                <i className="ph-bold ph-shield-check text-lg text-purple-600"></i>
                <div className="flex flex-col leading-tight">
                  <span className="font-extrabold text-purple-950">{lang === "en" ? "System Admin" : "مدير النظام"}</span>
                  <span className="text-[10px] text-purple-600 font-mono">#{session.employee_id}</span>
                </div>
                <button
                  onClick={logout}
                  title={lang === "en" ? "Logout" : "تسجيل الخروج"}
                  className="text-slate-400 hover:text-red-600 transition ml-1"
                >
                  <i className="ph-bold ph-sign-out text-base"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* 1. Employee Requests & Accounts Approval Panel */}
        <AdminRequestsPanel />

        {/* 2. Registered Branches Panel */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
              <i className="ph-bold ph-storefront text-emerald-600 text-lg"></i>
            </div>
            <h2 className="text-lg font-black text-slate-800">
              {lang === "ar" ? "الفروع المسجلة" : "Registered Branches"}
            </h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              {branchesList.length} {lang === "ar" ? "فروع" : "branches"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branchesList.length === 0 ? (
              <div className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-400">
                <i className="ph-bold ph-storefront text-3xl block mb-2"></i>
                <p className="font-bold">{lang === "ar" ? "لا توجد فروع مسجلة" : "No branches registered"}</p>
              </div>
            ) : (
              branchesList.map((branch) => (
                <div
                  key={branch.branch_code}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm flex items-start gap-3 hover:bg-white hover:shadow-md transition"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <i className="ph-bold ph-storefront text-lg"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 truncate">{getBranchName(branch.branch_code, branch.branch_name)}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">#{branch.branch_code}</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      {lang === "ar" ? "نشط" : "Active"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3. Stat Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label={t("totalProducts")} value={String(products.length)} icon="ph-package" tone="violet" />
          <StatCard label={t("categoriesCount")} value={String(allCategories.length)} icon="ph-folder" tone="blue" />
          <StatCard label={t("productImages")} value={String(products.filter((p) => !!p.imageUrl).length)} icon="ph-image" tone="emerald" />
        </div>

        {/* 4. Products Management Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-5">
          {/* Header with Title & Add Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{t("productCatalog")}</h2>
                <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-700">
                  {filteredProducts.length} {t("items")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {lang === "ar"
                  ? "إدارة وتعديل المنتجات مقسمة حسب الأقسام مع إمكانية البحث بالاسم أو الرقم"
                  : "Manage and edit products grouped by category with search by name or code"}
              </p>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-purple-600 px-4 py-2 font-bold text-white shadow-md shadow-purple-600/30 hover:bg-purple-700 text-xs sm:text-sm flex items-center gap-2 transition shrink-0"
            >
              <i className="ph-bold ph-plus"></i>
              <span>{t("addProduct")}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <i
              className={`ph-bold ph-magnifying-glass absolute top-1/2 ${
                lang === "ar" ? "right-4" : "left-4"
              } -translate-y-1/2 text-slate-400 text-lg`}
            ></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "ابحث برقم المنتج (الكود) أو اسم المنتج..." : "Search by product code or product name..."}
              className={`w-full bg-slate-50 border border-slate-200 rounded-2xl ${
                lang === "ar" ? "pr-11 pl-10" : "pl-11 pr-10"
              } py-3 text-slate-800 font-medium focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition text-sm`}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className={`absolute top-1/2 ${lang === "ar" ? "left-3" : "right-3"} -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1`}
                title={lang === "ar" ? "مسح البحث" : "Clear search"}
              >
                <i className="ph-bold ph-x text-sm"></i>
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => setSelectedCat("ALL")}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                  selectedCat === "ALL"
                    ? "bg-purple-700 text-white shadow-md shadow-purple-700/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{t("allCategories")}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                    selectedCat === "ALL" ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {products.length}
                </span>
              </button>

              {allCategories.map((cat) => {
                const meta = getMeta(cat);
                const count = products.filter((p) => p.category === cat).length;
                const active = selectedCat === cat;
                const catName = getCategoryName(cat);

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCat(cat)}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                      active
                        ? "bg-purple-700 text-white shadow-md shadow-purple-700/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{catName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[11px] ${
                        active ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categorized Products List */}
          {groupedProducts.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <i className="ph-duotone ph-magnifying-glass text-5xl mb-2 text-slate-300"></i>
              <p className="font-bold text-slate-600">{t("searchNoResults")}</p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-3 text-xs font-bold text-purple-600 hover:underline"
                >
                  {lang === "ar" ? "إعادة تعيين البحث" : "Reset search"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedProducts.map(({ category, items }) => {
                const meta = getMeta(category);
                const catName = getCategoryName(category);

                return (
                  <div key={category} className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Category Header Banner */}
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{meta.icon}</span>
                        <h3 className="font-black text-slate-900 text-base">{catName}</h3>
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          {items.length} {t("items")}
                        </span>
                      </div>
                    </div>

                    {/* Products Grid in this Category */}
                    <div className="divide-y divide-slate-100 bg-white">
                      {items.map((product) => {
                        const productName = getProductName(product);
                        const secondaryName = lang === "en" ? product.nameAr : product.nameEn;
                        const unitLabel = getUnitName(product.unitCode, product.unitLabel);

                        return (
                          <div
                            key={product.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 hover:bg-slate-50/70 transition"
                          >
                            {/* Product Info & Image */}
                            <div className="flex items-center gap-3 min-w-0">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={productName}
                                  className="h-12 w-12 rounded-xl object-cover shrink-0 border border-slate-200"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                                  <i className="ph-bold ph-image text-xl"></i>
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                    #{product.code}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    {unitLabel}
                                  </span>
                                </div>
                                <p className="font-black text-slate-900 text-sm mt-0.5 truncate">{productName}</p>
                                {secondaryName && (
                                  <p className="text-xs text-slate-400 truncate">{secondaryName}</p>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                onClick={() => setEditing(product)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1 shadow-sm"
                              >
                                <i className="ph-bold ph-pencil-simple text-purple-600"></i>
                                <span>{t("editProduct")}</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(t("confirmDelete"))) {
                                    removeMut.mutate({ id: product.id });
                                  }
                                }}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition flex items-center gap-1 shadow-sm"
                              >
                                <i className="ph-bold ph-trash"></i>
                                <span>{t("deleteProduct")}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showAdd && (
        <AddProductModal
          categories={allCategories}
          existingCodes={products.map((p) => p.code)}
          onClose={() => setShowAdd(false)}
          onSave={(input) => addMut.mutate(input)}
          isLoading={addMut.isPending}
        />
      )}

      {editing && (
        <AddProductModal
          title={lang === "en" ? "Edit Product" : "تعديل المنتج"}
          product={editing}
          categories={allCategories}
          existingCodes={products.filter((p) => p.id !== editing.id).map((p) => p.code)}
          onClose={() => setEditing(null)}
          onSave={(input) => editMut.mutate({ id: editing.id, ...input })}
          isLoading={editMut.isPending}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone: "violet" | "blue" | "emerald";
}) {
  const palette = {
    violet: "bg-violet-100 text-violet-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${palette[tone]}`}>
          <i className={`ph-bold ${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );
}
