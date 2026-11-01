#!/bin/bash
# #995628 · Kullanım (yerel, SSM ile sunucuda koşar):  KIP=ONIZLEME [ONIZLEME_ID=..] | KIP=GERI TEMA_ID=..  [KURU=1]
# ⛔ KIP=CANLI bu turda ÇALIŞTIRILMAZ (müşteriye söz: reklam ekibinin dönüşüne kadar canlıya basım yok).
set -e; D=$(cd "$(dirname "$0")" && pwd)
PAKET=$(tar -czf - -C "$D" bas.py yama.py md5.json ONCESI | base64 | tr -d '\n')
T=$(mktemp); cat > "$T" <<EOS
set -a; . /var/www/viamood/.env.production; set +a
rm -rf /tmp/t995628 && mkdir -p /tmp/t995628 && echo $PAKET | base64 -d | tar -xz -C /tmp/t995628
cd /tmp/t995628 && KIP=${KIP:-ONIZLEME} CANLI_ONAY=${CANLI_ONAY:-} ONIZLEME_ID=${ONIZLEME_ID:-} TEMA_ID=${TEMA_ID:-} KURU=${KURU:-} SIFIRLA=${SIFIRLA:-} python3 bas.py; rm -rf /tmp/t995628
EOS
SSM_TUR=${SSM_TUR:-100} bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh "$T"; rm -f "$T"
