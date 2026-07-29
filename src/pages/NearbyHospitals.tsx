import { useEffect, useRef, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { MapPin, Clock, Navigation, Loader2, AlertCircle, Heart, Route, Car, Bike, Footprints, ChevronDown, ChevronUp, CornerDownRight, LocateFixed, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

const GOOGLE_API_KEY = "AIzaSyASY-gWNWZtkBySNO9dvdpMzz5NtyfgYzQ";

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
  const watchIdRef = useRef<number | null>(null);
  const userMarkerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const mapInitializedRef = useRef(false);
  const lastSearchTimeRef = useRef(0);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelInfo>>({});
  const [filterQuery, setFilterQuery] = useState("");
  const [routeSteps, setRouteSteps] = useState<Record<string, { instruction: string; distance: string; duration: string }[]>>({});
  const [showSteps, setShowSteps] = useState<Record<string, boolean>>({});
  const [locationLabel, setLocationLabel] = useState<string>("");

  const { t } = useLanguage();

  // Watch live location - only update marker, don't reinit map
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: 28.6139, lng: 77.2090 });
      setLocationLabel("Delhi (default)");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!userLocation) {
          setUserLocation(loc);
        }
        setLocationLabel(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
        if (userMarkerRef.current) userMarkerRef.current.setPosition(loc);
        if (radiusCircleRef.current) radiusCircleRef.current.setCenter(loc);
      },
      () => {
        if (!userLocation) {
          setUserLocation({ lat: 28.6139, lng: 77.2090 });
          setLocationLabel("Delhi (default)");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

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
    // Use haversine-based estimates instead of DistanceMatrix API
    const dist = getDistanceNum(userLocation, destination);
    const walkMins = Math.round((dist / 5) * 60);
    const driveMins = Math.round((dist / 30) * 60);
    const bikeMins = Math.round((dist / 25) * 60);
    const info: TravelInfo = {
      walking: walkMins < 60 ? `${walkMins} mins` : `${Math.floor(walkMins / 60)} hr ${walkMins % 60} mins`,
      twoWheeler: bikeMins < 60 ? `${bikeMins} mins` : `${Math.floor(bikeMins / 60)} hr ${bikeMins % 60} mins`,
      fourWheeler: driveMins < 60 ? `${driveMins} mins` : `${Math.floor(driveMins / 60)} hr ${driveMins % 60} mins`,
    };
    setTravelTimes((prev) => ({ ...prev, [destination.placeId || ""]: info }));
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

  const searchNearbyPlaces = useCallback(async (map: any, location: { lat: number; lng: number }) => {
    const now = Date.now();
    if (now - lastSearchTimeRef.current < 15000) {
      setLoading(false);
      return;
    }
    lastSearchTimeRef.current = now;
    try {
      const g = (window as any).google;
      const { Place, SearchNearbyRankPreference } = await g.maps.importLibrary("places") as any;
      let allResults: Place[] = [];
      const searches = [
        { types: ["hospital"], placeType: "hospital" as const },
        { types: ["doctor"], placeType: "clinic" as const },
      ];
      for (const { types, placeType } of searches) {
        try {
          const request = {
            fields: ["displayName", "location", "formattedAddress", "id", "businessStatus"],
            locationRestriction: {
              center: new g.maps.LatLng(location.lat, location.lng),
              radius: 2000,
            },
            includedPrimaryTypes: types,
            maxResultCount: 20,
            rankPreference: SearchNearbyRankPreference.DISTANCE,
          };
          const { places: results } = await Place.searchNearby(request);
          if (results && results.length > 0) {
            const found: Place[] = results.map((place: any) => ({
              name: place.displayName || "Medical Facility",
              address: place.formattedAddress || "Address not available",
              lat: place.location.lat(), lng: place.location.lng(),
              open: true,
              placeId: place.id, type: placeType,
            }));
            allResults = [...allResults, ...found];
          }
        } catch (e) {
          console.error(`Search for ${placeType} failed:`, e);
        }
      }
      const unique = Array.from(new Map(allResults.map((p) => [p.placeId, p])).values());
      unique.sort((a, b) => getDistanceNum(location, a) - getDistanceNum(location, b));
      setPlaces(unique);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      unique.forEach((s) => {
        const marker = new g.maps.Marker({
          position: { lat: s.lat, lng: s.lng }, map, title: s.name,
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="#16A34A"/><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="none" stroke="#166534" stroke-width="1"/><rect x="13" y="8" width="6" height="16" rx="1" fill="white"/><rect x="8" y="13" width="16" height="6" rx="1" fill="white"/></svg>'),
            scaledSize: new g.maps.Size(32, 40),
            anchor: new g.maps.Point(16, 40),
          },
        });
        markersRef.current.push(marker);
        marker.addListener("click", () => showRouteRef.current(s));
      });
      if (unique.length > 0) {
        const bounds = new g.maps.LatLngBounds();
        bounds.extend(new g.maps.LatLng(location.lat, location.lng));
        unique.forEach((s) => bounds.extend(new g.maps.LatLng(s.lat, s.lng)));
        map.fitBounds(bounds, 50);
      }
    } catch (e) {
      console.error("Places search failed:", e);
    }
    setLoading(false);
  }, []);

  // Init map only once
  useEffect(() => {
    if (!userLocation || !mapRef.current || mapInitializedRef.current) return;
    const loadAndInit = () => {
      const google = (window as any).google;
      if (!google?.maps) {
        setLocationError(true);
        setLoading(false);
        return;
      }
      mapInitializedRef.current = true;
      const map = new google.maps.Map(mapRef.current, {
        center: userLocation, zoom: 14,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: true,
        mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR, position: google.maps.ControlPosition.TOP_RIGHT },
        zoomControl: true, streetViewControl: false, fullscreenControl: true,
      });
      mapInstanceRef.current = map;
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation, map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#2563EB", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        title: "Your Location", zIndex: 999,
      });
      radiusCircleRef.current = new google.maps.Circle({
        map, center: userLocation, radius: 2000,
        fillColor: "#DC2626", fillOpacity: 0.08,
        strokeColor: "#DC2626", strokeOpacity: 0.4, strokeWeight: 2,
      });
      setMapLoaded(true);
      searchNearbyPlaces(map, userLocation);
    };

    loadGoogleMaps()
      .then(() => loadAndInit())
      .catch((e) => {
        console.error("Google Maps load failed:", e);
        setLocationError(true);
        setLoading(false);
      });
  }, [userLocation, searchNearbyPlaces]);

  const scrollToMap = () => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handlePlaceClick = (place: Place) => {
    showRoute(place);
    scrollToMap();
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationLabel(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(loc);
          if (userMarkerRef.current) userMarkerRef.current.setPosition(loc);
          if (radiusCircleRef.current) radiusCircleRef.current.setCenter(loc);
          setUserLocation(loc);
          searchNearbyPlaces(mapInstanceRef.current, loc);
        }
      },
      () => { toast("Could not get location"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const filteredPlaces = places.filter((p) =>
    p.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    p.address.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("nearbyHospitals")} subtitle={t("hospitalsNearYou")} />
      <main className="flex-1 space-y-4 px-5 py-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleUseMyLocation}>
            <LocateFixed className="mr-1 h-4 w-4" /> My Location
          </Button>
          {locationLabel && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" /> {locationLabel}
            </p>
          )}
        </div>

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
              {activeRoute && userLocation && (() => {
                const dest = places.find(p => p.placeId === activeRoute);
                if (!dest) return null;
                const url = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${dest.lat},${dest.lng}`;
                return (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95">
                    <ExternalLink className="h-4 w-4" /> Open in Google Maps
                  </a>
                );
              })()}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-destructive" />
                <span className="ml-2 text-sm text-muted-foreground">{t("findingHospitals")}</span>
              </div>
            ) : places.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Heart className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("noHospitalsFound")}</p>
                <p className="text-xs text-muted-foreground">No hospitals found within 2 km radius</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder={t("searchHospitals")}
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {filteredPlaces.length} {t("hospitalsFound")} <span className="font-normal text-muted-foreground text-xs">(within 2 km)</span>
                  </p>
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
