/**
 * Single source of truth for expense categories on the frontend.
 * Mirror the label list in `backend/src/constants/expense-categories.ts`.
 */

import { Briefcase, Code, Monitor, Plane, Megaphone, Building2, Wallet, Receipt } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const EXPENSE_CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: "Business", icon: Briefcase },
  { label: "Software", icon: Code },
  { label: "Hardware", icon: Monitor },
  { label: "Travel", icon: Plane },
  { label: "Marketing", icon: Megaphone },
  { label: "Office", icon: Building2 },
  { label: "Salary", icon: Wallet },
  { label: "Other", icon: Receipt },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["label"];

export const EXPENSE_CATEGORY_LABELS: ExpenseCategory[] =
  EXPENSE_CATEGORIES.map((c) => c.label);

const ICON_BY_LABEL: Record<string, LucideIcon> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.label.toUpperCase(), c.icon])
);

export function getCategoryIcon(category: string | undefined | null): LucideIcon {
  if (!category) return Receipt;
  return ICON_BY_LABEL[category.toUpperCase()] ?? Receipt;
}
