export default function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-4 font-bold text-xl">
          CRM
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Sales CRM — Lead Generation
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Phase 1 Foundation active. Multi-tenant modular monolith.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Frontend ready on port 5173
        </div>
      </div>
    </main>
  );
}
