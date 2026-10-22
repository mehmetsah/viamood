import json,urllib.request,urllib.parse,os,hashlib,time,sys,runpy
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; S=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]
KAYNAK="195348856964"; HEDEF=sys.argv[1]; MOD=sys.argv[2]  # MOD: kuru | yaz
SPEC=runpy.run_path("/tmp/yama-spec-994886.py")["SPEC"]
YED="/home/ubuntu/yedek-994886"; os.makedirs(YED,exist_ok=True)
def istek(yol,veri=None,yontem="GET"):
    r=urllib.request.Request(f"https://{S}/admin/api/{V}/{yol}",data=json.dumps(veri).encode() if veri else None,method=yontem,headers={"X-Shopify-Access-Token":T,"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(r,timeout=120))
def al(tema,k): return istek(f"themes/{tema}/assets.json?asset[key]={urllib.parse.quote(k)}")["asset"]["value"]
md5=lambda s: hashlib.md5(s.encode()).hexdigest()
for k,degisim in SPEC.items():
    v=al(KAYNAK,k); once=md5(v)
    yol=f"{YED}/ONCESI-{HEDEF}__{k.replace('/','__')}"
    if not os.path.exists(yol): open(yol,"w").write(v)
    yeni=v; tamam=True
    for i,(e,y,beklenen) in enumerate(degisim):
        n=yeni.count(e)
        ok=(n>=1) if beklenen==-1 else (n==beklenen)
        print(f"  {k} #{i+1}: eşleşme {n} (beklenen {'≥1' if beklenen==-1 else beklenen}) {'✓' if ok else '✗'}")
        if not ok: tamam=False; break
        yeni=yeni.replace(e,y)
    if not tamam: print("  ⛔ DURDU",k); sys.exit(2)
    sonra=md5(yeni); open(f"{YED}/SONRASI-{HEDEF}__{k.replace('/','__')}","w").write(yeni)
    print(f"{k}: ÖNCE {once} ({len(v)} B) → SONRA {sonra} ({len(yeni)} B)")
    if MOD!="yaz": continue
    istek(f"themes/{HEDEF}/assets.json",{"asset":{"key":k,"value":yeni}},"PUT")
    for d in range(10):
        time.sleep(2); g=md5(al(HEDEF,k))
        if g==sonra: break
    print(f"   PUT tema {HEDEF} → GET-back {g} {'= SONRA ✓' if g==sonra else '≠ ✗'}")
    time.sleep(0.6)
