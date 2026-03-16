import { useEffect, useState } from "react";
import type { Location } from "@shared/schema";

interface LocationDetails {
  name: string;
  customFields?: Record<string, any>;
  employee?: string | null;
  equipment?: string | null;
  capacity?: number | null;
}

/**
 * useLazyLocationDetails
 * Загружает подробные данные локации при необходимости (наведение, клик)
 * Это помогает снизить нагрузку на рендер при большом количестве маркеров
 */
export function useLazyLocationDetails(
  location: Location,
  shouldLoad: boolean = false
) {
  const [details, setDetails] = useState<LocationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shouldLoad || details) {
      return; // Уже загружено или не нужно загружать
    }

    setIsLoading(true);

    // Имитируем задержку для демонстрации, в реальности можно добавить API запрос
    const timer = setTimeout(() => {
      setDetails({
        name: location.name,
        customFields: location.customFields,
        employee: location.employee,
        equipment: location.equipment,
        capacity: location.capacity,
      });
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [shouldLoad, location, details]);

  return { details, isLoading };
}
