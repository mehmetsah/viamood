#!/bin/bash
# Kullanım (yerel): KIP=KURU|BAS|GERI bash calistir.sh  — SSM ile sunucuda koşar, jeton yerel makineye inmez.
set -e; D=$(cd "$(dirname "$0")" && pwd)
PAKET=$(tar -czf - -C "$D" bas.py md5.json ek-blok.css ONCESI | base64 | tr -d '\n')
T=$(mktemp); cat > "$T" <<EOS
set -a; . /var/www/viamood/.env.production; set +a
rm -rf /tmp/t995057 && mkdir -p /tmp/t995057 && echo $PAKET | base64 -d | tar -xz -C /tmp/t995057
cd /tmp/t995057 && $( [ "$KIP" = KURU ] && echo "KURU=1" ) $( [ "$KIP" = GERI ] && echo "GERI=1" ) python3 bas.py; rm -rf /tmp/t995057
EOS
bash ~/asistan-veri/mehmet/raporlar/994771-tema-cekirdek/ssm2.sh "$T"; rm -f "$T"
