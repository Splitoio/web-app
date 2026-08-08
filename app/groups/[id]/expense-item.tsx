import { Expense, User } from "@/api-helpers/types";
import { useConvertCurrency } from "@/features/currencies/hooks/use-currencies";
import { formatCurrency } from "@/utils/formatters";
import { useState } from "react";
import Image from "next/image";

interface ExpenseItemProps {
  expense: Expense;
  currentUser: User | null;
}

export default function ExpenseItem({
  expense,
  currentUser,
}: ExpenseItemProps) {
  // If time lock-in is false and we have a different currency than the default,
  // we can fetch the current conversion rate
  const { data: conversion } = useConvertCurrency(
    expense.amount,
    expense.currency,
    currentUser?.currency || "USD"
  );

  const displayAmount = expense.amount;
  const displayCurrency = expense.currency;

  // For displaying token information if it's a blockchain token
  const tokenInfo =
    expense.currencyType === "TOKEN" && expense.chainId
      ? `on ${expense.chainId}`
      : "";

  return (
    <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-full">
          <Image
            src={
              expense.paidByUser.image ||
              `https://api.dicebear.com/9.x/identicon/svg?seed=${expense.paidBy}`
            }
            alt={expense.paidByUser.name || "User"}
            width={40}
            height={40}
            className="h-full w-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${expense.paidBy}`;
            }}
          />
        </div>
        <div>
          <p className="text-mobile-base sm:text-base text-white">
            <span className="font-medium">
              {expense.paidBy === currentUser?.id
                ? "You"
                : expense.paidByUser.name}
            </span>{" "}
            paid for "{expense.name}"
          </p>
          <p className="text-mobile-xs sm:text-sm text-white/60 flex items-center gap-1">
            {new Date(expense.createdAt).toLocaleString()}
            {expense.timeLockIn && (
              <span className="bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded-full">
                Locked Rate
              </span>
            )}
            {expense.currencyType === "TOKEN" && (
              <span className="bg-purple-500/20 text-purple-400 text-xs px-1.5 py-0.5 rounded-full">
                Token
              </span>
            )}
          </p>
        </div>
      </div>
      <div>
        <p className="text-mobile-base sm:text-base text-white font-medium">
          {formatCurrency(displayAmount, displayCurrency)}
          {tokenInfo && (
            <span className="text-xs text-white/60 ml-1">{tokenInfo}</span>
          )}
        </p>
        {/* Show converted amount if available */}
        {!expense.timeLockIn && conversion && (
          <p className="text-mobile-xs sm:text-sm text-white/60 text-right">
            ≈{" "}
            {formatCurrency(
              conversion.toAmount,
              currentUser?.currency || "USD"
            )}
          </p>
        )}
        {/* Show the locked-in converted amount if timeLockIn is true and we have one */}
        {expense.timeLockIn && expense.convertedAmount && (
          <p className="text-mobile-xs sm:text-sm text-white/60 text-right">
            ={" "}
            {formatCurrency(
              expense.convertedAmount,
              currentUser?.currency || "USD"
            )}{" "}
            (locked)
          </p>
        )}
      </div>
    </div>
  );
}
