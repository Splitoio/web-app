"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import {
  useUpdateUser,
  useGetSettlementPreference,
  useSaveSettlementPreference,
  useRemoveSettlementPreference,
  useUpdateSettlementWallet,
} from "@/features/user/hooks/use-update-profile";
import { asEnhancedUser } from "@/types/user";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { useGetAllCurrencies } from "@/features/currencies/hooks/use-currencies";
import { SettingsPageContent } from "@/app/settings/settings-page-content";

// Base API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type CurrencyDisplay = "both" | "real" | "converted";

interface UserUpdateData {
  name?: string;
  currency?: string;
  currencyDisplay?: CurrencyDisplay;
  [key: string]: string | undefined;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user, setUser } = useAuthStore();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { mutate: updateUser, isPending: isUpdatatingUser } = useUpdateUser();

  const [displayName, setDisplayName] = useState<string>("");
  const [preferredCurrency, setPreferredCurrency] = useState<string>("");
  const [initialDisplayName, setInitialDisplayName] = useState<string>("");
  const [initialPreferredCurrency, setInitialPreferredCurrency] = useState<string>("");

  // Settlement preference hooks
  const { data: settlementPref, isLoading: isLoadingPref } = useGetSettlementPreference();
  const { mutate: savePref, isPending: isSavingPref } = useSaveSettlementPreference();
  const { mutate: removePref, isPending: isRemovingPref } = useRemoveSettlementPreference();
  const { mutate: updateWallet, isPending: isUpdatingWallet } = useUpdateSettlementWallet();

  const { data: currencyData } = useGetAllCurrencies();

  const hasChanges =
    displayName !== initialDisplayName ||
    preferredCurrency !== initialPreferredCurrency;

  const getPlatformDefaultCurrency = (): string => {
    if (typeof navigator === "undefined") return "USD";
    try {
      const locale = navigator.language || "en-US";
      const region = locale.split("-")[1] || locale.split("-")[0];
      const map: Record<string, string> = {
        US: "USD", GB: "GBP", IN: "INR", JP: "JPY",
        CN: "CNY", AU: "AUD", CA: "CAD", CH: "CHF", EU: "EUR",
      };
      return map[region] || "USD";
    } catch { return "USD"; }
  };

  useEffect(() => {
    if (user) {
      const enhancedUser = asEnhancedUser(user);
      const name = enhancedUser.name || "";
      const currency = enhancedUser.currency || getPlatformDefaultCurrency();
      setDisplayName(name);
      setPreferredCurrency(currency);
      setInitialDisplayName(name);
      setInitialPreferredCurrency(currency);
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!hasChanges) return;
    const updateData: UserUpdateData = {};
    if (displayName !== initialDisplayName) updateData.name = displayName;
    if (preferredCurrency !== initialPreferredCurrency) updateData.currency = preferredCurrency;

    updateUser(updateData, {
      onSuccess: () => {
        setInitialDisplayName(displayName);
        setInitialPreferredCurrency(preferredCurrency);
        if (user) {
          setUser({
            ...user,
            ...(updateData.name !== undefined && { name: updateData.name }),
            ...(updateData.currency !== undefined && { currency: updateData.currency }),
          });
        }
        toast.success("Profile updated successfully");
      },
      onError: () => toast.error("Failed to update profile"),
    });
  };

  const currencyDisplay = useCurrencyDisplayStore((s) => s.mode);
  const setCurrencyDisplayMode = useCurrencyDisplayStore((s) => s.setMode);

  const handleCurrencyDisplayChange = (mode: CurrencyDisplay) => {
    if (mode === currencyDisplay) return;
    const prev = currencyDisplay;
    setCurrencyDisplayMode(mode);
    updateUser({ currencyDisplay: mode }, {
      onSuccess: () => {
        if (user) setUser({ ...user, currencyDisplay: mode });
        toast.success("Currency display updated");
      },
      onError: () => {
        setCurrencyDisplayMode(prev);
        toast.error("Failed to update currency display");
      },
    });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    if (!newCurrency || newCurrency === initialPreferredCurrency) return;
    setPreferredCurrency(newCurrency);
    updateUser({ currency: newCurrency }, {
      onSuccess: () => {
        setInitialPreferredCurrency(newCurrency);
        if (user) setUser({ ...user, currency: newCurrency });
        toast.success("Currency updated");
      },
      onError: () => {
        toast.error("Failed to update currency");
        setPreferredCurrency(initialPreferredCurrency);
      },
    });
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      setUser(null);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      toast.error("Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Settlement preference handlers
  const handleSaveSettlementPreference = (data: { tokenIds: string[]; chainId: string; walletAddress: string }, onSuccess?: () => void) => {
    savePref(data, {
      onSuccess: () => { toast.success("Settlement preference saved"); onSuccess?.(); },
      onError: (err: any) => toast.error(err?.message || "Failed to save settlement preference"),
    });
  };

  const handleRemoveSettlementPreference = (chainId: string) => {
    removePref(chainId, {
      onSuccess: () => toast.success("Settlement preference removed"),
      onError: () => toast.error("Failed to remove settlement preference"),
    });
  };

  const handleUpdateSettlementWallet = (walletAddress: string, chainId: string, onSuccess?: () => void) => {
    updateWallet({ walletAddress, chainId }, {
      onSuccess: () => { toast.success("Wallet address updated"); onSuccess?.(); },
      onError: (err: any) => toast.error(err?.message || "Failed to update wallet address"),
    });
  };

  // Handle file upload for profile picture
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    try {
      setIsUploadingImage(true);
      setUploadProgress(0);
      setUploadError("");

      const response = await fetch(`${API_URL}/api/files/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileType: file.type, fileName: file.name, folder: "profile-pictures" }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, downloadUrl } = await response.json();

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      await new Promise((resolve, reject) => {
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error(`Upload failed with status ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      updateUser({ image: downloadUrl }, {
        onSuccess: () => toast.success("Profile picture updated successfully"),
        onError: () => toast.error("Failed to update profile picture"),
      });
    } catch (error) {
      console.error("Image upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Failed to upload image");
      toast.error("Failed to upload profile picture");
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-white/50" />
          <p className="text-white/70 text-lg">Loading your profile...</p>
        </div>
      </div>
    );
  } else if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/70 text-lg">
          You need to be logged in to view this page. Redirecting...
        </div>
      </div>
    );
  }

  return React.createElement(SettingsPageContent, {
    user,
    displayName,
    setDisplayName,
    preferredCurrency,
    setPreferredCurrency,
    onCurrencyChange: handleCurrencyChange,
    hasChanges,
    handleSaveChanges,
    isUpdatatingUser,
    isUploadingImage,
    uploadProgress,
    uploadError,
    handleImageUpload,
    onLogout: handleLogout,
    isLoggingOut,
    // Settlement preference
    settlementPrefs: settlementPref ?? [],
    isLoadingPref,
    isSavingPref,
    isRemovingPref,
    isUpdatingWallet,
    onSaveSettlementPref: handleSaveSettlementPreference,
    onRemoveSettlementPref: handleRemoveSettlementPreference,
    onUpdateSettlementWallet: handleUpdateSettlementWallet,
    allCurrencies: currencyData?.currencies || [],
    currencyDisplay,
    onCurrencyDisplayChange: handleCurrencyDisplayChange,
  });
}
