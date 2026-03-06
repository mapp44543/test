# ✅ ИСПРАВЛЕНИЕ: Механика зума карты - зум только по мышке

## Что было изменено

Логика зума в `handleWheel` была **переделана с нуля** для исключительного зумирования по позиции мышки.

**Было**: Сложный расчет с учетом `flex center` контейнера - это создавало "прыжки" карты к центру.

**Стало**: Простой, математически правильный алгоритм - зум всегда происходит ровно под мышкой.

---

## Новый алгоритм (упрощенный и правильный)

```typescript
// файл: client/src/components/office-map.tsx (handleWheel)

const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  if (wheelThrottleRef.current !== null) return;
  
  const delta = e.deltaY;
  const container = containerRef.current;
  if (!container) return;

  // Позиция мыши в контейнере
  const containerRect = container.getBoundingClientRect();
  const mouseInContainerX = e.clientX - containerRect.left;
  const mouseInContainerY = e.clientY - containerRect.top;

  // Новый масштаб
  const currentScale = scaleRef.current;
  const newScale = delta > 0
    ? Math.max(0.5, currentScale - 0.1)
    : Math.min(3, currentScale + 0.1);

  // ПРАВИЛЬНЫЙ РАСЧЕТ: зум по позиции мышки
  setPanPosition(prev => {
    // 1. Вычисляем мировую координату точки под мышкой
    //    (как если бы масштаб был 1.0)
    const worldX = (mouseInContainerX - prev.x) / currentScale;
    const worldY = (mouseInContainerY - prev.y) / currentScale;
    
    // 2. После зума эта же мировая точка остается под мышкой
    const newPanX = mouseInContainerX - worldX * newScale;
    const newPanY = mouseInContainerY - worldY * newScale;
    
    return { x: newPanX, y: newPanY };
  });

  setScale(newScale);
  // ... throttle логика
}, []);
```

---

## Математическое объяснение

### Система координат

```
КОНТЕЙНЕР (видимая область)
├─ clientX, clientY (позиция мыши в окне браузера)
├─ containerRect (левый верхний угол контейнера)
└─ mouseInContainerX/Y = clientX/Y - containerRect.left/top
   КАРТА (transform: translate + scale)
   ├─ panPosition.x/y (смещение в пикселях)
   ├─ scale (масштаб: 0.5 - 3.0)
   └─ МИРОВАЯ КООРДИНАТА (координата на карте, как если бы scale=1)
      worldX/Y = (mouseInContainerX/Y - panPosition.x/y) / scale
```

### Зумирование "в точку под мышкой"

**Шаг 1**: Найти мировую координату под мышкой
```
мировая_координата = (позиция_мыши - смещение) / текущий_масштаб
```

**Шаг 2**: Изменить масштаб
```
новый_масштаб = текущий_масштаб ± 0.1
```

**Шаг 3**: Пересчитать смещение так, чтобы та же точка была под мышкой
```
новое_смещение = позиция_мыши - мировая_координата * новый_масштаб
```

### Пример численно

**Начальное состояние:**
- Мышка в контейнере: X=300, Y=200
- Смещение карты: X=50, Y=50
- Масштаб: 1.0

**Вычисляем мировую точку:**
```
worldX = (300 - 50) / 1.0 = 250
```
→ Мышка находится над пиксельм 250 карты

**Пользователь увеличивает масштаб на 0.1:**
```
newScale = 1.0 + 0.1 = 1.1
```

**Находим новое смещение:**
```
newPanX = 300 - 250 * 1.1 = 300 - 275 = 25
```

**Проверка**: Где сейчас мышка на карте?
```
новая_worldX = (300 - 25) / 1.1 = 275 / 1.1 = 250 ✓
```
→ Мышка все еще над пиксельм 250 карты ✓

---

## Почему это работает правильно

1. ✅ **Нет затвердения координат** - расчет полностью основан на позиции мыши
2. ✅ **Flex center больше не вмешивается** - мы игнорируем centerX/centerY в расчете
3. ✅ **Простая математика** - легко отладить и понять
4. ✅ **Стандартное поведение** - как в Google Maps, Figma, Adobe XD

---

## Сравнение: старый vs новый подход

### ❌ Старый подход

```typescript
// Вычисляем центр контейнера
const containerCenterX = container.clientWidth / 2;
const containerCenterY = container.clientHeight / 2;

// Вычисляем левый верхний угол карты с учетом центр
const mapLeftOnScreen = containerCenterX - scaledWidth / 2 + prev.x;
const mapTopOnScreen = containerCenterY - scaledHeight / 2 + prev.y;

// Долгий расчет...
const mouseRelativeToMapX = mouseInContainerX - mapLeftOnScreen;
const worldX = mouseRelativeToMapX / currentScale;
const newMapLeftOnScreen = mouseInContainerX - worldX * newScale;

// Пересчитываем pan с учетом центра
const newPanX = newMapLeftOnScreen - (containerCenterX - (imgSize.width * newScale) / 2);
```
→ **Проблема**: centeredCardboard logic создает нежелательные смещения

### ✅ Новый подход

```typescript
// Прямое вычисление мировой координаты
const worldX = (mouseInContainerX - prev.x) / currentScale;

// Прямое вычисление нового смещения
const newPanX = mouseInContainerX - worldX * newScale;
```
→ **Преимущество**: Чистая, правильная математика

---

## Тестирование

Чтобы проверить, что это работает правильно:

1. Откройте карту на cualлюбой этаж
2. Наведите мышку на конкретную папку/точку на карте
3. Кручите колесико (увеличение и уменьшение)
4. **Ожидается**: та же точка остается под мышкой, карта увеличивается/уменьшается

---

## Файлы, которые были изменены

- [client/src/components/office-map.tsx](client/src/components/office-map.tsx#L169) - переделан `handleWheel` callback (строки 169-224)
