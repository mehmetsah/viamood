#!/usr/bin/env python3
"""#994887 — kaynak izi tema yamasını CANLI temaya basar. SUNUCUDA koşar (token makineye inmez).

  python3 bas.py kuru            # GET + yama + md5 dökümü; HİÇBİR ŞEY yazmaz
  python3 bas.py bas             # yedek → snippet → via-checkout → theme.liquid, her PUT'tan sonra GET-back
  python3 bas.py geri <yedek>    # theme.liquid → via-checkout geri; snippet BIRAKILIR (render edilmeyen snippet zararsız)

SIRA ÖNEMLİ: snippet theme.liquid'den ÖNCE basılır — tersi her sayfada "snippet bulunamadı" Liquid
hatası üretir. Bir GET-back tutmazsa basılanlar ters sırayla geri alınır.
Ortam: /var/www/viamood/.env.production (SHOPIFY_ADMIN_ACCESS_TOKEN · SHOPIFY_STORE_DOMAIN · SHOPIFY_API_VERSION).
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
import yama  # noqa: E402

TEMA = os.environ.get("VIAMOOD_TEMA", "195348856964")
T = os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D = os.environ["SHOPIFY_STORE_DOMAIN"]; V = os.environ["SHOPIFY_API_VERSION"]
SNIP = "snippets/via-kaynak-izi.liquid"
SIRA = [SNIP, "sections/via-checkout.liquid", "layout/theme.liquid"]
md5 = lambda s: hashlib.md5(s.encode()).hexdigest()


def get(k):
    u = f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json?asset%5Bkey%5D={urllib.parse.quote(k)}"
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"X-Shopify-Access-Token": T}), timeout=60)
        return json.load(r)["asset"]["value"]
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise


def put(k, v):
    body = json.dumps({"asset": {"key": k, "value": v}}).encode()
    req = urllib.request.Request(f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json", data=body, method="PUT",
                                 headers={"X-Shopify-Access-Token": T, "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=90).status


def put_dogrula(k, v):
    st = put(k, v)
    # okuma-yazma gecikmesi ölçülmüş (#994771): 20 sn'ye kadar yokla
    for _ in range(10):
        time.sleep(2)
        g = get(k)
        if g is not None and md5(g) == md5(v): return st, True
    return st, False


def hazirla():
    once, yeni = {}, {}
    for k in SIRA:
        v = get(k); once[k] = v; time.sleep(0.5)
        if k == SNIP:
            yeni[k] = yama.snippet()
        else:
            if v is None: raise SystemExit(f"DUR: canlıda {k} yok")
            yeni[k] = yama.uygula(k, v)  # çapa ≠ 1 ya da zaten yamalıysa DURUR
        print("HAZIR", k, "ONCE", None if v is None else [len(v.encode()), md5(v)], "SONRA", [len(yeni[k].encode()), md5(yeni[k])])
    return once, yeni


def main():
    kip = sys.argv[1] if len(sys.argv) > 1 else "kuru"
    if kip == "geri":
        d = sys.argv[2]
        for k in reversed(SIRA[1:]):
            v = open(os.path.join(d, k.replace("/", "__")), encoding="utf-8").read()
            st, ok = put_dogrula(k, v); print("GERI", k, st, md5(v), "OK" if ok else "!!UYUSMADI")
        return
    once, yeni = hazirla()
    if kip == "kuru":
        print("KURU: hiçbir şey yazılmadı"); return
    d = f"/tmp/k994887/basim-once-{time.strftime('%Y%m%d-%H%M%S')}"
    os.makedirs(d, exist_ok=True)
    for k, v in once.items():
        if v is not None: open(os.path.join(d, k.replace("/", "__")), "w", encoding="utf-8").write(v)
    print("YEDEK", d)
    basilan = []
    for k in SIRA:
        st, ok = put_dogrula(k, yeni[k]); basilan.append(k)
        print("PUT", k, st, "GET-BACK", md5(yeni[k]), "OK" if ok else "!!UYUSMADI")
        if not ok:
            print("GERI-ALMA BASLADI")
            for b in reversed(basilan):
                if once[b] is not None:
                    st2, ok2 = put_dogrula(b, once[b]); print("GERI", b, st2, "OK" if ok2 else "!!UYUSMADI")
            raise SystemExit(1)
    print("BASIM TAMAM · geri alma: python3 bas.py geri", d)


if __name__ == "__main__":
    main()
