/**
 * Velnox Backend — Shipments + Tracking (spec §20–21, §27–28).
 *
 * A shipment is created by the seller when fulfilling an order; tracking events
 * are appended over time (PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY →
 * DELIVERED). The customer reads shipments through their own order only.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { toMs } from "./dates";
import { AppError } from "./errors";
import type { Shipment, TrackingEvent } from "./types";

function mapTrackingEvent(r: Record<string, any>): TrackingEvent {
  return {
    id: r.id,
    shipmentId: r.shipment_id,
    status: r.status,
    description: r.description ?? null,
    location: r.location ?? null,
    occurredAt: toMs(r.occurred_at),
  };
}

function mapShipment(r: Record<string, any>): Shipment {
  return {
    id: r.id,
    orderId: r.order_id,
    sellerId: r.seller_id,
    carrier: r.carrier,
    trackingNumber: r.tracking_number ?? null,
    status: r.status,
    shippingFee: Number(r.shipping_fee),
    estimatedDeliveryDate: r.estimated_delivery_date ?? null,
    shippedAt: r.shipped_at != null ? toMs(r.shipped_at) : null,
    deliveredAt: r.delivered_at != null ? toMs(r.delivered_at) : null,
    createdAt: toMs(r.created_at),
  };
}

export interface CreateShipmentInput {
  orderId: string;
  sellerId: string;
  carrier: string;
  trackingNumber?: string | null;
  estimatedDeliveryDate?: string | null;
}

export async function createShipment(db: Db, input: CreateShipmentInput): Promise<Shipment> {
  if (!input.carrier.trim()) throw new AppError("INVALID_INPUT", "กรุณาระบุบริษัทขนส่ง");
  const rows = await db(
    `INSERT INTO shipments (order_id, seller_id, carrier, tracking_number, estimated_delivery_date, shipped_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING *`,
    [
      input.orderId,
      input.sellerId,
      input.carrier.trim(),
      input.trackingNumber ?? null,
      input.estimatedDeliveryDate ?? null,
    ],
  );
  return mapShipment(rows[0]);
}

export async function getShipment(db: Db, shipmentId: string): Promise<Shipment | null> {
  const rows = await db("SELECT * FROM shipments WHERE id = $1 LIMIT 1", [shipmentId]);
  if (!rows[0]) return null;
  const shipment = mapShipment(rows[0]);
  shipment.events = await listTrackingEvents(db, shipmentId);
  return shipment;
}

export async function listShipmentsForOrder(db: Db, orderId: string): Promise<Shipment[]> {
  const rows = await db("SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC", [orderId]);
  return rows.map(mapShipment);
}

export async function listShipmentsForSeller(db: Db, sellerId: string, limit = 50): Promise<Shipment[]> {
  const rows = await db(
    "SELECT * FROM shipments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sellerId, limit],
  );
  return rows.map(mapShipment);
}

export async function addTrackingEvent(
  db: Db,
  shipmentId: string,
  input: { status: string; description?: string | null; location?: string | null },
): Promise<TrackingEvent> {
  const shipment = await db("SELECT id FROM shipments WHERE id = $1", [shipmentId]);
  if (!shipment[0]) throw new AppError("NOT_FOUND", "ไม่พบ shipment");
  const rows = await db(
    `INSERT INTO tracking_events (shipment_id, status, description, location, occurred_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING *`,
    [shipmentId, input.status, input.description ?? null, input.location ?? null],
  );

  // keep shipment.status in sync with the latest event
  await db("UPDATE shipments SET status = $2, delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END WHERE id = $1", [
    shipmentId,
    input.status,
  ]);
  return mapTrackingEvent(rows[0]);
}

export async function listTrackingEvents(db: Db, shipmentId: string): Promise<TrackingEvent[]> {
  const rows = await db(
    "SELECT * FROM tracking_events WHERE shipment_id = $1 ORDER BY occurred_at ASC",
    [shipmentId],
  );
  return rows.map(mapTrackingEvent);
}
