export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
      <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
    </div>
  );
}