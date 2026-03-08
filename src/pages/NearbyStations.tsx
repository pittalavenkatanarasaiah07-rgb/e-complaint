import PageHeader from "@/components/PageHeader";
import { MapPin, Phone, Clock, Navigation } from "lucide-react";

const stations = [
  {
    name: "Cyberabad Police Station",
    address: "Madhapur, Hyderabad, 500081",
    distance: "1.2 km",
    phone: "040-27855000",
    open: true,
  },
  {
    name: "Gachibowli Police Station",
    address: "Gachibowli, Hyderabad, 500032",
    distance: "2.8 km",
    phone: "040-27855100",
    open: true,
  },
  {
    name: "Miyapur Police Station",
    address: "Miyapur, Hyderabad, 500049",
    distance: "4.5 km",
    phone: "040-27855200",
    open: true,
  },
  {
    name: "Kondapur Police Station",
    address: "Kondapur, Hyderabad, 500084",
    distance: "3.1 km",
    phone: "040-27855300",
    open: false,
  },
];

const NearbyStations = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="Nearby Stations" subtitle="Police stations near you" />

      <main className="flex-1 space-y-4 px-5 py-6">
        {/* Map placeholder */}
        <div className="flex h-48 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Navigation className="h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Map View</span>
            <span className="text-xs">Enable location to see nearby stations</span>
          </div>
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
                  {station.distance}
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
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default NearbyStations;
