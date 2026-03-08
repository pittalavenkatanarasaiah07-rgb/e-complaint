import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { AlertTriangle, Phone, MapPin, Users, CheckCircle } from "lucide-react";

const SOSEmergency = () => {
  const [activated, setActivated] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="SOS Emergency" subtitle="Get immediate help" />

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-12">
        {!activated ? (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Press the SOS button to send an emergency alert with your live location to nearby authorities and your emergency contacts.
            </p>

            {/* SOS Button */}
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency" />
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency [animation-delay:0.5s]" />
              <button
                onClick={() => setActivated(true)}
                className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full bg-emergency text-emergency-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
              >
                <AlertTriangle className="mb-1 h-10 w-10" />
                <span className="text-2xl font-black">SOS</span>
                <span className="text-xs font-medium opacity-80">Tap for help</span>
              </button>
            </div>

            {/* Quick actions */}
            <div className="grid w-full max-w-sm grid-cols-3 gap-3">
              <a
                href="tel:100"
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card"
              >
                <Phone className="h-6 w-6 text-emergency" />
                <span className="text-xs font-medium text-foreground">Police (100)</span>
              </a>
              <a
                href="tel:108"
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card"
              >
                <Phone className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium text-foreground">Ambulance (108)</span>
              </a>
              <a
                href="tel:181"
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card"
              >
                <Users className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium text-foreground">Women (181)</span>
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emergency/10">
              <CheckCircle className="h-10 w-10 text-emergency" />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-foreground">Alert Sent!</h2>
              <p className="text-sm text-muted-foreground">
                Your emergency alert has been sent to nearby authorities and your emergency contacts. Help is on the way.
              </p>
            </div>
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Live location shared</p>
                  <p className="text-xs text-muted-foreground">Updating every 30 seconds</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">3 emergency contacts notified</p>
                  <p className="text-xs text-muted-foreground">Via SMS and app notification</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActivated(false)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel Alert
            </button>
          </>
        )}
      </main>
    </div>
  );
};

export default SOSEmergency;
