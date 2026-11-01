#!/bin/bash
# #995653 · Depo kancalarını bağlar: core.hooksPath = .githooks (göreli — her worktree kendi checkout'undaki kancayı koşar).
# Neden: 1 Kas 2026'ya kadar hooksPath genel bir dizini gösteriyordu; depodaki .githooks/pre-push (tip kapısı) hiç çalışmıyordu
# ve ezme kapısı yalnız elle çağrılınca koruyordu. Genel dizindeki Okan kaydı kaybolmaz: .githooks/pre-push onu sonda çağırır.
# Tekrar koşmak zararsız (idempotent). Geri alma: git config core.hooksPath "$HOME/asistan-veri/mehmet/githooks-genel"
set -eu
cd "$(dirname "$0")/.."
chmod +x .githooks/pre-push
git config core.hooksPath .githooks
echo "core.hooksPath = $(git config core.hooksPath)"
