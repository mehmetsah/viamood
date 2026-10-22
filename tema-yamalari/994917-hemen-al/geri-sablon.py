# #994917 GERI ALMA (kendi kendine yeten): pakete gomulu ONCESI kopyalari (md5 = ONCESI) geri yazar, yeni snippet'i siler, GET-back ile dogrular.
# Sira: once render eden dosyalar geri alinir, snippet EN SON silinir (silinmis snippet'i render eden ara durum olmasin).
import json,urllib.request,urllib.parse,urllib.error,os,hashlib,time
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; TEMA="195348856964"
H={"X-Shopify-Access-Token":T}; B="/tmp/g994917-geri"; M=json.load(open(B+"/md5.json")); md5=lambda s: hashlib.md5(s.encode()).hexdigest()
def url(k=None): return f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json"+(f"?asset%5Bkey%5D={urllib.parse.quote(k)}" if k else "")
def get(k): return json.load(urllib.request.urlopen(urllib.request.Request(url(k),headers=H),timeout=60))["asset"]["value"]
for k in ["sections/footer-group.json","sections/whatsapp-sticky.liquid","blocks/via-cok-al.liquid","blocks/buy-buttons.liquid","sections/product-information.liquid","assets/via-product-overrides.css"]:
    v=open(B+"/ONCESI/"+k.replace("/","__"),encoding="utf-8").read(); assert md5(v)==M[k]["once"][1], k
    if md5(get(k))==M[k]["once"][1]: print("ZATEN-ONCESI",k); continue
    urllib.request.urlopen(urllib.request.Request(url(),data=json.dumps({"asset":{"key":k,"value":v}}).encode(),method="PUT",headers={**H,"Content-Type":"application/json"}),timeout=90)
    for _ in range(10):
        time.sleep(2)
        if md5(get(k))==M[k]["once"][1]: break
    print("GERI",k,md5(get(k))==M[k]["once"][1]); time.sleep(0.6)
try: print("SIL snippet",urllib.request.urlopen(urllib.request.Request(url("snippets/via-satinal-ek.liquid"),method="DELETE",headers=H),timeout=60).status)
except urllib.error.HTTPError as e: print("snippet",e.code)
