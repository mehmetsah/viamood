export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <div className="inline-block mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 254.18 156.78"
            width="200"
            aria-label="Via Mood"
          >
            <polygon
              fill="#e1691f"
              points="243.74 82.24 127.45 6.94 10.44 82.24 15.97 82.25 127.45 10.5 238.17 82.21 243.74 82.24"
            />
            <text
              x="127"
              y="100"
              textAnchor="middle"
              fontSize="48"
              fontWeight="700"
              fill="#e1691f"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              VIA MOOD
            </text>
          </svg>
        </div>
        <h1 className="text-4xl font-bold mb-4">Vendor Platform</h1>
        <p className="text-lg text-neutral-600 mb-8">
          Via Mood pazaryeri operatör ve tedarikçi paneli.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/sign-in"
            className="inline-flex items-center px-6 py-3 bg-[var(--color-brand-ink)] text-white rounded-full font-semibold hover:opacity-90 transition"
          >
            Giriş yap
          </a>
          <a
            href="/auth/sign-up"
            className="inline-flex items-center px-6 py-3 border-2 border-[var(--color-brand-ink)] rounded-full font-semibold hover:bg-[var(--color-brand-ink)] hover:text-white transition"
          >
            Tedarikçi başvurusu
          </a>
        </div>
        <p className="mt-12 text-sm text-neutral-500">
          🚧 Phase 0 — Foundation. Plan:{' '}
          <code className="text-xs bg-neutral-100 px-2 py-1 rounded">docs/MULTIVENDOR_PLAN.md</code>
        </p>
      </div>
    </main>
  );
}
