import React, { createContext, useContext, useMemo, useRef, useCallback } from 'react';
import type { Location } from '@shared/schema';

/**
 * Контекст для кеширования всей информации о локациях
 * Включает: иконки, аватарки, статусы и другие данные
 * 
 * Кеш очищается только при обновлении страницы (F5)
 * Предотвращает множественные запросы при движении мыши или камеры
 */

interface LocationAvatarData {
  mimeType: string;
  data: string;
}

interface LocationDataCache {
  // Кеш аватарок по ID локации
  avatars: Map<string, LocationAvatarData>;
  
  // Кеш основной информации о локациях
  locations: Map<string, Location>;
  
  // Время последнего обновления для каждой локации
  lastUpdated: Map<string, number>;
}

interface LocationsCacheContextType {
  // Получить аватарку из кеша или false если её нет
  getAvatarFromCache: (locationId: string) => LocationAvatarData | false;
  
  // Сохранить аватарку в кеш
  cacheAvatar: (locationId: string, avatar: LocationAvatarData) => void;
  
  // Проверить есть ли аватарка в кеше
  hasAvatarInCache: (locationId: string) => boolean;
  
  // Получить информацию о локации из кеша
  getLocationFromCache: (locationId: string) => Location | null;
  
  // Сохранить информацию о локации в кеш
  cacheLocation: (location: Location) => void;
  
  // Кеш информации о локаций одного этажа
  getFloorLocationsFromCache: (floor: string) => Location[] | null;
  
  // Сохранить информацию о локаций всего этажа
  cacheFloorLocations: (floor: string, locations: Location[]) => void;
  
  // Очистить кеш вручную (если требуется)
  clearCache: () => void;
  
  // Очистить кеш для конкретной локации
  clearLocationCache: (locationId: string) => void;
}

const LocationsCacheContext = createContext<LocationsCacheContextType | undefined>(undefined);

/**
 * LocationsCacheProvider
 * Оборачивает приложение и предоставляет единый кеш для всех локаций
 */
export function LocationsCacheProvider({ children }: { children: React.ReactNode }) {
  // Используем useRef для хранения кеша, чтобы он не очищался при ре-рендерах
  const cacheRef = useRef<LocationDataCache>({
    avatars: new Map(),
    locations: new Map(),
    lastUpdated: new Map(),
  });

  // Дополнительный кеш для информации о локациях целого этажа
  const floorCacheRef = useRef<Map<string, Location[]>>(new Map());

  const getAvatarFromCache = useCallback((locationId: string) => {
    const avatar = cacheRef.current.avatars.get(locationId);
    return avatar || false;
  }, []);

  const cacheAvatar = useCallback((locationId: string, avatar: LocationAvatarData) => {
    cacheRef.current.avatars.set(locationId, avatar);
    cacheRef.current.lastUpdated.set(locationId, Date.now());
  }, []);

  const hasAvatarInCache = useCallback((locationId: string) => {
    return cacheRef.current.avatars.has(locationId);
  }, []);

  const getLocationFromCache = useCallback((locationId: string) => {
    return cacheRef.current.locations.get(locationId) || null;
  }, []);

  const cacheLocation = useCallback((location: Location) => {
    cacheRef.current.locations.set(location.id, location);
    cacheRef.current.lastUpdated.set(location.id, Date.now());
  }, []);

  const getFloorLocationsFromCache = useCallback((floor: string) => {
    const locations = floorCacheRef.current.get(floor);
    return locations || null;
  }, []);

  const cacheFloorLocations = useCallback((floor: string, locations: Location[]) => {
    floorCacheRef.current.set(floor, locations);
    // Также кешируем каждую локацию отдельно
    locations.forEach(location => {
      cacheLocation(location);
    });
  }, [cacheLocation]);

  const clearCache = useCallback(() => {
    cacheRef.current.avatars.clear();
    cacheRef.current.locations.clear();
    cacheRef.current.lastUpdated.clear();
    floorCacheRef.current.clear();
  }, []);

  const clearLocationCache = useCallback((locationId: string) => {
    cacheRef.current.avatars.delete(locationId);
    cacheRef.current.locations.delete(locationId);
    cacheRef.current.lastUpdated.delete(locationId);
  }, []);

  const value = useMemo<LocationsCacheContextType>(
    () => ({
      getAvatarFromCache,
      cacheAvatar,
      hasAvatarInCache,
      getLocationFromCache,
      cacheLocation,
      getFloorLocationsFromCache,
      cacheFloorLocations,
      clearCache,
      clearLocationCache,
    }),
    [
      getAvatarFromCache,
      cacheAvatar,
      hasAvatarInCache,
      getLocationFromCache,
      cacheLocation,
      getFloorLocationsFromCache,
      cacheFloorLocations,
      clearCache,
      clearLocationCache,
    ]
  );

  return (
    <LocationsCacheContext.Provider value={value}>
      {children}
    </LocationsCacheContext.Provider>
  );
}

/**
 * useLocationsCache
 * Хук для получения доступа к кешу локаций
 */
export function useLocationsCache() {
  const context = useContext(LocationsCacheContext);
  if (!context) {
    throw new Error('useLocationsCache must be used within LocationsCacheProvider');
  }
  return context;
}
