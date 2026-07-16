#!/bin/sh

node_bin=""

if command -v node >/dev/null 2>&1; then
  node_bin=$(command -v node)
fi

if [ -z "$node_bin" ]; then
  nvm_script=""
  if [ -n "$NVM_DIR" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    nvm_script=$NVM_DIR/nvm.sh
  elif [ -s "$HOME/.nvm/nvm.sh" ]; then
    NVM_DIR=$HOME/.nvm
    nvm_script=$NVM_DIR/nvm.sh
  fi
  if [ -n "$nvm_script" ]; then
    # nvm.sh is intentionally sourced only after ambient-PATH resolution fails.
    export NVM_DIR
    . "$nvm_script" >/dev/null 2>&1
    node_bin=$(nvm which current 2>/dev/null || true)
    if [ ! -x "$node_bin" ]; then
      node_bin=$(nvm which default 2>/dev/null || true)
    fi
    if [ ! -x "$node_bin" ]; then
      node_bin=""
    fi
  fi
fi

if [ -z "$node_bin" ]; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$candidate" ] && { [ -z "$node_bin" ] || [ "$candidate" -nt "$node_bin" ]; }; then
      node_bin=$candidate
    fi
  done
fi

if [ -z "$node_bin" ]; then
  system_paths=${VISIGNER_NODE_SYSTEM_PATHS:-"/opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node"}
  for candidate in $system_paths; do
    if [ -x "$candidate" ]; then
      node_bin=$candidate
      break
    fi
  done
fi

if [ -z "$node_bin" ]; then
  echo "Visigner hook: no node interpreter found — install Node or run /design-setup" >&2
  exit 127
fi

exec "$node_bin" "$@"
