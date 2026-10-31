/**
 * #995332 · ayse:802 · E8 — KART GÖRSELİ DAVRANIŞ ÇİVİSİ.
 * Statik çivi (kart-gorsel-tutarlilik-tema.test.ts) betiğin METNİNİ okur; md5.json yeniden üretildiğinde
 * çalışma zamanı dallarının çoğunu göremiyordu (31 Eki dal envanteri: B kipinde 0'dan büyük sağ mutant).
 * Bu çivi betiği sahte DOM + tuval içinde ÇALIŞTIRIR (kart-gorsel-davranis.kosum.ts) ve gözlenebilir çıktıyı
 * d5102cc'nin ölçülmüş davranışına sabitler; yama.py'nin `uygula` kapılarını da gerçek girdilerle koşturur.
 * A1 (31 Eki): beklenen.json yeniden üretildi — değişen YALNIZ A1'in hedeflediği 6 çıktı (F5 ×4 senaryo · F11 · F12) +
 * eklenen F18–F22 fikstürleri; ayrıntı raporlar/995332-a1-kapanis-20261031.md.
 * MUTASYON: betikte ya da yama.py'de herhangi bir karar noktası iki yönünden biriyle çevrilirse (md5.json yeniden
 * üretilse bile) bu dosyadaki en az bir iddia KIRILIR — envanter: raporlar/995332-sah-imza2-20261031.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIKSTUR, izler, type Iz } from './kart-gorsel-davranis.kosum';

const P = path.join(__dirname, '..', 'tema-yamalari', '995332-kart-gorsel');
const JS = readFileSync(path.join(P, 'YENI', 'assets__via-kart-gorsel.js'), 'utf8');
const BEKLENEN = JSON.parse(readFileSync(path.join(__dirname, 'kart-gorsel-davranis.beklenen.json'), 'utf8')) as Record<string, Iz>;
const IZ = izler(JS);

type Cikti = { ad: string; scale: string | null; translate: string | null; kirp: string | null; load: number };
const cikti = (k: string) => (IZ[k] as { cikti: Cikti[] }).cikti;
const ad = (k: string, a: string) => cikti(k).find((c) => c.ad === a)!;

describe('#995332 E8 · via-kart-gorsel.js davranışı', () => {
  it('bütün senaryolarda gözlenebilir çıktı d5102cc ölçümüyle BİREBİR (scale · translate · data-via-kirp · hata · rAF · gözlemci)', () => {
    expect(IZ).toEqual(BEKLENEN);
  });

  it('ölçek tabanı ve tavanı: hiçbir görsel contain altına inmez (≥ 1), 3 üstüne çıkmaz; dolu görsel olduğu gibi kalır', () => {
    for (const c of cikti('S1').filter((x) => x.scale !== null)) {
      expect(Number(c.scale)).toBeGreaterThanOrEqual(1);
      expect(Number(c.scale)).toBeLessThanOrEqual(3);
      expect(c.translate).toMatch(/^-?\d+\.\d{3}% -?\d+\.\d{3}%$/);
    }
    expect(ad('S1', 'F2-dolu')).toMatchObject({ scale: '1.0000', translate: '0.000% 0.000%', kirp: '1.00' });
    expect(ad('S1', 'F6-minik').scale).toBe('3.0000');
  });

  it('ölçülemeyen görsel (bembeyaz · yüksekliği 0 · 2B bağlam yok · tuval okunamıyor) "yok" işaretlenir, hata atılmaz', () => {
    expect(ad('S1', 'F7-beyaz')).toMatchObject({ scale: null, kirp: 'yok' });
    expect(ad('S1', 'F16-nh0')).toMatchObject({ scale: null, kirp: 'yok' });
    for (const k of ['S8', 'S9']) {
      expect(cikti(k).map((c) => c.kirp)).toEqual(['yok', 'yok']);
      expect((IZ[k] as { hatalar: string[] }).hatalar).toEqual([]);
    }
  });

  it('eşikler: alfa 16 içerik, 15 değil · tek kanalda 19 sapma içerik, 18 değil · en sol sütun ölçülür', () => {
    expect(ad('S1', 'F9-alfa-esik').translate).toBe('28.914% 0.000%');
    expect(ad('S1', 'F10-renk-esik')).toMatchObject({ scale: '1.0831', translate: '0.000% 11.282%' });
    expect(ad('S1', 'F11-sol-sutun').kirp).toBe('3.00');
  });

  it('contain eşitlik kenarı (W / oran === H): sığdırma dalı yalnız dh > H iken alınır', () => {
    expect(ad('S1', 'F17-esitlik-kenari')).toMatchObject({ scale: '1.3200', translate: '-3.143% 14.438%' });
  });

  it('A1 · ölçek tabanda (s = EN_AZ) ve eksen dolu ⇒ o eksende translate 0; kaydırma görüntü kenarını kap kenarından içeri çekmez', () => {
    // Ayşe md.31 turu (31 Eki): s = 1'de içerik merkeze çekiliyor, kabı dolduran fotoğrafın bir-iki kenarında kartın beyazı açılıyordu.
    expect(ad('S1', 'F18-dolu-kayik')).toMatchObject({ scale: '1.0000', translate: '0.000% 0.000%' }); // eski: 1.163% 2.344%
    expect(ad('S1', 'F2-dolu')).toMatchObject({ scale: '1.0000', translate: '0.000% 0.000%' });
    // kenara değen içerik (s = 1): o eksende kaydırma yok — dolmayan eksende bile
    expect(ad('S1', 'F19-kare-ust-kenar').translate).toBe('0.000% 0.000%'); // eski: 0.781% 1.563%
    expect(ad('S1', 'F20-kare-alt-kenar').translate).toBe('0.000% 0.000%'); // eski: 0.781% -1.563%
    // dolmayan ve kenara değmeyen eksende kaydırma KORUNUR (contain'in boşluğunda içerik ortalanır)
    expect(ad('S1', 'F21-kare-bos-eksen').translate).toBe('0.000% -1.563%');
    // her eksen KENDİ kutusuna bakar: üst kenara değen içerik yatay kaydırmayı sıfırlamaz
    expect(ad('S1', 'F22-uzun-ust-kenar')).toMatchObject({ scale: '1.0000', translate: '2.381% 0.000%' });
    // s > 1: kaydırma |t| ≤ (s·d − K)/2 ile sınırlı — görüntü kenarı kap kenarından içeri girmez
    expect(ad('S1', 'F5-kose').translate).toBe('90.316% -48.807%'); // eski: 90.316% -54.035% (alt kenarda beyaz açılıyordu)
    // s > 1 ve içerik kenara değiyor: kaydırma sıfırlanmaz, sınıra çekilir — içerik kabın kenarına oturur, KESİLMEZ
    expect(ad('S1', 'F11-sol-sutun')).toMatchObject({ scale: '3.0000', translate: '100.000% 0.000%' }); // 0 olsaydı içerik kabın dışında kalırdı
    expect(ad('S1', 'F12-sola-yasli')).toMatchObject({ scale: '1.7600', translate: '38.000% 0.000%' });
    // genel değişmez: her çıktıda |kaydırma| ≤ (s·d − K)/2 (dolu eksen) — fikstürün kendi geometrisiyle
    for (const t of FIKSTUR) {
      const c = ad('S1', t.ad); if (!c || c.scale === null || !t.nh) continue;
      const s = Number(c.scale), o = t.nw / t.nh; let dw = t.W, dh = t.W / o; if (dh > t.H) { dh = t.H; dw = t.H * o; }
      const [tx, ty] = c.translate!.split(' ').map((v) => Number(v.replace('%', '')));
      if (s * dw >= t.W) expect(Math.abs(tx!), `${t.ad} x`).toBeLessThanOrEqual((100 * (s * dw - t.W)) / (2 * t.W) + 0.001);
      if (s * dh >= t.H) expect(Math.abs(ty!), `${t.ad} y`).toBeLessThanOrEqual((100 * (s * dh - t.H)) / (2 * t.H) + 0.001);
    }
  });

  it('kapatma anahtarı yalnız tam "via_kirp=0" parametresinde çalışır', () => {
    for (const q of ['?via_kirp=0', '?q=x&via_kirp=0', '?via_kirp=0&q=x']) {
      const s = IZ['S2 ' + q] as { cikti: Cikti[]; mo: unknown; resize: number };
      expect(s.cikti[0]).toMatchObject({ scale: null, kirp: null, load: 0 });
      expect(s.mo).toBeNull();
      expect(s.resize).toBe(0);
    }
    for (const q of ['?via_kirp=00', '?xvia_kirp=0', '?via_kirp=01', '?q=via_kirp=0', '(boş)'])
      expect((IZ['S2 ' + q] as { cikti: Cikti[] }).cikti[0]!.scale).toBe('1.7600');
  });

  it('yükleme: tamamlanmamış ya da kırık görsel ölçülmez; load gelince ölçülür', () => {
    expect(cikti('S3-once')[0]).toMatchObject({ scale: null, kirp: null, load: 1 });
    expect(cikti('S3')[0]!.scale).toBe('1.7600');
    expect(cikti('S3-kademeli-once')[0]).toMatchObject({ scale: null, kirp: null });
    expect(cikti('S3-kademeli')[0]!.scale).toBe('2.9642');
    expect(cikti('S4')[0]).toMatchObject({ scale: null, kirp: null });
  });

  it('sonradan eklenen kartlar: kök + subtree gözlenir, aynı karede tek rAF, görsele tek load dinleyicisi', () => {
    expect((IZ.S1 as { mo: unknown }).mo).toEqual({ childList: true, subtree: true, kokte: true });
    expect((IZ['S5-ara'] as { raf: number }).raf).toBe(1);
    expect(cikti('S5-ara').map((c) => c.scale)).toEqual([null, null]);
    expect((IZ.S5 as { raf: number }).raf).toBe(2);
    expect(cikti('S5').map((c) => c.scale)).toEqual(['1.7600', '2.9642']);
    expect(cikti('S6')[0]!.load).toBe(1);
  });

  it('yeniden boyutlama: ölçülemeyen görsel diğerlerini durdurmaz; gizliyken ölçülen görsel görünür olunca yerleşir', () => {
    expect(cikti('S7-once').map((c) => c.scale)).toEqual([null, '1.7600', null, null]);
    expect(cikti('S7').map((c) => c.scale)).toEqual([null, '1.4821', '2.9642', '1.0831']);
    expect((IZ.S7 as { hatalar: string[] }).hatalar).toEqual([]);
  });

  it('belge durumu: yüklenirken DOMContentLoaded beklenir, tamamlanmışsa hemen taranır', () => {
    expect(cikti('S10-once')[0]!.scale).toBeNull();
    expect(cikti('S10')[0]!.scale).toBe('1.7600');
    expect((IZ.S11 as { dcl: number }).dcl).toBe(0);
    expect(cikti('S11')[0]!.scale).toBe('1.7600');
  });
});

/** yama.py'yi gerçek dosyalarla koşturur. Çıktı TEK satır JSON olmalı: `import yama` yan etkisiz (üreteci koşturmaz, yazmaz). */
const yama = (kod: string) => {
  const cikis = execFileSync('python3', ['-c', `import sys, json, hashlib\nsys.path.insert(0, ${JSON.stringify(P)})\nimport yama\n${kod}`], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, // tema-yamalari altına __pycache__ bırakmaz
  });
  const satirlar = cikis.trim().split('\n');
  expect(satirlar).toHaveLength(1);
  return JSON.parse(satirlar[0]!);
};

describe('#995332 E8 · yama.py uygula kapıları', () => {
  it('ÖNCESİ girdisinden üretilen her dosya md5.json SONRASI ile birebir', () => {
    const r = yama(`
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
out = {}
for k in ['layout/theme.liquid', 'assets/via-product-overrides.css', 'sections/via-koleksiyon-v2.liquid']:
    o = open(${JSON.stringify(P)} + '/ONCESI/' + k.replace('/', '__'), encoding='utf-8').read()
    out[k] = md5(yama.uygula(k, o))
print(json.dumps(out))`);
    const M = JSON.parse(readFileSync(path.join(P, 'md5.json'), 'utf8')) as Record<string, { sonra: string }>;
    expect(r).toEqual({
      'layout/theme.liquid': '81c6fe649d0f3dea719ecf9085adbc02',
      'assets/via-product-overrides.css': '650ac685f829ce0d6352628997363da5',
      'sections/via-koleksiyon-v2.liquid': '5452b1726327e1d744739e412039bed4',
    });
    for (const k of Object.keys(r)) expect(M[k]!.sonra).toBe(r[k]);
  });

  it('kapılar: çapa yok · çapa iki kez · yama zaten basılı · bilinmeyen dosya → DUR (sessizce yazmaz)', () => {
    const r = yama(`
def dene(k, v):
    try:
        yama.uygula(k, v); return 'GECTI'
    except SystemExit as e:
        return str(e).split(':')[0]
B = ${JSON.stringify(P)}
oku = lambda d, k: open(B + '/' + d + '/' + k.replace('/', '__'), encoding='utf-8').read()
out = {}
for k, capa in [('layout/theme.liquid', yama.CAPA_LAYOUT), ('sections/via-koleksiyon-v2.liquid', yama.CAPA_KOL)]:
    o = oku('ONCESI', k)
    out[k + ' capa-yok'] = dene(k, o.replace(capa, ''))
    out[k + ' capa-iki'] = dene(k, o.replace(capa, capa + capa))
    out[k + ' zaten-basili'] = dene(k, oku('SONRASI', k))
out['layout yalniz-script'] = dene('layout/theme.liquid', oku('ONCESI', 'layout/theme.liquid') + yama.EK_LAYOUT)
out['koleksiyon yalniz-isaret'] = dene('sections/via-koleksiyon-v2.liquid', oku('ONCESI', 'sections/via-koleksiyon-v2.liquid') + yama.ISARET)
out['css zaten-basili'] = dene('assets/via-product-overrides.css', oku('SONRASI', 'assets/via-product-overrides.css'))
out['bilinmeyen'] = dene('assets/baska.css', 'x')
print(json.dumps(out))`);
    expect(r).toEqual({
      'layout/theme.liquid capa-yok': 'DUR layout/theme.liquid',
      'layout/theme.liquid capa-iki': 'DUR layout/theme.liquid',
      'layout/theme.liquid zaten-basili': 'DUR layout/theme.liquid',
      'sections/via-koleksiyon-v2.liquid capa-yok': 'DUR sections/via-koleksiyon-v2.liquid',
      'sections/via-koleksiyon-v2.liquid capa-iki': 'DUR sections/via-koleksiyon-v2.liquid',
      'sections/via-koleksiyon-v2.liquid zaten-basili': 'DUR sections/via-koleksiyon-v2.liquid',
      'layout yalniz-script': 'DUR layout/theme.liquid',
      'koleksiyon yalniz-isaret': 'DUR sections/via-koleksiyon-v2.liquid',
      'css zaten-basili': 'DUR assets/via-product-overrides.css',
      bilinmeyen: 'bilinmeyen dosya assets/baska.css',
    });
  });

  it('üreteç: `python3 yama.py` geçici kopyada paketi BİREBİR yeniden üretir (md5.json + SONRASI)', () => {
    const r = yama(`
import os, shutil, tempfile, filecmp
B = ${JSON.stringify(P)}
T = tempfile.mkdtemp()
for d in ['ONCESI', 'YENI']: shutil.copytree(B + '/' + d, T + '/' + d)
for f in ['yama.py', 'ek-blok.css']: shutil.copy(B + '/' + f, T + '/' + f)
import subprocess
subprocess.run([sys.executable, T + '/yama.py'], check=True, capture_output=True)
ayni = [filecmp.cmp(B + '/md5.json', T + '/md5.json', shallow=False)] + [filecmp.cmp(B + '/SONRASI/' + f, T + '/SONRASI/' + f, shallow=False) for f in sorted(os.listdir(B + '/SONRASI'))]
shutil.rmtree(T)
print(json.dumps(ayni))`);
    expect(r).toEqual([true, true, true, true]);
  });
});
