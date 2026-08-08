"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  AlertTriangle,
  Check,
  ClipboardPaste,
} from "lucide-react";
import { Card, T, A, R, BORDER } from "@/lib/splito-design";
import { useParseExpenses } from "@/features/expenses/hooks/use-parse-expenses";
import { useCreateExpense } from "@/features/expenses/hooks/use-create-expense";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import type { ParsedExpenseItem, ParseNoteItem, InferredDate } from "@/features/expenses/api/client";
import {
  EXPENSE_CATEGORIES as CATEGORIES,
  getCategoryEmoji,
} from "@/lib/expense-categories";

/**
 * Resolves a partial inferred date into a full YYYY-MM-DD string.
 *
 * Strategy: fill missing parts as recently as possible without exceeding today.
 * - All null → today
 * - Only year → Dec 31 of that year (clamped to today)
 * - Year + month → last day of that month (clamped to today)
 * - Year + month + day → that date (clamped to today)
 * - Month + day, no year → most recent past occurrence
 * - Only month → current year, last day of that month (clamped)
 * - Only day → most recent past occurrence of that day
 */
function resolveInferredDate(inf: InferredDate): string {
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();

  let y = inf.year;
  let m = inf.month;
  let d = inf.day;

  if (y == null && m == null && d == null) {
    return fmt(ty, tm, td);
  }

  if (y == null) {
    y = ty;
    // If we have month (and optionally day), check if it's in the future this year
    if (m != null) {
      const testDay = d ?? 1;
      if (m > tm || (m === tm && testDay > td)) {
        y = ty - 1;
      }
    } else if (d != null) {
      // only day given: most recent occurrence of that day
      m = d > td ? (tm === 1 ? 12 : tm - 1) : tm;
      if (d > td && tm === 1) y = ty - 1;
    }
  }

  if (m == null) {
    if (y === ty) {
      m = tm;
    } else if (y < ty) {
      m = 12;
    } else {
      m = 1;
    }
  }

  if (d == null) {
    if (y === ty && m === tm) {
      d = td;
    } else {
      // last day of month
      d = new Date(y, m, 0).getDate();
    }
  }

  // Clamp day to valid range for the month
  const maxDay = new Date(y, m, 0).getDate();
  d = Math.min(d, maxDay);

  // Clamp to today
  const result = new Date(y, m - 1, d);
  if (result > today) {
    return fmt(ty, tm, td);
  }

  return fmt(y, m, d);
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface EditableExpense extends ParsedExpenseItem {
  _id: string;
  resolvedDate: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

type Phase = "paste" | "review" | "importing" | "done";

export default function ImportExpensesModal({
  isOpen,
  onClose,
  organizationId,
}: Props) {
  const { user } = useAuthStore();
  const parseMutation = useParseExpenses();
  const createExpenseMutation = useCreateExpense(organizationId);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const storageKey = `import-expenses-${organizationId}`;
  const [rawText, setRawText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey) ?? "";
  });
  const [phase, setPhase] = useState<Phase>("paste");
  const [expenses, setExpenses] = useState<EditableExpense[]>([]);
  const [notes, setNotes] = useState<ParseNoteItem[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, rawText);
    }
  }, [rawText, storageKey]);

  const reset = useCallback(() => {
    setPhase("paste");
    setExpenses([]);
    setNotes([]);
    setImportProgress({ done: 0, total: 0 });
    setImportResults({ success: 0, failed: 0 });
    setEditingId(null);
  }, []);

  const handleClose = () => {
    if (phase === "importing") return;
    onClose();
    if (phase === "done") {
      setRawText("");
      reset();
    }
  };

  const handleParse = async () => {
    if (!rawText.trim()) return;
    try {
      const result = await parseMutation.mutateAsync(rawText);
      setExpenses(
        result.expenses.map((e, i) => ({
          ...e,
          _id: `exp-${i}-${Date.now()}`,
          resolvedDate: resolveInferredDate(e.inferredDate),
        }))
      );
      setNotes(result.notes);
      setPhase("review");
    } catch {
      toast.error("Failed to parse expenses. Try again.");
    }
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e._id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateExpense = (id: string, field: keyof ParsedExpenseItem | "resolvedDate", value: string | number | InferredDate) => {
    setExpenses((prev) =>
      prev.map((e) => (e._id === id ? { ...e, [field]: value } : e))
    );
  };

  const promoteNote = (index: number) => {
    const note = notes[index];
    setNotes((prev) => prev.filter((_, i) => i !== index));
    const newId = `promoted-${Date.now()}-${index}`;
    setExpenses((prev) => [
      ...prev,
      {
        _id: newId,
        amount: 0,
        currency: "USD",
        vendor: "",
        category: "Other",
        originalText: note.originalText,
        inferredDate: { year: null, month: null, day: null },
        resolvedDate: resolveInferredDate({ year: null, month: null, day: null }),
      },
    ]);
    setEditingId(newId);
  };

  const handleImport = async () => {
    if (!user?.id || expenses.length === 0) return;
    setPhase("importing");
    setImportProgress({ done: 0, total: expenses.length });
    let success = 0;
    let failed = 0;

    for (const expense of expenses) {
      try {
        await createExpenseMutation.mutateAsync({
          name: expense.vendor || expense.originalText,
          category: expense.category,
          amount: expense.amount,
          splitType: "EXACT",
          currency: expense.currency,
          currencyType: "FIAT",
          timeLockIn: false,
          participants: [{ userId: user.id, amount: expense.amount }],
          paidBy: user.id,
          expenseDate: expense.resolvedDate,
        });
        success++;
      } catch {
        failed++;
      }
      setImportProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setImportResults({ success, failed });
    setPhase("done");
    if (success > 0) toast.success(`Imported ${success} expense${success > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} expense${failed > 1 ? "s" : ""} failed to import`);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl"
            style={{
              background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
              border: BORDER,
              boxShadow: "0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex-shrink-0 px-6 pt-6 pb-4">
              <div className="sm:hidden flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: T.bright }}>
                  <ClipboardPaste className="inline h-5 w-5 mr-2 -mt-0.5" style={{ color: A }} />
                  Import Expenses
                </h3>
                <button
                  onClick={handleClose}
                  disabled={phase === "importing"}
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  <X className="h-4 w-4" style={{ color: T.muted }} />
                </button>
              </div>
              <p className="text-[12px]" style={{ color: T.muted }}>
                {phase === "paste" && "Paste your expense data — any format works. AI will parse it."}
                {phase === "review" && `${expenses.length} expense${expenses.length !== 1 ? "s" : ""} parsed. Tap a row to edit.`}
                {phase === "importing" && "Importing expenses..."}
                {phase === "done" && "Import complete."}
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
              {/* Phase: Paste */}
              {phase === "paste" && (
                <div className="space-y-4">
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Paste your expenses in any format, e.g.:\n$50 to AWS\nOffice supplies - 120 EUR\nPaid 500 for marketing\nTeam lunch 3200 INR`}
                    rows={8}
                    className="w-full rounded-xl px-4 py-3 text-[13px] font-mono bg-white/[0.05] border border-white/[0.09] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors resize-y min-h-[160px]"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 h-12 rounded-xl border font-semibold text-[13px] transition-all hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: T.body }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={!rawText.trim() || parseMutation.isPending}
                      className="flex-1 h-12 rounded-xl font-bold text-[13px] transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: A, color: "#0a0a0a" }}
                    >
                      {parseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Parse with AI
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Phase: Review */}
              {phase === "review" && (
                <div className="space-y-4">
                  {/* Parsed expenses — compact list inside a Card */}
                  {expenses.length > 0 && (
                    <Card className="p-0 overflow-hidden">
                      {expenses.map((exp, idx) => {
                        const isEditing = editingId === exp._id;
                        return (
                          <div key={exp._id}>
                            {/* Compact display row */}
                            <div
                              className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] last:border-b-0 transition-colors cursor-pointer ${
                                isEditing ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                              }`}
                              onClick={() => setEditingId(isEditing ? null : exp._id)}
                            >
                              {/* Category emoji */}
                              <div
                                className="flex-shrink-0 flex items-center justify-center"
                                style={{
                                  width: 36, height: 36, borderRadius: 10,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                  fontSize: 16,
                                }}
                              >
                                {getCategoryEmoji(exp.category)}
                              </div>

                              {/* Vendor + date + original text */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold truncate" style={{ color: T.bright }}>
                                  {exp.vendor || <span style={{ color: T.dim }}>No vendor</span>}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: T.dim }}>
                                  {new Date(exp.resolvedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {" · "}
                                  {exp.originalText}
                                </p>
                              </div>

                              {/* Amount + currency */}
                              <div className="flex-shrink-0 text-right">
                                <p className="text-[14px] font-bold font-mono" style={{ color: R }}>
                                  {exp.amount.toLocaleString()} {exp.currency}
                                </p>
                              </div>

                              {/* Remove */}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeExpense(exp._id); }}
                                className="flex-shrink-0 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                                style={{ color: "rgba(248,113,113,0.6)" }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Expanded edit row */}
                            <AnimatePresence>
                              {isEditing && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className="px-4 py-3 space-y-2.5 border-b border-white/[0.06]"
                                    style={{ background: "rgba(255,255,255,0.02)" }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Row 1: vendor */}
                                    <input
                                      type="text"
                                      value={exp.vendor}
                                      onChange={(e) => updateExpense(exp._id, "vendor", e.target.value)}
                                      placeholder="Vendor name"
                                      className="w-full rounded-lg px-3 py-2 text-[13px] bg-white/[0.05] border border-white/[0.09] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
                                    />
                                    {/* Row 2: amount + currency */}
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={exp.amount || ""}
                                        onChange={(e) =>
                                          updateExpense(exp._id, "amount", parseFloat(e.target.value) || 0)
                                        }
                                        placeholder="Amount"
                                        className="flex-1 rounded-lg px-3 py-2 text-[13px] font-mono bg-white/[0.05] border border-white/[0.09] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
                                      />
                                      <input
                                        type="text"
                                        value={exp.currency}
                                        onChange={(e) => updateExpense(exp._id, "currency", e.target.value.toUpperCase())}
                                        className="w-16 rounded-lg px-3 py-2 text-[13px] font-mono text-center bg-white/[0.05] border border-white/[0.09] text-white outline-none focus:border-white/20 transition-colors uppercase"
                                        maxLength={4}
                                      />
                                    </div>
                                    {/* Row 3: date */}
                                    <input
                                      type="date"
                                      value={exp.resolvedDate}
                                      onChange={(e) => updateExpense(exp._id, "resolvedDate", e.target.value)}
                                      className="w-full rounded-lg px-3 py-2 text-[13px] bg-white/[0.05] border border-white/[0.09] text-white outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
                                    />
                                    {/* Row 4: category pills */}
                                    <div className="flex flex-wrap gap-1.5">
                                      {CATEGORIES.map((cat) => (
                                        <button
                                          key={cat.label}
                                          type="button"
                                          onClick={() => updateExpense(exp._id, "category", cat.label)}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                                          style={
                                            exp.category === cat.label
                                              ? { background: `${A}18`, color: A, borderColor: `${A}30` }
                                              : { background: "transparent", color: T.muted, borderColor: "rgba(255,255,255,0.07)" }
                                          }
                                        >
                                          <span className="text-[12px]">{cat.emoji}</span>
                                          {cat.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </Card>
                  )}

                  {expenses.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-[14px] font-semibold" style={{ color: T.body }}>
                        No expenses could be parsed
                      </p>
                      <p className="text-[12px] mt-1" style={{ color: T.muted }}>
                        Check the notes below, or go back and adjust your input.
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {notes.length > 0 && (
                    <div>
                      <button
                        onClick={() => setNotesOpen(!notesOpen)}
                        className="flex items-center gap-1.5 w-full text-left text-[11px] font-bold uppercase tracking-wider py-2"
                        style={{ color: "#fbbf24" }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Skipped ({notes.length})
                        {notesOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                      </button>
                      <AnimatePresence>
                        {notesOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1">
                              {notes.map((note, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-yellow-500/15 bg-yellow-500/[0.04] px-3 py-2 flex items-center gap-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] truncate" style={{ color: T.body }}>
                                      {note.originalText}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: T.dim }}>
                                      {note.suggestion}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => promoteNote(i)}
                                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                    title="Add as expense"
                                  >
                                    <Plus className="h-3 w-3" style={{ color: A }} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={reset}
                      className="h-12 px-5 rounded-xl border font-semibold text-[13px] transition-all hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: T.body }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={expenses.length === 0}
                      className="flex-1 h-12 rounded-xl font-bold text-[13px] transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: A, color: "#0a0a0a" }}
                    >
                      Import {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}

              {/* Phase: Importing */}
              {phase === "importing" && (
                <div className="flex flex-col items-center py-10 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: A }} />
                  <p className="text-[14px] font-semibold" style={{ color: T.body }}>
                    Importing expenses... {importProgress.done}/{importProgress.total}
                  </p>
                  <div className="w-full max-w-xs h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        background: A,
                        width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Phase: Done */}
              {phase === "done" && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center"
                    style={{ background: `${A}20` }}
                  >
                    <Check className="h-6 w-6" style={{ color: A }} />
                  </div>
                  <p className="text-[16px] font-bold" style={{ color: T.bright }}>
                    Import complete
                  </p>
                  <p className="text-[13px]" style={{ color: T.muted }}>
                    {importResults.success} imported
                    {importResults.failed > 0 && `, ${importResults.failed} failed`}
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-4 h-11 px-8 rounded-xl font-bold text-[13px] transition-all hover:opacity-90"
                    style={{ background: A, color: "#0a0a0a" }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
