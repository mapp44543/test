import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Hook для предварительной загрузки всех типов иконок при инициализации
 * Это предотвращает мигание дефолтных иконок при первом открытии
 */
export function usePreloadIcons() {
  // Загружаем иконки всех типов в параллель сразу при монтировании
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
    staleTime: Infinity, // Cache forever
    gcTime: Infinity, // Keep in garbage collection forever
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

  // Preload icon images in the browser cache using fetch
  // This ensures the images are cached before components try to load them
  useEffect(() => {
    const preloadImages = async () => {
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

      // Preload all icon images in parallel
      await Promise.all(
        allIcons.map((icon: any) => {
          if (icon.url) {
            return new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
              img.src = icon.url;
            });
          }
          return Promise.resolve();
        })
      );
    };

    // Only preload if we have some icons loaded
    if (
      (commonAreaIcons && commonAreaIcons.length > 0) ||
      (meetingRoomIcons && meetingRoomIcons.length > 0) ||
      (equipmentIcons && equipmentIcons.length > 0) ||
      (cameraIcons && cameraIcons.length > 0) ||
      (acIcons && acIcons.length > 0) ||
      (workstationActivIcons && workstationActivIcons.length > 0) ||
      (workstationNonactivIcons && workstationNonactivIcons.length > 0) ||
      (workstationRepairIcons && workstationRepairIcons.length > 0)
    ) {
      preloadImages().catch(() => {
        // Silently fail, preloading is optional
      });
    }
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
