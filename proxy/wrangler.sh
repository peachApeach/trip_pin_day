#!/usr/bin/env bash
# wrangler는 Node.js 22+를 요구하는데 이 머신 기본 node는 v21이다.
# 22 이상인 node를 찾아서 그걸로 wrangler를 실행한다.
set -euo pipefail
cd "$(dirname "$0")"

major() { "$1" -v 2>/dev/null | sed 's/^v//' | cut -d. -f1; }

NODE=""
for candidate in "$(command -v node || true)" /usr/local/bin/node /opt/homebrew/bin/node; do
  [ -x "$candidate" ] || continue
  v=$(major "$candidate")
  if [ -n "$v" ] && [ "$v" -ge 22 ]; then NODE="$candidate"; break; fi
done

# nvm에 설치된 버전도 훑어본다
if [ -z "$NODE" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  for candidate in "$HOME"/.nvm/versions/node/v*/bin/node; do
    [ -x "$candidate" ] || continue
    v=$(major "$candidate")
    if [ -n "$v" ] && [ "$v" -ge 22 ]; then NODE="$candidate"; break; fi
  done
fi

if [ -z "$NODE" ]; then
  echo "오류: Node.js 22 이상이 필요합니다 (wrangler 요구사항)." >&2
  echo "현재 기본 node: $(node -v 2>/dev/null || echo '없음')" >&2
  echo "설치: nvm install 22   또는   brew install node" >&2
  exit 1
fi

# wrangler가 하위 프로세스를 띄울 때도 같은 node를 쓰도록 PATH 앞에 둔다
export PATH="$(dirname "$NODE"):$PATH"
exec "$NODE" node_modules/wrangler/bin/wrangler.js "$@"
