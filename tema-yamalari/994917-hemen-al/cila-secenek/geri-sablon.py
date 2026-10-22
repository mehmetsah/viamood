# #994917 CILA GERI ALMA: snippet'i pakete gomulu ONCESI icerigine (md5 5bb6a47d) geri yazar, GET-back ile dogrular.
import json,urllib.request,urllib.parse,os,hashlib,time
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; TEMA="195348856964"
H={"X-Shopify-Access-Token":T}; B="/tmp/g994917-cila-geri"; M=json.load(open(B+"/md5.json")); md5=lambda s: hashlib.md5(s.encode()).hexdigest()
def url(k=None): return f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json"+(f"?asset%5Bkey%5D={urllib.parse.quote(k)}" if k else "")
def get(k): return json.load(urllib.request.urlopen(urllib.request.Request(url(k),headers=H),timeout=60))["asset"]["value"]
k="snippets/via-satinal-ek.liquid"
v=open(B+"/ONCESI/snippets__via-satinal-ek.liquid",encoding="utf-8").read(); assert md5(v)==M[k]["once"][1]
if md5(get(k))==M[k]["once"][1]: print("ZATEN-ONCESI",k)
else:
    urllib.request.urlopen(urllib.request.Request(url(),data=json.dumps({"asset":{"key":k,"value":v}}).encode(),method="PUT",headers={**H,"Content-Type":"application/json"}),timeout=90)
    for _ in range(10):
        time.sleep(2)
        if md5(get(k))==M[k]["once"][1]: break
    print("GERI",k,md5(get(k))==M[k]["once"][1])
