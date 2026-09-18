import { describe, expect, it } from "vitest";
import { deriveSettleAmount } from "./settle-amounts";

// Regression test for #32: the step-3 payment header relabelled an already-converted net
// balance as the counterparty's native currency, then formatWithDefault converted it a
// second time (EUR703.99 -> "($820.22)" on top of a real balance of $703.99). Both steps must
// read the same figure, in the same currency, off one implementation.
describe("deriveSettleAmount", () => {
  const netConvertedSigned = -703.99; // multi-currency net balance vs a member, already summed in USD
  const defaultCurrency = "USD";

  it("step 2 and step 3 produce the identical figure for the same net balance", () => {
    const step2 = deriveSettleAmount({ netConvertedSigned, direction: "owe", defaultCurrency });
    const step3 = deriveSettleAmount({ netConvertedSigned, direction: "owe", defaultCurrency });

    expect(step3).toEqual(step2);
    expect(step2).toEqual({ amount: 703.99, currency: "USD", sign: "-" });
  });

  it("applies the conversion exactly once: never re-converts an already-converted amount", () => {
    // A caller that (incorrectly) fed a native per-leg currency plus a rate would have produced
    // something like 703.99 * 1.1655 = 820.22. There is no rate parameter here at all, so the
    // helper cannot reproduce that inflation regardless of what currency label a caller has lying
    // around.
    const result = deriveSettleAmount({ netConvertedSigned, direction: "owe", defaultCurrency });
    expect(result.amount).toBe(703.99);
    expect(result.amount).not.toBeCloseTo(820.22, 1);
    expect(result.currency).toBe(defaultCurrency);
  });

  it("prefers specificAmount (single-expense settle) over netConvertedSigned when both are given", () => {
    const result = deriveSettleAmount({
      netConvertedSigned: -50,
      direction: "owe",
      defaultCurrency,
      specificAmount: -12.5,
    });
    expect(result).toEqual({ amount: 12.5, currency: "USD", sign: "-" });
  });

  it("signs a positive (owed-to-you) balance with a plus", () => {
    const result = deriveSettleAmount({ netConvertedSigned: 42, direction: "owed", defaultCurrency });
    expect(result).toEqual({ amount: 42, currency: "USD", sign: "+" });
  });
});
