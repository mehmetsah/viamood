/**
 * `node --import ./scripts/cli-alias.mjs …` ile yüklenir; çözücüyü kaydeder.
 * Ayrıntılı gerekçe: scripts/cli-alias-hook.mjs başlığı (#991465).
 */
import { register } from 'node:module';
register(new URL('./cli-alias-hook.mjs', import.meta.url));
