import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-20">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/80">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        There is only one page here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-sky-400"
      >
        Back to today&apos;s card
      </Link>
    </main>
  );
}
