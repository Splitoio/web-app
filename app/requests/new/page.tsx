"use client";

import { redirect } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { LockedScreen } from "@/components/shell/locked-feature";

/**
 * `/requests/new` isn't a real route — the create flow lives at `/create`.
 * Without this, the request falls through to `app/requests/[id]/page.tsx`,
 * which treats "new" as a request id and renders "That request no longer
 * exists." This static segment takes precedence over the `[id]` dynamic
 * segment, so it intercepts the guess/bookmark before it ever reaches there.
 *
 * The shell now renders its chrome for signed-out visitors too, so this
 * route is reachable without a session. It has no data hooks to protect —
 * just the redirect — so for an anonymous visitor we skip the redirect
 * entirely and point them at the create screen on the home page instead,
 * which needs no account.
 */
export default function RequestsNewRedirect() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return (
      <LockedScreen
        title="New request"
        reason="Sign in to use this screen"
        blurb="Creating a request needs no account — use the create screen on the home page instead."
      />
    );
  }
  redirect("/create");
}
