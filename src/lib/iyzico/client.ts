/**
 * Iyzico Pazaryeri (Marketplace) entegrasyonu — stub.
 * Phase 5'te full implementasyon.
 *
 * Submerchant API ile her vendor için subaccount yaratırız:
 *   - createSubMerchant(vendor) → submerchantKey
 *   - paymentRequest with paymentItems[] subMerchantKey ile split olur
 *   - approve/disapprove submerchant kazançları
 *
 * Cari mode için:
 *   - Standart Iyzico checkout (split yok)
 *   - Periyodik manuel transfer veya Iyzico Transfer API
 */
import { env } from '../env';

interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

export function getIyzicoConfig(): IyzicoConfig {
  if (!env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY) {
    throw new Error('Iyzico credentials not configured');
  }
  return {
    apiKey: env.IYZICO_API_KEY,
    secretKey: env.IYZICO_SECRET_KEY,
    baseUrl: env.IYZICO_BASE_URL,
  };
}

export interface CreateSubmerchantInput {
  vendorId: string;          // bizim DB'deki vendor.id
  legalName: string;
  taxId: string;
  iban: string;
  contactName: string;
  contactSurname: string;
  email: string;
  gsmNumber?: string;
  city?: string;
  country?: string;
  addressLine?: string;
  zipCode?: string;
  identityNumber?: string;   // Şahıs şirketi için TCKN
  taxOffice?: string;
  subMerchantType: 'PRIVATE_COMPANY' | 'LIMITED_OR_JOINT_STOCK_COMPANY' | 'PERSONAL';
}

export async function createSubmerchant(_input: CreateSubmerchantInput): Promise<{ subMerchantKey: string }> {
  // TODO: Phase 5 — Iyzico SDK ile gerçek istek
  throw new Error('Not implemented yet — Phase 5');
}

export async function updateSubmerchant(_subMerchantKey: string, _input: Partial<CreateSubmerchantInput>): Promise<void> {
  throw new Error('Not implemented yet — Phase 5');
}
