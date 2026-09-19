"use client";

import { X, CheckCircle2, Clock, Calendar, Briefcase, DollarSign, FileText, AlertCircle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Contract } from "@/features/business/api/client";
import { formatCurrency } from "@/utils/formatters";
import { downloadContract } from "@/utils/contract-download";

interface ContractDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFrequency(f: string | null | undefined) {
  if (!f) return null;
  return f.charAt(0) + f.slice(1).toLowerCase();
}

export function ContractDetailModal({ isOpen, onClose, contract }: ContractDetailModalProps) {
  if (!contract) return null;

  const isSigned = !!contract.signedAt;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 bg-[#101012] rounded-2xl border border-white/20 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#101012] border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-white truncate pr-4">
                {contract.title || "Contract"}
              </h2>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => downloadContract(contract)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Download contract"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Status badge */}
              <div>
                {isSigned ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed {formatDate(contract.signedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/50 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                    <Clock className="h-3.5 w-3.5" />
                    Awaiting signature
                  </span>
                )}
              </div>

              {/* Organization */}
              {contract.organization && (
                <DetailRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Organization"
                  value={contract.organization.name}
                />
              )}

              {/* Job title */}
              {contract.jobTitle && (
                <DetailRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Job Title"
                  value={contract.jobTitle}
                />
              )}

              {/* Compensation */}
              {contract.compensationAmount != null && (
                <DetailRow
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Compensation"
                  value={`${formatCurrency(contract.compensationAmount, contract.compensationCurrency ?? "USD")}${contract.paymentFrequency ? ` / ${formatFrequency(contract.paymentFrequency)}` : ""}`}
                />
              )}

              {/* Duration */}
              {(contract.startDate || contract.endDate) && (
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Duration"
                  value={`${formatDate(contract.startDate)}${contract.endDate ? ` → ${formatDate(contract.endDate)}` : " · No end date"}`}
                />
              )}

              {/* Notice period */}
              {contract.noticePeriodDays != null && (
                <DetailRow
                  icon={<AlertCircle className="h-4 w-4" />}
                  label="Notice Period"
                  value={`${contract.noticePeriodDays} day${contract.noticePeriodDays !== 1 ? "s" : ""}`}
                />
              )}

              {/* Description */}
              {contract.description && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>Description</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed pl-6">
                    {contract.description}
                  </p>
                </div>
              )}

              {/* Scope of work */}
              {contract.scopeOfWork && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>Scope of Work</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed pl-6">
                    {contract.scopeOfWork}
                  </p>
                </div>
              )}

              {/* Special clause */}
              {contract.specialClause && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>Special Clause</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed pl-6">
                    {contract.specialClause}
                  </p>
                </div>
              )}

              {/* Assigned to */}
              {contract.assignedTo && (
                <DetailRow
                  label="Assigned To"
                  value={contract.assignedTo.name || contract.assignedTo.email || contract.assignedToEmail}
                />
              )}

              {/* Created by */}
              {contract.createdBy && (
                <DetailRow
                  label="Created By"
                  value={contract.createdBy.name || contract.createdBy.email || "-"}
                />
              )}

              {/* Created date */}
              <DetailRow
                label="Created"
                value={formatDate(contract.createdAt)}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      {icon ? (
        <span className="text-white/50 mt-0.5">{icon}</span>
      ) : (
        <span className="w-4" />
      )}
      <div className="min-w-0">
        <p className="text-white/50 text-sm">{label}</p>
        <p className="text-white text-sm font-medium">{value || "-"}</p>
      </div>
    </div>
  );
}
