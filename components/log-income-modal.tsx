"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import CurrencyDropdown from "@/components/currency-dropdown";
import type { Currency } from "@/features/currencies/api/client";
import { useCreateStream } from "@/features/business/hooks/use-streams";
import { A, T, Btn, RADIUS, SHADOW, HERO_SURFACE, BORDER } from "@/lib/splito-design";

/**
 * "Log income received" — the create half of the treasury income-stream flow
 * (design 1218, `.abtn` "Log income"). Edit/delete live on the legacy
 * `/organization/[id]` layout for now; this is scoped to the create action
 * the Treasury screen exposes.
 */
export function LogIncomeModal({
  isOpen,
  onClose,
  organizationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const createStreamMutation = useCreateStream();
  const [form, setForm] = useState({
    name: "",
    currency: "USD",
    amount: "" as string | number,
    description: "",
    receivedDate: new Date().toISOString().slice(0, 10),
  });

  const reset = () =>
    setForm({ name: "", currency: "USD", amount: "", description: "", receivedDate: new Date().toISOString().slice(0, 10) });

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = form.amount === "" ? NaN : Number(form.amount);
    if (!form.name.trim() || !Number.isFinite(amountNum) || amountNum < 0) {
      toast.error("Enter a source and a valid amount");
      return;
    }
    createStreamMutation.mutate(
      {
        organizationId,
        payload: {
          name: form.name.trim(),
          currency: form.currency,
          amount: amountNum,
          description: form.description.trim() || null,
          receivedDate: form.receivedDate,
        },
      },
      {
        onSuccess: () => {
          toast.success("Income logged");
          handleClose();
        },
        onError: () => toast.error("Failed to log income"),
      }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md p-6"
            style={{ background: HERO_SURFACE, border: BORDER, borderRadius: RADIUS.modal, boxShadow: SHADOW.modal }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-1" style={{ color: T.bright }}>
              Log income received
            </h2>
            <p className="text-[12px] mb-5" style={{ color: T.muted }}>
              Record money you actually received — this fills your treasury.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                  Source / From
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Client A, Stripe payout"
                  className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/40 outline-none focus:border-white/20"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                    Amount received
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/40 outline-none focus:border-white/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                    Currency
                  </label>
                  <CurrencyDropdown
                    selectedCurrencies={form.currency ? [form.currency] : []}
                    setSelectedCurrencies={(currencies) => setForm((p) => ({ ...p, currency: currencies[0] || "USD" }))}
                    mode="single"
                    showFiatCurrencies={true}
                    filterCurrencies={(c: Currency) => c.symbol !== "ETH" && c.symbol !== "USDC"}
                    disableChainCurrencies={true}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                  Note <span className="opacity-50 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Q1 retainer"
                  className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/40 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: T.soft }}>
                  Received on
                </label>
                <input
                  type="date"
                  value={form.receivedDate}
                  onChange={(e) => setForm((p) => ({ ...p, receivedDate: e.target.value }))}
                  className="w-full rounded-xl px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] text-white outline-none focus:border-white/20 [color-scheme:dark]"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Btn variant="ghost" className="flex-1" onClick={handleClose}>
                  Cancel
                </Btn>
                <button
                  type="submit"
                  disabled={createStreamMutation.isPending}
                  className="flex-1 rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
                  style={{ background: A, color: "#0a0a0a" }}
                >
                  {createStreamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Log income"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
