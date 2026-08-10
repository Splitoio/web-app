"use client";

// The create screen lives in components/create/create-request-experience.tsx
// because "/" mounts the same thing for a signed-out visitor (app/page.tsx).
// Two routes, one implementation — see that file's header for the split.
import { CreateRequestExperience } from "@/components/create/create-request-experience";

export default function CreatePage() {
  return <CreateRequestExperience />;
}
