import React, { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";

export interface ReceivingItem {
  productId?: number;
  productCode: string;
  nameAr: string;
  nameEn?: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  status: "received_full" | "received_partial" | "not_received";
  notes?: string;
}

export interface GoodsReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItems: Array<{
    id?: number;
    code: string;
    nameAr: string;
    nameEn?: string;
    orderQty: number;
    unitLabel?: string;
    unitCode?: string;
  }>;
  submissionId?: string;
  orderTitle?: string;
  onSuccess?: () => void;
}

export function GoodsReceivingModal({
  isOpen,
  onClose,
  orderItems,
  submissionId,
  orderTitle,
  onSuccess,
}: GoodsReceivingModalProps) {
  const { lang, t, getBranchName, getEmployeeName } = useLanguage();
  const { session, selectedBranch, branchesList } = useAuth();
  const utils = trpc.useUtils();

  // Initialize receiving items from order
  const [items, setItems] = useState<ReceivingItem[]>(() =>
    orderItems.map((item) => ({
      productId: item.id,
      productCode: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      orderedQty: item.orderQty,
      receivedQty: item.orderQty, // Default to full receipt
      unit: item.unitLabel || item.unitCode || (lang === "en" ? "PCS" : "حبة"),
      status: "received_full",
      notes: "",
    }))
  );

  const [deliveryNotes, setDeliveryNotes] = useState("");

  const receiveMut = trpc.inventory.receiveOrder.useMutation({
    onSuccess: (res) => {
      utils.inventory.list.invalidate();
      utils.inventory.stockLogs.invalidate();
      onSuccess?.();
      onClose();
    },
  });

  if (!isOpen) return null;

  // Counters
  const totalOrdered = items.length;
  const fullyReceivedCount = items.filter((i) => i.status === "received_full").length;
  const partiallyReceivedCount = items.filter((i) => i.status === "received_partial").length;
  const notReceivedCount = items.filter((i) => i.status === "not_received").length;

  // Actions per item
  const markFull = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              receivedQty: item.orderedQty,
              status: "received_full",
            }
          : item
      )
    );
  };

  const markNotReceived = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              receivedQty: 0,
              status: "not_received",
            }
          : item
      )
    );
  };

  const setCustomQty = (index: number, val: number) => {
    const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        let status: "received_full" | "received_partial" | "not_received" = "received_partial";
        if (cleanVal === 0) status = "not_received";
        else if (cleanVal >= item.orderedQty) status = "received_full";
        return {
          ...item,
          receivedQty: cleanVal,
          status,
        };
      })
    );
  };

  const updateItemNote = (index: number, note: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, notes: note } : item))
    );
  };

  // Batch actions
  const markAllFull = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        receivedQty: item.orderedQty,
        status: "received_full",
      }))
    );
  };

  const markAllNotReceived = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        receivedQty: 0,
        status: "not_received",
      }))
    );
  };

  const handleConfirmIntake = async () => {
    if (items.length === 0) return;

    await receiveMut.mutateAsync({
      branchCode: selectedBranch || session?.branch_code || "1011125",
      receivedBy: session?.full_name || "موظف الاستلام",
      submissionId,
      items: items.map((i) => ({
        productId: i.productId,
        productCode: i.productCode,
        orderedQty: i.orderedQty,
        receivedQty: i.receivedQty,
        status: i.status,
        notes: i.notes || null,
      })),
    });
  };

  const branchObj = branchesList.find((b) => b.branch_code === selectedBranch);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800"
        dir={lang === "ar" ? "rtl" : "ltr"}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-emerald-500/30 shrink-0">
              <i className="ph-bold ph-package-receive"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black">
                  {lang === "en" ? "Goods Receipt & Intake Confirmation" : "استلام المنتجات وتوريد المخزون الفعلي"}
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  {lang === "en" ? "Stock Inflow" : "إضافة للمخزون"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {branchObj ? getBranchName(branchObj.branch_name) : `فرع ${selectedBranch}`} • {getEmployeeName(session?.full_name || "")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700"
            >
              <i className="ph-bold ph-x text-lg"></i>
            </button>
          </div>
        </div>

        {/* Operational Status Banner & Counters */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
            <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold shadow-sm">
              <span className="text-slate-500">{lang === "en" ? "Total Items:" : "إجمالي الأصناف:"}</span>
              <span className="font-mono text-slate-900 font-black text-sm">{totalOrdered}</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold text-emerald-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{lang === "en" ? "Fully Received:" : "تم الاستلام بالكامل:"}</span>
              <span className="font-mono text-emerald-700 font-black text-sm">{fullyReceivedCount}</span>
            </div>

            {partiallyReceivedCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold text-amber-800 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{lang === "en" ? "Partial:" : "استلام جزئي:"}</span>
                <span className="font-mono text-amber-700 font-black text-sm">{partiallyReceivedCount}</span>
              </div>
            )}

            <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-2 font-bold text-rose-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>{lang === "en" ? "Not Received:" : "لم يتم الاستلام:"}</span>
              <span className="font-mono text-rose-700 font-black text-sm">{notReceivedCount}</span>
            </div>
          </div>

          {/* Quick Batch Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={markAllFull}
              className="bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-200 hover:border-emerald-300 text-xs font-black px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
              title={lang === "en" ? "Mark all items as fully arrived" : "تأكيد وصول جميع الأصناف بالكامل"}
            >
              <i className="ph-bold ph-check-circle text-emerald-600"></i>
              <span>{lang === "en" ? "All Arrived" : "استلام الكل بالكامل"}</span>
            </button>

            <button
              onClick={markAllNotReceived}
              className="bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 text-xs font-black px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
              title={lang === "en" ? "Mark all items as not arrived" : "تحديد الكل كـ لم يصل"}
            >
              <i className="ph-bold ph-x-circle text-rose-600"></i>
              <span>{lang === "en" ? "None Arrived" : "لم يصل شيء"}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Items Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-slate-100/50">
          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-200">
              <i className="ph-bold ph-tray text-4xl text-slate-300 mb-2 block"></i>
              {lang === "en" ? "No items in this order to receive." : "لا توجد مواد في هذه الطلبية للاستلام."}
            </div>
          ) : (
            items.map((item, idx) => {
              const isNotReceived = item.status === "not_received";
              const isFull = item.status === "received_full";
              const isPartial = item.status === "received_partial";

              return (
                <div
                  key={idx}
                  className={`border rounded-2xl p-3.5 sm:p-4 transition-all ${
                    isNotReceived
                      ? "bg-rose-50/70 border-rose-300 shadow-sm"
                      : isFull
                      ? "bg-white border-emerald-200 hover:border-emerald-300 shadow-sm"
                      : "bg-amber-50/70 border-amber-300 shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                          #{item.productCode}
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                          {item.unit}
                        </span>

                        {/* Status Badges */}
                        {isNotReceived ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                            <i className="ph-bold ph-x-circle"></i>
                            {lang === "en" ? "Not Received" : "لم يتم الاستلام"}
                          </span>
                        ) : isFull ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                            <i className="ph-bold ph-check-circle"></i>
                            {lang === "en" ? "Fully Received" : "تم الاستلام بالكامل"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-600 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                            <i className="ph-bold ph-warning-circle"></i>
                            {lang === "en" ? "Partial Receipt" : "استلام جزئي"}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                        {lang === "en" ? item.nameEn || item.nameAr : item.nameAr}
                      </h4>
                      <p className="text-xs text-slate-500 font-sans mt-0.5" dir="ltr">
                        {lang === "en" ? item.nameAr : item.nameEn}
                      </p>
                    </div>

                    {/* Quantities & Status Selectors */}
                    <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                      {/* Requested Qty Display */}
                      <div className="text-center bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">
                          {lang === "en" ? "Ordered" : "المطلوب"}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-700">
                          {item.orderedQty}
                        </span>
                      </div>

                      {/* Actual Received Input */}
                      <div className="text-center">
                        <span className="block text-[10px] text-emerald-800 font-bold uppercase">
                          {lang === "en" ? "Arrived" : "الواصل فعلياً"}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            min={0}
                            value={item.receivedQty}
                            onChange={(e) => setCustomQty(idx, parseInt(e.target.value, 10))}
                            className={`w-20 font-mono font-black text-center text-sm py-1.5 px-2 rounded-xl border outline-none transition focus:ring-2 ${
                              isNotReceived
                                ? "bg-rose-100 text-rose-950 border-rose-300 focus:ring-rose-400"
                                : "bg-emerald-50 text-emerald-950 border-emerald-300 focus:ring-emerald-400"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Quick Action Toggle Buttons */}
                      <div className="flex items-center gap-1.5 pt-3 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => markFull(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                            isFull
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                              : "bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                          title={lang === "en" ? "Full Delivery" : "تأكيد وصول الكمية كاملة"}
                        >
                          <i className="ph-bold ph-check text-sm"></i>
                          <span>{lang === "en" ? "Full" : "وصل"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => markNotReceived(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                            isNotReceived
                              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                              : "bg-white hover:bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                          title={lang === "en" ? "Mark as Not Arrived" : "تأكيد عدم وصول المنتج"}
                        >
                          <i className="ph-bold ph-x text-sm"></i>
                          <span>{lang === "en" ? "Missing" : "لم يصل"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes / Reason Field for Unreceived or Partial Items */}
                  {(isNotReceived || isPartial) && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex items-center gap-2">
                      <i className="ph-bold ph-chat-text text-slate-400 text-sm"></i>
                      <input
                        type="text"
                        value={item.notes || ""}
                        onChange={(e) => updateItemNote(idx, e.target.value)}
                        placeholder={
                          isNotReceived
                            ? (lang === "en" ? "Reason item did not arrive (e.g. Out of stock at warehouse, damaged...)" : "سبب عدم الاستلام (مثال: غير متوفر بالمستودع، تالف أثناء النقل...)")
                            : (lang === "en" ? "Reason for partial quantity..." : "سبب النقص في الكمية المستلمة...")
                        }
                        className="flex-1 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
            <i className="ph-bold ph-info text-emerald-600 text-base"></i>
            <span>
              {lang === "en"
                ? "Clicking confirm will automatically add received quantities to your live stock."
                : "الضغط على التأكيد سيضيف الكميات المستلمة فوراً وبشكل آلي إلى رصيد المخزون الفعلي."}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={receiveMut.isPending}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition text-xs"
            >
              {t("cancel")}
            </button>

            <button
              type="button"
              onClick={handleConfirmIntake}
              disabled={receiveMut.isPending || items.length === 0}
              className="flex-[1.5] sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50"
            >
              <i className="ph-bold ph-check-fat text-base"></i>
              <span>
                {receiveMut.isPending
                  ? (lang === "en" ? "Adding to Stock..." : "جاري إضافة الكميات للمخزون...")
                  : (lang === "en" ? "Confirm & Intake Stock 📥" : "تأكيد الاستلام وتوريد المخزون 📥")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
