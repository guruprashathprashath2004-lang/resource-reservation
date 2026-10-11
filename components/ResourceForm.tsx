"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

type Category = { id: string; name: string };
type Values = {
  id?: string;
  name?: string;
  categoryId?: string;
  location?: string | null;
  description?: string | null;
  capacity?: number;
  openHour?: number;
  closeHour?: number;
  maxDurationMinutes?: number;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Category[];
  values?: Values;
  submitLabel: string;
};

const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";
const label = "mb-1 block text-sm font-medium text-gray-700";

export default function ResourceForm({ action, categories, values = {}, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div>
        <label className={label} htmlFor="name">Name</label>
        <input id="name" name="name" required defaultValue={values.name} className={input} />
      </div>

      <div>
        <label className={label} htmlFor="categoryId">Category</label>
        <select id="categoryId" name="categoryId" required defaultValue={values.categoryId ?? ""} className={input}>
          <option value="" disabled>Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="location">Location</label>
          <input id="location" name="location" defaultValue={values.location ?? ""} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="capacity">Capacity</label>
          <input id="capacity" name="capacity" type="number" min={1} required defaultValue={values.capacity ?? 1} className={input} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} defaultValue={values.description ?? ""} className={input} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label} htmlFor="openHour">Opens (hour)</label>
          <input id="openHour" name="openHour" type="number" min={0} max={23} required defaultValue={values.openHour ?? 8} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="closeHour">Closes (hour)</label>
          <input id="closeHour" name="closeHour" type="number" min={1} max={24} required defaultValue={values.closeHour ?? 18} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="maxDurationMinutes">Max minutes</label>
          <input id="maxDurationMinutes" name="maxDurationMinutes" type="number" min={15} required defaultValue={values.maxDurationMinutes ?? 240} className={input} />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link href="/resources" className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100">Cancel</Link>
      </div>
    </form>
  );
}