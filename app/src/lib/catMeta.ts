export interface CatMeta { color: string; badge: string; icon: string }

export const catMeta: Record<string, CatMeta> = {
  "أكواب ساخنة": {
    "color": "border-slate-300 bg-white text-slate-900",
    "badge": "bg-slate-100 text-slate-800 border-slate-300",
    "icon": "☕"
  },
  "الأكواب الباردة": {
    "color": "border-slate-400 bg-slate-100 text-slate-900",
    "badge": "bg-slate-200 text-slate-800 border-slate-300",
    "icon": "🩶"
  },
  "أغطية الأكواب": {
    "color": "border-blue-300 bg-blue-50/80 text-blue-950",
    "badge": "bg-blue-100 text-blue-800 border-blue-200",
    "icon": "🟦"
  },
  "أغلفة وحوامل الأكواب": {
    "color": "border-amber-700/30 bg-amber-50 text-amber-950",
    "badge": "bg-amber-100 text-amber-900 border-amber-300",
    "icon": "🟫"
  },
  "الصناديق والعلب": {
    "color": "border-orange-400/40 bg-orange-50 text-orange-950",
    "badge": "bg-orange-100 text-orange-900 border-orange-300",
    "icon": "📦"
  },
  "أكياس التعبئة والتسوق": {
    "color": "border-stone-400/40 bg-stone-100 text-stone-900",
    "badge": "bg-stone-200 text-stone-800 border-stone-300",
    "icon": "🛍️"
  },
  "قهوة وكبسولات": {
    "color": "border-emerald-300 bg-emerald-50/80 text-emerald-950",
    "badge": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "icon": "🟢"
  },
  "الشرابات والصلصات والبودرة": {
    "color": "border-purple-300 bg-purple-50/80 text-purple-950",
    "badge": "bg-purple-100 text-purple-800 border-purple-200",
    "icon": "🟣"
  },
  "شاي ومشروبات": {
    "color": "border-teal-300 bg-teal-50/80 text-teal-950",
    "badge": "bg-teal-100 text-teal-800 border-teal-200",
    "icon": "🍵"
  },
  "أجبان وألبان": {
    "color": "border-yellow-300 bg-yellow-50/80 text-yellow-950",
    "badge": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "icon": "🥛"
  },
  "مياه وعصائر": {
    "color": "border-cyan-300 bg-cyan-50/80 text-cyan-950",
    "badge": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "icon": "💧"
  },
  "السكر والمحليات": {
    "color": "border-rose-300 bg-rose-50/80 text-rose-950",
    "badge": "bg-rose-100 text-rose-800 border-rose-200",
    "icon": "🍬"
  },
  "مخبوزات وساندوتشات": {
    "color": "border-amber-300 bg-amber-50/80 text-amber-950",
    "badge": "bg-amber-100 text-amber-800 border-amber-200",
    "icon": "🥐"
  },
  "كيك وكوكيز ومافن": {
    "color": "border-yellow-400 bg-yellow-50/80 text-yellow-950",
    "badge": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "icon": "🧁"
  },
  "دونات فانسى ومميز": {
    "color": "border-pink-300 bg-pink-50/80 text-pink-950",
    "badge": "bg-pink-100 text-pink-800 border-pink-200",
    "icon": "🍩"
  },
  "مونشكين ودونات عادي": {
    "color": "border-orange-300 bg-orange-50/80 text-orange-950",
    "badge": "bg-orange-100 text-orange-800 border-orange-200",
    "icon": "🍩"
  },
  "وجبات خفيفة ومكسرات": {
    "color": "border-lime-300 bg-lime-50/80 text-lime-950",
    "badge": "bg-lime-100 text-lime-800 border-lime-200",
    "icon": "🥜"
  },
  "دواجن ولحوم": {
    "color": "border-red-300 bg-red-50/80 text-red-950",
    "badge": "bg-red-100 text-red-800 border-red-200",
    "icon": "🥩"
  },
  "أكواب وتملبرات مبيعات": {
    "color": "border-indigo-300 bg-indigo-50/80 text-indigo-950",
    "badge": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "icon": "🥤"
  },
  "مستلزمات ونظافة": {
    "color": "border-slate-300 bg-slate-100 text-slate-900",
    "badge": "bg-slate-200 text-slate-800 border-slate-300",
    "icon": "🥢"
  },
  "المنظفات والمعقمات": {
    "color": "border-yellow-400 bg-yellow-100/60 text-yellow-950",
    "badge": "bg-yellow-200 text-yellow-900 border-yellow-300",
    "icon": "🟡"
  },
  "قرطاسية وملصقات": {
    "color": "border-purple-300 bg-purple-50/80 text-purple-950",
    "badge": "bg-purple-100 text-purple-800 border-purple-200",
    "icon": "🏷️"
  },
  "زي الموظفين (Uniform)": {
    "color": "border-slate-500 bg-slate-200/50 text-slate-900",
    "badge": "bg-slate-300 text-slate-800 border-slate-400",
    "icon": "👕"
  }
};

export const defaultMeta: CatMeta = {
  color: 'border-slate-300 bg-white text-slate-800',
  badge: 'bg-slate-100 text-slate-700 border-slate-300',
  icon: '🏷️',
};

export function getMeta(cat: string): CatMeta {
  return catMeta[cat] ?? defaultMeta;
}
