"use client";

import { Check, UserPlus, FilePlus2 } from "lucide-react";
import { A, Card, Eyebrow, G, T } from "@/lib/splito-design";
import { Row } from "@/components/shell/row";
import type { WorkspaceSummary } from "@/features/workspaces/api/client";

/**
 * The business dashboard's empty-state nudge (see app/page.tsx, business
 * landing = BusinessDashboard). A brand-new workspace otherwise lands on a
 * dashboard full of zeros with no pointer to what to do next.
 *
 * Only two items are checkable against real data: `WorkspaceSummarySchema`
 * (features/workspaces/api/client.ts) has no `description` field, so a
 * "set your workspace details" item can't be derived here without a new
 * fetch — see the PR notes for what was deliberately left out rather than
 * faked as always-complete.
 */
type ChecklistItem = {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
};

export function WorkspaceSetupChecklist({ summary }: { summary: WorkspaceSummary }) {
  const items: ChecklistItem[] = [
    {
      id: "invite",
      label: "Invite a teammate",
      hint: "Bring your team into the workspace",
      href: "/members",
      done: summary.workspace.memberCount > 1,
      icon: UserPlus,
    },
    {
      id: "first-request",
      label: "Create your first request",
      hint: "Send an invoice or a payment link",
      href: "/requests/new",
      done: summary.totals.requestCount > 0,
      icon: FilePlus2,
    },
  ];

  if (items.every((item) => item.done)) return null;

  return (
    <div className="mb-5">
      <Eyebrow color={T.soft}>Get set up</Eyebrow>
      <Card style={{ padding: 0, marginTop: 10 }}>
        {items.map((item, i) => {
          const ItemIcon = item.icon;
          return (
            <Row
              key={item.id}
              href={item.done ? undefined : item.href}
              noDivider={i === items.length - 1}
              leading={
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    background: item.done ? `${G}18` : `${A}18`,
                    border: `1px solid ${item.done ? `${G}38` : `${A}28`}`,
                  }}
                >
                  {item.done ? (
                    <Check size={14} strokeWidth={2.5} color={G} />
                  ) : (
                    <ItemIcon size={14} strokeWidth={1.75} color={A} />
                  )}
                </div>
              }
              title={
                <span style={item.done ? { textDecoration: "line-through", color: T.sub } : undefined}>
                  {item.label}
                </span>
              }
              meta={item.done ? "Done" : item.hint}
            />
          );
        })}
      </Card>
    </div>
  );
}
