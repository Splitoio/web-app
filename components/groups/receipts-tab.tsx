import React from "react";
import Image from "next/image";
import dayjs from "dayjs";
import { 
  useGetReceipts, 
  useUpdateReceiptStatus, 
  useDeleteReceipt,
  Receipt 
} from "@/features/groups/hooks/use-receipts";
import { 
  Loader2, Plus, Check, X, CheckSquare, Maximize2, Pencil, Trash2, FileText 
} from "lucide-react";

import { ReceiptImageModal } from "@/components/receipt-image-modal";
import { viewPdf } from "@/utils/file";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReceiptsTabProps {
  groupId: string;
  isCreator: boolean;
  /** Current user id – used to show Edit/Delete for receipts submitted by this user */
  currentUserId?: string;
  onAddReceiptClick: () => void;
  /** Called when user clicks Edit on a receipt (submitter only, PENDING only) */
  onEditReceipt?: (receipt: Receipt) => void;
}

export const ReceiptsTab: React.FC<ReceiptsTabProps> = ({ 
  groupId, 
  isCreator,
  currentUserId,
  onAddReceiptClick,
  onEditReceipt,
}) => {
  const { data: receipts, isLoading } = useGetReceipts(groupId);
  const updateStatusMutation = useUpdateReceiptStatus();
  const deleteReceiptMutation = useDeleteReceipt();
  const [selectedImage, setSelectedImage] = React.useState<{ url: string, desc: string } | null>(null);
  const [receiptToDelete, setReceiptToDelete] = React.useState<Receipt | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = React.useState<string | null>(null);


  const handleUpdateStatus = (receiptId: string, status: string) => {
    updateStatusMutation.mutate({ receiptId, groupId, status });
  };

  const handleDeleteClick = (receipt: Receipt) => setReceiptToDelete(receipt);
  const handleConfirmDelete = () => {
    if (!receiptToDelete) return;
    deleteReceiptMutation.mutate(
      { receiptId: receiptToDelete.id, groupId },
      { onSuccess: () => setReceiptToDelete(null) }
    );
  };
  const isSubmitter = (receipt: Receipt) => currentUserId && receipt.submittedById === currentUserId;
  const canEditDelete = (receipt: Receipt) => isSubmitter(receipt) && receipt.status === "PENDING";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        <p className="text-white/70">Loading receipts...</p>
      </div>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>No receipts found for this group.</p>
        <button 
          onClick={onAddReceiptClick} 
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Receipt
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "text-yellow-500 bg-yellow-500/10";
      case "APPROVED": return "text-green-500 bg-green-500/10";
      case "REJECTED": return "text-red-500 bg-red-500/10";
      case "CLEARED": return "text-blue-500 bg-blue-500/10";
      default: return "text-white/60 bg-white/5";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white">Group Receipts</h3>
        <button 
          onClick={onAddReceiptClick} 
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-white hover:bg-white/5 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Receipt
        </button>
      </div>

      <div className="grid gap-4">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="bg-[#1A1A1C] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
            {receipt.imageUrl && (
              <div 
                className="group/img w-full md:w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0 bg-black/20 cursor-pointer"
                onClick={async () => {
                  if (receipt.imageUrl?.toLowerCase().endsWith(".pdf")) {
                    try {
                      setLoadingReceiptId(receipt.id);
                      await viewPdf(receipt.imageUrl);
                    } finally {
                      setLoadingReceiptId(null);
                    }
                  } else {
                    setSelectedImage({ url: receipt.imageUrl!, desc: receipt.description });
                  }
                }}

              >
                {receipt.imageUrl?.toLowerCase().endsWith(".pdf") ? (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <FileText className="h-10 w-10 text-white/40" />
                  </div>
                ) : (
                  <Image 
                    src={receipt.imageUrl} 
                    alt={receipt.description} 
                    fill 
                    className="object-cover transition-transform group-hover/img:scale-110"
                  />
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  {loadingReceiptId === receipt.id ? (
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="text-white h-6 w-6 animate-spin" />
                      <span className="text-[10px] text-white font-medium">Opening...</span>
                    </div>
                  ) : (
                    <Maximize2 className="text-white h-6 w-6" />
                  )}
                </div>

              </div>
            )}
            
            <div className="flex-grow min-w-0">
              <h4 className="text-white font-medium truncate">{receipt.description}</h4>
              <p className="text-white/60 text-sm">
                Submitted by {receipt.submittedBy.name} on {dayjs(receipt.createdAt).format("MMM D, YYYY")}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(receipt.status)}`}>
                  {receipt.status}
                </span>
                <span className="text-white font-semibold">
                  {receipt.currency} {receipt.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0 flex-shrink-0">
              {canEditDelete(receipt) && onEditReceipt && (
                <>
                  <button 
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all text-sm font-semibold disabled:opacity-50"
                    onClick={() => onEditReceipt(receipt)}
                    disabled={updateStatusMutation.isPending || deleteReceiptMutation.isPending}
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button 
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-semibold disabled:opacity-50"
                    onClick={() => handleDeleteClick(receipt)}
                    disabled={updateStatusMutation.isPending || deleteReceiptMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              )}
              {isCreator && receipt.status === "PENDING" && (
                <>
                  <button 
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 transition-all text-sm font-semibold disabled:opacity-50"
                    onClick={() => handleUpdateStatus(receipt.id, "APPROVED")}
                    disabled={updateStatusMutation.isPending}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button 
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-semibold disabled:opacity-50"
                    onClick={() => handleUpdateStatus(receipt.id, "REJECTED")}
                    disabled={updateStatusMutation.isPending}
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </>
              )}
              {isCreator && receipt.status === "APPROVED" && (
                <button 
                  className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-sm font-semibold disabled:opacity-50"
                  onClick={() => handleUpdateStatus(receipt.id, "CLEARED")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckSquare className="h-4 w-4" /> Clear Receipt
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ReceiptImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || ""}
        description={selectedImage?.desc || ""}
      />

      <Dialog open={!!receiptToDelete} onOpenChange={(open) => !open && setReceiptToDelete(null)}>
        <DialogContent className="border-white/10 bg-[#101012] text-white">
          <DialogHeader>
            <DialogTitle>Delete receipt?</DialogTitle>
            <DialogDescription className="text-white/70">
              {receiptToDelete
                ? `"${receiptToDelete.description}" will be permanently deleted. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              onClick={() => setReceiptToDelete(null)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              onClick={handleConfirmDelete}
              disabled={deleteReceiptMutation.isPending}
            >
              {deleteReceiptMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
