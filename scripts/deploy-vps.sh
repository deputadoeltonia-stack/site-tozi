#!/usr/bin/env bash
# Publica o site do Professor Tozi no VPS (Caddy serve os arquivos direto).
#   bash scripts/deploy-vps.sh          # envia
#   bash scripts/deploy-vps.sh --dry    # mostra o que mudaria, sem enviar
#
# ESTE SCRIPT NÃO PUBLICA MAIS NADA. Use scripts/deploy-hostgator.sh.
#
# Histórico, porque o aviso anterior confundiu: em 18/08/2026 anotou-se aqui que
# o domínio tinha saído do VPS. Entre 18/08 e 31/08 ele VOLTOU — no início de
# 31/08 o A resolvia 187.127.17.18 e o site no ar saía daqui mesmo, de
# /opt/site-tozi. Na mesma data o A foi para 192.185.131.84 (HostGator), que é
# de onde o site sai agora.
#
# Além disso, `root@187.127.17.18` responde "Permission denied (publickey)"
# desde a revogação de 30/08/2026: o rsync abaixo falha na autenticação antes
# de enviar qualquer coisa. A conta `junior` (ssh vps-leitura) só lê —
# /opt/site-tozi dá `group:leitura-total:r-x` por ACL.
#
# Guardado porque colinhavirtual.dreltonai.com.br e
# central4412.proftozi44447.com.br continuam servidos por este VPS, e o dia que
# o root voltar este é o caminho para eles.
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
