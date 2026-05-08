#!/bin/bash
# Authenticated HTTP smoke — NextAuth credentials login + protected routes.
# Şartlar: dev server çalışıyor + admin@viamood.local / Admin1234 seed edilmiş.
# Run: ./tests/http-auth-flow.sh

set -e
BASE="${BASE:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

PASS=0
FAIL=0

check_code() {
  local name="$1"
  local expected="$2"
  local url="$3"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$url")
  if [ "$actual" = "$expected" ]; then
    echo "✓ $name → $actual"
    PASS=$((PASS + 1))
  else
    echo "✗ $name → expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "🔐 NextAuth login flow testi başlıyor..."
echo ""

# 1. CSRF token al (NextAuth zorunlu)
echo "Step 1: CSRF token alınıyor..."
CSRF_RESPONSE=$(curl -s -c "$COOKIE_JAR" "$BASE/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -oE '"csrfToken":"[^"]+' | cut -d'"' -f4)
if [ -z "$CSRF_TOKEN" ]; then
  echo "✗ CSRF token alınamadı"
  exit 1
fi
echo "✓ CSRF token: ${CSRF_TOKEN:0:16}..."
echo ""

# 2. Credentials ile sign-in
echo "Step 2: Admin credentials ile sign-in..."
SIGNIN_RESPONSE=$(curl -s -i -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "$BASE/api/auth/callback/credentials" \
  -d "csrfToken=$CSRF_TOKEN" \
  -d "email=admin@viamood.local" \
  -d "password=Admin1234" \
  -d "callbackUrl=/admin" \
  -d "json=true" 2>&1)

# Session cookie var mı kontrol et
if grep -q "authjs.session-token\|next-auth.session-token" "$COOKIE_JAR"; then
  echo "✓ Session cookie set edildi"
else
  echo "✗ Session cookie YOK — login başarısız olabilir"
  echo "$SIGNIN_RESPONSE" | head -20
fi
echo ""

# 3. /api/auth/session ile session içeriğini doğrula
echo "Step 3: Session içeriği..."
SESSION=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/session")
echo "$SESSION" | head -c 300
echo ""

if echo "$SESSION" | grep -q "admin@viamood.local"; then
  echo "✓ Session admin@viamood.local içeriyor"
  PASS=$((PASS + 1))
else
  echo "✗ Session admin email içermiyor"
  FAIL=$((FAIL + 1))
fi
echo ""

# 4. Authed user ile protected routes — hepsi 200 olmalı
echo "Step 4: Admin olarak protected routes..."
check_code "Admin dashboard" 200 "$BASE/admin"
check_code "Admin vendors" 200 "$BASE/admin/vendors"
check_code "Admin orders" 200 "$BASE/admin/orders"
check_code "Admin orders/new" 200 "$BASE/admin/orders/new"
check_code "Admin payouts" 200 "$BASE/admin/payouts"
check_code "Admin payouts/new" 200 "$BASE/admin/payouts/new"
check_code "Admin routing rules" 200 "$BASE/admin/routing-rules"
check_code "Admin routing rules/new" 200 "$BASE/admin/routing-rules/new"

# Admin → /dashboard'a gidince vendor membership olmadığından redirect alır (super_admin kullanıcı, vendor değil)
# Ama yine de 200 ya da 307 olabilir — context'e göre
echo ""
echo "Step 5: Vendor route'lar (super_admin için)..."
check_code "Vendor dashboard (super_admin → onboarding)" 307 "$BASE/dashboard"
check_code "Vendor products (super_admin → onboarding)" 307 "$BASE/products"

echo ""
echo "Sonuç: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
