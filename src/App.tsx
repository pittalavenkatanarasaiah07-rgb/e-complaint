import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import FileComplaint from "./pages/FileComplaint";
import SOSEmergency from "./pages/SOSEmergency";
import NearbyStations from "./pages/NearbyStations";
import NearbyHospitals from "./pages/NearbyHospitals";
import MyComplaints from "./pages/MyComplaints";
import EvidenceView from "./pages/EvidenceView";
import EmergencyContacts from "./pages/EmergencyContacts";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/file-complaint" element={<FileComplaint />} />
              <Route path="/sos-emergency" element={<SOSEmergency />} />
              <Route path="/nearby-stations" element={<NearbyStations />} />
              <Route path="/nearby-hospitals" element={<NearbyHospitals />} />
              <Route path="/my-complaints" element={<MyComplaints />} />
              <Route path="/evidence" element={<EvidenceView />} />
              <Route path="/emergency-contacts" element={<EmergencyContacts />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
