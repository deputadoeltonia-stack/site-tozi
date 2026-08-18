#!/usr/bin/env bash
# Monta o ZIP do site para subir na HostGator (cPanel > Gerenciador de
# Arquivos > Extract). Publicar e manual, entao o que da para automatizar e
# EMPACOTAR CERTO — que e onde o deploy manual costuma falhar.
#
#   bash scripts/empacotar.sh
#
# Sai em ../site-tozi-deploy.zip, fora do repositorio, para nao virar
# arquivo versionado sem querer.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f index.html ] || { echo "ERRO: rode de dentro do projeto" >&2; exit 1; }

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'sem-git')"
SUJO="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
TMP="$(mktemp -d)"
ZIP="$(cd .. && pwd)/site-tozi-deploy.zip"
trap 'rm -rf "$TMP"' EXIT

if [ "$SUJO" != "0" ]; then
  echo "AVISO: ha $SUJO arquivo(s) nao commitado(s). O pacote leva o que esta"
  echo "       no disco, nao o que esta no GitHub. Confira com: git status"
  echo
fi

# --exclude-from=.vercelignore: MESMA lista de "o que e bastidor" que o
# deploy antigo usava. Uma lista so, para nao existirem duas definicoes
# divergindo do que e site.
rsync -a --exclude-from=.vercelignore \
  --exclude='.git' --exclude='.vercel' --exclude='vercel.json' \
  --exclude='.vercelignore' --exclude='.gitignore' --exclude='.DS_Store' \
  ./ "$TMP/"

# ---- conferencia: o que NAO pode faltar e o que NAO pode vazar ----------
falhou=0
conferir() { # nome, condicao-ja-avaliada
  if [ "$2" = "1" ]; then printf '  ok    %s\n' "$1"
  else printf '  FALTA %s\n' "$1"; falhou=1; fi
}

echo "Conferindo o pacote (commit $SHA):"
conferir ".htaccess (arquivo oculto)"    "$([ -f "$TMP/.htaccess" ] && echo 1 || echo 0)"
conferir "privacidade/index.html"        "$([ -f "$TMP/privacidade/index.html" ] && echo 1 || echo 0)"
conferir "robots.txt"                    "$([ -f "$TMP/robots.txt" ] && echo 1 || echo 0)"
conferir "sitemap.xml"                   "$([ -f "$TMP/sitemap.xml" ] && echo 1 || echo 0)"
conferir "colinha/candidatos-sp.json"    "$([ -f "$TMP/colinha/candidatos-sp.json" ] && echo 1 || echo 0)"
conferir "legendas .vtt dos depoimentos" "$([ "$(ls "$TMP"/public/assets/videos/*.vtt 2>/dev/null | wc -l)" -ge 2 ] && echo 1 || echo 0)"

# Link de preview em propaganda eleitoral: o eleitor tem que cair no dominio
# oficial da outra candidatura, nao num endereco de rascunho.
conferir "nenhum link para dominio de preview" \
  "$([ "$(grep -rlE 'href="https://[a-z0-9-]+\.vercel\.app' "$TMP" --include='*.html' 2>/dev/null | wc -l)" -eq 0 ] && echo 1 || echo 0)"

# O texto do consentimento tem que apontar para a politica, e nao afirmar
# que os dados nao sao compartilhados enquanto a base for comum.
conferir "consentimento aponta para a politica" \
  "$(grep -q 'Li e aceito a' "$TMP/index.html" && echo 1 || echo 0)"

for proibido in .git scripts .env .env.local; do
  if [ -e "$TMP/$proibido" ]; then
    printf '  VAZOU %s (bastidor no pacote)\n' "$proibido"; falhou=1
  fi
done

[ "$falhou" = "0" ] || { echo; echo "Pacote NAO gerado: resolva os itens acima." >&2; exit 1; }

rm -f "$ZIP"
( cd "$TMP" && zip -rqX "$ZIP" . )

# zip -r a partir de "." leva os ocultos, mas confirmar e barato e o
# .htaccess ausente e justamente a falha silenciosa deste deploy.
unzip -l "$ZIP" | grep -q '\.htaccess' \
  || { echo "ERRO: .htaccess ficou de fora do zip" >&2; exit 1; }

echo
echo "Pronto: $ZIP  ($(du -h "$ZIP" | cut -f1), commit $SHA)"
echo "No cPanel: envie, extraia, e ATIVE 'mostrar arquivos ocultos' para"
echo "conferir que o .htaccess chegou."
