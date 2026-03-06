import { useEffect, useRef, useState } from "react";
import type { Location } from "@shared/schema";

interface CanvasMarkerRendererProps {
  locations: Location[];
  imgSize: { width: number; height: number };
  scale: number;
  panPosition: { x: number; y: number };
  isImageLoaded: boolean;
  highlightedLocationIds: string[];
  foundLocationId: string | null | undefined;
}

/**
 * CanvasMarkerRenderer
 * Использует Canvas вместо DOM для отрисовки маркеров
 * Это гораздо быстрее при 150+ маркерах
 * 
 * Преимущества:
 * - Единственный canvas вместо 150+ DOM элементов
 * - Скорость отрисовки в 10-100 раз выше
 * - Меньше использования памяти
 * - Нет переливок layout
 */
export default function CanvasMarkerRenderer({
  locations,
  imgSize,
  scale,
  panPosition,
  isImageLoaded,
  highlightedLocationIds,
  foundLocationId,
}: CanvasMarkerRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  // Инициализируем canvas контекст
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    setCtx(context);

    // Устанавливаем размер canvas
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Обработчик ресайза
    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Функция получения цвета статуса. Для розеток смотрим Cisco-статус в customFields.Status
  const getStatusColor = (location: Location): string => {
    try {
      if (location.type === 'socket') {
        const cf = location.customFields && typeof location.customFields === 'object' ? (location.customFields as Record<string, any>) : {};
        const raw = String(cf['Status'] || cf['status'] || cf['CiscoStatus'] || cf['ciscoStatus'] || '').trim().toLowerCase();
        if (!raw) return '#f59e0b'; // yellow-500 -> maintenance
        if (raw.includes('notconnect') || raw.includes('not connected') || raw === 'no' || raw.includes('down') || raw.includes('disabled')) return '#ef4444'; // red-500
        if (raw.includes('connect') || raw.includes('connected') || raw === 'up') return '#10b981'; // emerald-500
        return '#64748b'; // slate-500 unknown
      }

      // Fallback: app-level statuses
      switch ((location.status || '').toLowerCase()) {
        case 'available':
          return '#10b981'; // emerald-500
        case 'occupied':
          return '#3b82f6'; // blue-500
        case 'maintenance':
          return '#6b7280'; // gray-500
        default:
          return '#64748b'; // slate-500
      }
    } catch (e) {
      return '#64748b';
    }
  };

  // Рисование маркеров на canvas
  useEffect(() => {
    if (!ctx || !isImageLoaded || locations.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Применяем трансформацию (масштаб и панорама)
    ctx.save();
    ctx.translate(panPosition.x, panPosition.y);
    ctx.scale(scale, scale);

    // Рисуем каждый маркер
    locations.forEach((location) => {
      const x = (imgSize.width * (location.x ?? 0)) / 100;
      const y = (imgSize.height * (location.y ?? 0)) / 100;

      const isHighlighted =
        highlightedLocationIds.includes(location.id) ||
        foundLocationId === location.id;

      // Размер маркера
      const radius = isHighlighted ? 18 : 15;

      // Цвет
      const fillColor = isHighlighted ? "#dc2626" : getStatusColor(location);

      // Рисуем основной круг
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Рисуем обводку
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Для выделенного маркера рисуем кольцо
      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#fca5a5"; // red-300
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Рисуем текст (номер маркера для socket маркеров)
      if (location.type === "socket" && location.name) {
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";

        const portNumber = location.customFields?.port
          ? (location.customFields.port as string).match(/\/(\d+)$/)?.[1] ||
            location.name.substring(0, 4)
          : location.name.substring(0, 4);

        ctx.fillText(portNumber, x, y);
      }
    });

    ctx.restore();
  }, [ctx, locations, imgSize, scale, panPosition, isImageLoaded, highlightedLocationIds, foundLocationId]);

  if (!isImageLoaded) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 rounded-lg"
      style={{
        pointerEvents: "auto",
        cursor: "default",
      }}
      data-testid="canvas-marker-renderer"
    />
  );
}
