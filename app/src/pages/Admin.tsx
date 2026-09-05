import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { AddProductModal } from "./Home";
import type { Product } from "@db/schema";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";
import { AdminRequestsPanel } from "@/components/AdminRequestsPanel";

export default function Admin() {
  const navigate = useNavigate();
  const { lang, toggleLang, t, getProductName, getCategoryName, getBranchName } = useLanguage();
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
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 shadow-lg shadow-purple-700/30">
              <i className="ph-bold ph-shield-check text-white text-xl"></i>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">Admin Control</p>
              <h1 className="text-xl font-black">{t("adminPanel")}</h1>
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

            {/* Add product */}
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-xl bg-purple-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-700 text-xs md:text-sm"
            >
              <span className="inline-flex items-center gap-2">
                <i className="ph-bold ph-plus"></i> {t("addProduct")}
              </span>
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
                  className="text-slate-400 hover:text-red-600 transition"
                >
                  <i className="ph-bold ph-sign-out text-base"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Employee Requests & Accounts Approval Panel for Admin */}
        <AdminRequestsPanel />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label={t("totalProducts")} value={String(products.length)} icon="ph-package" tone="violet" />
          <StatCard label={t("categoriesCount")} value={String(categories.length)} icon="ph-folder" tone="blue" />
          <StatCard label={t("productImages")} value={String(products.filter((p) => !!p.imageUrl).length)} icon="ph-image" tone="emerald" />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">{t("productCatalog")}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{products.length} {t("items")}</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1fr] gap-3 bg-slate-100 px-4 py-3 text-xs font-black text-slate-600 md:grid">
              <span>{t("productCatalog")}</span>
              <span>{t("code")}</span>
              <span>{t("category")}</span>
              <span>{t("productImages")}</span>
              <span>{t("actions")}</span>
            </div>

            {products.map((product) => {
              const productName = getProductName(product);
              const secondaryName = lang === "en" ? product.nameAr : product.nameEn;
              const categoryName = getCategoryName(product.category);

              return (
                <div key={product.id} className="grid gap-3 border-t border-slate-200 px-4 py-3 md:grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1fr] md:items-center">
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={productName} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <i className="ph-bold ph-image text-xl"></i>
                      </div>
                    )}
                    <div>
                      {/* BOLD PRODUCT NAME REQUIREMENT */}
                      <p className="font-black text-slate-800">{productName}</p>
                      <p className="text-xs text-slate-500">{secondaryName}</p>
                    </div>
                  </div>

                  <div className="text-sm font-mono font-black text-slate-700">#{product.code}</div>
                  <div className="text-sm font-bold text-slate-600">{categoryName}</div>
                  <div className="text-sm font-bold text-slate-500">
                    {product.imageUrl ? t("imageAvailable") : t("imageNone")}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(product)}>
                      {t("editProduct")}
                    </button>
                    <button className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" onClick={() => {
                      if (window.confirm(t("confirmDelete"))) removeMut.mutate({ id: product.id });
                    }}>
                      {t("deleteProduct")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>


      {showAdd && (
        <AddProductModal
          categories={categories}
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
          categories={categories}
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
