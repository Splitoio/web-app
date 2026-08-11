import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { useMutation } from "@tanstack/react-query";
import {
  getUser, updateUser, getUserAcceptedTokens, addUserAcceptedToken, removeUserAcceptedToken,
  getSettlementPreference, getUserSettlementPreference, saveSettlementPreference, removeSettlementPreference, updateSettlementWallet,
} from "../api/client";
import { toast } from "sonner";
import { WALLET_QUERY_KEYS } from "@/features/wallets/hooks/use-wallets";

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.USER] });
    },
    onError: (error) => {
      toast.error("Error updating profile", {
        description: error.message || "Unknown error",
      });
    },
  });
};

export const useGetUser = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [QueryKeys.USER],
    queryFn: getUser,
    enabled: options?.enabled ?? true,
  });
};

const ACCEPTED_TOKENS_KEY = ["user-accepted-tokens"];

export const useGetUserAcceptedTokens = () => {
  return useQuery({
    queryKey: ACCEPTED_TOKENS_KEY,
    queryFn: getUserAcceptedTokens,
    staleTime: 0,
  });
};

export const useAddUserAcceptedToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addUserAcceptedToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCEPTED_TOKENS_KEY }),
  });
};

export const useRemoveUserAcceptedToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeUserAcceptedToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCEPTED_TOKENS_KEY }),
  });
};

// ─── Settlement Preference hooks ─────────────────────────────────────────────

const SETTLEMENT_PREF_KEY = ["settlement-preference"];

/**
 * `enabled` exists because the create screen is reachable signed out (it is the
 * logged-out console's landing page — see components/create/create-request-experience.tsx),
 * and an anonymous visitor has no settlement preferences to fetch.
 */
export const useGetSettlementPreference = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: SETTLEMENT_PREF_KEY,
    queryFn: getSettlementPreference,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

export const useGetUserSettlementPreference = (userId: string | null) => {
  return useQuery({
    queryKey: ["settlement-preference", userId],
    queryFn: () => getUserSettlementPreference(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * `onError` is load-bearing, not decoration. The settings modal closes itself in
 * its own `onSuccess` callback, so a failed save left the modal open with the
 * button snapping back from "Saving…" to "Save preference" and NOTHING else —
 * the rejection was normalized to an ApiError by the axios interceptor and then
 * only console.log'd. The user saw a no-op.
 *
 * `error.message` is already the server's message (api-helpers/client.ts derives
 * it from body.details ?? body.error ?? body.message), so this surfaces
 * "Invalid wallet address for Stellar" rather than a generic string. Do NOT
 * close the modal here — the input is still on screen for the user to correct.
 */
export const useSaveSettlementPreference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSettlementPreference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTLEMENT_PREF_KEY });
      queryClient.invalidateQueries({ queryKey: ACCEPTED_TOKENS_KEY });
      queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
    },
    onError: (error) => {
      toast.error("Error saving settlement preference", {
        description: error.message || "Unknown error",
      });
    },
  });
};

export const useRemoveSettlementPreference = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chainId?: string) => removeSettlementPreference(chainId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTLEMENT_PREF_KEY });
      queryClient.invalidateQueries({ queryKey: ACCEPTED_TOKENS_KEY });
    },
  });
};

export const useUpdateSettlementWallet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { walletAddress: string; chainId?: string }) => updateSettlementWallet(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTLEMENT_PREF_KEY });
      queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
    },
    // Same modal, same silent-failure shape as useSaveSettlementPreference above
    // — the "edit wallet" mode of SettlementPrefModal hits this path and hit the
    // same server-side address validation.
    onError: (error) => {
      toast.error("Error updating wallet address", {
        description: error.message || "Unknown error",
      });
    },
  });
};
