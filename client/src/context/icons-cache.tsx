import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useCustomIcons } from '@/hooks/use-custom-icon';

/**
 * IconsCacheContext
 * 
 * Глобальный кэш для иконок с ленивой загрузкой
 * 
 * Оптимизация: Двухэтапная загрузка
 * - Этап 1 (критичные): common-area, meeting-room (загружаются сразу)
 * - Этап 2 (остальные): equipment, camera, ac, workstations (загружаются в фоне)
 * 
 * До оптимизации: 8 useQuery параллельно при старте
 * После оптимизации: 2 useQuery сразу + 6 в фоне (не блокируют UI)
 */

interface IconsCacheContextType {
  commonAreaIcons: Array<{ url: string; name: string }>;
  meetingRoomIcons: Array<{ url: string; name: string }>;
  equipmentIcons: Array<{ url: string; name: string }>;
  cameraIcons: Array<{ url: string; name: string }>;
  acIcons: Array<{ url: string; name: string }>;
  workstationActivIcons: Array<{ url: string; name: string }>;
  workstationNonactivIcons: Array<{ url: string; name: string }>;
  workstationRepairIcons: Array<{ url: string; name: string }>;
  isLoading: boolean;
  isPrimaryLoading: boolean; // Критичные иконки загружаются
  isSecondaryLoading: boolean; // Остальные иконки загружаются в фоне
}

const IconsCacheContext = createContext<IconsCacheContextType | undefined>(undefined);

/**
 * IconsCacheProvider
 * 
 * Двухэтапная загрузка иконок для минимизации startup блокировки:
 * - Этап 1: Критичные типы локаций (common-area, meeting-room)
 * - Этап 2: Остальные типы (в фоне, non-blocking)
 */
export function IconsCacheProvider({ children }: { children: React.ReactNode }) {
  // Этап 1: Загружаем критичные иконки сразу (обычно встречаются чаще)
  const { data: commonAreaIcons = [], isLoading: isLoadingCommonArea } = useCustomIcons("common area");
  const { data: meetingRoomIcons = [], isLoading: isLoadingMeetingRoom } = useCustomIcons("negotiation room");

  // Этап 2: Загружаем остальные иконки в фоне с задержкой (requestIdleCallback)
  const [shouldLoadSecondaryIcons, setShouldLoadSecondaryIcons] = useState(false);

  // Запланируем загрузку вторичных иконок когда браузер свободен
  useEffect(() => {
    // Используем requestIdleCallback для фоновой загрузки
    const scheduleSecondaryLoad = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(
          () => setShouldLoadSecondaryIcons(true),
          { timeout: 5000 } // Timeout 5s - загрузить в любом случае через 5 сек
        );
      } else {
        // Fallback для старых браузеров: загрузить через 500ms
        setTimeout(() => setShouldLoadSecondaryIcons(true), 500);
      }
    };

    scheduleSecondaryLoad();
  }, []);

  // Вторичные иконки загружаются только после того как браузер idle или истекло время
  const { data: equipmentIcons = [], isLoading: isLoadingEquipment } = useCustomIcons(
    "print",
    { enabled: shouldLoadSecondaryIcons }
  );
  const { data: cameraIcons = [], isLoading: isLoadingCamera } = useCustomIcons(
    "Камера",
    { enabled: shouldLoadSecondaryIcons }
  );
  const { data: acIcons = [], isLoading: isLoadingAc } = useCustomIcons(
    "ac",
    { enabled: shouldLoadSecondaryIcons }
  );
  const { data: workstationActivIcons = [], isLoading: isLoadingWorkstationActiv } = useCustomIcons(
    "workstation",
    {
      status: "occupied",
      enabled: shouldLoadSecondaryIcons,
    }
  );
  const { data: workstationNonactivIcons = [], isLoading: isLoadingWorkstationNonactiv } = useCustomIcons(
    "workstation",
    {
      status: "available",
      enabled: shouldLoadSecondaryIcons,
    }
  );
  const { data: workstationRepairIcons = [], isLoading: isLoadingWorkstationRepair } = useCustomIcons(
    "workstation",
    {
      status: "maintenance",
      enabled: shouldLoadSecondaryIcons,
    }
  );



  // Статус загрузки по этапам
  const isPrimaryLoading = isLoadingCommonArea || isLoadingMeetingRoom;
  const isSecondaryLoading = isLoadingEquipment || isLoadingCamera || isLoadingAc || isLoadingWorkstationActiv || isLoadingWorkstationNonactiv || isLoadingWorkstationRepair;
  const isLoading = isPrimaryLoading || isSecondaryLoading;

  const value = useMemo<IconsCacheContextType>(
    () => ({
      commonAreaIcons,
      meetingRoomIcons,
      equipmentIcons,
      cameraIcons,
      acIcons,
      workstationActivIcons,
      workstationNonactivIcons,
      workstationRepairIcons,
      isLoading,
      isPrimaryLoading,
      isSecondaryLoading,
    }),
    [
      commonAreaIcons,
      meetingRoomIcons,
      equipmentIcons,
      cameraIcons,
      acIcons,
      workstationActivIcons,
      workstationNonactivIcons,
      workstationRepairIcons,
      isLoading,
      isPrimaryLoading,
      isSecondaryLoading,
    ]
  );

  return (
    <IconsCacheContext.Provider value={value}>
      {children}
    </IconsCacheContext.Provider>
  );
}

/**
 * useIconsCache
 * Хук для получения кэшированных иконок
 * Использовать вместо множественных useCustomIcons в каждом маркере
 */
export function useIconsCache() {
  const context = useContext(IconsCacheContext);
  if (!context) {
    throw new Error('useIconsCache must be used within IconsCacheProvider');
  }
  return context;
}
