"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateReservation } from "@/app/actions/reservations";

type Props = {
  id: string;
  resourceName: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  maxDurationMinutes: number;
  title: string;
  attendeeCount: number;
  notes: string | null;
  start: string;
  end: string;
  needsReapproval: boolean;
};

const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";
const label = "mb-1 block text-sm font-medium text-gray-700";

export default function EditReservationForm(props: Props) {
  const [state, formAction, pending] = useActionState(updateReservation, undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <input type="hidden" name="id" value={props.id} />

      <div>
        <p className={label}>Resource</p>
        <p className="rounded-md bg-gray-50 px-3 py-2 text-gray-700">
          {props.resourceName}{" "}
          <span className="text-sm text-gray-500">
            ({props.openHour}:00-{props.closeHour}:00, capacity {props.capacity}, max {props.maxDurationMinutes} min)
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          To use a different resource, cancel this booking and create a new one.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="attendeeCount">Number of people</label>
        <input id="attendeeCount" name="attendeeCount" type="number" min={1} max={1000} required defaultValue={props.attendeeCount} className={input} />
        <p className="mt-1 text-xs text-gray-500">The number of people must not exceed this resource&apos;s capacity.</p>
      </div>

      <div>
        <label className={label} htmlFor="title">Title</label>
        <input id="title" name="title" required defaultValue={props.title} className={input} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="start">Start</label>
          <input id="start" name="start" type="datetime-local" required defaultValue={props.start} className={input} />
        </div>
        <p className="-mt-2 text-xs text-gray-500">
          Overnight bookings are allowed when the resource stays open through midnight. Enter the end time on the following date.
        </p>
        <div>
          <label className={label} htmlFor="end">End</label>
          <input id="end" name="end" type="datetime-local" required defaultValue={props.end} className={input} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={props.notes ?? ""} className={input} />
      </div>

      {props.needsReapproval && (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          If you change the time, this booking will go back to pending and an admin has to approve it again.
        </p>
      )}

      {state?.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving..." : "Save changes"}
        </button>
        <Link href="/reservations" className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100">Cancel</Link>
      </div>
    </form>
  );
}