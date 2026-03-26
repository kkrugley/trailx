#!/usr/bin/env bash
set -e

NODE_REQUIRED=22
PNPM_REQUIRED=10.24.0

# ==> Check Node.js
echo "==> Checking Node.js..."
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if [ "$NODE_MAJOR" -ge "$NODE_REQUIRED" ]; then
    echo "    Node.js $(node -v) — OK"
  else
    echo "    Node.js $(node -v) is too old (need v${NODE_REQUIRED}+). Installing via nvm..."
    if ! command -v nvm &>/dev/null; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      export NVM_DIR="$HOME/.nvm"
      # shellcheck disable=SC1091
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    nvm install "$NODE_REQUIRED"
    nvm use "$NODE_REQUIRED"
  fi
else
  echo "    Node.js not found. Installing via nvm..."
  if ! command -v nvm &>/dev/null; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
  nvm install "$NODE_REQUIRED"
  nvm use "$NODE_REQUIRED"
fi

# ==> Check pnpm
echo ""
echo "==> Checking pnpm..."
if command -v pnpm &>/dev/null; then
  echo "    pnpm $(pnpm -v) — OK"
else
  echo "    pnpm not found. Installing v${PNPM_REQUIRED} via corepack..."
  corepack enable
  corepack prepare pnpm@${PNPM_REQUIRED} --activate
fi

# ==> Build shared package first
echo ""
echo "==> Building shared package..."
pnpm --filter shared build

# ==> Install all dependencies
echo ""
echo "==> Installing dependencies..."
pnpm install

# ==> Create packages/app/.env.local
echo ""
echo "==> Creating packages/app/.env.local..."
if [ -f packages/app/.env.local ]; then
  echo "    Already exists, skipping."
else
  cat > packages/app/.env.local << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_BOT_WS_URL=ws://localhost:3001
EOF
  echo "    Created."
fi

# ==> Create packages/bot/.env
echo ""
echo "==> Checking packages/bot/.env..."
if [ -f packages/bot/.env ]; then
  echo "    Already exists, skipping."
else
  echo "    NOT FOUND. Creating template — fill in the real values before starting the bot."
  cat > packages/bot/.env << 'EOF'
BOT_TOKEN=your_bot_token_here
PORT=3001
WEBHOOK_DOMAIN=https://your-domain
GRAPHHOPPER_API_KEY=your_graphhopper_key_here
DATABASE_URL=postgresql://user:password@host
EOF
  echo "    Created packages/bot/.env — edit it before running the bot!"
fi

# ==> Generate Prisma client
echo ""
echo "==> Generating Prisma client..."
pnpm --filter @trailx/bot exec prisma generate

echo ""
echo "Done! Ports: app=3000, bot=3001"
echo ""
echo "To start (in separate terminals):"
echo "  Terminal 1: pnpm --filter bot dev"
echo "  Terminal 2: pnpm --filter app dev"
