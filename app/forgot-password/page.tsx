"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setSent(true);
      toast.success("Reset link sent — check your inbox.");
    } catch {
      toast.error("Failed to send reset email. Please try again.");
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

            <h1 className="text-2xl font-semibold text-white text-center">Reset password</h1>
            <p className="text-center text-sm text-white/60 -mt-2">
              Enter your email and we&apos;ll send a reset link.
            </p>

            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-white/70">Check your inbox for the reset link.</p>
                <Link href="/login" className="text-sm text-splito-a hover:underline">
                  Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      className="form-input !rounded-[12px] !bg-[#0D0D0F] !pl-12 !border-white/10"
                      placeholder="email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-[52px] flex items-center justify-center rounded-xl bg-splito-a text-[#0a0a0a] font-semibold text-base transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send reset link"}
                </button>

                <p className="text-center text-sm text-white/60">
                  <Link href="/login" className="text-white hover:underline font-medium">
                    Back to login
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
