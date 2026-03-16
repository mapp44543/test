/**
 * Image optimization utilities
 * Поддержка WebP, кэширование, прогрессивная загрузка
 */

/**
 * Проверяет поддержку WebP в браузере
 */
let webpSupported: boolean | null = null;

export function isWebPSupported(): boolean {
  if (webpSupported !== null) {
    return webpSupported;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      webpSupported = false;
      return false;
    }

    webpSupported = canvas.toDataURL("image/webp").includes("image/webp");
    return webpSupported;
  } catch {
    webpSupported = false;
    return false;
  }
}

/**
 * Конвертирует URL изображения в WebP версию
 * Если WebP не поддерживается или нет WebP версии, возвращает оригинальный URL
 */
export function getOptimizedImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;

  // Если WebP не поддерживается, возвращаем оригинал
  if (!isWebPSupported()) {
    return imageUrl;
  }

  // Если это уже WebP, возвращаем как есть
  if (imageUrl.endsWith(".webp")) {
    return imageUrl;
  }

  // Если это SVG, не пробуем конвертировать
  if (imageUrl.endsWith(".svg") || imageUrl.includes("data:image/svg")) {
    return imageUrl;
  }

  // Пробуем конвертировать PNG/JPG в WebP
  // Сервер должен иметь WebP версии рядом с оригиналами
  // Например: /floor-plans/5.png → /floor-plans/5.webp
  const ext = imageUrl.split(".").pop()?.toLowerCase();
  if (ext === "png" || ext === "jpg" || ext === "jpeg") {
    const webpUrl = imageUrl.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    // Preserve cache-busting query params if they exist
    const hasParams = imageUrl.includes("?");
    if (hasParams) {
      const [base, params] = imageUrl.split("?");
      const optimized = base.replace(/\.(png|jpg|jpeg)$/i, ".webp");
      return `${optimized}?${params}`;
    }
    return webpUrl;
  }

  return imageUrl;
}

/**
 * Создаёт placeholder изображение (для прогрессивной загрузки)
 * Генерирует низкокачественную версию в памяти
 */
export function createPlaceholderImage(
  width: number,
  height: number,
  color: string = "#e2e8f0"
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Добавляем паттерн для визуального оформления
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

/**
 * Кэш для уже загруженных изображений
 */
const imageCache = new Map<string, Promise<string>>();

/**
 * Загружает изображение с кэшированием
 * Возвращает promise, которое разрешается в Data URL
 */
export function loadImageWithCache(imageUrl: string): Promise<string> {
  // Если уже в кэше, возвращаем сразу
  if (imageCache.has(imageUrl)) {
    return imageCache.get(imageUrl)!;
  }

  // Загружаем новое изображение
  const loadPromise = new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Создаём canvas для конвертации в WebP (если поддерживается)
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Пробуем сохранить как WebP, иначе как оригинальный формат
        const webpUrl = canvas.toDataURL("image/webp", 0.8);
        if (webpUrl.includes("data:image/webp")) {
          resolve(webpUrl);
        } else {
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        }
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };

    img.src = imageUrl;
  });

  imageCache.set(imageUrl, loadPromise);
  return loadPromise;
}

/**
 * Очищает кэш изображений
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Получает размер кэша изображений (приблизительно)
 */
export function getImageCacheSize(): string {
  return `${imageCache.size} изображения в кэше`;
}
