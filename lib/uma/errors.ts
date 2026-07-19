import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";

/** One human line for any wagmi/viem tx failure. Contract custom-error names
 *  (e.g. "BondBelowThreshold") are prettified generically, so we never have
 *  to hardcode the oracle's error catalogue. */
export function friendlyTxError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((err) => err instanceof UserRejectedRequestError)) {
      return "rejected in wallet";
    }
    const revert = e.walk(
      (err) => err instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName ?? revert?.reason;
    if (name) return prettifyErrorName(name);
    return e.shortMessage || "transaction failed";
  }
  return e instanceof Error ? e.message : "transaction failed";
}

function prettifyErrorName(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}
