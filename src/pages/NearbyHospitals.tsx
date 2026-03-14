import { useEffect, useRef, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { MapPin, Clock, Navigation, Loader2, AlertCircle, Heart, Route, Car, Bike, Footprints, Search, ChevronDown, ChevronUp, CornerDownRight, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GOOGLE_API_KEY = "AIzaSyC1LKMKsXG77surishSPyNWJ-ayrza3ptw";

const CITIES = [
  { label: "Delhi", lat: 28.6139, lng: 77.2090 },
  { label: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { label: "Bangalore", lat: 12.9716, lng: 77.5946 },
  { label: "Chennai", lat: 13.0827, lng: 80.2707 },
  { label: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { label: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { label: "Pune", lat: 18.5204, lng: 73.8567 },
  { label: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { label: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { label: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { label: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { label: "Vijayawada", lat: 16.5062, lng: 80.6480 },
  { label: "Tirupati", lat: 13.6288, lng: 79.4192 },
];

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
  const showRouteRef = useRef<(place: Place) => void>(() => {});
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelInfo>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [routeSteps, setRouteSteps] = useState<Record<string, { instruction: string; distance: string; duration: string }[]>>({});
  const [showSteps, setShowSteps] = useState<Record<string, boolean>>({});
  const [usingManualLocation, setUsingManualLocation] = useState(false);

  const { t } = useLanguage();

  // Auto-request location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 28.6139, lng: 77.2090 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setUserLocation({ lat: 28.6139, lng: 77.2090 });
        setUsingManualLocation(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleCitySelect = (cityLabel: string) => {
    const city = CITIES.find(c => c.label === cityLabel);
    if (!city) return;
    setUsingManualLocation(true);
    setLoading(true);
    setPlaces([]);
    setActiveRoute(null);
    setMapLoaded(false);
    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    mapInstanceRef.current = null;
    setUserLocation({ lat: city.lat, lng: city.lng });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    setPlaces([]);
    setActiveRoute(null);
    setMapLoaded(false);
    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    mapInstanceRef.current = null;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUsingManualLocation(false);
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  const fetchTravelTimes = useCallback((destination: Place) => {
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

  const showRoute = useCallback((destination: Place) => {
    const google = (window as any).google;
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;
    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    setActiveRoute((prev) => {
      if (prev === destination.placeId) return null;
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map, suppressMarkers: true,
        polylineOptions: { strokeColor: "#DC2626", strokeWeight: 6, strokeOpacity: 0.9 },
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

  useEffect(() => { showRouteRef.current = showRoute; }, [showRoute]);

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
              placeId: place.place_id, type: placeType,
            }));
            allResults = [...allResults, ...found];
          }
          if (completed === searches.length) {
            const unique = Array.from(new Map(allResults.map((p) => [p.placeId, p])).values());
            unique.sort((a, b) => getDistanceNum(location, a) - getDistanceNum(location, b));
            setPlaces(unique);
            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current = [];
            unique.forEach((s) => {
              const marker = new google.maps.Marker({
                position: { lat: s.lat, lng: s.lng }, map, title: s.name,
                icon: { url: s.type === "hospital" ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png" : "https://maps.google.com/mapfiles/ms/icons/pink-dot.png" },
              });
              markersRef.current.push(marker);
              marker.addListener("click", () => showRouteRef.current(s));
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
      if (!google?.maps) {
        setLocationError(true);
        setLoading(false);
        return;
      }
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
        fillColor: "#DC2626", fillOpacity: 0.05,
        strokeColor: "#DC2626", strokeOpacity: 0.3, strokeWeight: 1,
      });
      setMapLoaded(true);
      searchNearbyPlaces(map, userLocation);
    };

    if (!(window as any).google?.maps?.places) {
      document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(s => s.remove());
      delete (window as any).google;
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => loadAndInit();
      script.onerror = () => { setLocationError(true); setLoading(false); };
      document.head.appendChild(script);
    } else {
      loadAndInit();
    }
  }, [userLocation, searchNearbyPlaces]);

  const scrollToMap = () => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handlePlaceClick = (place: Place) => {
    showRoute(place);
    scrollToMap();
  };

  const filteredPlaces = places.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("nearbyHospitals")} subtitle={t("hospitalsNearYou")} />
      <main className="flex-1 space-y-4 px-5 py-6">
        {/* Manual Location Picker */}
        <div className="flex items-center gap-2">
          <Select onValueChange={handleCitySelect}>
            <SelectTrigger className="flex-1 rounded-xl">
              <SelectValue placeholder={t("selectCity") || "Select a city"} />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map(city => (
                <SelectItem key={city.label} value={city.label}>
                  {city.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={handleUseMyLocation} title={t("useMyLocation") || "Use my location"}>
            <LocateFixed className="h-4 w-4" />
          </Button>
        </div>

        {usingManualLocation && userLocation && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            {t("showingResultsFor") || "Showing results for"}: {CITIES.find(c => c.lat === userLocation.lat && c.lng === userLocation.lng)?.label || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`}
          </p>
        )}

        {locationError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <h3 className="font-semibold text-foreground">{t("locationRequired")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("enableLocationHospital")}</p>
            </div>
            <Button onClick={handleUseMyLocation} className="rounded-xl"><Navigation className="mr-2 h-4 w-4" />{t("tryAgain")}</Button>
          </div>
        ) : (
          <>
            <div className="relative h-[50vh] min-h-[350px] rounded-2xl border border-border overflow-hidden bg-muted">
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Heart className="h-8 w-8 text-destructive animate-pulse" />
                    <span className="text-sm font-medium">{t("detectingLocation")}</span>
                  </div>
                </div>
              )}
              <div ref={mapRef} className="h-full w-full" />
            </div>

            {userLocation && !usingManualLocation && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {t("yourLocation")}: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-destructive" />
                <span className="ml-2 text-sm text-muted-foreground">{t("findingHospitals")}</span>
              </div>
            ) : places.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Heart className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("noHospitalsFound")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchHospitals")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{filteredPlaces.length} {t("hospitalsFound")}</p>
                  <p className="text-xs text-muted-foreground">{t("tapToSeeRoute")}</p>
                </div>
                {filteredPlaces.map((place, i) => (
                  <div
                    key={place.placeId || i}
                    className={`rounded-2xl border bg-card p-4 shadow-card transition-all hover:shadow-elevated cursor-pointer ${activeRoute === place.placeId ? "border-destructive ring-2 ring-destructive/20" : "border-border"}`}
                    onClick={() => handlePlaceClick(place)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${place.type === "hospital" ? "bg-destructive/10" : "bg-primary/10"}`}>
                            <Heart className={`h-4 w-4 ${place.type === "hospital" ? "text-destructive" : "text-primary"}`} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-foreground leading-tight">{place.name}</h3>
                            <span className={`text-[10px] font-medium ${place.type === "hospital" ? "text-destructive" : "text-primary"}`}>
                              {place.type === "hospital" ? t("hospital") : t("clinic")}
                            </span>
                          </div>
                        </div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground pl-10">
                          <span className="truncate">{place.address}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary ml-2">{getDistance(place)}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-4 pl-10">
                      <span className={`flex items-center gap-1 text-xs font-medium ${place.open !== false ? "text-green-600" : "text-muted-foreground"}`}>
                        <Clock className="h-3.5 w-3.5" />{place.open !== false ? t("open") : t("closed")}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${activeRoute === place.placeId ? "text-destructive" : "text-primary"}`}>
                        <Route className="h-3 w-3" />
                        {activeRoute === place.placeId ? t("routeShown") : t("tapForRoute")}
                      </span>
                    </div>

                    {activeRoute === place.placeId && travelTimes[place.placeId || ""] && (
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-destructive/5 p-3 border border-destructive/10">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Footprints className="h-5 w-5 text-destructive" />
                          <span className="text-[10px] text-muted-foreground">{t("walking")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[place.placeId || ""].walking}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Bike className="h-5 w-5 text-destructive" />
                          <span className="text-[10px] text-muted-foreground">{t("twoWheeler")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[place.placeId || ""].twoWheeler}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Car className="h-5 w-5 text-destructive" />
                          <span className="text-[10px] text-muted-foreground">{t("fourWheeler")}</span>
                          <span className="text-xs font-bold text-foreground">{travelTimes[place.placeId || ""].fourWheeler}</span>
                        </div>
                      </div>
                    )}

                    {activeRoute === place.placeId && routeSteps[place.placeId || ""] && (
                      <div className="mt-2 pl-10">
                        <button
                          className="flex items-center gap-1 text-xs text-destructive font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSteps((prev) => ({ ...prev, [place.placeId || ""]: !prev[place.placeId || ""] }));
                          }}
                        >
                          {showSteps[place.placeId || ""] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {showSteps[place.placeId || ""] ? t("hideSteps") || "Hide Steps" : t("showSteps") || "Show Steps"}
                        </button>
                        {showSteps[place.placeId || ""] && (
                          <div className="mt-2 space-y-1.5">
                            {routeSteps[place.placeId || ""].map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <CornerDownRight className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                                <span dangerouslySetInnerHTML={{ __html: step.instruction }} />
                                <span className="shrink-0 text-[10px] text-muted-foreground/70">{step.distance}</span>
                              </div>
                            ))}
                          </div>
                        )}
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

export default NearbyHospitals;
