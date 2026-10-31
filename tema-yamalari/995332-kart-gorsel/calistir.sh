#!/bin/bash
# Kullanım (yerel, SSM ile sunucuda koşar):  KIP=ONIZLEME [ONIZLEME_ID=..] | KIP=CANLI | KIP=GERI TEMA_ID=..   [KURU=1]
set -e; D=$(cd "$(dirname "$0")" && pwd)
PAKET=$(tar -czf - -C "$D" bas.py yama.py md5.json ek-blok.css ONCESI YENI | base64 | tr -d '\n')
T=$(mktemp); cat > "$T" <<EOS
set -a; . /var/www/viamood/.env.production; set +a
rm -rf /tmp/t995332 && mkdir -p /tmp/t995332 && echo $PAKET | base64 -d | tar -xz -C /tmp/t995332
cd /tmp/t995332 && KIP=${KIP:-ONIZLEME} ONIZLEME_ID=${ONIZLEME_ID:-} TEMA_ID=${TEMA_ID:-} KURU=${KURU:-} SIFIRLA=${SIFIRLA:-} python3 bas.py; rm -rf /tmp/t995332
EOS
SSM_TUR=${SSM_TUR:-100} bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh "$T"; rm -f "$T"
