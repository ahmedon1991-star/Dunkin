import React, { useState } from "react";
import { useAuth } from "@/providers/AuthContext";
import { useLanguage } from "@/providers/LanguageContext";

export function AuthModal({ isOpen, onClose, allowClose = true }: { isOpen: boolean; onClose: () => void; allowClose?: boolean }) {
  const { login, submitRegistrationRequest, isLoading } = useAuth();
  const { lang, toggleLang } = useLanguage();

  const [activeTab, setActiveTab] = useState<"login" | "admin" | "register">("login");
  const [alert, setAlert] = useState<{ type: "success" | "error" | "pending"; message: string } | null>(null);

  // Form States
  const [branchCode, setBranchCode] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [fullName, setFullName] = useState("");

  // Admin Login States
  const [adminBranchCode, setAdminBranchCode] = useState("1010001");
  const [adminEmployeeId, setAdminEmployeeId] = useState("10001");

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!branchCode.trim() || !employeeId.trim()) {
      setAlert({ type: "error", message: lang === "en" ? "Please fill all required fields" : "يرجى تعبئة جميع الحقول المطلوبة" });
      return;
    }

    const res = await login(branchCode, employeeId);
    if (res.success) {
      setAlert({ type: "success", message: res.message });
      setTimeout(() => {
        setAlert(null);
        onClose();
      }, 700);
    } else {
      if (res.status === "pending") {
        setAlert({ type: "pending", message: res.message });
      } else {
        setAlert({ type: "error", message: res.message });
      }
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!adminBranchCode.trim() || !adminEmployeeId.trim()) {
      setAlert({ type: "error", message: lang === "en" ? "Please fill all required fields" : "يرجى تعبئة بيانات دخول الأدمن" });
      return;
    }

    const res = await login(adminBranchCode, adminEmployeeId);
    if (res.success) {
      setAlert({ type: "success", message: res.message });
      setTimeout(() => {
        setAlert(null);
        onClose();
      }, 700);
    } else {
      setAlert({ type: "error", message: res.message });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (!fullName.trim() || !employeeId.trim() || !branchCode.trim()) {
      setAlert({ type: "error", message: lang === "en" ? "Please fill all required fields" : "يرجى إكمال كافة بيانات طلب التسجيل" });
      return;
    }

    const res = await submitRegistrationRequest(fullName, employeeId, branchCode);
    if (res.success) {
      setAlert({ type: "pending", message: res.message });
      setFullName("");
      setEmployeeId("");
      setBranchCode("");
    } else {
      setAlert({ type: "error", message: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-800" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Header & Language Switcher & Close */}
        <div className="bg-slate-900 text-white p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg ${
              activeTab === "admin" ? "bg-purple-600 shadow-purple-600/30" : "bg-orange-500 shadow-orange-500/30"
            }`}>
              <i className={`ph-bold ${activeTab === "admin" ? "ph-shield-check" : "ph-user-lock"}`}></i>
            </div>
            <div>
              <h3 className="text-lg font-black">
                {activeTab === "admin"
                  ? (lang === "en" ? "Admin Portal Login" : "تسجيل دخول الأدمن")
                  : (lang === "en" ? "Employee Login" : "تسجيل الموظفين والفروع")}
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">
                {activeTab === "admin"
                  ? (lang === "en" ? "System Control Privileges" : "نظام صلاحيات وحسابات الأدمن")
                  : (lang === "en" ? "Multi-branch System" : "نظام إدارة دخول الفروع المتعددة")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-amber-400 hover:text-amber-300 border border-slate-700 transition shadow-sm"
              title={lang === "ar" ? "Switch to English" : "التحويل للغة العربية"}
            >
              <i className="ph-bold ph-globe text-sm"></i>
              <span>{lang === "ar" ? "English" : "العربية"}</span>
            </button>
            {allowClose && (
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
                <i className="ph-bold ph-x text-lg"></i>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-[11px] md:text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveTab("login"); setAlert(null); }}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 ${
              activeTab === "login"
                ? "bg-white text-orange-600 border-b-2 border-orange-500 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="ph-bold ph-sign-in text-base"></i>
            {lang === "en" ? "Branch Login" : "دخول الفرع"}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("admin"); setAlert(null); }}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 ${
              activeTab === "admin"
                ? "bg-white text-purple-700 border-b-2 border-purple-600 font-extrabold"
                : "text-slate-500 hover:text-purple-700"
            }`}
          >
            <i className="ph-bold ph-shield-check text-base text-purple-600"></i>
            {lang === "en" ? "Admin Login" : "دخول الأدمن"}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("register"); setAlert(null); }}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-1 ${
              activeTab === "register"
                ? "bg-white text-orange-600 border-b-2 border-orange-500 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="ph-bold ph-user-plus text-base"></i>
            {lang === "en" ? "Request Account" : "طلب حساب"}
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          
          {/* Alerts */}
          {alert && (
            <div
              className={`mb-5 p-4 rounded-2xl text-xs md:text-sm font-bold flex items-center gap-3 border ${
                alert.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : alert.type === "pending"
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              <i className={`ph-bold text-lg ${
                alert.type === "success" ? "ph-check-circle text-emerald-600" : alert.type === "pending" ? "ph-clock-counter-clockwise text-amber-600 animate-spin" : "ph-warning-circle text-red-600"
              }`}></i>
              <div className="leading-snug">{alert.message}</div>
            </div>
          )}

          {activeTab === "login" ? (
            /* EMPLOYEE LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Branch Code (7 digits e.g. 1010001) *" : "رقم الفرع (من 7 أرقام - مثال: 1010001) *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={7}
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="1010001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Employee ID (5 digits e.g. 10001) *" : "الرقم الوظيفي (من 5 أرقام - مثال: 10001) *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ""))}
                  placeholder="10001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-50"
              >
                <i className="ph-bold ph-sign-in"></i>
                {isLoading ? (lang === "en" ? "Logging in..." : "جاري التحقق...") : (lang === "en" ? "Login Now" : "تسجيل الدخول")}
              </button>
            </form>
          ) : activeTab === "admin" ? (
            /* ADMIN LOGIN FORM */
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                  <i className="ph-bold ph-shield-check text-lg"></i>
                </div>
                <div className="text-xs">
                  <p className="font-black text-purple-950">{lang === "en" ? "System Admin Portal" : "تسجيل دخول الأدمن الرئيسي"}</p>
                  <p className="text-purple-700 font-semibold leading-tight">{lang === "en" ? "Full access to branch approvals and management" : "صلاحيات تامة لإدارة الفروع والموظفين والطلبات"}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Admin Branch Code *" : "رقم فرع الأدمن *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={7}
                  value={adminBranchCode}
                  onChange={(e) => setAdminBranchCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="1010001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Admin Employee ID *" : "الرقم الوظيفي للأدمن *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={adminEmployeeId}
                  onChange={(e) => setAdminEmployeeId(e.target.value.replace(/\D/g, ""))}
                  placeholder="10001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-purple-600 focus:bg-white focus:ring-4 focus:ring-purple-600/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-50"
              >
                <i className="ph-bold ph-shield-check text-lg"></i>
                {isLoading ? (lang === "en" ? "Verifying..." : "جاري التحقق من الصلاحيات...") : (lang === "en" ? "Login as Admin" : "تسجيل الدخول كمدير نظام")}
              </button>
            </form>
          ) : (
            /* REGISTER REQUEST FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Employee Full Name *" : "اسم الموظف الكامل *"}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={lang === "en" ? "e.g. Ahmed Mahmoud" : "مثال: أحمد محمود العتيبي"}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Employee ID (5 digits e.g. 10001) *" : "الرقم الوظيفي (من 5 أرقام - مثال: 10001) *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ""))}
                  placeholder="10001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {lang === "en" ? "Branch Code (7 digits e.g. 1010001) *" : "رقم الفرع (من 7 أرقام - مثال: 1010001) *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={7}
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="1010001"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition font-mono text-sm tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-50"
              >
                <i className="ph-bold ph-paper-plane-tilt"></i>
                {isLoading ? (lang === "en" ? "Submitting..." : "جاري الإرسال...") : (lang === "en" ? "Submit Request to Admin" : "إرسال طلب الحساب للأدمن")}
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
