import type { Contract } from "@/features/business/api/client";

const CURSIVE_FONT = "Dancing Script";

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return "[Date]";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtFreq(f: string | null | undefined): string {
  if (!f) return "";
  const m: Record<string, string> = { MONTHLY: "monthly", WEEKLY: "weekly", ONE_TIME: "as a one-time payment" };
  return m[f] ?? f;
}

export function downloadContract(contract: Contract): void {
  const orgName = contract.organization?.name ?? "Organization";
  const creatorName = contract.createdBy?.name ?? contract.createdBy?.email ?? "-";
  const contractorName = contract.assignedTo?.name ?? contract.assignedToEmail ?? "-";
  const contractorEmail = contract.assignedTo?.email ?? contract.assignedToEmail ?? "";
  const isSigned = !!contract.signedAt;
  const signerName = contract.signerName ?? contractorName;
  const refId = contract.id.slice(0, 8).toUpperCase();
  const effectiveDate = fmtDateLong(contract.startDate);
  const currency = contract.compensationCurrency ?? "USD";
  const amount = contract.compensationAmount;

  let sectionNum = 0;
  const nextSection = () => ++sectionNum;

  const termsRows: string[] = [];
  if (contract.startDate) termsRows.push(`<tr><td class="tl">Start Date</td><td class="tv">${fmtDateLong(contract.startDate)}</td></tr>`);
  if (contract.endDate) termsRows.push(`<tr><td class="tl">End Date</td><td class="tv">${fmtDateLong(contract.endDate)}</td></tr>`);
  if (contract.paymentFrequency) termsRows.push(`<tr><td class="tl">Payment Frequency</td><td class="tv" style="text-transform:capitalize">${fmtFreq(contract.paymentFrequency)}</td></tr>`);
  if (contract.noticePeriodDays != null) termsRows.push(`<tr><td class="tl">Notice Period</td><td class="tv">${contract.noticePeriodDays} days</td></tr>`);

  const sections: string[] = [];

  if (contract.jobTitle || contract.scopeOfWork) {
    let s = `<p class="sh">${nextSection()}. Position and Duties</p>`;
    if (contract.jobTitle) s += `<p class="bt">The Contractor shall serve in the role of <strong>${esc(contract.jobTitle)}</strong>.</p>`;
    if (contract.scopeOfWork) {
      s += `<p class="bt">The Contractor shall perform the following duties and responsibilities:</p>`;
      s += `<div style="margin:0 0 18px 16px;padding-left:12px;border-left:2px solid #ddd"><p class="bt" style="white-space:pre-wrap">${esc(contract.scopeOfWork)}</p></div>`;
    }
    sections.push(s);
  }

  if (amount != null) {
    sections.push(
      `<p class="sh">${nextSection()}. Compensation</p>` +
      `<p class="bt">The Client shall pay the Contractor a rate of <strong>${esc(currency)} ${amount.toLocaleString()}</strong>${contract.paymentFrequency ? `, payable <strong>${fmtFreq(contract.paymentFrequency)}</strong>` : ""}.</p>`
    );
  }

  if (contract.description) {
    sections.push(`<p class="sh">${nextSection()}. Description</p><p class="bt" style="white-space:pre-wrap">${esc(contract.description)}</p>`);
  }

  if (contract.specialClause) {
    sections.push(`<p class="sh">${nextSection()}. Special Terms</p><p class="bt" style="white-space:pre-wrap">${esc(contract.specialClause)}</p>`);
  }

  sections.push(
    `<p class="sh">${nextSection()}. Confidentiality</p>` +
    `<p class="mt">The Contractor agrees to maintain in confidence and not disclose to any third party any proprietary or confidential information of the Client, including but not limited to business plans, financial information, technical data, trade secrets, and any other information that is not publicly available. This obligation shall survive the termination of this Agreement.</p>`
  );

  sections.push(
    `<p class="sh">${nextSection()}. Intellectual Property</p>` +
    `<p class="mt">All work product, inventions, discoveries, and materials created by the Contractor in the course of performing services under this Agreement shall be the sole and exclusive property of the Client. The Contractor hereby assigns all rights, title, and interest in such work product to the Client.</p>`
  );

  const noticeText = contract.noticePeriodDays != null
    ? `Either party may terminate this Agreement by providing ${contract.noticePeriodDays} days' written notice to the other party. `
    : "Either party may terminate this Agreement by providing reasonable written notice to the other party. ";
  sections.push(
    `<p class="sh">${nextSection()}. Termination</p>` +
    `<p class="mt">${noticeText}Upon termination, the Contractor shall promptly return all Client property and materials. The Client shall pay the Contractor for all services satisfactorily performed up to the date of termination.</p>`
  );

  sections.push(
    `<p class="sh">${nextSection()}. Miscellaneous</p>` +
    `<p class="mt">This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior agreements and understandings.</p>` +
    `<p class="mt">Electronic signatures are deemed valid and binding on both Parties. By signing below, each Party acknowledges that they have read, understood, and agree to the terms of this Agreement.</p>`
  );

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(contract.title || "Contract")} - ${esc(orgName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;padding:48px 56px;line-height:1.75;max-width:800px;margin:0 auto;font-size:14px;background:#fff}
h1{font-size:20px;text-align:center;margin-bottom:2px;letter-spacing:0.04em}
.ref{text-align:center;font-size:12px;color:#999;margin-bottom:36px}
.bt{color:#333;font-size:13px;line-height:1.8;margin-bottom:12px}
.mt{color:#666;font-size:13px;line-height:1.8;margin-bottom:12px}
.sh{font-weight:700;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;margin:24px 0 8px}
table{width:100%;border-collapse:collapse;margin-bottom:28px}
.tl{padding:10px 0;border-bottom:1px solid #eee;color:#888;width:180px;font-size:13px}
.tv{padding:10px 0;border-bottom:1px solid #eee;font-weight:600;text-align:right;font-size:13px}
.sig-row{display:flex;gap:32px;margin-top:32px;padding-top:24px;border-top:1px solid #eee}
.sig-box{flex:1}
.sig-name{font-family:"${CURSIVE_FONT}",cursive;font-size:26px;min-height:36px;margin-bottom:4px}
.sig-label{font-size:12px;color:#999;border-top:1px solid #ddd;padding-top:6px;margin-top:4px}
.sig-meta{font-size:12px;color:#777;margin-top:2px}
@media print{body{padding:32px 40px}@page{margin:24mm 18mm}}
</style></head><body>
<h1>CONTRACTOR AGREEMENT</h1>
<p class="ref">REF: ${refId}</p>

<p class="bt">This Contractor Agreement <strong>("Agreement")</strong> is entered into as of <strong><em>${effectiveDate}</em></strong>${contract.startDate ? ` (the <strong><em>"Effective Date"</em></strong>),` : ""} between:</p>
<p class="bt"><strong>${esc(orgName)}</strong> <strong>("Client")</strong>${contract.createdBy?.email ? `, email: ${esc(contract.createdBy.email)}` : ""}, and</p>
<p class="bt"><strong>${esc(contractorName)}</strong> <strong>("Contractor")</strong>${contractorEmail ? `, email: ${esc(contractorEmail)}` : ""}.</p>
<p class="bt" style="margin-bottom:28px">Client and Contractor desire to have Contractor perform services for Client, subject to and in accordance with the terms and conditions of this Agreement.</p>

${termsRows.length > 0 ? `<p class="sh">Agreement Terms</p><table><tbody>${termsRows.join("")}</tbody></table>` : ""}
${sections.join("")}

<p style="font-size:13px;margin:24px 0 20px;font-style:italic;color:#999">In witness whereof, the Parties execute this Agreement.</p>

<div class="sig-row">
  <div class="sig-box">
    <p class="sig-name">${esc(creatorName)}</p>
    <p class="sig-label">Client Signature</p>
    <p class="sig-meta">${esc(orgName)}</p>
  </div>
  <div class="sig-box">
    <p class="sig-name" ${!isSigned ? 'style="color:#ccc"' : ""}>${isSigned ? esc(signerName) : "-"}</p>
    <p class="sig-label">${isSigned ? "Contractor Signature" : "Awaiting Signature"}</p>
    ${isSigned && contract.signedAt ? `<p class="sig-meta">Signed: ${fmtDateLong(contract.signedAt)}</p>` : ""}
  </div>
</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
