import { verifySessionOrRedirect } from "@/lib/auth/dal";
import { PanelNav } from "@/components/panel/panel-nav";

export default async function ProtectedPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const administrator = await verifySessionOrRedirect();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-medium tracking-wide text-accent">Panel</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Administrator-data
          </h1>
          <p className="mt-1 text-sm text-muted">Logget ind som {administrator.email}</p>
        </div>

        <PanelNav />
      </div>

      {children}
    </div>
  );
}
