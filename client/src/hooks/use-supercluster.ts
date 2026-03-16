import { useMemo } from "react";
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
 * Кластеризует маркеры на основе масштаба камеры
 * Для масштаба < 0.7 группирует близкие маркеры в кластеры
 */
export function useSupercluster(
  locations: Location[],
  scale: number,
  zoomLevel?: number
) {
  // Инициализируем supercluster instance
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 45, // Уменьшили с 60 для лучше различимости маркеров
      maxZoom: 15, // максимальный зум уровень
      minZoom: 0, // минимальный зум уровень
    });

    // Конвертируем локации в GeoJSON формат
    const points: ClusterPoint[] = locations.map((location) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          location.x ?? 0, // longitude (x % от ширины)
          location.y ?? 0, // latitude (y % от высоты)
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

  // Определяем, нужна ли кластеризация на основе масштаба
  const shouldCluster = scale < 0.85; // Увеличили порог с 0.7 для кластеризации при более высоком зуме

  // Получаем кластеры или отдельные маркеры
  const clusteredData = useMemo(() => {
    if (!shouldCluster) {
      // Возвращаем отдельные маркеры
      return locations.map((location) => ({
        type: "marker" as const,
        location,
      }));
    }

    // Вычисляем zoom level на основе scale
    // scale 0.5 = zoom 9, scale 0.1 = zoom 6
    const computedZoom = Math.max(0, Math.min(15, Math.log2(scale * 32)));

    try {
      // Получаем кластеры для всех bounds (весь экран)
      const clusters = supercluster.getClusters(
        [-180, -85, 180, 85], // весь мир в GeoJSON координатах
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
  }, [shouldCluster, locations, supercluster, scale]);

  return {
    clusteredData,
    shouldCluster,
    supercluster,
  };
}
