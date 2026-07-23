-- 0015_goknil_admin — Göknil için admin kullanıcısı (moderasyon paneli erişimi).
-- İdempotent: ON CONFLICT (email) DO NOTHING → tekrar deploy'da dokunmaz, şifre değişikliğini EZMEZ.
-- passwordHash bcrypt(cost=12). Düz şifre repoda/raporda YOK; Mehmet'e ayrı iletildi.
INSERT INTO "users" ("name", "email", "password_hash", "role")
VALUES ('Göknil', 'goknil@viamood.com.tr', '$2b$12$mLoR2bZkoCCdx1RQ96t13um2uw8eX8UAQ3yi7xsfP9mQcGFezxqMm', 'admin')
ON CONFLICT ("email") DO NOTHING;
