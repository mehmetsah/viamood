/**
 * KargoLab entegrasyonu — stub.
 * Phase 4'te full implementasyon.
 *
 * Beklenen yetenekler (API doc audit edilecek):
 *   - createShipment(orderId, vendorAddress, customerAddress, package) → labelUrl + trackingNumber
 *   - getTrackingStatus(trackingNumber) → events[]
 *   - cancelShipment(trackingNumber)
 *   - multi-pickup (consolidate_carrier mode için) — VARSA Mode 3 destekli
 *
 * Webhook: kargo durum güncellemeleri → bizim endpoint
 */
import { env } from '../env';

export function getKargolabConfig() {
  if (!env.KARGOLAB_API_URL || !env.KARGOLAB_API_KEY) {
    throw new Error('KargoLab credentials not configured');
  }
  return {
    apiUrl: env.KARGOLAB_API_URL,
    apiKey: env.KARGOLAB_API_KEY,
  };
}

export interface ShipmentAddress {
  name: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  district?: string;
  postalCode?: string;
  country?: string;
}

export interface CreateShipmentInput {
  externalRef: string;          // bizim fulfillment.id
  fromAddress: ShipmentAddress;
  toAddress: ShipmentAddress;
  weightGrams: number;
  dimensionsCm?: { length: number; width: number; height: number };
  carrier?: string;             // Aras, MNG, Yurtiçi — auto seçim için undefined bırak
  cashOnDelivery?: { amountCents: bigint };
  metadata?: Record<string, unknown>;
}

export interface ShipmentResult {
  shipmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  carrier: string;
  estimatedDeliveryDate?: string;
}

export async function createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
  // TODO: Phase 4 — KargoLab API çağrısı
  throw new Error('Not implemented yet — Phase 4');
}

export async function getTrackingStatus(_trackingNumber: string): Promise<unknown[]> {
  throw new Error('Not implemented yet — Phase 4');
}

export async function cancelShipment(_trackingNumber: string): Promise<void> {
  throw new Error('Not implemented yet — Phase 4');
}
