/**
 * Halköde TEST ortamı — UÇTAN UCA 3D akışı (tarayıcısız).
 *
 *   node --env-file=.env.local scripts/halkode-3d-flow.ts [ok|fail] [kartNo] [taksit]
 *
 * Adımlar:
 *   1. paySmart3D            → bankaya auto-submit HTML (PaReq/TermUrl/MD)
 *   2. ACS simülatörü        → 3D şifre formu
 *   3. şifre gönder          → ACS, TermUrl'e (Halköde/QNB gateway) POST eder
 *   4. gateway → Halköde     → bizim return_url/cancel_url'e yönlendirir
 *   5. dönüş parametreleri   → hash_key ÇÖZÜLÜR, gerçek alan sırası ölçülür
 *
 * `ok`   → doğru 3D şifresi (başarı beklenir)
 * `fail` → yanlış 3D şifresi (kart/3D reddi beklenir)
 *
 * Zincir viamood.com.tr'ye yönlenmeden DURDURULUR (redirect: manual) — canlı
 * siteye istek gitmez, para hareketi yoktur.
 */
import { getToken, paySmart3D, checkStatus, decodeHashKey, buildInvoiceId } from '../src/lib/halkode/client.ts';

const MODE = (process.argv[2] ?? 'ok') as 'ok' | 'fail';
const CARD = process.argv[3] ?? '4155650100416111'; // QNB Finansbank test visa (getpos'ta 1-6 taksit tanımlı)
const INSTALLMENTS = Number(process.argv[4] ?? 1);
const RETURN_URL = 'https://viamood.com.tr/api/v1/payment/halkode/callback';

/** ACS (ASP.NET) oturumu çerezle taşınır — çerezsiz "Root element invalid" döner. */
const jar = new Map<string, string>();
function saveCookies(resp: Response) {
  const raw = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
function cookieHeader(): Record<string, string> {
  if (!jar.size) return {};
  return { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
}
async function go(url: string, init: RequestInit = {}): Promise<{ resp: Response; text: string }> {
  const resp = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), ...cookieHeader() },
    redirect: 'manual',
  });
  saveCookies(resp);
  return { resp, text: await resp.text() };
}

/** Yönlendirmeleri çerezleri koruyarak takip eder (ACS 302 ile form sayfasına atıyor). */
async function goFollow(url: string, init: RequestInit = {}, max = 5): Promise<{ resp: Response; text: string; url: string }> {
  let cur = await go(url, init);
  let curUrl = url;
  for (let i = 0; i < max; i++) {
    const loc = cur.resp.headers.get('location');
    if (!loc || cur.resp.status < 300 || cur.resp.status >= 400) break;
    curUrl = new URL(loc, curUrl).toString();
    cur = await go(curUrl); // yönlendirme sonrası GET
  }
  return { ...cur, url: curUrl };
}

function fields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]*>/gi)) {
    const tag = m[0];
    const n = /name=["']([^"']+)["']/i.exec(tag)?.[1];
    const v = /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    if (n) out[n] = v;
  }
  return out;
}
function formAction(html: string): string | null {
  return /frm\.action\s*=\s*'([^']+)'/.exec(html)?.[1] ?? /<form[^>]*action=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
}
function h(t: string) {
  console.log(`\n${'─'.repeat(70)}\n${t}\n${'─'.repeat(70)}`);
}

const t = await getToken();
if (!t.ok) {
  console.error('token alınamadı:', t.error);
  process.exit(1);
}

const invoiceId = buildInvoiceId(null, `f${Date.now()}`);
const TOTAL = 22.0;

h(`1) paySmart3D — invoice_id=${invoiceId} · mod=${MODE} · kart=${CARD.slice(0,6)}****${CARD.slice(-4)} · taksit=${INSTALLMENTS}`);
const pay = await paySmart3D(
  {
    ccHolderName: 'Test Kart',
    ccNo: CARD,
    expiryMonth: '12',
    expiryYear: '2028',
    cvv: '555',
    total: TOTAL,
    installmentsNumber: INSTALLMENTS,
    invoiceId,
    name: 'Test',
    surname: 'Kullanici',
    items: [{ name: 'Test Urun', price: TOTAL, quantity: 1 }],
    returnUrl: RETURN_URL,
    cancelUrl: RETURN_URL,
  },
  t.token,
);
if (!pay.ok) {
  console.error(`  ✗ status_code=${pay.statusCode} — ${pay.error}`);
  process.exit(1);
}
const acsUrl = formAction(pay.html)!;
const acsFields = fields(pay.html);
console.log(`  ✓ 3D formu alındı → ACS: ${acsUrl}`);
console.log(`    alanlar: ${Object.keys(acsFields).join(', ')}`);

h('2) ACS simülatörüne PaReq gönder');
const { resp: acsResp, text: acsHtml, url: acsPageUrl } = await goFollow(acsUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ PaReq: acsFields.PaReq, TermUrl: acsFields.TermUrl, MD: acsFields.MD }).toString(),
});
console.log(`  HTTP ${acsResp.status} · ${acsHtml.length} bayt`);
const acsForm = fields(acsHtml);
console.log(`  form alanları: ${Object.keys(acsForm).join(', ')}`);
const submits = [...acsHtml.matchAll(/<input[^>]*type=["']submit["'][^>]*>/gi)].map(
  (m) => /name=["']([^"']+)["']/i.exec(m[0])?.[1] + '=' + (/value=["']([^"']*)["']/i.exec(m[0])?.[1] ?? ''),
);
console.log(`  submit düğmeleri: ${submits.join(' | ') || '(yok)'}`);

// ACS simülatörü tek kullanımlık şifreyi SAYFADA gösterir (test ortamı) — oradan okunur.
const pwField = Object.keys(acsForm).find((k) => /pwd|pass|sifre|şifre|otp/i.test(k));
const nextAction = formAction(acsHtml);
const acsBody = acsHtml.slice(acsHtml.indexOf('<body'));
const otp = /\b\d{6}\b/.exec(acsBody)?.[0];
console.log(`  şifre alanı: ${pwField ?? '(bulunamadı)'} · sonraki action: ${nextAction}`);
console.log(`  simülatörün gösterdiği tek kullanımlık şifre: ${otp ?? '(bulunamadı)'}`);

if (!pwField || !nextAction || !otp) {
  console.log('\n  ⚠ ACS simülatör formu beklenen şekilde ayrıştırılamadı. Ham çıktının başı:');
  console.log(acsHtml.slice(0, 1200));
  process.exit(1);
}

h(`3) 3D şifresini gönder (${MODE === 'ok' ? 'DOĞRU' : 'YANLIŞ'} şifre)`);
const body = new URLSearchParams();
for (const [k, v] of Object.entries(acsForm)) body.set(k, v);
body.set(pwField, MODE === 'ok' ? otp : '000000'); // fail modunda kasten yanlış
body.set('hdnIsSubmit', 'true');
body.set('hdnIsCancel', 'false');
body.delete('Button1'); // "Resend Password" postback'ini tetikleme
const nextUrl = new URL(nextAction, acsPageUrl).toString();
const { resp: step3, text: step3Html } = await go(nextUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
});
console.log(`  HTTP ${step3.status} · ${step3Html.length} bayt · Location: ${step3.headers.get('location') ?? '-'}`);

// Bu adım TermUrl'e (Halköde gateway) auto-submit eden bir form döndürür
let cur = { url: nextUrl, html: step3Html, status: step3.status, loc: step3.headers.get('location') };
let returnParams: URLSearchParams | null = null;

for (let hop = 0; hop < 6 && !returnParams; hop++) {
  // Yönlendirme mi?
  if (cur.loc) {
    const abs = new URL(cur.loc, cur.url).toString();
    if (abs.startsWith(RETURN_URL.split('?')[0]) || abs.includes('viamood.com.tr')) {
      returnParams = new URL(abs).searchParams;
      console.log(`\n  ⇢ DÖNÜŞ yakalandı (redirect): ${abs.split('?')[0]}`);
      break;
    }
    const r = await go(abs);
    cur = { url: abs, html: r.text, status: r.resp.status, loc: r.resp.headers.get('location') };
    console.log(`  hop${hop}: ${abs.slice(0, 80)} → HTTP ${cur.status}`);
    continue;
  }
  // Halköde son adımda JS ile yönlendiriyor: window.location.href = "...return_url?..."
  const js = /window\.location\.href\s*=\s*["']([^"']+)["']/.exec(cur.html)?.[1];
  if (js && js.includes('viamood.com.tr')) {
    returnParams = new URL(js).searchParams;
    console.log(`\n  ⇢ DÖNÜŞ yakalandı (JS redirect): ${js.split('?')[0]}`);
    break;
  }

  // Auto-submit form mu?
  const act = formAction(cur.html);
  const f = fields(cur.html);
  if (!act) break;
  const abs = new URL(act, cur.url).toString();
  if (abs.includes('viamood.com.tr')) {
    returnParams = new URLSearchParams(f as Record<string, string>);
    console.log(`\n  ⇢ DÖNÜŞ yakalandı (form POST): ${abs}`);
    break;
  }
  console.log(`  hop${hop}: form → ${abs.slice(0, 90)} · alanlar: ${Object.keys(f).join(',').slice(0, 120)}`);
  const r = await go(abs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(f as Record<string, string>).toString(),
  });
  cur = { url: abs, html: r.text, status: r.resp.status, loc: r.resp.headers.get('location') };
}

h('4) DÖNÜŞ verisi');
if (!returnParams) {
  console.log('  ⚠ return_url yakalanamadı. Son adımın çıktısı:');
  console.log(`  URL: ${cur.url} · HTTP ${cur.status} · Location: ${cur.loc ?? '-'}`);
  console.log(cur.html.slice(0, 1500));
} else {
  for (const [k, v] of returnParams) {
    console.log(`  ${k} = ${k === 'hash_key' ? v.slice(0, 24) + '…' : v}`);
  }
  const hk = returnParams.get('hash_key');
  if (hk) {
    const parts = decodeHashKey(hk, process.env.HALKODE_APP_SECRET!);
    console.log(`\n  ⇒ DÖNÜŞ HASH ÇÖZÜLDÜ (gerçek alan sırası): ${JSON.stringify(parts?.raw)}`);
    console.log(`     beklenen → invoice_id=${invoiceId} · total=${TOTAL.toFixed(2)}`);
  } else {
    console.log('\n  ⚠ dönüşte hash_key yok');
  }
}

h('5) checkstatus — sunucu tarafı kesin doğrulama');
const st = await checkStatus(invoiceId, t.token);
console.log(`  status_code=${st.statusCode} · ${st.description} · ok=${st.ok}`);
console.log(`  data: ${JSON.stringify(st.data).slice(0, 600)}`);
