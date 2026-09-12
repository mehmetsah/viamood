/**
 * #46 — "Şifremi Unuttum" UÇTAN UCA testi.
 *
 * YEREL ortamda koşar (localhost:3100 + localhost postgres). Prod'a dokunmaz.
 * Akış: sign-in → Şifremi unuttum → e-posta → token → yeni şifre →
 *       ESKİ parola BAŞARISIZ, YENİ parola BAŞARILI.
 *
 *   node tests/sifre-sifirlama-e2e.mjs
 */
import { chromium } from '@playwright/test';
import postgres from 'postgres';
import fs from 'node:fs';

const KOK = 'http://localhost:3100';
const OUT = '/tmp/vm-46-shots';
const EMAIL = 'test@viamood.test';
const ESKI_SIFRE = 'EskiSifre123';
const YENI_SIFRE = 'YeniSifre456';
const DEV_LOG = '/tmp/dev.log';

fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  fs.readFileSync('/tmp/vm-clone/.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sql = postgres(env.DATABASE_URL, { max: 1 });

const sonuc = [];
const adim = (ad, deger, gecti) => {
  sonuc.push({ ad, deger, gecti });
  const isaret = gecti === undefined ? ' ' : gecti ? '✓' : '✗';
  console.log(` ${isaret} ${String(ad).padEnd(48)} ${deger}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'tr-TR' });
const page = await ctx.newPage();

// ── 1) Sign-in sayfası: "Şifremi unuttum" linki var mı ─────────────────────
console.log('\n=== 1) SIGN-IN SAYFASI ===');
await page.goto(`${KOK}/auth/sign-in`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${OUT}/01-sign-in.png` });

const link = page.locator('a[href="/sifremi-unuttum"]');
adim('"Şifremi unuttum" linki', (await link.count()) === 1 ? 'VAR' : 'YOK', (await link.count()) === 1);
adim('link metni', `"${(await link.textContent())?.trim()}"`);
const kutu = await link.boundingBox();
const sifreKutu = await page.locator('input[name="password"]').boundingBox();
adim('şifre alanının ALTINDA', `link y=${Math.round(kutu.y)} > şifre y=${Math.round(sifreKutu.y)}`, kutu.y > sifreKutu.y);

// ── 2) Şifremi unuttum sayfası ─────────────────────────────────────────────
console.log('\n=== 2) ŞİFREMİ UNUTTUM ===');
await link.click();
await page.waitForURL('**/sifremi-unuttum', { timeout: 15000 });
adim('yönlendirme', page.url().replace(KOK, ''), page.url().endsWith('/sifremi-unuttum'));
await page.screenshot({ path: `${OUT}/02-sifremi-unuttum.png` });

const logOnce = fs.readFileSync(DEV_LOG, 'utf8').length;
await page.fill('input[name="email"]', EMAIL);
await page.click('button[type="submit"]');
await page.waitForSelector('text=/gelen kutunu/i', { timeout: 20000 });
const mesaj = (await page.locator('.bg-white p').first().textContent())?.trim();
adim('onay mesajı', `"${mesaj?.slice(0, 60)}…"`, !!mesaj);
adim('mesaj kullanıcı sayımı sızdırmıyor', /kayıtlıysa/i.test(mesaj) ? 'EVET (koşullu dil)' : 'HAYIR', /kayıtlıysa/i.test(mesaj));
await page.screenshot({ path: `${OUT}/03-eposta-gonderildi.png` });

// ── 3) E-posta gitti mi + token ────────────────────────────────────────────
console.log('\n=== 3) E-POSTA VE TOKEN ===');
await new Promise((r) => setTimeout(r, 2500));
const yeniLog = fs.readFileSync(DEV_LOG, 'utf8').slice(logOnce);
const mailSatiri = yeniLog.split('\n').find((l) => l.includes('[stub] Email to'));
adim('mail gönderimi tetiklendi', mailSatiri ? mailSatiri.trim().slice(0, 70) : 'YOK', !!mailSatiri);
adim('alıcı doğru', mailSatiri?.includes(EMAIL) ? EMAIL : 'YANLIŞ', !!mailSatiri?.includes(EMAIL));

const linkEslesme = yeniLog.match(/http:\/\/localhost:3100\/sifre-sifirla\?token=([A-Za-z0-9_-]+)/);
adim('mail gövdesinde sıfırlama linki', linkEslesme ? 'VAR' : 'YOK', !!linkEslesme);
const token = linkEslesme?.[1];
adim('token uzunluğu', token ? `${token.length} karakter` : '-', !!token && token.length >= 40);

const [satir] = await sql`
  SELECT email, token_hash, used_at,
         EXTRACT(EPOCH FROM (expires_at - created_at))/60 AS dakika
  FROM password_reset_tokens WHERE email = ${EMAIL} ORDER BY created_at DESC LIMIT 1`;
adim('DB satırı yazıldı', satir ? satir.email : 'YOK', !!satir);
adim('token ÖZET olarak saklanmış (ham değil)', satir && satir.token_hash !== token ? `sha256 ${satir.token_hash.slice(0, 12)}…` : 'HAM TOKEN!', satir?.token_hash !== token);
adim('token ömrü', `${Math.round(satir.dakika)} dakika`, Math.round(satir.dakika) === 30);
adim('used durumu', satir.used_at === null ? 'false (kullanılmamış)' : 'true', satir.used_at === null);

// ── 4) Sıfırlama linki + yeni şifre ────────────────────────────────────────
console.log('\n=== 4) YENİ ŞİFRE BELİRLEME ===');
await page.goto(`${KOK}/sifre-sifirla?token=${token}`, { waitUntil: 'networkidle' });
const formVar = (await page.locator('input[name="password"]').count()) === 1;
adim('token geçerli → form açıldı', formVar ? 'EVET' : 'HAYIR', formVar);
adim('sayfada e-posta gösteriliyor', (await page.locator(`text=${EMAIL}`).count()) > 0 ? 'EVET' : 'HAYIR');
await page.screenshot({ path: `${OUT}/04-yeni-sifre-formu.png` });

await page.fill('input[name="password"]', YENI_SIFRE);
await page.fill('input[name="passwordConfirm"]', YENI_SIFRE);
await page.click('button[type="submit"]');
await page.waitForSelector('text=/Şifren güncellendi/i', { timeout: 20000 });
adim('başarı mesajı', 'Şifren güncellendi', true);
await page.screenshot({ path: `${OUT}/05-basari.png` });

const [sonra] = await sql`SELECT used_at FROM password_reset_tokens WHERE email = ${EMAIL} ORDER BY created_at DESC LIMIT 1`;
adim('token tüketildi (used=true)', sonra.used_at ? 'EVET' : 'HAYIR', !!sonra.used_at);

// ── 5) Token tekrar kullanılamaz ───────────────────────────────────────────
console.log('\n=== 5) TOKEN TEKRAR KULLANIMI ===');
await page.goto(`${KOK}/sifre-sifirla?token=${token}`, { waitUntil: 'networkidle' });
const tekrarRed = (await page.locator('text=/daha önce kullanılmış/i').count()) > 0;
adim('ikinci kullanım reddedildi', tekrarRed ? 'EVET' : 'HAYIR', tekrarRed);
await page.screenshot({ path: `${OUT}/06-token-tekrar.png` });

// ── 6) ESKİ parola başarısız / YENİ parola başarılı ────────────────────────
console.log('\n=== 6) GİRİŞ DOĞRULAMASI ===');
async function girisDene(sifre) {
  const p = await ctx.newPage();
  await p.goto(`${KOK}/auth/sign-in?callbackUrl=/hesabim`, { waitUntil: 'networkidle' });
  await p.fill('input[name="email"]', EMAIL);
  await p.fill('input[name="password"]', sifre);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(3500);
  const hata = (await p.locator('text=/E-posta veya şifre hatalı/i').count()) > 0;
  const url = p.url();
  return { p, basarili: !hata && !url.includes('/auth/sign-in'), hata, url };
}

const eski = await girisDene(ESKI_SIFRE);
adim('ESKİ parola ile giriş', eski.basarili ? 'BAŞARILI (hatalı!)' : 'REDDEDİLDİ', !eski.basarili);
await eski.p.screenshot({ path: `${OUT}/07-eski-parola-reddedildi.png` });
await eski.p.close();

const yeni = await girisDene(YENI_SIFRE);
adim('YENİ parola ile giriş', yeni.basarili ? `BAŞARILI → ${yeni.url.replace(KOK, '')}` : 'REDDEDİLDİ (hatalı!)', yeni.basarili);
await yeni.p.screenshot({ path: `${OUT}/08-yeni-parola-giris.png` });
await yeni.p.close();

// ── Özet ───────────────────────────────────────────────────────────────────
const olcumlu = sonuc.filter((s) => s.gecti !== undefined);
const gecen = olcumlu.filter((s) => s.gecti).length;
console.log(`\n=== SONUÇ: ${gecen}/${olcumlu.length} kontrol geçti ===`);
const kalanlar = olcumlu.filter((s) => !s.gecti);
if (kalanlar.length) kalanlar.forEach((s) => console.log(`  ✗ ${s.ad}: ${s.deger}`));

fs.writeFileSync(`${OUT}/sonuc.json`, JSON.stringify(sonuc, null, 2));
await sql.end();
await browser.close();
console.log(`\nEkran görüntüleri: ${OUT}/`);
process.exit(kalanlar.length ? 1 : 0);
