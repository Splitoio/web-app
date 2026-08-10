"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCreateWorkspace } from "@/features/workspaces/hooks/use-create-workspace";
import { useSetActiveWorkspace } from "@/contexts/workspace";
import {
  A,
  B,
  BORDER,
  Btn,
  G,
  HERO_SURFACE,
  O,
  P,
  R,
  RADIUS,
  SHADOW,
  T,
  avatarChip,
  initialsFrom,
} from "@/lib/splito-design";

/**
 * "New workspace" — the create half of the sidebar switcher.
 *
 * A business workspace is an `Organization`; there is no `POST /api/workspaces`.
 * `name` is the only field `POST /api/organizations` requires
 * (organization.controller.ts createOrganization), so that is the only
 * required field here — description and accent are optional conveniences.
 *
 * The cap is the server's call, not ours: the switcher hides the entry point
 * when `canCreateBusiness` is false, and if the server 400s anyway (a second
 * tab created one first) the message is surfaced verbatim rather than swallowed.
 */

/** Personal owns the brand accent, so business workspaces pick from the rest. */
const WORKSPACE_ACCENTS = [G, P, O, B, R] as const;

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map((x) => (typeof x === "string" ? x : String(x))).join(". ");
  }
  return fallback;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const setActiveWorkspace = useSetActiveWorkspace();
  const createWorkspace = useCreateWorkspace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(WORKSPACE_ACCENTS[0]);

  const handleClose = () => {
    if (createWorkspace.isPending) return;
    onClose();
    setName("");
    setDescription("");
    setColor(WORKSPACE_ACCENTS[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the workspace a name");
      return;
    }

    createWorkspace.mutate(
      { name: trimmed, description: description.trim() || undefined, color },
      {
        onSuccess: (organization) => {
          toast.success(`${organization.name} is ready`);
          handleClose();
          // Land the user *in* the workspace they just made — the switcher
          // list has already refetched by now (see use-create-workspace).
          setActiveWorkspace(organization.id);
          router.push("/");
        },
        onError: (err: unknown) =>
          toast.error(errMsg(err, "Couldn't create that workspace")),
      }
    );
  };

  // Matches the backend's workspaceInitials(), which falls back to "W" for an
  // unnamed workspace rather than the generic "?" chip.
  const preview = name.trim() ? initialsFrom(name) : "W";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md p-6"
            style={{
              background: HERO_SURFACE,
              border: BORDER,
              borderRadius: RADIUS.modal,
              boxShadow: SHADOW.modal,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <span style={avatarChip(color, 36, 12)}>{preview}</span>
              <div>
                <h2
                  className="text-xl font-extrabold tracking-[-0.02em]"
                  style={{ color: T.bright }}
                >
                  New workspace
                </h2>
                <p className="text-[12px]" style={{ color: T.muted }}>
                  A separate space for a business — its own requests, members and treasury.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-5">
              <div>
                <label
                  htmlFor="workspace-name"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: T.soft }}
                >
                  Workspace name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  autoFocus
                  className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/40 outline-none focus:border-white/20"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="workspace-description"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: T.soft }}
                >
                  What it&apos;s for <span className="opacity-50 font-normal">(optional)</span>
                </label>
                <input
                  id="workspace-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Design retainers and invoices"
                  className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/40 outline-none focus:border-white/20"
                />
              </div>

              <div>
                <span className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                  Accent
                </span>
                <div className="flex items-center gap-2.5">
                  {WORKSPACE_ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Accent ${c}`}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        background: `${c}26`,
                        border: `1px solid ${color === c ? c : "rgba(255,255,255,0.1)"}`,
                        boxShadow: color === c ? `0 0 0 2px ${c}40` : "none",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          margin: "0 auto",
                          background: c,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Btn
                  variant="ghost"
                  className="flex-1"
                  style={{ justifyContent: "center" }}
                  onClick={handleClose}
                >
                  Cancel
                </Btn>
                <button
                  type="submit"
                  disabled={createWorkspace.isPending || !name.trim()}
                  className="flex-1 rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
                  style={{ background: A, color: "#0a0a0a" }}
                >
                  {createWorkspace.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Create workspace"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
