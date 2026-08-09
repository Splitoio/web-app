"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth";
import { toast } from "sonner";
import { ApiError } from "@/types/api-error";
import { safeCallbackPath } from "@/lib/middleware-session";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M19.8055 10.2298C19.8055 9.51795 19.7434 8.83835 19.6299 8.18213H10.2002V11.9624H15.6016C15.3853 13.1709 14.6875 14.1933 13.6543 14.8622V17.311H16.8564C18.7502 15.5938 19.8055 13.1499 19.8055 10.2298Z" fill="#4285F4" />
      <path d="M10.1999 20.0001C12.8999 20.0001 15.1499 19.115 16.8561 17.3113L13.654 14.8625C12.7754 15.4513 11.6077 15.7968 10.1999 15.7968C7.5938 15.7968 5.38819 14.0732 4.58777 11.7H1.28149V14.2318C2.9752 17.6232 6.3313 20.0001 10.1999 20.0001Z" fill="#34A853" />
      <path d="M4.58753 11.7002C4.18753 10.4917 4.18753 9.17 4.58753 7.9615V5.42969H1.28126C-0.119933 8.00938 -0.119933 11.6523 1.28126 14.232L4.58753 11.7002Z" fill="#FBBC05" />
      <path d="M10.1999 4.20378C11.6218 4.18533 12.9998 4.73503 14.0345 5.72847L16.8959 2.8671C15.1044 1.18895 12.6958 0.200905 10.1999 0.229336C6.3313 0.229336 2.9752 2.60621 1.28149 5.99761L4.58777 8.52941C5.38819 6.15621 7.5938 4.43261 10.1999 4.20378Z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl")) ?? "/";
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [formData, setFormData] = useState({
    // `?email=` is prefill only, never a lock: an invite link sends the address
    // it was issued to (app/invite/[token]/page.tsx) so the invited person
    // doesn't have to retype it, but they stay free to sign in as someone else.
    email: searchParams.get("email") ?? "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Two responsive copies of this form share the DOM (desktop card below vs
    // the sm:hidden mobile block) — only one is ever on screen, but both are
    // real <form> elements. offsetParent is null when an ancestor has
    // display:none, which is exactly how Tailwind's hidden/sm:hidden hides
    // the other copy, so this stops a submit on the off-screen copy (e.g. an
    // automated form-filler that doesn't respect CSS visibility) from firing
    // a second sign-in alongside the visible one.
    if (e.currentTarget.offsetParent === null) return;
    setIsLoadingEmail(true);

    try {
      const { data, error } = await authClient.signIn.email({
        email: formData.email,
        password: formData.password,
        callbackURL: "/",
      });

      if (error) {
        toast.error(error.message || "Failed to sign in. Please try again.");
      } else if (data) {
        toast.success("Signed in successfully!");

        // Use window.location instead of router.push to force a full page reload
        // This ensures cookies are properly set before navigating to protected pages
        window.location.href = callbackUrl;
        return; // Don't reset loading state as we're navigating away
      }
    } catch (error) {
      const apiError = error as ApiError;
      const statusCode =
        apiError.response?.status || apiError.status || apiError.code;

      if (statusCode === 401) {
        toast.error("Invalid email or password. Please try again.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    }

    setIsLoadingEmail(false);
  };

  const handleGoogleLogin = async () => {
    setIsLoadingGoogle(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
        errorCallbackURL: window.location.origin + "/login",
      });
      // Note: We don't need to reset loading state here as the page will redirect
    } catch (error) {
      toast.error("Failed to sign in with Google. Please try again.");
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--splito-bg)] flex items-center justify-center relative px-4 py-8">
      <div className="absolute -left-1/3 lg:-left-1/4 w-full h-full bg-[url('/final_bgsvg.svg')] bg-no-repeat opacity-50 hidden sm:block" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.23, 1, 0.32, 1],
        }}
        className="w-full max-w-[440px] sm:px-0"
      >
        {/* Card container only visible on desktop */}
        <div className="hidden sm:block animate-border-light">
          <div className="relative rounded-[24px] !bg-[#0f0f10] p-8 space-y-6">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.svg"
                alt="Splito"
                width={140}
                height={56}
                priority
              />
            </div>

            <h1 className="text-2xl font-semibold text-white text-center">
              Welcome Back
            </h1>
            <p className="text-center text-sm text-white/60 -mt-2">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-white hover:underline font-medium">
                Sign up
              </Link>
            </p>

            {/* Google as full-width strip first */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-[52px] flex items-center justify-center gap-3 rounded-xl
                bg-[#1a1a1c] border border-white/10
                text-base font-medium text-white
                transition-all duration-200 hover:bg-white/[0.06] hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoadingEmail || isLoadingGoogle}
            >
              {isLoadingGoogle ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon />
                  <span>Login with Google</span>
                </>
              )}
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-white/10" />
              <span className="px-4 text-sm text-white/40">OR</span>
              <div className="flex-grow border-t border-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label htmlFor="email-desktop" className="form-label">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email-desktop"
                    className="form-input !rounded-[12px] !bg-[#0D0D0F] !pl-12 !border-white/10"
                    placeholder="email address"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password-desktop" className="form-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password-desktop"
                    className="form-input !rounded-[12px] !bg-[#0D0D0F] !pl-12 !border-white/10"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoadingEmail || isLoadingGoogle}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-white/50 hover:text-white/70 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                className="w-full h-[52px] flex items-center justify-center rounded-xl
                  bg-splito-a text-[#0a0a0a] font-semibold text-base
                  transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoadingEmail || isLoadingGoogle}
              >
                {isLoadingEmail ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Mobile view - same layout: Google first (full width), then OR, email/password */}
        <div className="sm:hidden w-full flex flex-col min-h-[calc(100vh-48px)] justify-between">
          <div className="flex flex-col space-y-6 pt-10">
            <div className="flex justify-center">
              <Image
                src="/logo.svg"
                alt="Splito"
                width={120}
                height={48}
                className="w-[100px]"
                priority
              />
            </div>

            <h1 className="text-xl font-semibold text-white text-center">
              Welcome Back
            </h1>
            <p className="text-center text-sm text-white/60 -mt-2">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-white hover:underline font-medium">
                Sign up
              </Link>
            </p>

            {/* Google full-width strip first */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full h-[52px] flex items-center justify-center gap-3 rounded-xl
                bg-[#1a1a1c] border border-white/10
                text-base font-medium text-white
                transition-all duration-200 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoadingEmail || isLoadingGoogle}
            >
              {isLoadingGoogle ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon />
                  <span>Login with Google</span>
                </>
              )}
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-white/10" />
              <span className="px-4 text-sm text-white/40">OR</span>
              <div className="flex-grow border-t border-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="form-group">
                <label htmlFor="email-mobile" className="text-sm font-medium text-white/80 mb-2 block">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email-mobile"
                    className="w-full bg-[#0D0D0F] border border-white/10 rounded-xl px-4 pl-11 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-white/20 placeholder-white/40"
                    placeholder="email address"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password-mobile" className="text-sm font-medium text-white/80 mb-2 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password-mobile"
                    className="w-full bg-[#0D0D0F] border border-white/10 rounded-xl px-4 pl-11 py-3 text-white focus:ring-2 focus:ring-white/20 focus:border-white/20 placeholder-white/40"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    disabled={isLoadingEmail || isLoadingGoogle}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoadingEmail || isLoadingGoogle}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-white/50 hover:text-white/70 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                className="w-full h-[52px] flex items-center justify-center rounded-xl
                  bg-splito-a text-[#0a0a0a] font-semibold text-base
                  transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoadingEmail || isLoadingGoogle}
              >
                {isLoadingEmail ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>

          <div className="mt-auto pb-10">
            <p className="text-center text-sm text-white/60">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-white hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
