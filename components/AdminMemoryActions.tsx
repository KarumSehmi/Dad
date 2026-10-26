"use client";

import { useState, useTransition } from "react";
import { deleteMemory } from "@/app/actions";
import { useIsAdmin } from "@/lib/use-is-admin";
import { TrashIcon } from "./icons";

export function AdminMemoryActions({ memoryId, name }: { memoryId: string; name: string }) {
  const isAdmin = useIsAdmin();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (!isAdmin) return null;

  return (
    <div className="admin-actions">
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete ${name}'s memory and its photos for everyone? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await deleteMemory(memoryId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <TrashIcon width={16} height={16} />
        {pending ? "Deleting…" : "Delete memory"}
      </button>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
