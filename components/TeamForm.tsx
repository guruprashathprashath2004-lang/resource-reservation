"use client";

import { useActionState } from "react";
import { createTeam } from "@/app/actions/teams";

export default function TeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, undefined);

  return (
    <form action={formAction} className="mb-6 max-w-xl rounded-xl border border-gray-200 bg-white p-4">
      <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
        New team
      </label>
      <div className="flex gap-2">
        <input
          id="name"
          name="name"
          required
          placeholder="e.g. Finance"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Adding..." : "Add"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}