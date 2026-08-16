/**
 * Velnox Backend — Shipping abstraction (spec §22, §23).
 *
 * The commerce core never hard-codes a courier: every fulfillment action goes
 * through a ShippingProvider. PHASE 6 ships the "manual" provider — the
 * seller enters the carrier + tracking number and appends tracking events by
 * hand; it works end-to-end today with zero external accounts.
 *
 * Real carrier integrations (Kerry, Flash, J&T, Thailand Post, DHL) plug into
 * the registry below in a later phase (carrier API keys + webhooks). Each new
 * provider implements the same interface — the customer/seller/center UIs and
 * the order/tracking services do NOT change.
 *
 * @see db/migrations/006_logistics_returns.sql (shipments + tracking_events)
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows via services */
import type { Db } from "./db";
import type { Shipment, TrackingEvent } from "./types";
import {
  addTrackingEvent,
  createShipment as persistShipment,
  getShipment,
  listTrackingEvents,
  type CreateShipmentInput,
} from "./shipments";

// ---------------------------------------------------------------------------
// provider registry (add real couriers here in Phase 10)
// ---------------------------------------------------------------------------
export type ShippingProviderId = "manual" | "kerry" | "flash" | "jtexpress" | "thailandpost" | "dhl";

export interface ShippingMethod {
  id: string;
  name: string;
  provider: ShippingProviderId;
  /** flat fee THB — real providers will quote dynamically */
  flatFee: number;
  /** estimated delivery window in days [min, max] */
  etaDays: [number, number];
}

/** Methods offered on the storefront today (all manual, flat fee). */
export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: "standard", name: "มาตรฐาน", provider: "manual", flatFee: 0, etaDays: [2, 4] },
  { id: "express", name: "ด่วน", provider: "manual", flatFee: 30, etaDays: [1, 2] },
];

/** Friendly labels used across UIs (kept here so the frontend never hard-codes). */
export const CARRIER_LABELS: Record<string, string> = {
  manual: "จัดส่งเอง / ร้านกำหนด",
  kerry: "Kerry Express",
  flash: "Flash Express",
  jtexpress: "J&T Express",
  thailandpost: "Thailand Post",
  dhl: "DHL Express",
};

export interface ShippingQuote {
  provider: ShippingProviderId;
  methodId: string;
  methodName: string;
  fee: number;
  currency: string;
  estimatedDeliveryDays: [number, number];
}

export interface ShippingProvider {
  readonly id: ShippingProviderId;
  readonly name: string;
  /** Quote shipping for an order (pure calculation — no side effects). */
  calculateShipping(opts?: {
    methodId?: string;
    weightKg?: number;
    distanceKm?: number;
    baseFee?: number;
  }): ShippingQuote;
  /** Persist a shipment + mark the order as shipped (seller action). */
  createShipment(db: Db, input: CreateShipmentInput): Promise<Shipment>;
  /** Cancel a shipment (adds a cancelled tracking event). */
  cancelShipment(db: Db, shipmentId: string): Promise<Shipment | null>;
  /** Full tracking detail: shipment header + ordered events. */
  trackShipment(db: Db, shipmentId: string): Promise<{ shipment: Shipment | null; events: TrackingEvent[] }>;
  /** Latest human-readable status label. */
  getTrackingStatus(db: Db, shipmentId: string): Promise<string>;
}

/** Human-readable Thai tracking status labels (single source of truth). */
export const TRACKING_STATUS_LABELS: Record<string, string> = {
  created: "สร้างพัสดุแล้ว",
  picked_up: "รับพัสดุแล้ว",
  in_transit: "อยู่ระหว่างขนส่ง",
  arrived_at_hub: "ถึงศูนย์คัดแยก",
  out_for_delivery: "กำลังนำส่ง",
  delivered: "ส่งถึงแล้ว",
  failed: "จัดส่งไม่สำเร็จ",
  returned: "ส่งคืนผู้ขาย",
  cancelled: "ยกเลิกการจัดส่ง",
};

export function trackingStatusLabel(status: string): string {
  return TRACKING_STATUS_LABELS[status.toLowerCase()] ?? status;
}

/**
 * Manual provider: seller enters carrier + tracking number, tracking events
 * are appended manually (or later by a carrier webhook). Real carriers will
 * implement the same interface and swap in via getShippingProvider().
 */
class ManualShippingProvider implements ShippingProvider {
  readonly id = "manual" as const;
  readonly name = "Manual fulfillment";

  calculateShipping(opts?: {
    methodId?: string;
    weightKg?: number;
    distanceKm?: number;
    baseFee?: number;
  }): ShippingQuote {
    const method = SHIPPING_METHODS.find((m) => m.id === (opts?.methodId ?? "standard")) ?? SHIPPING_METHODS[0];
    const base = opts?.baseFee ?? 0;
    const weightSurcharge = Math.max(0, (opts?.weightKg ?? 0) - 1) * 10;
    return {
      provider: this.id,
      methodId: method.id,
      methodName: method.name,
      fee: method.flatFee + base + weightSurcharge,
      currency: "THB",
      estimatedDeliveryDays: method.etaDays,
    };
  }

  async createShipment(db: Db, input: CreateShipmentInput): Promise<Shipment> {
    const shipment = await persistShipment(db, input);
    // start the timeline so the customer always sees at least one event
    await addTrackingEvent(db, shipment.id, {
      status: "created",
      description: "ร้านค้าสร้างพัสดุแล้ว รอรับจากบริษัทขนส่ง",
    });
    return (await getShipment(db, shipment.id)) ?? shipment;
  }

  async cancelShipment(db: Db, shipmentId: string): Promise<Shipment | null> {
    const shipment = await getShipment(db, shipmentId);
    if (!shipment) return null;
    await addTrackingEvent(db, shipmentId, {
      status: "cancelled",
      description: "การจัดส่งถูกยกเลิก",
    });
    return getShipment(db, shipmentId);
  }

  async trackShipment(db: Db, shipmentId: string): Promise<{ shipment: Shipment | null; events: TrackingEvent[] }> {
    const shipment = await getShipment(db, shipmentId);
    const events = await listTrackingEvents(db, shipmentId);
    return { shipment, events };
  }

  async getTrackingStatus(db: Db, shipmentId: string): Promise<string> {
    const events = await listTrackingEvents(db, shipmentId);
    const latest = events[events.length - 1];
    return latest ? trackingStatusLabel(latest.status) : "ยังไม่มีการเคลื่อนไหว";
  }
}

const providers = new Map<ShippingProviderId, ShippingProvider>([
  ["manual", new ManualShippingProvider()],
  // TODO(Phase 10 — carrier integration): register real providers here once
  // their API clients exist, e.g.:
  //   ["kerry", new KerryProvider(process.env.KERRY_API_KEY!)],
  //   ["thailandpost", new ThailandPostProvider(process.env.TH_POST_TOKEN!)],
]);

/** Resolve the provider for a carrier id (defaults to manual when unknown). */
export function getShippingProvider(id?: ShippingProviderId | string | null): ShippingProvider {
  return providers.get((id as ShippingProviderId) ?? "manual") ?? providers.get("manual")!;
}

/** Quote shipping through the given provider (used by checkout). */
export function quoteShipping(opts?: {
  provider?: ShippingProviderId;
  methodId?: string;
  weightKg?: number;
  distanceKm?: number;
  baseFee?: number;
}): ShippingQuote {
  return getShippingProvider(opts?.provider).calculateShipping(opts);
}
