#!/bin/zsh
# Online due volte (registra SW e riempie cache), poi API irraggiungibile: deve mostrare dati offline.
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
P=$(mktemp -d)
python3 -m http.server 8765 --directory ~/Documents/Sviluppo/meteo-calabria >/dev/null 2>&1 &
S=$!
trap "kill $S" EXIT
sleep 1
run(){ "$CH" --headless=new --no-first-run --user-data-dir="$P" --virtual-time-budget=25000 --timeout=60000 "$@" --dump-dom http://localhost:8765/ 2>/dev/null \
  | python3 -c 'import re,sys; h=sys.stdin.read(); print("status:", (re.search(r"id=\"status\"[^>]*>(.*?)</div>",h,re.S) or [0,"?"])[1]); print("temp:", (re.search(r"id=\"nt\"[^>]*>(.*?)</div>",h,re.S) or [0,"?"])[1]); print("giorni:", h.count("class=\"day\"")); print("primo:", (re.search(r"class=\"dn\">(.*?)<",h) or [0,"?"])[1])'; }
echo "--- online 1"; run
echo "--- online 2"; run
echo "--- API bloccata"; run --host-resolver-rules="MAP api.open-meteo.com 127.0.0.1:1"
