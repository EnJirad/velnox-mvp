import { api } from "@convex/_generated/api";
import { useConvexAuth, useAction } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTracking } from "@velnox/shared/lib/track";

/**
 * Cart line — the real cart lives in the backend (Neon via Convex actions,
 * spec §12: ห้ามใช้ localStorage เป็น Source of Truth). Guests get a local
 * in-memory cart for browsing; signing in switches to the server cart.
 */
export interface CartLine {
  /** cart item id (backend) — guest lines use a `guest-` prefixed temp id */
  id: string;
  productId: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  stock: number;
  shopName?: string;
  imageUrl?: string;
}

/** Minimal product shape the cart needs (works with both Convex & Neon docs). */
export interface AddToCartProduct {
  id: string;
  name: string;
  unit: string;
  price?: number | null;
  stock: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  /** adds a product (server-side when signed in, local for guests) */
  add: (product: AddToCartProduct, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** true while the server cart is being loaded/synced */
  syncing: boolean;
  reload: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function toLine(item: {
  id: string;
  productId: string;
  quantity: number;
  priceSnapshot: number;
  productName?: string;
  unit?: string;
  availableStock?: number;
  shopName?: string;
  productImageUrl?: string;
}): CartLine {
  return {
    id: item.id,
    productId: item.productId,
    name: item.productName ?? "สินค้า",
    unit: item.unit ?? "piece",
    price: item.priceSnapshot,
    qty: item.quantity,
    stock: item.availableStock ?? item.quantity,
    shopName: item.shopName,
    imageUrl: item.productImageUrl,
  };
}

let guestSeq = 0;

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const myCart = useAction(api.customer.myCart);
  const addToCartAction = useAction(api.customer.addToCartAction);
  const updateCartItemAction = useAction(api.customer.updateCartItemAction);
  const removeCartItemAction = useAction(api.customer.removeCartItemAction);
  const { track } = useTracking();

  const [lines, setLines] = useState<CartLine[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Load the server cart whenever auth state changes (or after mutations).
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLines([]);
      return;
    }
    let alive = true;
    setSyncing(true);
    myCart()
      .then((cart) => {
        if (!alive) return;
        setLines((cart?.items ?? []).map(toLine));
      })
      .catch((err) => {
        console.error("[cart] load failed:", err);
        if (alive) setLines([]);
      })
      .finally(() => alive && setSyncing(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, version]);

  /** Reconcile local lines with the server response (or reset on error). */
  const applyServer = useCallback(
    (items: unknown[]) => {
      setLines(items.map(toLine as (i: unknown) => CartLine));
    },
    [],
  );

  const add = useCallback(
    (product: AddToCartProduct, qty = 1) => {
      const price = product.price ?? 0;
      if (price <= 0 || product.stock <= 0) return;
      track("CART_ADD", { entityId: product.id, value: product.name, context: { qty } });
      if (!isAuthenticated) {
        setLines((prev) => {
          const existing = prev.find((l) => l.productId === product.id);
          if (existing) {
            return prev.map((l) =>
              l.productId === product.id
                ? { ...l, qty: Math.min(l.stock, l.qty + qty) }
                : l,
            );
          }
          return [
            ...prev,
            {
              id: `guest-${++guestSeq}`,
              productId: product.id,
              name: product.name,
              unit: product.unit,
              price,
              qty: Math.min(product.stock, qty),
              stock: product.stock,
            },
          ];
        });
        return;
      }
      // optimistic add, then reconcile with the server (which re-checks stock)
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === product.id);
        if (existing) {
          return prev.map((l) =>
            l.productId === product.id
              ? { ...l, qty: Math.min(l.stock, l.qty + qty) }
              : l,
          );
        }
        return [
          ...prev,
          {
            id: `guest-${++guestSeq}`,
            productId: product.id,
            name: product.name,
            unit: product.unit,
            price,
            qty: Math.min(product.stock, qty),
            stock: product.stock,
          },
        ];
      });
      addToCartAction({ productId: product.id, quantity: qty })
        .then(applyServer)
        .catch((err) => {
          console.error("[cart] add failed:", err);
          reload();
        });
    },
    [isAuthenticated, addToCartAction, applyServer, reload, track],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      if (!isAuthenticated) {
        setLines((prev) => {
          const line = prev.find((l) => l.productId === productId);
          if (line && qty <= 0) track("CART_REMOVE", { entityId: line.productId, value: line.name });
          return prev
            .map((l) =>
              l.productId === productId
                ? { ...l, qty: Math.max(0, Math.min(l.stock, qty)) }
                : l,
            )
            .filter((l) => l.qty > 0);
        });
        return;
      }
      const line = lines.find((l) => l.productId === productId);
      if (!line) return;
      if (qty <= 0) {
        track("CART_REMOVE", { entityId: line.productId, value: line.name });
        removeCartItemAction({ cartItemId: line.id })
          .then(applyServer)
          .catch((err) => {
            console.error("[cart] remove failed:", err);
            reload();
          });
        return;
      }
      setLines((prev) =>
        prev.map((l) =>
          l.productId === productId
            ? { ...l, qty: Math.max(0, Math.min(l.stock, qty)) }
            : l,
        ),
      );
      updateCartItemAction({ cartItemId: line.id, quantity: qty })
        .then(applyServer)
        .catch((err) => {
          console.error("[cart] update failed:", err);
          reload();
        });
    },
    [isAuthenticated, lines, removeCartItemAction, updateCartItemAction, applyServer, reload, track],
  );

  const remove = useCallback(
    (productId: string) => {
      if (!isAuthenticated) {
        setLines((prev) => {
          const line = prev.find((l) => l.productId === productId);
          if (line) track("CART_REMOVE", { entityId: line.productId, value: line.name });
          return prev.filter((l) => l.productId !== productId);
        });
        return;
      }
      const line = lines.find((l) => l.productId === productId);
      if (!line) return;
      track("CART_REMOVE", { entityId: line.productId, value: line.name });
      setLines((prev) => prev.filter((l) => l.productId !== productId));
      removeCartItemAction({ cartItemId: line.id })
        .then(applyServer)
        .catch((err) => {
          console.error("[cart] remove failed:", err);
          reload();
        });
    },
    [isAuthenticated, lines, removeCartItemAction, applyServer, reload, track],
  );

  const clear = useCallback(() => setLines([]), []);

  const { count, total } = useMemo(() => {
    return {
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      total: lines.reduce((sum, l) => sum + l.qty * l.price, 0),
    };
  }, [lines]);

  const value = useMemo(
    () => ({ lines, count, total, add, setQty, remove, clear, syncing, reload }),
    [lines, count, total, add, setQty, remove, clear, syncing, reload],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
