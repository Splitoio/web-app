"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAcceptInvite, useLookupInvite } from "@/features/business/hooks/use-invites";
import { useGetUser } from "@/features/user/hooks/use-update-profile";
import { useSetActiveWorkspace } from "@/contexts/workspace";
import {
  A,
  BG,
  BORDER,
  G,
  HERO_SURFACE,
  R,
  RADIUS,
  SHADOW,
  T,
  avatarChip,
  initialsFrom,
} from "@/lib/splito-design";

/**
 * `/invite/[token]` — the one landing page for a business-workspace invite.
 *
 * It is PUBLIC (lib/middleware-session.ts) because the whole point is that a
 * visitor with no account can see WHICH workspace invited WHICH email before
 * deciding to sign up: `GET /api/invites/lookup` needs no session and seats
 * nobody. Accepting (`POST /api/invites/accept`) is the only call that creates
 * a membership, and it requires a session whose email matches an email invite.
 *
 * Every rejection the backend can return is rendered as a sentence here rather
 * than a bare status code:
 *   403 + invitedEmail → signed in as the wrong account
 *   404               → expired, revoked, or an unknown token
 *   409               → already used
 */

const ROLE_LABEL: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

type ApiFailure = { code?: number; message?: string; data?: { invitedEmail?: string } };

function failure(e: unknown): ApiFailure {
  return (e ?? {}) as ApiFailure;
}

function messageOf(e: unknown, fallback: string): string {
  const m = failure(e).message;
  if (typeof m === "string" && m.trim()) return m;
  return fallback;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const router = useRouter();
  const setActiveWorkspace = useSetActiveWorkspace();

  const { data: invite, isPending: lookupPending, error: lookupError } = useLookupInvite(token);
  // Same query key as AuthProvider's, so this shares one request rather than
  // adding a second /users/me. A 401 here just means "anonymous visitor" —
  // /invite is a public route, so it does not bounce to /login.
  const { data: user, isPending: userPending } = useGetUser();
  const accept = useAcceptInvite();
  const [acceptError, setAcceptError] = useState<ApiFailure | null>(null);

  const nextUrl = `/invite/${encodeURIComponent(token)}`;

  const handleAccept = () => {
    setAcceptError(null);
    accept.mutate(token, {
      onSuccess: (result) => {
        toast.success(
          result.alreadyMember
            ? `You're already in ${result.organizationName}`
            : `Welcome to ${result.organizationName}`
        );
        setActiveWorkspace(result.organizationId);
        router.replace("/");
      },
      onError: (err: unknown) => setAcceptError(failure(err)),
    });
  };

  if (lookupPending) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.muted }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: T.body }}>Checking your invite…</p>
        </div>
      </Shell>
    );
  }

  // An unknown token is indistinguishable from a deleted one on purpose — the
  // lookup endpoint 404s both, so there is nothing to probe.
  if (lookupError || !invite) {
    return (
      <Shell>
        <Headline>This invite link isn&apos;t valid</Headline>
        <Body>
          {messageOf(lookupError, "It may have been revoked, or the link was copied incompletely.")}{" "}
          Ask whoever invited you to send a new one.
        </Body>
        <Actions>
          <GhostLink href="/">Go to Splito</GhostLink>
        </Actions>
      </Shell>
    );
  }

  const orgName = invite.organization.name;
  const accent = invite.organization.color || A;
  const roleLabel = ROLE_LABEL[invite.role] ?? invite.role;

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <span style={avatarChip(accent, 40, 13)}>{initialsFrom(orgName)}</span>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.soft }}>
          Invitation
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: T.bright }}>
          {orgName}
        </p>
      </div>
    </div>
  );

  // Revoked / expired / already used — the lookup already knows, so say it
  // before asking anyone to sign in for a link that cannot work.
  if (!invite.acceptable) {
    const reason =
      invite.status === "REVOKED"
        ? "This invite was revoked."
        : invite.status === "ACCEPTED"
          ? "This invite has already been used."
          : "This invite has expired.";
    return (
      <Shell>
        {header}
        <Headline>{reason}</Headline>
        <Body>
          {invite.status === "ACCEPTED"
            ? `If that was you, sign in and ${orgName} will be in your workspace switcher.`
            : `Ask ${invite.invitedByName ?? "whoever invited you"} to send a fresh invite to ${orgName}.`}
        </Body>
        <Actions>
          <PrimaryLink href={`/login?callbackUrl=${encodeURIComponent(nextUrl)}`}>Sign in</PrimaryLink>
          <GhostLink href="/">Go to Splito</GhostLink>
        </Actions>
      </Shell>
    );
  }

  if (userPending) {
    return (
      <Shell>
        {header}
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
          <p style={{ margin: 0, fontSize: 13.5, color: T.body }}>One moment…</p>
        </div>
      </Shell>
    );
  }

  // ── Signed out ────────────────────────────────────────────────────────────
  // Sign-up is prefilled with the invited email and named with the workspace,
  // so the visitor knows what they are joining before creating an account. An
  // email invite can ONLY be accepted by that address, so the field is fixed.
  if (!user) {
    const signupHref = invite.email
      ? `/signup?email=${encodeURIComponent(invite.email)}&callbackUrl=${encodeURIComponent(nextUrl)}`
      : `/signup?callbackUrl=${encodeURIComponent(nextUrl)}`;
    const loginHref = invite.email
      ? `/login?email=${encodeURIComponent(invite.email)}&callbackUrl=${encodeURIComponent(nextUrl)}`
      : `/login?callbackUrl=${encodeURIComponent(nextUrl)}`;

    return (
      <Shell>
        {header}
        <Headline>
          {invite.invitedByName ? `${invite.invitedByName} invited you` : "You've been invited"} to join{" "}
          {orgName}
        </Headline>
        <Body>
          {invite.email ? (
            <>
              The invite was sent to <Strong>{invite.email}</Strong>. Create your account with that
              email — or sign in if you already have one — and you&apos;ll join as {roleLabel}.
            </>
          ) : (
            <>Create an account or sign in, and you&apos;ll join {orgName} as {roleLabel}.</>
          )}
        </Body>
        <Actions>
          <PrimaryLink href={signupHref}>Create account</PrimaryLink>
          <GhostLink href={loginHref}>I already have an account</GhostLink>
        </Actions>
      </Shell>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  // The backend is the authority on whether THIS account may accept, and it
  // still gets the last word (403 + invitedEmail). But the lookup already
  // returned the ADDRESSED email, so the page can be truthful BEFORE anyone
  // clicks: promising "you'll join with <your email>" when the invite names
  // someone else is a lie the accept call then has to correct.
  const invitedEmail = acceptError?.data?.invitedEmail ?? invite.email;
  // Mirrors checkInviteAcceptable() in backend/src/services/organization/
  // invite.service.ts exactly — normalizeEmail() is trim + lowercase, and a
  // link invite (email === null) is acceptable by whoever holds the token. So
  // this pre-empts the 403 rather than guessing at it.
  const emailMismatch =
    !!invitedEmail &&
    invitedEmail.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase();
  const wrongAccount = acceptError?.code === 403 || emailMismatch;

  return (
    <Shell>
      {header}
      <Headline>Join {orgName}</Headline>
      <Body>
        {invitedEmail ? (
          <>
            This invite was sent to <Strong>{invitedEmail}</Strong> — it joins as{" "}
            <Strong>{roleLabel}</Strong>.
          </>
        ) : (
          <>
            You&apos;ll join as <Strong>{roleLabel}</Strong>
            {user.email ? (
              <>
                {" "}
                with <Strong>{user.email}</Strong>
              </>
            ) : null}
            .
          </>
        )}
      </Body>

      {emailMismatch && !acceptError && (
        <div
          style={{
            margin: "14px 0 0",
            padding: "13px 15px",
            borderRadius: 14,
            background: "rgba(248,113,113,0.07)",
            border: "1px solid rgba(248,113,113,0.24)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: R }}>
            You&apos;re signed in as <Strong>{user.email ?? "another account"}</Strong>, so this
            invite can&apos;t be accepted from here. Sign in with the invited address to accept it.
          </p>
        </div>
      )}

      {acceptError && (
        <div
          style={{
            margin: "14px 0 0",
            padding: "13px 15px",
            borderRadius: 14,
            background: "rgba(248,113,113,0.07)",
            border: "1px solid rgba(248,113,113,0.24)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: R }}>
            {wrongAccount && invitedEmail ? (
              <>
                This invite was sent to <Strong>{invitedEmail}</Strong>, and you&apos;re signed in as{" "}
                <Strong>{user.email ?? "another account"}</Strong>. Sign in with the invited address
                to accept it.
              </>
            ) : acceptError.code === 409 ? (
              <>This invite has already been used.</>
            ) : acceptError.code === 404 ? (
              <>{messageOf(acceptError, "This invite is no longer valid.")}</>
            ) : (
              <>{messageOf(acceptError, "Couldn't accept this invite.")}</>
            )}
          </p>
        </div>
      )}

      <Actions>
        {wrongAccount ? (
          <PrimaryLink
            href={
              invitedEmail
                ? `/login?email=${encodeURIComponent(invitedEmail)}&callbackUrl=${encodeURIComponent(nextUrl)}`
                : `/login?callbackUrl=${encodeURIComponent(nextUrl)}`
            }
          >
            Sign in as {invitedEmail ?? "another account"}
          </PrimaryLink>
        ) : (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accept.isPending}
            className="btn"
            style={{
              borderRadius: 12,
              padding: "11px 22px",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: accept.isPending ? "default" : "pointer",
              background: A,
              color: "#0a0a0a",
              border: "none",
              opacity: accept.isPending ? 0.7 : 1,
            }}
          >
            {accept.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ display: "inline" }} />
            ) : (
              `Join ${orgName}`
            )}
          </button>
        )}
        <GhostLink href="/">Not now</GhostLink>
      </Actions>

      {invite.contractId && (
        <p style={{ margin: "16px 0 0", fontSize: 11.5, lineHeight: 1.55, color: G }}>
          There&apos;s a contract attached to this invite — you&apos;ll be asked to sign it.
        </p>
      )}
    </Shell>
  );
}

// ─── Layout primitives (local: this page renders outside the app shell) ──────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BG }}>
      <div
        className="w-full max-w-md p-7"
        style={{
          background: HERO_SURFACE,
          border: BORDER,
          borderRadius: RADIUS.modal,
          boxShadow: SHADOW.modal,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.35, color: T.bright }}>
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: T.body }}>{children}</p>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: T.bright, fontWeight: 700 }}>{children}</strong>;
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 mt-6">{children}</div>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn"
      style={{
        borderRadius: 12,
        padding: "11px 22px",
        fontSize: 13.5,
        fontWeight: 800,
        background: A,
        color: "#0a0a0a",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="abtn"
      style={{
        borderRadius: 12,
        padding: "11px 18px",
        fontSize: 13,
        fontWeight: 700,
        color: T.muted,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
