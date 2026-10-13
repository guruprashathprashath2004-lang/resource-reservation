"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";

type Props = {
  mode: "login" | "register";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  teams?: { id: string; name: string }[];
};

const input = "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900";
const label = "mb-1 block text-sm font-medium text-gray-700";

export default function AuthForm({ mode, action, teams = [] }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isLogin = mode === "login";

  return (
    <>
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto mt-16 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">
          {isLogin ? "Sign in" : "Create account"}
        </h1>
        <p className="mb-6 text-sm text-gray-500">Resource Reservation System</p>

        <form action={formAction} className="space-y-4">
          {!isLogin && (
            <div>
              <label className={label} htmlFor="name">Name</label>
              <input id="name" name="name" required className={input} />
            </div>
          )}

          <div>
            <label className={label} htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className={input} />
          </div>

          <div>
            <label className={label} htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className={input} />
          </div>

          {!isLogin && teams.length > 0 && (
            <div>
              <label className={label} htmlFor="teamId">Team (optional)</label>
              <select id="teamId" name="teamId" defaultValue="" className={input}>
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {state?.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {isLogin ? "No account? " : "Already registered? "}
          <Link
            href={isLogin ? "/register" : "/login"}
            className="font-medium text-indigo-600 hover:underline"
          >
            {isLogin ? "Register" : "Sign in"}
          </Link>
        </p>
      </div>
    </>
  );
}