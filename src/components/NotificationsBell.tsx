import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router";
import { formatDateTime } from "@/lib/format";

export function NotificationsBell() {
  const notifications = useQuery(api.notifications.myNotifications);
  const unread = useQuery(api.notifications.unreadNotificationCount) ?? 0;
  const markAll = useMutation(api.notifications.markAllNotificationsRead);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative cursor-pointer">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAll()}
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-lime-300 hover:underline"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications === undefined ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification._id}
                to={notification.link ?? "/dashboard"}
                className={`block px-3 py-2.5 transition-colors hover:bg-muted ${
                  notification.read ? "opacity-60" : ""
                }`}
              >
                <p className="text-sm font-medium">{notification.title}</p>
                {notification.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {notification.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {formatDateTime(notification._creationTime)}
                </p>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
