#!/usr/bin/env bash
# Publica o site do Professor Tozi na HostGator, por FTPS.
#
#   FTP_USER='deploy@proftozi44447.com.br' FTP_PASS='...' bash scripts/deploy-hostgator.sh
#   FTP_USER=... FTP_PASS=... bash scripts/deploy-hostgator.sh --dry
#
# POR QUE AQUI E NAO NO VPS (medido em 31/08/2026): o A de
# proftozi44447.com.br passou a resolver 192.185.131.84, a hospedagem
# compartilhada. O VPS continua servindo colinhavirtual.dreltonai.com.br e
# central4412.proftozi44447.com.br, mas o site do Tozi sai da HostGator — e
# `root@187.127.17.18` responde "Permission denied (publickey)" desde a
# revogacao de 30/08, entao scripts/deploy-vps.sh nao roda mais.
#
# A HostGator desabilita shell na conta compartilhada: nao existe rsync nem
# unzip do outro lado. Sobra FTPS (TLS explicito na 21), que o lftp faz.
#
# CREDENCIAL: conta de FTP dedicada, criada no cPanel > Contas de FTP com o
# diretorio travado em public_html. Nunca a senha do cPanel. Passe por
# variavel de ambiente para nao virar argumento visivel no `ps`.
set -euo pipefail

HOST="br856.hostgator.com.br"   # 192.185.131.80; o certificado casa com este nome
DEST="."                        # a conta de FTP ja e chroot em public_html

cd "$(dirname "$0")/.."
[ -f index.html ] || { echo "ERRO: rode de dentro do projeto" >&2; exit 1; }
command -v lftp >/dev/null || { echo "ERRO: falta o lftp (brew install lftp)" >&2; exit 1; }
: "${FTP_USER:?defina FTP_USER}"
: "${FTP_PASS:?defina FTP_PASS}"

DRY=""
[ "${1:-}" = "--dry" ] && DRY="--dry-run"

# Mesma lista de "o que e bastidor" do .vercelignore, igual ao empacotar.sh:
# uma definicao so de o que e site, para as duas nao divergirem.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rsync -a --exclude-from=.vercelignore \
  --exclude='.git' --exclude='.vercel' --exclude='vercel.json' \
  --exclude='.vercelignore' --exclude='.gitignore' --exclude='.DS_Store' \
  ./ "$TMP/"

[ -f "$TMP/.htaccess" ] || { echo "ERRO: .htaccess ficou de fora" >&2; exit 1; }

# SEM --delete, de proposito. O servidor guarda arquivos que nao existem no
# repositorio e que quebram a colinha se sumirem: as fotos de candidato em
# colinha/fotos/ e as paginas colinha/c/<candidato>/. Conferido em 31/08/2026:
# eram 20 fotos + 6 paginas so no servidor. Quem limpa lixo antigo faz na mao,
# olhando arquivo por arquivo.
# Percent-encoding do usuario e da senha: a senha que o cPanel gera tem `;`,
# que o lftp le como separador de comando — sem encodar, o `open` morre com
# "Comando `0xNCk=...' desconhecido" e o mirror tenta subir desconectado.
# Conferido em 31/08/2026 com a senha real.
urlenc() {
  local s="$1" out="" i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}
U_ENC="$(urlenc "$FTP_USER")"
P_ENC="$(urlenc "$FTP_PASS")"

# FORA de $TMP: $TMP e a raiz do espelho, e um arquivo de credencial ali dentro
# sobe junto para o servidor publico. Visto no dry-run de 31/08/2026, que
# listou ".lftprc" entre os arquivos a transferir.
CMDS="$(mktemp)"
trap 'rm -rf "$TMP"; rm -f "$CMDS"' EXIT
umask 077
cat > "$CMDS" <<LFTPEOF
set ftp:ssl-auth TLS
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate yes
set net:timeout 30
set net:max-retries 3
set mirror:parallel-transfer-count 4
open ftp://${U_ENC}:${P_ENC}@${HOST}
mirror -R --only-newer --no-perms --verbose=1 ${DRY} "$TMP" ${DEST}
bye
LFTPEOF

# Redige pela FORMA da URL, nao pela senha: usar a senha como padrao de sed a
# trata como regex, e `*` ou `$` nela quebram o casamento — no teste de
# 31/08/2026 sobrou o ultimo caractere da senha no log.
lftp -f "$CMDS" 2>&1 | sed -E 's|ftp://[^@ ]*@|ftp://[credencial oculta]@|g'

[ -n "$DRY" ] && { echo "(dry-run: nada foi enviado)"; exit 0; }

# Conferencia pelo IP da hospedagem: o DNS pode estar em cache apontando para
# outro lugar, e ai um curl comum mediria o servidor errado.
echo
echo "Conferindo na HostGator (por IP, ignorando cache de DNS):"
for u in "" "privacidade/" "public/materiais/prof-tozi-44447.pdf" "colinha/candidatos-sp.json"; do
  printf '  %-44s ' "/$u"
  curl -s -m 25 -o /dev/null --resolve "proftozi44447.com.br:443:192.185.131.84" \
    -w '%{http_code}\n' "https://proftozi44447.com.br/$u"
done
