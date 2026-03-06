import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { User, MapPin, Wifi, Building } from "lucide-react";
import OfficeMap from "@/components/office-map";
import LocationSearch from "@/components/location-search";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { getEffectiveStatus } from "@/lib/utils";
import type { Location, Floor } from "@shared/schema";

export default function Home() {
  const [currentFloor, setCurrentFloor] = useState("5");
  const [publicLinks, setPublicLinks] = useState<{ title: string; url: string }[]>([]);

  const { data: floors = [], refetch: refetchFloors } = useQuery<Floor[]>({
    queryKey: ["/api/floors"],
  });

  // Debug: log floors
  useEffect(() => {
    // Floors loaded
  }, [floors]);

  // Only show floors that are enabled for public mode
  const publicFloors = floors.filter(f => (f.showInPublic ?? true));

  useEffect(() => {
    if (publicFloors.length > 0) {
      const exists = publicFloors.some(f => f.code === currentFloor);
      if (!exists) {
        setCurrentFloor(publicFloors[0].code);
      }
    }
  }, [publicFloors]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('publicLinks');
      if (raw) setPublicLinks(JSON.parse(raw));
      else setPublicLinks([]);
    } catch { setPublicLinks([]); }
  }, []);

  const { data, refetch } = useQuery<Location[]>({
    queryKey: ["/api/locations", currentFloor],
    queryFn: async () => {
      const res = await fetch(`/api/locations?floor=${currentFloor}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Defensive: sometimes the server may return an object (error payload) — ensure we always have an array
  const locations: Location[] = Array.isArray(data) ? data : (data ? [] : []);

  // When WebSocket receives any update, refetch both floors and locations so public view reflects admin changes
  useWebSocket(() => {
    try { refetchFloors(); } catch (e) { /* ignore */ }
    try { refetch(); } catch (e) { /* ignore */ }
  }, false); // isAdmin=false - don't show notifications on public page

  const stats = {
    total: locations.length,
    available: locations.filter(l => getEffectiveStatus(l) === "available").length,
    occupied: locations.filter(l => getEffectiveStatus(l) === "occupied").length,
    maintenance: locations.filter(l => getEffectiveStatus(l) === "maintenance").length,
  };

  // Для поиска и центрирования маркера
  const [foundLocationId, setFoundLocationId] = useState<string | null>(null);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);

  const highlightTimerRef = useRef<number | null>(null);

  const handleFindLocation = useCallback((locationId: string) => {
    setFoundLocationId(locationId);
    // clear previous timer if any
    try { if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current); } catch (e) {}
    const id = window.setTimeout(() => setFoundLocationId(null), 6000); // сбросить подсветку через 6 сек
    highlightTimerRef.current = id;
  }, []);

  const handleLocationsFiltered = useCallback((locations: Location[]) => {
    setFilteredLocations(locations);
  }, []);

  // Очистка таймера при размонтировании компоненты
  useEffect(() => {
    return () => {
      try { if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current); } catch (e) {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {/* Кнопка админ-панели слева */}
              <Link href="/admin">
                <button
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors mr-4"
                  data-testid="button-admin-panel"
                >
                  <User className="w-4 h-4 mr-2 inline" />
                  Админ‑панель
                </button>
              </Link>
              <MapPin className="text-primary text-2xl" />
              <h1 className="text-xl font-semibold text-foreground">Карта офисного пространства</h1>
              <div className="flex items-center space-x-2 ml-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">SpectrumData</span>
                <Wifi className="w-4 h-4 text-green-500" />
              </div>
              {/* Floor Selector */}
              <div className="flex items-center space-x-2 ml-6">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Этаж:</span>
                  <div className="flex space-x-1">
                  {publicFloors.map((floor) => (
                    <Button
                      key={floor.id}
                      variant={currentFloor === floor.code ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentFloor(floor.code)}
                      data-testid={`button-floor-${floor.code}`}
                    >
                      {floor.code}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {/* Блок ресурсов убран из хедера */}
          </div>
        </div>
      </header>

      <div className="flex h-screen bg-background relative">
        {/* Блок ресурсов полностью удалён */}
        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Map Controls */}
            <div className="bg-card border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-semibold text-foreground">План этажа</h2>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-muted-foreground" data-testid="text-available-count">Доступно ({stats.available})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <span className="text-muted-foreground" data-testid="text-occupied-count">Занято ({stats.occupied})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span className="text-muted-foreground" data-testid="text-maintenance-count">На обслуживании ({stats.maintenance})</span>
                    </div>
                  </div>
                </div>
                {/* Поиск локации справа (позиционируется абсолютно, чтобы не влиять на высоту строки) */}
                <div className="relative">
                  <div className="absolute right-4 z-20" style={{ top: 'calc(1rem - 1cm)' }}>
                    <LocationSearch
                      locations={locations}
                      onFind={handleFindLocation}
                      onLocationsFiltered={handleLocationsFiltered}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Office Map */}
            <OfficeMap
              locations={filteredLocations.length > 0 ? filteredLocations : locations}
              isAdminMode={false}
              currentFloor={currentFloor}
              foundLocationId={foundLocationId}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
