#!/bin/bash
# HTTP smoke test — dev server'a karşı tüm route'ların doğru status code döndüğünü doğrular.
# Run: ./tests/http-smoke.sh

set -e
BASE="${BASE:-http://localhost:3000}"
PASS=0
FAIL=0
RESULTS=""

check() {
  local name="$1"
  local expected="$2"
  local url="$3"
  local cookie="${4:-}"

  local args=("-s" "-o" "/dev/null" "-w" "%{http_code}" "$url")
  if [ -n "$cookie" ]; then
    args=("-b" "$cookie" "${args[@]}")
  fi

  local actual
  actual=$(curl "${args[@]}")

  if [ "$actual" = "$expected" ]; then
    RESULTS+="✓ $name → $actual\n"
    PASS=$((PASS + 1))
  else
    RESULTS+="✗ $name → expected $expected, got $actual\n"
    FAIL=$((FAIL + 1))
  fi
}

echo "🧪 HTTP smoke testleri başlıyor..."
echo "Base URL: $BASE"
echo ""

# Public routes — 200
check "Home" 200 "$BASE/"
check "Sign-up page" 200 "$BASE/auth/sign-up"
check "Sign-in page" 200 "$BASE/auth/sign-in"

# Static assets — 200
check "Favicon SVG" 200 "$BASE/favicon.svg"
check "Logo SVG" 200 "$BASE/via-mood-logo.svg"

# Health endpoint
check "Health check" 200 "$BASE/api/health"

# NextAuth providers endpoint
check "NextAuth providers" 200 "$BASE/api/auth/providers"
check "NextAuth session" 200 "$BASE/api/auth/session"

# Protected routes (no auth) → 307 redirect to /auth/sign-in
check "Dashboard (no auth)" 307 "$BASE/dashboard"
check "Products (no auth)" 307 "$BASE/products"
check "Inventory (no auth)" 307 "$BASE/inventory"
check "Orders (no auth)" 307 "$BASE/orders"
check "Payouts (no auth)" 307 "$BASE/payouts"
check "Onboarding (no auth)" 307 "$BASE/onboarding"

# Admin routes (no auth) → 307 redirect
check "Admin dashboard (no auth)" 307 "$BASE/admin"
check "Admin vendors (no auth)" 307 "$BASE/admin/vendors"
check "Admin orders (no auth)" 307 "$BASE/admin/orders"
check "Admin payouts (no auth)" 307 "$BASE/admin/payouts"
check "Admin routing rules (no auth)" 307 "$BASE/admin/routing-rules"

# Non-existent route — 307 (middleware unknown path → sign-in redirect, info-leak prevention)
check "Non-existent (auth-gated)" 307 "$BASE/this-page-does-not-exist"

echo -e "$RESULTS"
echo ""
echo "Sonuç: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
