#!/usr/bin/env bash
# Publica o site do Professor Tozi na VPS nova (a "105"), onde o Caddy serve
# /var/www/proftozi44447. O site saiu da HostGator para lá em 05/09/2026.
#
#   SITE_VPS_HOST=<endereço> SITE_VPS_KEY=<chave> bash scripts/deploy-vps105.sh            # só mostra
#   SITE_VPS_HOST=<endereço> SITE_VPS_KEY=<chave> bash scripts/deploy-vps105.sh --aplicar  # envia
#
# Endereço e chave ficam nas notas de operação e não têm valor padrão aqui: quem roda escolhe
# o destino de propósito. Sem --aplicar é sempre --dry-run.
#
# SEM --delete, de propósito. A VPS tem arquivos que o repositório não tem e que estão no ar:
# as páginas colinha/c/<candidato>/ e fotos. Espelhar apagaria páginas vivas. Limpeza de lixo
# antigo se faz à mão, olhando arquivo por arquivo.
#
# --checksum: os arquivos do servidor vieram da migração com outra data de modificação;
# comparando por data, o dry-run listaria o site inteiro como "mudou".
#
# Substitui, desde 13/09/2026, o deploy-vps.sh (VPS antiga, com --delete) e o
# deploy-hostgator.sh (HostGator, que o DNS não usa mais).
set -euo pipefail

: "${SITE_VPS_HOST:?defina SITE_VPS_HOST (endereço da VPS, nas notas de operação)}"
: "${SITE_VPS_KEY:?defina SITE_VPS_KEY (caminho da chave SSH)}"
DEST="/var/www/proftozi44447/"

case "${1:-}" in
  "")        DRY="--dry-run" ;;
  --aplicar) DRY="" ;;
  *) echo "uso: bash scripts/deploy-vps105.sh [--aplicar]" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."
[ -f index.html ] || { echo "ERRO: rode de dentro do projeto (index.html não achado)" >&2; exit 1; }
[ -z "$(git status --porcelain 2>/dev/null)" ] \
  || echo "AVISO: há mudança fora de commit — sobe o que está no disco, não o que está no GitHub."

# Caminho da chave sem espaço: $SSH é partido em palavras de propósito.
SSH="ssh -i $SITE_VPS_KEY -o BatchMode=yes -o ConnectTimeout=15"

# O que é bastidor está no .vercelignore — lista única, a mesma do empacotar.sh. Os --exclude
# são o que falta nela: docs internos, resource fork do macOS e a config da Vercel.
# $DRY sem aspas: vazio tem de sumir, não virar um argumento "".
rsync -rlz --checksum --itemize-changes $DRY \
  -e "$SSH" \
  --exclude-from=.vercelignore \
  --exclude='.git' --exclude='scripts/' --exclude='docs/' --exclude='*.md' \
  --exclude='._*' --exclude='.DS_Store' \
  --exclude='.vercel' --exclude='vercel.json' --exclude='.vercelignore' --exclude='.gitignore' \
  ./ "root@$SITE_VPS_HOST:$DEST"

if [ -n "$DRY" ]; then
  echo "(dry-run: nada foi enviado. Para valer: --aplicar)"
  exit 0
fi

# Prova: o index.html do servidor é o daqui, byte a byte.
local_sha="$(shasum -a 256 index.html | cut -d' ' -f1)"
remoto_sha="$($SSH "root@$SITE_VPS_HOST" "sha256sum ${DEST}index.html" | cut -d' ' -f1)"
if [ "$local_sha" = "$remoto_sha" ]; then
  echo "Conferido: index.html no servidor = local ($local_sha)"
else
  echo "ERRO: index.html no servidor ($remoto_sha) difere do local ($local_sha)" >&2
  exit 1
fi
