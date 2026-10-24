"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-4 py-12 text-center lg:px-8">
      <h1 className="text-2xl font-bold text-[#3e2723]">
        This page couldn’t load
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-[#3e2723]/70">
        A server error occurred. Try again
        {error.digest ? ` (error ${error.digest})` : ""}.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-[#2aa7ad] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Reload
      </button>
    </div>
  );
}
