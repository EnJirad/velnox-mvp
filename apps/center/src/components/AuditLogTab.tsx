import { api } from "@convex/_generated/api";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@velnox/shared/components/ui/card";
import { TabsContent } from "@velnox/shared/components/ui/tabs";
import { useAction } from "convex/react";
import { History, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * VelCenter Audit Logs tab (spec §44, §49). Reads the append-only
 * `audit_logs` table in Neon — every sensitive action (seller/product
 * approval, employee changes, payout processing, ...) is listed here.
 * Never logs passwords / hashes / secrets (enforced server-side).
 */
export default function AuditLogTab() {
  const auditLogsAction = useAction(api.centerAdmin.auditLogs);
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await auditLogsAction({ limit: 150 }));
    } catch {
      setRows([]);
    }
  }, [auditLogsAction]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TabsContent value="audit" className="mt-6">
      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-[#10B981]" />
            Audit Logs
          </CardTitle>
          <p className="text-xs text-slate-400">
            บันทึกการดำเนินการสำคัญทั้งหมด (append-only จาก Neon) — ใคร ทำอะไร กับอะไร เมื่อไหร่
          </p>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              กำลังโหลด audit logs...
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              ยังไม่มีบันทึกการดำเนินการ
            </p>
          ) : (
            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[10px] border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge className="rounded-full bg-slate-900 text-white">{row.action}</Badge>
                    <span className="text-xs text-slate-400">
                      {row.actorRole ?? "system"} · {row.entityType ?? "—"}{" "}
                      {row.entityId ? `#${row.entityId.slice(0, 8)}` : ""}
                    </span>
                    <span className="ml-auto text-xs tabular-nums text-slate-400">
                      {new Date(row.createdAt).toLocaleString("th-TH")}
                    </span>
                  </div>
                  {row.after && (
                    <pre className="mt-1.5 max-h-24 overflow-auto rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-500">
                      {JSON.stringify(row.after, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
