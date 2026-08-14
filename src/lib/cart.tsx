import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartLine {
  productId: Id<"products">;
  name: string;
  unit: string;
  price: number;
  qty: number;
  stock: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  total: number;
  add: (product: Doc<"products">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "velnox-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage unavailable — cart just lives in memory
    }
  }, [lines]);

  const add = (product: Doc<"products">, qty = 1) => {
    const price = product.price ?? 0;
    if (price <= 0 || product.currentStock <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product._id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product._id
            ? { ...l, qty: Math.min(l.stock, l.qty + qty) }
            : l,
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          unit: product.unit,
          price,
          qty: Math.min(product.currentStock, qty),
          stock: product.currentStock,
        },
      ];
    });
  };

  const setQty = (productId: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, qty: Math.max(0, Math.min(l.stock, qty)) }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  };

  const remove = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const clear = () => setLines([]);

  const { count, total } = useMemo(() => {
    return {
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      total: lines.reduce((sum, l) => sum + l.qty * l.price, 0),
    };
  }, [lines]);

  return (
    <CartContext.Provider value={{ lines, count, total, add, setQty, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
