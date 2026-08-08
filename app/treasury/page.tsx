"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useActiveWorkspace, useIsResolvingWorkspace } from "@/contexts/workspace";
import { BusinessOnly, WorkspaceResolving } from "@/components/shell/business-only";
import { useGetStreamsByOrganization } from "@/features/business/hooks/use-streams";
import { useWorkspaceTreasury } from "@/features/workspaces/hooks/use-workspace-summary";
import { formatCurrency } from "@/utils/formatters";
import { LogIncomeModal } from "@/components/log-income-modal";
import { Row } from "@/components/shell/row";
import { Card, HeroCard, Eyebrow, Btn, Icons, T, TYPE, getUserColor } from "@/lib/splito-design";

/** "Received 1 Aug" — the trailing date on a stream row (design line 1229). */
function formatReceivedDate(date: Date): string {
  return `Received ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/**
 * Treasury (design 1208–1234, `isTreasury`): the hero "Received" total plus the
 * income-stream list, business workspaces only. Data comes from the same
 * income-stream endpoints the legacy `/organization/[id]` layout uses
 * (features/business/hooks/use-streams.ts, `/api/groups/:id/streams`) — the
 * hero total instead reads `workspaces/:id/summary`'s `treasury` field so it
 * always agrees with the dashboard rather than being summed here separately.
 */
export default function TreasuryPage() {
  const workspace = useActiveWorkspace();
  const isResolving = useIsResolvingWorkspace();
  const isBusiness = workspace.kind === "business";
  const [isLogIncomeOpen, setIsLogIncomeOpen] = useState(false);

  const {
    data: streams,
    isLoading: streamsLoading,
    isError: streamsError,
  } = useGetStreamsByOrganization(workspace.id, { enabled: isBusiness });
  const {
    data: treasury,
    isLoading: treasuryLoading,
    isError: treasuryError,
  } = useWorkspaceTreasury(workspace.id, { enabled: isBusiness });

  if (isResolving) return <WorkspaceResolving />;

  if (!isBusiness) {
    return (
      <BusinessOnly
        screen="Treasury"
        blurb="Income streams are logged against a business, not a personal account."
      />
    );
  }

  const streamCount = treasury?.streamCount ?? streams?.length ?? 0;

  return (
    <div className="fade-up p-4 lg:p-0" style={{ maxWidth: 840 }}>
      <HeroCard style={{ padding: 24, marginBottom: 18 }}>
        <Eyebrow>Received</Eyebrow>
        {treasuryLoading ? (
          <div style={{ margin: "10px 0 5px" }}>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.muted }} />
          </div>
        ) : (
          <p style={{ margin: "8px 0 5px", color: T.white, lineHeight: 1, ...TYPE.hero }}>
            {treasuryError ? "—" : formatCurrency(treasury?.streamsTotal ?? 0, treasury?.currency ?? "USD")}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 12.5, color: T.sub }}>
          {treasuryError
            ? "Couldn't load your total right now"
            : streamCount === 0
              ? "Nothing logged yet"
              : `${streamCount} income ${streamCount === 1 ? "entry" : "entries"} logged`}
        </p>
      </HeroCard>

      <div className="flex items-center gap-2.5" style={{ marginBottom: 12 }}>
        <Eyebrow color={T.soft}>Income</Eyebrow>
        <div style={{ flex: 1 }} />
        <Btn variant="ghost" onClick={() => setIsLogIncomeOpen(true)}>
          {Icons.plus({ size: 14 })} Log income
        </Btn>
      </div>

      <Card style={{ padding: 0 }}>
        {streamsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.muted }} />
          </div>
        ) : streamsError ? (
          <div style={{ padding: "36px 22px", textAlign: "center" }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: T.bright, margin: 0 }}>
              Couldn&apos;t load your income streams
            </p>
          </div>
        ) : !streams || streams.length === 0 ? (
          <div style={{ padding: "36px 22px", textAlign: "center" }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: T.bright, margin: 0 }}>
              Nothing logged yet
            </p>
            <p style={{ fontSize: 12, color: T.sub, margin: "6px 0 0" }}>
              Every payment you log here fills the total above.
            </p>
          </div>
        ) : (
          streams.map((stream, i) => (
            <Row
              key={stream.id}
              noDivider={i === streams.length - 1}
              leading={
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: getUserColor(stream.name),
                  }}
                />
              }
              title={stream.name}
              meta={stream.description || undefined}
              trailing={
                <div className="flex items-center" style={{ gap: 14 }}>
                  <span style={{ ...TYPE.rowAmount, color: T.main }}>
                    {formatCurrency(stream.amount, stream.currency)}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: T.dim, width: 96, textAlign: "right" }}>
                    {formatReceivedDate(new Date(stream.receivedDate))}
                  </span>
                </div>
              }
            />
          ))
        )}
      </Card>

      <LogIncomeModal
        isOpen={isLogIncomeOpen}
        onClose={() => setIsLogIncomeOpen(false)}
        organizationId={workspace.id}
      />
    </div>
  );
}
