#!/bin/bash
# Package the expense-tracker source into a downloadable zip.
set -euo pipefail

ROOT=/home/z/my-project
STAGE=/tmp/expense-tracker-package
NAME=expense-tracker
OUT=$ROOT/download/$NAME.zip

rm -rf "$STAGE"
mkdir -p "$STAGE/$NAME"
cd "$ROOT"

# --- copy source ---
cp -r src prisma db public scripts "$STAGE/$NAME/"
mkdir -p "$STAGE/$NAME/db"

# --- root config files ---
for f in package.json bun.lock next.config.ts tsconfig.json tailwind.config.ts \
         postcss.config.mjs eslint.config.mjs components.json .gitignore README.md; do
  cp "$f" "$STAGE/$NAME/"
done

# --- portable .env (relative path works on any machine) ---
cat > "$STAGE/$NAME/.env" <<'EOF'
DATABASE_URL=file:../db/custom.db
EOF

# --- clean any build/runtime junk that slipped into copied dirs ---
rm -rf "$STAGE/$NAME/src/**/*.map" 2>/dev/null || true
find "$STAGE/$NAME" -name "*.tsbuildinfo" -delete 2>/dev/null || true

# --- verify no stray dirs ---
echo "--- staging tree (top level) ---"
ls -la "$STAGE/$NAME"

# --- zip ---
mkdir -p "$ROOT/download"
rm -f "$OUT"
cd "$STAGE" && zip -rq "$OUT" "$NAME"

echo "--- result ---"
ls -lh "$OUT"
echo "--- file count ---"
find "$STAGE/$NAME" -type f | wc -l
