import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";


export type Split = {
  address: string;
  amount: number;
  percentage?: number;
  hasPaid?: boolean;
};

export type Debt = {
  from: string;
  to: string;
  amount: number;
};

export type Group = {
  id: string;
  name: string;
  image: string;
  creator: string;
  creatorAddress: string;
  date: string;
  amount: number;
  paidBy: string;
  members: string[];
  splits: Split[];
  debts: Debt[];
  splitType: "equal" | "percentage" | "custom";
  currency: string;
  description?: string;
};

type GroupStore = {
  groups: Group[];
  connectedAddress: string | null;
  setConnectedAddress: (address: string | null) => void;
  addGroup: (group: Group) => void;
  updateGroup: (id: string, group: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
};

export const useGroups = create<GroupStore>()(
  persist(
    (set) => ({
      groups: [],
      connectedAddress: null,
      setConnectedAddress: (address) => set({ connectedAddress: address }),
      addGroup: (group) =>
        set((state) => ({ groups: [...state.groups, group] })),
      updateGroup: (id, updatedGroup) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id ? { ...group, ...updatedGroup } : group
          ),
        })),
      deleteGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== id),
        })),
    }),
    {
      name: "groups-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
