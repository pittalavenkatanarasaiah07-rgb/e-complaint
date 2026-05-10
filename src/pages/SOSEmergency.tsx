import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
declare const google: any;
declare global { interface Window { google: any; } }
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Phone, MapPin, Users, CheckCircle, Hospital, Shield, Navigation, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GOOGLE_API_KEY = "AIzaSyASY-gWNWZtkBySNO9dvdpMzz5NtyfgYzQ";

interface NearbyPlace {
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  distance?: string;
  type: "police" | "hospital";
}

const SOSEmergency = () => {
  const [activated, setActivated] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [alertStatus, setAlertStatus] = useState<string>("");
  const [contactsNotified, setContactsNotified] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [trialWarning, setTrialWarning] = useState<{ isTrial: boolean; unverified: { name: string; phone: string }[] } | null>(null);
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!scriptLoadedRef.current && !window.google?.maps) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => { scriptLoadedRef.current = true; };
      document.head.appendChild(script);
    } else {
      scriptLoadedRef.current = true;
    }
  }, []);

  const findNearbyPlaces = async (lat: number, lng: number) => {
    setLoadingPlaces(true);
    try {
      const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places") as any;
      const loc = new google.maps.LatLng(lat, lng);
      let allPlaces: NearbyPlace[] = [];
      for (const type of ["police"] as const) {
        try {
          const request = {
            fields: ["displayName", "location", "formattedAddress", "nationalPhoneNumber", "id"],
            locationRestriction: { center: loc, radius: 2000 },
            includedPrimaryTypes: [type],
            maxResultCount: 5,
            rankPreference: SearchNearbyRankPreference.DISTANCE,
          };
          const { places: results } = await Place.searchNearby(request);
          if (results) {
            const mapped: NearbyPlace[] = results.map((p: any) => ({
              name: p.displayName || "Unknown",
              address: p.formattedAddress || "",
              phone: p.nationalPhoneNumber || undefined,
              lat: p.location.lat(),
              lng: p.location.lng(),
              type,
            }));
            allPlaces = [...allPlaces, ...mapped];
          }
        } catch (e) {
          console.error(`SOS search for ${type} failed:`, e);
        }
      }
      allPlaces.sort((a, b) => {
        const distA = Math.sqrt((a.lat - lat) ** 2 + (a.lng - lng) ** 2);
        const distB = Math.sqrt((b.lat - lat) ** 2 + (b.lng - lng) ** 2);
        return distA - distB;
      });
      allPlaces.forEach((p) => {
        const R = 6371;
        const dLat = ((p.lat - lat) * Math.PI) / 180;
        const dLng = ((p.lng - lng) * Math.PI) / 180;
        const a2 = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
        p.distance = `${dist.toFixed(1)} km`;
      });
      setNearbyPlaces(allPlaces);
      setLoadingPlaces(false);
    } catch (e) {
      console.error("SOS places search failed:", e);
      setLoadingPlaces(false);
    }
  };

  const sendSOSAlerts = async (lat: number, lng: number) => {
    if (!session?.access_token) {
      setAlertStatus("Login required for SMS alerts");
      return;
    }
    try {
      setAlertStatus("Sending alerts...");
      const { data, error } = await supabase.functions.invoke("send-sos-alerts", {
        body: { latitude: lat, longitude: lng },
      });
      if (error) {
        setAlertStatus("Alert recorded locally");
        return;
      }
      setContactsNotified(data.notified || 0);
      setTotalContacts(data.total || 0);
      setAlertStatus(data.message || "Alerts processed");
      if (data.isTrial && Array.isArray(data.unverifiedContacts) && data.unverifiedContacts.length > 0) {
        setTrialWarning({ isTrial: true, unverified: data.unverifiedContacts });
      } else {
        setTrialWarning(null);
      }
    } catch (e) {
      setAlertStatus("Alert recorded locally");
    }
  };

  const handleActivate = () => {
    setActivated(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        sendSOSAlerts(loc.lat, loc.lng);
        if (scriptLoadedRef.current && window.google?.maps) {
          findNearbyPlaces(loc.lat, loc.lng);
        } else {
          const check = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(check);
              findNearbyPlaces(loc.lat, loc.lng);
            }
          }, 500);
        }
      },
      () => { setLoadingPlaces(false); setAlertStatus("Location unavailable"); },
      { enableHighAccuracy: true }
    );
  };

  const openDirections = (place: NearbyPlace) => {
    if (userLocation) {
      window.open(`https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${place.lat},${place.lng}`, "_blank");
    }
  };

  const callPlace = (place: NearbyPlace) => {
    if (place.phone) {
      window.location.href = `tel:${place.phone}`;
    } else {
      window.location.href = `tel:${place.type === "police" ? "100" : "108"}`;
    }
  };

  const callEmergency = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("sosEmergency")} subtitle={t("getImmediateHelp")} />
      <main className="flex flex-1 flex-col items-center gap-6 px-4 pb-12">
        {!activated ? (
          <>
            <p className="text-center text-sm text-muted-foreground mt-4">{t("sosDesc")}</p>
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency" />
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency [animation-delay:0.5s]" />
              <button onClick={handleActivate} className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full bg-emergency text-emergency-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95">
                <AlertTriangle className="mb-1 h-10 w-10" />
                <span className="text-2xl font-black">SOS</span>
                <span className="text-xs font-medium opacity-80">{t("tapForHelp")}</span>
              </button>
            </div>

            <div className="grid w-full max-w-sm grid-cols-3 gap-3">
              <button onClick={() => callEmergency("100")} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card">
                <Phone className="h-6 w-6 text-emergency" /><span className="text-xs font-medium text-foreground">{t("police")}</span>
              </button>
              <button onClick={() => callEmergency("108")} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card">
                <Phone className="h-6 w-6 text-primary" /><span className="text-xs font-medium text-foreground">{t("ambulance")}</span>
              </button>
              <button onClick={() => callEmergency("181")} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-card">
                <Users className="h-6 w-6 text-primary" /><span className="text-xs font-medium text-foreground">{t("women")}</span>
              </button>
            </div>

            {/* Manage emergency contacts link */}
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/emergency-contacts"><UserPlus className="mr-2 h-4 w-4" /> Manage Emergency Contacts</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emergency/10 mt-2">
              <CheckCircle className="h-8 w-8 text-emergency" />
            </div>
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-bold text-foreground">{t("alertSent")}</h2>
              <p className="text-sm text-muted-foreground">{alertStatus || t("alertSentDesc")}</p>
            </div>

            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div><p className="text-sm font-medium text-foreground">{t("liveLocationShared")}</p><p className="text-xs text-muted-foreground">{userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : t("updatingLocation")}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t("contactsNotified")}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalContacts > 0 ? `${contactsNotified}/${totalContacts} contacts notified via SMS` : "Add emergency contacts for SMS alerts"}
                  </p>
                </div>
              </div>
            </div>

            {trialWarning && (
              <div className="w-full max-w-sm rounded-2xl border border-emergency/40 bg-emergency/10 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-emergency" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emergency">Twilio trial account</p>
                    <p className="text-xs text-foreground">
                      Trial accounts can only send SMS to numbers verified in your Twilio console. The contacts below were NOT notified:
                    </p>
                  </div>
                </div>
                <ul className="ml-7 list-disc space-y-0.5 text-xs text-foreground">
                  {trialWarning.unverified.map((c, i) => (
                    <li key={i}><span className="font-medium">{c.name}</span> — {c.phone}</li>
                  ))}
                </ul>
                <a
                  href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-7 block text-xs font-medium text-primary underline"
                >
                  Verify these numbers in Twilio →
                </a>
              </div>
            )}

            <div className="grid w-full max-w-sm grid-cols-3 gap-3">
              <button onClick={() => callEmergency("100")} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 transition-all hover:shadow-card">
                <Phone className="h-5 w-5 text-emergency" /><span className="text-[11px] font-medium">{t("police")}</span>
              </button>
              <button onClick={() => callEmergency("108")} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 transition-all hover:shadow-card">
                <Phone className="h-5 w-5 text-primary" /><span className="text-[11px] font-medium">{t("ambulance")}</span>
              </button>
              <button onClick={() => callEmergency("181")} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 transition-all hover:shadow-card">
                <Users className="h-5 w-5 text-primary" /><span className="text-[11px] font-medium">{t("women")}</span>
              </button>
            </div>

            <div className="w-full max-w-sm">
              <h3 className="mb-3 text-sm font-bold text-foreground">Nearby Emergency Services (2km)</h3>
              {loadingPlaces ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Finding nearby places...</span>
                </div>
              ) : nearbyPlaces.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No nearby places found. Use emergency numbers above.</p>
              ) : (
                <div className="space-y-2">
                  {nearbyPlaces.map((place, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start gap-2">
                        {place.type === "police" ? <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Hospital className="mt-0.5 h-4 w-4 shrink-0 text-emergency" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                          {place.distance && <span className="text-xs text-primary font-medium">{place.distance}</span>}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1 text-xs h-8" onClick={() => callPlace(place)}>
                          <Phone className="mr-1 h-3 w-3" /> Call
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => openDirections(place)}>
                          <Navigation className="mr-1 h-3 w-3" /> Directions
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to="/emergency-contacts"><UserPlus className="mr-2 h-4 w-4" /> Manage Contacts</Link>
            </Button>

            <button onClick={() => { setActivated(false); setNearbyPlaces([]); setAlertStatus(""); }} className="text-sm font-medium text-muted-foreground hover:text-foreground">{t("cancelAlert")}</button>
          </>
        )}
      </main>
    </div>
  );
};

export default SOSEmergency;
