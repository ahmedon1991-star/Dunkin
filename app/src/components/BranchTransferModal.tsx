import React, { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";
import type { BranchTransfer } from "../../api/queries/products";

export interface BranchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "create" | "outgoing" | "incoming" | "inbound" | "archive";
}

export function BranchTransferModal({
  isOpen,
  onClose,
  defaultTab = "outgoing",
}: BranchTransferModalProps) {
  const { lang, t, getProductName, getBranchName, getEmployeeName } = useLanguage();
  const { session, selectedBranch, branchesList } = useAuth();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"create" | "outgoing" | "incoming" | "inbound" | "archive">(defaultTab);
  const [selectedTransferForView, setSelectedTransferForView] = useState<BranchTransfer | null>(null);
  const [receivingTransfer, setReceivingTransfer] = useState<BranchTransfer | null>(null);
  const [fulfillingTransfer, setFulfillingTransfer] = useState<BranchTransfer | null>(null);

  // New Transfer Form State
  const [targetBranchCode, setTargetBranchCode] = useState(() => {
    const other = branchesList.find((b) => b.branch_code !== selectedBranch);
    return other?.branch_code || "1010001";
  });
  const [transferNotes, setTransferNotes] = useState("");
  const [transferItems, setTransferItems] = useState<
    Array<{
      code: string;
      nameAr: string;
      nameEn?: string;
      unit: string;
      requestedQty: number;
      notes?: string;
    }>
  >([]);
  const [productSearch, setProductSearch] = useState("");

  // Fulfill (Source branch dispatch) state
  const [dispatchItems, setDispatchItems] = useState<Record<string, number>>({});
  const [dispatchNotes, setDispatchNotes] = useState("");

  // Receiving state
  const [receivedItemsState, setReceivedItemsState] = useState<
    Record<string, { qty: number; status: "received_full" | "received_partial" | "not_received"; notes: string }>
  >({});
  const [receiveNotes, setReceiveNotes] = useState("");

  // Products catalog query
  const productsQuery = trpc.inventory.list.useQuery();
  const allProducts = productsQuery.data ?? [];

  // Transfers query
  const transfersQuery = trpc.inventory.listTransfers.useQuery();
  const allTransfers = transfersQuery.data ?? [];

  // Mutations
  const createMut = trpc.inventory.createTransfer.useMutation({
    onSuccess: () => {
      utils.inventory.listTransfers.invalidate();
      setActiveTab("outgoing");
      setTransferItems([]);
      setTransferNotes("");
    },
  });

  const dispatchMut = trpc.inventory.sourceDispatchTransfer.useMutation({
    onSuccess: () => {
      utils.inventory.listTransfers.invalidate();
      setFulfillingTransfer(null);
    },
  });

  const receiveMut = trpc.inventory.destinationReceiveTransfer.useMutation({
    onSuccess: () => {
      utils.inventory.listTransfers.invalidate();
      utils.inventory.list.invalidate();
      utils.inventory.stockLogs.invalidate();
      setReceivingTransfer(null);
    },
  });

  if (!isOpen) return null;

  // Filter transfers for current branch
  const myOutgoing = allTransfers.filter((t) => t.toBranchCode === selectedBranch && t.status !== "completed");
  const myIncomingFulfill = allTransfers.filter(
    (t) => t.fromBranchCode === selectedBranch && (t.status === "approved_by_admin" || t.status === "dispatched_by_source")
  );
  const myInboundReceiving = allTransfers.filter((t) => t.toBranchCode === selectedBranch && t.status === "in_transit");
  const myArchive = allTransfers.filter(
    (t) => (t.toBranchCode === selectedBranch || t.fromBranchCode === selectedBranch) && (t.status === "completed" || t.status === "rejected")
  );

  // Available source branches (exclude current)
  const availableSourceBranches = branchesList.filter((b) => b.branch_code !== selectedBranch);

  const getTargetBranchName = (code: string) => {
    const b = branchesList.find((x) => x.branch_code === code);
    return b ? getBranchName(b.branch_code, b.branch_name) : `فرع ${code}`;
  };

  const addItemToTransfer = (prod: (typeof allProducts)[0], unit: string, qty: number) => {
    setTransferItems((prev) => {
      const idx = prev.findIndex((i) => i.code === prod.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].requestedQty += qty;
        return next;
      }
      return [
        ...prev,
        {
          code: prod.code,
          nameAr: prod.nameAr,
          nameEn: prod.nameEn || undefined,
          unit,
          requestedQty: qty,
        },
      ];
    });
  };

  const removeItemFromTransfer = (code: string) => {
    setTransferItems((prev) => prev.filter((i) => i.code !== code));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0) {
      alert(lang === "en" ? "Please select at least one product to transfer" : "يرجى اختيار صنف واحد على الأقل للطلب");
      return;
    }
    const targetBranchObj = branchesList.find((b) => b.branch_code === targetBranchCode);
    const currBranchObj = branchesList.find((b) => b.branch_code === selectedBranch);

    createMut.mutate({
      fromBranchCode: targetBranchCode,
      fromBranchName: targetBranchObj?.branch_name || `فرع ${targetBranchCode}`,
      toBranchCode: selectedBranch,
      toBranchName: currBranchObj?.branch_name || `فرع ${selectedBranch}`,
      requestedBy: session?.full_name || "موظف الفرع",
      requestedById: session?.employee_id || "#101",
      notes: transferNotes,
      items: transferItems,
    });
  };

  // Open Fulfill modal
  const openFulfillModal = (transfer: BranchTransfer) => {
    setFulfillingTransfer(transfer);
    const initial: Record<string, number> = {};
    transfer.items.forEach((i) => {
      initial[i.code] = i.adminApprovedQty ?? i.requestedQty;
    });
    setDispatchItems(initial);
    setDispatchNotes("");
  };

  // Handle Dispatch Confirm
  const handleConfirmDispatch = () => {
    if (!fulfillingTransfer) return;
    dispatchMut.mutate({
      id: fulfillingTransfer.id,
      employeeName: session?.full_name || "موظف الفرع المرسل",
      notes: dispatchNotes,
      items: fulfillingTransfer.items.map((i) => ({
        code: i.code,
        dispatchedQty: dispatchItems[i.code] ?? (i.adminApprovedQty ?? i.requestedQty),
        notes: dispatchItems[i.code] < (i.adminApprovedQty ?? i.requestedQty) ? "تم تعديل الكمية حسب المتوفر" : undefined,
      })),
    });
  };

  // Open Receiving Modal
  const openReceivingModal = (transfer: BranchTransfer) => {
    setReceivingTransfer(transfer);
    const initial: Record<string, { qty: number; status: "received_full" | "received_partial" | "not_received"; notes: string }> = {};
    transfer.items.forEach((i) => {
      const dQty = i.dispatchedQty ?? i.requestedQty;
      initial[i.code] = {
        qty: dQty,
        status: "received_full",
        notes: "",
      };
    });
    setReceivedItemsState(initial);
    setReceiveNotes("");
  };

  // Handle Receive Confirm
  const handleConfirmReceive = () => {
    if (!receivingTransfer) return;
    receiveMut.mutate({
      id: receivingTransfer.id,
      receivedBy: session?.full_name || "موظف الفرع المستلم",
      notes: receiveNotes,
      items: receivingTransfer.items.map((i) => {
        const state = receivedItemsState[i.code] || {
          qty: i.dispatchedQty ?? i.requestedQty,
          status: "received_full",
          notes: "",
        };
        return {
          code: i.code,
          receivedQty: state.qty,
          itemStatus: state.status,
          notes: state.notes,
        };
      }),
    });
  };

  // Print Transfer PDF
  const printTransferPdf = (t: BranchTransfer) => {
    const printWindow = window.open("", "_blank", "width=900,height=750");
    if (!printWindow) return;
    const rows = t.items
      .map(
        (i, idx) =>
          `<tr>
            <td>${idx + 1}</td>
            <td>${i.code}</td>
            <td><b>${i.nameAr}</b><br><small>${i.nameEn || ""}</small></td>
            <td>${i.unit}</td>
            <td>${i.requestedQty}</td>
            <td>${i.adminApprovedQty ?? i.requestedQty}</td>
            <td>${i.dispatchedQty ?? "-"}</td>
            <td>${i.receivedQty ?? "-"}</td>
          </tr>`
      )
      .join("");

    const timelineRows = t.timeline
      .map(
        (tl) =>
          `<li><b>${new Date(tl.timestamp).toLocaleString("ar-EG")}</b> - <b>${tl.action}</b> (${tl.by} - ${tl.role}) ${
            tl.notes ? `<br><i>ملاحظة: ${tl.notes}</i>` : ""
          }</li>`
      )
      .join("");

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>سند تحويل بضاعة بين الفروع #${t.transferNo}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; }
            .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-weight: bold; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 13px; }
            .meta-item { background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; }
            th { background: #f1f5f9; font-weight: bold; }
            .timeline { margin-top: 25px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
            ul { font-size: 12px; line-height: 1.8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 style="margin:0;">سند تحويل بضاعة بين الفروع الرسمية</h2>
              <p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">دانكن دونتس - المملكة العربية السعودية</p>
            </div>
            <div>
              <span class="badge">رقم المعاملة: ${t.transferNo}</span>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><b>الفرع الطالب (المستلم):</b> ${t.toBranchName} (${t.toBranchCode})<br><b>بواسطة:</b> ${t.requestedBy}</div>
            <div class="meta-item"><b>الفرع المصدر (المرسل):</b> ${t.fromBranchName} (${t.fromBranchCode})<br><b>تاريخ الطلب:</b> ${new Date(t.requestedAt).toLocaleString("ar-EG")}</div>
            <div class="meta-item"><b>حالة المعاملة:</b> ${t.status === "completed" ? "مكتمل ومؤرشف بنجاح ✅" : t.status}</div>
            <div class="meta-item"><b>اعتماد الأدمن:</b> ${t.adminInitialBy || "معتمد"}</div>
          </div>

          <h3>قائمة الأصناف المحولة:</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>كود الصنف</th>
                <th>اسم المنتج</th>
                <th>الوحدة</th>
                <th>المطلوب</th>
                <th>معتمد الأدمن</th>
                <th>المشحون</th>
                <th>المستلم</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="timeline">
            <h4>سجل الحركات والاعتمادات الرسمية (Audit Trail):</h4>
            <ul>${timelineRows}</ul>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const getStatusBadge = (status: BranchTransfer["status"]) => {
    switch (status) {
      case "pending_admin_initial":
        return <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">1. بانتظار موافقة الأدمن ⏳</span>;
      case "approved_by_admin":
        return <span className="bg-blue-100 text-blue-900 border border-blue-300 text-xs px-2.5 py-1 rounded-full font-bold">2. بانتظار تجهيز وشحن الفرع 📦</span>;
      case "dispatched_by_source":
        return <span className="bg-purple-100 text-purple-900 border border-purple-300 text-xs px-2.5 py-1 rounded-full font-bold">3. تم الشحن (بانتظار اعتماد الأدمن) 🚚</span>;
      case "in_transit":
        return <span className="bg-teal-100 text-teal-950 border border-teal-300 text-xs px-2.5 py-1 rounded-full font-bold animate-pulse">4. الشحنة في الطريق - جاهزة للاستلام 📥</span>;
      case "completed":
        return <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold">5. مكتمل ومؤرشف بالمخزون 🟢</span>;
      case "rejected":
        return <span className="bg-rose-100 text-rose-900 border border-rose-300 text-xs px-2.5 py-1 rounded-full font-bold">مرفوض ❌</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <i className="ph-bold ph-arrows-left-right text-2xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  {lang === "en" ? "Inter-Branch Transfer Hub" : "مركز التحويل والطلبات بين الفروع"}
                </h2>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-mono px-2 py-0.5 rounded-md font-bold">
                  {selectedBranch}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {lang === "en" ? "Multi-party lifecycle: Request -> Admin -> Source -> Admin -> Receive" : "دورة اعتماد كاملة: الفرع الطالب -> الأدمن -> الفرع المرسل -> الأدمن -> الاستلام وتحديث المخزون"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700"
          >
            <i className="ph-bold ph-x text-lg"></i>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 sm:px-6 flex items-center gap-2 overflow-x-auto text-xs font-black">
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "outgoing"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className="ph-bold ph-paper-plane-tilt"></i>
            <span>{lang === "en" ? "Outgoing Requests" : "طلباتنا الصادرة"}</span>
            {myOutgoing.length > 0 && (
              <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {myOutgoing.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("incoming")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "incoming"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className="ph-bold ph-package"></i>
            <span>{lang === "en" ? "Incoming to Fulfill (Source)" : "طلبات واردة للتجهيز والشحن"}</span>
            {myIncomingFulfill.length > 0 && (
              <span className="bg-amber-500 text-white px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {myIncomingFulfill.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("inbound")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "inbound"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className="ph-bold ph-truck"></i>
            <span>{lang === "en" ? "In-Transit to Receive" : "شحنات في الطريق للاستلام"}</span>
            {myInboundReceiving.length > 0 && (
              <span className="bg-teal-600 text-white px-1.5 py-0.2 rounded-full font-mono text-[10px] animate-bounce">
                {myInboundReceiving.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "create"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
            }`}
          >
            <i className="ph-bold ph-plus-circle text-sm"></i>
            <span>{lang === "en" ? "New Transfer Request" : "طلب تحويل جديد +"}</span>
          </button>

          <button
            onClick={() => setActiveTab("archive")}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "archive"
                ? "bg-slate-800 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <i className="ph-bold ph-archive-box"></i>
            <span>{lang === "en" ? "Transfer Archive" : "أرشيف التحويلات"}</span>
            {myArchive.length > 0 && (
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {myArchive.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/60">
          {/* TAB: CREATE NEW TRANSFER */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateSubmit} className="space-y-5 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <i className="ph-bold ph-storefront text-indigo-600 text-lg"></i>
                  <span>{lang === "en" ? "1. Select Source Branch (Fulfiller):" : "1. اختر الفرع المطلوب منه التحويل (الفرع المصدر):"}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      {lang === "en" ? "Target Source Branch *" : "الفرع المطلوب منه البضاعة *"}
                    </label>
                    <select
                      value={targetBranchCode}
                      onChange={(e) => setTargetBranchCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-600"
                    >
                      {availableSourceBranches.map((b) => (
                        <option key={b.branch_code} value={b.branch_code}>
                          {b.branch_code} - {getBranchName(b.branch_code, b.branch_name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      {lang === "en" ? "Requesting Branch (Destination)" : "الفرع الطالب (المستلم)"}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedBranch} - ${getTargetBranchName(selectedBranch)}`}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {lang === "en" ? "Transfer Reason / Operational Notes" : "سبب طلب التحويل / ملاحظات تشغيلية"}
                  </label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder={lang === "en" ? "e.g. Urgent stock shortage for weekend peak" : "مثال: عجز طارئ في الأكواب لتغطية عطلة نهاية الأسبوع"}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <i className="ph-bold ph-shopping-bag text-indigo-600 text-lg"></i>
                    <span>{lang === "en" ? "2. Add Products to Transfer:" : "2. إضافة الأصناف المطلوبة للتحويل:"}</span>
                  </h3>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    {transferItems.length} {lang === "en" ? "Items Selected" : "أصناف مختارة"}
                  </span>
                </div>

                {/* Search products to add */}
                <div className="relative">
                  <i className="ph-bold ph-magnifying-glass absolute top-3 right-3 text-slate-400"></i>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={lang === "en" ? "Search catalog to add products..." : "ابحث في الأصناف بالاسم أو الكود لإضافتها للطلب..."}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-600"
                  />
                </div>

                {productSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {allProducts
                      .filter(
                        (p) =>
                          p.nameAr.includes(productSearch) ||
                          (p.nameEn && p.nameEn.toLowerCase().includes(productSearch.toLowerCase())) ||
                          p.code.includes(productSearch)
                      )
                      .slice(0, 8)
                      .map((prod) => (
                        <div key={prod.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="font-mono text-blue-600 font-bold ml-2">#{prod.code}</span>
                            <span className="font-bold text-slate-800">{getProductName(prod)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => addItemToTransfer(prod, "كرتون 📦", 1)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold transition"
                            >
                              + كرتون 📦
                            </button>
                            <button
                              type="button"
                              onClick={() => addItemToTransfer(prod, "باكت 🗂️", 1)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold transition"
                            >
                              + باكت 🗂️
                            </button>
                            <button
                              type="button"
                              onClick={() => addItemToTransfer(prod, "حبة 낱", 1)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold transition"
                            >
                              + حبة 낱
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Selected items list */}
                {transferItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
                    <p>{lang === "en" ? "No products added yet. Search above to add items." : "لم يتم اختيار منتجات بعد. ابحث أعلاه لإضافة الأصناف والكميات."}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transferItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-2xl text-xs">
                        <div className="flex-1">
                          <span className="font-mono text-blue-700 font-bold ml-2">#{item.code}</span>
                          <span className="font-black text-slate-900">{item.nameAr}</span>
                          <span className="mr-2 text-[11px] bg-slate-200 px-2 py-0.5 rounded font-bold">{item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-bold text-slate-500">{lang === "en" ? "Qty:" : "الكمية:"}</label>
                          <input
                            type="number"
                            min={1}
                            value={item.requestedQty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setTransferItems((prev) => {
                                const next = [...prev];
                                next[idx].requestedQty = val;
                                return next;
                              });
                            }}
                            className="w-16 font-mono font-black text-center bg-white border border-slate-300 rounded-xl py-1 px-2"
                          />
                          <button
                            type="button"
                            onClick={() => removeItemFromTransfer(item.code)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                          >
                            <i className="ph-bold ph-trash text-base"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("outgoing")}
                  className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-2xl text-xs transition"
                >
                  {lang === "en" ? "Cancel" : "إلغاء"}
                </button>
                <button
                  type="submit"
                  disabled={transferItems.length === 0 || createMut.isPending}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-2xl text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                >
                  <i className="ph-bold ph-paper-plane-tilt text-base"></i>
                  <span>{createMut.isPending ? "جاري الإرسال..." : (lang === "en" ? "Submit Request to Admin 🚀" : "إرسال طلب التحويل للأدمن 🚀")}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB: OUTGOING REQUESTS */}
          {activeTab === "outgoing" && (
            <div className="space-y-4">
              {myOutgoing.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-tray text-5xl text-slate-300 mb-2 block"></i>
                  <p>{lang === "en" ? "No active outgoing transfer requests." : "لا توجد طلبات تحويل صادرة جارية حالياً من فرعكم."}</p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-3 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    + إنشاء طلب جديد
                  </button>
                </div>
              ) : (
                myOutgoing.map((t) => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            #{t.transferNo}
                          </span>
                          {getStatusBadge(t.status)}
                        </div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base mt-1.5">
                          {lang === "en" ? `Requested from: ${t.fromBranchName}` : `طلب تحويل من: ${t.fromBranchName}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTransferForView(t)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-eye"></i> {lang === "en" ? "Details" : "التفاصيل"}
                        </button>
                        <button
                          onClick={() => printTransferPdf(t)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-file-pdf"></i> PDF
                        </button>
                      </div>
                    </div>

                    {/* Items brief preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {t.items.map((i, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex justify-between items-center">
                          <span className="font-bold text-slate-800 truncate flex-1">{i.nameAr}</span>
                          <span className="font-black font-mono text-indigo-700 mr-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {i.requestedQty} {i.unit}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline status note */}
                    {t.adminInitialNotes && (
                      <div className="bg-blue-50 text-blue-900 border border-blue-200 p-2.5 rounded-xl text-xs flex items-center gap-2 font-semibold">
                        <i className="ph-bold ph-info text-blue-600"></i>
                        <span>ملاحظة الأدمن: {t.adminInitialNotes}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: INCOMING TO FULFILL (SOURCE BRANCH VIEW) */}
          {activeTab === "incoming" && (
            <div className="space-y-4">
              {myIncomingFulfill.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-check-circle text-5xl text-emerald-400 mb-2 block"></i>
                  <p>{lang === "en" ? "No pending fulfillments assigned to your branch!" : "لا توجد طلبات تحويل واردة معتمدة بانتظار تجهيزها وشحنها من فرعكم"}</p>
                </div>
              ) : (
                myIncomingFulfill.map((t) => (
                  <div key={t.id} className="bg-white border-2 border-amber-300/80 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-xs">
                            #{t.transferNo}
                          </span>
                          {getStatusBadge(t.status)}
                        </div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base mt-1.5">
                          {lang === "en" ? `Destination: ${t.toBranchName}` : `الفرع الطالب المستلم: ${t.toBranchName}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.status === "approved_by_admin" && (
                          <button
                            onClick={() => openFulfillModal(t)}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5"
                          >
                            <i className="ph-bold ph-package text-base"></i>
                            <span>تجهيز وشحن البضاعة 🚚</span>
                          </button>
                        )}
                        <button
                          onClick={() => printTransferPdf(t)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-file-pdf"></i> PDF
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {t.items.map((i, idx) => (
                        <div key={idx} className="bg-amber-50/60 border border-amber-200 rounded-xl p-2.5 flex justify-between items-center">
                          <div>
                            <span className="font-mono text-slate-500 ml-1">#{i.code}</span>
                            <span className="font-bold text-slate-900">{i.nameAr}</span>
                          </div>
                          <span className="font-black font-mono text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-300">
                            المعتمد: {i.adminApprovedQty ?? i.requestedQty} {i.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: INBOUND (SHIPPED & WAITING RECEIPT) */}
          {activeTab === "inbound" && (
            <div className="space-y-4">
              {myInboundReceiving.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-truck text-5xl text-slate-300 mb-2 block"></i>
                  <p>{lang === "en" ? "No in-transit shipments waiting for receipt." : "لا توجد شحنات محولة في الطريق بانتظار استلامها حالياً."}</p>
                </div>
              ) : (
                myInboundReceiving.map((t) => (
                  <div key={t.id} className="bg-white border-2 border-teal-400 rounded-3xl p-5 shadow-md space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-teal-900 bg-teal-100 px-2 py-0.5 rounded text-xs">
                            #{t.transferNo}
                          </span>
                          {getStatusBadge(t.status)}
                        </div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base mt-1.5">
                          {lang === "en" ? `Arrived from: ${t.fromBranchName}` : `شحنة واصلة من فرع: ${t.fromBranchName}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openReceivingModal(t)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-teal-600/30 flex items-center gap-1.5"
                        >
                          <i className="ph-bold ph-package-receive text-base"></i>
                          <span>فحص واستلام البضاعة 📥</span>
                        </button>
                        <button
                          onClick={() => printTransferPdf(t)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-file-pdf"></i> PDF
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {t.items.map((i, idx) => (
                        <div key={idx} className="bg-teal-50/60 border border-teal-200 rounded-xl p-2.5 flex justify-between items-center">
                          <span className="font-bold text-slate-900 truncate flex-1">{i.nameAr}</span>
                          <span className="font-black font-mono text-teal-950 mr-2 bg-white px-2 py-0.5 rounded border border-teal-300">
                            المشحون: {i.dispatchedQty ?? i.requestedQty} {i.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: ARCHIVE */}
          {activeTab === "archive" && (
            <div className="space-y-4">
              {myArchive.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                  <i className="ph-bold ph-archive-box text-5xl text-slate-300 mb-2 block"></i>
                  <p>{lang === "en" ? "No completed transfer records in archive." : "لا توجد معاملات تحويل مكتملة ومؤرشفة حالياً لفرعكم."}</p>
                </div>
              ) : (
                myArchive.map((t) => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                            #{t.transferNo}
                          </span>
                          {getStatusBadge(t.status)}
                          <span className="text-xs text-slate-400 font-normal">
                            {new Date(t.requestedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base mt-1.5">
                          {t.fromBranchName} ➔ {t.toBranchName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTransferForView(t)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-eye"></i> {lang === "en" ? "Timeline" : "السجل"}
                        </button>
                        <button
                          onClick={() => printTransferPdf(t)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        >
                          <i className="ph-bold ph-file-pdf"></i> PDF
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      <span>الأصناف المحولة ({t.items.length}): </span>
                      {t.items.map((i, idx) => (
                        <span key={idx} className="inline-block bg-slate-100 px-2 py-0.5 rounded ml-1 text-slate-700 font-bold">
                          {i.nameAr} ({i.receivedQty ?? i.dispatchedQty} {i.unit})
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: SOURCE BRANCH FULFILL & DISPATCH */}
      {fulfillingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <i className="ph-bold ph-package text-amber-600 text-lg"></i>
                  <span>تجهيز وشحن البضاعة للفرع الطالب</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الفرع المستلم: <b>{fulfillingTransfer.toBranchName}</b>
                </p>
              </div>
              <button onClick={() => setFulfillingTransfer(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">✕</button>
            </div>

            <div className="bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-2xl text-xs font-semibold">
              💡 يمكنك تعديل الكمية المتوفرة فعلياً للشحن إذا كان المتوفر في مخزنك أقل من المطلوب.
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {fulfillingTransfer.items.map((i, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-slate-500 font-bold ml-1">#{i.code}</span>
                    <span className="font-black text-slate-900">{i.nameAr}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">المعتمد من الأدمن: {i.adminApprovedQty ?? i.requestedQty} {i.unit}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">المشحون فعلياً:</label>
                    <input
                      type="number"
                      min={0}
                      value={dispatchItems[i.code] ?? (i.adminApprovedQty ?? i.requestedQty)}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setDispatchItems((prev) => ({ ...prev, [i.code]: val }));
                      }}
                      className="w-16 font-mono font-black text-center bg-white border border-amber-300 rounded-xl py-1.5 px-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات التجهيز والشحن:</label>
              <input
                type="text"
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="مثال: تم تغليف البضاعة وتسليمها للمندوب"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFulfillingTransfer(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={dispatchMut.isPending}
                onClick={handleConfirmDispatch}
                className="flex-[2] bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <i className="ph-bold ph-truck"></i>
                <span>{dispatchMut.isPending ? "جاري الشحن..." : "تأكيد التجهيز وإرسال للأدمن 🚚"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESTINATION RECEIVING & STOCK INTAKE */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <i className="ph-bold ph-package-receive text-teal-600 text-lg"></i>
                  <span>فحص واستلام البضاعة وتوريدها للمخزون</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  شحنة واردة من: <b>{receivingTransfer.fromBranchName}</b>
                </p>
              </div>
              <button onClick={() => setReceivingTransfer(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">✕</button>
            </div>

            <div className="bg-teal-50 text-teal-900 border border-teal-200 p-3 rounded-2xl text-xs font-semibold">
              📥 عند التأكيد، ستتم **إضافة** الكميات المستلمة إلى مخزون فرعكم، و**خصمها** من الفرع المصدر وترحيل المعاملة للأرشيف.
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {receivingTransfer.items.map((i, idx) => {
                const state = receivedItemsState[i.code] || {
                  qty: i.dispatchedQty ?? i.requestedQty,
                  status: "received_full",
                  notes: "",
                };
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-slate-500 font-bold ml-1">#{i.code}</span>
                        <span className="font-black text-slate-900">{i.nameAr}</span>
                      </div>
                      <span className="font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        المشحون: {i.dispatchedQty ?? i.requestedQty} {i.unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setReceivedItemsState((prev) => ({
                              ...prev,
                              [i.code]: { ...state, qty: i.dispatchedQty ?? i.requestedQty, status: "received_full" },
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                            state.status === "received_full" ? "bg-teal-600 text-white" : "bg-white border text-teal-700"
                          }`}
                        >
                          وصل بالكامل
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReceivedItemsState((prev) => ({
                              ...prev,
                              [i.code]: { ...state, qty: 0, status: "not_received" },
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                            state.status === "not_received" ? "bg-rose-600 text-white" : "bg-white border text-rose-700"
                          }`}
                        >
                          لم يصل
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <label className="font-bold text-slate-600">المستلم:</label>
                        <input
                          type="number"
                          min={0}
                          value={state.qty}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setReceivedItemsState((prev) => ({
                              ...prev,
                              [i.code]: {
                                ...state,
                                qty: val,
                                status: val === 0 ? "not_received" : val < (i.dispatchedQty ?? i.requestedQty) ? "received_partial" : "received_full",
                              },
                            }));
                          }}
                          className="w-16 font-mono font-black text-center bg-white border border-teal-300 rounded-xl py-1 px-2"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات الاستلام:</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="مثال: تم الاستلام بحالة ممتازة ومطابقة للأمر"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReceivingTransfer(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={receiveMut.isPending}
                onClick={handleConfirmReceive}
                className="flex-[2] bg-teal-600 hover:bg-teal-700 text-white font-black py-3 rounded-xl text-xs shadow-lg shadow-teal-600/30 flex items-center justify-center gap-1.5"
              >
                <i className="ph-bold ph-check-circle"></i>
                <span>{receiveMut.isPending ? "جاري التوريد للمخزون..." : "تأكيد الاستلام وتوريد المخزون 🟢"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DETAILS & TIMELINE */}
      {selectedTransferForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                    #{selectedTransferForView.transferNo}
                  </span>
                  {getStatusBadge(selectedTransferForView.status)}
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {selectedTransferForView.fromBranchName} ➔ {selectedTransferForView.toBranchName}
                </h3>
              </div>
              <button onClick={() => setSelectedTransferForView(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-700">الأصناف المحولة:</h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5">الوحدة</th>
                      <th className="p-2.5">المطلوب</th>
                      <th className="p-2.5">معتمد الأدمن</th>
                      <th className="p-2.5">المشحون</th>
                      <th className="p-2.5">المستلم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {selectedTransferForView.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">{i.nameAr}</td>
                        <td className="p-2.5">{i.unit}</td>
                        <td className="p-2.5 font-mono">{i.requestedQty}</td>
                        <td className="p-2.5 font-mono text-blue-700">{i.adminApprovedQty ?? i.requestedQty}</td>
                        <td className="p-2.5 font-mono text-amber-700">{i.dispatchedQty ?? "-"}</td>
                        <td className="p-2.5 font-mono text-emerald-700">{i.receivedQty ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-black text-slate-700">سجل الحركات الزمني (Audit Timeline):</h4>
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3 text-xs">
                {selectedTransferForView.timeline.map((tl, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-r-2 border-indigo-500 pr-3">
                    <div>
                      <div className="font-black text-slate-900">{tl.action}</div>
                      <div className="text-slate-500 text-[11px]">{tl.by} ({tl.role}) • {new Date(tl.timestamp).toLocaleString("ar-EG")}</div>
                      {tl.notes && <div className="text-slate-700 text-[11px] mt-0.5 bg-white p-1.5 rounded border border-slate-200 font-medium">ملاحظة: {tl.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => printTransferPdf(selectedTransferForView)}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1"
              >
                <i className="ph-bold ph-file-pdf"></i> طباعة السند PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransferForView(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
