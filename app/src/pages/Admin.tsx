import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";
import { AdminRequestsPanel } from "@/components/AdminRequestsPanel";

export default function Admin() {
  const navigate = useNavigate();
  const { lang, toggleLang, t } = useLanguage();
  const { session, logout, branchesList } = useAuth();

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/");
    }
  }, [session, navigate]);

  if (!session || session.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700 shadow-lg shadow-purple-700/30">
              <i className="ph-bold ph-shield-check text-white text-xl"></i>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-500">Admin Control</p>
              <h1 className="text-xl font-black text-slate-900">{lang === "ar" ? "لوحة الإدارة" : "Admin Panel"}</h1>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language */}
            <button
              onClick={toggleLang}
              className="rounded-xl bg-blue-600 px-3.5 py-2.5 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 text-xs flex items-center gap-1.5"
            >
              <i className="ph-bold ph-globe text-base"></i>
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </button>

            {/* Admin badge + logout */}
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-900 shadow-sm">
              <i className="ph-bold ph-shield-check text-lg text-purple-600"></i>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-purple-950">{lang === "ar" ? "مدير النظام" : "System Admin"}</span>
                <span className="text-[10px] text-purple-500 font-mono">#{session.employee_id}</span>
              </div>
              <button
                onClick={logout}
                title={lang === "ar" ? "تسجيل الخروج" : "Logout"}
                className="text-slate-400 hover:text-red-600 transition ml-1"
              >
                <i className="ph-bold ph-sign-out text-base"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">

        {/* 1. طلبات الموظفين */}
        <AdminRequestsPanel />

        {/* 2. الفروع */}
        <section>
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
              <div className="col-span-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
                <i className="ph-bold ph-storefront text-4xl block mb-2"></i>
                <p className="font-bold">{lang === "ar" ? "لا توجد فروع مسجلة" : "No branches registered"}</p>
              </div>
            ) : (
              branchesList.map((branch) => (
                <div
                  key={branch.branch_code}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-4 hover:shadow-md transition"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                    <i className="ph-bold ph-storefront text-emerald-600 text-xl"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 truncate">{branch.branch_name}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">#{branch.branch_code}</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      {lang === "ar" ? "نشط" : "Active"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
