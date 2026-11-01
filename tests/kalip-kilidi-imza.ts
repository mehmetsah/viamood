/**
 * #995707 · KALIP KİLİDİ — FİKSTÜR. `/admin/eposta-akislari` sayfasının sınıf dilini `/admin/mail-gecmisi` kalıbına bağlar (md.16).
 *
 * KAYNAK (yeniden ölçülmedi, birebir alındı): raporlar/995397-sah-kanit/olcum-normal.json + olcum-amber.json — ŞAH'ın gerçek
 * tarayıcıda (1440 px) ölçtüğü imzalar. İmza = etiket + sıralı sınıf listesi (kök `div.p-6` hariç; sınıfsız öğe «etiket.»).
 * Doğrulama: aynı imzalar test ortamında sayfa bileşeni HTML'e basılarak çıkarıldığında DOLU 34/34 · BOŞ 17/18 · TABLO YOK 10/9 birebir.
 * Çapraz kontrol: raporlar/995397-ayse-kanit/kiyas-olcum.json — 20 eş öğeden 19'u birebir, tek fark sayım satırının üst boşluğu
 * (aşağıda beyaz listede).
 *
 * KAPSAM: yalnız bu iki sayfa (KILITLI_SAYFALAR). Kaynağında «`admin/mail-gecmisi` sayfasının kalıbı» diyen YENİ bir admin sayfası
 * eklenirse çivi kırılır ve sayfa bu listeye alınmadan geçmez. Başka admin sayfaları kapsam DIŞI.
 * ⚠ Bu dosya değişirse kalıp değişmiş demektir: ŞAH + Ayşe onayı (md.31) olmadan beyaz listeye satır eklenmez.
 */
export const KILITLI_SAYFALAR = ['src/app/admin/mail-gecmisi/page.tsx', 'src/app/admin/eposta-akislari/page.tsx'] as const;

/** İki sayfada da AYNI olması gereken 29 imza (ŞAH «dolu» ölçümünün kesişimi). */
export const ORTAK_IMZALAR: readonly string[] = [
  "a.bg-black.border.border-black.font-semibold.px-3.py-1.5.rounded.text-white.text-xs",
  "a.bg-neutral-100.border.font-semibold.opacity-40.pointer-events-none.px-3.py-1.5.rounded.text-xs",
  "a.border.font-semibold.hover:bg-neutral-100.px-3.py-1.5.rounded.text-xs",
  "button.bg-neutral-900.font-medium.px-4.py-2.rounded-lg.text-sm.text-white",
  "div.flex.gap-1.items-center",
  "div.mt-2.overflow-x-auto",
  "div.text-neutral-600",
  "form.flex.flex-wrap.gap-3.items-end.mt-5",
  "h1.font-semibold.leading-relaxed.text-xl",
  "input.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
  "label.flex.flex-col.gap-1.leading-relaxed.text-neutral-600.text-xs",
  "nav.bg-neutral-50.border-t.flex.items-center.justify-between.px-4.py-3.text-sm",
  "option.",
  "p.leading-relaxed.mt-1.text-neutral-500.text-sm",
  "select.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
  "span.block.leading-relaxed.text-neutral-500.text-xs",
  "span.flex.items-center",
  "span.font-semibold",
  "span.text-green-700",
  "span.text-red-700",
  "table.text-sm.w-full",
  "tbody.",
  "td.pr-3.py-2",
  "td.pr-3.py-2.tabular-nums.text-neutral-600.whitespace-nowrap",
  "td.pr-3.py-2.text-neutral-600",
  "th.font-medium.pr-3.py-2",
  "thead.",
  "tr.align-top.border-b.border-neutral-100",
  "tr.border-b.border-neutral-200.text-left.text-neutral-500.text-xs"
];

/** Bilinen ve GEREKÇELİ farklar — sayfa başına. Gerekçesiz satır kabul edilmez. */
export const BEYAZ_LISTE: Record<'mail' | 'akis', Record<string, string>> = {
  "mail": {
    "p.leading-relaxed.mt-5.text-neutral-500.text-xs": "Sayım satırı formun hemen altında, tek tablo olduğu için üst boşluk mt-5. Ayşe kıyasındaki TEK fark (20 eş öğeden 19'u birebir); mail-gecmisi onaylı yüzey, değişikliği ayrı tur (md.31).",
    "span.bg-blue-100.leading-relaxed.px-2.py-0.5.rounded-full.text-blue-900.text-xs": "Mail tipi rozeti (islemsel). Tip sütunu yalnız mail-gecmisi'nde var; akış sayfasının «Akış» sütunu BİLEREK rozetsiz.",
    "span.bg-orange-100.leading-relaxed.px-2.py-0.5.rounded-full.text-orange-900.text-xs": "Mail tipi rozeti (pazarlama). Tip sütunu yalnız mail-gecmisi'nde var.",
    "span.bg-purple-100.leading-relaxed.px-2.py-0.5.rounded-full.text-purple-900.text-xs": "Mail tipi rozeti (duyuru). Tip sütunu yalnız mail-gecmisi'nde var.",
    "td.leading-relaxed.pr-3.py-2": "Konu sütunu: çok satırlı serbest metin. Akış sayfasında karşılığı yok."
  },
  "akis": {
    "h2.font-semibold.leading-relaxed.mt-6.text-base": "İki tablo var (brif: gönderimler + akış başlangıçları); birinci tablonun başlığı. Mevcut tipografi ölçeğinden, yeni jeton yok.",
    "h2.font-semibold.leading-relaxed.mt-8.text-base": "İkinci tablo («Akış başlangıçları») başlığı; iki tablo arasına daha büyük boşluk.",
    "p.leading-relaxed.mt-1.text-neutral-500.text-xs": "Sayım satırı h2'nin hemen altında olduğu için mt-1 (mail-gecmisi'nde formun altında mt-5). Yalnız kayıt varsa basılır (md.52).",
    "span.text-neutral-800": "Nötr durum rengi (planlandı / işleniyor / atlandı / iptal) — DURUM_RENK yedeği. Ölçülen fark ΔEok 0.042; bu tur DIŞINDA bırakıldı.",
    "td.pr-3.py-2.tabular-nums": "Adım numarası hücresi: rakam hizası için tabular-nums. mail-gecmisi'nde adım sütunu yok."
  }
};

/** ŞAH'ın boş ve «tablo yok» (amber) hâl ölçümleri — tam küme. */
export const HAL_IMZALARI: Record<'mail-bos' | 'akis-bos' | 'mail-amber' | 'akis-amber', readonly string[]> = {
  "mail-bos": [
    "button.bg-neutral-900.font-medium.px-4.py-2.rounded-lg.text-sm.text-white",
    "div.mt-2.overflow-x-auto",
    "form.flex.flex-wrap.gap-3.items-end.mt-5",
    "h1.font-semibold.leading-relaxed.text-xl",
    "input.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "label.flex.flex-col.gap-1.leading-relaxed.text-neutral-600.text-xs",
    "option.",
    "p.leading-relaxed.mt-1.text-neutral-500.text-sm",
    "p.leading-relaxed.mt-5.text-neutral-500.text-xs",
    "select.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "table.text-sm.w-full",
    "tbody.",
    "td.leading-relaxed.py-6.text-center.text-neutral-500.text-sm",
    "th.font-medium.pr-3.py-2",
    "thead.",
    "tr.",
    "tr.border-b.border-neutral-200.text-left.text-neutral-500.text-xs"
  ],
  "akis-bos": [
    "button.bg-neutral-900.font-medium.px-4.py-2.rounded-lg.text-sm.text-white",
    "div.mt-2.overflow-x-auto",
    "form.flex.flex-wrap.gap-3.items-end.mt-5",
    "h1.font-semibold.leading-relaxed.text-xl",
    "h2.font-semibold.leading-relaxed.mt-6.text-base",
    "h2.font-semibold.leading-relaxed.mt-8.text-base",
    "input.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "label.flex.flex-col.gap-1.leading-relaxed.text-neutral-600.text-xs",
    "option.",
    "p.leading-relaxed.mt-1.text-neutral-500.text-sm",
    "select.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "table.text-sm.w-full",
    "tbody.",
    "td.leading-relaxed.py-6.text-center.text-neutral-500.text-sm",
    "th.font-medium.pr-3.py-2",
    "thead.",
    "tr.",
    "tr.border-b.border-neutral-200.text-left.text-neutral-500.text-xs"
  ],
  "mail-amber": [
    "button.bg-neutral-900.font-medium.px-4.py-2.rounded-lg.text-sm.text-white",
    "code.",
    "form.flex.flex-wrap.gap-3.items-end.mt-5",
    "h1.font-semibold.leading-relaxed.text-xl",
    "input.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "label.flex.flex-col.gap-1.leading-relaxed.text-neutral-600.text-xs",
    "option.",
    "p.bg-amber-50.border.border-amber-300.leading-relaxed.mt-6.p-4.rounded-lg.text-amber-900.text-sm",
    "p.leading-relaxed.mt-1.text-neutral-500.text-sm",
    "select.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm"
  ],
  "akis-amber": [
    "button.bg-neutral-900.font-medium.px-4.py-2.rounded-lg.text-sm.text-white",
    "form.flex.flex-wrap.gap-3.items-end.mt-5",
    "h1.font-semibold.leading-relaxed.text-xl",
    "input.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm",
    "label.flex.flex-col.gap-1.leading-relaxed.text-neutral-600.text-xs",
    "option.",
    "p.bg-amber-50.border.border-amber-300.leading-relaxed.mt-6.p-4.rounded-lg.text-amber-900.text-sm",
    "p.leading-relaxed.mt-1.text-neutral-500.text-sm",
    "select.border.border-neutral-300.px-3.py-2.rounded-lg.text-sm"
  ]
};

/**
 * Meşru ama «şüpheli görünen» 10 sınıf dizisi — kural denetimi bunlarda YANLIŞ ALARM VERMEMELİ (tests/yer-tutucu-ornek.ts kalıbı).
 * Hepsi iki sayfanın gerçek çıktısından: kesirli boşluk, pasif bağlantı, hover varyantı, amber uyarı kutusu, siyah etkin sayfa…
 */
export const MESRU_SINIF_ORNEKLERI: readonly string[] = [
  'rounded-full px-2 py-0.5 text-xs leading-relaxed bg-blue-100 text-blue-900',
  'px-3 py-1.5 rounded border text-xs font-semibold pointer-events-none opacity-40 bg-neutral-100',
  'px-3 py-1.5 rounded border text-xs font-semibold hover:bg-neutral-100',
  'px-3 py-1.5 rounded border text-xs font-semibold bg-black text-white border-black',
  'mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900',
  'py-2 pr-3 whitespace-nowrap text-neutral-600 tabular-nums',
  'text-green-700',
  'text-red-700',
  'block text-xs leading-relaxed text-neutral-500',
  'flex items-center justify-between px-4 py-3 border-t bg-neutral-50 text-sm',
];
