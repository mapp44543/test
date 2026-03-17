import { useMemo, useRef, useState, useEffect } from "react";
import Supercluster from "supercluster";
import type { Location } from "@shared/schema";

interface ClusterProperties {
  cluster: boolean;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string;
}

interface ClusterPoint {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat] - в нашем случае [% от ширины, % от высоты]
  };
  properties: {
    id: string;
    location: Location;
  };
}

interface ClusterResult {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: ClusterProperties & {
    id?: string;
    location?: Location;
  };
}

/**
 * useSupercluster
 * Кластеризует маркеры на основе масштаба камеры с интеллектуальным debouncing.
 * 
 * Оптимизация:
 * - Zoom операции (>5% изменение scale): debounce 50ms
 * - Pan операции (<5% изменение scale): debounce 100ms
 * 
 * Это уменьшает количество getClusters() вызовов при быстрых pan/zoom событиях.
 */
export function useSupercluster(
  locations: Location[],
  scale: number,
  zoomLevel?: number
) {
  // Инициализируем supercluster instance
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 45,
      maxZoom: 15,
      minZoom: 0,
    });

    const points: ClusterPoint[] = locations.map((location) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          location.x ?? 0,
          location.y ?? 0,
        ],
      },
      properties: {
        id: location.id,
        location,
      },
    }));

    cluster.load(points);
    return cluster;
  }, [locations]);

  // Refs для интеллектуального debouncing
  const prevScaleRef = useRef<number>(scale);
  const debounceTimerRef = useRef<number | null>(null);
  const [debouncedScale, setDebouncedScale] = useState<number>(scale);

  // Detect zoom vs pan и apply different debounce delays
  useEffect(() => {
    const prevScale = prevScaleRef.current;
    const scaleDifference = Math.abs(scale - prevScale);
    const scaleChangePercent = (scaleDifference / prevScale) * 100;

    // Определяем тип операции
    const isZoom = scaleChangePercent > 5; // Zoom: более чем 5% изменение
    const debounceDelay = isZoom ? 50 : 100; // Zoom быстрее, pan может быть мед ленше

    // Очищаем предыдущий таймер
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    // Запланируем обновление с соответствующей задержкой
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedScale(scale);
      prevScaleRef.current = scale;
      debounceTimerRef.current = null;
    }, debounceDelay);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [scale]);

  // Определяем, нужна ли кластеризация на основе масштаба
  const shouldCluster = debouncedScale < 0.85;

  // Получаем кластеры или отдельные маркеры
  const clusteredData = useMemo(() => {
    if (!shouldCluster) {
      return locations.map((location) => ({
        type: "marker" as const,
        location,
      }));
    }

    // Вычисляем zoom level на основе scale
    const computedZoom = Math.max(0, Math.min(15, Math.log2(debouncedScale * 32)));

    try {
      // Получаем кластеры - getClusters это самая дорогая операция
      // Debounce выше уменьшает количество вызовов с 60/сек до 10-20/сек
      const clusters = supercluster.getClusters(
        [-180, -85, 180, 85],
        Math.floor(computedZoom)
      );

      return clusters.map((feature: any) => {
        if (feature.properties.cluster) {
          return {
            type: "cluster" as const,
            id: `cluster-${feature.properties.cluster_id}`,
            count: feature.properties.point_count,
            x: feature.geometry.coordinates[0],
            y: feature.geometry.coordinates[1],
            clusterId: feature.properties.cluster_id,
            zoom: computedZoom,
          };
        }

        return {
          type: "marker" as const,
          location: feature.properties.location!,
        };
      });
    } catch (error) {
      return locations.map((location) => ({
        type: "marker" as const,
        location,
      }));
    }
  }, [shouldCluster, locations, supercluster, debouncedScale]);

  return {
    clusteredData,
    shouldCluster,
    supercluster,
  };
}
