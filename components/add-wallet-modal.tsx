"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "@/utils/animations";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  StellarWalletsKit,
  allowAllModules,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import { STELLAR_WALLET_NETWORK } from "@/lib/chain-network";
import {
  useAvailableChains,
  useAddWallet,
  useUserWallets,
  useSetWalletAsPrimary,
} from "@/features/wallets/hooks/use-wallets";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AccountAddress } from "@aptos-labs/ts-sdk";

interface Chain {
  id: string;
  name: string;
  enabled: boolean;
}

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fallback chains in case API fails (matching design artifact)
const FALLBACK_CHAINS = [
  { id: "stellar", name: "Stellar", enabled: true },
  { id: "solana", name: "Solana", enabled: true },
  { id: "base", name: "Base", enabled: true },
  { id: "aptos", name: "Aptos", enabled: true },
];

// Chain metadata for styling (matching design artifact)
const getChainMeta = (chainId: string) => {
  const metaMap: Record<string, { color: string; icon: string }> = {
    stellar: { color: "#34D399", icon: "✦" },
    solana: { color: "#A78BFA", icon: "◎" },
    base: { color: "#3B82F6", icon: "🔵" },
    aptos: { color: "#22D3EE", icon: "⬡" },
  };
  return metaMap[chainId] || { color: "#666", icon: "◆" };
};

export const AddWalletModal = ({ isOpen, onClose }: AddWalletModalProps) => {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [tab, setTab] = useState<"manual" | "connect">("manual");
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const walletKitRef = useRef<StellarWalletsKit | null>(null);
  const [aptosAddress, setAptosAddress] = useState<string>("");

  // Fetch user's wallets and available chains
  const { data: walletData } = useUserWallets();
  const userWallets = walletData?.accounts || [];
  const { data: availableChains, isLoading: chainsLoading } =
    useAvailableChains();

  // Add wallet mutation
  const { mutate: addWalletMutation, isPending: isAddingWallet } =
    useAddWallet();
  const { mutate: _setPrimaryWallet, isPending: isSettingPrimary } =
    useSetWalletAsPrimary();

  // Process chains data
  const chains = availableChains?.chains || FALLBACK_CHAINS;

  // Initialize Stellar Wallets Kit
  useEffect(() => {
    if (!walletKitRef.current) {
      walletKitRef.current = new StellarWalletsKit({
        // Driven by NEXT_PUBLIC_CHAIN_NETWORK, mirroring the backend's CHAIN_NETWORK.
        network: STELLAR_WALLET_NETWORK,
        selectedWalletId: XBULL_ID, // Default selected wallet
        modules: allowAllModules(),
      });
    }

    return () => {
      // Cleanup if needed
      walletKitRef.current = null;
    };
  }, []);

  // Set initial chain when data is loaded
  useEffect(() => {
    if (chains.length > 0 && !selectedChain && isOpen) {
      setSelectedChain(chains[0]);
    }
  }, [chains, selectedChain, isOpen]);

  // Clear wallet address when chain changes
  useEffect(() => {
    setWalletAddress("");
  }, [selectedChain]);

  const handleSubmit = async () => {
    if (!walletAddress.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }

    if (!selectedChain) {
      toast.error("Please select a blockchain");
      return;
    }

    // Basic client-side validation based on chain type
    if (selectedChain.id === "stellar") {
      // Stellar addresses should start with G and be 56 characters long
      // For Stellar: public keys are 56 chars and start with G
      if (!/^G[A-Z0-9]{55}$/.test(walletAddress)) {
        toast.error(
          "Invalid Stellar address format. Addresses should start with G and be 56 characters long."
        );
        return;
      }
    } else if (selectedChain.id === "base") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        toast.error(
          "Invalid Base address format. Addresses should start with 0x and be 42 characters long."
        );
        return;
      }
    } else if (selectedChain.id === "solana") {
      // Solana addresses are typically base58 encoded and 32-44 characters
      if (walletAddress.length < 32 || walletAddress.length > 44) {
        toast.error("Invalid Solana address format.");
        return;
      }
    } else if (selectedChain.id === "aptos") {
    try {
      const parsed = AccountAddress.fromString(walletAddress);
      // Optional strict check (only 64 hex chars)
      if (!/^0x[a-fA-F0-9]{64}$/.test(parsed.toString())) {
        throw new Error("Not 64 hex chars");
      }
    } catch {
      toast.error("Invalid Aptos address. Must be a valid 0x-prefixed 64-character hex string.");
      return;
    }
  }

    // Make sure we're using the exact chainId as expected by the backend
    // Use "xlm" when the selected chain is "stellar"
    const chainId = selectedChain.id;

    // Add the wallet using our mutation
    addWalletMutation(
      {
        chainId,
        address: walletAddress,
        isPrimary: userWallets.length === 0,
      },
      {
        onSuccess: () => {
          // Reset form
          setWalletAddress("");

          // Close modal
          onClose();
        },
      }
    );
  };

  // Function to handle chain selection
  const handleChainSelect = (chain: Chain) => {
    setSelectedChain(chain);
  };

  // Get placeholder with the selected chain name
  const getPlaceholder = (): string => {
    const chainName =
      chains.find((c) => c.id === selectedChain?.id)?.name || "blockchain";
    return `Enter ${chainName} wallet address`;
  };

  // Handle connect wallet with Stellar Wallets Kit
  const handleConnectWallet = async () => {
    if (isConnectingWallet) return;

    setIsConnectingWallet(true);

    try {
      if (selectedChain?.id !== "stellar") {
        toast.error(
          "Web wallet connection only works with Stellar blockchain."
        );
        setIsConnectingWallet(false);
        return;
      }

      if (!walletKitRef.current) {
        toast.error("Wallet connection is not available");
        setIsConnectingWallet(false);
        return;
      }

      // Open wallet selection modal with callback for wallet selection
      await walletKitRef.current.openModal({
        onWalletSelected: async (selectedWallet) => {
          try {
            if (!selectedWallet) {
              return;
            }

            if (!walletKitRef.current) return;

            walletKitRef.current.setWallet(selectedWallet.id);

            // Get wallet address
            const response = await walletKitRef.current.getAddress();
            const publicKey =
              typeof response === "object" && response !== null
                ? response.address
                : response;

            if (!publicKey || typeof publicKey !== "string") {
              toast.error("Failed to get wallet address. Please try again.");
              return;
            }

            try {
              // Add the wallet using our mutation hook
              addWalletMutation(
                {
                  chainId: "stellar", // Use 'stellar' for Stellar chain ID
                  address: publicKey,
                  isPrimary: userWallets.length === 0,
                },
                {
                  onSuccess: () => {
                    toast.success("Stellar wallet connected successfully!");
                    onClose();
                  },
                }
              );
            } catch (error) {
              console.error("Error adding wallet:", error);
              // Error is handled by addWallet function
            }
          } catch (error) {
            console.error("Error in wallet selection:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to connect wallet. Please try again."
            );
          } finally {
            setIsConnectingWallet(false);
          }
        },
      });
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect wallet. Please try again."
      );
      setIsConnectingWallet(false);
    }
  };

  const handleAptosWalletConnectMutate = async (address: string) => {
    try {
      if (!address) {
        toast.error("Please connect your Aptos wallet first.");
        return;
      }

      // Check if the wallet is already connected
      const existingWallet = userWallets.find(
        (wallet) => wallet.chainId === "aptos" && wallet.address === address
      );

      if (existingWallet) {
        toast.error("Aptos wallet is already connected.");
        return;
      }
      addWalletMutation(
        {
          chainId: "aptos",
          address: address,
          isPrimary: userWallets.length === 0,
        },
        {
          onSuccess: () => {
            toast.success("Aptos wallet connected successfully!");
            setAptosAddress("");
            onClose();
          },
        }
      );
    } catch (error) {
      console.error("Aptos Wallet Connect Error:", error);
      toast.error("Failed to connect Aptos wallet.");
    }

    
  }

  const { account, connected, wallets, connect } = useWallet();

  useEffect(() => {
    if (connected && account?.address) {
      setAptosAddress(account.address.toString());
      // handleAptosWalletConnectMutate(account.address.toString());
    } else {
      setAptosAddress("");
    }
  }, [connected, account]);

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
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[460px]">
            <motion.div
              className="relative z-10"
              style={{
                background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 28,
                padding: 28,
                boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
              }}
              {...scaleIn}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                  Wallet
                </p>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#bbb",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Tab Switcher */}
              <div
                className="flex gap-1 mb-6"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 14,
                  padding: 4,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {[
                  ["manual", "Manual Address"],
                  ["connect", "Connect Wallet"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k as "manual" | "connect")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: tab === k ? "rgba(255,255,255,0.1)" : "none",
                      color: tab === k ? "#fff" : "#999",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: tab === k ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Manual Tab */}
              {tab === "manual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label
                      htmlFor="wallet-address"
                      style={{
                        color: "#ccc",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                        display: "block",
                      }}
                    >
                      Wallet Address
                    </label>
                    <input
                      id="wallet-address-input"
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.05)",
                        border: "1.5px solid rgba(255,255,255,0.09)",
                        borderRadius: 14,
                        padding: "14px 16px",
                        color: "#fff",
                        fontSize: 14,
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                      placeholder={getPlaceholder()}
                      disabled={isAddingWallet || isSettingPrimary}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        color: "#ccc",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                        display: "block",
                      }}
                    >
                      Blockchain
                    </label>

                    {chainsLoading ? (
                      <div className="flex items-center p-3 text-white/70">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="wallet-chain-dropdown"
                          value={selectedChain?.id || ""}
                          onChange={(e) =>
                            handleChainSelect(
                              chains.find((c) => c.id === e.target.value)!
                            )
                          }
                          disabled={isAddingWallet || isSettingPrimary}
                          style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.05)",
                            border: "1.5px solid rgba(255,255,255,0.09)",
                            borderRadius: 14,
                            padding: "14px 44px 14px 16px",
                            color: "#fff",
                            fontSize: 14,
                            outline: "none",
                            fontFamily: "inherit",
                            cursor: "pointer",
                            appearance: "none",
                          }}
                        >
                          {chains.map((chain) => (
                            <option
                              key={chain.id}
                              value={chain.id}
                              style={{ background: "#1a1a1a" }}
                            >
                              {chain.name}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            position: "absolute",
                            right: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#999",
                            pointerEvents: "none",
                          }}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    id="wallet-submit-button"
                    onClick={handleSubmit}
                    disabled={isAddingWallet || isSettingPrimary || chainsLoading || !walletAddress}
                    style={{
                      width: "100%",
                      padding: "15px",
                      background: walletAddress && !isAddingWallet && !isSettingPrimary ? "#22D3EE" : "rgba(255,255,255,0.05)",
                      color: walletAddress && !isAddingWallet && !isSettingPrimary ? "#0a0a0a" : "#555",
                      border: "none",
                      borderRadius: 14,
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: walletAddress && !isAddingWallet && !isSettingPrimary ? "pointer" : "default",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                      marginTop: 4,
                    }}
                  >
                    {isAddingWallet || isSettingPrimary ? "Adding..." : "Add Wallet"}
                  </button>
                </div>
              )}

              {/* Connect Tab */}
              {tab === "connect" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p
                    style={{
                      color: "#999",
                      fontSize: 13,
                      marginBottom: 6,
                      fontWeight: 500,
                      lineHeight: 1.5,
                    }}
                  >
                    Choose a chain and connect your wallet extension.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    {chains.map((chain) => {
                      const meta = getChainMeta(chain.id);
                      const isSelected = selectedChain?.id === chain.id;
                      return (
                        <button
                          key={chain.id}
                          onClick={() => handleChainSelect(chain)}
                          style={{
                            padding: "12px 6px",
                            background: isSelected
                              ? `${meta.color}18`
                              : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${
                              isSelected
                                ? `${meta.color}55`
                                : "rgba(255,255,255,0.08)"
                            }`,
                            borderRadius: 16,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.2s",
                            fontFamily: "inherit",
                            boxShadow: isSelected
                              ? `0 0 16px ${meta.color}22`
                              : "none",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 20,
                              color: "#fff",
                            }}
                          >
                            {meta.icon}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isSelected ? meta.color : "#999",
                            }}
                          >
                            {chain.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Connect Button for Stellar */}
                  {selectedChain?.id === "stellar" && (
                    <>
                      <button
                        type="button"
                        onClick={handleConnectWallet}
                        disabled={isConnectingWallet}
                        style={{
                          width: "100%",
                          padding: "15px",
                          background: "#22D3EE",
                          color: "#0a0a0a",
                          border: "none",
                          borderRadius: 14,
                          fontSize: 15,
                          fontWeight: 800,
                          cursor: isConnectingWallet ? "default" : "pointer",
                          fontFamily: "inherit",
                          marginTop: 4,
                        }}
                      >
                        {isConnectingWallet ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Connecting...</span>
                          </div>
                        ) : (
                          `Connect ${selectedChain.name} Wallet`
                        )}
                      </button>
                      <p
                        style={{
                          color: "#999",
                          fontSize: 11,
                          textAlign: "center",
                          marginTop: 2,
                          fontWeight: 600,
                        }}
                      >
                        Connect with Petra, Martian, and other {selectedChain.name} wallets
                      </p>
                    </>
                  )}

                  {/* Connect Button for Aptos */}
                  {selectedChain?.id === "aptos" && (
                    <>
                      {connected && account?.address ? (
                        <>
                          <div
                            style={{
                              padding: "12px 14px",
                              background: "rgba(34,211,238,0.08)",
                              border: "1px solid rgba(34,211,238,0.2)",
                              borderRadius: 12,
                            }}
                          >
                            <p
                              style={{
                                fontSize: 11,
                                color: "#999",
                                marginBottom: 4,
                                fontWeight: 600,
                              }}
                            >
                              Connected Address
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                color: "#22D3EE",
                                fontFamily: "monospace",
                                wordBreak: "break-all",
                              }}
                            >
                              {aptosAddress ||
                                (account.address.toString
                                  ? account.address.toString()
                                  : String(account.address))}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              handleAptosWalletConnectMutate(
                                aptosAddress ||
                                  (account.address.toString
                                    ? account.address.toString()
                                    : String(account.address))
                              );
                            }}
                            style={{
                              width: "100%",
                              padding: "15px",
                              background: "#22D3EE",
                              color: "#0a0a0a",
                              border: "none",
                              borderRadius: 14,
                              fontSize: 15,
                              fontWeight: 800,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              transition: "all 0.2s",
                              marginTop: 4,
                            }}
                          >
                            {userWallets.some(
                              (w) =>
                                w.chainId === "aptos" &&
                                w.address ===
                                  (account.address.toString
                                    ? account.address.toString()
                                    : String(account.address))
                            )
                              ? "Update Wallet"
                              : "Save Wallet"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (wallets && wallets.length > 0) {
                              try {
                                connect(wallets[0].name);
                              } catch (error) {
                                console.error("Failed to connect wallet:", error);
                                toast.error("Failed to connect wallet");
                              }
                            } else {
                              toast.error("No Aptos wallets found. Please install Petra or Martian wallet.");
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "15px",
                            background: "#22D3EE",
                            color: "#0a0a0a",
                            border: "none",
                            borderRadius: 14,
                            fontSize: 15,
                            fontWeight: 800,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            marginTop: 4,
                          }}
                        >
                          Connect {selectedChain.name} Wallet
                        </button>
                      )}
                      <p
                        style={{
                          color: "#999",
                          fontSize: 11,
                          textAlign: "center",
                          marginTop: 2,
                          fontWeight: 600,
                        }}
                      >
                        Connect with Petra, Martian, and other {selectedChain.name} wallets
                      </p>
                    </>
                  )}

                  {/* Other chains */}
                  {selectedChain?.id !== "stellar" && selectedChain?.id !== "aptos" && (
                    <>
                      <button
                        type="button"
                        disabled
                        style={{
                          width: "100%",
                          padding: "15px",
                          background: "rgba(255,255,255,0.05)",
                          color: "#555",
                          border: "none",
                          borderRadius: 14,
                          fontSize: 15,
                          fontWeight: 800,
                          cursor: "default",
                          fontFamily: "inherit",
                          marginTop: 4,
                        }}
                      >
                        Connect {selectedChain?.name} Wallet
                      </button>
                      <p
                        style={{
                          color: "#999",
                          fontSize: 11,
                          textAlign: "center",
                          marginTop: 2,
                          fontWeight: 600,
                        }}
                      >
                        Connect with Petra, Martian, and other {selectedChain?.name} wallets
                      </p>
                    </>
                  )}

                  {/* Divider */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "rgba(255,255,255,0.07)",
                      }}
                    />
                    <span style={{ color: "#999", fontSize: 11, fontWeight: 600 }}>
                      OR
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "rgba(255,255,255,0.07)",
                      }}
                    />
                  </div>

                  {/* Manual Entry Button */}
                  <button
                    onClick={() => setTab("manual")}
                    style={{
                      width: "100%",
                      padding: "13px",
                      background: "rgba(255,255,255,0.05)",
                      color: "#e8e8e8",
                      border: "1.5px solid rgba(255,255,255,0.09)",
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Enter address manually
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};