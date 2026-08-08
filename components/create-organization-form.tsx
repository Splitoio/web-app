"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { useCreateOrganization } from "@/features/business/hooks/use-organizations";
import { useAddMembersToGroup } from "@/features/groups/hooks/use-create-group";
import { useAddFriend } from "@/features/friends/hooks/use-add-friend";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { isValidEmail } from "@/utils/validation";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/api-helpers/client";
import Image from "next/image";
import { T, A, INSET } from "@/lib/splito-design";

interface CreateOrganizationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Member {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  exists: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: INSET,
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 14,
  padding: "12px 16px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontWeight: 500,
};

const labelStyle: React.CSSProperties = {
  color: "rgba(204,204,204,0.9)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 8,
  display: "block",
};

export function CreateOrganizationForm({ isOpen, onClose }: CreateOrganizationFormProps) {
  const { user } = useAuthStore();
  const createOrganizationMutation = useCreateOrganization();
  const addMembersMutation = useAddMembersToGroup();
  const addFriendMutation = useAddFriend();
  const router = useRouter();
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [formData, setFormData] = useState({ name: "", memberEmail: "" });
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const checkUserExists = async (email: string): Promise<Member | null> => {
    try {
      setIsCheckingEmail(true);
      const response = await apiClient.post("/users/friends/invite", { email, sendInviteEmail: false });
      const userData = response.data || response;
      return {
        id: userData.id || Date.now().toString(),
        email: userData.email || email,
        name: userData.name || email.split("@")[0],
        image: userData.image,
        exists: !!userData.emailVerified,
      };
    } catch {
      return { id: Date.now().toString(), email, name: email.split("@")[0], exists: false };
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const inviteMembers = async (organizationId: string) => {
    const invitationPromises = members.map((member) =>
      addMembersMutation.mutateAsync({ groupId: organizationId, memberIdentifier: member.email }).catch(() => null)
    );
    const friendPromises = members.map((member) =>
      addFriendMutation.mutateAsync(member.email).catch(() => null)
    );
    await Promise.all([...invitationPromises, ...friendPromises]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Please enter an organization name"); return; }
    createOrganizationMutation.mutate({ name: formData.name }, {
      onSuccess: async (data: { id: string }) => {
        if (members.length > 0) await inviteMembers(data.id);
        setFormData({ name: "", memberEmail: "" });
        setMembers([]);
        toast.success("Organization created successfully!");
        onClose();
        router.push(`/organization/organizations/${data.id}`);
      },
      onError: () => { toast.error("Failed to create organization"); },
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.memberEmail.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) { toast.error("Please enter a valid email address (e.g. name@example.com)"); return; }
    if (members.some((m) => m.email.toLowerCase() === email)) { toast.error("This member has already been added"); return; }
    const userCheck = await checkUserExists(email);
    if (userCheck) setMembers([...members, { ...userCheck, id: userCheck.id || Date.now().toString() }]);
    setFormData((prev) => ({ ...prev, memberEmail: "" }));
  };

  const removeMember = (memberId: string) => setMembers((m) => m.filter((member) => member.id !== memberId));

  if (!isOpen) return null;

  const isSubmitting = createOrganizationMutation.isPending;
  const canSubmit = !isSubmitting && !!formData.name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[500px] rounded-[28px] p-7 max-h-[90vh] overflow-y-auto"
        style={{
          background: "linear-gradient(160deg, #141414 0%, #0f0f0f 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          animation: "mIn 0.3s cubic-bezier(.34,1.56,.64,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Create Organization
            </p>
            <p style={{ color: T.mid, fontSize: 12, marginTop: 4 }}>
              Set up a new business organization.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.60)",
              width: 34, height: 34,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Organization name */}
          <div>
            <label style={labelStyle}>Organization Name</label>
            <input
              id="org-name-input"
              type="text"
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Acme Corp"
              style={inputStyle}
            />
          </div>

          {/* Invite admins */}
          <div>
            <label style={labelStyle}>Invite Admins</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={formData.memberEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, memberEmail: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMember(e))}
                placeholder="member@email.com"
                disabled={isCheckingEmail}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAddMember}
                disabled={isCheckingEmail || !formData.memberEmail.trim() || !isValidEmail(formData.memberEmail.trim())}
                style={{
                  width: 46, height: 46,
                  borderRadius: 14,
                  border: "1.5px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {isCheckingEmail ? <Loader2 style={{ width: 16, height: 16, animation: "spin 0.8s linear infinite" }} /> : <Plus style={{ width: 16, height: 16 }} />}
              </button>
            </div>

            {/* Member list */}
            {members.length > 0 && (
              <div className="mt-3 space-y-2">
                <AnimatePresence>
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 border border-white/[0.1]">
                        {member.image ? (
                          <Image src={member.image} alt={member.name || member.email} width={32} height={32} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[12px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                            {(member.name || member.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {member.name && <p className="text-[13px] font-semibold truncate" style={{ color: T.bright }}>{member.name}</p>}
                        <p className="text-[11px] truncate" style={{ color: T.dim }}>{member.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "none", border: "none", padding: 4, display: "flex" }}
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "13px",
                background: INSET,
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              id="org-create-button"
              type="submit"
              disabled={!canSubmit}
              style={{
                flex: 2,
                padding: "13px",
                background: canSubmit ? A : INSET,
                color: canSubmit ? "#0a0a0a" : "#555",
                border: "none",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 800,
                cursor: canSubmit ? "pointer" : "default",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 style={{ width: 16, height: 16, animation: "spin 0.8s linear infinite" }} />
                  Creating…
                </>
              ) : "Create Organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
