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
import { isConfigured, onConfigUpdated } from "./lib/parcelService";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
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
          </Layout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
