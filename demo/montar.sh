#!/usr/bin/env sh
# Monta o site da demonstração (GitHub Pages) a partir das telas do sistema.
# Uso: sh demo/montar.sh [pasta_de_saida]   (padrão: _site)
set -eu

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
SAIDA=${1:-"$RAIZ/_site"}
STATIC="$RAIZ/backend/src/main/resources/static"

mkdir -p "$SAIDA/js/demo"
cp -R "$STATIC/." "$SAIDA/"
cp "$RAIZ/demo/api-simulada.js" "$RAIZ/demo/aviso.js" "$RAIZ/demo/demo.css" "$SAIDA/js/demo/"
cp "$RAIZ/backend/src/main/resources/cronograma/cronograma-2026.json" "$SAIDA/js/demo/"

# Liga o modo demonstração antes de o app carregar e acrescenta a faixa de aviso.
sed -i \
  -e 's#</head>#  <script>window.GEPAG_DEMO = true;</script>\n  <link rel="stylesheet" href="js/demo/demo.css">\n</head>#' \
  -e 's#</body>#  <script type="module" src="js/demo/aviso.js"></script>\n</body>#' \
  -e 's#<title>Monitoramento GEPAG</title>#<title>Monitoramento GEPAG (demonstração)</title>#' \
  "$SAIDA/index.html"

grep -q "GEPAG_DEMO" "$SAIDA/index.html" || { echo "index.html não foi preparado para a demonstração" >&2; exit 1; }
echo "Demonstração montada em $SAIDA"
