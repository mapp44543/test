import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { getOptimizedImageUrl } from "@/lib/image-optimization";
import LocationMarker from "./location-marker";
import VirtualizedMarkerLayer from "./virtualized-marker-layer";
import VirtualizedMarkerLayerAdvanced from "./virtualized-marker-layer-advanced";
import CanvasInteractiveMarkerLayer from "./canvas-interactive-marker-layer";
import LocationModal from "./location-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { X, Plus, Undo2 } from "lucide-react";
import type { Location, InsertLocation, Floor, PublicLink } from "@shared/schema";
import './office-map.css';
import AdminSidebar from "@/components/admin-sidebar";

interface OfficeMapProps {
  locations: Location[];
  isAdminMode: boolean;
  currentFloor: string;
  refetchLocations?: () => void;
  foundLocationId?: string | null;
}

export default function OfficeMap({ locations, isAdminMode, currentFloor, refetchLocations, foundLocationId }: OfficeMapProps) {
  // --- Undo stack для отмены перемещений ---
  const [undoStack, setUndoStack] = useState<Array<{ id: string; prevX: number; prevY: number; prevWidth?: number; prevHeight?: number }>>([]);
  // Local transient highlight (when user clicks Найти) to avoid prop drilling timing issues
  const [highlightedLocationIdsLocal, setHighlightedLocationIdsLocal] = useState<string[]>([]);

  // --- Floor transition state ---
  const [isFloorTransitioning, setIsFloorTransitioning] = useState(false);

  // --- Добавлено: обновление размеров карты при ресайзе окна ---
  const imgRef = useRef<HTMLImageElement | HTMLObjectElement>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [scale, setScale] = useState(0.85);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });
  const [isMarkerDragging, setIsMarkerDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const scaleRef = useRef<number>(0.85);
  const panPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isInitializedRef = useRef<boolean>(false);
  // Wheel batching refs (для накопления событий между RAF кадрами)
  const wheelDeltaRef = useRef<number>(0);
  const wheelPendingRef = useRef<boolean>(false);
  const lastWheelMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const wheelRafIdRef = useRef<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isZooming, setIsZooming] = useState(false);





  const handleUndo = () => {
    if (!isAdminMode || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    // Найти локацию по id
    const loc = locations.find((l: Location) => l.id === last.id);
    if (!loc) return;
    // Откатить позицию
    updateLocationMutation.mutate({
      id: last.id,
      x: last.prevX,
      y: last.prevY,
      width: last.prevWidth ?? loc.width,
      height: last.prevHeight ?? loc.height,
    });
    toast({ title: 'Перемещение отменено', description: loc.name });
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    // Начинаем панорамирование только левой кнопкой и если клик выполнен над картой (или её контейнером),
    // но не над интерактивными элементами UI (кнопки, инпуты и т.д.).
  if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
  // Разрешаем панорамирование, если клик произошёл внутри .map-scalable или прямо по контейнеру .map-container
  const isInsideMap = !!target?.closest('.map-scalable') || !!target?.closest('.map-container');
  // Не начинаем панорамирование, если пользователь кликнул по маркеру (чтобы не перехватывать drag маркера)
  if (target?.closest && target.closest('.location-marker')) return;
  // Если кликнули по элементу UI (кнопки/инпуты) — у них обычно есть интерактивность; пропустим начало панорамирования
  const interactiveTags = ['button', 'input', 'textarea', 'select', 'a', 'label'];
  if (!isInsideMap || interactiveTags.includes(target?.tagName?.toLowerCase() || '')) return;
  // Если в данный момент выполняется drag маркера — не начинаем панорамирование
  if (isMarkerDragging) return;

    setIsPanning(true);
    // Prevent native text selection on mousedown + drag
    try { e.preventDefault(); } catch {}
    setStartPanPos({
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y
    });
    // Prevent text selection while panning the map
    try {
      document.body.classList.add('dragging-marker-no-select');
      document.documentElement.classList.add('dragging-marker-no-select');
    } catch {}
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    
    const newX = e.clientX - startPanPos.x;
    const newY = e.clientY - startPanPos.y;
    
    // Обновляем refs сразу для более точного взаимодействия
    panPositionRef.current = { x: newX, y: newY };
    
    // Используем requestAnimationFrame для синхронизации с refresh rate браузера
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setPanPosition({ x: newX, y: newY });
      rafIdRef.current = null;
    });
  }, [isPanning, startPanPos]);

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsPanning(false);
    setIsInteracting(false);
    // Restore text selection
    try {
      document.body.classList.remove('dragging-marker-no-select');
      document.documentElement.classList.remove('dragging-marker-no-select');
    } catch {}
  }, []);

  // Добавляем обработчики событий мыши
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      // Ensure we don't leave no-select class on unmount
      try {
        document.body.classList.remove('dragging-marker-no-select');
        document.documentElement.classList.remove('dragging-marker-no-select');
      } catch {}
    };
  }, [handleMouseMove, handleMouseUp]);

  // Синхронизируем scaleRef и panPositionRef с состояниями
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panPositionRef.current = panPosition;
  }, [panPosition]);

  // Слушаем глобальные события перетаскивания маркера, чтобы при drag маркера не инициировать панораму
  useEffect(() => {
    const onMarkerDragStart = () => setIsMarkerDragging(true);
    const onMarkerDragEnd = () => setIsMarkerDragging(false);
    window.addEventListener('marker-drag-start', onMarkerDragStart as EventListener);
    window.addEventListener('marker-drag-end', onMarkerDragEnd as EventListener);
    return () => {
      window.removeEventListener('marker-drag-start', onMarkerDragStart as EventListener);
      window.removeEventListener('marker-drag-end', onMarkerDragEnd as EventListener);
    };
  }, []);

  /**
   * Обработчик события батчинга wheel (накопление событий между RAF кадрами)
   * Вместо throttle который теряет события, мы накапливаем все deltaY и обрабатываем в RAF
   */
  const processWheelBatch = useCallback(() => {
    // Если нет накопленных событий, выходим
    if (wheelDeltaRef.current === 0 || !wheelPendingRef.current) {
      wheelRafIdRef.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) {
      wheelPendingRef.current = false;
      wheelDeltaRef.current = 0;
      wheelRafIdRef.current = null;
      return;
    }

    const delta = wheelDeltaRef.current;
    const mouseScreenX = lastWheelMouseRef.current.x;
    const mouseScreenY = lastWheelMouseRef.current.y;

    // Получаем позицию контейнера
    const containerRect = container.getBoundingClientRect();

    // Позиция мыши относительно контейнера
    const mouseInContainerX = mouseScreenX - containerRect.left;
    const mouseInContainerY = mouseScreenY - containerRect.top;

    // Получаем АКТУАЛЬНЫЕ значения из refs
    const currentScale = scaleRef.current;
    const currentPan = panPositionRef.current;

    // Вычисляем новый масштаб (с учетом ВСЕХ накопленных событий)
    let newScale = currentScale;
    const deltaSteps = Math.round(delta / 100); // Нормализуем delta
    for (let i = 0; i < Math.abs(deltaSteps); i++) {
      if (delta > 0) {
        newScale = Math.max(0.5, newScale - 0.1);
      } else {
        newScale = Math.min(3, newScale + 0.1);
      }
    }

    // Вычисляем новую позицию панорамы с учетом зума
    const worldX = (mouseInContainerX - currentPan.x) / currentScale;
    const worldY = (mouseInContainerY - currentPan.y) / currentScale;

    const newPanX = mouseInContainerX - worldX * newScale;
    const newPanY = mouseInContainerY - worldY * newScale;

    // Обновляем refs сразу
    panPositionRef.current = { x: newPanX, y: newPanY };
    scaleRef.current = newScale;

    // Обновляем состояние для перерендера
    setPanPosition({ x: newPanX, y: newPanY });
    setScale(newScale);
    setIsInteracting(true);

    // Сбрасываем батч
    wheelPendingRef.current = false;
    wheelDeltaRef.current = 0;
    wheelRafIdRef.current = null;
  }, []);

  /**
   * Обработчик события колесика мыши (с батчингом событий)
   * Вместо throttle который теряет события, накапливаем их между кадрами
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    // Накапливаем delta (не обрабатываем сразу)
    wheelDeltaRef.current += e.deltaY;
    lastWheelMouseRef.current = { x: e.clientX, y: e.clientY };
    wheelPendingRef.current = true;

    // Если RAF уже запланирован, не запускаем еще один
    if (wheelRafIdRef.current !== null) {
      return;
    }

    // Запланируем обработку в следующем кадре
    wheelRafIdRef.current = requestAnimationFrame(() => {
      processWheelBatch();
    });
  }, [processWheelBatch]);

  // Добавляем обработчик события колесика мыши с passive: false для preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
        // Очищаем батчинг RAF если он запланирован
        if (wheelRafIdRef.current !== null) {
          cancelAnimationFrame(wheelRafIdRef.current);
          wheelRafIdRef.current = null;
        }
        // Сбрасываем батч
        wheelPendingRef.current = false;
        wheelDeltaRef.current = 0;
      };
    }
  }, [handleWheel]);

  // Сбрасываем флаг взаимодействия через 200мс после последнего события
  useEffect(() => {
    if (isInteracting) {
      const timer = setTimeout(() => setIsInteracting(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isInteracting]);

    // --- Добавлено: обновление размеров карты при ресайзе окна ---
    useEffect(() => {
      function handleResize() {
        if (imgRef.current) {
          const width = (imgRef.current as HTMLImageElement).width || imgRef.current.clientWidth;
          const height = (imgRef.current as HTMLImageElement).height || imgRef.current.clientHeight;
          setImgSize({ width, height });
        }
      }
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

  const centerOnLocation = (locationId: string) => {
    // find location in array to get coordinates
    const location = locations.find(l => l.id === locationId);
    if (!location || !containerRef.current) return;

    // Target scale (увеличиваем до 1.75, или оставляем текущий если он больше)
    const targetScale = Math.min(3, Math.max(scale, 1.75));

    // Get container dimensions
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Calculate marker position in image coordinates (in pixels)
    const markerPixelX = imgSize.width * (Number.isFinite(location.x) ? location.x / 100 : 0);
    const markerPixelY = imgSize.height * (Number.isFinite(location.y) ? location.y / 100 : 0);

    // Calculate required pan position to center the marker
    // Formula: after transform translate(panX, panY) scale(scale),
    // a point at (markerPixelX, markerPixelY) should appear at (centerX, centerY)
    // panX + markerPixelX * scale = centerX
    // panX = centerX - markerPixelX * scale
    const newPanX = centerX - markerPixelX * targetScale;
    const newPanY = centerY - markerPixelY * targetScale;

    setScale(targetScale);
    setPanPosition({ x: newPanX, y: newPanY });

    // Подсвечиваем маркер
    setHighlightedLocationIdsLocal(prev => Array.from(new Set([...prev, locationId])));
    setTimeout(() => setHighlightedLocationIdsLocal(prev => prev.filter(id => id !== locationId)), 6000);
  };

  // when parent requests a highlight via prop, center and highlight it
  useEffect(() => {
    if (foundLocationId) {
      centerOnLocation(foundLocationId);
    }
  }, [foundLocationId]);

  // Center map when image loads (only once, during initial load)
  useEffect(() => {
    if (isImageLoaded && containerRef.current && imgSize.width > 0 && imgSize.height > 0 && !isInitializedRef.current) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Use initial scale for centering calculation
      const initialScale = 0.85;
      const scaledWidth = imgSize.width * initialScale;
      const scaledHeight = imgSize.height * initialScale;
      
      // Center horizontally
      const newPanX = (containerWidth - scaledWidth) / 2;
      
      // Center vertically with slight bias to top for better UX
      const verticalCenterOffset = (containerHeight - scaledHeight) / 2;
      const minTopPadding = 20;
      const newPanY = verticalCenterOffset > 0 
        ? Math.max(verticalCenterOffset - 60, minTopPadding)
        : verticalCenterOffset;
      
      setPanPosition({ x: newPanX, y: newPanY });
      panPositionRef.current = { x: newPanX, y: newPanY };
      isInitializedRef.current = true;
    }
  }, [isImageLoaded, imgSize.width, imgSize.height]);
  
  // Поиск локаций теперь вынесен в отдельный компонент
  const { data: floors = [] } = useQuery<Floor[]>({ queryKey: ["/api/floors"] });
  // Показываем только публичные этажи для HR и публичного режима
  const { isHr } = useAdminAuth();

  const visibleFloors = useMemo(() => {
    if (isAdminMode && !isHr) return floors;
    return floors.filter(f => (f.showInPublic ?? true));
  }, [floors, isAdminMode, isHr]);

  // Сортируем этажи по sortOrder
  const sortedFloors = useMemo(() => {
    return [...visibleFloors].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [visibleFloors]);
  const queryClient = useQueryClient();
  const updateLocationMutation = useMutation({
    mutationFn: async (updatedLocation: Partial<Location> & { id: string }) => {
      return apiRequest('PUT', `/api/admin/locations/${updatedLocation.id}`, updatedLocation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
    },
  });
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/admin/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
    },
  });
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [newLocationPos, setNewLocationPos] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationType, setNewLocationType] = useState<string>('meeting-room');
  const [newLocationPort, setNewLocationPort] = useState<string>('');
  const [newLocationCiscoSite, setNewLocationCiscoSite] = useState<string>('5');
  const { toast } = useToast();

  const createLocationMutation = useMutation({
    mutationFn: async (data: InsertLocation) => {
      return apiRequest('POST', '/locations', data);
    },
    onSuccess: () => {
      toast({ title: 'Локация создана!' });
      setNewLocationPos(null);
      setNewLocationName('');
      setNewLocationType('meeting-room');
      setNewLocationPort('');
      queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
    },
    onError: () => {
      toast({ title: 'Ошибка при создании локации', variant: 'destructive' });
    },
  });

        // Отключено создание локации по клику на карте
        function handleMapClick(e: React.MouseEvent<HTMLImageElement, MouseEvent>) {
          // if (!isAdminMode || !imgRef.current) return;
          // const rect = imgRef.current.getBoundingClientRect();
          // const x = e.clientX - rect.left;
          // const y = e.clientY - rect.top;
          // setNewLocationPos({
          //   xPercent: (x / imgRef.current.width) * 100,
          //   yPercent: (y / imgRef.current.height) * 100,
          // });
        }

        function handleLocationClick(location: Location) {
          setSelectedLocation(location);
        }

        function handleCloseModal() {
          setSelectedLocation(null);
        }

        function handleCloseNewLocationModal() {
          setNewLocationPos(null);
          setNewLocationName('');
          setNewLocationType('meeting-room');
          setNewLocationPort('');
          setNewLocationCiscoSite('5');
        }

        function handleCreateLocation() {
          if (!newLocationPos || !newLocationName || !imgRef.current) return;
          // Переводим проценты в абсолютные координаты относительно текущего размера изображения
          const width = (imgRef.current as HTMLImageElement).width || imgRef.current.clientWidth;
          const height = (imgRef.current as HTMLImageElement).height || imgRef.current.clientHeight;
          const x = Math.round((newLocationPos.xPercent / 100) * width);
          const y = Math.round((newLocationPos.yPercent / 100) * height);
          const payload: any = {
            name: newLocationName,
            type: newLocationType,
            floor: currentFloor,
            x,
            y,
            customFields: {},
          };
          if (newLocationType === 'socket') {
            payload.customFields.port = newLocationPort;
            // include selected Cisco site for this new socket
            payload.customFields.ciscoSite = newLocationCiscoSite || '5';
          }
          createLocationMutation.mutate(payload as InsertLocation);
        }

        // Получаем imageUrl для текущего этажа
  const currentFloorObj = visibleFloors.find(f => f.code === currentFloor);
        // Используем оптимизированный URL (WebP если поддерживается)
        const optimizedImageUrl = getOptimizedImageUrl(currentFloorObj?.imageUrl || "");
        const imageUrl = optimizedImageUrl;
        const centerX = Math.round(imgSize.width / 2);
        const centerY = Math.round(imgSize.height / 2);

  // Effect to synchronize image size when floor or URL changes
  useEffect(() => {
    // Reset image loaded flag when changing floors
    setIsImageLoaded(false);
    setIsFloorTransitioning(true);
    isInitializedRef.current = false; // Allow re-initialization on new floor
    // Reset zoom and pan to default when changing floors for smooth transition
    setScale(0.85);
    setPanPosition({ x: 0, y: 0 });

    if (!imgRef.current) return;

    const syncImageSize = () => {
      if (!imgRef.current) return;

      if (currentFloorObj?.mimeType === "image/svg+xml") {
        // For SVG objects, use real rendered dimensions
        const objElement = imgRef.current as HTMLObjectElement;
        const realWidth = objElement.clientWidth;
        const realHeight = objElement.clientHeight;
        if (realWidth && realHeight) {
          setImgSize({ width: realWidth, height: realHeight });
        } else {
          setImgSize({ width: 1000, height: 800 });
        }
      } else {
        // For regular images, use real rendered dimensions
        const imgElement = imgRef.current as HTMLImageElement;
        if (imgElement.complete) {
          const realWidth = imgElement.width;
          const realHeight = imgElement.height;
          if (realWidth && realHeight) {
            setImgSize({ width: realWidth, height: realHeight });
          } else {
            setImgSize({ width: imgElement.naturalWidth || 1000, height: imgElement.naturalHeight || 800 });
          }
        }
      }
    };

    // Sync immediately and after delays to catch any timing issues
    syncImageSize();
    const timer1 = setTimeout(syncImageSize, 150);
    const timer2 = setTimeout(syncImageSize, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [imageUrl, currentFloor, currentFloorObj]);

  // CRITICAL: Re-sync image size when container resizes (e.g., sidebar toggle)
  // This ensures markers remain correctly positioned in both admin and public modes
  useEffect(() => {
    const handleContainerResize = () => {
      if (!imgRef.current) return;

      if (currentFloorObj?.mimeType === "image/svg+xml") {
        const objElement = imgRef.current as HTMLObjectElement;
        const realWidth = objElement.clientWidth;
        const realHeight = objElement.clientHeight;
        if (realWidth && realHeight) {
          setImgSize({ width: realWidth, height: realHeight });
        }
      } else {
        const imgElement = imgRef.current as HTMLImageElement;
        if (imgElement.complete) {
          const realWidth = imgElement.width;
          const realHeight = imgElement.height;
          if (realWidth && realHeight) {
            setImgSize({ width: realWidth, height: realHeight });
          }
        }
      }
    };

    // Use ResizeObserver to detect container size changes
    let resizeObserver: ResizeObserver | null = null;

    if (imgRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleContainerResize);
      resizeObserver.observe(imgRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [currentFloorObj?.mimeType]);

  // --- Получение ссылок из API ---
  const { data: publicLinks = [] } = useQuery<PublicLink[]>({
    queryKey: ["/api/public-links"],
  });

  // --- Колбэк для фиксации перемещения маркера ---
  const handleMarkerMove = (id: string, prevX: number, prevY: number, prevWidth?: number, prevHeight?: number) => {
    setUndoStack(stack => [...stack, { id, prevX, prevY, prevWidth, prevHeight }]);
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      {/* Undo button (только для админ-режима) */}
      {isAdminMode && undoStack.length > 0 && (
        <button
          type="button"
          className="fixed z-50 right-6 top-6 flex items-center gap-2 px-3 py-2 rounded-md bg-white/90 dark:bg-slate-800/90 shadow border border-border hover:bg-blue-50 dark:hover:bg-blue-900 transition"
          onClick={handleUndo}
          title="Отменить последнее перемещение (Ctrl+Z)"
          data-testid="button-undo-move"
        >
          <Undo2 className="w-4 h-4" />
          <span className="text-sm font-medium">Отменить</span>
        </button>
      )}

      {/* Поиск локаций и ресурсы (только для публичного режима) */}
      {!isAdminMode && publicLinks.length > 0 && (
        <div className="absolute left-4 top-4 z-20 flex items-start gap-4">
          <div className="public-links bg-white/80 dark:bg-slate-900/80 rounded-lg px-3 py-2 shadow">
            <span className="text-xs font-semibold text-muted-foreground">Ресурсы:</span>
            {publicLinks.map((link, idx) => (
              <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title}
              </a>
            ))}
          </div>
        </div>
      )}
  <div className="w-full flex justify-center items-center flex-1 map-container" ref={containerRef} onMouseDown={handleMouseDown}>
        <div
          className={`map-scalable ${isFloorTransitioning ? 'floor-transitioning' : 'floor-loaded'}`}
          style={{
            display: 'inline-block',
            transform: `translate3d(${panPosition.x}px, ${panPosition.y}px, 0) scale(${scale})`,
            transition: isInteracting || isZooming ? 'none' : 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: isPanning ? 'grabbing' : 'grab',
            willChange: isInteracting || isZooming ? 'transform' : 'auto'
          }}
          >
          {imageUrl ? (
            currentFloorObj?.mimeType === "image/svg+xml" ? (
              <object
                ref={imgRef as any}
                data={imageUrl}
                type="image/svg+xml"
                draggable="false"
                className="rounded-lg shadow-inner bg-white"
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                onLoad={e => {
                  setIsImageLoaded(false);
                  const target = e.currentTarget as HTMLObjectElement;
                  // For SVG, get real rendered dimensions, not viewBox
                  // Wait a bit for the element to fully render and calculate its dimensions
                  setTimeout(() => {
                    if (imgRef.current) {
                      const objElement = imgRef.current as HTMLObjectElement;
                      const realWidth = objElement.clientWidth;
                      const realHeight = objElement.clientHeight;
                      if (realWidth && realHeight) {
                        setImgSize({ width: realWidth, height: realHeight });
                      } else {
                        // Fallback if clientWidth/Height not available yet
                        setImgSize({ width: 1000, height: 800 });
                      }
                      setIsImageLoaded(true);
                      setIsFloorTransitioning(false);
                    }
                  }, 100);
                }}
                onClick={handleMapClick as any}
                data-testid="office-map-svg"
                data-floor-code={currentFloor}
              />
            ) : (
              <img
                ref={imgRef as any}
                src={imageUrl}
                alt=" "
                draggable="false"
                className="rounded-lg shadow-inner bg-white"
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                onLoad={e => {
                  const target = e.target as HTMLImageElement;
                  // Use real rendered dimensions, not naturalWidth
                  setTimeout(() => {
                    if (imgRef.current) {
                      const realWidth = (imgRef.current as HTMLImageElement).width;
                      const realHeight = (imgRef.current as HTMLImageElement).height;
                      if (realWidth && realHeight) {
                        setImgSize({ width: realWidth, height: realHeight });
                      } else {
                        // Fallback
                        setImgSize({ width: target.naturalWidth, height: target.naturalHeight });
                      }
                      setIsImageLoaded(true);
                      setIsFloorTransitioning(false);
                    }
                  }, 100);
                }}
                onClick={handleMapClick}
                data-testid="office-map-img"
                data-floor-code={currentFloor}
              />
            )
          ) : (
            <div className="w-[400px] h-[300px] flex items-center justify-center bg-slate-100 rounded-lg border border-dashed border-gray-300 text-gray-400">
              Нет плана этажа
            </div>
          )}
          {useMemo(() => (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: imgSize.width,
                height: imgSize.height,
                pointerEvents: 'none',
                opacity: isImageLoaded ? 1 : 0,
                transition: 'opacity 0.2s ease-in',
                willChange: isImageLoaded ? 'auto' : 'opacity'
              }}
              data-testid="office-map-marker-layer"
            >
              {isImageLoaded && (() => {
                // Стратегия выбора рендеринга маркеров:
                // 1. Уровень 1 (0-80): VirtualizedMarkerLayer (DOM)
                // 2. Уровень 2 (80-150): VirtualizedMarkerLayerAdvanced (DOM + react-window)
                // 3. Уровень 3 (150+): CanvasInteractiveMarkerLayer (Canvas)
                // Admin режим: всегда VirtualizedMarkerLayer (нужен DOM для drag-drop)

                const markerCount = locations.length;
                const inAdminMode = isAdminMode;

                // Выбираем оптимальный рендеринг режим
                let renderMode: 'basic' | 'advanced' | 'canvas' = 'basic';

                if (!inAdminMode) {
                  if (markerCount > 150) {
                    renderMode = 'canvas'; // Canvas при 150+ маркерах
                  } else if (markerCount > 80) {
                    renderMode = 'advanced'; // Advanced virtualization при 80-150
                  }
                }

                // Рендерим выбранный компонент
                if (renderMode === 'canvas') {
                  return (
                    <CanvasInteractiveMarkerLayer
                      locations={locations}
                      isAdminMode={isAdminMode}
                      highlightedLocationIds={highlightedLocationIdsLocal}
                      foundLocationId={foundLocationId}
                      imgSize={imgSize}
                      scale={scale}
                      panPosition={panPosition}
                      onMarkerClick={handleLocationClick}
                      isImageLoaded={isImageLoaded}
                      shouldUseCanvas={true}
                    />
                  );
                } else if (renderMode === 'advanced') {
                  return (
                    <VirtualizedMarkerLayerAdvanced
                      locations={locations}
                      isAdminMode={isAdminMode}
                      highlightedLocationIds={highlightedLocationIdsLocal}
                      foundLocationId={foundLocationId}
                      onClick={handleLocationClick}
                      imgSize={imgSize}
                      imgRef={imgRef}
                      onMarkerMove={handleMarkerMove}
                      scale={scale}
                      panPosition={panPosition}
                      isImageLoaded={isImageLoaded}
                    />
                  );
                } else {
                  // Базовый режим (0-80 маркеров или админ режим)
                  return (
                    <VirtualizedMarkerLayer
                      locations={locations}
                      isAdminMode={isAdminMode}
                      highlightedLocationIds={highlightedLocationIdsLocal}
                      foundLocationId={foundLocationId}
                      onClick={handleLocationClick}
                      imgSize={imgSize}
                      imgRef={imgRef}
                      onMarkerMove={handleMarkerMove}
                      scale={scale}
                      panPosition={panPosition}
                      isImageLoaded={isImageLoaded}
                    />
                  );
                }
              })()}
            </div>
            ), [locations, isAdminMode, imgSize, highlightedLocationIdsLocal, foundLocationId, isImageLoaded, scale, panPosition])}
        </div>
      </div>

      {selectedLocation && (
        <LocationModal
          key={selectedLocation.id}
          location={selectedLocation}
          isAdminMode={isAdminMode}
          isHr={isHr}
          toast={({ title, description, variant }) => {
            // Приводим variant к типу, который ожидает useToast
            toast({ title, description, variant: variant as "default" | "destructive" | null | undefined });
          }}
          updateLocation={(data, onSuccess, onError) => {
            updateLocationMutation.mutate(
              { ...data, id: selectedLocation.id },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
                  if (onSuccess) onSuccess();
                },
                onError: () => {
                  if (onError) onError();
                }
              }
            );
          }}
          deleteLocation={(onSuccess, onError) => {
            deleteLocationMutation.mutate(selectedLocation.id, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["/api/locations", currentFloor] });
                if (refetchLocations) refetchLocations();
                setSelectedLocation(null);
                if (onSuccess) onSuccess();
              },
              onError: (error) => {
                toast({ title: 'Ошибка удаления', description: error?.message || String(error), variant: 'destructive' });
                if (onError) onError();
              }
            });
          }}
          onClose={handleCloseModal}
          onFindLocation={centerOnLocation}
        />
      )}

      {/* Quick Create Location Modal */}
      {newLocationPos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Создать локацию</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseNewLocationModal}
                  data-testid="button-close-create-modal"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4">
                {/* Для розетки имя не вводим, используем порт в качестве названия */}
                {newLocationType !== 'socket' ? (
                  <div>
                    <label htmlFor="quick-name" className="text-sm font-medium">Название</label>
                    <Input
                      id="quick-name"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      placeholder="Введите название локации"
                      autoFocus
                      data-testid="input-quick-location-name"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="quick-port" className="text-sm font-medium">Port</label>
                    <Input id="quick-port" value={newLocationPort} onChange={(e) => setNewLocationPort(e.target.value)} placeholder="Номер порта" data-testid="input-quick-port" />
                    <div className="mt-2">
                      <label htmlFor="quick-cisco-site" className="text-sm font-medium">Расположение (Cisco)</label>
                      <Select value={newLocationCiscoSite} onValueChange={setNewLocationCiscoSite}>
                        <SelectTrigger data-testid="select-quick-cisco-site">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">Пятый этаж</SelectItem>
                          <SelectItem value="9">Девятый этаж</SelectItem>
                          <SelectItem value="MSK">Москва</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="quick-type" className="text-sm font-medium">Тип</label>
                  <Select
                    value={newLocationType}
                    onValueChange={setNewLocationType}
                  >
                    <SelectTrigger data-testid="select-quick-location-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting-room">Переговорная</SelectItem>
                      <SelectItem value="workstation">Рабочее место</SelectItem>
                      <SelectItem value="equipment">МФУ</SelectItem>
                      <SelectItem value="camera">Камера</SelectItem>
                      <SelectItem value="socket">Розетка</SelectItem>
                      <SelectItem value="common-area">Общая зона</SelectItem>
                      <SelectItem value="ac">Кондиционер</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground">
                  Позиция: x={newLocationPos.xPercent.toFixed(2)}%, y={newLocationPos.yPercent.toFixed(2)}%
                </div>
                <div className="flex flex-row gap-2 pt-4 justify-end">
                  <Button
                    variant="secondary"
                    onClick={handleCloseNewLocationModal}
                    data-testid="button-cancel-create"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleCreateLocation}
                    disabled={createLocationMutation.isPending || (newLocationType === 'socket' ? !newLocationPort : !newLocationName)}
                    data-testid="button-confirm-create"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
