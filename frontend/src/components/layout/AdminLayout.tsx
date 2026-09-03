import React from 'react';

interface AdminLayoutProps {
  /** Fixed sidebar. Renders outside the offset wrapper so it can be `position: fixed`. */
  sidebar: React.ReactNode;
  /** Sticky top bar. Sits inside the offset wrapper so it starts where the content does. */
  header: React.ReactNode;
  /** Overlays that must escape the content flow (command palette, toasts). */
  overlays?: React.ReactNode;
  /** Whether the sidebar is in its narrow (icon-only) state. */
  sidebarCollapsed?: boolean;
  children: React.ReactNode;
}

/**
 * The admin shell.
 *
 * The one rule worth knowing: the content offset here and the sidebar's own
 * width both read from `--sidebar-w` / `--sidebar-w-collapsed` in index.css.
 * They used to be two hardcoded numbers that disagreed (82px sidebar, 90px
 * offset), which left a dead strip beside the nav. Change the width in the
 * stylesheet and both sides follow.
 *
 * Every surface colour comes from the semantic tokens (`bg-background`,
 * `bg-card`, …) rather than fixed grays, so light and dark are one code path.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  sidebar,
  header,
  overlays,
  sidebarCollapsed = false,
  children,
}) => (
  <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-background font-sans">
    {sidebar}

    <div
      className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-in-out ${
        sidebarCollapsed
          ? 'lg:ml-[var(--sidebar-w-collapsed)]'
          : 'lg:ml-[var(--sidebar-w)]'
      }`}
    >
      {header}

      <main className="w-full max-w-full flex-1 overflow-x-hidden">
        {/* Capped and centred: an ERP needs width for its tables, but a
            full-bleed 2560px row is unreadable. */}
        <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>

    {overlays}
  </div>
);

export default AdminLayout;
