import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Quadtree, type QuadtreeItem } from '@/utils/quadtree';
import { logHitDetectionMetric } from '@/utils/quadtree-profiler';
import { getGlobalColorsCache } from '@/utils/marker-colors-cache';
import { useIconsCache } from '@/context/icons-cache';
import type { Location } from '@shared/schema';

interface CanvasInteractiveMarkerLayerProps {
  locations: Location[];
  isAdminMode: boolean;
  highlightedLocationIds: string[];
  foundLocationId: string | null | undefined;
  imgSize: { width: number; height: number };
  scale: number;
  panPosition: { x: number; y: number };
  onMarkerClick: (location: Location) => void;
  isImageLoaded: boolean;
  shouldUseCanvas: boolean;
}

interface MarkerBound {
  id: string;
  x: number;
  y: number;
  radius: number;
  location: Location;
}

/**
 * CanvasInteractiveMarkerLayer
 * Рендерит маркеры на Canvas вместо DOM для улучшенной производительности
 * 
 * Преимущества:
 * - 1 canvas элемент вместо 100+ DOM элементов
 * - 10-100x быстрее при 150+ маркерах
 * - Меньше использования памяти
 * - Плавное панорамирование и зум
 * 
 * Недостатки:
 * - Требуется manual hit detection для кликов
 * - Сложнее с долго живущими элементами (tooltip, drag)
 * - Требует Custom обработка событий
 */
export default function CanvasInteractiveMarkerLayer({
  locations,
  isAdminMode,
  highlightedLocationIds,
  foundLocationId,
  imgSize,
  scale,
  panPosition,
  onMarkerClick,
  isImageLoaded,
  shouldUseCanvas,
}: CanvasInteractiveMarkerLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const markerBoundsRef = useRef<Map<string, MarkerBound>>(new Map());
  const quadtreeRef = useRef<Quadtree | null>(null);
  const colorsCacheRef = useRef(getGlobalColorsCache());
  const iconsCache = useIconsCache();

  // Инициализируем canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    setCtx(context);

    // Устанавливаем размер canvas
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      // Для высокого DPI экранов
      if (window.devicePixelRatio > 1) {
        canvas.width *= window.devicePixelRatio;
        canvas.height *= window.devicePixelRatio;
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    }

    // Обработчик ресайза
    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        if (window.devicePixelRatio > 1) {
          canvas.width *= window.devicePixelRatio;
          canvas.height *= window.devicePixelRatio;
          context.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Функция для получения иконки локации
  const getCustomIconUrl = useCallback((location: Location): string | undefined => {
    const cf = location.customFields && typeof location.customFields === 'object'
      ? (location.customFields as Record<string, any>)
      : {};
    
    const preferredIcon = cf.customIcon;
    const status = location.status || 'available';
    
    if (location.type === 'common-area') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/common%20area/${preferredIcon}`;
      if (iconsCache.commonAreaIcons.length > 0) return iconsCache.commonAreaIcons[0].url;
    } else if (location.type === 'meeting-room') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/negotiation%20room/${preferredIcon}`;
      if (iconsCache.meetingRoomIcons.length > 0) return iconsCache.meetingRoomIcons[0].url;
    } else if (location.type === 'equipment') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/print/${preferredIcon}`;
      if (iconsCache.equipmentIcons.length > 0) return iconsCache.equipmentIcons[0].url;
    } else if (location.type === 'camera') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/Камера/${preferredIcon}`;
      if (iconsCache.cameraIcons.length > 0) return iconsCache.cameraIcons[0].url;
    } else if (location.type === 'ac') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/ac/${preferredIcon}`;
      if (iconsCache.acIcons.length > 0) return iconsCache.acIcons[0].url;
    } else if (location.type === 'workstation') {
      if (iconsCache.isLoading) return undefined;
      if (preferredIcon) return `/icons/user/${preferredIcon}`;
      const iconsByStatus = {
        occupied: iconsCache.workstationActivIcons,
        available: iconsCache.workstationNonactivIcons,
        maintenance: iconsCache.workstationRepairIcons,
      };
      const icons = iconsByStatus[status as keyof typeof iconsByStatus] || iconsCache.workstationNonactivIcons;
      if (icons.length > 0) return icons[0].url;
    }
    
    return undefined;
  }, [iconsCache]);

  // Функция для получения размера иконки в зависимости от типа
  const getIconSize = useCallback((type: string): { width: number; height: number } => {
    switch (type) {
      case 'common-area':
        return { width: 30, height: 30 };
      case 'meeting-room':
        return { width: 45, height: 45 };
      case 'camera':
        return { width: 28, height: 28 };
      case 'ac':
        return { width: 34, height: 34 };
      case 'equipment':
        return { width: 34, height: 34 };
      case 'workstation':
        return { width: 28, height: 28 };
      default:
        return { width: 20, height: 20 };
    }
  }, []);

  // Функция для получения цвета статуса маркера (с мемоизацией через кэш)
  const getStatusColor = useCallback((location: Location): string => {
    // Используем кэш для мемоизации цветов - избегаем пересчётов при каждом рендере
    return colorsCacheRef.current.get(location, (loc: Location) => {
      try {
        if (loc.type === 'socket') {
          const cf = loc.customFields && typeof loc.customFields === 'object' 
            ? (loc.customFields as Record<string, any>) 
            : {};
          const raw = String(cf['Status'] || cf['status'] || cf['CiscoStatus'] || cf['ciscoStatus'] || '').trim().toLowerCase();
          if (!raw) return '#f59e0b'; // yellow-500
          if (raw.includes('notconnect') || raw.includes('not connected') || raw === 'no' || raw.includes('down')) return '#ef4444'; // red-500
          if (raw.includes('connect') || raw.includes('connected') || raw === 'up') return '#10b981'; // emerald-500
          return '#64748b'; // slate-500
        }

        switch ((loc.status || '').toLowerCase()) {
          case 'available':
            return '#10b981'; // emerald-500
          case 'occupied':
            return '#3b82f6'; // blue-500
          case 'maintenance':
            return '#6b7280'; // gray-500
          default:
            return '#64748b'; // slate-500
        }
      } catch {
        return '#64748b';
      }
    });
  }, []);

  // Отрисовка маркеров на Canvas
  useEffect(() => {
    if (!ctx || !isImageLoaded || locations.length === 0 || !shouldUseCanvas) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Сохраняем состояние контекста
    ctx.save();

    // Применяем трансформацию (панорама и зум)
    ctx.translate(panPosition.x, panPosition.y);
    ctx.scale(scale, scale);

    // Очищаем bounds карту
    markerBoundsRef.current.clear();

    // Пересоздаём Quadtree для оптимизированного hit detection
    if (imgSize.width > 0 && imgSize.height > 0) {
      quadtreeRef.current = new Quadtree(0, 0, imgSize.width, imgSize.height);
    }

    // Рисуем каждый маркер
    locations.forEach((location) => {
      const x = (imgSize.width * (location.x ?? 0)) / 100;
      const y = (imgSize.height * (location.y ?? 0)) / 100;

      const isHighlighted =
        highlightedLocationIds.includes(location.id) ||
        foundLocationId === location.id;
      
      const isHovered = hoveredMarkerId === location.id;

      // Размер маркера
      let radius = 15;
      if (isHighlighted) radius = 18;
      if (isHovered) radius = 20;

      // Сохраняем bounds для hit detection и добавляем в Quadtree
      const bound: MarkerBound = {
        id: location.id,
        x,
        y,
        radius,
        location,
      };
      markerBoundsRef.current.set(location.id, bound);

      // Добавляем в Quadtree для оптимизированного поиска
      if (quadtreeRef.current) {
        quadtreeRef.current.insert({
          id: location.id,
          x,
          y,
          radius,
        });
      }

      // Цвет
      const fillColor = isHighlighted ? '#dc2626' : getStatusColor(location);

      // Рисуем основной круг
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Рисуем обводку
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Для выделенного маркера рисуем кольцо
      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#fca5a5'; // red-300
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Для наведённого маркера добавляем эффект
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#e0e7ff'; // indigo-100
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Рисуем текст для socket маркеров
      if (location.type === 'socket' && location.name) {
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        const portNumber = location.customFields?.port
          ? (location.customFields.port as string).match(/\/(\d+)$/)?.[1] ||
            location.name.substring(0, 4)
          : location.name.substring(0, 4);

        ctx.fillText(portNumber, x, y);
      }
    });

    ctx.restore();
  }, [ctx, locations, imgSize, scale, panPosition, isImageLoaded, shouldUseCanvas, highlightedLocationIds, foundLocationId, hoveredMarkerId, getStatusColor]);

  // Обработка кликов с оптимизированным hit detection через Quadtree
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !quadtreeRef.current) return;

    const rect = canvas.getBoundingClientRect();
    
    // Учитываем масштаб для высокого DPI
    const dpr = window.devicePixelRatio || 1;
    const clientX = (e.clientX - rect.left) * dpr;
    const clientY = (e.clientY - rect.top) * dpr;

    // Конвертируем экранные координаты в координаты карты
    const mapX = (clientX - panPosition.x * dpr) / (scale * dpr);
    const mapY = (clientY - panPosition.y * dpr) / (scale * dpr);

    // Используем Quadtree для быстрого поиска кандидатов (O(log n) вместо O(n))
    const startTime = performance.now();
    const candidates = quadtreeRef.current.query(mapX, mapY, 20);

    // Проверяем только кандидатов
    let foundMarker: Location | null = null;
    for (const candidateId of candidates) {
      const bound = markerBoundsRef.current.get(candidateId);
      if (!bound) continue;

      const distance = Math.sqrt((mapX - bound.x) ** 2 + (mapY - bound.y) ** 2);

      if (distance < bound.radius + 5) {
        foundMarker = bound.location;
        break;
      }
    }

    // Логируем метрику для профилирования
    const endTime = performance.now();
    logHitDetectionMetric(
      candidates.length,
      foundMarker !== null,
      foundMarker?.id,
      endTime - startTime
    );

    if (foundMarker) {
      onMarkerClick(foundMarker);
    }
  }, [panPosition, scale, onMarkerClick]);

  // Обработка movement для hover effect с оптимизированным поиском через Quadtree
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !quadtreeRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = (e.clientX - rect.left) * dpr;
    const clientY = (e.clientY - rect.top) * dpr;

    const mapX = (clientX - panPosition.x * dpr) / (scale * dpr);
    const mapY = (clientY - panPosition.y * dpr) / (scale * dpr);

    // Используем Quadtree для быстрого поиска под мышкой (O(log n))
    const candidates = quadtreeRef.current.query(mapX, mapY, 25);

    // Проверяем только кандидатов
    let foundMarkerId: string | null = null;

    for (const candidateId of candidates) {
      const bound = markerBoundsRef.current.get(candidateId);
      if (!bound) continue;

      const distance = Math.sqrt((mapX - bound.x) ** 2 + (mapY - bound.y) ** 2);
      if (distance < bound.radius + 10) {
        foundMarkerId = bound.id;
        break;
      }
    }

    setHoveredMarkerId(foundMarkerId);

    // Менять курсор
    if (canvas) {
      canvas.style.cursor = foundMarkerId ? 'pointer' : 'default';
    }
  }, [panPosition, scale]);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredMarkerId(null);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }, []);

  if (!isImageLoaded || !shouldUseCanvas) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
      }}
      data-testid="canvas-interactive-marker-layer"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'default',
          display: isImageLoaded ? 'block' : 'none',
        }}
        data-testid="canvas-interactive"
      />
      
      {/* DOM слой с иконками для всех типов локаций */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {locations.map((location) => {
          const iconUrl = getCustomIconUrl(location);
          if (!iconUrl) return null;

          const iconSize = getIconSize(location.type);
          const x = (imgSize.width * (location.x ?? 0)) / 100;
          const y = (imgSize.height * (location.y ?? 0)) / 100;

          const isHighlighted =
            highlightedLocationIds.includes(location.id) ||
            foundLocationId === location.id;

          return (
            <img
              key={location.id}
              src={iconUrl}
              alt={location.name}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                transform: `translate(-50%, -50%)`,
                width: `${iconSize.width}px`,
                height: `${iconSize.height}px`,
                pointerEvents: 'none',
                opacity: isHighlighted ? 1 : 0.9,
                filter: isHighlighted ? 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.6))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                transition: 'opacity 200ms, filter 200ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
