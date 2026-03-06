import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSuppressWsToasts } from "@/lib/suppressWsToasts";

export function useWebSocket(onUpdate?: () => void, isAdmin: boolean = false) {
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const attemptCountRef = useRef(0);
  const maxAttempts = 3; // Limit connection attempts for Windows compatibility
  const [websocketsEnabled, setWebsocketsEnabled] = useState<boolean | null>(null);

  // Keep latest callbacks/values in refs to avoid effect re-runs and stale closures
  const onUpdateRef = useRef(onUpdate);
  const toastRef = useRef(toast);
  const timersRef = useRef<number[]>([]);
  const isUnmountedRef = useRef(false);

  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Check server capabilities on mount
  useEffect(() => {
    fetch('/api/capabilities')
      .then(res => res.json())
      .then(data => {
        setWebsocketsEnabled(Boolean(data?.websockets));
      })
      .catch(() => {
        setWebsocketsEnabled(false);
      });
  }, []);

  useEffect(() => {
    // Don't attempt WebSocket connection if server doesn't support it
    if (websocketsEnabled === false) {
      return;
    }

    // Wait for capabilities check to complete
    if (websocketsEnabled === null) return;

    // Build a list of candidate paths to try — some proxies may strip "/ws" so try root as fallback
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.port;
    // Only include port if it exists and is not empty string and not 'undefined'
    const portPart = port && port.length > 0 && port !== 'undefined' ? `:${port}` : '';
    const host = `${hostname}${portPart}`;
    const search = window.location.search || '';
    const candidates = [
      `${protocol}//${host}/ws${search}`,
      `${protocol}//${host}${search}`,
      `${protocol}//${host}/socket${search}`,
    ];

    const scheduleReconnect = (fn: () => void, delay: number) => {
      if (isUnmountedRef.current) return;
      const id = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter(t => t !== id);
        if (!isUnmountedRef.current) fn();
      }, delay);
      timersRef.current.push(id);
    };

    const connect = () => {
      if (attemptCountRef.current >= maxAttempts) {
        try {
          const tfn = toastRef.current;
          if (tfn && !getSuppressWsToasts()) {
            tfn({ title: 'Real-time updates unavailable', description: 'Could not establish a WebSocket connection. The map will still work, but changes made by admins may not appear in real time.', variant: 'destructive' } as any);
          }
        } catch (e) { /* ignore toast errors */ }
        return;
      }

      if (isUnmountedRef.current) return;

      try {
        const url = candidates[attemptCountRef.current % candidates.length];
        if (!url) throw new Error('Invalid WebSocket candidate');
        if (url.includes('undefined')) {
          attemptCountRef.current++;
          scheduleReconnect(connect, 100);
          return;
        }

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          attemptCountRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            try {
              // Only show notifications in admin panel
              if (isAdmin && !getSuppressWsToasts()) {
                const tfn = toastRef.current;
                switch (data.type) {
                  case "LOCATION_CREATED":
                    tfn?.({ title: "Location Added", description: `${data.location?.name} has been added to the map` } as any);
                    break;
                  case "LOCATION_UPDATED":
                    tfn?.({ title: "Location Updated", description: `${data.location?.name} has been updated` } as any);
                    break;
                  case "LOCATION_DELETED":
                    tfn?.({ title: "Location Removed", description: "A location has been removed from the map" } as any);
                    break;
                  case 'LOCATION_SYNC_STARTED':
                    try {
                      const t = tfn?.({ title: '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f', description: `\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f \u043b\u043e\u043a\u0430\u0446\u0438\u0438 ${data.id}...` } as any);
                      try { (window as any).__syncToasts = (window as any).__syncToasts || {}; (window as any).__syncToasts[data.id] = (t as any)?.id; } catch (e) {}
                    } catch (e) {}
                    break;
                  case 'LOCATION_SYNC_SUMMARY':
                    try {
                      tfn?.({
                        title: 'Синхронизация завершена',
                        description: `Обновлено: ${data.details.updated}\nНе обновлено: ${data.details.failed}\n\nВсего розеток: ${data.details.total}`,
                        duration: 20000  // 20 секунд в миллисекундах
                      } as any);
                    } catch (e) {}
                    break;
                  case 'LOCATION_SYNC_FINISHED':
                    try {
                      const map = (window as any).__syncToasts || {};
                      const toastId = map[data.id];
                      if (toastId) {
                        try { tfn?.({ title: '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430', description: `\u041b\u043e\u043a\u0430\u0446\u0438\u044f ${data.id}` } as any); } catch (e) {}
                        try { delete (window as any).__syncToasts[data.id]; } catch (e) {}
                      } else {
                        try { tfn?.({ title: '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0430\u0446\u0438\u044f', description: `\u041b\u043e\u043a\u0430\u0446\u0438\u044f ${data.id} \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u0430` } as any); } catch (e) {}
                      }
                    } catch (e) {}
                    break;
                }
              }
            } catch (e) { /* ignore toast errors */ }

            try { onUpdateRef.current && onUpdateRef.current(); } catch (e) { /* ignore */ }
          } catch (error) {
            // ignore parse errors
          }
        };

        ws.onerror = (error) => {
          attemptCountRef.current++;
        };

        ws.onclose = () => {
          attemptCountRef.current++;
          if (attemptCountRef.current < maxAttempts && !isUnmountedRef.current) {
            scheduleReconnect(connect, 3000);
          }
        };
      } catch (error) {
        attemptCountRef.current++;
        if (attemptCountRef.current < maxAttempts && !isUnmountedRef.current) {
          scheduleReconnect(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isUnmountedRef.current = true;
      try { timersRef.current.forEach(id => window.clearTimeout(id)); } catch (e) {}
      timersRef.current = [];
      try {
        const ws = wsRef.current;
        if (ws) {
          try { ws.onopen = null; } catch (e) {}
          try { ws.onmessage = null; } catch (e) {}
          try { ws.onerror = null; } catch (e) {}
          try { ws.onclose = null; } catch (e) {}
          try { ws.close(); } catch (e) {}
          wsRef.current = null;
        }
      } catch (e) {}
    };
  }, [websocketsEnabled]);

  return wsRef.current;
}
