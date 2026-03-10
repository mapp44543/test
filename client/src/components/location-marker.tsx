import { useState, useRef, useEffect, memo, useMemo } from "react";
import React from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { mapClientToImagePercent, formatRelativeTime } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useIconsCache } from "@/context/icons-cache";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { LocationHighlightRing } from "@/components/location-highlight-ring";
import type { Location } from "@shared/schema";

interface LocationMarkerProps {
  location: Location;
  isAdminMode: boolean;
  isVisible?: boolean;
  isHighlighted?: boolean;
  onClick: (location: Location) => void;
  imgSize: { width: number; height: number };
  imgRef: React.RefObject<HTMLImageElement | HTMLObjectElement>;
  onMarkerMove?: (
    id: string,
    prevX: number,
    prevY: number,
    prevWidth?: number,
    prevHeight?: number
  ) => void;
  scale: number;
  panPosition: { x: number; y: number };
}

// 🔹 Иконки
const getLocationIcon = (type: string, customIconUrl?: string, onLoad?: () => void) => {
  const iconSize =
    type === "common-area"
      ? "w-[1.875rem] h-[1.875rem]"
      : type === "meeting-room"
      ? "w-[2.8125rem] h-[2.8125rem]"
      : type === "camera"
      ? "w-7 h-7 mt-[2mm]"
      : type === "ac"
      ? "w-[2.1rem] h-[2.1rem]"
      : type === "equipment"
      ? "w-[2.1rem] h-[2.1rem]"
      : type === "workstation"
      ? "w-[28px] h-[28px]"
      : "w-3 h-3";

  // For common-area, meeting-room, camera, ac, equipment, or workstation - use SVG icons from folders
  if (customIconUrl && (type === "common-area" || type === "meeting-room" || type === "camera" || type === "ac" || type === "equipment" || type === "workstation")) {
    return (
      <img 
        src={customIconUrl} 
        alt="icon" 
        className={`${iconSize} pointer-events-none transition-opacity duration-300`}
        style={{
          opacity: 0,
          display: 'block', // Will be changed to block + opacity: 1 on load
        }}
        onLoad={(e) => {
          // Smooth fade-in when image loads
          e.currentTarget.style.opacity = '1';
          onLoad?.();
        }}
        onError={(e) => {
          // Fallback: don't show anything if SVG fails to load
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // For socket type, show lucide-react icons
  switch (type) {
    case "socket":
      // Socket icons are rendered here - no visual icon, just the colored circle
      return null;
    default:
      return null;
  }
};

// 🔹 Цвета
const getStatusColor = (status: string) => {
  switch (status) {
    case "available":
      return "bg-gradient-to-br from-emerald-500 to-emerald-600";
    case "occupied":
      return "bg-gradient-to-br from-blue-500 to-blue-600";
    case "maintenance":
      return "bg-gradient-to-br from-gray-500 to-gray-600";
    default:
      return "bg-gradient-to-br from-slate-500 to-slate-600";
  }
};

const getCiscoStatusColor = (status: string) => {
  if (!status) return "bg-gray-500";
  const s = String(status).toLowerCase();
  if (s.includes("notconnect") || s.includes("not connected")) return "bg-red-500";
  if (s.includes("connect") || s.includes("connected") || s === "up")
    return "bg-emerald-500";
  if (s === "down" || s === "disabled" || s === "no") return "bg-red-500";
  return "bg-gray-500";
};

// 🔹 Форма
const getShapeClasses = (type: string) => {
  switch (type) {
    case "workstation":
      return "rounded-full";
    case "meeting-room":
    case "equipment":
      return "rounded-md";
    case "ac":
      return "ac-diamond";
    default:
      return "rounded-lg";
  }
};

type ShapeStyle = React.CSSProperties & {
  WebkitMask?: string;
  mask?: string;
};

const encodeSvgToBase64 = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(svg)}`;

const getShapeStyle = (type: string, customIconUrl?: string): ShapeStyle | undefined => {
  // Avoid expensive filters by default; shadows are provided via classes when needed
  const baseStyle: ShapeStyle = {};

  if (type === "common-area") {
    // If there's a custom SVG icon for common-area, don't apply any styling
    if (customIconUrl) {
      return baseStyle;
    }
  }

  if (type === "workstation") {
    // If there's a custom SVG icon for workstation, don't apply any styling
    if (customIconUrl) {
      return baseStyle;
    }
  }

  if (type === "meeting-room") {
    return { ...baseStyle, borderRadius: 8 };
  }

  if (type === "equipment") {
    // If there's a custom SVG icon for equipment, don't apply border radius
    if (customIconUrl) {
      return baseStyle;
    }
    return { ...baseStyle, borderRadius: 8 };
  }

  if (type === "camera") {
    // If there's a custom SVG icon for camera, don't apply triangle shape
    if (customIconUrl) {
      return baseStyle;
    }
    return {
      ...baseStyle,
      clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
    };
  }

  if (type === "ac") {
    // If there's a custom SVG icon for ac, don't apply rotation
    if (customIconUrl) {
      return baseStyle;
    }
    return { ...baseStyle, transform: "rotate(45deg)" };
  }

  if (type === "socket") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'>
        <path d='M50 0 C 74 0 92 18 92 42 C 92 64 78 86 62 106 C 56 114 53 118 50 122 C 47 118 44 114 38 106 C 22 86 8 64 8 42 C 8 18 26 0 50 0 Z' fill='white'/>
      </svg>`;
    const mask = `url("${encodeSvgToBase64(svg)}") center / 100% 100% no-repeat`;
    return { ...baseStyle, mask, WebkitMask: mask };
  }

  return baseStyle;
};

function LocationMarkerComponent({
  location,
  isAdminMode,
  isVisible = true,
  isHighlighted,
  onClick,
  imgSize,
  imgRef,
  onMarkerMove,
  scale,
  panPosition,
}: LocationMarkerProps) {
  const { isHr } = useAdminAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isIconLoaded, setIsIconLoaded] = useState(false);
  const [shadowPosition, setShadowPosition] = useState<{ x: number; y: number } | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Получаем кэшированные иконки вместо множественных запросов на каждый маркер
  const iconsCache = useIconsCache();

  // Ensure we remove any global no-select class if component unmounts unexpectedly
  useEffect(() => {
    return () => {
      try {
        document.body.classList.remove("dragging-marker-no-select");
        document.documentElement.classList.remove("dragging-marker-no-select");
      } catch {}
    };
  }, []);

  // Загружаем аватарку пользователя для рабочего места (только когда видимый маркер рендерится)
  const { data: avatar } = useQuery({
    queryKey: [`/api/locations/${location.id}/avatar`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/locations/${location.id}/avatar`);
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: location.type === "workstation" && !!location.id && !!isVisible,
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: false, // Не пересылаем 404 ошибки
  });
  
  // Get the custom icon URL for common-area, meeting-room, equipment, camera, ac, or workstation
  // Returns undefined while icons are still loading to prevent flickering
  const getCustomIconUrl = () => {
    const cf = location.customFields && typeof location.customFields === "object"
      ? (location.customFields as Record<string, any>)
      : {};
    
    const preferredIcon = cf.customIcon;
    const status = location.status || "available";
    
    if (location.type === "common-area") {
      // Return undefined while loading - prevents showing fallback icons
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/common%20area/${preferredIcon}`;
      }
      if (iconsCache.commonAreaIcons.length > 0) {
        return iconsCache.commonAreaIcons[0].url;
      }
    } else if (location.type === "meeting-room") {
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/negotiation%20room/${preferredIcon}`;
      }
      if (iconsCache.meetingRoomIcons.length > 0) {
        return iconsCache.meetingRoomIcons[0].url;
      }
    } else if (location.type === "equipment") {
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/print/${preferredIcon}`;
      }
      if (iconsCache.equipmentIcons.length > 0) {
        return iconsCache.equipmentIcons[0].url;
      }
    } else if (location.type === "camera") {
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/Камера/${preferredIcon}`;
      }
      if (iconsCache.cameraIcons.length > 0) {
        return iconsCache.cameraIcons[0].url;
      }
    } else if (location.type === "ac") {
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/ac/${preferredIcon}`;
      }
      if (iconsCache.acIcons.length > 0) {
        return iconsCache.acIcons[0].url;
      }
    } else if (location.type === "workstation") {
      if (iconsCache.isLoading) {
        return undefined;
      }
      if (preferredIcon) {
        return `/icons/user/${preferredIcon}`;
      }
      // Выбираем иконку в зависимости от статуса
      const iconsByStatus = {
        occupied: iconsCache.workstationActivIcons,
        available: iconsCache.workstationNonactivIcons,
        maintenance: iconsCache.workstationRepairIcons,
      };
      const icons = iconsByStatus[status as keyof typeof iconsByStatus] || iconsCache.workstationNonactivIcons;
      if (icons.length > 0) {
        return icons[0].url;
      }
    }

    return undefined;
  };

  const customIconUrl = getCustomIconUrl();

  // Reset icon loaded state when the icon URL changes
  useEffect(() => {
    setIsIconLoaded(false);
  }, [customIconUrl]);

  const sizeScale =
    location.type === "common-area"
      ? customIconUrl ? 4.0 : 0
      : location.type === "meeting-room"
      ? 1.25
      : location.type === "socket"
      ? 1.5
      : 1;

  // 🔹 Обновление позиции
  const updateLocationMutation = useMutation({
    mutationFn: async (updatedLocation: Partial<Location>) => {
      const clean = Object.fromEntries(
        Object.entries(updatedLocation).filter(([_, v]) => v !== undefined)
      );
      return apiRequest("PUT", `/api/admin/locations/${updatedLocation.id}`, clean);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
    onError: (error: any) => {
      const description =
        error?.message ||
        error?.response?.data?.message ||
        "Не удалось обновить позицию локации";
      console.error("Ошибка обновления локации:", error);
      toast({ title: "Ошибка", description, variant: "destructive" });
    },
  });

  // 🔹 Drag handlers (converted to mouse events for better Chrome compatibility)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Если это не админ-панель или это HR - позволяем только клик, не drag
    if (!isAdminMode || isHr || e.button !== 0) return;
    
    // Запомним начальную позицию, но не начинаем drag сразу
    e.stopPropagation();
    
    setIsMouseDown(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!isMouseDown) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      
      // Detect if there was significant movement to distinguish drag from click
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const dragThreshold = 5; // pixels
      
      // Если движение превышает порог, начинаем drag
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
        if (!isDragging) {
          setIsDragging(true);
          try {
            window.dispatchEvent(new CustomEvent("marker-drag-start"));
          } catch {}
          
          // Prevent text selection across the page while dragging
          try {
            document.body.classList.add("dragging-marker-no-select");
            document.documentElement.classList.add("dragging-marker-no-select");
          } catch {}
        }
      }
      
      // Когда перемещаем - обновляем позицию тени
      if (isDragging || Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
        const img = imgRef.current;
        if (!img) return;

        const { width = 1, height = 1 } = imgSize;
        const markerWidth = computedWidth;
        const markerHeight = computedHeight;

        // Рассчитываем позицию тени
        const { xPercent, yPercent } = mapClientToImagePercent(
          e.clientX,
          e.clientY,
          img as HTMLImageElement,
          scale,
          { markerWidth, markerHeight }
        );

        // Преобразуем проценты обратно в пиксели для отображения тени
        const shadowX = (xPercent / 100) * width;
        const shadowY = (yPercent / 100) * height;

        setShadowPosition({ x: shadowX, y: shadowY });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsMouseDown(false);
      
      if (!isDragging || !dragStartRef.current) {
        // Это был просто клик, не drag
        dragStartRef.current = null;
        setShadowPosition(null);
        return;
      }
      
      // Это был drag, обновляем позицию
      setIsDragging(false);
      dragStartRef.current = null;
      setShadowPosition(null);
      
      try {
        window.dispatchEvent(new CustomEvent("marker-drag-end"));
      } catch {}

      // Restore text selection
      try {
        document.body.classList.remove("dragging-marker-no-select");
        document.documentElement.classList.remove("dragging-marker-no-select");
      } catch {}

      const img = imgRef.current;
      if (!img) return;

      const { width = 1, height = 1 } = imgSize;

      // Use the actual rendered dimensions (computedWidth/Height) for marker offset calculation
      // This is important for common-area with custom icons where the visual size is 30x30px,
      // not calculated from sizeScale
      const markerWidth = computedWidth;
      const markerHeight = computedHeight;

      // Используем утилиту, которая учитывает getBoundingClientRect() и scale.
      // ВАЖНО: не вычитать panPosition — rect уже отражает transform translate.
      const { xPercent, yPercent } = mapClientToImagePercent(
        e.clientX,
        e.clientY,
        img as HTMLImageElement,
        scale,
        { markerWidth, markerHeight }
      );

      onMarkerMove?.(location.id, location.x, location.y, location.width, location.height);

      updateLocationMutation.mutate({
        id: location.id,
        name: location.name || "Без названия",
        type: location.type || "workstation",
        status: location.status || "available",
        floor: location.floor || "5",
        capacity: location.capacity ?? null,
        equipment: location.equipment ?? null,
        employee: location.employee ?? null,
        inventoryId: location.inventoryId ?? null,
        x: Number.isFinite(xPercent) ? xPercent : 0,
        y: Number.isFinite(yPercent) ? yPercent : 0,
        width: location.width ?? 80,
        height: location.height ?? 60,
        customFields: location.customFields ?? {},
      });
    };

    // Add event listeners to document to handle drag outside marker
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isMouseDown, isDragging, location, imgSize, scale, sizeScale, onMarkerMove, updateLocationMutation, imgRef]);

  // 🔹 Клик
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Если был drag, не открываем детали
    if (isDragging) {
      return;
    }
    
    // Открываем детали локации при клике
    onClick(location);
  };

  // 🔹 Позиция
  const left = imgSize.width * ((Number.isFinite(location.x) ? location.x : 0) / 100);
  const top = imgSize.height * ((Number.isFinite(location.y) ? location.y : 0) / 100);

  // 🔹 Размеры
  const typeDefaults: Record<string, [number, number]> = {
    equipment: [40, 100],
    camera: [24, 20],
    socket: [18, 26],
  };
  const [defW, defH] = typeDefaults[location.type] ?? [80, 60];

  let computedWidth = ((location.width ?? defW) / 3.0) * sizeScale;
  let computedHeight = ((location.height ?? defH) / 3.0) * sizeScale;

  // For workstation or common-area with custom icon, make the clickable area match the icon size
  // workstation icon: 28px x 28px
  // common-area icon: w-[1.875rem] h-[1.875rem] ≈ 30px
  if (location.type === "workstation" && customIconUrl) {
    computedWidth = 28;
    computedHeight = 28;
  } else if (location.type === "common-area" && customIconUrl) {
    computedWidth = 30;
    computedHeight = 30;
  }

  // 🔹 Вычислить, где показывать тултип, чтобы он не обрезался у краёв
  let tooltipSide: 'top' | 'bottom' | 'left' | 'right' = 'top';
  let tooltipAlign: 'start' | 'center' | 'end' = 'center';
  try {
    const imgEl = imgRef.current as HTMLElement | null;
    const imgRect = imgEl?.getBoundingClientRect?.();
    if (imgRect && typeof window !== 'undefined') {
      const markerCenterX = imgRect.left + left + computedWidth / 2;
      const markerTopY = imgRect.top + top;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const horizontalMargin = 200; // px threshold to consider 'near edge'
      const topMargin = 120;

      if (markerCenterX < horizontalMargin) {
        // Marker near left edge — show tooltip to the right
        tooltipSide = 'right';
        tooltipAlign = 'center';
      } else if (markerCenterX > vw - horizontalMargin) {
        // Marker near right edge — show tooltip to the left
        tooltipSide = 'left';
        tooltipAlign = 'center';
      } else if (markerTopY < topMargin) {
        // Marker near top of viewport — show below it
        tooltipSide = 'bottom';
        tooltipAlign = 'center';
      }
    }
  } catch (e) {
    // If anything goes wrong, fall back to defaults
  }

  // 🔹 Цвета и статус
  const cf =
    location.customFields && typeof location.customFields === "object"
      ? (location.customFields as Record<string, any>)
      : {};
  const socketCiscoStatus =
    cf["Status"] ??
    cf["status"] ??
    cf["CiscoStatus"] ??
    cf["ciscoStatus"] ??
    cf["Status "] ??
    "";

  const bgClass = isHighlighted
    ? "bg-transparent"
    : location.type === "socket"
    ? getCiscoStatusColor(socketCiscoStatus)
    : (location.type === "common-area" && customIconUrl) || (location.type === "workstation" && customIconUrl)
    ? "bg-transparent"
    : getStatusColor(location.status);

  const ringClass = "";
  // disable highlight animation and shadows for performance
  const highlightCssClass = "";

  // For workstation or common-area with custom icon, only show the icon without any container styling
  const isCustomIconWithoutContainer = (location.type === "workstation" || location.type === "common-area") && customIconUrl;

  return (
    <>
      {/* Кружок со стрелочкой для выделения */}
      {isHighlighted && (
        <LocationHighlightRing
          left={left}
          top={top}
          width={computedWidth}
          height={computedHeight}
          scale={scale}
        />
      )}
      {/* Тень (призрак) при перемещении */}
      {shadowPosition && isDragging && (
        <div
          className={`
            location-marker-shadow absolute left-0 top-0
            ${isCustomIconWithoutContainer ? "bg-transparent" : bgClass}
            ${isCustomIconWithoutContainer ? "" : getShapeClasses(location.type)}
            flex items-center justify-center text-white text-xs font-medium
          `}
          style={{
            left: `0px`,
            top: `0px`,
            transform: `translate3d(${shadowPosition.x}px, ${shadowPosition.y}px, 0)`,
            width: `${computedWidth}px`,
            height: `${computedHeight}px`,
            opacity: 0.4,
            pointerEvents: "none",
            ...getShapeStyle(location.type, customIconUrl),
          }}
        >
          {location.type === "socket" ? getLocationIcon(location.type, customIconUrl) : customIconUrl ? getLocationIcon(location.type, customIconUrl) : null}
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={markerRef}
            className={`
              location-marker absolute left-0 top-0 transition-transform duration-75 cursor-pointer
              ${isCustomIconWithoutContainer ? "bg-transparent" : bgClass}
              ${isCustomIconWithoutContainer ? "" : getShapeClasses(location.type)}
              ${isCustomIconWithoutContainer ? "" : ringClass}
              ${isDragging ? "opacity-50" : ""}
              ${highlightCssClass}
              flex items-center justify-center text-white text-xs font-medium
            `}
            style={{
              left: `0px`,
              top: `0px`,
              transform: `translate3d(${left}px, ${top}px, 0)`,
              width: `${computedWidth}px`,
              height: `${computedHeight}px`,
              willChange: 'transform',
              ...getShapeStyle(location.type, customIconUrl),
              pointerEvents: isDragging ? "none" : "auto",
              cursor: isDragging ? "grabbing" : "pointer",
              // Hide container until icon is loaded to prevent showing placeholder background
              opacity: customIconUrl && !isIconLoaded ? 0 : 1,
              transition: customIconUrl && !isIconLoaded ? 'opacity 0s' : 'opacity 300ms ease-in-out, transform 75ms linear',
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            data-testid={`location-marker-${location.id}`}
          >
          {isAdminMode && !isHr && (
            <div className="absolute -top-2 -left-2 text-gray-600 cursor-move">
              <GripVertical className="w-3 h-3" />
            </div>
          )}

          <div className="flex flex-col items-center justify-center w-full h-full select-none">
            {location.type === "socket" ? getLocationIcon(location.type, customIconUrl) : customIconUrl ? getLocationIcon(location.type, customIconUrl, () => setIsIconLoaded(true)) : null}
            {location.type === "socket" && (
              <div
                className="mt-0.5 text-[10px] leading-tight font-medium text-center w-full max-w-full px-0.5 overflow-hidden text-ellipsis whitespace-nowrap"
                style={{
                  maxWidth: "100%",
                  maxHeight: "1.2em",
                  lineHeight: "1.1",
                  fontSize:
                    (location.width ?? 0) < 40 || (location.height ?? 0) < 40
                      ? "9px"
                      : "11px",
                }}
                title={location.name}
              >
                {location.customFields?.port
                  ? location.customFields.port.match(/\/(\d+)$/)?.[1] ||
                    location.name
                  : location.name}
              </div>
            )}
          </div>
          </div>
        </TooltipTrigger>
      <TooltipContent side={tooltipSide} align={tooltipAlign} className={"flex items-start gap-2 " + (location.type === 'workstation' ? 'scale-150' : '')}>
        <div className="flex-1">
          {location.type === "workstation" && avatar?.data && (
            <img
              src={`data:${avatar.mimeType};base64,${avatar.data}`}
              alt={location.name}
              className="w-10 h-10 rounded-full object-cover border border-gray-300"
            />
          )}
          <div className="font-semibold">{location.name}</div>
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
            return <div className="text-sm text-muted-foreground mt-1" title={txt}>Последняя синхр.: {txt}</div>;
          })()}
        </div>
      </TooltipContent>
    </Tooltip>
    </>
  );
}

// Оптимизированное сравнение для React.memo
// ВАЖНО: НЕ сравниваем scale и panPosition - они меняются при каждом движении мыши/зуме
// и вызывают перерендер всех маркеров 60+ раз в секунду
// Вместо этого, передаём их через props, но маркер не перерендеривается из-за них
const LocationMarkerMemo = React.memo(LocationMarkerComponent, (prev, next) => {
  // Возвращаем true если пропсы одинаковые (не нужен пересчёт)
  return (
    // Проверяем основные свойства локации
    prev.location.id === next.location.id &&
    prev.location.x === next.location.x &&
    prev.location.y === next.location.y &&
    prev.location.status === next.location.status &&
    prev.location.name === next.location.name &&
    prev.location.type === next.location.type &&
    // Проверяем UI состояние
    prev.isHighlighted === next.isHighlighted &&
    prev.isAdminMode === next.isAdminMode &&
    prev.isVisible === next.isVisible &&
    // Проверяем размеры cambio контейнера (реже меняются)
    prev.imgSize.width === next.imgSize.width &&
    prev.imgSize.height === next.imgSize.height &&
    // ИСКЛЮЧИЛИ: scale и panPosition - они обновляют DOM позицию через CSS transform
    // передача props scale и panPosition не требует перерендера компонента
    // Функции обычно одинаковые
    prev.onClick === next.onClick &&
    prev.onMarkerMove === next.onMarkerMove
  );
});

export default LocationMarkerMemo;
