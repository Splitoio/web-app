"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { joinGroupByToken } from "@/features/groups/api/client";
import { toast } from "sonner";
import { BG, T, card } from "@/lib/splito-design";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");

  useEffect(() => {
    if (!token?.trim()) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    setStatus("joining");

    joinGroupByToken(token)
      .then((res) => {
        if (cancelled) return;
        setStatus("done");
        toast.success(res.message ?? "You joined the group");
        router.replace(`/groups/${res.groupId}`);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        toast.error("Invite link is invalid or expired");
        router.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token?.trim()) return null;

  const label =
    status === "joining"
      ? "Joining group…"
      : status === "error"
        ? "Redirecting…"
        : status === "done"
          ? "Taking you to the group…"
          : "";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: BG }}
    >
      <div
        className="flex flex-col items-center gap-4"
        style={{ ...card(), padding: "32px 40px" }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.muted }} />
        <p style={{ fontSize: 13.5, fontWeight: 600, color: T.body }}>{label}</p>
      </div>
    </div>
  );
}
