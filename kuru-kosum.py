#!/usr/bin/env python3
"""Nandy Home → Shopify · KURU KOŞUM (hiçbir şey YAZMAZ).

HeyMate'in 13 Eyl talebi: aktarımın okuma tarafını koş, eşleme raporu üret,
canlıya tek satır yazma.

Okuduğu kaynaklar (üçü de salt-okunur):
  · nandy_products.json  — Trendyol Satıcı API anlık görüntüsü (28 Ağu)
  · sku-map.json         — productMainId → SKU kalıcı eşlemesi
  · Shopify Admin API    — canlı kataloğun bugünkü hâli

Üretir: eslesme-raporu.json + ekrana özet.
Kullanım:  python3 kuru-kosum.py
"""
import json
import math
import os
import subprocess
import sys
from collections import Counter, defaultdict

KOK = os.path.dirname(os.path.abspath(__file__))
API = os.path.join(os.path.dirname(KOK), 'scripts', 'shopify-api.py')

VENDOR = 'Nandy Home'
SKU_BASLANGIC = 1100
FIYAT_CARPAN = 1.40


def fiyat_hesapla(sale_price):
    """SPEC: salePrice × 1,40 → en yakın 5 TL YUKARI yuvarla."""
    try:
        ham = float(sale_price or 0)
    except (TypeError, ValueError):
        return None
    if ham <= 0:
        return None  # SPEC: tahmin ÜRETİLMEZ
    return math.ceil(ham * FIYAT_CARPAN / 5) * 5


def shopify(yol):
    out = subprocess.run([sys.executable, API, 'raw', 'GET', yol],
                         capture_output=True, text=True)
    return json.loads(out.stdout) if out.stdout else {}


def canli_sayim():
    """Canlı sayımlar — count ucundan.

    DİKKAT: `since_id` ile sayfalama bu katalogda ÇAKIŞAN sayfalar döndürüyor
    (aynı ürün birden fazla sayfada çıkıyor) → elle sayım ürünü ŞİŞİRİYOR.
    13 Eyl'de bu yüzden 402 ürün 566 sayılmıştı. Kesin sayı için count ucu."""
    def say(ek=''):
        return shopify(f'products/count.json?vendor=Nandy%20Home{ek}').get('count', 0)
    return {'toplam': say(), 'draft': say('&status=draft'), 'active': say('&status=active')}


def canli_nandy():
    """Ürün detayları — SKU karşılaştırması için (tekilleştirilmiş)."""
    gorulen, urunler = set(), []
    yol = 'products.json?limit=250&fields=id,title,status,vendor,variants'
    for _ in range(10):
        d = shopify(yol)
        sayfa = d.get('products', [])
        if not sayfa:
            break
        for p in sayfa:
            if (p.get('vendor') or '').strip().lower() != VENDOR.lower():
                continue
            if p['id'] in gorulen:      # çakışan sayfa koruması
                continue
            gorulen.add(p['id'])
            urunler.append(p)
        if len(sayfa) < 250:
            break
        yol = ('products.json?limit=250&fields=id,title,status,vendor,variants'
               f"&since_id={sayfa[-1]['id']}")
    return urunler


def main():
    ham = json.load(open(os.path.join(KOK, 'nandy_products.json')))
    kayitlar = ham if isinstance(ham, list) else (ham.get('content') or ham.get('products') or [])
    sku_map = json.load(open(os.path.join(KOK, 'sku-map.json')))

    print('═' * 66)
    print('  NANDY HOME → SHOPIFY · KURU KOŞUM (yazma YOK)')
    print('═' * 66)

    # ── 1) Kaynak kapsamı ────────────────────────────────────────────────
    markalar = Counter((k.get('brand') or '?') for k in kayitlar)
    kapsam = [k for k in kayitlar if (k.get('brand') or '') == VENDOR]
    disi = [k for k in kayitlar if (k.get('brand') or '') != VENDOR]

    print('\n1) KAYNAK KAPSAMI')
    print(f'   toplam varyant           : {len(kayitlar)}')
    for m, n in markalar.most_common():
        isaret = '→ AKTARILIR' if m == VENDOR else '→ kapsam dışı (SPEC)'
        print(f'     {m:<16} {n:>4}  {isaret}')

    gruplar = defaultdict(list)
    for k in kapsam:
        gruplar[str(k.get('productMainId'))].append(k)
    print(f'   aktarılacak ürün (grup)  : {len(gruplar)}   ← bir productMainId = bir Shopify ürünü')

    # ── 2) Fiyat kuralı ──────────────────────────────────────────────────
    print('\n2) FİYAT KURALI  (salePrice × 1,40 → 5 TL yukarı)')
    fiyatsiz_grup, ornekler = [], []
    for pid, vs in gruplar.items():
        hesaplanan = [(v, fiyat_hesapla(v.get('salePrice'))) for v in vs]
        if all(f is None for _, f in hesaplanan):
            fiyatsiz_grup.append(pid)
        if len(ornekler) < 5 and hesaplanan[0][1]:
            v, f = hesaplanan[0]
            ornekler.append((v.get('title', '')[:40], v.get('salePrice'), f))
    for t, ham_f, yeni in ornekler:
        print(f'     {t:<42} {ham_f:>8} ₺ → {yeni:>6} ₺')
    print(f'   fiyatı olmayan ürün      : {len(fiyatsiz_grup)}  → SPEC gereği ATLANIR (tahmin yok)')

    # ── 3) Görseller ─────────────────────────────────────────────────────
    gorsel_say = [len(k.get('images') or []) for k in kapsam]
    gorselsiz = sum(1 for g in gorsel_say if g == 0)
    print('\n3) GÖRSELLER')
    print(f'   varyant başına ortalama  : {sum(gorsel_say)/max(len(gorsel_say),1):.1f}')
    print(f'   en çok / en az           : {max(gorsel_say)} / {min(gorsel_say)}')
    print(f'   görseli olmayan varyant  : {gorselsiz}')
    print('   taşıma: images[].url sırasıyla Shopify `images[{src,position}]` olarak gönderilir')

    # ── 4) Varyant ekseni ────────────────────────────────────────────────
    print('\n4) VARYANT / STOK')
    coklu = sum(1 for vs in gruplar.values() if len(vs) > 1)
    print(f'   tek varyantlı ürün       : {len(gruplar)-coklu}   → SKU "1234"')
    print(f'   çok varyantlı ürün       : {coklu}   → SKU "1234-1", "1234-2" …')
    stok = sum(int(k.get('quantity') or 0) for k in kapsam)
    print(f'   toplam stok (varyant tp) : {stok}')
    print('   stok: inventory_levels/set ile Trendyol quantity değeri yazılır')

    # ── 5) Desi ──────────────────────────────────────────────────────────
    desi = Counter(k.get('dimensionalWeight') for k in kapsam)
    print('\n5) DESİ / AĞIRLIK')
    print(f'   dimensionalWeight dağılımı: {dict(list(desi.items())[:4])}')
    print('   → tümü 0; SPEC gereği alan BOŞ bırakılır, tahmin üretilmez')

    # ── 6) İdempotenslik ─────────────────────────────────────────────────
    print('\n6) İDEMPOTENSLİK  (tekrar koşunca ne olur)')
    esli = [p for p in gruplar if p in sku_map]
    essiz = [p for p in gruplar if p not in sku_map]
    skular = [int(v) for v in sku_map.values() if str(v).isdigit()]
    print(f'   sku-map kayıt sayısı     : {len(sku_map)}  (aralık {min(skular)}–{max(skular)})')
    print(f'   eşlemesi OLAN ürün       : {len(esli)}   → aynı SKU korunur, güncellenir')
    print(f'   eşlemesi OLMAYAN ürün    : {len(essiz)}  → yeni SKU alır ({max(skular)+1}’den devam)')
    print(f'   SKU başlangıcı           : {SKU_BASLANGIC} ✓' if min(skular) == SKU_BASLANGIC
          else f'   SKU başlangıcı           : {min(skular)} ✗ (beklenen {SKU_BASLANGIC})')

    # ── 7) Canlı katalogla karşılaştırma ─────────────────────────────────
    print('\n7) CANLI KATALOG (Shopify, bugün)')
    sayim = canli_sayim()
    canli = canli_nandy()
    print(f'   vendor="{VENDOR}" ürün    : {sayim["toplam"]}  → '
          f'draft {sayim["draft"]} · active {sayim["active"]}   (count ucu = kesin)')
    print(f'   tekilleştirilmiş detay   : {len(canli)} ürün')
    canli_sku = set()
    for p in canli:
        for v in p.get('variants', []):
            s = (v.get('sku') or '').split('-')[0]
            if s.isdigit():
                canli_sku.add(int(s))
    beklenen = {int(v) for v in sku_map.values() if str(v).isdigit()}
    print(f'   canlıdaki benzersiz SKU  : {len(canli_sku)}')
    print(f'   sku-map’te olup canlıda olmayan : {len(beklenen - canli_sku)}')
    print(f'   canlıda olup sku-map’te olmayan : {len(canli_sku - beklenen)}')

    # ── Rapor dosyası ────────────────────────────────────────────────────
    rapor = {
        'kaynak': {'varyant': len(kayitlar), 'marka_dagilimi': dict(markalar),
                   'kapsam_varyant': len(kapsam), 'kapsam_urun': len(gruplar),
                   'kapsam_disi_varyant': len(disi)},
        'fiyat': {'carpan': FIYAT_CARPAN, 'yuvarlama': '5 TL yukarı',
                  'fiyatsiz_urun': len(fiyatsiz_grup)},
        'gorsel': {'gorselsiz_varyant': gorselsiz,
                   'ortalama': round(sum(gorsel_say)/max(len(gorsel_say), 1), 2)},
        'varyant': {'tek': len(gruplar)-coklu, 'coklu': coklu, 'toplam_stok': stok},
        'idempotens': {'sku_map': len(sku_map), 'eslesen': len(esli),
                       'yeni': len(essiz), 'sku_min': min(skular), 'sku_max': max(skular)},
        'canli': {'urun': sayim['toplam'], 'durum': {'draft': sayim['draft'], 'active': sayim['active']},
                  'benzersiz_sku': len(canli_sku),
                  'mapte_olup_canlida_yok': len(beklenen - canli_sku),
                  'canlida_olup_mapte_yok': len(canli_sku - beklenen)},
    }
    hedef = os.path.join(KOK, 'eslesme-raporu.json')
    json.dump(rapor, open(hedef, 'w'), ensure_ascii=False, indent=2)
    print(f'\n✓ Rapor yazıldı: {hedef}')
    print('✓ Canlıya HİÇBİR yazma yapılmadı.')


if __name__ == '__main__':
    main()
