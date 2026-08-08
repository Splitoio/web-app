import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { getWorkspaces } from "../api/client";

/**
 * The account's workspaces. Disabled for anonymous visitors — `/` is the public
 * create-request landing and a 401 there is expected, not an auth failure, so
 * there is nothing to fetch until a session exists.
 */
export const useWorkspaces = (params?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [QueryKeys.WORKSPACES],
    queryFn: getWorkspaces,
    enabled: params?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
