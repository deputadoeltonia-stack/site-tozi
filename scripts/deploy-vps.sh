#!/usr/bin/env bash
# Publica o site do Professor Tozi no VPS (Caddy serve os arquivos direto).
#   bash scripts/deploy-vps.sh          # envia
#   bash scripts/deploy-vps.sh --dry    # mostra o que mudaria, sem enviar
#
# ATENÇÃO (conferido em 18/08/2026): proftozi44447.com.br NÃO aponta mais para
# este VPS. O A do domínio resolve 192.185.131.84 (HostGator) e é de lá que o
# site é servido; o VPS só devolve um 308 para https e sai de cena. Rodar este
# script hoje sobe arquivos que ninguém serve — e a conferência do fim imprime
# um HTTP 308 que passa por sinal de vida. Publicar de verdade = enviar para a
# HostGator. Guardado porque colinhavirtual.dreltonai.com.br continua no VPS.
#
# O que NÃO sobe está em .vercelignore — mesmo arquivo que a Vercel usa, pra
# não existirem duas listas de "o que é site e o que é bastidor" divergindo.
set -euo pipefail

HOST="root@187.127.17.18"
KEY="$HOME/.ssh/id_ed25519_hostinger_vps"
DEST="/opt/site-tozi"

cd "$(dirname "$0")/.."
[ -f index.html ] || { echo "ERRO: rode de dentro do projeto (index.html não achado)" >&2; exit 1; }

# array vazio + `set -u` no bash 3.2 do macOS = "unbound variable".
# Uma string só evita a expansão de array vazia; nenhum caminho tem espaço aqui.
DRY=""
[ "${1:-}" = "--dry" ] && DRY="--dry-run"

SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=15)
"${SSH[@]}" "$HOST" "mkdir -p $DEST"

# --delete: o remoto vira espelho do local. Sem isso, arquivo renomeado aqui
# continuaria servido lá pra sempre (e um vídeo velho pesa 20MB no disco).
# --progress (não --info=progress2): o macOS ainda embarca rsync 2.6.9, de 2006,
# e as flags novas fazem ele abortar com "unknown option".
rsync -az --delete --progress $DRY \
  -e "ssh -i $KEY -o BatchMode=yes -o ConnectTimeout=15" \
  --exclude-from=.vercelignore \
  --exclude='.vercel' --exclude='vercel.json' --exclude='.vercelignore' --exclude='.gitignore' \
  ./ "$HOST:$DEST/"

[ -n "$DRY" ] && { echo "(dry-run: nada foi enviado)"; exit 0; }

echo
echo "Enviado. Conferindo no servidor:"
"${SSH[@]}" "$HOST" "du -sh $DEST; ls $DEST | head; echo; curl -sS -o /dev/null -w 'local HTTP %{http_code}\n' -H 'Host: proftozi44447.com.br' http://127.0.0.1/ || true"
