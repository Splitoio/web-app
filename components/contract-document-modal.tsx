"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download, ArrowLeft, Loader2 } from "lucide-react";
import type { Contract } from "@/features/business/api/client";
import { A, T, BORDER, INSET } from "@/lib/splito-design";

const CURSIVE_FONT = "Dancing Script";

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return "[Date]";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtFreq(f: string | null | undefined): string {
  if (!f) return "";
  const m: Record<string, string> = { MONTHLY: "monthly", WEEKLY: "weekly", ONE_TIME: "as a one-time payment" };
  return m[f] ?? f;
}

interface ContractDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  creatorName: string;
  orgName: string;
  contractorName: string;
  contractorEmail: string;
  onSign: (payload: { signatureDataUrl: string; signerName: string }) => void;
  isPending: boolean;
  isSigned: boolean;
  signerName?: string | null;
}

export function ContractDocumentModal({
  isOpen,
  onClose,
  contract,
  creatorName,
  orgName,
  contractorName,
  contractorEmail,
  onSign,
  isPending,
  isSigned,
  signerName: existingSignerName,
}: ContractDocumentModalProps) {
  const [name, setName] = useState("");
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setName("");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const refId = contract.id.slice(0, 8).toUpperCase();
  const effectiveDate = fmtDateLong(contract.startDate);
  const currency = contract.compensationCurrency ?? "USD";
  const amount = contract.compensationAmount;

  const generateSignatureImage = useCallback(async (signerName: string): Promise<string | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, 400, 120);
    ctx.fillStyle = "#fff";
    try {
      await document.fonts.load(`28px "${CURSIVE_FONT}"`);
      ctx.font = `28px "${CURSIVE_FONT}"`;
    } catch {
      ctx.font = "28px cursive";
    }
    ctx.fillText(signerName, 20, 75);
    return canvas.toDataURL("image/png");
  }, []);

  const handleAgreeAndSign = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dataUrl = await generateSignatureImage(trimmed);
    if (!dataUrl) return;
    onSign({ signatureDataUrl: dataUrl, signerName: trimmed });
  }, [name, generateSignatureImage, onSign]);

  const handleDownloadPdf = useCallback(() => {
    const el = docRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${contract.title || "Contract"} - ${orgName}</title>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;padding:48px 56px;line-height:1.7;max-width:800px;margin:0 auto;font-size:14px;background:#fff}
h1{font-size:20px;text-align:center;margin-bottom:2px;letter-spacing:0.04em}
p,li{margin-bottom:8px}
@media print{body{padding:32px 40px}@page{margin:24mm 18mm}}
</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }, [contract.title, orgName]);

  if (!isOpen) return null;

  let sectionNum = 0;
  const nextSection = () => { sectionNum++; return sectionNum; };

  const sectionTitleStyle = "font-bold text-[14px] tracking-wide mb-2 uppercase";
  const bodyTextStyle: React.CSSProperties = { color: T.body, fontSize: 13, lineHeight: 1.8 };
  const mutedTextStyle: React.CSSProperties = { color: T.muted, fontSize: 13, lineHeight: 1.8 };
  const tblLabelStyle: React.CSSProperties = { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", color: T.muted, width: 180, fontSize: 13 };
  const tblValueStyle: React.CSSProperties = { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 600, textAlign: "right", fontSize: 13, color: T.bright };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: BORDER, background: "#0b0b0b" }}
      >
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: T.body }}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={handleDownloadPdf} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: T.body }}>
          <Download className="h-4 w-4" /> Download PDF
        </button>
        <button type="button" onClick={onClose} style={{ color: T.dim }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable document area */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div
          className="max-w-[720px] mx-auto rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)",
            border: BORDER,
            boxShadow: "0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Document content */}
          <div ref={docRef} className="px-8 py-10 sm:px-12 sm:py-12" style={{ lineHeight: 1.75, fontSize: 14 }}>
            <h1 className="text-center text-[18px] font-bold tracking-widest mb-0.5" style={{ color: T.bright }}>
              CONTRACTOR AGREEMENT
            </h1>
            <p className="text-center text-[12px] mb-10" style={{ color: T.dim }}>REF: {refId}</p>

            <p className="mb-6" style={bodyTextStyle}>
              This Contractor Agreement <strong style={{ color: T.bright }}>(&ldquo;Agreement&rdquo;)</strong> is entered into as of{" "}
              <strong style={{ color: T.bright }}><em>{effectiveDate}</em></strong>{" "}
              {contract.startDate && <>(the <strong style={{ color: T.bright }}><em>&ldquo;Effective Date&rdquo;</em></strong>), </>}
              between:
            </p>

            <p className="mb-4" style={bodyTextStyle}>
              <strong style={{ color: T.bright }}>{orgName}</strong>{" "}
              <strong style={{ color: T.bright }}>(&ldquo;Client&rdquo;)</strong>
              {contract.createdBy?.email && <>, email: {contract.createdBy.email}</>}
              , and
            </p>

            <p className="mb-6" style={bodyTextStyle}>
              <strong style={{ color: T.bright }}>{contractorName || contractorEmail}</strong>{" "}
              <strong style={{ color: T.bright }}>(&ldquo;Contractor&rdquo;)</strong>
              {contractorEmail && <>, email: {contractorEmail}</>}.
            </p>

            <p className="mb-8" style={bodyTextStyle}>
              Client and Contractor desire to have Contractor perform services for Client, subject to and in accordance with the terms and conditions of this Agreement.
            </p>

            {/* Terms table */}
            <p className={sectionTitleStyle} style={{ color: T.bright }}>Agreement Terms</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
              <tbody>
                {contract.startDate && (
                  <tr><td style={tblLabelStyle}>Start Date</td><td style={tblValueStyle}>{fmtDateLong(contract.startDate)}</td></tr>
                )}
                {contract.endDate && (
                  <tr><td style={tblLabelStyle}>End Date</td><td style={tblValueStyle}>{fmtDateLong(contract.endDate)}</td></tr>
                )}
                {contract.paymentFrequency && (
                  <tr><td style={tblLabelStyle}>Payment Frequency</td><td style={{ ...tblValueStyle, textTransform: "capitalize" }}>{fmtFreq(contract.paymentFrequency)}</td></tr>
                )}
                {contract.noticePeriodDays != null && (
                  <tr><td style={tblLabelStyle}>Notice Period</td><td style={tblValueStyle}>{contract.noticePeriodDays} days</td></tr>
                )}
              </tbody>
            </table>

            {/* Position and Duties */}
            {(contract.jobTitle || contract.scopeOfWork) && (
              <>
                <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Position and Duties</p>
                {contract.jobTitle && (
                  <p className="mb-3" style={bodyTextStyle}>The Contractor shall serve in the role of <strong style={{ color: T.bright }}>{contract.jobTitle}</strong>.</p>
                )}
                {contract.scopeOfWork && (
                  <>
                    <p className="mb-2" style={bodyTextStyle}>The Contractor shall perform the following duties and responsibilities:</p>
                    <div className="mb-6 pl-4" style={{ borderLeft: `2px solid rgba(255,255,255,0.1)` }}>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: T.body }}>{contract.scopeOfWork}</p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Compensation */}
            {amount != null && (
              <>
                <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Compensation</p>
                <p className="mb-6" style={bodyTextStyle}>
                  The Client shall pay the Contractor a rate of{" "}
                  <strong style={{ color: A }}>{currency} {amount.toLocaleString()}</strong>
                  {contract.paymentFrequency && <>, payable <strong style={{ color: T.bright }}>{fmtFreq(contract.paymentFrequency)}</strong></>}.
                </p>
              </>
            )}

            {/* Description */}
            {contract.description && (
              <>
                <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Description</p>
                <p className="mb-6 whitespace-pre-wrap" style={bodyTextStyle}>{contract.description}</p>
              </>
            )}

            {/* Special clause */}
            {contract.specialClause && (
              <>
                <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Special Terms</p>
                <p className="mb-6 whitespace-pre-wrap" style={bodyTextStyle}>{contract.specialClause}</p>
              </>
            )}

            {/* Confidentiality */}
            <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Confidentiality</p>
            <p className="mb-6" style={mutedTextStyle}>
              The Contractor agrees to maintain in confidence and not disclose to any third party any proprietary or confidential information of the Client, including but not limited to business plans, financial information, technical data, trade secrets, and any other information that is not publicly available. This obligation shall survive the termination of this Agreement.
            </p>

            {/* Intellectual Property */}
            <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Intellectual Property</p>
            <p className="mb-6" style={mutedTextStyle}>
              All work product, inventions, discoveries, and materials created by the Contractor in the course of performing services under this Agreement shall be the sole and exclusive property of the Client. The Contractor hereby assigns all rights, title, and interest in such work product to the Client.
            </p>

            {/* Termination */}
            <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Termination</p>
            <p className="mb-6" style={mutedTextStyle}>
              {contract.noticePeriodDays != null
                ? `Either party may terminate this Agreement by providing ${contract.noticePeriodDays} days' written notice to the other party. `
                : "Either party may terminate this Agreement by providing reasonable written notice to the other party. "}
              Upon termination, the Contractor shall promptly return all Client property and materials. The Client shall pay the Contractor for all services satisfactorily performed up to the date of termination.
            </p>

            {/* Miscellaneous */}
            <p className={sectionTitleStyle} style={{ color: T.bright }}>{nextSection()}. Miscellaneous</p>
            <p className="mb-2" style={mutedTextStyle}>
              This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior agreements and understandings.
            </p>
            <p className="mb-8" style={mutedTextStyle}>
              Electronic signatures are deemed valid and binding on both Parties. By signing below, each Party acknowledges that they have read, understood, and agree to the terms of this Agreement.
            </p>

            <p className="text-[13px] mb-6 italic" style={{ color: T.dim }}>
              In witness whereof, the Parties execute this Agreement.
            </p>

            {/* Signatures */}
            <div style={{ display: "flex", gap: 32, marginTop: 32, paddingTop: 24, borderTop: BORDER }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: `"${CURSIVE_FONT}", cursive`, fontSize: 26, minHeight: 36, marginBottom: 4, color: T.bright }}>
                  {creatorName}
                </p>
                <p style={{ fontSize: 12, color: T.dim, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 4 }}>Client Signature</p>
                <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{orgName}</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: `"${CURSIVE_FONT}", cursive`, fontSize: 26, minHeight: 36, marginBottom: 4, color: isSigned ? T.bright : T.dim }}>
                  {isSigned ? (existingSignerName ?? contractorName) : (name.trim() || "Your signature")}
                </p>
                <p style={{ fontSize: 12, color: T.dim, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 4 }}>
                  {isSigned ? "Contractor Signature" : "Enter your full name (Contractor Signature)"}
                </p>
                {isSigned && contract.signedAt && (
                  <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Signed: {fmtDateLong(contract.signedAt)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sign footer */}
          {!isSigned && (
            <div
              className="sticky bottom-0 px-8 py-5 sm:px-12 rounded-b-2xl"
              style={{ borderTop: BORDER, background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)" }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name to sign"
                className="w-full rounded-xl px-4 py-2.5 outline-none mb-3"
                style={{
                  fontFamily: `"${CURSIVE_FONT}", cursive`,
                  fontSize: 18,
                  background: INSET,
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: T.bright,
                }}
              />
              <button
                type="button"
                onClick={handleAgreeAndSign}
                disabled={isPending || !name.trim()}
                className="w-full rounded-xl py-3 text-[15px] font-bold disabled:opacity-50"
                style={{ background: A, color: "#0a0a0a" }}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing...
                  </span>
                ) : (
                  "Agree & Sign"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
