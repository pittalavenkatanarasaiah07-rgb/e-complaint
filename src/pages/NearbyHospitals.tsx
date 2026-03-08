import { useEffect, useRef, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { MapPin, Clock, Navigation, Loader2, AlertCircle, Heart, Route, Car, Bike, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";

const GOOGLE_MAPS_API_KEY = "AIzaSyAY0t7mdhRjMnjvqL7T2MtnfC_u8LAW6wU";

interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
  open?: boolean;
  placeId?: string;
  type: "hospital" | "clinic";
}

interface TravelInfo {
  walking: string;
  twoWheeler: string;
  fourWheeler: string;
}

const NearbyHospitals = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelInfo>>({});

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationError(true); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const fetchTravelTimes = useCallback((destination: Place) => {
    const google = (window as any).google;
    if (!userLocation || !google) return;
    
    const service = new google.maps.DistanceMatrixService();
    const origin = new google.maps.LatLng(userLocation.lat, userLocation.lng);
    const dest = new google.maps.LatLng(destination.lat, destination.lng);

    const modes = [
      { mode: google.maps.TravelMode.WALKING, key: "walking" },
      { mode: google.maps.TravelMode.DRIVING, key: "fourWheeler" },
    ];

    const info: TravelInfo = { walking: "...", twoWheeler: "...", fourWheeler: "..." };

    modes.forEach(({ mode, key }) => {
      service.getDistanceMatrix(
        { origins: [origin], destinations: [dest], travelMode: mode },
        (response: any, status: string) => {
          if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
            const duration = response.rows[0].elements[0].duration.text;
            if (key === "walking") {
              info.walking = duration;
            } else {
              info.fourWheeler = duration;
              // Estimate two-wheeler as ~80% of driving time
              const seconds = response.rows[0].elements[0].duration.value;
              const twoWheelerSec = Math.round(seconds * 0.8);
              const mins = Math.round(twoWheelerSec / 60);
              info.twoWheeler = mins < 60 ? `${mins} mins` : `${Math.floor(mins / 60)} hr ${mins % 60} mins`;
            }
            setTravelTimes((prev) => ({ ...prev, [destination.placeId || ""]: { ...info } }));
          }
        }
      );
    });
  }, [userLocation]);

  const showRoute = useCallback((destination: Place) => {
    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);

    if (activeRoute === destination.placeId) { setActiveRoute(null); return; }

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map, suppressMarkers: true,
      polylineOptions: { strokeColor: "hsl(0, 85%, 55%)", strokeWeight: 5, strokeOpacity: 0.8 },
    });
    directionsRendererRef.current = directionsRenderer;

    directionsService.route(
      {
        origin: new google.maps.LatLng(userLocation.lat, userLocation.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === "OK") {
          directionsRenderer.setDirections(result);
          setActiveRoute(destination.placeId || null);
          fetchTravelTimes(destination);
        }
      }
    );
  }, [userLocation, activeRoute, fetchTravelTimes]);

  const searchNearbyPlaces = useCallback((map: any, location: { lat: number; lng: number }) => {
    const google = (window as any).google;
    const service = new google.maps.places.PlacesService(map);
    let allResults: Place[] = [];
    let completed = 0;
    const searches = [
      { type: "hospital", radius: 50000, placeType: "hospital" as const },
      { type: "doctor", radius: 50000, placeType: "clinic" as const },
      { type: "health", radius: 2000, placeType: "clinic" as const },
    ];

    searches.forEach(({ type, radius, placeType }) => {
      service.nearbySearch(
        { location: new google.maps.LatLng(location.lat, location.lng), radius, type: type as any },
        (results: any[], status: string) => {
          completed++;
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            const found: Place[] = results.map((place: any) => ({
              name: place.name,
              address: place.vicinity || place.formatted_address || "Address not available",
              lat: place.geometry.location.lat(), lng: place.geometry.location.lng(),
              open: place.opening_hours?.isOpen?.() ?? true,
              placeId: place.place_id,
              type: placeType,
            }));
            allResults = [...allResults, ...found];
          }
          if (completed === searches.length) {
            const unique = Array.from(new Map(allResults.map((p) => [p.placeId, p])).values());
            unique.sort((a, b) => getDistanceNum(location, a) - getDistanceNum(location, b));
            setPlaces(unique);

            // Clear old markers
            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current = [];

            unique.forEach((s) => {
              const marker = new google.maps.Marker({
                position: { lat: s.lat, lng: s.lng }, map, title: s.name,
                icon: { url: s.type === "hospital" ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png" : "https://maps.google.com/mapfiles/ms/icons/pink-dot.png" },
              });
              markersRef.current.push(marker);
              
              marker.addListener("click", () => {
                showRoute(s);
              });
            });

            if (unique.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(new google.maps.LatLng(location.lat, location.lng));
              unique.forEach((s) => bounds.extend(new google.maps.LatLng(s.lat, s.lng)));
              map.fitBounds(bounds, 50);
            }
            setLoading(false);
          }
        }
      );
    });
  }, []);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    const loadAndInit = () => {
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: userLocation, zoom: 13,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR, position: google.maps.ControlPosition.TOP_RIGHT },
        zoomControl: true, streetViewControl: false, fullscreenControl: true,
      });
      mapInstanceRef.current = map;

      new google.maps.Marker({
        position: userLocation, map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "hsl(220, 80%, 50%)", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        title: "Your Location", zIndex: 999,
      });

      // Draw 2km radius circle for clinics
      new google.maps.Circle({
        map, center: userLocation, radius: 2000,
        fillColor: "hsl(0, 85%, 55%)", fillOpacity: 0.05,
        strokeColor: "hsl(0, 85%, 55%)", strokeOpacity: 0.3, strokeWeight: 1,
      });

      setMapLoaded(true);
      searchNearbyPlaces(map, userLocation);
    };

    if (!(window as any).google?.maps?.places) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true; script.onload = loadAndInit;
      document.head.appendChild(script);
    } else { loadAndInit(); }
  }, [userLocation, searchNearbyPlaces]);

  const getDistanceNum = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDistance = (s: Place) => {
    if (!userLocation) return "—";
    return `${getDistanceNum(userLocation, s).toFixed(1)} km`;
  };

  const retryLocation = () => {
    setLocationError(false); setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationError(true); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="Nearby Hospitals" subtitle="Hospitals & clinics near you" />
      <main className="flex-1 space-y-4 px-5 py-6">
        {locationError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="h-10 w-10 text-emergency" />
            <div>
              <h3 className="font-semibold text-foreground">Location Access Required</h3>
              <p className="mt-1 text-sm text-muted-foreground">Enable location access to find nearby hospitals.</p>
            </div>
            <Button onClick={retryLocation} className="rounded-xl"><Navigation className="mr-2 h-4 w-4" />Try Again</Button>
          </div>
        ) : (
          <>
            <div className="relative h-72 rounded-2xl border border-border overflow-hidden bg-muted">
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Heart className="h-8 w-8 text-emergency animate-pulse" />
                    <span className="text-sm font-medium">Detecting your location...</span>
                  </div>
                </div>
              )}
              <div ref={mapRef} className="h-full w-full" />
            </div>

            {userLocation && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emergency" />
                <span className="ml-2 text-sm text-muted-foreground">Finding nearby hospitals...</span>
              </div>
            ) : places.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Heart className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No hospitals or clinics found nearby</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">{places.length} hospitals & clinics found</p>
                {places.map((place, i) => (
                  <div
                    key={place.placeId || i}
                    className={`rounded-2xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated cursor-pointer ${activeRoute === place.placeId ? "border-emergency" : "border-border"}`}
                    onClick={() => showRoute(place)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{place.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${place.type === "hospital" ? "bg-emergency/10 text-emergency" : "bg-primary/10 text-primary"}`}>
                            {place.type === "hospital" ? "Hospital" : "Clinic"}
                          </span>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{place.address}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ml-2">{getDistance(place)}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <span className={`flex items-center gap-1 text-xs font-medium ${place.open !== false ? "text-success" : "text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />{place.open !== false ? "Open" : "Closed"}
                      </span>
                    </div>

                    {/* Travel time info */}
                    {activeRoute === place.placeId && travelTimes[place.placeId || ""] && (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Footprints className="h-4 w-4 text-primary" />
                          <span className="text-[10px] text-muted-foreground">Walking</span>
                          <span className="text-xs font-semibold text-foreground">{travelTimes[place.placeId || ""].walking}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Bike className="h-4 w-4 text-primary" />
                          <span className="text-[10px] text-muted-foreground">Two Wheeler</span>
                          <span className="text-xs font-semibold text-foreground">{travelTimes[place.placeId || ""].twoWheeler}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Car className="h-4 w-4 text-primary" />
                          <span className="text-[10px] text-muted-foreground">Four Wheeler</span>
                          <span className="text-xs font-semibold text-foreground">{travelTimes[place.placeId || ""].fourWheeler}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${activeRoute === place.placeId ? "text-emergency" : "text-primary"}`}>
                        <Route className="h-3 w-3" />
                        {activeRoute === place.placeId ? "Route Shown ✓" : "Tap for Route"}
                      </span>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&destination_place_id=${place.placeId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation className="h-3 w-3" />Get Directions
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default NearbyHospitals;
