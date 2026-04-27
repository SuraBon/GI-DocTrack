import React from "react";
import { useParcelStore } from '@/hooks/useParcelStore';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage,
  setCurrentPage,
}) => {
  const { parcels } = useParcelStore();
  const hasNotifications = parcels && parcels.length > 0;
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "create", label: "Create Parcel", icon: "add_box" },
    { id: "confirm", label: "Confirm Receipt", icon: "photo_camera" },
    { id: "track", label: "Track Shipments", icon: "location_searching" },
  ];

  return (
    <div className="min-h-screen bg-background font-body text-on-background">
      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-primary dark:bg-slate-950 flex flex-col py-6 px-4 gap-2 border-r border-outline-variant/20 z-50">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_shipping
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black text-lg font-display">
              LogiTrack
            </span>
            <span className="text-primary-fixed-dim text-[10px] font-semibold uppercase tracking-wider">
              Fleet Management
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-display text-sm font-semibold cursor-pointer active:opacity-80 transition-all ${
                currentPage === item.id
                  ? "bg-secondary-container text-primary"
                  : "text-primary-fixed-dim hover:text-white hover:bg-white/10"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontVariationSettings:
                    currentPage === item.id ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-1 pt-4 border-t border-white/10">
          <a className="flex items-center gap-3 px-3 py-2.5 text-primary-fixed-dim hover:text-white font-display text-sm font-semibold cursor-pointer active:opacity-80 hover:bg-white/10 transition-all">
            <span className="material-symbols-outlined">contact_support</span>
            Support
          </a>
        </div>
      </aside>

      <div className="ml-64 flex flex-col min-h-screen">
        {/* TopAppBar */}
        <header className="sticky top-0 w-full flex justify-between items-center px-6 h-16 bg-white dark:bg-slate-900 border-b border-outline-variant/30 shadow-sm z-40">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Search shipments, assets or IDs..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-full relative">
              <span className="material-symbols-outlined">notifications</span>
              {hasNotifications && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
              )}
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-full">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </header>

        <main className="p-8 flex-1">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
