# #995057 sunucu tarafı basım: canlı GET -> md5 == ONCESI kapısı -> ek blok (işaret 0 kez olmalı) -> md5 == SONRASI kapısı -> PUT -> GET-back
# GERI=1: canlı md5 == SONRASI ise ONCESI'ni geri yazar. KURU=1: kapılar, PUT yok.
import json,urllib.request,urllib.parse,urllib.error,os,hashlib,time,sys
B=os.path.dirname(os.path.abspath(__file__)); K="assets/via-product-overrides.css"; TEMA="195348856964"; ISARET="#995057 · ARAMA/ÜRÜN KARTI"
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; H={"X-Shopify-Access-Token":T}
M=json.load(open(B+"/md5.json")); md5=lambda s: hashlib.md5(s.encode()).hexdigest()
U=f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json"
get=lambda: json.load(urllib.request.urlopen(urllib.request.Request(U+"?asset%5Bkey%5D="+urllib.parse.quote(K),headers=H),timeout=60))["asset"]["value"]
put=lambda v: urllib.request.urlopen(urllib.request.Request(U,data=json.dumps({"asset":{"key":K,"value":v}}).encode(),method="PUT",headers={**H,"Content-Type":"application/json"}),timeout=60).status
def bekle(h):
    for _ in range(10):
        time.sleep(2); g=md5(get())
        if g==h: return g
    return g
canli=get(); h=md5(canli); print("CANLI",h,len(canli.encode()))
if os.environ.get("GERI"):
    if h==M["once"]: print("ZATEN-ONCESI"); sys.exit(0)
    if h!=M["sonra"]: print("DUR: canlı ne öncesi ne sonrası — elle bak"); sys.exit(1)
    once=open(B+"/ONCESI/assets__via-product-overrides.css",encoding="utf-8").read()
    print("PUT",put(once),"GET-BACK",bekle(M["once"])==M["once"]); sys.exit(0)
if h==M["sonra"]: print("ZATEN-BASILI"); sys.exit(0)
if h!=M["once"]: print("DUR: canlı != ONCESI",h,"beklenen",M["once"]); sys.exit(1)
if canli.count(ISARET)!=0: print("DUR: işaret zaten var"); sys.exit(1)
yeni=canli+open(B+"/ek-blok.css",encoding="utf-8").read()
if md5(yeni)!=M["sonra"]: print("DUR: yama md5",md5(yeni),"!= SONRASI",M["sonra"]); sys.exit(1)
print("ON-KAPI OK",M["once"],"->",M["sonra"])
if os.environ.get("KURU"): print("KURU: PUT YAPILMADI"); sys.exit(0)
try:
    st=put(yeni); g=bekle(M["sonra"]); print("PUT",st,"GET-BACK",g,"OK" if g==M["sonra"] else "!!UYUSMADI")
    if g!=M["sonra"]: raise RuntimeError("get-back")
except Exception as e:
    print("HATA",repr(e)[:300],"-> GERI-ALMA"); put(canli); print("GERI",bekle(M["once"])==M["once"]); sys.exit(1)
print("BASIM TAMAM")
