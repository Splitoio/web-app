"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth";
import { Btn, T, A, R, Icons, BORDER, INSET } from "@/lib/splito-design";

const EyeIcon = ({ show, size = 16 }: { show: boolean; size?: number }) =>
  show ? <EyeOff size={size} /> : <Eye size={size} />;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        handleClose();
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setIsLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: INSET,
    border: "1.5px solid rgba(255,255,255,0.09)",
    borderRadius: 12,
    padding: "11px 44px 11px 14px",
    color: "#fff",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    fontWeight: 500,
    boxSizing: "border-box",
  };

  const eyeBtn: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: T.muted,
    display: "flex",
    alignItems: "center",
    padding: 0,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-2xl shadow-2xl"
            style={{
              background: "linear-gradient(145deg, #111 0%, #0d0d0d 100%)",
              border: BORDER,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: A, display: "flex" }}>{Icons.shield({ size: 18 })}</span>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Change Password</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Current password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.soft, marginBottom: 6 }}>
                  Current Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={inputStyle}
                    autoComplete="current-password"
                  />
                  <button type="button" style={eyeBtn} onClick={() => setShowCurrent((v) => !v)}>
                    <EyeIcon show={showCurrent} />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.soft, marginBottom: 6 }}>
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                  <button type="button" style={eyeBtn} onClick={() => setShowNew((v) => !v)}>
                    <EyeIcon show={showNew} />
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.soft, marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                  <button type="button" style={eyeBtn} onClick={() => setShowConfirm((v) => !v)}>
                    <EyeIcon show={showConfirm} />
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p style={{ fontSize: 12, color: R, marginTop: 5 }}>Passwords don&apos;t match</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: A,
                    border: "none",
                    borderRadius: 12,
                    padding: "9px 18px",
                    color: "#0a0a0a",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.7 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLoading ? "Saving…" : "Save Password"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
