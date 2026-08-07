#!/bin/bash
#
# Harnais de non-regression pour l'emballement du dashboard (2026-08-07).
#
# Le bug : les caches de `discover.ts` et `worktrees.ts` s'horodataient avant
# leur calcul. Des que le calcul depassait le TTL, le cache naissait perime,
# chaque requete relancait un scan git complet, et le serveur ne redescendait
# jamais. Ce script reproduit la condition — des requetes qui arrivent plus vite
# que le calcul — et mesure si le serveur revient.
#
# Usage : lancer le dashboard, puis
#   bash scripts/loadtest-dashboard.sh [url] [duree_en_s]
#
# Attendu apres correctif : reponses en quelques millisecondes.
# Symptome du bug : reponses a plus de 20 s, y compris apres l'arret de la charge.

set -u
URL=${1:-http://localhost:4998}
DURATION=${2:-60}
WORKERS=6

echo "== a froid =="
curl -s -o /dev/null -w "  worktrees %{time_total}s\n" --max-time 60 "$URL/api/worktrees"
curl -s -o /dev/null -w "  files     %{time_total}s\n" --max-time 60 "$URL/api/files"

echo "== $DURATION s de charge, $WORKERS boucles concurrentes sans attente =="
END=$((SECONDS + DURATION))
for _ in $(seq "$WORKERS"); do
  (
    while [ $SECONDS -lt $END ]; do
      curl -s -o /dev/null --max-time 20 "$URL/api/worktrees"
      curl -s -o /dev/null --max-time 20 "$URL/api/tasks"
      curl -s -o /dev/null --max-time 20 "$URL/api/files"
    done
  ) &
done
wait

echo "== apres la charge (c'est ici que le bug se voyait) =="
uptime | sed 's/^/  charge machine: /'
for _ in 1 2 3; do
  curl -s -o /dev/null -w "  worktrees %{http_code} %{time_total}s\n" --max-time 30 "$URL/api/worktrees"
done
curl -s -o /dev/null -w "  files     %{http_code} %{time_total}s\n" --max-time 30 "$URL/api/files"
