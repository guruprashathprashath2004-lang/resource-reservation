"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createReservation } from "@/app/actions/reservations";

type ResourceOption = {
  id: string;
  name: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  maxDurationMinutes: number;
};

const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";
const label = "mb-1 block text-sm font-medium text-gray-700";

export default function ReservationForm({ resources }: { resources: ResourceOption[] }) {
  const [state, formAction, pending] = useActionState(createReservation, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <div>
        <label className={label} htmlFor="resourceId">Resource</label>
        <select id="resourceId" name="resourceId" required defaultValue="" className={input}>
          <option value="" disabled>Select resource</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
            {r.name} (capacity {r.capacity}, {r.openHour}:00-{r.closeHour}:00, max {r.maxDurationMinutes} min)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="title">Title</label>
        <input id="title" name="title" required placeholder="e.g. Sprint planning" className={input} />
      </div>

      <div>
        <label className={label} htmlFor="attendeeCount">Number of people</label>
        <input id="attendeeCount" name="attendeeCount" type="number" min={1} max={1000} required defaultValue={1} className={input} />
        <p className="mt-1 text-xs text-gray-500">The number of people must not exceed the selected resource&apos;s capacity.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="start">Start</label>
          <input id="start" name="start" type="datetime-local" required className={input} />
        </div>
        <p className="-mt-2 text-xs text-gray-500">
          Overnight bookings are allowed when the resource stays open through midnight. Enter the end time on the following date.
        </p>
        <div>
          <label className={label} htmlFor="end">End</label>
          <input id="end" name="end" type="datetime-local" required className={input} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} className={input} />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Booking..." : "Book resource"}
        </button>
        <Link href="/reservations" className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100">Cancel</Link>
      </div>
    </form>
  );
}