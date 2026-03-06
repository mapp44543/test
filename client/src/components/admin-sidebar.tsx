// --- Компонент списка этажей с drag&drop ---

interface FloorListProps {
  floors: Floor[];
  isHr: boolean;
  onPickImage: (floor: Floor) => void;
  onDelete: (id: string) => void;
  onReorder: (newOrder: string[]) => void;
}

function FloorList({ floors, isHr, onPickImage, onDelete, onReorder }: FloorListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(() => floors.map((f: Floor) => f.id));
  useEffect(() => {
    const newOrder = floors.map((f: Floor) => f.id);
    setOrder((prev) => {
      if (prev.length === newOrder.length && prev.every((v, i) => v === newOrder[i])) return prev;
      return newOrder;
    });
  }, [floors]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingCode, setEditingCode] = useState<string>("");

  useEffect(() => {
    // keep inputs in sync when floors change, but avoid setting state if values are unchanged
    if (editingId) {
      const f = floors.find(x => x.id === editingId);
      const name = f?.name ?? "";
      const code = f?.code ?? "";
      setEditingName(prev => (prev === name ? prev : name));
      setEditingCode(prev => (prev === code ? prev : code));
    }
  }, [floors, editingId]);

  function handleDragStart(id: string) { setDraggedId(id); }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>, id: string) { e.preventDefault(); if (draggedId && draggedId !== id) {
    const newOrder = order.filter((x: string) => x !== draggedId);
    const idx = newOrder.indexOf(id);
    newOrder.splice(idx, 0, draggedId);
    setOrder(newOrder);
  }}
  function handleDrop() { setDraggedId(null); onReorder(order); }

  

  return (
    <div>
      {order.map((id: string) => {
        const f = floors.find((x: Floor) => x.id === id);
        if (!f) return null;
        return (
          <Card key={f.id} className="border border-border" draggable={!isHr}
            onDragStart={() => handleDragStart(f.id)}
            onDragOver={e => handleDragOver(e, f.id)}
            onDrop={handleDrop}
            style={{ opacity: draggedId === f.id ? 0.5 : 1, cursor: !isHr ? 'grab' : undefined }}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {editingId === f.id ? (
                    <span className="ml-2">
                      <input
                        className="border rounded px-2 py-1 mr-2 text-sm w-20"
                        value={editingCode}
                        onChange={e => setEditingCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                        placeholder="Код"
                      />
                      <input
                        className="border rounded px-2 py-1 ml-2 text-sm w-36"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                        placeholder="Название (опционально)"
                        autoFocus
                      />
                    </span>
                  ) : (
                    <>{f.code} {f.name ? `— ${f.name}` : ""}</>
                  )}
                </div>
                {f.imageUrl && <div className="text-xs text-muted-foreground truncate max-w-[240px]">{f.imageUrl}</div>}
              </div>
              <div className="flex items-center gap-2">
                {!isHr && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onPickImage(f)}><Upload className="w-3 h-3 mr-1" /> Карту</Button>
                    {/* Eye toggle: show/hide floor in public mode */}
                      {/* Switch: show/hide floor in public mode */}
                      <Switch
                        aria-label={f.showInPublic ? 'Скрыть в публичном режиме' : 'Показать в публичном режиме'}
                        checked={Boolean(f.showInPublic)}
                        onCheckedChange={async (val: boolean) => {
                          setTogglingId(f.id);
                          try {
                            const result = await apiRequest('PUT', `/api/admin/floors/${f.id}`, { showInPublic: val });
                            await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
                            toast({ title: 'Успех', description: `Этаж ${val ? 'показывается' : 'скрыт'} в публичном режиме` });
                          } catch (err: any) {
                            toast({ title: 'Ошибка', description: err?.message || 'Не удалось переключить видимость', variant: 'destructive' });
                          } finally {
                            setTogglingId(null);
                          }
                        }}
                        disabled={togglingId === f.id}
                      />
                    {editingId === f.id ? (
                      <>
                        <Button size="sm" variant="outline" onClick={async () => {
                          // validate code not empty and not duplicate
                          const codeTrim = (editingCode || '').trim();
                          if (!codeTrim) { toast({ title: 'Ошибка', description: 'Код этажа не может быть пустым', variant: 'destructive' }); return; }
                          const duplicate = floors.find(x => x.code === codeTrim && x.id !== f.id);
                          if (duplicate) { toast({ title: 'Ошибка', description: 'Код этажа уже используется', variant: 'destructive' }); return; }
                          try {
                            await apiRequest('PUT', `/api/admin/floors/${f.id}`, { code: codeTrim, name: editingName });
                            await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
                            toast({ title: 'Успех', description: 'Этаж обновлён' });
                            setEditingId(null);
                            setEditingName('');
                            setEditingCode('');
                          } catch (err: any) {
                            toast({ title: 'Ошибка', description: err?.message || 'Не удалось сохранить', variant: 'destructive' });
                          }
                        }}>Сохранить</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(''); setEditingCode(''); }}>Отмена</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(f.id); setEditingName(f.name ?? ""); setEditingCode(f.code ?? ""); }}><Edit className="w-3 h-3" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onDelete(f.id)} disabled={floors.length <= 1}><Trash className="w-3 h-3" /></Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
// --- Форма добавления этажа ---
function AddFloorForm({ onCreate, isLoading }: { onCreate: (floor: InsertFloor) => void, isLoading: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    onCreate({ code, name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="floor-code">Код этажа</Label>
        <Input id="floor-code" value={code} onChange={e => setCode(e.target.value)} placeholder="Например: 5, 9, MSK" required />
      </div>
      <div>
        <Label htmlFor="floor-name">Название этажа</Label>
        <Input id="floor-name" value={name} onChange={e => setName(e.target.value)} placeholder="Например: Офис Москва" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading || !code.trim()} data-testid="button-create-floor">Создать этаж</Button>
      </div>
    </form>
  );
}
// Rewritten AdminSidebar: implements add-location form with Name, Floor, Type, and Equipment fields
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, GripVertical, Edit, Trash, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import type { Floor, InsertFloor, Location, InsertLocation, PublicLink } from "../../../shared/schema";
import LocationModal from "@/components/location-modal";

interface ADSyncStatus {
  enabled: boolean;
  isRunning: boolean;
  schedule: string;
  nextExecution?: string;
  lastSyncTime?: string;
  lastSyncSuccess?: boolean;
}

interface AdminSidebarProps {
  locations: Location[];
  stats: { total: number; available: number; occupied: number; maintenance: number };
  currentFloor: string;
  onFindLocation?: (locationId: string) => void;
  highlightedLocationId?: string | null;
  centerX?: number;
  centerY?: number;
}

const getStatusColor = (statusOrLocation: string | Location, typeArg?: string) => {
  // Allow passing the whole Location object for richer context
  try {
    let type = typeArg;
    let status = (typeof statusOrLocation === 'string' ? statusOrLocation : (statusOrLocation && (statusOrLocation as Location).status)) || '';

    // If a Location object was passed, and it's a socket - read Cisco status from customFields
    if (typeof statusOrLocation !== 'string') {
      const loc = statusOrLocation as Location;
      type = loc.type || type;
      if (loc.type === 'socket') {
        const cf = loc.customFields && typeof loc.customFields === 'object' ? (loc.customFields as Record<string, any>) : {};
        const raw = String(cf['Status'] || cf['status'] || cf['CiscoStatus'] || cf['ciscoStatus'] || '').trim().toLowerCase();
        if (!raw) return 'bg-yellow-500'; // no Cisco status -> maintenance
        if (raw.includes('notconnect') || raw.includes('not connected') || raw === 'no' || raw.includes('down') || raw.includes('disabled')) return 'bg-red-500';
        if (raw.includes('connect') || raw.includes('connected') || raw === 'up') return 'bg-emerald-500';
        return 'bg-gray-500';
      }
    }

    // Fallback: app-level statuses
    status = String(status).toLowerCase();
    switch (status) {
      case "available":
        return "bg-emerald-500";
      case "occupied":
        return "bg-orange-500";
      case "maintenance":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  } catch (e) {
    return 'bg-gray-500';
  }
};

export default function AdminSidebar({ locations, stats, currentFloor, onFindLocation, highlightedLocationId, centerX, centerY }: AdminSidebarProps) {
  const { isHr } = useAdminAuth();
  const { data: floors = [] } = useQuery<Floor[]>({ queryKey: ["/api/floors"] });
  const { data: adSyncStatus } = useQuery<ADSyncStatus>({
    queryKey: ["/api/admin/ad-sync/status"],
    refetchInterval: 60000, // Обновлять каждую минуту
  });
  // Получаем порядок этажей для отображения
  const floorOrder = floors.map(f => f.code + (f.name ? ` — ${f.name}` : ""));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickAdd, setIsQuickAdd] = useState(false);

  const [linksCollapsed, setLinksCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('adminLinksCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('adminLinksCollapsed', linksCollapsed ? '1' : '0'); } catch {}
  }, [linksCollapsed]);

  const [sidebarFloorsCollapsed, setSidebarFloorsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('adminSidebarFloorsCollapsed') === '1'; } catch { return false; }
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      if (typeof window !== "undefined") {
        const v = parseInt(localStorage.getItem("adminSidebarWidth") || "", 10);
        if (!Number.isNaN(v) && v > 0) return v;
      }
    } catch (e) {
      // ignore
    }
    return 320;
  });

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const [newLocation, setNewLocation] = useState<Partial<InsertLocation>>({
    name: "",
    type: "meeting-room",
    status: "available",
    floor: currentFloor,
    equipment: "",
    x: centerX ?? 400,
    y: centerY ?? 300,
    width: 80,
    height: 60,
    customFields: {},
  });


  const [adLogin, setAdLogin] = useState<string>("");
  const [isFillingFromAd, setIsFillingFromAd] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const editingLocation = editingLocationId ? locations.find(loc => loc.id === editingLocationId) || null : null;
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('adminAccordionItems');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('adminAccordionItems', JSON.stringify(openAccordionItems));
    } catch {}
  }, [openAccordionItems]);

  useEffect(() => setNewLocation((prev) => ({ ...prev, floor: currentFloor })), [currentFloor]);
  // Центрируем x/y при изменении размеров карты
  useEffect(() => {
    setNewLocation((prev) => ({ ...prev, x: centerX ?? 400, y: centerY ?? 300 }));
  }, [centerX, centerY]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const clientX = e.clientX;
      const dx = clientX - startXRef.current;
      const newWidth = Math.min(800, Math.max(200, startWidthRef.current + dx));
      setSidebarWidth(newWidth);
    };
    const onUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        try {
          localStorage.setItem("adminSidebarWidth", String(sidebarWidth));
        } catch (e) {
          // ignore
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [sidebarWidth]);

  const triggerAdSyncMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/ad-sync/trigger"),
    onSuccess: (data) => {
      // Invalidate status query to force refresh
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ad-sync/status"] });
      // Invalidate locations and related queries so the admin UI updates without reload
      try {
        queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === "/api/locations" });
      } catch (e) {
        // fallback: invalidate common keys
        queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
      }
      // Also refresh floors in case AD sync changed any floor assignments
      queryClient.invalidateQueries({ queryKey: ["/api/floors"] });

      toast({ title: "Синхронизация", description: "Синхронизация с AD запущена успешно" });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Неизвестная ошибка";
      toast({ 
        title: "Ошибка синхронизации", 
        description: `Не удалось запустить синхронизацию: ${errorMessage}`, 
        variant: "destructive" 
      });
    }
  });

  const createLocationMutation = useMutation({
    mutationFn: async (location: InsertLocation) => apiRequest("POST", "/api/admin/locations", location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Success", description: "Location created successfully" });
    setIsAddModalOpen(false);
    setNewLocation({ name: "", type: "meeting-room", status: "available", floor: currentFloor, equipment: "", x: 400, y: 300, width: 80, height: 60, customFields: {} });
    },
    onError: (error: any) => toast({ title: "Error", description: "Failed to create location", variant: "destructive" }),
  });

  // Handler for the "Создать" button in the add-location dialog
  const handleCreateLocation = () => {

    // Если розетка — обязательно указать port
    if (newLocation.type === 'socket') {
      const port = ((newLocation.customFields as Record<string, any>) || {}).port;
      if (!port) { toast({ title: 'Ошибка', description: 'Порт обязателен для розетки', variant: 'destructive' }); return; }
      // используем порт как имя
      const payload: Partial<InsertLocation> = {
        name: String(port),
        type: 'socket',
        status: newLocation.status || 'available',
        floor: newLocation.floor || currentFloor,
        equipment: newLocation.equipment || '',
        x: centerX ?? newLocation.x ?? 400,
        y: centerY ?? newLocation.y ?? 300,
        width: newLocation.width ?? 80,
        height: newLocation.height ?? 60,
        customFields: newLocation.customFields || { port },
      };
      createLocationMutation.mutate(payload as InsertLocation);
      return;
    }

    const payload: Partial<InsertLocation> = {
      name: newLocation.name || '',
      type: (newLocation.type as any) || 'meeting-room',
      status: newLocation.status || 'available',
      floor: newLocation.floor || currentFloor,
      equipment: newLocation.equipment || '',
      x: centerX ?? newLocation.x ?? 400,
      y: centerY ?? newLocation.y ?? 300,
      width: newLocation.width ?? 80,
      height: newLocation.height ?? 60,
      customFields: newLocation.customFields || {},
    };

    createLocationMutation.mutate(payload as InsertLocation);
  };

  // Добавляем мутации для обновления и удаления локации
  const updateLocationMutation = useMutation({
    mutationFn: async (payload: Partial<Location> & { id: string }) => apiRequest('PUT', `/api/admin/locations/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      toast({ title: 'Успех', description: 'Локация обновлена' });
    },
    onError: (err: any) => toast({ title: 'Ошибка', description: err?.message || 'Не удалось обновить локацию', variant: 'destructive' }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/admin/locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      toast({ title: 'Успех', description: 'Локация удалена' });
    },
    onError: (err: any) => toast({ title: 'Ошибка', description: err?.message || 'Не удалось удалить локацию', variant: 'destructive' }),
  });

  const createFloorMutation = useMutation({
    mutationFn: async (floor: InsertFloor) => apiRequest("POST", "/api/admin/floors", floor),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
      toast({ title: "Успех", description: "Этаж добавлен" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось добавить этаж", variant: "destructive" }),
  });

  const deleteFloorMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/floors/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
      toast({ title: "Успех", description: "Этаж удалён" });
    },
    onError: () => toast({ title: "Ошибка", description: "Не удалось удалить этаж", variant: "destructive" }),
  });

  const uploadImageMutation = useMutation({
    mutationFn: async ({ id, imageBase64 }: { id: string; imageBase64: string }): Promise<Floor> => {
      const res = await apiRequest("POST", `/api/admin/floors/${id}/image`, { imageBase64 });
      return (await res.json()) as Floor;
    },
    onSuccess: async (updatedFloor: Floor) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
      toast({ title: "Успех", description: "План этажа обновлён" });
      
      // Force cache-bust the specific image for this floor
      const floorCode = updatedFloor.code;
      const img = document.querySelector(`img[data-floor-code="${floorCode}"]`) as HTMLImageElement | null;
      const svgObj = document.querySelector(`object[data-floor-code="${floorCode}"]`) as HTMLObjectElement | null;
      
      if (img) {
        const src = img.src.split("?")[0];
        img.src = src + "?t=" + Date.now();
      }
      if (svgObj) {
        const src = svgObj.data?.split("?")[0] || svgObj.data;
        if (src) svgObj.data = src + "?t=" + Date.now();
      }
    },
    onError: (error: any) => toast({ title: "Ошибка", description: error?.message || "Не удалось загрузить план", variant: "destructive" }),
  });

  const handlePickImage = async (floor: Floor) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,.svg,.png,.jpg,.jpeg";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      
      if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
        // For SVG, read as text and convert to data URL
        const reader = new FileReader();
        reader.onload = () => {
          const svgText = reader.result as string;
          // Convert SVG text to data URL with proper MIME type
          const dataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
          uploadImageMutation.mutate({ id: floor.id, imageBase64: dataUrl } as any);
        };
        reader.readAsText(file);
      } else {
        // For PNG, JPEG - read as data URL
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          uploadImageMutation.mutate({ id: floor.id, imageBase64: base64 } as any);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.trim().toLowerCase();
    return locations.filter((l) => {
      const name = (l.name || "").toLowerCase();
      const dept = String(((l.customFields as Record<string, any>)?.department || "")).toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [locations, searchQuery]);

  const handleResizerDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  };

  // Handler to create workstation from AD (used by quick-add form submit and button)
  const handleCreateFromAd = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!adLogin) { toast({ title: "Ошибка", description: "Логин AD обязателен", variant: "destructive" }); return; }
    setIsFillingFromAd(true);
    try {
      let respJson: any = {};
      try { const r = await apiRequest("GET", `/api/admin/ldap-user?login=${encodeURIComponent(adLogin)}`); respJson = await r.json(); } catch (e) { respJson = {}; }
      const nameParts: string[] = [];
      if (respJson.cn) nameParts.push(respJson.cn);
      if (respJson.middleName) nameParts.push(respJson.middleName);
      const name = nameParts.length ? nameParts.join(" ") : adLogin;
      const cf: Record<string, any> = {};
      if (respJson.department) cf.department = respJson.department;
      if (respJson.title) cf.position = respJson.title;
      if (respJson.mail) cf.email = respJson.mail;
      if (respJson.extensionAttribute3) cf.telegram = respJson.extensionAttribute3;
      if (respJson.mailNickname) cf.logonCount = respJson.mailNickname;
      setNewLocation((prev: any) => ({ ...prev, name, customFields: { ...((prev && prev.customFields) || {}), ...cf } }));
      const payload: Partial<InsertLocation> = { name, type: 'workstation', status: 'occupied', floor: currentFloor, equipment: '', x: 1, y: 1, width: 80, height: 60, customFields: cf as any };
      const locationResp = await apiRequest('POST', '/api/admin/locations', payload as InsertLocation);
      const location = await locationResp.json();
      try { await apiRequest('POST', `/api/admin/locations/${location.id}/markers`, { key: 'employee', value: adLogin }); } catch (e) { /* ignore marker creation errors */ }
      // Try to fetch avatar from AD and store it for the location
      try {
        const r2 = await apiRequest('POST', `/api/admin/locations/${location.id}/avatar-from-ad?login=${encodeURIComponent(adLogin)}`, {} as any);
        if (r2.status === 201) {
          await queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
          toast({ title: 'Успех', description: 'Аватар сотрудника загружен из AD' });
        } else {
          const j = await r2.json().catch(() => ({}));
          await queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
        }
      } catch (e) {
        await queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      }
      toast({ title: 'Успех', description: 'Рабочее место добавлено' });
      setIsAddModalOpen(false);
      setAdLogin('');
    } catch (err) { toast({ title: 'Ошибка', description: String(err), variant: 'destructive' }); } finally { setIsFillingFromAd(false); }
  };

  // Добавляем мутации для работы с публичными ссылками
  const { data: publicLinks = [] } = useQuery<PublicLink[]>({
    queryKey: ["/api/public-links"],
  });

  const createLinkMutation = useMutation({
    mutationFn: async (link: { title: string; url: string }) => {
      const response = await apiRequest("POST", "/api/admin/public-links", link);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-links"] });
      toast({ title: "Успех", description: "Ссылка добавлена" });
      setNewLink({ title: "", url: "" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error?.message || "Не удалось добавить ссылку", variant: "destructive" });
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; url: string }) => {
      const response = await apiRequest("PUT", `/api/admin/public-links/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-links"] });
      toast({ title: "Успех", description: "Ссылка обновлена" });
      setEditIdx(null);
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error?.message || "Не удалось обновить ссылку", variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/public-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-links"] });
      toast({ title: "Успех", description: "Ссылка удалена" });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error?.message || "Не удалось удалить ссылку", variant: "destructive" });
    },
  });

  const [newLink, setNewLink] = useState<{ title: string; url: string }>({ title: "", url: "" });
  const [editIdx, setEditIdx] = useState<number | null>(null);

  // Функция для вычисления центра окна относительно карты
  function getMapCenterCoords() {
    const img = document.querySelector('[data-testid="office-map-img"]') as HTMLImageElement | null;
    if (!img) return { x: centerX ?? 400, y: centerY ?? 300 };
    const rect = img.getBoundingClientRect();
    const winCenterX = window.innerWidth / 2;
    const winCenterY = window.innerHeight / 2;
    // координаты относительно левого верхнего угла карты
    const x = Math.round(winCenterX - rect.left);
    const y = Math.round(winCenterY - rect.top);
    // clamp в пределах карты
    return {
      x: Math.max(0, Math.min(x, img.width)),
      y: Math.max(0, Math.min(y, img.height)),
    };
  }

  // В обработчике открытия диалога — подставлять координаты (38,0) — 1см слева
  // Координаты в процентах: x: 1, y: 1 — всегда виден в левом верхнем углу
  const handleOpenAddLocation = () => {
    setIsQuickAdd(false);
    setNewLocation((prev) => ({ ...prev, type: "meeting-room", x: 1, y: 1 }));
    setIsAddModalOpen(true);
  };
  const handleOpenAddWorkstation = () => {
    setNewLocation({ name: '', type: 'workstation', status: 'occupied', floor: currentFloor, equipment: '', x: 1, y: 1, width: 80, height: 60, customFields: {} });
    setIsQuickAdd(true);
    setIsAddModalOpen(true);
  };

  return (
    <aside style={{ width: sidebarWidth }} className="bg-card border-r border-border overflow-y-auto relative">
      {/* Draggable resizer on the right edge of the sidebar (larger visible handle) */}
      <div
        className="absolute top-0 bottom-0 right-0 w-8 h-full -mr-4 z-50 flex items-center justify-center"
        onMouseDown={handleResizerDown}
        onTouchStart={(e) => {
          const t = (e as React.TouchEvent).touches[0];
          isDraggingRef.current = true;
          startXRef.current = t.clientX;
          startWidthRef.current = sidebarWidth;
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели"
        style={{ height: '100vh', minHeight: '100%' }}
      >
        {/* Full-height dashed line */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-0.5 border-r-2 border-dashed border-sky-400 opacity-70 pointer-events-none" />
        {/* Visible handle: three vertical bars for better affordance */}
        <div className="flex flex-col items-center justify-center gap-1.5 p-1 rounded-md hover:bg-sky-50 active:bg-sky-100 transition-colors duration-150 cursor-col-resize" style={{ pointerEvents: 'none', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="w-0.5 h-3 rounded bg-sky-600 shadow-sm" />
          <div className="w-0.5 h-3 rounded bg-sky-600 shadow-sm" />
          <div className="w-0.5 h-3 rounded bg-sky-600 shadow-sm" />
        </div>
      </div>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-foreground">Ссылки для публичного режима</h3>
            <Button size="sm" variant="ghost" onClick={() => setLinksCollapsed((v) => !v)} data-testid="toggle-public-links">
              {linksCollapsed ? 'Развернуть' : 'Свернуть'}
            </Button>
          </div>
          {!linksCollapsed && (
          <div className="space-y-2">
            {publicLinks.length === 0 && <div className="text-muted-foreground text-sm">Нет добавленных ссылок</div>}
            {publicLinks.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {editIdx === idx ? (
                  <>
                    <Input value={newLink.title} onChange={(e) => setNewLink((l) => ({ ...l, title: e.target.value }))} placeholder="Название" className="w-32" />
                    <Input value={newLink.url} onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))} placeholder="URL" className="w-40" />
                    <Button size="sm" variant="outline" onClick={() => { updateLinkMutation.mutate({ id: link.id, title: newLink.title, url: newLink.url }); }}>Сохранить</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)}>Отмена</Button>
                  </>
                ) : (
                  <>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline text-sm w-32 truncate">{link.title}</a>
                    <span className="text-muted-foreground text-xs w-40 truncate">{link.url}</span>
                    <Button size="sm" variant="outline" onClick={() => { setEditIdx(idx); setNewLink(link); }}>Редактировать</Button>
                    <Button size="sm" variant="destructive" onClick={() => { deleteLinkMutation.mutate(link.id); }}>Удалить</Button>
                  </>
                )}
              </div>
            ))}
          </div>
          )}
          {!linksCollapsed && (
          <div className="flex items-center gap-2 mt-3">
            <Input value={newLink.title} onChange={(e) => setNewLink((l) => ({ ...l, title: e.target.value }))} placeholder="Название" className="w-32" />
            <Input value={newLink.url} onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))} placeholder="URL" className="w-40" />
            <Button size="sm" variant="default" onClick={() => { 
              if (!newLink.title.trim() || !newLink.url.trim()) {
                toast({ title: "Ошибка", description: "Заполните все поля", variant: "destructive" });
                return;
              }
              createLinkMutation.mutate(newLink);
            }}>Добавить</Button>
          </div>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Управление</h2>
          {!isHr && (
            <div className="mt-3 flex flex-col items-stretch gap-2">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <Label htmlFor="enable-sockets-mode" className="text-sm">Режим розеток</Label>
                <Switch
                  id="enable-sockets-mode"
                  onCheckedChange={(checked) => {
                    // Логика будет добавлена позже
                  }}
                />
              </div>
              
              {/* Информация о синхронизации с AD */}
              <div className="text-xs text-muted-foreground px-2 py-2 bg-muted rounded space-y-2">
                <div className="flex items-center gap-1 font-medium">
                  <span className={`w-2 h-2 rounded-full ${adSyncStatus?.lastSyncSuccess !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>Синхр. AD</span>
                </div>
                
                {adSyncStatus?.lastSyncTime ? (
                  <>
                    <div className="text-xs">
                      {new Date(adSyncStatus.lastSyncTime).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {adSyncStatus?.nextExecution && (
                      <div className="text-xs text-muted-foreground/70">
                        Далее: {new Date(adSyncStatus.nextExecution).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground/70">Синхронизация не выполнялась</div>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7 bg-background border border-border text-foreground"
                  onClick={() => triggerAdSyncMutation.mutate()}
                  disabled={triggerAdSyncMutation.isPending}
                >
                  {triggerAdSyncMutation.isPending ? 'Синхронизация...' : 'Синхронизировать'}
                </Button>
              </div>
              
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-location" onClick={handleOpenAddLocation} className="w-full justify-center">
                    <Plus className="w-4 h-4 mr-1" /> Добавить локацию
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  {isQuickAdd ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Добавить рабочее место</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateFromAd} className="space-y-4">
                        <div>
                          <Label htmlFor="ad-login-quick">Логин AD</Label>
                          <Input id="ad-login-quick" value={adLogin} onChange={(e) => setAdLogin(e.target.value)} placeholder="Введите логин AD" data-testid="input-ad-login-quick" />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>Отмена</Button>
                          <Button type="submit" disabled={isFillingFromAd}>{isFillingFromAd ? 'Создание...' : 'Создать'}</Button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Новая локация</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Если создаём розетку — не запрашиваем название, используем номер порта как имя */}
                        {newLocation.type !== 'socket' ? (
                          <div>
                            <Label htmlFor="new-name">Название</Label>
                            <Input id="new-name" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="Название" data-testid="input-new-location-name" />
                          </div>
                        ) : null}
                        <div>
                          <Label htmlFor="new-floor">Этаж</Label>
                          <Select value={newLocation.floor} onValueChange={(value) => setNewLocation({ ...newLocation, floor: value })}>
                            <SelectTrigger data-testid="select-new-location-floor"><SelectValue /></SelectTrigger>
                            <SelectContent>{floors.map((f) => (<SelectItem key={f.id} value={f.code}>{f.code}{f.name ? ` — ${f.name}` : ''}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="new-type">Тип</Label>
                          <Select value={newLocation.type} onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}>
                            <SelectTrigger data-testid="select-new-location-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="common-area">Общая зона</SelectItem>
                            <SelectItem value="meeting-room">Переговорная</SelectItem>
                            <SelectItem value="equipment">МФУ</SelectItem>
                            <SelectItem value="camera">Камера</SelectItem>
                            <SelectItem value="socket">Розетка</SelectItem>
                            <SelectItem value="ac">Кондиционер</SelectItem>
                          </SelectContent>
                          </Select>
                        </div>
                        {newLocation.type === 'socket' && (
                          <div>
                            <Label htmlFor="new-port">Port</Label>
                            <Input
                              id="new-port"
                              value={String(newLocation.customFields?.port || '')}
                              onChange={(e) => {
                                const value = e.target.value;
                                setNewLocation({ 
                                  ...newLocation, 
                                  customFields: { 
                                    ...(newLocation.customFields || {}), 
                                    port: value 
                                  } as typeof newLocation.customFields
                                });
                              }}
                              placeholder="Номер порта для синхронизации"
                              data-testid="input-new-location-port"
                            />
                          </div>
                        )}
                        <div>
                          <Label htmlFor="new-equipment">Оборудование</Label>
                          <Input id="new-equipment" value={newLocation.equipment || ''} onChange={(e) => setNewLocation({ ...newLocation, equipment: e.target.value })} placeholder="Например: монитор, док-станция" data-testid="input-new-location-equipment" />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} data-testid="button-cancel-add">Отмена</Button>
                          <Button onClick={handleCreateLocation} disabled={createLocationMutation.isPending} data-testid="button-create-location">Создать</Button>
                        </div>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="outline" onClick={handleOpenAddWorkstation} data-testid="button-add-workstation" className="w-full"><Plus className="w-4 h-4 mr-1" />Добавить рабочее место</Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-spaces">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Всего мест</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-600" data-testid="text-available-spaces">{stats.available}</div>
              <div className="text-sm text-muted-foreground">Доступно</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 mb-6">
          {!isHr && (
            <>
              <div className="flex flex-col gap-2 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">Этажи</h3>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      const v = !(localStorage.getItem('adminSidebarFloorsCollapsed') === '1');
                      try { localStorage.setItem('adminSidebarFloorsCollapsed', v ? '1' : '0'); } catch {}
                      setSidebarFloorsCollapsed(v);
                    }} data-testid="toggle-sidebar-floors">
                      {sidebarFloorsCollapsed ? 'Развернуть' : 'Свернуть'}
                    </Button>
                    <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default" data-testid="button-add-floor">
                        <Plus className="w-4 h-4 mr-1" /> Добавить этаж
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Добавить этаж</DialogTitle>
                      </DialogHeader>
                      <AddFloorForm onCreate={createFloorMutation.mutate} isLoading={createFloorMutation.isPending} />
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>
              </div>

              {!sidebarFloorsCollapsed && (
                <div className="space-y-2">
                  <FloorList
                    floors={floors}
                    isHr={isHr}
                    onPickImage={handlePickImage}
                    onDelete={deleteFloorMutation.mutate}
                    onReorder={async (newOrder) => {
                      for (let i = 0; i < newOrder.length; i++) {
                        await apiRequest("PUT", `/api/admin/floors/${newOrder[i]}/order`, { sortOrder: i });
                      }
                      await queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
                      toast({ title: "Порядок этажей обновлён" });
                    }}
                  />
                  {floors.length === 0 && (<Card><CardContent className="p-3 text-sm text-muted-foreground">Нет этажей. Добавьте первый этаж.</CardContent></Card>)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Локации</h3>
          <div className="mb-2">
            <Input placeholder="Поиск по ФИО или названию..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-admin-search" />
          </div>

          {filteredLocations.length === 0 ? (
            <Card><CardContent className="p-4 text-center text-muted-foreground">Локации не найдены по запросу.</CardContent></Card>
          ) : (
            (() => {
              const typeLabels: Record<string, string> = { 'workstation': 'Рабочие места', 'meeting-room': 'Переговорные', 'common-area': 'Общие зоны', 'equipment': 'МФУ', 'camera': 'Камеры', 'socket': 'Розетки', 'ac': 'Кондиционер' };
              const typeOrder = ['workstation', 'meeting-room', 'common-area', 'equipment', 'camera', 'socket'];
              const groups = filteredLocations.reduce<Record<string, typeof filteredLocations>>((acc, loc) => { (acc[loc.type] ||= []).push(loc); return acc; }, {});
              const keys = typeOrder.filter(k => groups[k]?.length).concat(Object.keys(groups).filter(k => !typeOrder.includes(k)));

              // Группируем локации по типу
              return (
                <Accordion 
                  type="multiple" 
                  className="w-full" 
                  value={openAccordionItems}
                  onValueChange={setOpenAccordionItems}
                >
                  {keys.map((key) => (
                    <AccordionItem key={key} value={key}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-2">
                          <span className="text-foreground">{typeLabels[key] || key}</span>
                          <span className="text-xs text-muted-foreground">{groups[key].length}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {groups[key].slice().sort((a, b) => a.name.localeCompare(b.name)).map((location) => (
                            <Card key={location.id} className={`border border-border ${location.id === highlightedLocationId ? 'ring-2 ring-red-300 bg-red-50' : ''}`}>
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="text-muted-foreground cursor-move"><GripVertical className="w-4 h-4" /></div>
                                    <div>
                                      <div className="font-medium text-foreground" data-testid={`text-location-name-${location.id}`}>{location.name}</div>
                                      <div className="text-sm text-muted-foreground capitalize">{location.type.replace("-", " ")}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-2">
                                    <div className="flex items-center">
                                      <span className={`w-3 h-3 rounded-full ${getStatusColor(location, location.type)}`}></span>
                                      {location.type === 'socket' && (() => {
                                        const cf = location.customFields && typeof location.customFields === 'object' ? (location.customFields as Record<string, any>) : {};
                                        const raw = cf['StatusLastSync'] || cf['statuslastsync'] || cf['statusLastSync'] || '';
                                        let d: Date | null = null;
                                        try {
                                          if (raw) {
                                            const tmp = new Date(String(raw));
                                            if (!isNaN(tmp.getTime())) d = tmp;
                                          }
                                        } catch { d = null; }
                                        if (!d) return null;
                                        const txt = d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
                                        return <div className="text-xs text-muted-foreground ml-2" title={txt} data-testid={`text-admin-last-sync-${location.id}`}>{txt}</div>;
                                      })()}
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Button variant="ghost" size="sm" onClick={() => setEditingLocationId(location.id)}><Edit className="w-3 h-3" /></Button>
                                      {onFindLocation && (<Button size="sm" variant="outline" onClick={() => onFindLocation(location.id)} data-testid={`button-find-admin-${location.id}`}>Найти</Button>)}
                                    </div>
                                  </div>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {location.capacity && (<span>Вместимость: {location.capacity}</span>)}
                                  {location.equipment && (<span className="ml-2">• Оборудование: {location.equipment}</span>)}
                                  {location.employee && (<span className="ml-2">• Сотрудник: {location.employee}</span>)}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              );
            })()
          )}
        </div>

        {editingLocation && (
          <LocationModal
            location={editingLocation}
            isAdminMode={true}
            isHr={isHr}
            onClose={() => setEditingLocationId(null)}
            toast={({ title, description, variant }) => { toast({ title, description, variant: variant as "default" | "destructive" | null | undefined }); }}
            updateLocation={(data, onSuccess, onError) => {
              if (!editingLocation) return onError?.();
              updateLocationMutation.mutate({ ...data, id: editingLocation.id }, {
                onSuccess: () => { 
                  queryClient.invalidateQueries({ queryKey: ['/api/locations'] }); 
                  onSuccess?.(); 
                },
                onError: (err: any) => { onError?.(); }
              });
            }}
            deleteLocation={(onSuccess, onError) => {
              if (!editingLocation) return onError?.();
              // Удаляем сразу без подтверждения
              deleteLocationMutation.mutate(editingLocation.id, {
                onSuccess: () => { 
                  setEditingLocationId(null);
                  queryClient.invalidateQueries({ queryKey: ['/api/locations'] }); 
                  onSuccess?.(); 
                },
                onError: (err: any) => { onError?.(); }
              });
            }}
            onFindLocation={onFindLocation}
          />
        )}
      </div>
    </aside>
  );
}
