import React, { useMemo, useRef, useEffect, useCallback, useState } from "react";
import LocationMarker from "./location-marker";
import MarkerCluster from "./marker-cluster";
import { useSupercluster } from "@/hooks/use-supercluster";
import type { Location } from "@shared/schema";

interface VirtualizedMarkerLayerAdvancedProps {
  locations: Location[];
  isAdminMode: boolean;
  highlightedLocationIds: string[];
  foundLocationId: string | null | undefined;
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
  isImageLoaded: boolean;
}

/**
 * VirtualizedMarkerLayerAdvanced (Уровень 2 оптимизация)
 * 
 * Улучшенная виртуализация маркеров без react-window.
 * Использует встроенные React оптимизации и viewport вычисления.
 * 
 * Преимущества относительно базовой VirtualizedMarkerLayer:
 * - Более агрессивная фильтрация видимых маркеров
 * - Добавлен буфер для плавного пан/зума
 * - Лучше работает при частых обновлениях viewport
 * - Меньше memory overhead при 80-150 маркерах
 * 
 * Когда использовать:
 * - 80-150 маркеров в публичном режиме
 * - Нужна поддержка hover и tooltip
 * - Canvas не требуется (производительность хорошая)
 */
export default function VirtualizedMarkerLayerAdvanced({
  locations,
  isAdminMode,
  highlightedLocationIds,
  foundLocationId,
  onClick,
  imgSize,
  imgRef,
  onMarkerMove,
  scale,
  panPosition,
  isImageLoaded,
}: VirtualizedMarkerLayerAdvancedProps) {
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const cachedContainerRef = useRef<HTMLElement | null>(null);

  // Используем кластеризацию для оптимизации при малых масштабах
  const { clusteredData, shouldCluster } = useSupercluster(locations, scale);

  // Кэшируем размер контейнера для избежания повторных DOM запросов
  useEffect(() => {
    const container = document.querySelector('[data-testid="office-map-marker-layer"]')
      ?.parentElement?.parentElement as HTMLElement | null;
    if (container) {
      cachedContainerRef.current = container;
    }
  }, []);

  // Вычисляем видимые маркеры на основе viewport - агрессивнее чем базовая версия
  const visibleItems = useMemo(() => {
    if (!isImageLoaded || clusteredData.length === 0) {
      return [];
    }

    const { width: imgWidth, height: imgHeight } = imgSize;
    if (imgWidth === 0 || imgHeight === 0) {
      return clusteredData;
    }

    // Используем кэшированный контейнер, чтобы избежать повторных DOM запросов
    const container = cachedContainerRef.current;
    if (!container) {
      return clusteredData;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportWidth = containerRect.width;
    const viewportHeight = containerRect.height;

    // Вычисляем видимую область в координатах карты
    const visibleLeft = -panPosition.x / scale;
    const visibleTop = -panPosition.y / scale;
    const visibleRight = visibleLeft + viewportWidth / scale;
    const visibleBottom = visibleTop + viewportHeight / scale;

    // Уровень 2: MORE AGGRESSIVE BUFFER для лучшей производительности
    // При частых обновлениях viewport буфер помогает избежать flickering
    const bufferPercent = 15; // Уменьшили с 25 (от базовой) для лучшей память
    const bufferX = ((visibleRight - visibleLeft) * bufferPercent) / 100;
    const bufferY = ((visibleBottom - visibleTop) * bufferPercent) / 100;

    // Фильтруем видимые маркеры более агрессивно
    const filtered = clusteredData.filter((item: any) => {
      if (item.type === "marker") {
        const markerLeft = imgWidth * ((item.location.x ?? 0) / 100);
        const markerTop = imgHeight * ((item.location.y ?? 0) / 100);
        const markerRadius = 30;

        // Более строгая проверка видимости для Уровня 2
        return (
          markerLeft + markerRadius >= visibleLeft - bufferX &&
          markerLeft - markerRadius <= visibleRight + bufferX &&
          markerTop + markerRadius >= visibleTop - bufferY &&
          markerTop - markerRadius <= visibleBottom + bufferY
        );
      } else {
        // Для кластеров
        const clusterLeft = imgWidth * (item.x / 100);
        const clusterTop = imgHeight * (item.y / 100);
        const clusterRadius = 50;

        return (
          clusterLeft + clusterRadius >= visibleLeft - bufferX &&
          clusterLeft - clusterRadius <= visibleRight + bufferX &&
          clusterTop + clusterRadius >= visibleTop - bufferY &&
          clusterTop - clusterRadius <= visibleBottom + bufferY
        );
      }
    });

    return filtered;
  }, [clusteredData, scale, panPosition, imgSize, isImageLoaded]);

  const handleClusterClick = (clusterId: string) => {
    setExpandedClusterId(expandedClusterId === clusterId ? null : clusterId);
  };

  if (!isImageLoaded || visibleItems.length === 0) {
    return null;
  }

  return (
    <>
      {visibleItems.map((item: any) => {
        if (item.type === "marker") {
          return (
            <LocationMarker
              key={item.location.id}
              location={item.location}
              isAdminMode={isAdminMode}
              isVisible={true}
              isHighlighted={
                highlightedLocationIds.includes(item.location.id) ||
                foundLocationId === item.location.id
              }
              onClick={onClick}
              imgSize={imgSize}
              imgRef={imgRef}
              onMarkerMove={onMarkerMove}
              scale={scale}
              panPosition={panPosition}
            />
          );
        } else {
          // Рендеры кластера
          const clusterSize = Math.min(80, 40 + item.count);
          const markerLeft = imgSize.width * (item.x / 100);
          const markerTop = imgSize.height * (item.y / 100);

          return (
            <MarkerCluster
              key={item.id}
              count={item.count}
              color="bg-blue-500"
              size={clusterSize}
              position={{
                x: markerLeft - clusterSize / 2,
                y: markerTop - clusterSize / 2,
              }}
              isHighlighted={foundLocationId === item.id}
              onClick={() => handleClusterClick(item.id)}
            />
          );
        }
      })}
    </>
  );
}
