import { useEffect, useRef, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { MapPin, Clock, Navigation, Loader2, AlertCircle, Route, Car, Bike, Footprints, Search, ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";

const GOOGLE_MAPS_API_KEYS = [
  "AIzaSyDcBmcwDKT8vKmF3rLn2wJgEqdkPCj_CBk",
  "AIzaSyAY0t7mdhRjMnjvqL7T2MtnfC_u8LAW6wU",
];

interface Station {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  open?: boolean;
  placeId?: string;
}

interface TravelInfo {
  walking: string;
  twoWheeler: string;
  fourWheeler: string;
}

const NearbyStations = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const showRouteRef = useRef<(station: Station) => void>(() => {});
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelInfo>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [routeSteps, setRouteSteps] = useState<Record<string, { instruction: string; distance: string; duration: string }[]>>({});
  const [showSteps, setShowSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(true); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationError(true); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const getDistanceNum = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDistance = (s: Station) => {
    if (!userLocation) return "—";
    return `${getDistanceNum(userLocation, s).toFixed(1)} km`;
  };

  const fetchTravelTimes = useCallback((destination: Station) => {
    const google = (window as any).google;
    if (!userLocation || !google) return;

    const service = new google.maps.DistanceMatrixService();
    const origin = new google.maps.LatLng(userLocation.lat, userLocation.lng);
    const dest = new google.maps.LatLng(destination.lat, destination.lng);

    const info: TravelInfo = { walking: "...", twoWheeler: "...", fourWheeler: "..." };

    [
      { mode: google.maps.TravelMode.WALKING, key: "walking" },
      { mode: google.maps.TravelMode.DRIVING, key: "fourWheeler" },
    ].forEach(({ mode, key }) => {
      service.getDistanceMatrix(
        { origins: [origin], destinations: [dest], travelMode: mode },
        (response: any, status: string) => {
          if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
            const duration = response.rows[0].elements[0].duration.text;
            if (key === "walking") {
              info.walking = duration;
            } else {
              info.fourWheeler = duration;
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

  const showRoute = useCallback((destination: Station) => {
    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;

    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);

    setActiveRoute((prev) => {
      if (prev === destination.placeId) {
        return null;
      }

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map, suppressMarkers: true,
        polylineOptions: { strokeColor: "#2563EB", strokeWeight: 6, strokeOpacity: 0.9 },
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
            fetchTravelTimes(destination);
            // Extract turn-by-turn steps
            const legs = result.routes[0]?.legs;
            if (legs && legs.length > 0) {
              const steps = legs[0].steps.map((step: any) => ({
                instruction: step.instructions,
                distance: step.distance?.text || "",
                duration: step.duration?.text || "",
              }));
              setRouteSteps((prev) => ({ ...prev, [destination.placeId || ""]: steps }));
              setShowSteps((prev) => ({ ...prev, [destination.placeId || ""]: true }));
            }
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
            bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
            map.fitBounds(bounds, 60);
          }
        }
      );

      return destination.placeId || null;
    });
  }, [userLocation, fetchTravelTimes]);

  // Keep ref in sync so marker click handlers always call latest showRoute
  useEffect(() => {
    showRouteRef.current = showRoute;
  }, [showRoute]);

  const searchNearbyStations = useCallback((map: any, location: { lat: number; lng: number }) => {
    const google = (window as any).google;
    const service = new google.maps.places.PlacesService(map);

    service.nearbySearch(
      { location: new google.maps.LatLng(location.lat, location.lng), radius: 50000, type: "police" },
      (results: any[], status: string) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const found: Station[] = results.map((place: any) => ({
            name: place.name,
            address: place.vicinity || place.formatted_address || "Address not available",
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            open: place.opening_hours?.isOpen?.() ?? true,
            placeId: place.place_id,
          }));
          found.sort((a, b) => getDistanceNum(location, a) - getDistanceNum(location, b));
          setStations(found);

          markersRef.current.forEach((m) => m.setMap(null));
          markersRef.current = [];

          found.forEach((s) => {
            const marker = new google.maps.Marker({
              position: { lat: s.lat, lng: s.lng }, map, title: s.name,
              icon: { url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" },
            });
            markersRef.current.push(marker);
            marker.addListener("click", () => showRouteRef.current(s));
          });

          if (found.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(location.lat, location.lng));
            found.forEach((s) => bounds.extend(new google.maps.LatLng(s.lat, s.lng)));
            map.fitBounds(bounds, 50);
          }
        }
        setLoading(false);
      }
    );
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
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#2563EB", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        title: "Your Location", zIndex: 999,
      });

      new google.maps.Circle({
        map, center: userLocation, radius: 2000,
        fillColor: "#2563EB", fillOpacity: 0.05,
        strokeColor: "#2563EB", strokeOpacity: 0.3, strokeWeight: 1,
      });

      setMapLoaded(true);
      searchNearbyStations(map, userLocation);
    };

    if (!(window as any).google?.maps?.places) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true; script.onload = loadAndInit;
      document.head.appendChild(script);
    } else { loadAndInit(); }
  }, [userLocation, searchNearbyStations]);

  const retryLocation = () => {
    setLocationError(false); setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setLocationError(true); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Scroll to top of map when route is shown
  const scrollToMap = () => {
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleStationClick = (station: Station) => {
    showRoute(station);
    scrollToMap();
  };

  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("nearbyStations")} subtitle={t("policeStationsNearYou")} />
      <main className="flex-1 space-y-4 px-5 py-6">
        {locationError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="h-10 w-10 text-emergency" />
            <div>
              <h3 className="font-semibold text-foreground">{t("locationRequired")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("enableLocationPolice")}</p>
            </div>
            <Button onClick={retryLocation} className="rounded-xl"><Navigation className="mr-2 h-4 w-4" />{t("tryAgain")}</Button>
          </div>
        ) : (
          <>
            <div className="relative h-[50vh] min-h-[350px] rounded-2xl border border-border overflow-hidden bg-muted">
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Navigation className="h-8 w-8 text-primary animate-pulse" />
                    <span className="text-sm font-medium">{t("detectingLocation")}</span>
                  </div>
                </div>
              )}
              <div ref={mapRef} className="h-full w-full" />
            </div>

            {userLocation && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {t("yourLocation")}: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{t("findingStations")}</span>
              </div>
            ) : stations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("noStationsFound")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchStations")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{stations.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.address.toLowerCase().includes(searchQuery.toLowerCase())).length} {t("stationsFound")}</p>
                  <p className="text-xs text-muted-foreground">{t("tapToSeeRoute")}</p>
                </div>
                {stations.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.address.toLowerCase().includes(searchQuery.toLowerCase())).map((station, i) => (
                  <div
                    key={station.placeId || i}
                    className={`rounded-2xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated cursor-pointer ${activeRoute === station.placeId ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                    onClick={() => handleStationClick(station)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <MapPin className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-semibold text-foreground leading-tight">{station.name}</h3>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground pl-10">
                          <span className="truncate">{station.address}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary ml-2">{getDistance(station)}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-4 pl-10">
                      <span className={`flex items-center gap-1 text-xs font-medium ${station.open !== false ? "text-green-600" : "text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />{station.open !== false ? t("open") : t("closed")}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${activeRoute === station.placeId ? "text-blue-600" : "text-primary"}`}>
                        <Route className="h-3 w-3" />
                        {activeRoute === station.placeId ? t("routeShown") : t("tapForRoute")}
                      </span>
                    </div>

                    {activeRoute === station.placeId && travelTimes[station.placeId || ""] && (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-primary/5 p-3 border border-primary/10">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Footprints className="h-5 w-5 text-primary" />
                          <span className="text-[10px] text-muted-foreground">{t("walking")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[station.placeId || ""].walking}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Bike className="h-5 w-5 text-primary" />
                          <span className="text-[10px] text-muted-foreground">{t("twoWheeler")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[station.placeId || ""].twoWheeler}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Car className="h-5 w-5 text-primary" />
                          <span className="text-[10px] text-muted-foreground">{t("fourWheeler")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[station.placeId || ""].fourWheeler}</span>
                        </div>
                      </div>
                    )}

                    {activeRoute === station.placeId && routeSteps[station.placeId || ""] && (
                      <div className="mt-3">
                        <button
                          className="flex w-full items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSteps((prev) => ({ ...prev, [station.placeId || ""]: !prev[station.placeId || ""] }));
                          }}
                        >
                          <span className="flex items-center gap-1.5">
                            <CornerDownRight className="h-3.5 w-3.5" />
                            Turn-by-turn directions ({routeSteps[station.placeId || ""].length} steps)
                          </span>
                          {showSteps[station.placeId || ""] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {showSteps[station.placeId || ""] && (
                          <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-card p-3">
                            {routeSteps[station.placeId || ""].map((step, idx) => (
                              <div key={idx} className="flex gap-3 text-xs">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-foreground" dangerouslySetInnerHTML={{ __html: step.instruction }} />
                                  <p className="mt-0.5 text-muted-foreground">{step.distance} · {step.duration}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeRoute === station.placeId && (
                      <div className="mt-2 flex justify-end">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}&destination_place_id=${station.placeId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Navigation className="h-3 w-3" />{t("openInGoogleMaps")}
                        </a>
                      </div>
                    )}
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

export default NearbyStations;
