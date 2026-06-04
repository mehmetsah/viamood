/**
 * AI Shipment Extractor
 *
 * WhatsApp / Instagram / serbest metin yazışmasından kargo bilgilerini
 * yapılandırılmış JSON'a çevirir. KargoLab create-shipment.php formatına
 * uyumlu output döner.
 *
 * Yaklaşım:
 *   - Anthropic Claude API (haiku) — düşük maliyet, hızlı
 *   - Prompt'ta TR adres yapısı (il/ilçe/mahalle) ve yaygın yanlış-yazımlar
 *   - JSON Schema enforced via tool-use (structured output)
 *
 * Fallback:
 *   - ANTHROPIC_API_KEY yoksa minimal regex extraction (telefon, isim) +
 *     "ai_unavailable" warning.
 */
import { env } from '@/lib/env';

export interface ShipmentExtraction {
  receiver: {
    name: string;
    phone: string | null;
    /** Alternatif numara — varsa */
    phone_alt: string | null;
    email: string | null;
  };
  address: {
    /** Tam adres metni (ham) — kargo etiketi için */
    full: string;
    /** Türkiye iline normalize edilmiş — bilinmiyorsa null */
    province: string | null;
    /** İlçe */
    district: string | null;
    /** Mahalle/semt — opsiyonel */
    neighborhood: string | null;
    /** Posta kodu — varsa */
    postal_code: string | null;
  };
  /** Sipariş içeriği */
  items: Array<{
    description: string;
    quantity: number;
    /** TL — kullanıcı belirttiyse */
    unit_price_try: number | null;
  }>;
  payment: {
    /** 'cod' = kapıda ödeme, 'paid' = ödenmiş, 'unknown' */
    method: 'cod' | 'paid' | 'unknown';
    /** Tahsil edilecek TL (cod ise) */
    cod_amount_try: number | null;
  };
  /** Operatör notları — paket sayısı, kırılgan, vs. */
  notes: string | null;
  /** Müşteri kaynağı tahmini: 'whatsapp' | 'instagram' | 'other' */
  source_guess: 'whatsapp' | 'instagram' | 'other';
  /** AI confidence 0..1 — alan eksiği varsa düşürür */
  confidence: number;
  /** Eksik / belirsiz alanlar için warning */
  warnings: string[];
}

interface ExtractOk {
  ok: true;
  data: ShipmentExtraction;
  raw_model_output: string;
  model_used: string;
}
interface ExtractErr {
  ok: false;
  error: string;
}
export type ExtractResult = ExtractOk | ExtractErr;

const SYSTEM_PROMPT = `Sen Türkiye e-ticaret operasyonu için kargo bilgisi çıkarıcı asistansın.

Müşteriden gelen serbest metin (WhatsApp / Instagram / SMS / e-posta yazışması) içinden
KARGO İÇİN GEREKEN bilgileri yapılandırılmış JSON olarak çıkarırsın.

KURALLAR:
1. TÜRKİYE odaklı: il/ilçe/mahalle alanlarını doğru tanı, yanlış yazımları (örn. "ankara"
   → "Ankara", "ist" → "İstanbul") düzelt. 81 ili bilirsin.
2. Telefon: +90, 0 prefix'lerini normalize et (10 haneli temiz format: 5XXXXXXXXX).
   2 telefon varsa phone + phone_alt.
3. Ürün açıklaması: müşterinin metnindeki ürün bilgisini olduğu gibi al, abartma.
4. Adet: yazılmamışsa 1 varsay.
5. Kapıda ödeme / havale / kart: "kapıda", "kapida" → method='cod'. "havale", "ödendi",
   "ödedim", "iban", "transfer" → method='paid'. Net değilse 'unknown'.
6. KARGO İÇERİĞİ DEĞİL → ödeme tutarı yazıldıysa cod_amount_try'a yaz.
7. Belirsiz alanlar için warnings'e Türkçe not ekle (örn. "İlçe net değil, kullanıcı doğrulasın").
8. Confidence: tüm alanlar netse 0.95+. Adres eksikse 0.5-. Hiç anlamsızsa < 0.3.

Çıktıyı KESİNLİKLE TEK BİR JSON nesnesi olarak ver, başka metin EKLEME.
Şema:
{
  "receiver": {
    "name": "string",
    "phone": "string|null  (10 digits, no prefix)",
    "phone_alt": "string|null",
    "email": "string|null"
  },
  "address": {
    "full": "string  (ham adres metni)",
    "province": "string|null  (Türkçe il adı, doğru kapitalizasyon)",
    "district": "string|null",
    "neighborhood": "string|null",
    "postal_code": "string|null"
  },
  "items": [
    { "description": "string", "quantity": 1, "unit_price_try": null }
  ],
  "payment": { "method": "cod|paid|unknown", "cod_amount_try": null },
  "notes": "string|null",
  "source_guess": "whatsapp|instagram|other",
  "confidence": 0.0,
  "warnings": ["string"]
}
`;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export async function extractShipment(
  text: string,
  opts?: { sourceHint?: 'whatsapp' | 'instagram' | 'other'; model?: string },
): Promise<ExtractResult> {
  const cleaned = (text ?? '').trim();
  if (cleaned.length < 5) {
    return { ok: false, error: 'Metin çok kısa — kargo bilgisi çıkarılamaz' };
  }
  if (cleaned.length > 8000) {
    return { ok: false, error: 'Metin çok uzun (max 8000 char)' };
  }

  if (!env.ANTHROPIC_API_KEY) {
    // AI yok — regex fallback
    return fallbackExtract(cleaned, opts?.sourceHint ?? 'other');
  }

  const model = opts?.model ?? env.ANTHROPIC_MODEL_FAST;

  const userMessage =
    (opts?.sourceHint ? `[Kaynak: ${opts.sourceHint}]\n\n` : '') +
    `Yazışma metni:\n---\n${cleaned}\n---`;

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    return { ok: false, error: `Anthropic API erişilemedi: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `Anthropic API ${res.status}: ${body.slice(0, 200)}` };
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    model?: string;
  };
  const textOut = (json.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text!)
    .join('\n')
    .trim();
  if (!textOut) {
    return { ok: false, error: 'AI response boş' };
  }

  // JSON parse — model'in başına/sonuna yazdığı code-fence vs. temizle
  let parsed: unknown;
  try {
    const cleanedJson = textOut
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleanedJson);
  } catch (err) {
    return {
      ok: false,
      error: `AI JSON parse fail: ${err instanceof Error ? err.message : 'unknown'} · raw: ${textOut.slice(0, 200)}`,
    };
  }

  const validated = validateShape(parsed, opts?.sourceHint);
  if (!validated.ok) return { ok: false, error: validated.error };

  return {
    ok: true,
    data: validated.data,
    raw_model_output: textOut,
    model_used: json.model ?? model,
  };
}

function validateShape(
  raw: unknown,
  sourceHint?: 'whatsapp' | 'instagram' | 'other',
): { ok: true; data: ShipmentExtraction } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'AI output object değil' };
  }
  const r = raw as Record<string, unknown>;

  const receiver = (r.receiver ?? {}) as Record<string, unknown>;
  const address = (r.address ?? {}) as Record<string, unknown>;
  const payment = (r.payment ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];

  const data: ShipmentExtraction = {
    receiver: {
      name: String(receiver.name ?? '').trim() || 'Bilinmiyor',
      phone: normalizePhone(receiver.phone),
      phone_alt: normalizePhone(receiver.phone_alt),
      email: typeof receiver.email === 'string' ? receiver.email.trim() || null : null,
    },
    address: {
      full: String(address.full ?? '').trim(),
      province: typeof address.province === 'string' ? address.province.trim() || null : null,
      district: typeof address.district === 'string' ? address.district.trim() || null : null,
      neighborhood:
        typeof address.neighborhood === 'string' ? address.neighborhood.trim() || null : null,
      postal_code:
        typeof address.postal_code === 'string' ? address.postal_code.trim() || null : null,
    },
    items: itemsRaw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({
        description: String(x.description ?? '').trim() || 'Ürün',
        quantity: clampInt(x.quantity, 1, 1, 1000),
        unit_price_try:
          typeof x.unit_price_try === 'number' && Number.isFinite(x.unit_price_try)
            ? x.unit_price_try
            : null,
      })),
    payment: {
      method: ['cod', 'paid', 'unknown'].includes(String(payment.method))
        ? (payment.method as 'cod' | 'paid' | 'unknown')
        : 'unknown',
      cod_amount_try:
        typeof payment.cod_amount_try === 'number' && Number.isFinite(payment.cod_amount_try)
          ? payment.cod_amount_try
          : null,
    },
    notes: typeof r.notes === 'string' ? r.notes.trim() || null : null,
    source_guess: ['whatsapp', 'instagram', 'other'].includes(String(r.source_guess))
      ? (r.source_guess as 'whatsapp' | 'instagram' | 'other')
      : sourceHint ?? 'other',
    confidence: clampFloat(r.confidence, 0.5, 0, 1),
    warnings: Array.isArray(r.warnings)
      ? r.warnings.filter((w): w is string => typeof w === 'string').slice(0, 10)
      : [],
  };

  if (data.items.length === 0) {
    data.items.push({ description: 'Ürün', quantity: 1, unit_price_try: null });
    data.warnings.push('Ürün bilgisi çıkarılamadı — manuel düzeltme gerekli');
  }

  return { ok: true, data };
}

function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 0) return null;
  // 90 prefix at, 0 prefix at, 10 hane olsun
  let n = digits;
  if (n.startsWith('90') && n.length === 12) n = n.slice(2);
  else if (n.startsWith('0') && n.length === 11) n = n.slice(1);
  return n.length === 10 ? n : digits.slice(-10) || null;
}

function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? Math.floor(v) : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
function clampFloat(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Anthropic API key yoksa basit regex extraction.
 * Sadece telefon + tam metni adres olarak alır — operatör manuel düzenler.
 */
function fallbackExtract(
  text: string,
  source: 'whatsapp' | 'instagram' | 'other',
): ExtractResult {
  const phoneRe = /(?:\+?9?0?\s*)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
  const phones: string[] = [];
  let m;
  while ((m = phoneRe.exec(text)) && phones.length < 3) {
    const n = normalizePhone(m[0]);
    if (n && !phones.includes(n)) phones.push(n);
  }

  const data: ShipmentExtraction = {
    receiver: {
      name: 'Manuel doldur',
      phone: phones[0] ?? null,
      phone_alt: phones[1] ?? null,
      email: null,
    },
    address: {
      full: text.slice(0, 500),
      province: null,
      district: null,
      neighborhood: null,
      postal_code: null,
    },
    items: [{ description: 'Manuel doldur', quantity: 1, unit_price_try: null }],
    payment: { method: 'unknown', cod_amount_try: null },
    notes: null,
    source_guess: source,
    confidence: 0.1,
    warnings: [
      'AI servisi yapılandırılmamış (ANTHROPIC_API_KEY eksik). Regex fallback kullanıldı.',
      'Tüm alanları manuel doldurmanız gerekiyor.',
    ],
  };

  return { ok: true, data, raw_model_output: '', model_used: 'fallback-regex' };
}
