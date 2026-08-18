/**
 * Via Mood TENANT'ına (kargo.viamood.com.tr) bağlanan KargoLab istemcisi.
 *
 * ⚠️ Bu, `internal.ts`'teki bağlantıdan AYRIDIR ve karıştırılmamalıdır:
 *
 *   internal.ts  → ana tenant (kargolab.com), üye 7000070 "VİA MOOD"
 *                  Via Mood'un KargoLab'den hizmet aldığı MÜŞTERİ hesabı.
 *                  Trendyol aynası, kendi kargoları ve carisi burada.
 *
 *   tenant.ts    → Via Mood'un KENDİ BAYİ TENANT'I (kargo.viamood.com.tr,
 *                  system_number 71940835). Tedarikçiler burada ayrı birer
 *                  üye olarak açılır.
 *
 * Aynı KargoLab kurulumunda iki farklı katman; Host başlığı hangi tenant'ta
 * çalışıldığını belirler. Yanlış başlıkla üye açmak tedarikçiyi YANLIŞ tenant'a
 * kaydeder, bu yüzden host burada sabit tutulur ve env'den okunur.
 */
import { env } from '../env';
import type { RecentShipment } from './shipments';
import type { StatementSummary } from './statement';

export class TenantNotConfiguredError extends Error {
  constructor() {
    super(
      'Via Mood tenant bağlantısı yapılandırılmamış. ' +
        'KARGOLAB_TENANT_HOST, KARGOLAB_TENANT_ADMIN_EMAIL ve KARGOLAB_TENANT_ADMIN_PASSWORD gerekli.',
    );
    this.name = 'TenantNotConfiguredError';
  }
}

export class TenantApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `KargoLab tenant API error: ${status}`);
    this.name = 'TenantApiError';
  }
}

interface CachedAdminToken {
  token: string;
  expiresAt: number;
}

let cached: CachedAdminToken | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000;

function config() {
  const host = env.KARGOLAB_TENANT_HOST;
  const email = env.KARGOLAB_TENANT_ADMIN_EMAIL;
  const password = env.KARGOLAB_TENANT_ADMIN_PASSWORD;
  if (!host || !email || !password) throw new TenantNotConfiguredError();
  return { host, email, password, base: `https://${host}/api/v1` };
}

/** Tenant'ın admin oturumu — üye açma gibi işlemler admin API'sinden yapılır. */
async function adminToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const { base, host, email, password } = config();
  const res = await fetch(`${base}/admin/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Host: host },
    body: JSON.stringify({ email, password, logged: 1 }),
  });

  const body = (await res.json().catch(() => null)) as
    | { status?: number; message?: string; data?: { token?: string } }
    | null;

  // KargoLab HTTP 200 döner; gerçek durum gövdedeki `status` alanındadır.
  if (!body || body.status !== 200 || !body.data?.token) {
    throw new TenantApiError(body?.status ?? res.status, body, body?.message ?? 'Tenant admin girişi başarısız');
  }

  cached = { token: body.data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return cached.token;
}

async function adminFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { base, host } = config();
  const token = await adminToken();

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Host: host,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  return (await res.json()) as T;
}

/* ------------------------------------------------------- tedarikçi → üye */

export interface TenantMemberInput {
  /** Ticari ad — KargoLab `members.member_name` varchar(60), uzunsa kısaltılır */
  companyName: string;
  email: string;
  phone?: string;
  taxId?: string;
  taxOffice?: string;
  city?: string;
  district?: string;
  addressLine1?: string;
}

export interface TenantMemberCreated {
  memberId: number;
  userId?: number;
}

/**
 * ⚠️ `members.member_name` varchar(60) ve prod STRICT_TRANS_TABLES modunda.
 * Uzun yasal ünvan gönderilirse uç HTTP 200 döner ama gövdede
 * "1406 Data too long" hatası verir. Bu yüzden ad burada kısaltılır.
 */
export function shortenCompanyName(name: string): string {
  let n = name.trim().replace(/\s+/g, ' ');
  if (n.length <= 60) return n;

  const repl: Array<[RegExp, string]> = [
    [/L[İI]M[İI]TED\s+Ş[İI]RKET[İI]/gi, 'LTD. ŞTİ.'],
    [/ANON[İI]M\s+Ş[İI]RKET[İI]/gi, 'A.Ş.'],
    [/T[İI]CARET\s+VE\s+SANAY[İI]/gi, 'TİC. VE SAN.'],
    [/SANAY[İI]\s+VE\s+T[İI]CARET/gi, 'SAN. VE TİC.'],
    [/T[İI]CARET/gi, 'TİC.'],
    [/SANAY[İI]/gi, 'SAN.'],
  ];
  for (const [re, to] of repl) {
    if (n.length <= 60) break;
    n = n.replace(re, to).replace(/\s+/g, ' ').trim();
  }
  return n.length <= 60 ? n : n.slice(0, 60).trim();
}

interface MemberAddEnvelope {
  status: number;
  message?: string;
  data?: { member_id?: number; id?: number; user_id?: number };
}

/**
 * Tedarikçiyi Via Mood tenant'ında üye olarak açar.
 *
 * Kurumsal üye (`member_type: 2`) olarak açılır; KargoLab kurumsal dalda
 * `member_name = company_name` yazdığı için ad kısaltması burada uygulanır.
 */
export async function createTenantMember(input: TenantMemberInput): Promise<TenantMemberCreated> {
  const companyName = shortenCompanyName(input.companyName);

  const res = await adminFetch<MemberAddEnvelope>('/admin/member-add', {
    method: 'POST',
    body: JSON.stringify({
      member_type: 2, // kurumsal
      company_name: companyName,
      email: input.email,
      phone: input.phone ?? '',
      tax_number: input.taxId ?? '',
      tax_office: input.taxOffice ?? '',
      city: input.district ?? '', // KargoLab: city = İlçe
      state: input.city ?? '', //     KargoLab: state = İl
      address1: input.addressLine1 ?? '',
      country: 'TR',
    }),
  });

  if (res.status !== 200) {
    throw new TenantApiError(res.status, res, res.message ?? 'Tedarikçi üyesi açılamadı');
  }

  const memberId = Number(res.data?.member_id ?? res.data?.id ?? 0);
  if (!memberId) {
    throw new TenantApiError(500, res, 'Üye açıldı ama üye numarası dönmedi');
  }

  return { memberId, userId: res.data?.user_id };
}

/** Tenant bağlantısı yapılandırılmış mı — UI'da bölümü gizlemek için. */
export function isTenantConfigured(): boolean {
  return Boolean(
    env.KARGOLAB_TENANT_HOST &&
      env.KARGOLAB_TENANT_ADMIN_EMAIL &&
      env.KARGOLAB_TENANT_ADMIN_PASSWORD,
  );
}

/* ------------------------------------------- tedarikçi adına okuma (impersonation) */

/**
 * Tedarikçinin KENDİ verisi için üye token'ı.
 *
 * Tenant admin oturumu `admin/member-login-as` ile tedarikçi üyesi adına bir üye
 * token'ı açar; sonrasında normal ÜYE uçları (statement-summary, shipments,
 * custody-summary) o token'la çağrılır. Böylece kapsam KargoLab tarafında
 * uygulanır — panel "hangi üyenin verisi" sorusunu kendisi filtrelemeye çalışmaz.
 *
 * ⚠️ `member-login-as` yetkisi KargoLab'de DEFAULT-DENY ve audit'lidir; eski
 *    statik-token "herhangi bir üye olarak giriş" arka kapısı kaldırılmıştır.
 */
const memberTokens = new Map<number, CachedAdminToken>();

async function memberToken(memberId: number): Promise<string> {
  const hit = memberTokens.get(memberId);
  if (hit && hit.expiresAt > Date.now()) return hit.token;

  const res = await adminFetch<{ status: number; message?: string; data?: { token?: string } }>(
    '/admin/member-login-as',
    { method: 'POST', body: JSON.stringify({ member_id: memberId }) },
  );

  if (res.status !== 200 || !res.data?.token) {
    throw new TenantApiError(res.status ?? 500, res, res.message ?? 'Üye oturumu açılamadı');
  }

  memberTokens.set(memberId, { token: res.data.token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return res.data.token;
}

async function memberFetch<T>(memberId: number, path: string, body: unknown): Promise<T> {
  const { base, host } = config();
  const token = await memberToken(memberId);

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Host: host,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  return (await res.json()) as T;
}

/** Tedarikçinin cari özeti — alan sözleşmesi `statement.ts` ile aynı. */
export async function fetchMemberStatementSummary(memberId: number): Promise<StatementSummary> {
  const res = await memberFetch<{ status: number; message?: string; data?: StatementSummary }>(
    memberId,
    '/statement-summary',
    { recent_limit: 5 },
  );

  // KargoLab HTTP 200 döner; gerçek durum gövdedeki `status` alanındadır.
  if (res.status !== 200 || !res.data) {
    throw new TenantApiError(res.status ?? 500, res, res.message ?? 'Cari özeti alınamadı');
  }
  return res.data;
}

/** Tedarikçinin son gönderileri. */
export async function fetchMemberShipments(memberId: number, limit = 10): Promise<RecentShipment[]> {
  const res = await memberFetch<{ status: number; message?: string; data?: Array<Record<string, unknown>> }>(
    memberId,
    '/shipments',
    { pagination: { limit, page: 1 }, filter: {} },
  );

  if (res.status !== 200 || !Array.isArray(res.data)) {
    throw new TenantApiError(res.status ?? 500, res, res.message ?? 'Kargo listesi alınamadı');
  }

  const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

  return res.data.map((r) => ({
    id: Number(r.id ?? 0),
    refNumber: s(r.ref_number) || s(r.id),
    trackingNumber: s(r.tracking_number),
    createdAt: s(r.created_at).slice(0, 10),
    statusLabel: s(r.status_text) || s(r.status),
    receiver: s(r.receiver_contact_name) || s(r.receiver_company_name),
    city: [s(r.receiver_state), s(r.receiver_city)].filter(Boolean).join(' / '),
    externalSource: s(r.external_source),
    externalOrderNo: s(r.external_order_no),
  }));
}
