"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

type DeleteAction = (state: FormState, formData: FormData) => Promise<FormState>;

export default function DeleteConfirmationForm({
  action,
  id,
  confirmMessage,
}: {
  action: DeleteAction;
  id: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="text-right">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(confirmMessage)) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Deleting..." : "Delete"}
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="mt-2 max-w-xs text-left text-xs text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
