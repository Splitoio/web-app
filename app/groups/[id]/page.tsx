"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];

  useEffect(() => {
    if (id) router.replace(`/groups/${id}/balances`);
  }, [id, router]);

  return null;
}
