import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { MapPin, Phone, Clock, Navigation } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyAY0t7mdhRjMnjvqL7T2MtnfC_u8LAW6wU";

const stations = [
  { name: "Cyberabad Police Station", address: "Madhapur, Hyderabad, 500081", lat: 17.4486, lng: 78.3908, phone: "040-27855000", open: true },
  { name: "Gachibowli Police Station", address: "Gachibowli, Hyderabad, 500032", lat: 17.4401, lng: 78.3489, phone: "040-27855100", open: true },
  { name: "Miyapur Police Station", address: "Miyapur, Hyderabad, 500049", lat: 17.4969, lng: 78.3548, phone: "040-27855200", open: true },
  { name: "Kondapur Police Station", address: "Kondapur, Hyderabad, 500084", lat: 17.4577, lng: 78.3641, phone: "040-27855300", open: false },
];

const NearbyStations = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation({ lat: 17.4486, lng: 78.3908 }) // fallback to Hyderabad
    );
  }, []);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;

    // Load Google Maps script
    if (!(window as any).google?.maps) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      if (!mapRef.current || !userLocation) return;
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: userLocation,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
        ],
      });

      // User marker
      new google.maps.Marker({
        position: userLocation,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "hsl(220, 80%, 50%)",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 3,
        },
        title: "You",
      });

      // Station markers
      stations.forEach((s) => {
        const marker = new google.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          title: s.name,
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-family:system-ui;"><strong>${s.name}</strong><br/><small>${s.address}</small><br/><a href="tel:${s.phone}">${s.phone}</a></div>`,
        });
        marker.addListener("click", () => infoWindow.open(map, marker));
      });

      setMapLoaded(true);
    }
  }, [userLocation]);

  const getDistance = (s: typeof stations[0]) => {
    if (!userLocation) return "—";
    const R = 6371;
    const dLat = ((s.lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((s.lng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((s.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return `${d.toFixed(1)} km`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="Nearby Stations" subtitle="Police stations near you" />

      <main className="flex-1 space-y-4 px-5 py-6">
        {/* Google Map */}
        <div ref={mapRef} className="h-56 rounded-2xl border border-border overflow-hidden bg-muted">
          {!mapLoaded && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Navigation className="h-8 w-8 text-primary animate-pulse" />
                <span className="text-sm font-medium">Loading map...</span>
              </div>
            </div>
          )}
        </div>

        {/* Station list */}
        <div className="space-y-3">
          {stations.map((station) => (
            <div
              key={station.name}
              className="rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">{station.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {station.address}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {getDistance(station)}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4">
                <a
                  href={`tel:${station.phone}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {station.phone}
                </a>
                <span className={`flex items-center gap-1 text-xs font-medium ${station.open ? "text-success" : "text-muted-foreground"}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {station.open ? "Open 24/7" : "Closed"}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Navigation className="h-3 w-3" />
                Get Directions
              </a>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default NearbyStations;
