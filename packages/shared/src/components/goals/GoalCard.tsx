import {
  CATEGORY_META,
  PERIOD_META,
  formatNumber,
  formatShortThaiDate,
  goalPercent,
  isAchieved,
  isAtRisk,
  type Goal,
} from "@velnox/shared/lib/goals";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Card } from "@velnox/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@velnox/shared/components/ui/dropdown-menu";
import {
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onRecordProgress: (goal: Goal) => void;
}

export function GoalCard({ goal, onEdit, onDelete, onRecordProgress }: GoalCardProps) {
  const meta = CATEGORY_META[goal.category];
  const percent = goalPercent(goal);
  const achieved = isAchieved(goal);
  const atRisk = isAtRisk(goal);
  const Icon = meta.icon;

  return (
    <Card className="group flex flex-col gap-4 rounded-xl border-slate-200 bg-white p-5 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-[10px] ring-1 ring-inset ${meta.chip}`}
          >
            <Icon className={`size-4 ${meta.iconClass}`} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <span>{meta.label}</span>
              <span className="text-slate-300">•</span>
              <span>{PERIOD_META[goal.period]}</span>
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">ตัวเลือกเป้าหมาย</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => onRecordProgress(goal)}
            >
              <Plus className="size-4" />
              บันทึกความคืบหน้า
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(goal)}>
              <Pencil className="size-4" />
              แก้ไขเป้าหมาย
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
              onClick={() => onDelete(goal)}
            >
              <Trash2 className="size-4" />
              ลบเป้าหมาย
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {goal.description && (
        <p className="-mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
          {goal.description}
        </p>
      )}

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">
              {formatNumber(goal.currentValue)}
            </span>{" "}
            / {formatNumber(goal.targetValue)} {goal.unit}
          </p>
          <p
            className={`text-lg font-bold tabular-nums tracking-tight ${
              achieved ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {percent}%
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              achieved ? "bg-emerald-500" : "bg-[#10B981]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        {achieved ? (
          <Badge className="gap-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-emerald-50">
            <CheckCircle2 className="size-3.5" />
            สำเร็จแล้ว
          </Badge>
        ) : atRisk ? (
          <Badge className="gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15 hover:bg-amber-50">
            เกินกำหนด
          </Badge>
        ) : (
          <Badge className="gap-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
            ตามแผน
          </Badge>
        )}
        {goal.dueDate !== undefined && !achieved && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <CalendarClock className="size-3.5" />
            กำหนด {formatShortThaiDate(goal.dueDate)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto">
        <Button
          variant="outline"
          className="w-full gap-1.5 border-slate-200 bg-white text-slate-700 hover:border-[#10B981] hover:bg-[#ECFDF5] hover:text-emerald-700"
          onClick={() => onRecordProgress(goal)}
        >
          <Plus className="size-4" />
          บันทึกความคืบหน้า
        </Button>
      </div>
    </Card>
  );
}
