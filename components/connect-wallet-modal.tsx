"use client";

import { X, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "@/utils/animations";
import { toast } from "sonner";
import { useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { useAuthStore } from "@/stores/authStore";
import {
  StellarWalletsKit,
  allowAllModules,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import { useAddWallet } from "@/features/wallets/hooks/use-wallets";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const {
    address,
    connectWallet,
    disconnectWallet,
    isConnected,
    isConnecting,
  } = useWallet();
  const { mutate: addWallet } = useAddWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateUser = useUpdateUser();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (isOpen) {
      console.log("[ConnectWalletModal] Modal opened");
    }
  }, [isOpen]);

  const handleConnectClick = async () => {
    console.log(
      "[ConnectWalletModal] Connect button clicked, calling connectWallet"
    );
    try {
      await connectWallet();
      console.log("[ConnectWalletModal] connectWallet resolved");
    } catch (err) {
      console.error("[ConnectWalletModal] connectWallet threw error:", err);
    }
  };

  const handleSaveWallet = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }
    addWallet({ chainId: "stellar", address });
    toast.success("Wallet connected successfully!");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 h-screen w-screen"
          {...fadeIn}
        >
          <motion.div
            className="fixed inset-0 bg-black/70 brightness-50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px]">
            <motion.div className="relative z-10">
              <div className="relative rounded-[14.77px] bg-black p-3 lg:p-6">
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h2 className="text-xl lg:text-2xl font-semibold text-white tracking-[-0.03em]">
                    Connect Your Wallet
                  </h2>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1 lg:p-1.5 hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                  </button>
                </div>

                <p className="text-sm text-white/70 mb-6">
                  Connect your Stellar wallet to enable sending and receiving
                  payments
                </p>

                {isConnected && address && (
                  <div className="text-body-sm text-white/50 mb-4">
                    Connected with {address?.slice(0, 25) + "..."}
                  </div>
                )}

                <div className="space-y-4">
                  <motion.button
                    onClick={handleConnectClick}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full h-[42px] rounded-[15px] bg-[#1F1F23] text-sm font-medium text-white hover:bg-[#2a2a2e] transition-colors border border-white/75 flex items-center justify-center gap-2"
                    disabled={isConnecting}
                  >
                    {isConnecting
                      ? "Connecting..."
                      : isConnected && address
                      ? "Disconnect Wallet"
                      : "Connect Wallet"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: isSubmitting || !address ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting || !address ? 1 : 0.98 }}
                    className="w-full h-[42px] rounded-[15px] bg-[#3E3E43] text-sm font-medium text-white hover:bg-[#4a4a50] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSaveWallet}
                    disabled={isSubmitting || !address}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Save Wallet"
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
