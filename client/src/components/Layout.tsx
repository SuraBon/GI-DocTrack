import React, { useState } from "react";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navItems = [
    { id: "dashboard", label: "ภาพรวมระบบ", icon: "dashboard" },
    { id: "create", label: "สร้างรายการใหม่", icon: "add_box" },
    { id: "confirm", label: "ยืนยันการรับพัสดุ", icon: "photo_camera" },
    { id: "track", label: "ติดตามสถานะ", icon: "location_searching" },
  ];

  return (
    <div className="min-h-screen bg-background font-body text-on-background">
      {/* SideNavBar */}
      <aside className={`h-screen ${isSidebarOpen ? 'w-64' : 'w-16'} fixed left-0 top-0 bg-primary dark:bg-slate-950 flex flex-col py-6 ${isSidebarOpen ? 'px-4' : 'px-2'} gap-2 border-r border-outline-variant/20 z-50 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} px-2 mb-8`}>
          <div className="w-10 h-10 bg-secondary-container rounded-xl flex items-center justify-center shadow-lg">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_shipping
            </span>
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="text-white font-black text-lg font-display">
                DocTrack
              </span>
              <span className="text-primary-fixed-dim text-[10px] font-semibold uppercase tracking-wider">
                Fleet Management
              </span>
            </div>
          )}
          {/* Desktop toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex ml-auto p-2 text-primary-fixed-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <span className="material-symbols-outlined">
              {isSidebarOpen ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <a
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} px-3 py-3 rounded-xl font-display text-sm font-semibold cursor-pointer active:opacity-80 transition-all ${currentPage === item.id
                  ? "bg-secondary-container text-primary shadow-lg"
                  : "text-primary-fixed-dim hover:text-white hover:bg-white/10"
                }`}
              title={isSidebarOpen ? undefined : item.label}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{
                  fontVariationSettings:
                    currentPage === item.id ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              {isSidebarOpen && item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-4 border-t border-white/20">
          <a className={`flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} px-3 py-3 text-primary-fixed-dim hover:text-white font-display text-sm font-semibold cursor-pointer active:opacity-80 hover:bg-white/10 rounded-xl transition-all`} title={isSidebarOpen ? undefined : "ติดต่อช่วยเหลือ"}>
            <span className="material-symbols-outlined text-xl">contact_support</span>
            {isSidebarOpen && "ติดต่อช่วยเหลือ"}
          </a>
        </div>
      </aside>

      
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col min-h-screen lg:ml-64 transition-all duration-300">
        {/* TopAppBar */}
        <header className="sticky top-0 left-0 right-0 flex justify-between items-center px-4 lg:px-6 h-16 bg-white dark:bg-slate-900 border-b border-outline-variant/30 shadow-sm z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container transition-colors rounded-full"
            >
              <span className="material-symbols-outlined">
                {isSidebarOpen ? 'close' : 'menu'}
              </span>
            </button>
            <h1 className="text-lg font-bold text-on-surface font-display hidden sm:block">DocTrack</h1>
          </div>
          <div className="flex items-center gap-3">
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

        <main className="px-4 sm:px-6 lg:px-8 pt-20 pb-8 flex-1 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
