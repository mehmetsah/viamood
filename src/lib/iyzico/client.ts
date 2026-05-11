/**
 * Iyzico Pazaryeri (Marketplace) — submerchant + approve/disapprove ops.
 *
 * Resmi `iyzipay` SDK kullanılıyor (PKI imzalama bizim yerimize yapıyor).
 * Sandbox endpoint env içinden geliyor.
 */
import Iyzipay from 'iyzipay';
import { env } from '../env';

interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  uri: string;
}

let cachedClient: Iyzipay | null = null;

function getClient(): Iyzipay {
  if (cachedClient) return cachedClient;
  if (!env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY) {
    throw new Error('Iyzico credentials env\'de set edilmemiş');
  }
  const config: IyzicoConfig = {
    apiKey: env.IYZICO_API_KEY,
    secretKey: env.IYZICO_SECRET_KEY,
    uri: env.IYZICO_BASE_URL,
  };
  cachedClient = new Iyzipay(config);
  return cachedClient;
}

export class IyzicoError extends Error {
  constructor(
    public errorCode: string | undefined,
    public errorMessage: string | undefined,
    public errorGroup: string | undefined,
    public raw: unknown,
  ) {
    super(errorMessage ?? 'Iyzico API error');
    this.name = 'IyzicoError';
  }
}

interface IyzicoResp {
  status: 'success' | 'failure' | string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  conversationId?: string;
  systemTime?: number;
  [key: string]: unknown;
}

type IyzicoCallback<T> = (err: unknown, result: T) => void;

function callbackToPromise<T extends IyzicoResp>(
  fn: (cb: IyzicoCallback<T>) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (!result || result.status !== 'success') {
        reject(
          new IyzicoError(
            result?.errorCode,
            result?.errorMessage,
            result?.errorGroup,
            result,
          ),
        );
        return;
      }
      resolve(result);
    });
  });
}

// ============================================================================
// Submerchant
// ============================================================================

export interface CreateSubmerchantInput {
  vendorId: string;
  legalName: string;
  taxId: string;
  iban: string;
  contactName: string;
  contactSurname?: string;
  email: string;
  gsmNumber?: string;
  city?: string;
  country?: string;
  addressLine?: string;
  zipCode?: string;
  identityNumber?: string;
  taxOffice?: string;
  subMerchantType: 'PRIVATE_COMPANY' | 'LIMITED_OR_JOINT_STOCK_COMPANY' | 'PERSONAL';
}

interface SubmerchantCreateResp extends IyzicoResp {
  subMerchantKey?: string;
}

export async function createSubmerchant(
  input: CreateSubmerchantInput,
): Promise<{ subMerchantKey: string }> {
  const client = getClient();

  const request: Record<string, unknown> = {
    locale: 'tr',
    conversationId: `submerchant-${input.vendorId}`,
    subMerchantExternalId: input.vendorId,
    subMerchantType: input.subMerchantType,
    address: input.addressLine ?? 'Bilinmiyor',
    contactName: input.contactName,
    email: input.email,
    gsmNumber: input.gsmNumber ?? '+905555555555',
    name: input.legalName,
    iban: input.iban,
    currency: 'TRY',
  };

  if (input.subMerchantType === 'PERSONAL') {
    request.contactSurname = input.contactSurname ?? '-';
    request.identityNumber = input.identityNumber ?? '11111111111';
  } else {
    request.legalCompanyTitle = input.legalName;
    request.taxOffice = input.taxOffice ?? 'Bilinmiyor';
    if (input.subMerchantType === 'LIMITED_OR_JOINT_STOCK_COMPANY') {
      request.taxNumber = input.taxId;
    } else {
      request.identityNumber = input.identityNumber ?? '11111111111';
    }
  }

  const res = await callbackToPromise<SubmerchantCreateResp>((cb) =>
    client.subMerchant.create(request, cb as IyzicoCallback<Record<string, unknown> & { status?: string }>),
  );

  if (!res.subMerchantKey) {
    throw new IyzicoError(
      'SUBMERCHANT_KEY_MISSING',
      'subMerchantKey response\'da yok',
      undefined,
      res,
    );
  }
  return { subMerchantKey: res.subMerchantKey };
}

export async function updateSubmerchant(
  subMerchantKey: string,
  input: Partial<CreateSubmerchantInput>,
): Promise<void> {
  const client = getClient();
  const request: Record<string, unknown> = {
    locale: 'tr',
    conversationId: `submerchant-update-${subMerchantKey}`,
    subMerchantKey,
    address: input.addressLine,
    iban: input.iban,
    taxOffice: input.taxOffice,
    taxNumber: input.taxId,
    legalCompanyTitle: input.legalName,
    name: input.legalName,
    email: input.email,
    contactName: input.contactName,
    contactSurname: input.contactSurname,
    gsmNumber: input.gsmNumber,
    identityNumber: input.identityNumber,
    currency: 'TRY',
  };
  await callbackToPromise<IyzicoResp>((cb) => {
    const update = client.subMerchant.update;
    if (!update) throw new Error('iyzipay subMerchant.update yok');
    update(request, cb as IyzicoCallback<Record<string, unknown> & { status?: string }>);
  });
}

// ============================================================================
// Marketplace approve/disapprove (item-level)
// ============================================================================

export async function approveMarketplaceTransaction(
  paymentTransactionId: string,
): Promise<void> {
  const client = getClient();
  const request = {
    locale: 'tr',
    conversationId: `approve-${paymentTransactionId}`,
    paymentTransactionId,
  };
  await callbackToPromise<IyzicoResp>((cb) =>
    client.approval.create(request, cb as IyzicoCallback<Record<string, unknown> & { status?: string }>),
  );
}

export async function disapproveMarketplaceTransaction(
  paymentTransactionId: string,
): Promise<void> {
  const client = getClient();
  const request = {
    locale: 'tr',
    conversationId: `disapprove-${paymentTransactionId}`,
    paymentTransactionId,
  };
  await callbackToPromise<IyzicoResp>((cb) =>
    client.disapproval.create(request, cb as IyzicoCallback<Record<string, unknown> & { status?: string }>),
  );
}
