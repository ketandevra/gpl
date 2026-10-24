export default function Loading() {
  return (
    <div className="page max-w-6xl animate-pulse">
      <div className="h-4 w-28 rounded-full bg-[#3e2723]/8" />
      <div className="mt-4 space-y-3">
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
      </div>
    </div>
  );
}
