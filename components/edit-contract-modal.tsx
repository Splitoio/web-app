"use client";

import { useState, useEffect } from "react";
import { useUpdateContract } from "@/features/business/hooks/use-contracts";
import { Loader2, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn } from "@/utils/animations";
import CurrencyDropdown from "@/components/currency-dropdown";
import type { Currency } from "@/features/currencies/api/client";
import type { Contract } from "@/features/business/api/client";
import { cn } from "@/lib/utils";

interface EditContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, label: "General Info" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Dates" },
  { id: 4, label: "Extras" },
];

const FREQUENCIES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "ONE_TIME", label: "One-time" },
];

type Frequency = "MONTHLY" | "WEEKLY" | "ONE_TIME";

interface FormData {
  assignedToEmail: string;
  title: string;
  jobTitle: string;
  scopeOfWork: string;
  compensationAmount: string;
  compensationCurrency: string;
  paymentFrequency: Frequency;
  startDate: string;
  endDate: string;
  noticePeriodDays: string;
  specialClause: string;
  description: string;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0];
}

export function EditContractModal({ isOpen, onClose, contract, onSuccess }: EditContractModalProps) {
  const updateContractMutation = useUpdateContract();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    assignedToEmail: "",
    title: "",
    jobTitle: "",
    scopeOfWork: "",
    compensationAmount: "",
    compensationCurrency: "USD",
    paymentFrequency: "MONTHLY",
    startDate: "",
    endDate: "",
    noticePeriodDays: "",
    specialClause: "",
    description: "",
  });

  useEffect(() => {
    if (contract && isOpen) {
      setStep(1);
      setForm({
        assignedToEmail: contract.assignedToEmail ?? "",
        title: contract.title ?? "",
        jobTitle: contract.jobTitle ?? "",
        scopeOfWork: contract.scopeOfWork ?? "",
        compensationAmount: contract.compensationAmount != null ? String(contract.compensationAmount) : "",
        compensationCurrency: contract.compensationCurrency ?? "USD",
        paymentFrequency: (contract.paymentFrequency as Frequency) ?? "MONTHLY",
        startDate: toDateInput(contract.startDate),
        endDate: toDateInput(contract.endDate),
        noticePeriodDays: contract.noticePeriodDays != null ? String(contract.noticePeriodDays) : "",
        specialClause: contract.specialClause ?? "",
        description: contract.description ?? "",
      });
    }
  }, [contract, isOpen]);

  const set = (field: keyof FormData, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!form.title.trim()) { toast.error("Contract name is required"); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const handleSubmit = () => {
    if (!contract) return;
    const amount = form.compensationAmount ? parseFloat(form.compensationAmount) : undefined;
    updateContractMutation.mutate(
      {
        contractId: contract.id,
        assignedToEmail: form.assignedToEmail.trim() || undefined,
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        compensationAmount: amount,
        compensationCurrency: form.compensationCurrency || undefined,
        jobTitle: form.jobTitle.trim() || null,
        scopeOfWork: form.scopeOfWork.trim() || null,
        paymentFrequency: form.paymentFrequency || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        noticePeriodDays: form.noticePeriodDays ? parseInt(form.noticePeriodDays) : null,
        specialClause: form.specialClause.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Contract updated");
          onClose();
          onSuccess?.();
        },
        onError: (err: { message?: string }) => {
          toast.error(err?.message || "Failed to update contract");
        },
      }
    );
  };

  if (!isOpen || !contract) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" {...fadeIn}>
        <div className="fixed inset-0 bg-black/70" onClick={onClose} />
        <div
          className="relative z-10 bg-[#0D0D0F] rounded-2xl w-full max-w-lg border border-white/10 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Edit contract</h2>
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                        s.id < step
                          ? "bg-white text-black"
                          : s.id === step
                          ? "bg-white text-black ring-2 ring-white/30"
                          : "bg-white/10 text-white/40"
                      )}
                    >
                      {s.id < step ? <Check className="h-3 w-3" /> : s.id}
                    </div>
                    <span className={cn("text-[10px] whitespace-nowrap", s.id <= step ? "text-white/80" : "text-white/30")}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-px flex-1 mb-4 mx-1 transition-colors", s.id < step ? "bg-white/40" : "bg-white/10")} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Body: overflow-visible on step 2 so CurrencyDropdown popup isn't clipped */}
          <div className={step === 2 ? "px-6 py-5 space-y-4" : "px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto"}>
            {step === 1 && (
              <>
                <Field label="Contract name *">
                  <Input value={form.title} onChange={(v) => set("title", v)} placeholder="e.g. Content Manager – Jackie" />
                </Field>
                <Field label="Assignee email">
                  <Input type="email" value={form.assignedToEmail} onChange={(v) => set("assignedToEmail", v)} placeholder="contractor@example.com" />
                </Field>
                <Field label="Job title">
                  <Input value={form.jobTitle} onChange={(v) => set("jobTitle", v)} placeholder="e.g. Content Manager" />
                </Field>
                <Field label="Scope of work">
                  <textarea
                    value={form.scopeOfWork}
                    onChange={(e) => set("scopeOfWork", e.target.value)}
                    className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-white/30"
                    placeholder="Describe the scope of work..."
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Currency & payment rate">
                  <div className="grid grid-cols-2 gap-3">
                    <CurrencyDropdown
                      selectedCurrencies={[form.compensationCurrency]}
                      setSelectedCurrencies={(c) => set("compensationCurrency", c[0] || "USD")}
                      mode="single"
                      showFiatCurrencies
                      disableChainCurrencies
                      filterCurrencies={(c: Currency) => c.symbol !== "ETH" && c.symbol !== "USDC"}
                      placeholder="Currency"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.compensationAmount}
                      onChange={(v) => set("compensationAmount", v)}
                      placeholder="Payment rate"
                    />
                  </div>
                </Field>
                <Field label="Payment frequency">
                  <div className="flex gap-2">
                    {FREQUENCIES.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => set("paymentFrequency", f.value)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                          form.paymentFrequency === f.value
                            ? "bg-white text-black"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="Start date">
                  <Input type="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
                </Field>
                <Field label="End date (optional)">
                  <Input type="date" value={form.endDate} onChange={(v) => set("endDate", v)} />
                </Field>
                <Field label="Notice period (days)">
                  <Input type="number" min="0" value={form.noticePeriodDays} onChange={(v) => set("noticePeriodDays", v)} placeholder="e.g. 10" />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Special clause">
                  <textarea
                    value={form.specialClause}
                    onChange={(e) => set("specialClause", e.target.value)}
                    className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-white/30"
                    placeholder="Any special terms or clauses..."
                  />
                </Field>
                <Field label="Notes / description">
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="w-full min-h-[80px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 resize-y focus:outline-none focus:border-white/30"
                    placeholder="Additional notes..."
                  />
                </Field>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-white/10 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 text-white/60 hover:text-white text-sm transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-full border border-white/20 text-white/70 hover:text-white text-sm">
              Cancel
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 flex items-center gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={updateContractMutation.isPending}
                className="h-10 px-5 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-70 flex items-center gap-2"
              >
                {updateContractMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-white/60">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", min, step,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: string; step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      step={step}
      className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 [color-scheme:dark]"
    />
  );
}
