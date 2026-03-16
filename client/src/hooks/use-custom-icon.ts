import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface IconFile {
  name: string;
  url: string;
}

export function useCustomIcons(category: string, options?: { enabled?: boolean; status?: string }) {
  // For workstation type, map the status to the folder names and append to category path
  // Status -> Folder mapping: occupied -> activ, available -> nonactiv, maintenance -> repair
  const statusToFolderMap: Record<string, string> = {
    "occupied": "activ",
    "available": "nonactiv",
    "maintenance": "repair"
  };
  
  const effectiveCategory = category === "workstation" && options?.status 
    ? `user/${statusToFolderMap[options.status] || options.status}` 
    : category;

  return useQuery({
    queryKey: ["/api/icons", effectiveCategory],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/icons/${encodeURIComponent(effectiveCategory)}`);
        const data = await response.json();
        return (data?.icons || []) as IconFile[];
      } catch (error) {
        return [];
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 0, // Don't cache - always fetch fresh data
    gcTime: 0, // Don't keep in garbage collection
  });
}
