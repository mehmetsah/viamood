-- 0022_welcome_signups — "Hoş geldin" pop-up form kayıtları (Defter #974, Yunus 11 Eyl 2026).
--
-- İdempotent (deploy hattı numaralı SQL'leri HER deploy'da yeniden koşar).
--
-- KVKK NOTU: Bu tablo açık rızanın İSPATIDIR. Bu yüzden yalnız "onay verdi mi"
-- değil, onayın VERİLDİĞİ ANDAKİ metin (consent_text), zaman, kaynak sayfa, UTM
-- ve istemci bilgisi de saklanır. Onay metni ileride değişirse eski kayıtlar
-- kendi metniyle kalır — sonradan yazılan metinle ispat yapılamaz.

CREATE TABLE IF NOT EXISTS "welcome_signups" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"           text NOT NULL,
  "email"          text NOT NULL,
  "phone"          text NOT NULL,
  "phone_e164"     text,
  "consent"        boolean NOT NULL DEFAULT false,
  "consent_text"   text NOT NULL,
  "consent_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "source_url"     text,
  "referrer"       text,
  "utm_source"     text,
  "utm_medium"     text,
  "utm_campaign"   text,
  "utm_term"       text,
  "utm_content"    text,
  "request_ip"     text,
  "user_agent"     text,
  -- Mail durumu: pending → sent | failed | skipped (kanal yapılandırılmamış)
  "email_status"   text NOT NULL DEFAULT 'pending',
  "email_sent_at"  timestamp with time zone,
  "email_error"    text,
  -- Shopify müşteri kaydı eşlemesi (best-effort; başarısız olursa NULL kalır)
  "shopify_customer_id" bigint,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL
);

-- Aynı e-posta tekrar formu doldurursa yeni satır yazılır (onay geçmişi korunur),
-- ama sorgular için indeks gerekir.
CREATE INDEX IF NOT EXISTS "welcome_signups_email_idx"      ON "welcome_signups" ("email");
CREATE INDEX IF NOT EXISTS "welcome_signups_created_idx"    ON "welcome_signups" ("created_at");
CREATE INDEX IF NOT EXISTS "welcome_signups_ip_created_idx" ON "welcome_signups" ("request_ip", "created_at");
CREATE INDEX IF NOT EXISTS "welcome_signups_mail_idx"       ON "welcome_signups" ("email_status")
  WHERE "email_status" IN ('pending', 'failed');
