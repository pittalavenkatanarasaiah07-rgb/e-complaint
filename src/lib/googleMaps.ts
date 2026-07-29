// Shared Google Maps JS API loader using the Lovable Google Maps connector browser key.
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

const CALLBACK_NAME = "__lovableInitGoogleMaps";
let loaderPromise: Promise<void> | null = null;

export const googleMapsKeyAvailable = () => Boolean(BROWSER_KEY);

export function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Google Maps browser key is not configured"));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-lovable-gmaps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }

    (window as any)[CALLBACK_NAME] = () => resolve();

    const params = new URLSearchParams({
      key: BROWSER_KEY,
      libraries: "places",
      loading: "async",
      callback: CALLBACK_NAME,
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.lovableGmaps = "true";
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  loaderPromise.catch(() => { loaderPromise = null; });
  return loaderPromise;
}
