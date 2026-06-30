/**
 * Iyzico Pazaryeri (Marketplace) — submerchant + approve/disapprove ops.
 *
 * Resmi `iyzipay` SDK kullanılıyor (PKI imzalama bizim yerimize yapıyor).
 * Sandbox endpoint env içinden geliyor.
 */
import Iyzipay from 'iyzipay';
import { env } from '../env';
import { getStoreSettings } from '../settings/store';

interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  uri: string;
}

let cachedClient: Iyzipay | null = null;
let cachedKey = '';

async function getClient(): Promise<Iyzipay> {
  const p = (await getStoreSettings()).payment;
  const apiKey = p.iyzico_api_key || env.IYZICO_API_KEY;
  const secretKey = p.iyzico_secret_key || env.IYZICO_SECRET_KEY;
  let uri = env.IYZICO_BASE_URL;
  if (p.iyzico_test_mode != null) uri = p.iyzico_test_mode === 1 ? 'https://sandbox-api.iyzipay.com' : 'https://api.iyzipay.com';
  if (!apiKey || !secretKey) {
    throw new Error('Iyzico credentials set edilmemis (admin panel veya env)');
  }
  const key = apiKey + '|' + uri;
  if (cachedClient && cachedKey === key) return cachedClient;
  const config: IyzicoConfig = { apiKey, secretKey, uri };
  cachedClient = new Iyzipay(config);
  cachedKey = key;
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
  const client = await getClient();

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
  const client = await getClient();
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
  const client = await getClient();
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
  const client = await getClient();
  const request = {
    locale: 'tr',
    conversationId: `disapprove-${paymentTransactionId}`,
    paymentTransactionId,
  };
  await callbackToPromise<IyzicoResp>((cb) =>
    client.disapproval.create(request, cb as IyzicoCallback<Record<string, unknown> & { status?: string }>),
  );
}

// ============================================================================
// CheckoutForm (hosted ödeme — kart bilgisi İyzico iframe'inde)
// ============================================================================

export interface CheckoutItemInput {
  id: string;
  name: string;
  category: string;
  price: string; // "100.00"
}

export interface CheckoutAddressInput {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

export interface CheckoutBuyerInput {
  id: string;
  name: string;
  surname: string;
  gsmNumber: string; // +905...
  email: string;
  identityNumber: string; // TC veya test "11111111111"
  registrationAddress: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface InitializeCheckoutInput {
  conversationId: string;
  price: string; // ürünler toplamı (kargo HARİÇ)
  paidPrice: string; // tahsil edilen toplam (kargo DAHİL)
  callbackUrl: string;
  buyer: CheckoutBuyerInput;
  shippingAddress: CheckoutAddressInput;
  billingAddress: CheckoutAddressInput;
  basketItems: CheckoutItemInput[];
}

interface CheckoutInitResp extends IyzicoResp {
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  tokenExpireTime?: number;
}

interface CheckoutRetrieveResp extends IyzicoResp {
  token?: string;
  paymentStatus?: string; // SUCCESS / FAILURE / INIT_THREEDS ...
  paymentId?: string;
  price?: string;
  paidPrice?: string;
  basketId?: string;
  fraudStatus?: number;
}

export async function initializeCheckoutForm(
  input: InitializeCheckoutInput,
): Promise<{ token: string; checkoutFormContent: string; paymentPageUrl?: string }> {
  const client = await getClient();
  const request = {
    locale: 'tr',
    conversationId: input.conversationId,
    price: input.price,
    paidPrice: input.paidPrice,
    currency: 'TRY',
    basketId: input.conversationId,
    paymentGroup: 'PRODUCT',
    callbackUrl: input.callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: input.buyer.id,
      name: input.buyer.name,
      surname: input.buyer.surname,
      gsmNumber: input.buyer.gsmNumber,
      email: input.buyer.email,
      identityNumber: input.buyer.identityNumber,
      registrationAddress: input.buyer.registrationAddress,
      city: input.buyer.city,
      country: input.buyer.country,
      zipCode: input.buyer.zipCode ?? '34000',
      ip: '85.34.78.112',
    },
    shippingAddress: input.shippingAddress,
    billingAddress: input.billingAddress,
    basketItems: input.basketItems.map((it) => {
      const item: Record<string, unknown> = {
        id: it.id,
        name: it.name,
        category1: it.category,
        itemType: 'PHYSICAL',
        price: it.price,
      };
      // Marketplace hesabı ise her item'a subMerchant gerekir
      if (env.IYZICO_DEFAULT_SUBMERCHANT_KEY) {
        item.subMerchantKey = env.IYZICO_DEFAULT_SUBMERCHANT_KEY;
        item.subMerchantPrice = it.price; // tüm tutar satıcıya (komisyon İyzico panelinden)
      }
      return item;
    }),
  };

  const checkoutFormInitialize = client.checkoutFormInitialize;
  const createFn = checkoutFormInitialize?.create?.bind(checkoutFormInitialize) as
    | ((req: Record<string, unknown>, cb: (err: unknown, result: CheckoutInitResp) => void) => void)
    | undefined;
  if (!createFn) {
    throw new Error('iyzipay checkoutFormInitialize.create mevcut değil (SDK versiyonu?)');
  }
  const res = await callbackToPromise<CheckoutInitResp>((cb) =>
    createFn(request, cb as (err: unknown, result: CheckoutInitResp) => void),
  );

  if (!res.token || !res.checkoutFormContent) {
    throw new IyzicoError('CHECKOUT_INIT_INCOMPLETE', 'token/form içeriği yok', undefined, res);
  }
  return {
    token: res.token,
    checkoutFormContent: res.checkoutFormContent,
    paymentPageUrl: res.paymentPageUrl,
  };
}

/**
 * Ödeme sonucu sorgula. callbackToPromise kullanmıyoruz çünkü
 * FAILURE durumunda da status:'success' döner (API çağrısı başarılı, ödeme başarısız).
 */
export async function retrieveCheckoutForm(token: string): Promise<{
  paymentStatus: string;
  paymentId?: string;
  paidPrice?: string;
  raw: CheckoutRetrieveResp;
}> {
  const client = await getClient();
  const checkoutForm = client.checkoutForm;
  const retrieveFn = checkoutForm?.retrieve?.bind(checkoutForm) as
    | ((req: Record<string, unknown>, cb: (err: unknown, result: CheckoutRetrieveResp) => void) => void)
    | undefined;
  if (!retrieveFn) {
    throw new Error('iyzipay checkoutForm.retrieve mevcut değil (SDK versiyonu?)');
  }
  return new Promise((resolve, reject) => {
    retrieveFn(
      { locale: 'tr', token },
      (err: unknown, result: CheckoutRetrieveResp) => {
        if (err) return reject(err);
        if (!result || result.status !== 'success') {
          return reject(
            new IyzicoError(result?.errorCode, result?.errorMessage, result?.errorGroup, result),
          );
        }
        resolve({
          paymentStatus: result.paymentStatus ?? 'UNKNOWN',
          paymentId: result.paymentId,
          paidPrice: result.paidPrice,
          raw: result,
        });
      },
    );
  });
}
