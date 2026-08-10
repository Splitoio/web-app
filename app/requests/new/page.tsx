import { redirect } from "next/navigation";

/**
 * `/requests/new` isn't a real route — the create flow lives at `/create`.
 * Without this, the request falls through to `app/requests/[id]/page.tsx`,
 * which treats "new" as a request id and renders "That request no longer
 * exists." This static segment takes precedence over the `[id]` dynamic
 * segment, so it intercepts the guess/bookmark before it ever reaches there.
 */
export default function RequestsNewRedirect() {
  redirect("/create");
}
