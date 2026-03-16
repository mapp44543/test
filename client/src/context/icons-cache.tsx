import React, { createContext, useContext, useMemo } from 'react';
import { useCustomIcons } from '@/hooks/use-custom-icon';

/**
 * IconsCacheContext
 * 
 * Глобальный кэш для иконок всех типов локаций
 * Загружается один раз при монтировании приложения
 * Предотвращает 600+ запросов при 100 маркерах
 * 
 * До оптимизации: 100 маркеров × 6 типов иконок = 600 запросов
 * После оптимизации: 1 раз × 6 типов = 6 запросов
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
}

const IconsCacheContext = createContext<IconsCacheContextType | undefined>(undefined);

/**
 * IconsCacheProvider
 * Оборачивает приложение и загружает все иконки один раз
 */
export function IconsCacheProvider({ children }: { children: React.ReactNode }) {
  // Загружаем все иконки один раз - всё происходит параллельно
  const { data: commonAreaIcons = [], isLoading: isLoadingCommonArea } = useCustomIcons("common area");
  const { data: meetingRoomIcons = [], isLoading: isLoadingMeetingRoom } = useCustomIcons("negotiation room");
  const { data: equipmentIcons = [], isLoading: isLoadingEquipment } = useCustomIcons("print");
  const { data: cameraIcons = [], isLoading: isLoadingCamera } = useCustomIcons("Камера");
  const { data: acIcons = [], isLoading: isLoadingAc } = useCustomIcons("ac");
  const { data: workstationActivIcons = [], isLoading: isLoadingWorkstationActiv } = useCustomIcons("workstation", {
    status: "occupied",
  });
  const { data: workstationNonactivIcons = [], isLoading: isLoadingWorkstationNonactiv } = useCustomIcons("workstation", {
    status: "available",
  });
  const { data: workstationRepairIcons = [], isLoading: isLoadingWorkstationRepair } = useCustomIcons("workstation", {
    status: "maintenance",
  });

  const isLoading = isLoadingCommonArea || isLoadingMeetingRoom || isLoadingEquipment || isLoadingCamera || isLoadingAc || isLoadingWorkstationActiv || isLoadingWorkstationNonactiv || isLoadingWorkstationRepair;

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
