import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import type { Product } from "@db/schema";
import { generateAuditPdf } from "@/lib/auditPdfGenerator";
import { useLanguage } from "@/providers/LanguageContext";
import { useAuth } from "@/providers/AuthContext";

// ─── الفئات التي تُفلتَر للجرد الأسبوعي (سريعة الاستهلاك) ──────────────────
const WEEKLY_CATEGORIES = new Set([
  "أجبان وألبان",
  "مياه وعصائر",
  "مخبوزات وساندوتشات",
  "كيك وكوكيز ومافن",
  "دونات فانسى ومميز",
  "مونشكين ودونات عادي",
  "دواجن ولحوم",
  "أكواب ساخنة",
  "الأكواب الباردة",
  "أغطية الأكواب",
  "أغلفة وحوامل الأكواب",
  "قهوة وكبسولات",
  "الشرابات والصلصات والبودرة",
  "شاي ومشروبات",
  "وجبات خفيفة ومكسرات",
]);

// ─── استخراج سعة الكرتون/الباكت بذكاء من اسم الصنف أو خصائصه ────────────────
export function extractPackSize(nameAr: string, nameEn: string, rawPackSize: number | null | undefined): number {
  if (rawPackSize && Number(rawPackSize) > 1) return Number(rawPackSize);
  const text = (nameAr || "") + " " + (nameEn || "");
  const m = text.match(/(?:1\s*[×xX*]\s*|x\s*)(\d+)\s*(?:حبة|قطعة|باكت|علبة|كيس|ظرف|PCS|PKT|BAG|CAN|BTL|CTN)?/i);
  if (m && Number(m[1]) > 1) return Number(m[1]);
  const m2 = text.match(/(\d+)\s*(?:PCS|PKT|حبة|باكت)\b/i);
  if (m2 && Number(m2[1]) > 1) return Number(m2[1]);
  return 1;
}

// ─── نوع صف الجرد المحلي الذكي (يدعم الكراتين والحبات المفرطة) ────────────────
export type AuditRow = {
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  unitCode: "CTN" | "PKT" | "PCS" | string;
  packSize: number; // سعة الكرتون/الباكت بالحبة
  packsCount: string; // عدد الكراتين أو الباكتات المقفولة
  looseCount: string; // عدد الحبات المفردة من الكرتون المفتوح
  directQty: string; // إدخال مباشر بالحبة (عند إيقاف الوضع المزدوج)
  isDualMode: boolean; // نمط العد المزدوج (كرتون + حبات فرط)
  systemQty: number | null; // رصيد السستم الأصلي
  systemPieces: number | null; // رصيد السستم بعد التحويل للحبة
  itemNotes: string;
};

// حساب إجمالي الحبات الفعلية
export const getRowActualPieces = (row: AuditRow): number | null => {
  if (!row.isDualMode) {
    if (row.directQty === "") return null;
    const n = parseInt(row.directQty, 10);
    return isNaN(n) ? null : n;
  }
  const hasInput = row.packsCount !== "" || row.looseCount !== "";
  if (!hasInput) return null;
  const p = row.packsCount === "" ? 0 : parseInt(row.packsCount, 10) || 0;
  const l = row.looseCount === "" ? 0 : parseInt(row.looseCount, 10) || 0;
  return p * row.packSize + l;
};

// حساب الفرق بالحبة (+ زيادة، - عجز)
export const getRowDiffPieces = (row: AuditRow): number | null => {
  const actual = getRowActualPieces(row);
  if (actual === null || row.systemPieces === null) return null;
  return actual - row.systemPieces;
};

export default function Audit() {
  const navigate = useNavigate();
  const { lang, toggleLang, t, getProductName, getCategoryName, getUnitName, getEmployeeName, getBranchName } = useLanguage();
  const { session, selectedBranch, branchesList, sendAdminSubmission } = useAuth();

  useEffect(() => {
    if (!session) {
      navigate("/");
    }
  }, [session, navigate]);

  if (!session) return null;

  // ─── حالة الجرد ─────────────────────────────────────────────────────────
  const [auditType, setAuditType] = useState<"weekly" | "monthly">("weekly");
  const [auditorName, setAuditorName] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [catFilter, setCatFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // مراحل: setup → inputting → saved/finalized
  type Phase = "setup" | "inputting" | "draft" | "completed";
  const [phase, setPhase] = useState<Phase>("setup");
  const [auditId, setAuditId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>>(undefined);


  // ─── tRPC ────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const productsQuery = trpc.inventory.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const auditListQuery = trpc.audit.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const createMut = trpc.audit.create.useMutation({
    onSuccess: (data) => {
      setAuditId(data.id);
      setPhase("inputting");
    },
    onError: () => notify(lang === "en" ? "Failed to create audit, check connection" : "تعذر إنشاء الجرد، تحقق من الاتصال"),
  });
  const saveDraftMut = trpc.audit.saveDraft.useMutation({
    onSuccess: () => {
      setPhase("draft");
      utils.audit.list.invalidate();
      notify(lang === "en" ? "✅ Draft saved successfully" : "✅ تم حفظ المسودة بنجاح");
    },
    onError: () => notify(lang === "en" ? "Failed to save draft" : "تعذر الحفظ"),
  });
  const finalizeMut = trpc.audit.finalize.useMutation({
    onSuccess: () => {
      setPhase("completed");
      utils.audit.list.invalidate();
      notify(lang === "en" ? "✅ Audit finalized successfully" : "✅ تم اعتماد الجرد نهائياً");
    },
    onError: () => notify(lang === "en" ? "Failed to finalize audit" : "تعذر الاعتماد"),
  });
  const deleteMut = trpc.audit.delete.useMutation({
    onSuccess: () => {
      utils.audit.list.invalidate();
      notify(lang === "en" ? "Deleted" : "تم الحذف");
    },
  });

  // ─── بناء صفوف الجرد عند تغيير نوعه أو تحميل المنتجات أو تغيير اللغة ─────
  useEffect(() => {
    if (!productsQuery.data) return;
    const products: Product[] = productsQuery.data;
    const filtered =
      auditType === "weekly"
        ? products.filter((p) => WEEKLY_CATEGORIES.has(p.category))
        : products;

    const newRows: AuditRow[] = filtered.map((p) => {
      const packSize = extractPackSize(p.nameAr, p.nameEn, p.packSize);
      const isCtnOrPkt = p.unitCode === "CTN" || p.unitCode === "PKT" || packSize > 1;

      let sysPieces: number | null = null;
      if (p.mode === "detailed") {
        sysPieces = (p.packs ?? 0) * (p.packSize ?? packSize) + (p.loose ?? 0);
      } else if (p.qty != null) {
        if (p.unitCode === "CTN" || p.unitCode === "PKT") {
          sysPieces = p.qty * packSize;
        } else {
          sysPieces = p.qty;
        }
      }

      return {
        productCode: p.code,
        productName: getProductName(p),
        category: getCategoryName(p.category),
        unit: getUnitName(p.unitLabel),
        unitCode: p.unitCode || "PCS",
        packSize,
        packsCount: "",
        looseCount: "",
        directQty: "",
        isDualMode: isCtnOrPkt,
        systemQty: p.qty ?? null,
        systemPieces: sysPieces,
        itemNotes: "",
      };
    });
    setRows(newRows);
  }, [productsQuery.data, auditType, lang]);

  // ─── مساعدات التحديث والعد الميداني ─────────────────────────────────────────
  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2800);
  };

  const updateRowField = (code: string, field: string, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.productCode !== code) return r;
        const updated = { ...r, [field]: value };
        // عند التحويل إلى الوضع المزدوج، نفكك الحبات إلى كراتين وحبات فرط
        if (field === "isDualMode" && value === true && r.directQty !== "") {
          const direct = parseInt(r.directQty, 10) || 0;
          updated.packsCount = String(Math.floor(direct / r.packSize));
          updated.looseCount = String(direct % r.packSize);
        }
        // عند التحويل للعد المباشر بالحبة، نحسب الإجمالي في directQty
        if (field === "isDualMode" && value === false) {
          const actual = getRowActualPieces(r);
          if (actual !== null) {
            updated.directQty = String(actual);
          }
        }
        return updated;
      })
    );
  };

  const adjustCounter = (code: string, field: "packsCount" | "looseCount", delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.productCode !== code) return r;
        const current = r[field] === "" ? 0 : parseInt(r[field], 10) || 0;
        const next = Math.max(0, current + delta);
        return { ...r, [field]: String(next) };
      })
    );
  };

  const buildPayload = () =>
    rows.map((r) => {
      const actual = getRowActualPieces(r);
      const diff = getRowDiffPieces(r);
      let note = r.itemNotes || "";
      if (r.isDualMode && (r.packsCount !== "" || r.looseCount !== "")) {
        const p = r.packsCount || "0";
        const l = r.looseCount || "0";
        const breakdown = `[${p} كرتون + ${l} حبة]`;
        if (!note.includes(breakdown)) {
          note = note ? `${breakdown} - ${note}` : breakdown;
        }
      }
      return {
        productCode: r.productCode,
        productName: r.productName,
        category: r.category,
        unit: r.unit,
        systemQty: r.systemPieces,
        actualQty: actual,
        itemNotes: note || null,
      };
    });

  // ─── الفلترة والإحصاءات ───────────────────────────────────────────────────
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))), [rows]);

  const visibleRows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return rows.filter((r) => {
      const matchCat = catFilter === "ALL" || r.category === catFilter;
      const matchSearch =
        !term ||
        r.productName.toLowerCase().includes(term) ||
        r.productCode.includes(term) ||
        r.category.toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [rows, catFilter, search]);

  const filledCount = rows.filter((r) => getRowActualPieces(r) !== null).length;
  const deficitCount = rows.filter((r) => {
    const d = getRowDiffPieces(r);
    return d !== null && d < 0;
  }).length;
  const surplusCount = rows.filter((r) => {
    const d = getRowDiffPieces(r);
    return d !== null && d > 0;
  }).length;
  const matchCount = rows.filter((r) => {
    const d = getRowDiffPieces(r);
    return d === 0;
  }).length;

  // ─── إرسال للأدمن وتصدير PDF ─────────────────────────────────────────────
  const handleSendAuditToAdmin = async () => {
    const empName = auditorName || session?.full_name || (lang === "en" ? "Auditor" : "المحرر");
    const empId = session?.employee_id || "#101";
    const bCode = session?.branch_code || selectedBranch || "1011125";
    const bObj = branchesList.find((b) => b.branch_code === bCode);
    const bName = bObj ? bObj.branch_name : `فرع ${bCode}`;

    const payloadItems = rows.map((r) => {
      const actual = getRowActualPieces(r);
      const diff = getRowDiffPieces(r);
      return {
        code: r.productCode,
        nameAr: r.productName,
        unit: r.unit,
        systemQty: r.systemPieces ?? undefined,
        actualQty: actual ?? undefined,
        diff: diff ?? undefined,
      };
    });

    const res = await sendAdminSubmission({
      type: "audit",
      title: auditType === "weekly" ? (lang === "en" ? "Weekly Audit Report" : "تقرير جرد أسبوعي") : (lang === "en" ? "Full Monthly Audit Report" : "تقرير جرد شهري شامل"),
      employee_name: empName,
      employee_id: empId,
      branch_code: bCode,
      branch_name: bName,
      details: {
        audit_type: auditType,
        auditor_name: empName,
        item_count: rows.length,
        items: payloadItems,
        notes: generalNotes,
      },
    });

    notify(res.message);
  };

  const exportPdf = () => {
    if (filledCount === 0) {
      notify(lang === "en" ? "No data to export yet!" : "لا توجد بيانات للتصدير بعد!");
      return;
    }
    generateAuditPdf({
      lang: lang,
      auditType,
      auditorName: auditorName || "—",
      createdAt: new Date().toISOString(),
      notes: generalNotes || null,
      items: rows.map((r) => {
        const actual = getRowActualPieces(r);
        const diff = getRowDiffPieces(r);
        let note = r.itemNotes || "";
        if (r.isDualMode && (r.packsCount !== "" || r.looseCount !== "")) {
          const p = r.packsCount || "0";
          const l = r.looseCount || "0";
          const breakdown = `[${p} كرتون + ${l} حبة]`;
          if (!note.includes(breakdown)) {
            note = note ? `${breakdown} - ${note}` : breakdown;
          }
        }
        return {
          productCode: r.productCode,
          productName: r.productName,
          category: r.category,
          unit: r.unit,
          systemQty: r.systemPieces,
          actualQty: actual,
          difference: diff,
          itemNotes: note || null,
        };
      }),
    }).catch(() => notify(lang === "en" ? "Failed to generate PDF" : "تعذر توليد PDF"));
  };

  const shareAudit = async () => {
    if (filledCount === 0) {
      notify(lang === "en" ? "No data to share yet!" : "لا توجد بيانات للمشاركة بعد!");
      return;
    }

    const deficitCount = rows.filter((r) => getRowActualPieces(r) !== null && getRowDiffPieces(r) !== null && (getRowDiffPieces(r) as number) < 0).length;
    const surplusCount = rows.filter((r) => getRowActualPieces(r) !== null && getRowDiffPieces(r) !== null && (getRowDiffPieces(r) as number) > 0).length;
    const exactCount = rows.filter((r) => getRowActualPieces(r) !== null && getRowDiffPieces(r) === 0).length;

    const typeStr = auditType === "weekly" ? (lang === "ar" ? "جرد أسبوعي" : "Weekly Audit") : (lang === "ar" ? "جرد شهري" : "Monthly Audit");
    const dateStr = new Date().toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

    const summaryText = `📋 ${lang === "ar" ? "تقرير جرد دانكن" : "Dunkin Inventory Audit Report"}
🏬 ${lang === "ar" ? "الفرع" : "Branch"}: [${selectedBranch}] ${getBranchName(selectedBranch)}
🗓️ ${lang === "ar" ? "النوع" : "Type"}: ${typeStr}
👤 ${lang === "ar" ? "المحرر" : "Auditor"}: ${getEmployeeName(auditorName)}
📅 ${lang === "ar" ? "التاريخ" : "Date"}: ${dateStr}
📦 ${lang === "ar" ? "إجمالي الأصناف المسجلة" : "Counted Items"}: ${filledCount} / ${rows.length}
⚠️ ${lang === "ar" ? "أصناف بعجز" : "Deficit Items"}: ${deficitCount}
📈 ${lang === "ar" ? "أصناف بزيادة" : "Surplus Items"}: ${surplusCount}
✅ ${lang === "ar" ? "أصناف مطابقة" : "Exact Match"}: ${exactCount}
${generalNotes ? `📝 ${lang === "ar" ? "ملاحظات" : "Notes"}: ${generalNotes}` : ""}
`.trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Dunkin Audit - ${getBranchName(selectedBranch)}`,
          text: summaryText,
        });
        return;
      } catch (e) {}
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(summaryText);
      notify(lang === "ar" ? "تم نسخ ملخص الجرد للحافظة للمشاركة!" : "Audit summary copied to clipboard!");
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
      window.open(waUrl, "_blank");
    }
  };

  const exportHistoryPdf = async (a: any) => {
    try {
      const data = await utils.client.audit.get.query({ id: a.id });
      if (!data || !data.items) {
        notify(lang === "en" ? "No items found for this audit" : "لا توجد بنود لهذا الجرد");
        return;
      }
      await generateAuditPdf({
        lang: lang,
        auditType: a.auditType,
        auditorName: a.auditorName || "—",
        createdAt: a.createdAt,
        notes: a.notes || null,
        items: data.items.map((r: any) => ({
          productCode: r.productCode,
          productName: r.productName,
          category: r.category,
          unit: r.unit,
          systemQty: r.systemQty,
          actualQty: r.actualQty,
          difference: r.actualQty != null && r.systemQty != null ? r.actualQty - r.systemQty : null,
          itemNotes: r.itemNotes || null,
        })),
      });
    } catch {
      notify(lang === "en" ? "Failed to generate PDF" : "تعذر استخراج ملف PDF");
    }
  };

  const shareHistoryAudit = async (a: any) => {
    try {
      const data = await utils.client.audit.get.query({ id: a.id });
      const items = data?.items ?? [];
      const deficitCount = items.filter((r: any) => (r.actualQty ?? 0) < (r.systemQty ?? 0)).length;
      const surplusCount = items.filter((r: any) => (r.actualQty ?? 0) > (r.systemQty ?? 0)).length;
      const exactCount = items.filter((r: any) => r.actualQty === r.systemQty && r.actualQty != null).length;

      const typeStr = a.auditType === "weekly" ? (lang === "ar" ? "جرد أسبوعي" : "Weekly Audit") : (lang === "ar" ? "جرد شهري" : "Monthly Audit");
      const dateStr = new Date(a.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

      const summaryText = `📋 ${lang === "ar" ? "تقرير جرد دانكن" : "Dunkin Inventory Audit Report"}
🏬 ${lang === "ar" ? "الفرع" : "Branch"}: [${selectedBranch}] ${getBranchName(selectedBranch)}
🗓️ ${lang === "ar" ? "النوع" : "Type"}: ${typeStr}
👤 ${lang === "ar" ? "المحرر" : "Auditor"}: ${getEmployeeName(a.auditorName)}
📅 ${lang === "ar" ? "التاريخ" : "Date"}: ${dateStr}
📦 ${lang === "ar" ? "إجمالي الأصناف" : "Total Items"}: ${items.length}
⚠️ ${lang === "ar" ? "أصناف بعجز" : "Deficit Items"}: ${deficitCount}
📈 ${lang === "ar" ? "أصناف بزيادة" : "Surplus Items"}: ${surplusCount}
✅ ${lang === "ar" ? "أصناف مطابقة" : "Exact Match"}: ${exactCount}
${a.notes ? `📝 ${lang === "ar" ? "ملاحظات" : "Notes"}: ${a.notes}` : ""}
`.trim();

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Dunkin Audit - ${getBranchName(selectedBranch)}`,
            text: summaryText,
          });
          return;
        } catch (e) {}
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(summaryText);
        notify(lang === "ar" ? "تم نسخ ملخص الجرد للحافظة للمشاركة!" : "Audit summary copied to clipboard!");
      } else {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
        window.open(waUrl, "_blank");
      }
    } catch {
      notify(lang === "en" ? "Failed to share audit" : "تعذر تجهيز الجرد للمشاركة");
    }
  };

  // ─── الشاشة الجانبية: سجل الجرود السابقة ────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              id="btn-back-home"
              onClick={() => navigate("/")}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title={lang === "en" ? "Back to Home" : "العودة للرئيسية"}
            >
              <svg className={`w-5 h-5 ${lang === 'ar' ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800 leading-none">
                {t("operationalAudit")}
              </h1>
              <p className="text-[11px] text-orange-600 font-bold mt-0.5">
                {auditType === "weekly"
                  ? (lang === "en" ? "🗓 Weekly Audit — Fast Consumables" : "🗓 أسبوعي — مواد سريعة الاستهلاك")
                  : (lang === "en" ? "📦 Monthly Audit — All Items" : "📦 شهري — جميع الأصناف")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              title={t("langTitle")}
              className="bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-2 rounded-xl font-extrabold transition flex items-center gap-1.5 shadow-md text-xs md:text-sm"
            >
              <i className="ph-bold ph-globe text-lg"></i>
              <span>{t("langBtn")}</span>
            </button>

            {phase === "inputting" || phase === "draft" ? (

              <>
                <button
                  id="btn-export-pdf"
                  onClick={exportPdf}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors text-sm font-bold"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {lang === "en" ? "Export PDF" : "تصدير PDF"}
                </button>
                <button
                  id="btn-share-audit"
                  onClick={shareAudit}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm font-bold"
                >
                  <i className="ph-bold ph-share-network"></i>
                  {lang === "en" ? "Share" : "مشاركة"}
                </button>
                <button
                  id="btn-save-draft"
                  onClick={() => {
                    if (!auditId) return;
                    saveDraftMut.mutate({ auditId, items: buildPayload(), notes: generalNotes });
                  }}
                  disabled={saveDraftMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-bold disabled:opacity-50"
                >
                  {saveDraftMut.isPending ? (lang === "en" ? "Saving..." : "جاري...") : (lang === "en" ? "💾 Save Draft" : "💾 حفظ مسودة")}
                </button>
                <button
                  id="btn-send-audit-admin"
                  onClick={handleSendAuditToAdmin}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors text-sm font-black shadow-md"
                >
                  <i className="ph-bold ph-paper-plane-tilt"></i>
                  {lang === "en" ? "Send to Admin 🚀" : "إرسال للأدمن 🚀"}
                </button>
                <button
                  id="btn-finalize"
                  onClick={() => {
                    if (!auditId) return;
                    finalizeMut.mutate({ auditId, items: buildPayload(), notes: generalNotes });
                  }}
                  disabled={finalizeMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-bold disabled:opacity-50 shadow-lg shadow-green-600/30"
                >
                  {finalizeMut.isPending ? (lang === "en" ? "Saving..." : "جاري...") : (lang === "en" ? "✅ Finalize Audit" : "✅ اعتماد نهائي")}
                </button>
              </>
            ) : null}
            <button
              id="btn-history"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-bold"
            >
              📋 {lang === "en" ? "History" : "السجل"}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Setup Phase ────────────────────────────────────────────────── */}
      {phase === "setup" && (
        <div className="max-w-lg mx-auto mt-16 px-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{lang === "en" ? "Setup New Inventory Audit" : "إعداد جرد جديد"}</h2>
            <p className="text-slate-500 text-sm mb-6">
              {lang === "en" ? "Select audit type and enter auditor name to start." : "حدد نوع الجرد وأدخل اسم القائم بالجرد لتبدأ."}
            </p>

            {/* نوع الجرد */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">{lang === "en" ? "Audit Type" : "نوع الجرد"}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="btn-type-weekly"
                  onClick={() => setAuditType("weekly")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    auditType === "weekly"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">🗓</span>
                  <span className="font-bold text-sm">{lang === "en" ? "Weekly" : "أسبوعي"}</span>
                  <span className="text-xs text-center opacity-70">{lang === "en" ? "Fast Consumables" : "مواد سريعة الاستهلاك"}</span>
                </button>
                <button
                  id="btn-type-monthly"
                  onClick={() => setAuditType("monthly")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    auditType === "monthly"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="text-2xl">📦</span>
                  <span className="font-bold text-sm">{lang === "en" ? "Monthly" : "شهري"}</span>
                  <span className="text-xs text-center opacity-70">{lang === "en" ? "All Items (256)" : "جميع الأصناف"}</span>
                </button>
              </div>
            </div>

            {/* اسم القائم بالجرد */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="auditor-name">
                {lang === "en" ? "Auditor / Manager Name *" : "اسم القائم بالجرد *"}
              </label>
              <input
                id="auditor-name"
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder={lang === "en" ? "e.g. Ahmed Mahmoud" : "أدخل الاسم..."}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800 bg-slate-50"
              />
            </div>

            {/* ملاحظات */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2" htmlFor="general-notes">
                {lang === "en" ? "General Notes (Optional)" : "ملاحظات عامة (اختياري)"}
              </label>
              <textarea
                id="general-notes"
                rows={2}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder={lang === "en" ? "Any general audit notes..." : "أي ملاحظات تريد إضافتها للتقرير..."}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800 bg-slate-50 resize-none"
              />
            </div>

            <button
              id="btn-start-audit"
              disabled={!auditorName.trim() || createMut.isPending || productsQuery.isLoading}
              onClick={() => {
                if (!auditorName.trim()) return;
                createMut.mutate({ auditType, auditorName: auditorName.trim(), notes: generalNotes });
              }}
              className="w-full py-3 rounded-2xl bg-orange-500 text-white font-extrabold text-base hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMut.isPending || productsQuery.isLoading
                ? (lang === "en" ? "Preparing..." : "جاري التحضير...")
                : (lang === "en" ? `🚀 Start Audit (${rows.length} items)` : `🚀 بدء الجرد (${rows.length} صنف)`)}
            </button>
          </div>
        </div>
      )}

      {/* ─── Completed Phase Banner ──────────────────────────────────────── */}
      {phase === "completed" && (
        <div className="max-w-2xl mx-auto mt-10 px-4">
          <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-extrabold text-green-800 mb-2">{lang === "en" ? "Audit Finalized!" : "تم اعتماد الجرد!"}</h2>
            <p className="text-green-600 mb-6">
              {lang === "en"
                ? `Saved ${auditType} audit with `
                : `تم حفظ جرد ${auditType === "weekly" ? "الأسبوعي" : "الشهري"} ورصد `}
              <strong className="text-red-600">{deficitCount} {lang === "en" ? "items with deficit" : "صنف بعجز"}</strong>.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={exportPdf}
                className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
              >
                📄 {lang === "en" ? "Export PDF Report" : "تصدير تقرير PDF"}
              </button>
              <button
                onClick={() => {
                  setPhase("setup");
                  setAuditId(null);
                  setAuditorName("");
                  setGeneralNotes("");
                }}
                className="px-5 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-300 font-bold hover:bg-slate-50 transition-colors"
              >
                + {lang === "en" ? "New Audit" : "جرد جديد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Input Table ────────────────────────────────────────────── */}
      {(phase === "inputting" || phase === "draft") && (
        <div className="max-w-7xl mx-auto px-4 mt-6 pb-24">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-extrabold text-slate-800">{rows.length}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">{lang === "en" ? "Total Items" : "إجمالي الأصناف"}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-extrabold text-blue-600">{filledCount}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">{lang === "en" ? "Counted Items" : "تم رصدها"}</div>
            </div>
            <div className={`rounded-2xl border p-4 text-center ${deficitCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <div className={`text-2xl font-extrabold ${deficitCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {deficitCount}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">{lang === "en" ? "Items with Deficit" : "أصناف بعجز"}</div>
            </div>
          </div>

          {/* أدوات البحث والفلترة */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
            <input
              id="audit-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "en" ? "Search item name or code..." : "بحث باسم الصنف أو الكود..."}
              className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <select
              id="audit-cat-filter"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              <option value="ALL">{t("allCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {phase === "draft" && (
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                📝 {lang === "en" ? "Saved Draft" : "مسودة محفوظة"}
              </span>
            )}
          </div>

          {/* ─── عرض الجوال: بطاقات مريحة للمس والعد الميداني ─── */}
          <div className="block md:hidden space-y-3">
            {visibleRows.map((row, idx) => {
              const actualPieces = getRowActualPieces(row);
              const diff = getRowDiffPieces(row);
              const isDeficit = diff !== null && diff < 0;
              const isSurplus = diff !== null && diff > 0;
              const isMatch = diff === 0;

              return (
                <div
                  key={row.productCode}
                  className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${
                    isDeficit
                      ? "border-red-300 bg-red-50/40"
                      : isSurplus
                      ? "border-emerald-300 bg-emerald-50/30"
                      : actualPieces !== null
                      ? "border-blue-300 bg-blue-50/20"
                      : "border-slate-200"
                  }`}
                >
                  {/* رأس البطاقة */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          #{idx + 1} {row.productCode}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                          {row.category}
                        </span>
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                          {row.unit}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                        {row.productName}
                      </h4>
                    </div>

                    {/* تعديل سعة الكرتون */}
                    {row.packSize > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const v = prompt(
                            lang === "en"
                              ? "Enter carton capacity in pieces:"
                              : "أدخل سعة الكرتون (عدد الحبات بالكرتون):",
                            String(row.packSize)
                          );
                          if (v && !isNaN(Number(v)) && Number(v) > 0) {
                            updateRowField(row.productCode, "packSize", Number(v));
                          }
                        }}
                        className="text-[10px] text-amber-800 bg-amber-100/70 hover:bg-amber-200 px-2 py-1 rounded-lg border border-amber-300 font-bold shrink-0 flex items-center gap-1"
                        title="تعديل سعة الكرتون"
                      >
                        <span>📦 1 كرتون = {row.packSize} حبة</span>
                        <i className="ph-bold ph-pencil-simple text-xs"></i>
                      </button>
                    )}
                  </div>

                  {/* رصيد السستم */}
                  <div className="bg-slate-50 rounded-xl p-2.5 mb-3 flex items-center justify-between border border-slate-100">
                    <span className="text-xs text-slate-500 font-bold">
                      {lang === "en" ? "System Balance:" : "رصيد السستم:"}
                    </span>
                    <div className="text-left" dir="ltr">
                      <span className="text-sm font-black text-slate-800 font-mono">
                        {row.systemPieces ?? "—"} {lang === "en" ? "PCS" : "حبة"}
                      </span>
                      {row.packSize > 1 && row.systemPieces !== null && (
                        <span className="text-xs text-slate-400 font-bold mr-1.5 block">
                          ({Math.floor(row.systemPieces / row.packSize)} كرتون + {row.systemPieces % row.packSize} حبة)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* حقول الإدخال الفعلي */}
                  {row.isDualMode ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* كراتين مقفولة */}
                        <div className="bg-amber-50/60 rounded-xl p-2.5 border border-amber-200/80">
                          <label className="block text-[11px] font-black text-amber-900 mb-1 text-center">
                            📦 كراتين مقفولة
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustCounter(row.productCode, "packsCount", -1)}
                              className="w-8 h-8 rounded-lg bg-white border border-amber-300 font-black text-slate-700 active:scale-95 flex items-center justify-center shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={row.packsCount}
                              onChange={(e) => updateRowField(row.productCode, "packsCount", e.target.value)}
                              placeholder="0"
                              className="w-full text-center py-1 font-black text-base rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => adjustCounter(row.productCode, "packsCount", 1)}
                              className="w-8 h-8 rounded-lg bg-amber-500 text-white font-black active:scale-95 flex items-center justify-center shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* حبات مفردة من كرتون مفتوح */}
                        <div className="bg-blue-50/60 rounded-xl p-2.5 border border-blue-200/80">
                          <label className="block text-[11px] font-black text-blue-900 mb-1 text-center">
                            🔘 حبات فرط (مفتوحة)
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustCounter(row.productCode, "looseCount", -1)}
                              className="w-8 h-8 rounded-lg bg-white border border-blue-300 font-black text-slate-700 active:scale-95 flex items-center justify-center shrink-0"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={row.looseCount}
                              onChange={(e) => updateRowField(row.productCode, "looseCount", e.target.value)}
                              placeholder="0"
                              className="w-full text-center py-1 font-black text-base rounded-lg border border-blue-300 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => adjustCounter(row.productCode, "looseCount", 1)}
                              className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black active:scale-95 flex items-center justify-center shrink-0"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ملخص الإجمالي المحسوب */}
                      <div className="flex items-center justify-between px-2 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() => updateRowField(row.productCode, "isDualMode", false)}
                          className="text-[11px] text-slate-400 hover:text-orange-600 underline font-medium"
                        >
                          عد بالحبة مباشرة فقط
                        </button>
                        {actualPieces !== null && (
                          <span className="font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                            الفعلي: {actualPieces} حبة
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={row.directQty}
                          onChange={(e) => updateRowField(row.productCode, "directQty", e.target.value)}
                          placeholder="أدخل عدد الحبات الكلي..."
                          className="flex-1 px-3 py-2 text-center rounded-xl border border-slate-300 font-black text-base bg-white focus:ring-2 focus:ring-orange-400 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateRowField(row.productCode, "isDualMode", true)}
                          className="px-3 py-2 rounded-xl bg-orange-100 text-orange-800 text-xs font-black border border-orange-200 shrink-0"
                        >
                          📦 تفعيل عد [كرتون + حبة فرط]
                        </button>
                      </div>
                    </div>
                  )}

                  {/* الفرق والملاحظات */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">الفرق:</span>
                      {diff !== null ? (
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                            isDeficit
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : isSurplus
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff} حبة
                          {row.packSize > 1 && Math.abs(diff) >= row.packSize && (
                            <span className="mr-1 opacity-80 text-[10px]">
                              ({diff > 0 ? "+" : "-"}{Math.floor(Math.abs(diff) / row.packSize)} كرتون و {Math.abs(diff) % row.packSize} حبة)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-bold">—</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={row.itemNotes}
                      onChange={(e) => updateRowField(row.productCode, "itemNotes", e.target.value)}
                      placeholder="ملاحظات (تالف/منتهي)..."
                      className="w-36 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              );
            })}

            {visibleRows.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                لا توجد نتائج للفلتر المحدد
              </div>
            )}
          </div>

          {/* ─── عرض الشاشات الكبيرة: جدول متقدم مع حقول العد المزدوج ─── */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs">
                  <th className="px-3 py-3 text-center font-bold w-8">#</th>
                  <th className={`px-3 py-3 ${lang === 'ar' ? 'text-right' : 'text-left'} font-bold`}>{lang === "en" ? "Product & Code" : "الصنف والرمز"}</th>
                  <th className={`px-3 py-3 ${lang === 'ar' ? 'text-right' : 'text-left'} font-bold hidden md:table-cell`}>{lang === "en" ? "Category" : "التصنيف"}</th>
                  <th className="px-3 py-3 text-center font-bold w-20">{lang === "en" ? "Unit" : "الوحدة"}</th>
                  <th className="px-3 py-3 text-center font-bold w-28">{lang === "en" ? "System Qty" : "رصيد السستم"}</th>
                  <th className="px-3 py-3 text-center font-bold w-64">{lang === "en" ? "Actual Count" : "الرصيد الفعلي (كرتون + حبات فرط)"}</th>
                  <th className="px-3 py-3 text-center font-bold w-32">{lang === "en" ? "Diff (+/-)" : "الفرق"}</th>
                  <th className={`px-3 py-3 ${lang === 'ar' ? 'text-right' : 'text-left'} font-bold w-36 hidden lg:table-cell`}>{lang === "en" ? "Notes" : "ملاحظات"}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => {
                  const actualPieces = getRowActualPieces(row);
                  const diff = getRowDiffPieces(row);
                  const isDeficit = diff !== null && diff < 0;
                  const isSurplus = diff !== null && diff > 0;
                  const isMatch = diff === 0;

                  return (
                    <tr
                      key={row.productCode}
                      className={`border-t border-slate-100 transition-colors ${
                        isDeficit
                          ? "bg-red-50/70 hover:bg-red-100/60"
                          : isSurplus
                          ? "bg-emerald-50/40 hover:bg-emerald-100/50"
                          : idx % 2 === 0
                          ? "bg-white hover:bg-slate-50"
                          : "bg-slate-50/60 hover:bg-slate-100/60"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-slate-400 text-xs text-center">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-800 leading-tight">{row.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-400 font-mono">{row.productCode}</span>
                          {row.packSize > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const v = prompt(
                                  lang === "en" ? "Carton capacity in pieces:" : "أدخل سعة الكرتون (عدد الحبات بالكرتون):",
                                  String(row.packSize)
                                );
                                if (v && !isNaN(Number(v)) && Number(v) > 0) {
                                  updateRowField(row.productCode, "packSize", Number(v));
                                }
                              }}
                              className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"
                              title="تعديل سعة الكرتون"
                            >
                              <span>📦 1 كرتون = {row.packSize} حبة</span>
                              <i className="ph-bold ph-pencil-simple text-[9px]"></i>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-600 font-medium">
                        {row.unit}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                        <div className="font-mono text-sm">{row.systemPieces ?? "—"} حبة</div>
                        {row.packSize > 1 && row.systemPieces !== null && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            ({Math.floor(row.systemPieces / row.packSize)} كرتون + {row.systemPieces % row.packSize} حبة)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.isDualMode ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-amber-900 mb-0.5">📦 كرتون مقفول</span>
                                <input
                                  id={`packs-${row.productCode}`}
                                  type="number"
                                  min={0}
                                  value={row.packsCount}
                                  onChange={(e) => updateRowField(row.productCode, "packsCount", e.target.value)}
                                  placeholder="0"
                                  className="w-16 px-1.5 py-1 text-center rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 font-bold text-sm bg-white"
                                />
                              </div>
                              <span className="text-slate-400 font-bold mt-3.5">+</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-blue-900 mb-0.5">🔘 حبات مفردة</span>
                                <input
                                  id={`loose-${row.productCode}`}
                                  type="number"
                                  min={0}
                                  value={row.looseCount}
                                  onChange={(e) => updateRowField(row.productCode, "looseCount", e.target.value)}
                                  placeholder="0"
                                  className="w-16 px-1.5 py-1 text-center rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold text-sm bg-white"
                                />
                              </div>
                            </div>
                            {actualPieces !== null ? (
                              <div className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                = {actualPieces} حبة
                                {row.packSize > 1 && ` (${Math.floor(actualPieces / row.packSize)} كرتون و ${actualPieces % row.packSize} حبة)`}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">أدخل الكراتين أو الحبات</span>
                            )}
                            <button
                              type="button"
                              onClick={() => updateRowField(row.productCode, "isDualMode", false)}
                              className="text-[10px] text-slate-400 hover:text-orange-600 underline font-medium"
                            >
                              عد بالحبة فقط
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              id={`actual-${row.productCode}`}
                              type="number"
                              min={0}
                              value={row.directQty}
                              onChange={(e) => updateRowField(row.productCode, "directQty", e.target.value)}
                              placeholder="أدخل الحبات..."
                              className="w-24 px-2 py-1.5 text-center rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 font-bold text-sm bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => updateRowField(row.productCode, "isDualMode", true)}
                              className="text-[10px] text-orange-600 hover:text-orange-700 underline font-bold"
                            >
                              تفعيل عد [كرتون + حبة] 📦
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {diff !== null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                                isDeficit
                                  ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                                  : isSurplus
                                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                                  : "bg-blue-100 text-blue-800 ring-1 ring-blue-300"
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} حبة
                            </span>
                            {row.packSize > 1 && Math.abs(diff) >= row.packSize && (
                              <span className="text-[10px] text-slate-500 font-bold">
                                ({diff > 0 ? "+" : "-"}{Math.floor(Math.abs(diff) / row.packSize)} كرتون و {Math.abs(diff) % row.packSize} حبة)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <input
                          id={`note-${row.productCode}`}
                          type="text"
                          value={row.itemNotes}
                          onChange={(e) => updateRowField(row.productCode, "itemNotes", e.target.value)}
                          placeholder="تالف / منتهي..."
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300 text-slate-700 bg-transparent"
                        />
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      لا توجد نتائج للفلتر المحدد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ملاحظات عامة في أسفل الجدول */}
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              ملاحظات الجرد العامة
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="ملاحظات المشرف على الجرد..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {/* أزرار الحفظ الثابتة في الأسفل */}
          <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center gap-3 z-20">
            <div className="text-sm text-slate-500">
              تم رصد <strong className="text-blue-600">{filledCount}</strong> من{" "}
              <strong>{rows.length}</strong> صنف
              {deficitCount > 0 && (
                <> — <strong className="text-red-600">{deficitCount} عجز</strong></>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportPdf}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors text-sm font-bold"
              >
                📄 PDF
              </button>
              <button
                disabled={saveDraftMut.isPending}
                onClick={() => {
                  if (!auditId) return;
                  saveDraftMut.mutate({ auditId, items: buildPayload(), notes: generalNotes });
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-bold disabled:opacity-50"
              >
                {saveDraftMut.isPending ? "..." : "💾 مسودة"}
              </button>
              <button
                disabled={finalizeMut.isPending}
                onClick={() => {
                  if (!auditId) return;
                  finalizeMut.mutate({ auditId, items: buildPayload(), notes: generalNotes });
                }}
                className="px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-bold disabled:opacity-50 shadow-lg shadow-green-600/25"
              >
                {finalizeMut.isPending ? "..." : "✅ اعتماد نهائي"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── سجل الجرود السابقة (Drawer) ──────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-extrabold text-slate-800">سجل الجرود</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {auditListQuery.isLoading && (
                <p className="text-slate-400 text-sm text-center py-8">جاري التحميل...</p>
              )}
              {auditListQuery.data?.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-8">لا توجد جرود مسجلة بعد</p>
              )}
              {auditListQuery.data?.map((a) => (
                <div
                  key={a.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          a.auditType === "weekly"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {a.auditType === "weekly" ? "أسبوعي" : "شهري"}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          a.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {a.status === "completed" ? "✅ معتمد" : "📝 مسودة"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mt-1">{getEmployeeName(a.auditorName)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(a.createdAt).toLocaleString("ar-SA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => exportHistoryPdf(a)}
                        className="w-8 h-8 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center transition"
                        title={lang === "en" ? "Export PDF" : "تصدير ملف PDF"}
                      >
                        <i className="ph-bold ph-file-pdf"></i>
                      </button>
                      <button
                        onClick={() => shareHistoryAudit(a)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center transition"
                        title={lang === "en" ? "Share" : "مشاركة الجرد"}
                      >
                        <i className="ph-bold ph-share-network"></i>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا الجرد؟")) {
                            deleteMut.mutate({ id: a.id });
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 flex items-center justify-center transition"
                        title={lang === "en" ? "Delete" : "حذف"}
                      >
                        <i className="ph-bold ph-trash"></i>
                      </button>
                    </div>
                  </div>
                  {a.notes && (
                    <p className="text-xs text-slate-500 mt-2 bg-white rounded-lg px-2 py-1 border border-slate-100">
                      {a.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
