import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateParcel from "./pages/CreateParcel";
import ConfirmReceipt from "./pages/ConfirmReceipt";
import Track from "./pages/Track";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";
import { isConfigured, onConfigUpdated } from "./lib/parcelService";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRole, type AppRole } from "./lib/roles";

type PageId = "dashboard" | "create" | "confirm" | "track" | "users";

const pagePaths: Record<PageId, string> = {
  dashboard: "/dashboard",
  create: "/create",
  confirm: "/confirm",
  track: "/track",
  users: "/users",
};

const pathPages: Record<string, PageId> = {
  "/": "track",
  "/dashboard": "dashboard",
  "/create": "create",
  "/confirm": "confirm",
  "/track": "track",
  "/users": "users",
};

const getRouteFromLocation = (): { page: PageId; isKnownPath: boolean } => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = pathPages[path];
  return page ? { page, isKnownPath: true } : { page: "track", isKnownPath: false };
};

const pageRoles: Record<PageId, AppRole[]> = {
  dashboard: ["ADMIN", "MESSENGER", "USER"],
  create: ["ADMIN", "USER"],
  confirm: ["ADMIN", "MESSENGER"],
  track: ["ADMIN", "MESSENGER", "USER"],
  users: ["ADMIN"],
};

const canAccessPage = (page: PageId, role: AppRole) => pageRoles[page].includes(role);

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    const route = getRouteFromLocation();
    if (!route.isKnownPath) {
      window.history.replaceState({}, "", pagePaths.track);
    }
    return route.page;
  });
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);

  useEffect(() => {
    const updateConfig = () => setIsConfiguredState(isConfigured());
    const unsubscribe = onConfigUpdated(updateConfig);
    updateConfig();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromLocation();
      setCurrentPage(route.page);
      if (!route.isKnownPath) {
        window.history.replaceState({}, "", pagePaths.track);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToPage = useCallback((page: PageId) => {
    setCurrentPage(page);
    const nextPath = pagePaths[page];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  }, []);

  const navigateToConfirm = (trackingId: string) => {
    setConfirmTrackingId(trackingId);
    navigateToPage("confirm");
  };

  useEffect(() => {
    if (loading || !user) return;

    const role = normalizeRole(user.role);
    if (!canAccessPage(currentPage, role)) {
      navigateToPage("track");
    }
  }, [currentPage, loading, navigateToPage, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <Toaster />
          <Login />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  const role = normalizeRole(user.role);
  const visiblePage = canAccessPage(currentPage, role) ? currentPage : "track";
  const renderCurrentPage = () => {
    switch (visiblePage) {
      case "dashboard":
        return <Dashboard isConfigured={isConfiguredState} onConfirmParcel={navigateToConfirm} />;
      case "create":
        return <CreateParcel />;
      case "confirm":
        return (
          <ConfirmReceipt
            initialTrackingId={confirmTrackingId}
            onInitialTrackingIdConsumed={() => setConfirmTrackingId(null)}
          />
        );
      case "users":
        return <UserManagement />;
      case "track":
      default:
        return <Track />;
    }
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Layout currentPage={visiblePage} setCurrentPage={navigateToPage}>
            {renderCurrentPage()}
          </Layout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
