import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type MapToImageOptions = {
  /** Ширина маркера в px (для смещения центра) */
  markerWidth?: number;
  /** Высота маркера в px (для смещения центра) */
  markerHeight?: number;
};

/**
 * Преобразует координаты события мыши (clientX/Y) в проценты относительно
 * отображаемой ширины/высоты изображения с учётом текущего масштаба.
 *
 * Важно: `img.width` и `img.height` должны быть размерами отображаемого изображения (rendered).
 * Функция использует `getBoundingClientRect()` чтобы учесть трансформации (translate/scale).
 */
export function mapClientToImagePercent(
  clientX: number,
  clientY: number,
  img: HTMLImageElement,
  scale: number,
  opts: MapToImageOptions = {}
): { xPercent: number; yPercent: number } {
  if (!img) return { xPercent: 0, yPercent: 0 };

  const rect = img.getBoundingClientRect();

  // Локальная позиция внутри элемента (в координатах видимой области)
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  // Вычисляем реальный масштаб рендера изображения по ширине (учитывает transform/scale)
  const intrinsicWidth = img.width || img.naturalWidth || rect.width || 1;
  const intrinsicHeight = img.height || img.naturalHeight || rect.height || 1;
  const renderScaleX = rect.width / Math.max(1, intrinsicWidth);
  const renderScaleY = rect.height / Math.max(1, intrinsicHeight);

  // Если передан размер маркера — сдвигаем координату с учётом отрисованного (rendered) размера маркера
  const renderedMarkerWidth = (opts.markerWidth ?? 0) * renderScaleX;
  const renderedMarkerHeight = (opts.markerHeight ?? 0) * renderScaleY;

  const xPx = renderedMarkerWidth ? localX - renderedMarkerWidth / 2 : localX;
  const yPx = renderedMarkerHeight ? localY - renderedMarkerHeight / 2 : localY;

  // Процент относительно видимой (rendered) области изображения
  let xPercent = (xPx / rect.width) * 100;
  let yPercent = (yPx / rect.height) * 100;

  // Клаппинг
  xPercent = Math.min(100, Math.max(0, xPercent));
  yPercent = Math.min(100, Math.max(0, yPercent));

  return { xPercent, yPercent };
}

/**
 * Возвращает эффективный статус локации — учитывая, что для розеток статус хранится
 * внутри customFields (поле Cisco `Status`). Возвращает один из: "available", "occupied", "maintenance".
 */
export function getEffectiveStatus(loc: any): string {
  try {
    if (!loc) return 'maintenance';
    // Для обычных типов используем топ-левел статус
    if (loc.type !== 'socket') return loc.status || 'available';

    const cf = loc.customFields && typeof loc.customFields === 'object' ? loc.customFields : {};
    const raw = String(cf['Status'] || cf['status'] || cf['CiscoStatus'] || cf['ciscoStatus'] || '').trim().toLowerCase();

    if (!raw) return 'maintenance';
    if (raw.includes('notconnect') || raw.includes('not connected') || raw === 'no') return 'occupied';
    if (raw.includes('connect') || raw.includes('connected') || raw === 'up') return 'available';

    // По умолчанию относим в обслуживание
    return 'maintenance';
  } catch {
    return 'maintenance';
  }
}

/**
 * Возвращает строку с относительным временем (ru-RU), например "5 минут назад" или "только что".
 * Возвращает null, если дата некорректна или не передана.
 */
export function formatRelativeTime(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;

  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

  if (Math.abs(diffSec) < 45) return 'только что';
  if (Math.abs(diffMin) < 45) return rtf.format(-diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
  return rtf.format(-diffDay, 'day');
}
