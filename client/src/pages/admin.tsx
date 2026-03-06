import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin, LogOut, Wifi, Home, Building } from "lucide-react";
import OfficeMap from "@/components/office-map";
import AdminSidebar from "@/components/admin-sidebar";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { getEffectiveStatus } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setSuppressWsToasts } from "@/lib/suppressWsToasts";
import type { Location, Floor } from "@shared/schema";

function LoginForm({ onLogin }: { onLogin: (username: string, password: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <MapPin className="text-primary text-3xl mb-3 mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">Вход для администратора</h3>
            <p className="text-sm text-muted-foreground">Введите данные для входа в админ‑панель</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Логин</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите логин"
                required
                data-testid="input-username"
              />
            </div>

            <div>
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                data-testid="input-password"
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Link href="/">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  data-testid="button-cancel-login"
                >
                  Отмена
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1"
                data-testid="button-submit-login"
              >
                Войти
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const { isAuthenticated, login, logout, isLoading, isHr, isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const [currentFloor, setCurrentFloor] = useState<string>("");
  const [floorsCollapsed, setFloorsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('adminFloorsCollapsed') === '1'; } catch { return false; }
  });
  const [isAdminPanelCollapsed, setIsAdminPanelCollapsed] = useState<boolean>(false);

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ["/api/floors"],
    enabled: isAuthenticated,
  });

  // Drag & drop reordering state for floor buttons (admin only)
  const queryClient = useQueryClient();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    if (floors.length > 0 && (!order.length || !floors.every(f => order.includes(f.id)))) {
      setOrder(floors.map(f => f.id));
    }
  }, [floors]);

  function handleDragStart(id: string) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>, id: string) { e.preventDefault(); if (draggedId && draggedId !== id) {
    const newOrder = order.filter((x: string) => x !== draggedId);
    const idx = newOrder.indexOf(id);
    newOrder.splice(idx, 0, draggedId);
    setOrder(newOrder);
  }}
  async function handleDrop() {
    setDraggedId(null);
    // persist new order to server in a single bulk request
    try {
      await apiRequest("PUT", "/api/admin/floors/order", { ids: order });
      await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
      toast({ title: 'Успех', description: 'Порядок этажей обновлён' });
    } catch (e: any) {
      toast({ title: 'Ошибка', description: String(e?.message || e), variant: 'destructive' });
    }
  }

  useEffect(() => {
    // Устанавливаем начальный этаж только когда floors загружены впервые
    if (floors.length > 0 && !currentFloor) {
      setCurrentFloor(floors[0].code);
    }
  }, [floors]);

  const { data: locations = [], refetch } = useQuery<Location[]>({
    queryKey: ["/api/locations", currentFloor],
    queryFn: async () => {
      const res = await fetch(`/api/locations?floor=${currentFloor}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated,
  });

  const [foundLocationId, setFoundLocationId] = useState<string | null>(null);

  const handleLocationFound = (locationId: string) => {
    setFoundLocationId(locationId);
    // Clear after 6s (5s highlight + 1s graceful fade-out)
    setTimeout(() => setFoundLocationId(null), 6000);
  };

  useWebSocket(refetch, true); // isAdmin=true - show notifications only in admin panel

  const handleLogin = async (username: string, password: string) => {
    try {
      await login(username, password);
      toast({
        title: "Успех",
        description: "Вы успешно вошли",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Неверные учетные данные",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Успех",
        description: "Вы вышли из системы",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить выход",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка…</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const stats = {
    total: locations.length,
    available: locations.filter(l => getEffectiveStatus(l) === "available").length,
    occupied: locations.filter(l => getEffectiveStatus(l) === "occupied").length,
    maintenance: locations.filter(l => getEffectiveStatus(l) === "maintenance").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdminPanelCollapsed(!isAdminPanelCollapsed)}
                data-testid="button-collapse-panel"
              >
                {isAdminPanelCollapsed ? '→ Развернуть админ панель' : '← Свернуть админ панель'}
              </Button>
              <MapPin className="text-primary text-2xl" />
              <h1 className="text-xl font-semibold text-foreground">Карта офисного пространства</h1>
              <div className="flex items-center space-x-2 ml-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">SpectrumData</span>
                <Wifi className="w-4 h-4 text-green-500" />
              </div>

              {/* Floor Selector with collapse */}
              <div className="flex items-center space-x-2 ml-6">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Этаж:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const v = !(localStorage.getItem('adminFloorsCollapsed') === '1');
                    try { localStorage.setItem('adminFloorsCollapsed', v ? '1' : '0'); } catch {}
                    setFloorsCollapsed(v);
                  }}
                  data-testid="toggle-floors"
                >
                  {floorsCollapsed ? 'Развернуть' : 'Свернуть'}
                </Button>
                {!floorsCollapsed && (
                  <div className="flex space-x-1">
                    {order.map((id) => {
                      const f = floors.find(x => x.id === id);
                      if (!f || (isHr && !(f.showInPublic ?? true))) return null;
                      return (
                        <div
                          key={f.id}
                          draggable={!isHr}
                          onDragStart={() => handleDragStart(f.id)}
                          onDragOver={(e) => handleDragOver(e, f.id)}
                          onDrop={handleDrop}
                        >
                          <Button
                            variant={currentFloor === f.code ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentFloor(f.code)}
                            data-testid={`button-floor-${f.code}`}
                          >
                            {f.code}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


            </div>

            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button
                  variant="secondary"
                  data-testid="button-public-view"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Публичный режим
                </Button>
              </Link>
              <Button
                variant="destructive"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)] bg-background">
        {/* Admin Sidebar */}
        {!isAdminPanelCollapsed && <AdminSidebar locations={locations} stats={stats} currentFloor={currentFloor} onFindLocation={handleLocationFound} highlightedLocationId={foundLocationId} />}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Map Controls */}
            <div className="bg-card border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-semibold text-foreground">{isAdminPanelCollapsed ? 'Публичный режим' : (isHr ? 'Режим HR' : 'Режим администратора')}</h2>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-muted-foreground">Доступно ({stats.available})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <span className="text-muted-foreground">Занято ({stats.occupied})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      <span className="text-muted-foreground">На обслуживании ({stats.maintenance})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Office Map */}
            <OfficeMap locations={locations} isAdminMode={true} currentFloor={currentFloor} refetchLocations={refetch} foundLocationId={foundLocationId} />
          </div>
        </main>
      </div>
    </div>
  );
}
