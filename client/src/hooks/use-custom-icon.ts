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

  const query = useQuery({
    queryKey: ["/api/icons", effectiveCategory],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/icons/${encodeURIComponent(effectiveCategory)}`);
        const data = await response.json();
        const icons = (data?.icons || []) as IconFile[];
        return icons;
      } catch (error) {
        return [];
      }
    },
    enabled: options?.enabled ?? true,
    // Keep icons in cache forever - they don't change during session
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return query;
}
