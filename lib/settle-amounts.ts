// Pure amount/label derivation shared by the Settle Debts modal's step 2 (breakdown) and
// step 3 (payment) screens. See queue ticket #32: step 3 used to relabel an already-converted
// net balance as if it were still in the counterparty's native currency and convert it a
// second time. There is no `rate` parameter here on purpose: every input is expected to
// already be expressed in `defaultCurrency`, so there is nothing left to (re)convert.

export type SettleDirection = "owe" | "owed";

export interface SettleAmountInput {
  /** Net balance for this member, already converted into `defaultCurrency`. */
  netConvertedSigned: number;
  direction: SettleDirection;
  /** The one currency both steps render in. */
  defaultCurrency: string;
  /**
   * Optional override for a single-expense settle (`specificMemberAmounts[memberId]`).
   * Also already expressed in `defaultCurrency`, never a native per-leg amount.
   */
  specificAmount?: number;
}

export interface SettleAmountResult {
  amount: number;
  currency: string;
  sign: "-" | "+";
}

export function deriveSettleAmount(input: SettleAmountInput): SettleAmountResult {
  const raw = input.specificAmount !== undefined ? input.specificAmount : input.netConvertedSigned;
  return {
    amount: Math.abs(raw),
    currency: input.defaultCurrency,
    sign: input.direction === "owe" ? "-" : "+",
  };
}
