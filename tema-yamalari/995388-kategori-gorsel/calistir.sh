#!/bin/bash
# Yerel: [KURU=1|GERI=1] bash calistir.sh — SSM ile sunucuda koşar, jeton yerel makineye inmez.
set -e; D=$(cd "$(dirname "$0")" && pwd)
PAKET=$(tar -czf - -C "$D" bas.py yama.py md5.json ONCESI | base64 | tr -d '\n')
T=$(mktemp); cat > "$T" <<EOS
set -a; . /var/www/viamood/.env.production; set +a
rm -rf /tmp/t995388 && mkdir -p /tmp/t995388 && echo $PAKET | base64 -d | tar -xz -C /tmp/t995388
cd /tmp/t995388 && KURU=${KURU:-} GERI=${GERI:-} python3 bas.py; rm -rf /tmp/t995388
EOS
bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh "$T"; rm -f "$T"
