"use client";

import { X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useInviteFriend } from "@/features/friends/hooks/use-invite-friend";
import { toast } from "sonner";
import { ApiError } from "@/api-helpers/client";
import { ZodError } from "zod";
import { useAddFriend } from "@/features/friends/hooks/use-add-friend";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { isValidEmail } from "@/utils/validation";

interface AddFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFriendsModal({ isOpen, onClose }: AddFriendsModalProps) {
  const [identifier, setIdentifier] = useState("");
  const { mutate: addFriend, isPending } = useAddFriend();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    const value = identifier.trim();
    if (!value) return;
    if (!isValidEmail(value)) {
      toast.error("Please enter a valid email address (e.g. name@example.com)");
      return;
    }

    addFriend(value, {
      onSuccess: (data) => {
        setIdentifier("");

        // refetch friends data
        queryClient.invalidateQueries({ queryKey: [QueryKeys.FRIENDS] });

        onClose();
        toast.success(data.message || "Friend added successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add friend");
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isPending && identifier.trim() && isValidEmail(identifier.trim())) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen">
      <div
        className="fixed inset-0 bg-black/70 brightness-50"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[450px]">
        <div className="animate-border-light relative z-10">
          <div className="relative rounded-[14.77px] bg-black p-4 lg:p-8">
            <div className="flex items-center justify-between mb-6 lg:mb-8">
              <h3 className="text-2xl lg:text-[29.28px] font-base text-white tracking-[-0.03em]">
                Add Friend
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 lg:p-2 hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </button>
            </div>

            <div className="space-y-4 lg:space-y-6">
              <label className="block text-lg font-medium text-white mb-2 mt-2">Invite friend</label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="me@email.com"
                  className="w-full h-12 lg:h-14 bg-[#1F1F23] rounded-2xl pl-4 pr-4 
                  text-base lg:text-lg font-normal text-white 
                  border border-white/10 
                  transition-all duration-300
                  placeholder:text-white/30
                  focus:outline-none focus:border-white/20 focus:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  disabled={isPending}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isPending || !identifier.trim() || !isValidEmail(identifier.trim())}
                className="w-full h-14 rounded-full bg-[#fff] text-black text-base font-bold mt-8 shadow-none border-none"
                style={{ backgroundColor: '#fff', color: '#000' }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Friend"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
