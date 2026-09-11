import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth, type EmployeeRequest, type EmployeeRecord, type BranchRecord, type AdminSubmission } from "@/providers/AuthContext";
import { useLanguage } from "@/providers/LanguageContext";
import { trpc } from "@/providers/trpc";

export function AdminRequestsPanel() {
  const navigate = useNavigate();
  const {
    fetchPendingRequests,
    fetchEmployeesList,
    fetchBranchesList,
    approveRequest,
    rejectRequest,
    toggleActive,
    transferEmployee,
    selectedBranch,
    setSelectedBranch,
    addBranch,
    updateBranch,
    deleteBranch,
    toggleBranchActive,
    fetchAdminSubmissions,
    markSubmissionStatus,
    deleteAdminSubmission,
  } = useAuth();
  const { lang, getBranchName, getEmployeeName } = useLanguage();

  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<AdminSubmission | null>(null);
  const [subFilter, setSubFilter] = useState<"ALL" | "cargo_order" | "audit">("ALL");

  const [activeTab, setActiveTab] = useState<"requests" | "submissions" | "employees" | "branches">("submissions");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Transfer Employee Modal State
  const [transferringEmployee, setTransferringEmployee] = useState<EmployeeRecord | null>(null);
  const [targetBranchCode, setTargetBranchCode] = useState<string>("");

  // Branch Details Modal State
  const [viewingBranch, setViewingBranch] = useState<BranchRecord | null>(null);

  // New Branch Form
  const [newBranchCode, setNewBranchCode] = useState("");
  const [newBranchName, setNewBranchName] = useState("");

  // Edit Branch Form State
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);
  const [editBranchCode, setEditBranchCode] = useState("");
  const [editBranchName, setEditBranchName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const reqData = await fetchPendingRequests();
    const empData = await fetchEmployeesList();
    const branchData = await fetchBranchesList();
    const subsData = await fetchAdminSubmissions();
    setRequests(reqData);
    setEmployees(empData);
    setBranches(branchData);
    setSubmissions(subsData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (id: string, role = "staff") => {
    const res = await approveRequest(id, role);
    notify(res.message);
    loadData();
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt(lang === "en" ? "Reason for rejection:" : "سبب الرفض (اختياري):") || "رفض من قبل الإدارة";
    const res = await rejectRequest(id, reason);
    notify(res.message);
    loadData();
  };

  const handleToggleActive = async (employeeId: string, currentActive: boolean) => {
    const res = await toggleActive(employeeId, !currentActive);
    notify(res.message);
    loadData();
  };

  const openTransferModal = (emp: EmployeeRecord) => {
    setTransferringEmployee(emp);
    setTargetBranchCode(emp.branch_code);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringEmployee || !targetBranchCode) return;
    const res = await transferEmployee(transferringEmployee.employee_id, targetBranchCode);
    notify(res.message);
    setTransferringEmployee(null);
    loadData();
  };

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchCode.trim() || !newBranchName.trim()) {
      notify(lang === "en" ? "Please fill branch code and name" : "يرجى تعبئة رمز واسم الفرع");
      return;
    }
    const res = await addBranch(newBranchCode, newBranchName);
    notify(res.message);
    setNewBranchCode("");
    setNewBranchName("");
    loadData();
  };

  const openEditBranchModal = (b: BranchRecord) => {
    setEditingBranch(b);
    setEditBranchCode(b.branch_code);
    setEditBranchName(b.branch_name);
  };

  const handleUpdateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    if (!editBranchCode.trim() || !editBranchName.trim()) {
      notify(lang === "en" ? "Please fill branch code and name" : "يرجى إكمال بيانات الفرع");
      return;
    }

    const res = await updateBranch(editingBranch.branch_code, editBranchCode, editBranchName);
    notify(res.message);
    setEditingBranch(null);
    loadData();
  };

  const handleDeleteBranch = async (branchCode: string, branchName: string) => {
    const confirmMsg = lang === "en"
      ? `Are you sure you want to delete branch (${branchName})?`
      : `هل أنت تأكد من رغبتك في حذف فرع (${branchName} - ${branchCode}) نهائياً من النظام؟`;

    if (window.confirm(confirmMsg)) {
      const res = await deleteBranch(branchCode);
      notify(res.message);
      loadData();
    }
  };

  const handleToggleBranch = async (code: string, currentActive: boolean) => {
    const res = await toggleBranchActive(code, !currentActive);
    notify(res.message);
    loadData();
  };

  const handleToggleSubmissionStatus = async (id: string, currentStatus: "pending" | "reviewed") => {
    const nextStatus = currentStatus === "pending" ? "reviewed" : "pending";
    await markSubmissionStatus(id, nextStatus);
    notify(nextStatus === "reviewed" ? (lang === "en" ? "Marked as reviewed!" : "تم التحديد كـ تم الإطلاع!") : (lang === "en" ? "Marked as new" : "تمت الإعادة كـ جديد"));
    loadData();
  };

  const handleDeleteSubmission = async (id: string) => {
    if (window.confirm(lang === "en" ? "Delete this alert?" : "هل أنت تأكد من حذف هذا التنبيه؟")) {
      await deleteAdminSubmission(id);
      notify(lang === "en" ? "Alert deleted" : "تم حذف التنبيه");
      loadData();
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const pendingSubmissionsCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-6 shadow-sm mb-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm">
          {toast}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-violet-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-600/30">
            <i className="ph-bold ph-buildings"></i>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">
              {lang === "en" ? "Branches & Accounts Management" : "إدارة الفروع وطلبات الحسابات (الأدمن)"}
            </h2>
            <p className="text-xs text-slate-500 font-bold">
              {lang === "en"
                ? "Enter any branch with full catalog & approve requests"
                : "دخول أي فرع بعرض المنتجات بالعدد الكامل والموافقة على حسابات الفروع"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "submissions"
                ? "bg-violet-600 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <i className="ph-bold ph-bell-ringing"></i>
            {lang === "en" ? "Orders & Audit Alerts" : "تنبيهات البضاعة والجرد"}
            {pendingSubmissionsCount > 0 ? (
              <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {pendingSubmissionsCount}
              </span>
            ) : (
              <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                {submissions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "requests"
                ? "bg-violet-600 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <i className="ph-bold ph-clock"></i>
            {lang === "en" ? "Pending Requests" : "طلبات التسجيل المعلقة"}
            {pendingCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("employees")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "employees"
                ? "bg-violet-600 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <i className="ph-bold ph-users"></i>
            {lang === "en" ? "Active Employees" : "الموظفين المعتمدين"}
            <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
              {employees.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("branches")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "branches"
                ? "bg-violet-600 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <i className="ph-bold ph-storefront"></i>
            {lang === "en" ? "Branches & Catalog Entry" : "الفروع والمنتجات الكاملة"}
            <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {branches.length}
            </span>
          </button>

          <button
            onClick={loadData}
            title={lang === "en" ? "Refresh" : "تحديث القائمة"}
            className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition"
          >
            <i className={`ph-bold ph-arrows-clockwise text-base ${isLoading ? "animate-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {/* Tab: Submissions & Alerts */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          {/* Sub-filter */}
          <div className="flex flex-wrap items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs gap-2">
            <div className="flex items-center gap-1.5 font-bold flex-wrap">
              <span className="text-slate-500">{lang === "en" ? "Filter Alerts:" : "تصفية التنبيهات:"}</span>
              <button
                onClick={() => setSubFilter("ALL")}
                className={`px-3 py-1 rounded-xl transition ${
                  subFilter === "ALL" ? "bg-slate-900 text-white font-extrabold" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lang === "en" ? "All Submissions" : "جميع التنبيهات"} ({submissions.length})
              </button>
              <button
                onClick={() => setSubFilter("cargo_order")}
                className={`px-3 py-1 rounded-xl transition ${
                  subFilter === "cargo_order" ? "bg-amber-600 text-white font-extrabold" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lang === "en" ? "Cargo Orders" : "طلبات البضاعة"} (
                {submissions.filter((s) => s.type === "cargo_order").length})
              </button>
              <button
                onClick={() => setSubFilter("audit")}
                className={`px-3 py-1 rounded-xl transition ${
                  subFilter === "audit" ? "bg-blue-600 text-white font-extrabold" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lang === "en" ? "Audit Reports" : "تقارير الجرد"} (
                {submissions.filter((s) => s.type === "audit").length})
              </button>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">
              {lang === "en" ? "Auto-synced & Persisted" : "مزامنة ومحفوظة تلقائياً"}
            </span>
          </div>

          {/* List of Submissions */}
          {submissions.filter((s) => subFilter === "ALL" || s.type === subFilter).length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <i className="ph-bold ph-bell-slash text-4xl text-slate-300 mb-2"></i>
              <p>{lang === "en" ? "No order or audit alerts received yet" : "لا توجد تنبيهات طلبات بضاعة أو جرد مُرسلة حالياً"}</p>
            </div>
          ) : (
            <div className="grid gap-3.5 md:grid-cols-2">
              {submissions
                .filter((s) => subFilter === "ALL" || s.type === subFilter)
                .map((sub) => {
                  const empDisplay = getEmployeeName(sub.employee_name);
                  const branchDisplay = getBranchName(sub.branch_code, sub.branch_name);
                  const isNew = sub.status === "pending";

                  return (
                    <div
                      key={sub.id}
                      className={`border rounded-2xl p-4 transition relative flex flex-col justify-between ${
                        isNew
                          ? "border-amber-400 bg-amber-50/40 shadow-sm ring-1 ring-amber-400/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                              sub.type === "cargo_order"
                                ? "bg-amber-100 text-amber-950 border border-amber-200"
                                : "bg-blue-100 text-blue-950 border border-blue-200"
                            }`}
                          >
                            <i className={`ph-bold ${sub.type === "cargo_order" ? "ph-package" : "ph-clipboard-text"}`}></i>
                            {sub.type === "cargo_order"
                              ? lang === "en"
                                ? "Cargo Order"
                                : "طلب بضاعة مستودع"
                              : lang === "en"
                              ? "Operational Audit"
                              : "جرد تشغيلي"}
                          </span>

                          <span
                            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              isNew
                                ? "bg-red-500 text-white shadow-sm animate-pulse"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isNew ? (lang === "en" ? "NEW / Unread" : "جديد / لم يُقرأ 🔴") : (lang === "en" ? "Reviewed" : "تم الإطلاع 🟢")}
                          </span>
                        </div>

                        {/* Title & Info */}
                        <h4 className="font-black text-sm text-slate-900 mb-1">{sub.title}</h4>
                        
                        <div className="space-y-1 text-xs text-slate-600 font-bold mb-3 bg-white/70 p-2.5 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{lang === "en" ? "Employee:" : "الموظف القائم:"}</span>
                            <span className="text-slate-900 font-extrabold">{empDisplay} <span className="text-slate-500 font-mono">#{sub.employee_id}</span></span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{lang === "en" ? "Branch:" : "الفرع:"}</span>
                            <span className="text-violet-700 font-extrabold">[{sub.branch_code}] {branchDisplay}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{lang === "en" ? "Date:" : "التاريخ والوقت:"}</span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {new Date(sub.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                            </span>
                          </div>
                        </div>

                        {/* Details summary */}
                        <div className="flex items-center gap-2 text-xs mb-3">
                          <span className="bg-violet-50 text-violet-800 font-black px-2.5 py-1 rounded-lg border border-violet-200">
                            {lang === "en" ? `Items: ${sub.details.item_count || sub.details.items?.length || 0}` : `عدد المواد: ${sub.details.item_count || sub.details.items?.length || 0} منتج`}
                          </span>
                          {sub.details.notes && (
                            <span className="bg-slate-100 text-slate-600 font-medium px-2 py-1 rounded-lg truncate max-w-[180px]">
                              {sub.details.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedSubmission(sub)}
                          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <i className="ph-bold ph-eye"></i>
                          {lang === "en" ? "View Full Details" : "معاينة التفاصيل"}
                        </button>

                        <button
                          onClick={() => handleToggleSubmissionStatus(sub.id, sub.status)}
                          title={isNew ? (lang === "en" ? "Mark Reviewed" : "تحديد كـ تم الإطلاع") : (lang === "en" ? "Mark New" : "إعادة كـ جديد")}
                          className={`p-2 rounded-xl text-xs font-bold transition border ${
                            isNew
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <i className={`ph-bold ${isNew ? "ph-check-circle" : "ph-arrow-counter-clockwise"}`}></i>
                        </button>

                        <button
                          onClick={() => handleDeleteSubmission(sub.id)}
                          title={lang === "en" ? "Delete Alert" : "حذف التنبيه"}
                          className="p-2 text-red-600 hover:bg-red-50 transition rounded-xl text-xs border border-red-200"
                        >
                          <i className="ph-bold ph-trash"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Pending Requests */}
      {activeTab === "requests" && (
        <div>
          {requests.filter((r) => r.status === "pending").length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <i className="ph-bold ph-check-circle text-4xl text-emerald-500 mb-2"></i>
              <p>{lang === "en" ? "No pending employee requests!" : "لا توجد طلبات تسجيل معلقة حالياً"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className={`w-full ${lang === "ar" ? "text-right" : "text-left"} text-xs`}>
                <thead className="bg-slate-100 text-slate-600 font-black">
                  <tr>
                    <th className="p-3.5">{lang === "en" ? "Employee Name" : "اسم الموظف"}</th>
                    <th className="p-3.5">{lang === "en" ? "Employee ID" : "الرقم الوظيفي"}</th>
                    <th className="p-3.5">{lang === "en" ? "Branch Code" : "رقم الفرع"}</th>
                    <th className="p-3.5">{lang === "en" ? "Request Date" : "تاريخ الطلب"}</th>
                    <th className={`p-3.5 ${lang === "ar" ? "text-left" : "text-right"}`}>{lang === "en" ? "Approval Actions (Admin)" : "إجراءات الموافقة (الأدمن)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                  {requests.filter((r) => r.status === "pending").map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-black text-slate-900">{getEmployeeName(req.full_name)}</td>
                      <td className="p-3.5 font-mono text-slate-700">#{req.employee_id}</td>
                      <td className="p-3.5"><span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-mono font-bold">{req.branch_code}</span></td>
                      <td className="p-3.5 text-slate-400 font-normal">{new Date(req.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</td>
                      <td className={`p-3.5 ${lang === "ar" ? "text-left" : "text-right"} space-x-2`}>
                        <button
                          onClick={() => handleApprove(req.id, "staff")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition"
                        >
                          <i className={`ph-bold ph-check ${lang === "ar" ? "ml-1" : "mr-1"}`}></i>
                          {lang === "en" ? "Approve & Activate" : "موافقة وتفعيل"}
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-bold transition"
                        >
                          <i className={`ph-bold ph-x ${lang === "ar" ? "ml-1" : "mr-1"}`}></i>
                          {lang === "en" ? "Reject Request" : "رفض الطلب"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active Approved Employees */}
      {activeTab === "employees" && (
        <div>
          {employees.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p>{lang === "en" ? "No active employees found" : "لا يوجد موظفون معتمدون في النظام"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className={`w-full ${lang === "ar" ? "text-right" : "text-left"} text-xs`}>
                <thead className="bg-slate-100 text-slate-600 font-black">
                  <tr>
                    <th className="p-3.5">{lang === "en" ? "Employee Name" : "اسم الموظف"}</th>
                    <th className="p-3.5">{lang === "en" ? "Employee ID" : "الرقم الوظيفي"}</th>
                    <th className="p-3.5">{lang === "en" ? "Branch" : "الفرع"}</th>
                    <th className="p-3.5">{lang === "en" ? "Role" : "الدور (Role)"}</th>
                    <th className="p-3.5">{lang === "en" ? "Account Status" : "حالة الحساب"}</th>
                    <th className={`p-3.5 ${lang === "ar" ? "text-left" : "text-right"}`}>{lang === "en" ? "Account Control" : "التحكم بالحساب"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id || emp.employee_id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-black text-slate-900">{getEmployeeName(emp.full_name)}</td>
                      <td className="p-3.5 font-mono text-slate-700">#{emp.employee_id}</td>
                      <td className="p-3.5"><span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono">{emp.branch_code}</span></td>
                      <td className="p-3.5"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">{emp.role}</span></td>
                      <td className="p-3.5">
                        {emp.is_active ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === "en" ? "Active" : "نشط"}
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-bold">
                            {lang === "en" ? "Inactive" : "معطل"}
                          </span>
                        )}
                      </td>
                      <td className={`p-3.5 ${lang === "ar" ? "text-left" : "text-right"} flex items-center justify-end gap-2`}>
                        <button
                          onClick={() => openTransferModal(emp)}
                          title={lang === "en" ? "Transfer employee to another branch" : "نقل الموظف إلى فرع آخر"}
                          className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 px-3 py-1.5 rounded-lg font-bold transition text-xs flex items-center gap-1"
                        >
                          <i className="ph-bold ph-arrows-left-right text-violet-600"></i>
                          {lang === "en" ? "Transfer Branch" : "نقل الفرع"}
                        </button>
                        <button
                          onClick={() => handleToggleActive(emp.employee_id, emp.is_active)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition text-xs ${
                            emp.is_active
                              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {emp.is_active ? (lang === "en" ? "Disable Account" : "تعطيل الحساب") : (lang === "en" ? "Activate Account" : "تفعيل الحساب")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Branches & Full Catalog Control */}
      {activeTab === "branches" && (
        <div className="space-y-6">
          
          {/* Form to Add New Branch */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5">
            <h3 className="text-xs font-black text-slate-700 uppercase mb-3 flex items-center gap-2">
              <i className="ph-bold ph-plus-circle text-violet-600 text-base"></i>
              {lang === "en" ? "Add New Branch" : "إضافة فرع جديد للنظام"}
            </h3>
            <form onSubmit={handleAddBranchSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                maxLength={7}
                value={newBranchCode}
                onChange={(e) => setNewBranchCode(e.target.value.replace(/\D/g, ""))}
                placeholder={lang === "en" ? "Branch Code (7 digits - e.g. 1010004)" : "رقم الفرع (من 7 أرقام - مثال: 1010004)"}
                className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold font-mono tracking-wider outline-none focus:border-violet-600 flex-1"
              />
              <input
                type="text"
                required
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder={lang === "en" ? "Branch Name (e.g. Al Khobar Branch)" : "اسم الفرع (مثال: فرع الخبر - الكورنيش)"}
                className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-violet-600 flex-[2]"
              />
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
              >
                <i className="ph-bold ph-check"></i>
                {lang === "en" ? "Add Branch" : "إضافة الفرع"}
              </button>
            </form>
          </div>

          {/* List of Branches */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => {
              const isSelected = selectedBranch === b.branch_code;
              const bName = getBranchName(b.branch_code, b.branch_name);
              return (
                <div
                  key={b.branch_code}
                  className={`border rounded-2xl p-4 transition relative flex flex-col justify-between ${
                    isSelected
                      ? "border-violet-500 bg-violet-50/50 shadow-md ring-2 ring-violet-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="bg-slate-900 text-white font-mono text-xs px-2.5 py-1 rounded-lg font-bold">
                        {b.branch_code}
                      </span>
                      {b.is_active ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {lang === "en" ? "Active" : "نشط"}
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {lang === "en" ? "Inactive" : "معطل"}
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-sm text-slate-800 mb-1">{bName}</h4>
                    <p className="text-xs text-slate-500 font-bold mb-3 flex items-center gap-1">
                      <i className="ph-bold ph-package text-emerald-600"></i>
                      {lang === "en" ? "Branch Products:" : "منتجات الفرع:"}{" "}
                      <span className="text-slate-900 font-extrabold">
                        {lang === "en" ? "256 items (Full Count)" : "256 منتج (عدد كامل)"}
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedBranch(b.branch_code);
                          navigate("/");
                        }}
                        className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            : "bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                        }`}
                        title={lang === "en" ? "Enter Branch & Inventory" : "دخول الفرع وشاشة الجرد"}
                      >
                        <i className="ph-bold ph-sign-in"></i>
                        {isSelected
                          ? (lang === "en" ? "Enter Current Branch" : "دخول الفرع الحالي")
                          : (lang === "en" ? "Enter Branch" : "دخول الفرع")}
                      </button>

                      <button
                        onClick={() => openEditBranchModal(b)}
                        title={lang === "en" ? "Edit Branch" : "تعديل اسم أو رقم الفرع"}
                        className="p-2 text-violet-600 hover:bg-violet-50 transition rounded-lg text-sm border border-violet-200"
                      >
                        <i className="ph-bold ph-pencil-simple"></i>
                      </button>

                      <button
                        onClick={() => handleToggleBranch(b.branch_code, b.is_active)}
                        title={lang === "en" ? "Enable/Disable Branch" : "تعطيل/تفعيل الفرع"}
                        className="p-2 text-slate-500 hover:bg-slate-100 transition rounded-lg text-sm border border-slate-200"
                      >
                        <i className={`ph-bold ${b.is_active ? "ph-power text-emerald-600" : "ph-power text-amber-600"}`}></i>
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(b.branch_code, b.branch_name)}
                        title={lang === "en" ? "Delete Branch Permanently" : "حذف الفرع نهائياً"}
                        className="p-2 text-red-600 hover:bg-red-50 transition rounded-lg text-sm border border-red-200"
                      >
                        <i className="ph-bold ph-trash"></i>
                      </button>
                    </div>

                    <button
                      onClick={() => setViewingBranch(b)}
                      className="w-full py-2 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <i className="ph-bold ph-eye text-sm"></i>
                      {lang === "en" ? "View Employees, Audits & Orders" : "عرض تفاصيل الفرع، الموظفين والجرد"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Modal: Edit Branch */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <i className="ph-bold ph-pencil-simple text-violet-600 text-lg"></i>
                {lang === "en" ? "Edit Branch Data" : "تعديل بيانات الفرع (رقم واسم الفرع)"}
              </h3>
              <button
                onClick={() => setEditingBranch(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBranchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === "en" ? "Branch Code (7 digits) *" : "رقم الفرع الجديد (من 7 أرقام) *"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={7}
                  value={editBranchCode}
                  onChange={(e) => setEditBranchCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold font-mono tracking-wider outline-none focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === "en" ? "Branch Name *" : "اسم الفرع الجديد *"}
                </label>
                <input
                  type="text"
                  required
                  value={editBranchName}
                  onChange={(e) => setEditBranchName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-violet-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition"
                >
                  {lang === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  <i className="ph-bold ph-floppy-disk"></i>
                  {lang === "en" ? "Save Changes" : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer Employee */}
      {transferringEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <i className="ph-bold ph-arrows-left-right text-violet-600 text-lg"></i>
                {lang === "en" ? "Transfer Employee to Another Branch" : "نقل موظف إلى فرع آخر"}
              </h3>
              <button
                onClick={() => setTransferringEmployee(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">{lang === "en" ? "Employee Name:" : "اسم الموظف:"}</span>
                  <span className="font-black text-slate-900">{getEmployeeName(transferringEmployee.full_name)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">{lang === "en" ? "Employee ID:" : "الرقم الوظيفي:"}</span>
                  <span className="font-mono font-bold text-slate-700">#{transferringEmployee.employee_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">{lang === "en" ? "Current Branch:" : "الفرع الحالي:"}</span>
                  <span className="bg-orange-50 text-orange-700 font-mono font-bold px-2 py-0.5 rounded border border-orange-200">
                    {transferringEmployee.branch_code}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === "en" ? "Select New Target Branch *" : "اختر الفرع الجديد المطلوب نقل الموظف إليه *"}
                </label>
                <select
                  value={targetBranchCode}
                  onChange={(e) => setTargetBranchCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-violet-600"
                >
                  {branches.map((b) => (
                    <option key={b.branch_code} value={b.branch_code}>
                      {b.branch_code} - {getBranchName(b.branch_code, b.branch_name)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferringEmployee(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition"
                >
                  {lang === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  <i className="ph-bold ph-check-circle"></i>
                  {lang === "en" ? "Confirm Transfer" : "تأكيد نقل الموظف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submission Details */}
      {selectedSubmission && (
        <SubmissionDetailsModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onMarkReviewed={(id) => {
            handleToggleSubmissionStatus(id, "pending");
          }}
        />
      )}

      {/* Modal: Branch Details & Audits */}
      {viewingBranch && (
        <BranchDetailsModal
          branch={viewingBranch}
          employees={employees}
          onClose={() => setViewingBranch(null)}
          onTransferEmployee={openTransferModal}
          onToggleActive={handleToggleActive}
        />
      )}

    </div>
  );
}

function BranchDetailsModal({
  branch,
  employees,
  onClose,
  onTransferEmployee,
  onToggleActive,
}: {
  branch: BranchRecord;
  employees: EmployeeRecord[];
  onClose: () => void;
  onTransferEmployee: (emp: EmployeeRecord) => void;
  onToggleActive: (empId: string, currentActive: boolean) => void;
}) {
  const { lang, getProductName, getUnitName, getBranchName, getEmployeeName, t } = useLanguage();
  const { setSelectedBranch } = useAuth();
  const [tab, setTab] = useState<"employees" | "audits" | "orders">("employees");

  const auditsQuery = trpc.audit.list.useQuery();
  const snapshotsQuery = trpc.inventory.snapshots.useQuery();
  const productsQuery = trpc.inventory.list.useQuery();

  const branchEmployees = employees.filter((e) => e.branch_code === branch.branch_code);
  const audits = auditsQuery.data ?? [];
  const snapshots = snapshotsQuery.data ?? [];
  const orderedItems = (productsQuery.data ?? []).filter((p) => p.orderQty != null && p.orderQty > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-600/30">
              <i className="ph-bold ph-storefront"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                  {branch.branch_code}
                </span>
                {branch.is_active ? (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {lang === "en" ? "Active Branch" : "فرع نشط"}
                  </span>
                ) : (
                  <span className="bg-red-500/20 text-red-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-red-500/30">
                    {lang === "en" ? "Inactive Branch" : "فرع معطل"}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-extrabold mt-0.5">{getBranchName(branch.branch_code, branch.branch_name)}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedBranch(branch.branch_code);
                onClose();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md"
            >
              <i className="ph-bold ph-sign-in"></i>
              {lang === "en" ? "Switch to Branch" : "دخول هذا الفرع"}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
              <i className="ph-bold ph-x text-lg"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setTab("employees")}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-2 ${
              tab === "employees"
                ? "bg-white text-violet-700 border-b-2 border-violet-600 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="ph-bold ph-users text-base"></i>
            {lang === "en" ? "Registered Employees" : "الموظفين المسجلين"}
            <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full text-[10px] font-black">
              {branchEmployees.length}
            </span>
          </button>

          <button
            onClick={() => setTab("audits")}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-2 ${
              tab === "audits"
                ? "bg-white text-violet-700 border-b-2 border-violet-600 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="ph-bold ph-clipboard-text text-base"></i>
            {lang === "en" ? "Audits & History" : "سجل الجرد الأسبوعي/الشهري"}
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black">
              {audits.length + snapshots.length}
            </span>
          </button>

          <button
            onClick={() => setTab("orders")}
            className={`flex-1 py-3 text-center transition flex items-center justify-center gap-2 ${
              tab === "orders"
                ? "bg-white text-violet-700 border-b-2 border-violet-600 font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <i className="ph-bold ph-shopping-cart text-base"></i>
            {lang === "en" ? "Warehouse Cargo Orders" : "طلبات البضاعة"}
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-black">
              {orderedItems.length}
            </span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {tab === "employees" && (
            <div>
              {branchEmployees.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-users-three text-4xl text-slate-300 mb-2"></i>
                  <p>{lang === "en" ? "No registered employees in this branch" : "لا يوجد موظفون مسجلون في هذا الفرع حالياً"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className={`w-full ${lang === "ar" ? "text-right" : "text-left"} text-xs`}>
                    <thead className="bg-slate-100 text-slate-600 font-black">
                      <tr>
                        <th className="p-3">{lang === "en" ? "Employee Name" : "اسم الموظف"}</th>
                        <th className="p-3">{lang === "en" ? "Employee ID" : "الرقم الوظيفي"}</th>
                        <th className="p-3">{lang === "en" ? "Role" : "الدور"}</th>
                        <th className="p-3">{lang === "en" ? "Status" : "الحالة"}</th>
                        <th className={`p-3 ${lang === "ar" ? "text-left" : "text-right"}`}>{lang === "en" ? "Actions" : "التحكم"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                      {branchEmployees.map((emp) => (
                        <tr key={emp.id || emp.employee_id} className="hover:bg-slate-50 transition">
                          <td className="p-3 font-black text-slate-900">{getEmployeeName(emp.full_name)}</td>
                          <td className="p-3 font-mono text-slate-700">#{emp.employee_id}</td>
                          <td className="p-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">{emp.role}</span></td>
                          <td className="p-3">
                            {emp.is_active ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">{lang === "en" ? "Active" : "نشط"}</span>
                            ) : (
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">{lang === "en" ? "Inactive" : "معطل"}</span>
                            )}
                          </td>
                          <td className={`p-3 ${lang === "ar" ? "text-left" : "text-right"} space-x-1.5`}>
                            <button
                              onClick={() => {
                                onClose();
                                onTransferEmployee(emp);
                              }}
                              className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition"
                              title={lang === "en" ? "Transfer Branch" : "نقل لفرع آخر"}
                            >
                              <i className="ph-bold ph-arrows-left-right"></i>
                            </button>
                            <button
                              onClick={() => onToggleActive(emp.employee_id, emp.is_active)}
                              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                                emp.is_active
                                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }`}
                            >
                              {emp.is_active ? (lang === "en" ? "Disable" : "تعطيل") : (lang === "en" ? "Enable" : "تفعيل")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "audits" && (
            <div className="space-y-3">
              {audits.length === 0 && snapshots.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-clipboard text-4xl text-slate-300 mb-2"></i>
                  <p>{lang === "en" ? "No audits or snapshots recorded for this branch yet" : "لم يتم تسجيل أي جرد أسبوعي أو شهري لهذا الفرع حتى الآن"}</p>
                </div>
              ) : (
                <>
                  {audits.map((audit) => (
                    <div key={audit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                            audit.auditType === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {audit.auditType === "weekly" ? (lang === "en" ? "Weekly Audit" : "جرد أسبوعي") : (lang === "en" ? "Monthly Audit" : "جرد شهري")}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            audit.status === "completed" ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}>
                            {audit.status === "completed" ? (lang === "en" ? "Completed" : "مكتمل") : (lang === "en" ? "Draft" : "مسودة")}
                          </span>
                        </div>
                        <h5 className="font-extrabold text-sm text-slate-800">
                          {lang === "en" ? "Auditor:" : "المحـرر:"} {getEmployeeName(audit.auditorName)}
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(audit.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                        </p>
                      </div>
                      {audit.notes && (
                        <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs text-slate-600 max-w-xs font-medium">
                          {audit.notes}
                        </div>
                      )}
                    </div>
                  ))}

                  {snapshots.map((snap) => (
                    <div key={snap.id} className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                          {snap.period === "weekly" ? (lang === "en" ? "Weekly Snapshot" : "لقطة جرد أسبوعي") : (lang === "en" ? "Monthly Snapshot" : "لقطة جرد شهري")}
                        </span>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          {new Date(snap.capturedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-white border border-amber-200 px-3 py-1 rounded-xl">
                        {lang === "en" ? "Saved Catalog Snapshot" : "نسخة محفوظة لجرد الفرع"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-3">
              {orderedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-shopping-cart text-4xl text-slate-300 mb-2"></i>
                  <p>{lang === "en" ? "No active warehouse cargo orders for this branch" : "لا توجد طلبات بضاعة مستودع مسجلة لهذا الفرع حالياً"}</p>
                </div>
              ) : (
                orderedItems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">#{p.code}</span>
                        <span className="text-xs font-bold text-slate-500">{getUnitName(p.unitCode, p.unitLabel)}</span>
                      </div>
                      <h5 className="text-sm font-extrabold text-slate-800">{getProductName(p)}</h5>
                    </div>
                    <div className="bg-amber-100 text-amber-950 font-black px-3.5 py-1.5 rounded-xl text-sm font-mono shadow-sm">
                      {lang === "en" ? `Order Qty: ${p.orderQty}` : `الكمية المطلوبة: ${p.orderQty}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl transition text-xs"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmissionDetailsModal({
  submission,
  onClose,
  onMarkReviewed,
}: {
  submission: AdminSubmission;
  onClose: () => void;
  onMarkReviewed: (id: string) => void;
}) {
  const { lang, getBranchName, getEmployeeName } = useLanguage();

  const copyOrder = () => {
    if (!submission.details.items) return;
    let text = `📋 ${submission.title}:\n\n`;
    text += `👤 الموظف: ${getEmployeeName(submission.employee_name)} (#${submission.employee_id})\n`;
    text += `🏬 الفرع: [${submission.branch_code}] ${getBranchName(submission.branch_code, submission.branch_name)}\n`;
    text += `📅 التاريخ: ${new Date(submission.created_at).toLocaleString()}\n\n`;
    submission.details.items.forEach((item, i) => {
      text += `${i + 1}. [${item.code}] ${item.nameAr}\n   👈 الكمية: ${item.qty ?? item.actualQty ?? 0} (${item.unit || "عدد"})\n\n`;
    });
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl ${
              submission.type === "cargo_order" ? "bg-amber-600 shadow-amber-600/30" : "bg-blue-600 shadow-blue-600/30"
            }`}>
              <i className={`ph-bold ${submission.type === "cargo_order" ? "ph-package" : "ph-clipboard-text"}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                  [{submission.branch_code}] {getBranchName(submission.branch_code, submission.branch_name)}
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  submission.status === "pending" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}>
                  {submission.status === "pending" ? (lang === "en" ? "New / Unread" : "جديد / لم يُقرأ") : (lang === "en" ? "Reviewed" : "تم الإطلاع")}
                </span>
              </div>
              <h3 className="text-lg font-extrabold mt-0.5">{submission.title} - {getEmployeeName(submission.employee_name)}</h3>
            </div>
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition">
            <i className="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-bold">{lang === "en" ? "Employee:" : "الموظف:"}</span>
              <span className="font-black text-slate-900">{getEmployeeName(submission.employee_name)}</span>
              <span className="text-slate-500 font-mono block">#{submission.employee_id}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">{lang === "en" ? "Branch:" : "الفرع:"}</span>
              <span className="font-black text-slate-900">{getBranchName(submission.branch_code, submission.branch_name)}</span>
              <span className="text-slate-500 font-mono block">#{submission.branch_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">{lang === "en" ? "Date & Time:" : "التاريخ والوقت:"}</span>
              <span className="font-bold text-slate-800">{new Date(submission.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">{lang === "en" ? "Items Count:" : "عدد المواد:"}</span>
              <span className="font-mono font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200 inline-block mt-0.5">
                {submission.details.item_count || submission.details.items?.length || 0} {lang === "en" ? "items" : "منتج"}
              </span>
            </div>
          </div>

          {submission.details.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 font-bold">
              <span className="text-amber-700 block mb-0.5">{lang === "en" ? "General Notes:" : "ملاحظات العامة:"}</span>
              {submission.details.notes}
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className={`w-full ${lang === "ar" ? "text-right" : "text-left"} text-xs`}>
              <thead className="bg-slate-100 text-slate-600 font-black">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">{lang === "en" ? "Code" : "الكود"}</th>
                  <th className="p-3">{lang === "en" ? "Product Name" : "اسم المنتج"}</th>
                  <th className="p-3">{lang === "en" ? "Unit" : "الوحدة"}</th>
                  {submission.type === "cargo_order" ? (
                    <th className="p-3">{lang === "en" ? "Order Qty" : "الكمية المطلوبة"}</th>
                  ) : (
                    <>
                      <th className="p-3">{lang === "en" ? "System Qty" : "السيستم"}</th>
                      <th className="p-3">{lang === "en" ? "Actual Qty" : "الفعلي"}</th>
                      <th className="p-3">{lang === "en" ? "Diff" : "الفرق"}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                {submission.details.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono text-blue-600 font-extrabold">#{item.code}</td>
                    <td className="p-3 font-black text-slate-900">{lang === "en" ? item.nameEn || item.nameAr : item.nameAr}</td>
                    <td className="p-3 text-slate-600">{item.unit || "عدد"}</td>
                    {submission.type === "cargo_order" ? (
                      <td className="p-3">
                        <span className="bg-amber-100 text-amber-950 font-black px-2.5 py-1 rounded-lg font-mono">
                          {item.qty}
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="p-3 font-mono text-slate-600">{item.systemQty ?? "—"}</td>
                        <td className="p-3 font-mono text-slate-900 font-black">{item.actualQty ?? "—"}</td>
                        <td className="p-3 font-mono">
                          {(() => {
                            const diffVal = item.diff ?? (item.actualQty != null && item.systemQty != null ? item.actualQty - item.systemQty : null);
                            if (diffVal == null) return "—";
                            if (diffVal === 0) return <span className="text-slate-400">0</span>;
                            if (diffVal > 0) return <span className="text-emerald-600 font-black">+{diffVal}</span>;
                            return <span className="text-red-600 font-black">{diffVal}</span>;
                          })()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {submission.type === "cargo_order" ? (
            <button
              onClick={copyOrder}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5 shadow-md"
            >
              <i className="ph-bold ph-copy"></i>
              {lang === "en" ? "Copy Order Text" : "نسخ نص الطلب"}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {submission.status === "pending" && (
              <button
                onClick={() => {
                  onMarkReviewed(submission.id);
                  onClose();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5 shadow-md"
              >
                <i className="ph-bold ph-check-circle"></i>
                {lang === "en" ? "Mark as Reviewed" : "تحديد كـ تم الإطلاع"}
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl transition text-xs"
            >
              {lang === "en" ? "Close" : "إغلاق"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

