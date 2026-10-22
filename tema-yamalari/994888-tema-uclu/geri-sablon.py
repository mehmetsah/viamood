# #994888 GERI ALMA: sunucudaki basim-oncesi kopyalari (md5 = ONCESI) geri yazar, yeni snippet'i siler, GET-back ile dogrular.
import json,urllib.request,urllib.parse,urllib.error,os,hashlib,time
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; TEMA="195348856964"
H={"X-Shopify-Access-Token":T}; B="/tmp/g994888-bas"; M=json.load(open(B+"/md5.json")); md5=lambda s: hashlib.md5(s.encode()).hexdigest()
def url(k=None): return f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json"+(f"?asset%5Bkey%5D={urllib.parse.quote(k)}" if k else "")
def get(k): return json.load(urllib.request.urlopen(urllib.request.Request(url(k),headers=H),timeout=60))["asset"]["value"]
for k in ["templates/product.json","layout/theme.liquid","assets/via-product-overrides.css"]:
    v=open(B+"/ONCESI/"+k.replace("/","__")).read(); assert md5(v)==M[k]["once"][1], k
    urllib.request.urlopen(urllib.request.Request(url(),data=json.dumps({"asset":{"key":k,"value":v}}).encode(),method="PUT",headers={**H,"Content-Type":"application/json"}),timeout=90)
    for _ in range(10):
        time.sleep(2)
        if md5(get(k))==M[k]["once"][1]: break
    print("GERI",k,md5(get(k))==M[k]["once"][1])
try: print("SIL snippet",urllib.request.urlopen(urllib.request.Request(url("snippets/via-politika-baslik.liquid"),method="DELETE",headers=H),timeout=60).status)
except urllib.error.HTTPError as e: print("snippet",e.code)
