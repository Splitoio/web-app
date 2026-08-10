"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useCreateInvoice } from "@/features/business/hooks/use-invoices";
import { useUploadFile } from "@/features/files/hooks/use-balances";

import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import CurrencyDropdown from "@/components/currency-dropdown";
import type { Currency } from "@/features/currencies/api/client";
import { T, A, BORDER } from "@/lib/splito-design";

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

export function AddInvoiceModal({ isOpen, onClose, organizationId }: AddInvoiceModalProps) {
  const createInvoiceMutation = useCreateInvoice();
  const uploadFileMutation = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    amount: "",
    currency: "USD",
    description: "",
    imageUrl: "" as string,
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileMutation.mutateAsync(file);
      const url = res.data?.downloadUrl ?? (res as { data?: { downloadUrl?: string } })?.data?.downloadUrl;
      if (url) setFormData((p) => ({ ...p, imageUrl: url }));
    } catch {
      toast.error("Failed to upload image");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    const dueDate = new Date().toISOString().split("T")[0];
    createInvoiceMutation.mutate(
      {
        organizationId,
        amount,
        currency: formData.currency,
        dueDate,
        description: formData.description || undefined,
        imageUrl: formData.imageUrl || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Invoice raised");
          setFormData({ amount: "", currency: "USD", description: "", imageUrl: "" });
          onClose();
        },
        onError: (err: { message?: string }) => {
          toast.error(err?.message || "Failed to raise invoice");
        },
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl"
            style={{
              background: "linear-gradient(145deg, #141414 0%, #0f0f0f 100%)",
              border: BORDER,
              boxShadow: "0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <h3 className="text-[18px] font-extrabold tracking-[-0.02em] mb-1" style={{ color: T.bright }}>
              Raise invoice
            </h3>
            <p className="text-[12px] mb-5" style={{ color: T.muted }}>
              Submit an invoice to your organization for approval.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.soft }}>
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                    className="w-full rounded-xl px-4 py-3 text-[14px] bg-white/[0.05] border border-white/[0.09] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.soft }}>
                    Currency
                  </label>
                  <CurrencyDropdown
                    selectedCurrencies={formData.currency ? [formData.currency] : []}
                    setSelectedCurrencies={(currencies) =>
                      setFormData((p) => ({ ...p, currency: currencies[0] || "USD" }))
                    }
                    mode="single"
                    showFiatCurrencies={true}
                    disableChainCurrencies={true}
                    filterCurrencies={(currency: Currency) =>
                      currency.symbol !== "ETH" && currency.symbol !== "USDC"
                    }
                    placeholder="Currency"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.soft }}>
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. October development work"
                  className="w-full rounded-xl px-4 py-3 text-[14px] bg-white/[0.05] border border-white/[0.09] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Receipt image */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.soft }}>
                  Receipt image <span style={{ color: T.dim, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-xl overflow-hidden flex items-center justify-center transition-colors hover:border-white/20"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px dashed rgba(255,255,255,0.15)",
                    }}
                  >
                    {formData.imageUrl ? (
                      <span className="relative block w-full h-full">
                        <Image src={formData.imageUrl} alt="Receipt" fill className="object-cover" sizes="80px" />
                      </span>
                    ) : uploadFileMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: T.dim }} />
                    ) : (
                      <Camera className="h-6 w-6" style={{ color: T.dim }} />
                    )}
                  </button>
                  {formData.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, imageUrl: "" }))}
                      className="p-1.5 rounded-lg border transition-colors hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: T.muted }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-12 rounded-xl border font-semibold text-[13px] transition-all hover:bg-white/5"
                  style={{ borderColor: "rgba(255,255,255,0.1)", color: T.body }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending}
                  className="flex-1 h-12 rounded-xl font-bold text-[13px] transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: A, color: "#0a0a0a" }}
                >
                  {createInvoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Raise invoice"
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
