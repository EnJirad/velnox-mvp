import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { getSessionId } from "@/lib/session";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type CartItem = {
  id: Id<"cartItems">;
  productId: Id<"products">;
  variantId?: Id<"variants">;
  name: string;
  variantName?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  available: number;
};

type CartValue = {
  items: CartItem[];
  totalMinor: number;
  count: number;
  loading: boolean;
  add: (productId: string, variantId?: string, quantity?: number) => Promise<void>;
  updateQty: (cartItemId: string, quantity: number) => Promise<void>;
  remove: (cartItemId: string) => Promise<void>;
  clear: () => Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [sessionId] = useState(getSessionId);
  const [open, setOpen] = useState(false);

  const cart = useQuery(api.cart.getCart, { sessionId });
  const addToCart = useMutation(api.cart.addToCart);
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const removeCartItem = useMutation(api.cart.removeCartItem);
  const clearCart = useMutation(api.cart.clearCart);
  const mergeGuestCart = useMutation(api.cart.mergeGuestCart);

  // Fold guest-cart items into the account once signed in.
  useEffect(() => {
    if (isAuthenticated) {
      void mergeGuestCart({ sessionId });
    }
  }, [isAuthenticated, mergeGuestCart, sessionId]);

  const add = useCallback(
    async (productId: string, variantId?: string, quantity = 1) => {
      await addToCart({
        productId: productId as Id<"products">,
        variantId: (variantId ?? undefined) as Id<"variants"> | undefined,
        quantity,
        sessionId,
      });
    },
    [addToCart, sessionId],
  );

  const updateQty = useCallback(
    async (cartItemId: string, quantity: number) => {
      await updateCartItem({
        cartItemId: cartItemId as Id<"cartItems">,
        quantity,
        sessionId,
      });
    },
    [updateCartItem, sessionId],
  );

  const remove = useCallback(
    async (cartItemId: string) => {
      await removeCartItem({
        cartItemId: cartItemId as Id<"cartItems">,
        sessionId,
      });
    },
    [removeCartItem, sessionId],
  );

  const clear = useCallback(async () => {
    await clearCart({ sessionId });
  }, [clearCart, sessionId]);

  const value: CartValue = {
    items: cart?.items ?? [],
    totalMinor: cart?.totalMinor ?? 0,
    count: cart?.count ?? 0,
    loading: cart === undefined,
    add,
    updateQty,
    remove,
    clear,
    open,
    setOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return value;
}
