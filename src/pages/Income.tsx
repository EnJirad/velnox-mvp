import { AppHeader } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import {
  ORDER_STATUS_META,
  formatBaht,
  formatIsoDate,
  shortOrderNumber,
  type StoreOrder,
  type StoreOrderItem,
} from "@/lib/commerce";
import {
  AlertTriangle,
  BadgePercent,
  Landmark,
  Loader2,
  PackageCheck,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

const pct = (value: number) =>
  `${(value * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;

interface TransactionRow {
  order: StoreOrder;
  items: StoreOrderItem[];
  subtotal: number;
  pending: boolean;
}

interface IncomeReport {
  gross: number;
  grossCount: number;
  returns: number;
  returnCount: number;
  commission: number;
  commissionRate: number;
  returnRate: number;
  returnCoverage: number;
  payout: number;
  transactions: TransactionRow[];
}

export default function Income() {
  const sellerIncome = useAction(api.commerce.sellerIncomeReport);
  const [report, setReport] = useState<IncomeReport | null>(null);

  useEffect(() => {
    let alive = true;
    sellerIncome()
      .then((r) => alive && setReport(r as IncomeReport))
      .catch((err) => console.error("Load income error:", err));
    return () => {
      alive = false;
    };
  }, [sellerIncome]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <Wallet className="size-4 text-[#10B981]" />
            velseller · รายได้ของร้านค้า
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            รายได้และค่าธรรมเนียม
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-slate-500">
            ยอดขาย ออเดอร์ที่ตีกลับ และค่าธรรมเนียม 3% ต่อชิ้น ตามนโยบายของ Velnox
          </p>
        </div>

        {report === null ? (
          <div className="mt-10 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="size-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">ยอดขายรวม</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                  {formatBaht(report.gross)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {report.grossCount.toLocaleString("th-TH")} ชิ้น · ออเดอร์ที่เสร็จสิ้น
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2 text-rose-500">
                  <AlertTriangle className="size-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">ยอดตีกลับ</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                  {formatBaht(report.returns)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {pct(report.returnRate)} ของยอดสั่ง · {report.returnCount.toLocaleString("th-TH")} ชิ้น
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2 text-slate-700">
                  <BadgePercent className="size-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">ค่าธรรมเนียม 3%</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                  -{formatBaht(report.commission)}
                </p>
                <p className="mt-1 text-xs text-slate-400">คิดจากยอดขายที่เสร็จสิ้น</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2 text-[#10B981]">
                  <Landmark className="size-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">ยอดรับจริง</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                  {formatBaht(report.payout)}
                </p>
                <p className="mt-1 text-xs text-slate-400">หลังหักค่าธรรมเนียมและค่าตีกลับเกินนโยบาย</p>
              </div>
            </div>

            {/* Policy card */}
            <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                  <ShieldCheck className="size-5 text-[#10B981]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">นโยบายค่าธรรมเนียม Velnox</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
                    <li>
                      • เก็บค่าธรรมเนียม <span className="font-semibold text-slate-700">3% ต่อชิ้น</span> จากยอดขายที่เสร็จสิ้น
                    </li>
                    <li>
                      • ครอบคลุมค่าตีกลับ <span className="font-semibold text-slate-700">ไม่เกิน 10%</span> ของยอดขาย —
                      หากอัตราตีกลับเกิน 10% ส่วนต่างเป็นความรับผิดชอบของร้านค้า
                    </li>
                  </ul>
                </div>
              </div>
              {report.returnRate > 0.1 && (
                <Badge className="shrink-0 gap-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                  <AlertTriangle className="size-3" />
                  อัตราตีกลับเกิน 10%
                </Badge>
              )}
            </div>

            {/* Transactions */}
            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">รายการล่าสุด</h2>
                <span className="text-xs text-slate-400">{report.transactions.length} รายการ</span>
              </div>

              {report.transactions.length === 0 ? (
                <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100">
                    <Receipt className="size-6 text-slate-400" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">ยังไม่มีรายการ</h3>
                  <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                    เมื่อลูกค้าสั่งซื้อสินค้าของคุณจาก velshop ยอดขายและค่าธรรมเนียมจะคำนวณให้ที่นี่
                  </p>
                </div>
              ) : (
                <>
                {/* Desktop: table */}
                <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-5 text-slate-400">ออเดอร์</TableHead>
                        <TableHead className="text-slate-400">วันที่</TableHead>
                        <TableHead className="text-slate-400">รายการ</TableHead>
                        <TableHead className="text-right text-slate-400">ยอดสินค้า</TableHead>
                        <TableHead className="text-right text-slate-400">ค่าธรรมเนียม</TableHead>
                        <TableHead className="pr-5 text-right text-slate-400">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.transactions.map(({ order, items, subtotal, pending }) => {
                        const meta = ORDER_STATUS_META[order.status];
                        const fee = Math.round(subtotal * 0.03 * 100) / 100;
                        return (
                          <TableRow key={order.id} className="hover:bg-slate-50/60">
                            <TableCell className="pl-5">
                              <p className="font-medium text-slate-900">{shortOrderNumber(order.orderNumber)}</p>
                              <p className="text-xs text-slate-400">{order.customerName || "ลูกค้า"}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-slate-600">{formatIsoDate(order.createdAt)}</p>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-52 space-y-0.5">
                                {items.slice(0, 2).map((item) => (
                                  <p key={item.id} className="truncate text-sm text-slate-600">
                                    {item.productName} × {item.quantity} {item.unit}
                                  </p>
                                ))}
                                {items.length > 2 && (
                                  <p className="text-xs text-slate-400">+{items.length - 2} รายการ</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="font-medium tabular-nums text-slate-900">{formatBaht(subtotal)}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <p className="tabular-nums text-slate-500">
                                {pending || order.status === "cancelled" ? "—" : `-${formatBaht(fee)}`}
                              </p>
                            </TableCell>
                            <TableCell className="pr-5 text-right">
                              <Badge className={`gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: app-like transaction cards */}
                <div className="mt-3 space-y-3 md:hidden">
                  {report.transactions.map(({ order, items, subtotal, pending }) => {
                    const meta = ORDER_STATUS_META[order.status];
                    const fee = Math.round(subtotal * 0.03 * 100) / 100;
                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {shortOrderNumber(order.orderNumber)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {formatIsoDate(order.createdAt)} · {order.customerName || "ลูกค้า"}
                            </p>
                          </div>
                          <Badge className={`shrink-0 gap-1.5 rounded-full ring-1 ring-inset ${meta.badge}`}>
                            <span className={`size-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </Badge>
                        </div>

                        <div className="mt-3 rounded-[10px] bg-slate-50 px-3 py-2.5">
                          {items.slice(0, 2).map((item) => (
                            <p key={item.id} className="truncate text-sm text-slate-600">
                              {item.productName}{" "}
                              <span className="text-slate-400">× {item.quantity} {item.unit}</span>
                            </p>
                          ))}
                          {items.length > 2 && (
                            <p className="text-xs text-slate-400">+{items.length - 2} รายการ</p>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-slate-400">ยอดสินค้า</p>
                            <p className="mt-0.5 font-bold tabular-nums text-slate-900">{formatBaht(subtotal)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400">ค่าธรรมเนียม 3%</p>
                            <p className="mt-0.5 font-medium tabular-nums text-slate-500">
                              {pending || order.status === "cancelled" ? "—" : `-${formatBaht(fee)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                <PackageCheck className="size-3.5 text-[#10B981]" />
                ค่าธรรมเนียมคิดเฉพาะออเดอร์ที่เสร็จสิ้น — ออเดอร์ที่ยกเลิกจะถูกนับเป็นยอดตีกลับ
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
