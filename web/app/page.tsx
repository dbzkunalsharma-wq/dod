import { JobsBoard } from "@/components/JobsBoard";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      <JobsBoard />
      <footer className="mt-auto border-t border-white/10 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-white/40 sm:flex-row sm:px-6 lg:px-8">
          <p>
            <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text font-mono font-semibold text-transparent">
              DOD
            </span>{" "}
            · Live India design jobs
          </p>
          <p>
            Aggregated from LinkedIn, Unstop, Greenhouse, Lever, Ashby, RemoteOK
            &amp; Telegram.
          </p>
        </div>
      </footer>
    </main>
  );
}
