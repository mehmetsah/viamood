# #994771 GERI ALMA — sunucudaki basim-oncesi kopyalardan (md5'i yerel CANLI-YEDEK ile birebir) geri yukler
set -a; . /var/www/viamood/.env.production; set +a
echo ewogImFzc2V0cy9lbXBpcmUtb3ZlcnJpZGVzLmNzcyI6IHsKICAib25jZSI6IFsKICAgNjc3OCwKICAgIjVjMjhlMTljZGU5MGUwODNiN2E4YmRkYjhjMGRhZmUyIgogIF0sCiAgInNvbnJhIjogWwogICA3NzczLAogICAiMWI2ZjYzMDA5ZTVkYjZlYWJhYjAxYzU5NDE0NDkzZDQiCiAgXQogfSwKICJhc3NldHMvYmFzZS5jc3MiOiB7CiAgIm9uY2UiOiBbCiAgIDEwNDEyMSwKICAgIjgzNmJlODEyYWM4ZDAwNjYwODkxNjIxNGYwYjlkNWY2IgogIF0sCiAgInNvbnJhIjogWwogICAxMDQ1NjQsCiAgICJlODE5NDZkMTdhOTdjN2YzYTU1ZWE2ZDJlYjViZGZlYSIKICBdCiB9LAogInNuaXBwZXRzL3F1YW50aXR5LXNlbGVjdG9yLmxpcXVpZCI6IHsKICAib25jZSI6IFsKICAgNjU4MywKICAgImVlNzJjNGViOTVhMTA0ZTQ0YmJlY2I5NmRkNzU3MDQwIgogIF0sCiAgInNvbnJhIjogWwogICA2NjIzLAogICAiMGJiZTZjZDBkOGNkNTJjMDBjMGNmZmQyNGUyMzM0YTQiCiAgXQogfSwKICJzbmlwcGV0cy9za3UubGlxdWlkIjogewogICJvbmNlIjogWwogICA3MDEsCiAgICJlMjQzM2IwNjA0NmM3NmI1ZGNiMmZiZTE1MzQ2ZTM1ZSIKICBdLAogICJzb25yYSI6IFsKICAgNzAxLAogICAiY2NhNWFlOWUwNjUxN2JmODdmMDkxZTk2MWIwMzdhMjEiCiAgXQogfSwKICJzbmlwcGV0cy9wcmVkaWN0aXZlLXNlYXJjaC1wcm9kdWN0cy1saXN0LmxpcXVpZCI6IHsKICAib25jZSI6IFsKICAgNDI3OSwKICAgIjBkNTM1NWU0YTM1Mzc5ZDg2MTg2OWRiOGI2ZDU5Y2I3IgogIF0sCiAgInNvbnJhIjogWwogICA0Mjc5LAogICAiOGZlZDA0NTI5NjI3MTJkZGY4YTk4MjRmMTg0NjdhYWYiCiAgXQogfSwKICJzbmlwcGV0cy9wcmVkaWN0aXZlLXNlYXJjaC1zdHlsZXMubGlxdWlkIjogewogICJvbmNlIjogWwogICAyMDY0NywKICAgIjY4ZmQ5N2M0ODNlMTFiNWFkYjcwYjdkNjMyNTRiYzUyIgogIF0sCiAgInNvbnJhIjogWwogICAyMDc5NSwKICAgIjgwYzc1ZTYxNzg4NzI5ZmM2NTQ4MGRiM2ViMzM1MGEyIgogIF0KIH0sCiAic25pcHBldHMvdmlhLWthcmdvLXNheWFjaS5saXF1aWQiOiB7CiAgIm9uY2UiOiBbCiAgIDEyMTI5LAogICAiZjk2NGVjMjgzMWIwNDRmMjQ5MDZjYWUyNmZmMTBlYzAiCiAgXSwKICAic29ucmEiOiBbCiAgIDEyMTE5LAogICAiZmI1ZGQ4Y2Y3OGMwMTRhOWYzNmZkYzk2OWU1Y2Y1ZTMiCiAgXQogfSwKICJhc3NldHMvdmlhLW1vYmlsZS1hcHAuY3NzIjogewogICJvbmNlIjogWwogICAzNTMxMywKICAgIjNjZGJjM2FmZDk5NzA1OGUxYTY3YWEwMGRjMTA2OTdkIgogIF0sCiAgInNvbnJhIjogWwogICAzNTQ0NSwKICAgIjJmYThjYmY0MTc5N2YyOWJmNzQ4ZDdiYTMzYWRlYmVlIgogIF0KIH0sCiAiYXNzZXRzL3ZpYS1wcm9kdWN0LW92ZXJyaWRlcy5jc3MiOiB7CiAgIm9uY2UiOiBbCiAgIDM5NDE0LAogICAiMzFiYTFlMDQ5MTRiMTdjMTBhZmRkZGFhYjZmNjkzZWIiCiAgXSwKICAic29ucmEiOiBbCiAgIDM5OTI0LAogICAiMWU3MWNkODQ1NzdkZWEyN2U3YTUwYmU1NjljMDEyNjAiCiAgXQogfSwKICJ0ZW1wbGF0ZXMvcHJvZHVjdC5qc29uIjogewogICJvbmNlIjogWwogICAyNzA0MCwKICAgIjdlYmI3N2M1N2I5NWU5NmY0ZGRhYmE4NDFhMzY2Mjg4IgogIF0sCiAgInNvbnJhIjogWwogICAyNzA0MCwKICAgIjdmMzFjMWRhNDFlMDcyYzhjNmY4OGU2Zjc1MjVmZjJmIgogIF0KIH0KfQo= | base64 -d > /tmp/g994771/md5.json
python3 - <<"PYEOF"
import json,urllib.request,urllib.parse,os,hashlib,time
T=os.environ["SHOPIFY_ADMIN_ACCESS_TOKEN"]; D=os.environ["SHOPIFY_STORE_DOMAIN"]; V=os.environ["SHOPIFY_API_VERSION"]; TEMA="195348856964"
M=json.load(open("/tmp/g994771/md5.json")); md5=lambda s: hashlib.md5(s.encode()).hexdigest()
H=lambda: {"X-Shopify-Access-Token":T,"Content-Type":"application/json"}
for k in M:
    v=open("/tmp/g994771/basim-once/"+k.replace("/","__")).read()
    if md5(v)!=M[k]["once"][1]: print("ATLA: sunucu kopyasi yedekle ayni degil",k); continue
    urllib.request.urlopen(urllib.request.Request(f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json",data=json.dumps({"asset":{"key":k,"value":v}}).encode(),method="PUT",headers=H()),timeout=90)
    for _ in range(10):
      time.sleep(2)
      g=md5(json.load(urllib.request.urlopen(urllib.request.Request(f"https://{D}/admin/api/{V}/themes/{TEMA}/assets.json?asset%5Bkey%5D={urllib.parse.quote(k)}",headers=H()),timeout=60))["asset"]["value"])
      if g==M[k]["once"][1]: break
    print("GERI",k,g,"=YEDEK" if g==M[k]["once"][1] else "!!UYUSMADI")
print("GERI-ALMA-BITTI",time.strftime("%H:%M:%S"))
PYEOF
