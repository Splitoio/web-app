"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid or expired reset link. Please request a new one.");
      return;
    }
    setIsLoading(true);
    try {
      await authClient.resetPassword({ newPassword: password, token });
      toast.success("Password updated! Please log in.");
      router.push("/login");
    } catch {
      toast.error("Failed to reset password. The link may have expired.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] flex items-center justify-center relative px-4 py-8">
      <div className="absolute -left-1/3 lg:-left-1/4 w-full h-full bg-[url('/final_bgsvg.svg')] bg-no-repeat opacity-50 hidden sm:block" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[440px] sm:px-0"
      >
        <div className="animate-border-light">
          <div className="relative rounded-[24px] !bg-[#0f0f10] p-8 space-y-6">
            <div className="flex justify-center mb-4">
              <Image src="/logo.svg" alt="Splito" width={140} height={56} priority />
            </div>

            <h1 className="text-2xl font-semibold text-white text-center">Set new password</h1>
            <p className="text-center text-sm text-white/60 -mt-2">
              Enter a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label htmlFor="password" className="form-label">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    className="form-input !rounded-[12px] !bg-[#0D0D0F] !pl-12 !border-white/10"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-[52px] flex items-center justify-center rounded-xl bg-splito-a text-[#0a0a0a] font-semibold text-base transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !token}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update password"}
              </button>

              {!token && (
                <p className="text-center text-sm text-red-400">
                  Invalid reset link.{" "}
                  <Link href="/forgot-password" className="underline">
                    Request a new one
                  </Link>
                </p>
              )}
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
