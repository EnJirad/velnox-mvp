/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as center from "../center.js";
import type * as centerAdmin from "../centerAdmin.js";
import type * as commerce from "../commerce.js";
import type * as crons from "../crons.js";
import type * as customer from "../customer.js";
import type * as employeeAuth from "../employeeAuth.js";
import type * as employeeAuthHelpers from "../employeeAuthHelpers.js";
import type * as goals from "../goals.js";
import type * as http from "../http.js";
import type * as intelligence from "../intelligence.js";
import type * as memory from "../memory.js";
import type * as memoryEvents from "../memoryEvents.js";
import type * as orders from "../orders.js";
import type * as products from "../products.js";
import type * as rateLimit from "../rateLimit.js";
import type * as sellerOps from "../sellerOps.js";
import type * as stripe from "../stripe.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  center: typeof center;
  centerAdmin: typeof centerAdmin;
  commerce: typeof commerce;
  crons: typeof crons;
  customer: typeof customer;
  employeeAuth: typeof employeeAuth;
  employeeAuthHelpers: typeof employeeAuthHelpers;
  goals: typeof goals;
  http: typeof http;
  intelligence: typeof intelligence;
  memory: typeof memory;
  memoryEvents: typeof memoryEvents;
  orders: typeof orders;
  products: typeof products;
  rateLimit: typeof rateLimit;
  sellerOps: typeof sellerOps;
  stripe: typeof stripe;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
