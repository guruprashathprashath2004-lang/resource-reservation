"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-3xl font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-gray-500">An unexpected error occurred. Please try again.</p>
      <button onClick={() => reset()} className="mt-6 rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
        Try again
      </button>
    </div>
  );
}