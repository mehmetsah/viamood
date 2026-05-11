declare module 'iyzipay' {
  interface IyzipayConfig {
    apiKey: string;
    secretKey: string;
    uri: string;
  }

  type Callback = (err: unknown, result: Record<string, unknown> & { status?: string }) => void;

  interface Resource {
    create(request: Record<string, unknown>, callback: Callback): void;
    update?(request: Record<string, unknown>, callback: Callback): void;
    retrieve?(request: Record<string, unknown>, callback: Callback): void;
  }

  class Iyzipay {
    constructor(config: IyzipayConfig);

    subMerchant: Resource;
    payment: Resource;
    threedsInitialize: Resource;
    threedsPayment: Resource;
    checkoutFormInitialize: Resource;
    checkoutForm: Resource;
    approval: Resource;
    disapproval: Resource;
    refund: Resource;
    cancel: Resource;
    bin: Resource;
    installment: Resource;
    apm: Resource;
    bkm: Resource;
    bkmInitialize: Resource;
    cardStorage: Resource;
    card: Resource;
    crossBookingToSubMerchant: Resource;
    crossBookingFromSubMerchant: Resource;
  }

  export default Iyzipay;
}
