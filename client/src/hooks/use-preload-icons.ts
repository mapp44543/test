import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Hook для предварительной загрузки всех типов иконок БЕЗ блокировки UI
 * Использует requestIdleCallback для фонового preloading когда браузер свободен
 * Это кэширует иконки но не задерживает app startup
 */
export function usePreloadIcons() {
  // Загружаем иконки всех типов в параллель, но БЕЗ блокировки рендера
  const { data: commonAreaIcons } = useQuery({
    queryKey: ["/api/icons", "common area"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/common%20area");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: meetingRoomIcons } = useQuery({
    queryKey: ["/api/icons", "negotiation room"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/icons/${encodeURIComponent("negotiation room")}`);
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: equipmentIcons } = useQuery({
    queryKey: ["/api/icons", "print"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/print");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: cameraIcons } = useQuery({
    queryKey: ["/api/icons", "Камера"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/icons/${encodeURIComponent("Камера")}`);
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: acIcons } = useQuery({
    queryKey: ["/api/icons", "ac"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/ac");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Load workstation icons for all statuses
  const { data: workstationActivIcons } = useQuery({
    queryKey: ["/api/icons", "user/activ"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/user%2Factiv");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: workstationNonactivIcons } = useQuery({
    queryKey: ["/api/icons", "user/nonactiv"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/user%2Fnonactiv");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const { data: workstationRepairIcons } = useQuery({
    queryKey: ["/api/icons", "user/repair"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/icons/user%2Frepair");
        const data = await response.json();
        return data?.icons || [];
      } catch (error) {
        return [];
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Non-blocking background preloading using requestIdleCallback
  // This runs when browser is idle, NOT blocking the main UI thread
  useEffect(() => {
    const hasIcons =
      (commonAreaIcons && commonAreaIcons.length > 0) ||
      (meetingRoomIcons && meetingRoomIcons.length > 0) ||
      (equipmentIcons && equipmentIcons.length > 0) ||
      (cameraIcons && cameraIcons.length > 0) ||
      (acIcons && acIcons.length > 0) ||
      (workstationActivIcons && workstationActivIcons.length > 0) ||
      (workstationNonactivIcons && workstationNonactivIcons.length > 0) ||
      (workstationRepairIcons && workstationRepairIcons.length > 0);

    if (!hasIcons) return;

    // Use requestIdleCallback if available (modern browsers)
    // Falls back to setTimeout(0) for older browsers
    const schedulePreload = (callback: () => void) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: 10000 });
      } else {
        // Fallback: schedule on next macrotask when browser is likely idle
        setTimeout(callback, 0);
      }
    };

    const preloadImages = () => {
      const allIcons = [
        ...(commonAreaIcons || []),
        ...(meetingRoomIcons || []),
        ...(equipmentIcons || []),
        ...(cameraIcons || []),
        ...(acIcons || []),
        ...(workstationActivIcons || []),
        ...(workstationNonactivIcons || []),
        ...(workstationRepairIcons || []),
      ];

      // Preload images in small batches to avoid overwhelming the browser
      // Split into groups of 5, with small delays between batches
      const batchSize = 5;
      let batchIndex = 0;

      const preloadBatch = () => {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, allIcons.length);
        const batch = allIcons.slice(start, end);

        // Load this batch
        batch.forEach((icon: any) => {
          if (icon.url) {
            const img = new Image();
            img.src = icon.url; // Fire and forget, no callbacks
          }
        });

        batchIndex++;

        // Schedule next batch if there are more images
        if (end < allIcons.length) {
          schedulePreload(preloadBatch);
        }
      };

      // Start the first batch
      schedulePreload(preloadBatch);
    };

    preloadImages();
  }, [
    commonAreaIcons,
    meetingRoomIcons,
    equipmentIcons,
    cameraIcons,
    acIcons,
    workstationActivIcons,
    workstationNonactivIcons,
    workstationRepairIcons,
  ]);
}

