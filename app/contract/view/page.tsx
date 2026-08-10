"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import {
  useGetContractByToken,
  useClaimContractByToken,
  useSignContract,
  useRejectContract,
} from "@/features/business/hooks/use-contracts";
import { getFileDownloadUrl } from "@/features/files/api/client";
import { Loader2, FileText, XCircle, Download, PenLine, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { viewPdf } from "@/utils/file";
import { Card, SectionLabel, T, A, G, R, Avatar, getUserColor } from "@/lib/splito-design";
import { ContractDocumentModal } from "@/components/contract-document-modal";
import type { Contract } from "@/features/business/api/client";

const CURSIVE_FONT = "Dancing Script";

function errorMessage(e: unknown): string {
  if (e == null) return "Something went wrong";
  if (typeof e === "string") return e;
  if (typeof (e as { message?: string }).message === "string")
    return (e as { message: string }).message;
  const d = (e as { response?: { data?: { message?: string; error?: string } } })
    ?.response?.data;
  if (d?.message) return d.message;
  if (d?.error) return d.error;
  return "Something went wrong";
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtFrequency(f: string | null | undefined): string | null {
  if (!f) return null;
  const map: Record<string, string> = {
    MONTHLY: "Monthly",
    WEEKLY: "Weekly",
    ONE_TIME: "One-time",
  };
  return map[f] ?? f;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-3.5 px-4 border-b border-white/[0.06] last:border-b-0">
      <span className="text-[13px] font-medium" style={{ color: T.muted }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold text-right" style={{ color: T.bright }}>
        {value}
      </span>
    </div>
  );
}

function SignatureBox({
  name,
  subtitle,
  label,
  avatarColor,
  isSigned,
  cursiveName,
}: {
  name: string;
  subtitle: string;
  label: string;
  avatarColor: string;
  isSigned: boolean;
  cursiveName?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        {cursiveName && (
          <p
            className="text-[22px] mb-1 truncate"
            style={{ fontFamily: `"${CURSIVE_FONT}", cursive`, color: T.bright }}
          >
            {cursiveName}
          </p>
        )}
        <p className="text-[13px] font-medium truncate" style={{ color: T.body }}>
          {name}
        </p>
        <p className="text-[12px]" style={{ color: T.muted }}>
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: isSigned ? G : T.dim }}>
          {label}
        </span>
        <Avatar init={initials(name)} color={avatarColor} size={36} />
      </div>
    </div>
  );
}

export default function ContractViewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user } = useAuthStore();
  const router = useRouter();
  const { data, isLoading, isError } = useGetContractByToken(token);
  const claimMutation = useClaimContractByToken();
  const signMutation = useSignContract();
  const rejectMutation = useRejectContract();
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(CURSIVE_FONT)}:wght@400;700&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    if (!data || !user || data.contract.assignedToUserId != null) return;
    claimMutation.mutate(data.token, { onError: () => {} });
  }, [data?.token, user?.id, data?.contract?.assignedToUserId]);

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white">
          <p className="text-white/80 mb-4">Invalid link. No contract token provided.</p>
          <Link href="/login" className="text-white underline">Go to login</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white max-w-sm">
          <p className="text-white/80 mb-4">This link is invalid or has expired.</p>
          <Link href="/login" className="text-white underline block mb-2">Log in</Link>
          <Link href="/signup" className="text-white underline">Sign up</Link>
        </div>
      </div>
    );
  }

  const contract = data.contract;
  const callbackUrl = `/contract/view?token=${encodeURIComponent(token)}`;
  const isAssignee = contract.assignedToUserId === user?.id;
  const isSigned = !!contract.signedAt;
  const isRejected = contract.status === "REJECTED" || rejected;
  const pendingAcceptReject = isAssignee && !isSigned && !isRejected;
  const creatorName = contract.createdBy?.name ?? "Client";
  const orgName = contract.organization?.name ?? "Organization";

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center text-white max-w-md">
          <h1 className="text-xl font-semibold mb-2">{contract.title || "Contract"}</h1>
          <p className="text-white/70 mb-4">{orgName}</p>
          <p className="text-white/80 mb-6">Sign up or log in to view your contract and raise invoices based on it.</p>
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="inline-block rounded-full bg-white text-black px-6 py-3 font-medium hover:bg-white/90 mb-3"
          >
            Sign up
          </Link>
          <br />
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-white underline">
            Already have an account? Log in
          </Link>
        </div>
      </div>
    );
  }

  const handleViewPdf = async () => {
    if (!contract.pdfFileKey || isPdfLoading) return;
    try {
      setIsPdfLoading(true);
      const r = await getFileDownloadUrl(contract.pdfFileKey);
      await viewPdf(r.downloadUrl);
    } catch {
      toast.error("Could not open PDF");
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleSign = (payload: { signatureDataUrl: string; signerName: string }) => {
    signMutation.mutate(
      { contractId: contract.id, ...payload },
      {
        onSuccess: () => {
          toast.success("Contract signed. You now have access to the organization.");
          router.push(`/organization/${contract.organizationId}/invoices`);
        },
        onError: (e: unknown) => toast.error(errorMessage(e) || "Failed to sign contract"),
      }
    );
  };

  const handleReject = () => {
    rejectMutation.mutate(contract.id, {
      onSuccess: () => {
        setRejected(true);
        toast.success("Contract rejected.");
      },
      onError: (e: unknown) => toast.error(errorMessage(e) || "Failed to reject contract"),
    });
  };

  if (isRejected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <XCircle className="h-16 w-16 text-red-400/80 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">You have rejected this contract</h1>
          <p className="text-white/70 mb-6">
            You do not have access to {orgName}. Only members who accept their contract can view the organization.
          </p>
          <Link
            href="/organization"
            className="inline-block rounded-full bg-white/10 text-white px-6 py-3 font-medium hover:bg-white/20 border border-white/20"
          >
            Back to organizations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mb-1" style={{ color: T.bright }}>
            {contract.title || "Contract"}
          </h1>
          <p className="text-[14px] font-medium" style={{ color: T.muted }}>{orgName}</p>
        </div>

        {/* PDF download bar */}
        {contract.pdfFileKey && (
          <Card className="mb-6">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${A}15`, border: `1px solid ${A}25` }}
              >
                <FileText className="h-5 w-5" style={{ color: A }} />
              </div>
              <p className="flex-1 text-[13px] font-medium" style={{ color: T.body }}>
                Contract document attached
              </p>
              <button
                type="button"
                onClick={handleViewPdf}
                disabled={isPdfLoading}
                className="flex items-center gap-1.5 text-[13px] font-semibold shrink-0 disabled:opacity-50"
                style={{ color: A }}
              >
                {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isPdfLoading ? "Opening..." : "View PDF"}
              </button>
            </div>
          </Card>
        )}

        {/* Signatures section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel className="!mb-0">Signatures</SectionLabel>
            {pendingAcceptReject && (
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="text-[12px] font-bold disabled:opacity-50"
                style={{ color: R }}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Reject"}
              </button>
            )}
          </div>
          <Card className="p-4 space-y-3">
            {/* Creator / Client signature */}
            <SignatureBox
              name={creatorName}
              subtitle={orgName}
              label="Signed by Client"
              avatarColor={getUserColor(creatorName)}
              isSigned
              cursiveName={creatorName}
            />

            {/* Contractor signature */}
            {isSigned ? (
              <SignatureBox
                name={contract.signerName ?? user?.name ?? "Contractor"}
                subtitle="Contractor"
                label="Signed"
                avatarColor={getUserColor(user?.name ?? null)}
                isSigned
                cursiveName={contract.signerName ?? user?.name ?? undefined}
              />
            ) : pendingAcceptReject ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ border: `2px dashed ${T.dim}` }}
                    >
                      <PenLine className="h-4 w-4" style={{ color: T.dim }} />
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: T.muted }}>
                      Contractor signs here
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDocModal(true)}
                    className="shrink-0 rounded-lg px-4 py-2 text-[13px] font-bold"
                    style={{ background: A, color: "#0a0a0a" }}
                  >
                    Review & Sign
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 shrink-0" style={{ color: T.dim }} />
                <p className="text-[13px]" style={{ color: T.muted }}>Awaiting contractor signature</p>
              </div>
            )}
          </Card>
        </div>

        {/* Contract details section */}
        <ContractDetails contract={contract} orgName={orgName} />

        {/* View full document (for signed contracts or anyone) */}
        {isSigned && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDocModal(true)}
              className="w-full rounded-xl py-3 text-[13px] font-bold border border-white/10 hover:bg-white/[0.03] transition-colors"
              style={{ color: T.body }}
            >
              View full agreement
            </button>
          </div>
        )}

        {/* Raise invoice CTA */}
        {isAssignee && isSigned && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() =>
                router.push(`/organization/${contract.organizationId}/invoices?openInvoice=1&contractId=${contract.id}`)
              }
              className="w-full rounded-xl py-3.5 text-[14px] font-bold"
              style={{ background: A, color: "#0a0a0a" }}
            >
              Raise invoice from this contract
            </button>
          </div>
        )}
      </div>

      <ContractDocumentModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        contract={contract}
        creatorName={creatorName}
        orgName={orgName}
        contractorName={contract.assignedTo?.name ?? user?.name ?? ""}
        contractorEmail={contract.assignedToEmail}
        onSign={handleSign}
        isPending={signMutation.isPending}
        isSigned={isSigned}
        signerName={contract.signerName}
      />
    </div>
  );
}

function ContractDetails({ contract, orgName }: { contract: Contract; orgName: string }) {
  const hasDetails = contract.startDate || contract.endDate || contract.paymentFrequency || orgName;
  const hasJob = contract.jobTitle;
  const hasPayment = contract.compensationAmount != null;
  const hasScope = contract.scopeOfWork;
  const hasDescription = contract.description;
  const hasSpecialClause = contract.specialClause;
  const hasNoticePeriod = contract.noticePeriodDays != null;

  if (!hasDetails && !hasJob && !hasPayment && !hasScope && !hasDescription && !hasSpecialClause) {
    return null;
  }

  return (
    <div>
      <SectionLabel>Contract details</SectionLabel>

      {/* Core details */}
      {hasDetails && (
        <Card className="mb-4 overflow-hidden">
          <DetailRow label="Organization" value={orgName} />
          {contract.startDate && <DetailRow label="Start date" value={fmtDate(contract.startDate)} />}
          {contract.endDate && <DetailRow label="End date" value={fmtDate(contract.endDate)} />}
          {contract.paymentFrequency && (
            <DetailRow label="Payment frequency" value={fmtFrequency(contract.paymentFrequency)} />
          )}
          {hasNoticePeriod && (
            <DetailRow label="Notice period" value={`${contract.noticePeriodDays} days`} />
          )}
        </Card>
      )}

      {/* Job Role */}
      {hasJob && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.dim }}>
              Job Role
            </p>
          </div>
          <DetailRow label="Job title" value={contract.jobTitle} />
        </Card>
      )}

      {/* Payment details */}
      {hasPayment && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.dim }}>
              Payment details
            </p>
          </div>
          <DetailRow
            label="Rate"
            value={
              <>
                <span style={{ color: T.bright }}>
                  {contract.compensationCurrency ?? "USD"} {contract.compensationAmount?.toLocaleString()}
                </span>
                {contract.paymentFrequency && (
                  <span className="block text-[11px] font-medium" style={{ color: T.muted }}>
                    {fmtFrequency(contract.paymentFrequency)}
                  </span>
                )}
              </>
            }
          />
        </Card>
      )}

      {/* Scope of work */}
      {hasScope && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.dim }}>
              Scope of Work
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: T.body }}>
              {contract.scopeOfWork}
            </p>
          </div>
        </Card>
      )}

      {/* Description */}
      {hasDescription && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.dim }}>
              Description
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: T.body }}>
              {contract.description}
            </p>
          </div>
        </Card>
      )}

      {/* Special clause */}
      {hasSpecialClause && (
        <Card className="mb-4 overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.dim }}>
              Special Clause
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: T.body }}>
              {contract.specialClause}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
