# #994917 sunucu tarafi basim: canli GET -> md5 == ONCESI kapisi -> yama -> md5 == SONRASI kapisi -> PUT -> GET-back (<=20 sn) ; hata -> otomatik geri alma
import json,urllib.request,urllib.parse,urllib.error,os,hashlib,time,sys
B="/tmp/g994917-bas"; sys.path.insert(0,B); import yama
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; TEMA="195348856964"
H={"X-Shopify-Access-Token":T}; M=json.load(open(B+"/md5.json"))
md5=lambda s: hashlib.md5(s.encode()).hexdigest()
def url(k=None): return f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json"+(f"?asset%5Bkey%5D={urllib.parse.quote(k)}" if k else "")
def get(k): return json.load(urllib.request.urlopen(urllib.request.Request(url(k),headers=H),timeout=60))["asset"]["value"]
def var_mi(k):
    try: get(k); return True
    except urllib.error.HTTPError as e:
        if e.code==404: return False
        raise
def put(k,v): return urllib.request.urlopen(urllib.request.Request(url(),data=json.dumps({"asset":{"key":k,"value":v}}).encode(),method="PUT",headers={**H,"Content-Type":"application/json"}),timeout=90).status
def sil(k): return urllib.request.urlopen(urllib.request.Request(url(k),method="DELETE",headers=H),timeout=60).status
SIRA=os.environ.get("SIRA","snippets/via-satinal-ek.liquid,assets/via-product-overrides.css,sections/product-information.liquid,blocks/buy-buttons.liquid,blocks/via-cok-al.liquid,sections/whatsapp-sticky.liquid,sections/footer-group.json").split(",")
os.makedirs(B+"/ONCESI",exist_ok=True)
yeni={}; once={}
for k in SIRA:
    if M[k]["once"] is None:
        if var_mi(k): print("DUR: yeni dosya zaten var",k); sys.exit(0)
        yeni[k]=open(B+"/YENI/"+k.replace("/","__"),encoding="utf-8").read(); once[k]=None
    else:
        v=get(k); h=md5(v); time.sleep(0.4)
        if h==M[k]["sonra"][1]: print("ZATEN-BASILI",k); yeni[k]=None; continue
        if h!=M[k]["once"][1]: print("DUR: canli != yedek",k,h,"beklenen",M[k]["once"][1]); sys.exit(0)
        open(B+"/ONCESI/"+k.replace("/","__"),"w",encoding="utf-8").write(v); once[k]=v
        yeni[k]=yama.uygula(k,v)
    if yeni[k] is not None and md5(yeni[k])!=M[k]["sonra"][1]: print("DUR: sunucu yamasi md5",k,md5(yeni[k]),"!= yerel",M[k]["sonra"][1]); sys.exit(0)
    print("ON-KAPI OK",k,"once",M[k]["once"] and M[k]["once"][1],"-> sonra",M[k]["sonra"][1])
if os.environ.get("KURU"): print("KURU KOSU: on kapilar gecti, PUT YAPILMADI"); sys.exit(0)
basilan=[]; hata=None
for k in SIRA:
    if yeni[k] is None: continue
    try:
        st=put(k,yeni[k]); basilan.append(k)
        for _ in range(10):
            time.sleep(2); g=md5(get(k))
            if g==M[k]["sonra"][1]: break
        ok=(g==M[k]["sonra"][1]); print("PUT",k,st,"GET-BACK",g,"OK" if ok else "!!UYUSMADI")
        if not ok: hata=k+" get-back"; break
    except urllib.error.HTTPError as e:
        hata=k+" HTTP "+str(e.code)+" "+e.read().decode()[:400]; print("HATA",hata); break
    except Exception as e:
        hata=k+" "+repr(e)[:200]; print("HATA",hata); break
    time.sleep(0.6)
if hata:
    print("GERI-ALMA:",hata)
    for k in reversed(basilan):
        if once[k] is None: print("GERI",k,"SIL",sil(k))
        else: put(k,once[k]); time.sleep(3); print("GERI",k,md5(get(k))==M[k]["once"][1])
else: print("BASIM TAMAM",len(basilan),"dosya")
