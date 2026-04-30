import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
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

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState("track");
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isConfiguredState, setIsConfiguredState] = useState(isConfigured());
  const [confirmTrackingId, setConfirmTrackingId] = useState<string | null>(null);

  useEffect(() => {
    const updateConfig = () => setIsConfiguredState(isConfigured());
    const unsubscribe = onConfigUpdated(updateConfig);
    updateConfig();
    return unsubscribe;
  }, []);

  const navigateToConfirm = (trackingId: string) => {
    setConfirmTrackingId(trackingId);
    setCurrentPage("confirm");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!user && !isGuestMode) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <Toaster />
          <Login onGuestAccess={() => setIsGuestMode(true)} />
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // Effect to handle routing based on roles
  useEffect(() => {
    if (!user) {
      if (currentPage !== 'track') setCurrentPage('track');
    } else if (user.role === 'User' && (currentPage === 'dashboard' || currentPage === 'confirm' || currentPage === 'users')) {
      setCurrentPage('track');
    }
  }, [user, currentPage]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
            <div className={currentPage === "dashboard" ? '' : 'hidden'}>
              <Dashboard isConfigured={isConfiguredState} onConfirmParcel={navigateToConfirm} />
            </div>
            <div className={currentPage === "create" ? '' : 'hidden'}>
              <CreateParcel />
            </div>
            <div className={currentPage === "confirm" ? '' : 'hidden'}>
              <ConfirmReceipt
                initialTrackingId={confirmTrackingId}
                onInitialTrackingIdConsumed={() => setConfirmTrackingId(null)}
              />
            </div>
            <div className={currentPage === "track" ? '' : 'hidden'}>
              <Track />
            </div>
            {user?.role === 'Admin' && (
              <div className={currentPage === "users" ? '' : 'hidden'}>
                <UserManagement />
              </div>
            )}
          </Layout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
