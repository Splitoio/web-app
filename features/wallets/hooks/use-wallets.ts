import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { getUser } from "@/features/user/api/client";
import {
  addWallet,
  getAvailableChains,
  getUserWallets,
  removeWallet,
  Wallet,
  ChainResponse,
} from "../api/client";

// Query keys
export const WALLET_QUERY_KEYS = {
  WALLETS: "wallets",
  CHAINS: "chains",
};

// Hook to fetch all user's wallets.
// `enabled` is opt-out gating for callers that render signed out: getUserWallets
// toasts on failure, so an unauthenticated fetch would 401 and surface a bogus
// "Failed to fetch wallet accounts" toast. Defaults to on for existing callers.
export const useUserWallets = (options?: { enabled?: boolean }) => {
  return useQuery<{ accounts: Wallet[] }>({
    queryKey: [WALLET_QUERY_KEYS.WALLETS],
    queryFn: getUserWallets,
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data) => {
      // Handle cases where the API returns an object with accounts array
      // or fallback to the data itself if it's already the right structure
      return data || { accounts: [] };
    },
  });
};

// Hook to fetch available chains
export const useAvailableChains = () => {
  return useQuery<ChainResponse>({
    queryKey: [WALLET_QUERY_KEYS.CHAINS],
    queryFn: getAvailableChains,
  });
};

// Hook to add a wallet
export const useAddWallet = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: addWallet,
    onSuccess: async () => {
      toast.success("Wallet added successfully");
      await queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
      const user = await getUser();
      setUser(user);
    },
    onError: (error) => {
      console.error("Error adding wallet:", error);
      // Error is already handled and displayed by the addWallet function
    },
  });
};

// Hook to set a wallet as primary
export const useSetWalletAsPrimary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      address,
    }: {
      chainId: string;
      address: string;
    }) => {
      return addWallet({ chainId, address, isPrimary: true });
    },
    onSuccess: () => {
      toast.success("Primary wallet updated");
      queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
    },
    onError: (error) => {
      console.error("Error setting primary wallet:", error);
      toast.error("Failed to update primary wallet");
    },
  });
};

// Hook to remove a wallet
export const useRemoveWallet = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: removeWallet,
    onSuccess: async () => {
      toast.success("Wallet removed successfully");
      await queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
      // Refresh user data to update the UI
      const user = await getUser();
      setUser(user);
    },
    onError: (error) => {
      console.error("Error removing wallet:", error);
      // Error is already handled and displayed by the removeWallet function
    },
  });
};
