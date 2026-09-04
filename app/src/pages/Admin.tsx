import { useMemo, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { AddProductModal } from "./Home";
import type { Product } from "@db/schema";

export default function Admin() {
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
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg text-white">
              <i className="ph-bold ph-arrow-left"></i>
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Admin</p>
              <h1 className="text-xl font-black">لوحة إدارة المنتجات</h1>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl bg-violet-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700"
          >
            <span className="inline-flex items-center gap-2">
              <i className="ph-bold ph-plus"></i> إضافة منتج
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="إجمالي المنتجات" value={String(products.length)} icon="ph-package" tone="violet" />
          <StatCard label="التصنيفات" value={String(categories.length)} icon="ph-folder" tone="blue" />
          <StatCard label="صور المنتجات" value={String(products.filter((p) => !!p.imageUrl).length)} icon="ph-image" tone="emerald" />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">قائمة المنتجات</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{products.length} منتج</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1fr] gap-3 bg-slate-100 px-4 py-3 text-xs font-black text-slate-600 md:grid">
              <span>المنتج</span>
              <span>الكود</span>
              <span>التصنيف</span>
              <span>الصورة</span>
              <span>إجراءات</span>
            </div>

            {products.map((product) => (
              <div key={product.id} className="grid gap-3 border-t border-slate-200 px-4 py-3 md:grid-cols-[1.2fr_1.2fr_1.5fr_1fr_1fr] md:items-center">
                <div className="flex items-center gap-3">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.nameAr} className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      <i className="ph-bold ph-image text-xl"></i>
                    </div>
                  )}
                  <div>
                    <p className="font-black text-slate-800">{product.nameAr}</p>
                    <p className="text-xs text-slate-500">{product.nameEn}</p>
                  </div>
                </div>

                <div className="text-sm font-mono font-black text-slate-700">#{product.code}</div>
                <div className="text-sm font-bold text-slate-600">{product.category}</div>
                <div className="text-sm font-bold text-slate-500">
                  {product.imageUrl ? "متاحة" : "لا توجد"}
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setEditing(product)}>
                    تعديل
                  </button>
                  <button className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100" onClick={() => {
                    if (window.confirm("هل تريد حذف هذا المنتج؟")) removeMut.mutate({ id: product.id });
                  }}>
                    حذف
                  </button>
                </div>
              </div>
            ))}
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
          title="تعديل المنتج"
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
