/**
 * Velnox Backend — standardized errors (spec §38).
 *
 * Every backend service throws AppError with a stable `code` so the API layer
 * can map it to a user-friendly Thai message without string matching.
 */
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "ORDER_NOT_FOUND"
  | "SHOP_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STATUS_TRANSITION"
  | "PAYMENT_FAILED"
  | "ADDRESS_GPS_REQUIRED"
  | "PROFILE_SAVE_FAILED"
  | "CONFLICT";

const THAI_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบก่อน",
  FORBIDDEN: "คุณไม่มีสิทธิ์ดำเนินการนี้",
  NOT_FOUND: "ไม่พบข้อมูลที่ขอ",
  INVALID_INPUT: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  VALIDATION_ERROR: "ข้อมูลไม่ผ่านการตรวจสอบ กรุณาตรวจสอบอีกครั้ง",
  RATE_LIMITED: "ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  INTERNAL_ERROR: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่ในภายหลัง",
  OUT_OF_STOCK: "สินค้าหมดจากสต็อก",
  PRICE_CHANGED: "ราคาสินค้าเปลี่ยนแปลง กรุณาตรวจสอบตะกร้าอีกครั้ง",
  ORDER_NOT_FOUND: "ไม่พบออเดอร์นี้",
  SHOP_NOT_FOUND: "ไม่พบร้านค้านี้",
  PRODUCT_NOT_FOUND: "ไม่พบสินค้านี้",
  INSUFFICIENT_STOCK: "สินค้ามีสต็อกไม่เพียงพอ",
  INVALID_STATUS_TRANSITION: "ไม่สามารถเปลี่ยนสถานะนี้ได้",
  PAYMENT_FAILED: "การชำระเงินล้มเหลว",
  ADDRESS_GPS_REQUIRED: "ที่อยู่จัดส่งต้องมีพิกัด GPS (เลือกตำแหน่งบนแผนที่)",
  PROFILE_SAVE_FAILED: "บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง",
  CONFLICT: "ข้อมูลซ้ำกับรายการที่มีอยู่",
};

export class AppError extends Error {
  code: ErrorCode;
  /** optional extra context (e.g. product name) for richer messages */
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? THAI_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export const notFound = (msg?: string) => new AppError("NOT_FOUND", msg);
export const forbidden = (msg?: string) => new AppError("FORBIDDEN", msg);
export const invalidInput = (msg?: string) => new AppError("INVALID_INPUT", msg);
export const authRequired = (msg?: string) => new AppError("AUTH_REQUIRED", msg);
export const insufficientStock = (msg?: string) => new AppError("INSUFFICIENT_STOCK", msg);
export const invalidTransition = (msg?: string) => new AppError("INVALID_STATUS_TRANSITION", msg);
