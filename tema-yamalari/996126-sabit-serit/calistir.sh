#!/bin/bash
# Yerel: [KURU=1|GERI=1] bash calistir.sh — SSM ile sunucuda koşar, jeton yerel makineye inmez.
set -e; D=$(cd "$(dirname "$0")" && pwd); AD=$(basename "$D")
PARCA="bas.py yama.py md5.json ONCESI"; [ -d "$D/YENI" ] && PARCA="$PARCA YENI"
PAKET=$(tar -czf - -C "$D" $PARCA | base64 | tr -d '\n')
T=$(mktemp); cat > "$T" <<EOS
set -a; . /var/www/viamood/.env.production; set +a
rm -rf /tmp/t$AD && mkdir -p /tmp/t$AD && echo $PAKET | base64 -d | tar -xz -C /tmp/t$AD
cd /tmp/t$AD && KURU=${KURU:-} GERI=${GERI:-} python3 bas.py; rm -rf /tmp/t$AD
EOS
bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh "$T"; rm -f "$T"
