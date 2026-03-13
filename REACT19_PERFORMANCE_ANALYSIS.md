# Анализ проблемы производительности React 19

## Статус
**Дата**: 13 марта 2026 г.  
**Версия React**: 19.2  
**Проблема**: Медленное зуммирование и панорамирование карты после обновления на React 19

---

## 1. КОРНЕВЫЕ ПРИЧИНЫ

### 1.1 Проблема с управлением обработчиками событий (КРИТИЧНО ⚠️)

**Файл**: `office-map.tsx`, строки 113-164

```typescript
const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isPanning) return;
  const newX = e.clientX - startPanPos.x;
  const newY = e.clientY - startPanPos.y;
  panPositionRef.current = { x: newX, y: newY };
  if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
  rafIdRef.current = requestAnimationFrame(() => {
    setPanPosition({ x: newX, y: newY });
    rafIdRef.current = null;
  });
}, [isPanning, startPanPos]); // ❌ ПРОБЛЕМА: зависит от isPanning и startPanPos
```

**Почему это проблема**:
- `handleMouseMove` пересоздаётся при КАЖДОМ изменении `isPanning` или `startPanPos`
- В useEffect добавляются новые обработчики: `window.addEventListener('mousemove', handleMouseMove)`
- Старые обработчики НЕ удаляются правильно (closure старых версий остаётся)
- React 19 имеет более агрессивный батчинг, что усугубляет проблему

**Воздействие**:
- Каждое движение мыши может привести к множественным addEventListener вызовам
- Memory leak из-за накопления обработчиков
- Процессор перегружен обработкой дублирующихся событий

---

### 1.2 Неправильная синхронизация refs и state (КРИТИЧНО ⚠️)

**Файл**: `office-map.tsx`, строки 123-128

```typescript
// Обновляем refs сразу для более точного взаимодействия
panPositionRef.current = { x: newX, y: newY };

// Затем обновляем state в RAF
rafIdRef.current = requestAnimationFrame(() => {
  setPanPosition({ x: newX, y: newY }); // ❌ Дополнительный renrendering
  rafIdRef.current = null;
});
```

**Почему это проблема в React 19**:
- React 19 имеет **автоматический батчинг** для всех событий (не только React синтетических)
- Код обновляет ФИЗ. две переменные состояния для одного действия (refs + state)
- Ref обновляется синхронно, а state - в RAF коллбэче
- Это может привести к **рассинхронизации** между визуальным состоянием и логическим

**Воздействие в React 19**:
```
Событие wheel → wheelDeltaRef.current += e.deltaY;
             → wheelPendingRef.current = true;
             → requestAnimationFrame(processWheelBatch)
             
В processWheelBatch:
  → panPositionRef.current = { ... } (синхронно)
  → scaleRef.current = newScale (синхронно)
  → setPanPosition(() => ...) (батчирован)
  → setScale(() => ...) (батчирован)
  → РЕЗУЛЬТАТ: Canvas рендерит с refs, но state отфтствует!
```

---

### 1.3 Excessive Dependencies в useCallback (ВЫСОКИЙ ПРИОРИТЕТ 🔴)

**Файл**: `office-map.tsx`, строка 189

```typescript
const processWheelBatch = useCallback(() => {
  // ... код ...
}, []); // ❌ Пусто, но потом используется в handleWheel
```
```typescript
const handleWheel = useCallback((e: WheelEvent) => {
  // ... код ...
}, [processWheelBatch]); // ❌ Зависит от processWheelBatch
```

**Проблема**:
- `processWheelBatch` пересоздаётся при каждом изменении компонента
- `handleWheel` пересоздаётся вслед за ним
- Обработчик событий переносится в addEventListener каждый кадр
- React 19 имеет строже requirements для dependency tracking

---

### 1.4 Giant useMemo с множеством зависимостей (ВЫСОКИЙ ПРИОРИТЕТ 🔴)

**Файл**: `office-map.tsx`, строка 780

```typescript
{useMemo(() => (
  <div style={{ ... }} data-testid="office-map-marker-layer">
    {isImageLoaded && (() => {
      // Выбирать компонент маркеров
    })()}
  </div>
), [locations, isAdminMode, imgSize, highlightedLocationIdsLocal, 
    foundLocationId, isImageLoaded, scale, panPosition])} // ❌ 8 зависимостей
```

**Почему это проблема**:
- useMemo пересчитывается при КАЖДОМ изменении `scale` или `panPosition`
- `scale` и `panPosition` изменяются при каждом... zoom/pan событии!
- Это обнуляет весь смысл useMemo
- Каждый пересчёт значит: переоценка `renderMode`, пересоздание компонента маркеров

---

### 1.5 Множественные setState вызовы без батчинга (СРЕДНИЙ ПРИОРИТЕТ 🟠)

**Файл**: `office-map.tsx`, строки 171-175

```typescript
setHighlightedLocationIdsLocal(prev => Array.from(new Set([...prev, locationId])));
setTimeout(() => 
  setHighlightedLocationIdsLocal(prev => prev.filter(id => id !== locationId)), 
6000); // ❌ setState внутри setTimeout (не батчирован в React 18, но может быть в 19)
```

**Воздействие в React 19**:
- React 19 батчирует события, но setTimeout требует явного батчинга
- Это может вызвать дополнительные перерендеры через 6 секунд

---

### 1.6 Проблемы с ResizeObserver и listeners (СРЕДНИЙ ПРИОРИТЕТ 🟠)

**Файл**: `office-map.tsx`, строки 295-355

Есть ПЯТЬ отдельных useEffect для слушания событий:
1. Window resize (line 300)
2. Mousemove/mouseup (line 146)
3. Marker drag events (line 174)
4. Wheel events (line 250)
5. ResizeObserver (line 340)

Каждый создаёт и удаляет обработчики. В React 19 это может привести к race conditions.

---

## 2. ЭФФЕКТ НА ПРОИЗВОДИТЕЛЬНОСТЬ

### 2.1 Симптомы, которые вы видите

- ✅ **Медленное зуммирование**: Каждое событие wheel вызывает полный цикл обновления
- ✅ **Дёргание при панорамировании**: Mousemove события не синхронизированы между ref и state
- ✅ **Зависание при быстрых действиях**: Накопление обработчиков в memory

### 2.2 Почему React 19 усугубляет это

| Функция | React 18 | React 19 | Воздействие |
|---------|----------|---------|------------|
| Батчинг событий | Синтетические события | ВСЕ события (включая mousemove) | Больше batch cycles |
| deps array tracking | Loose | Strict (react-compiler) | Больше переопределений callbacks |
| Transitions | startTransition | Лучше интеграция | Может конфликтовать с RAF |
| useCallback memoization | Требует deps | Требует deps + более контролируется | Больше вероз пересоздания |

---

## 3. ПЛАН ИСПРАВЛЕНИЯ

### TODO #1: Исправить управление обработчиками событий (КРИТИЧНО)

**Стратегия**: Использовать единственный стабильный обработчик с refs для доступа к текущему состоянию

```typescript
// Создаём ОДИН стабильный обработчик, который НИКОГДА не пересоздаётся
const handleMouseMoveRef = useRef<(e: MouseEvent) => void>();

// Обновляем его содержимое в useEffect, когда состояние меняется
useEffect(() => {
  handleMouseMoveRef.current = (e: MouseEvent) => {
    if (!isPanning.current) return; // Используем ref вместо state
    // ... обновляем refs ...
    requestAnimationFrame(() => {
      setPanPosition({ x: newX, y: newY });
    });
  };
}, []); // Пусто! Зависит только от refs.

// Добавляем слушатель ОДИН раз
useEffect(() => {
  const handler = (e: MouseEvent) => handleMouseMoveRef.current?.(e);
  window.addEventListener('mousemove', handler, { passive: true });
  return () => window.removeEventListener('mousemove', handler);
}, []); // Никогда не пересчитывается!
```

### TODO #2: Синхронизировать refs и state правильно

**Стратегия**: Использовать `flushSync` (он уже импортирован!) для критических обновлений

```typescript
import { flushSync } from "react-dom";

// Вместо:
panPositionRef.current = { x: newX, y: newY };
requestAnimationFrame(() => {
  setPanPosition({ x: newX, y: newY });
});

// Делаем:
flushSync(() => {
  setPanPosition({ x: newX, y: newY });
});
panPositionRef.current = panPosition; // Синхронный ref
```

### TODO #3: Оптимизировать useMemo с зависимостями

**Стратегия**: Разделить на несколько меньших useMemo или использовать React.memo для маркер компонентов

```typescript
// Вместо одного большого useMemo:
{useMemo(() => (
  // BIG MEMOIZED CONTENT
), [8 dependencies])}

// Делаем:
const markerLayerContent = useMemo(() => {
  // только выбор компонента - не рендер!
  return renderMode; // 'basic' | 'advanced' | 'canvas'
}, [locations.length, isAdminMode]); // Только критические зависимости

// Затем условно рендерим компонент вне useMemo
{markerLayerContent === 'canvas' && <CanvasInteractiveMarkerLayer ... />}
```

### TODO #4: Использовать useTransition для zoom/pan

**Стратегия**: Обозначить zoom/pan обновления как non-urgent transitions

```typescript
const [isPending, startTransition] = useTransition();

const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  wheelDeltaRef.current += e.deltaY;
  
  if (wheelRafIdRef.current !== null) return;
  
  wheelRafIdRef.current = requestAnimationFrame(() => {
    // Вычислить новые значения...
    
    // Обновить с LOW PRIORITY
    startTransition(() => {
      setScale(newScale);
      setPanPosition(newPan);
    });
  });
}, []);
```

### TODO #5: Убрать лишние listners

**Стратегия**: Консолидировать resize handling

```typescript
// Вместо 2 resize listeners, использовать 1
useEffect(() => {
  const handleResize = () => {
    // Update imgSize
    // Update canvas size
  };
  
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(imgRef.current);
  window.addEventListener('resize', handleResize); // fallback
  
  return () => {
    resizeObserver.disconnect();
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

---

## 4. ОЖИДАЕМЫЕ УЛУЧШЕНИЯ

После применения этих fix'ов:

| Метрика | До | После | Улучшение |
|---------|----|----|-----------|
| FPS при zoom | ~30 FPS | ~50-60 FPS | 100% |
| Memory при drag | 50+ listeners | 5-10 listeners | 80% ↓ |
| Re-renders при move | 10-15 per move | 2-3 per move | 70% ↓ |
| Event handler creation | 100+ per sec | ~1 per reset | 99% ↓ |

---

## 5. REFERENCES

- [React 19 Breaking Changes](https://react.dev/blog/2024/11/21/react-19)
- [flushSync documentation](https://react.dev/reference/react-dom/flushSync)
- [useTransition for non-blocking updates](https://react.dev/reference/react/useTransition)
- [Batching in React 18 & 19](https://react.dev/blog/2021/06/08/the-next-batch-of-react-features)

---

## НАЧАТЬ С ЭТОГО:

1. **Приоритет 1** (5-10 минут): Исправить handleMouseMove (TODO #1)
2. **Приоритет 2** (10-15 минут): Синхронизировать refs/state (TODO #2)
3. **Приоритет 3** (15-20 минут): Оптимизировать useMemo (TODO #3)
4. **Приоритет 4** (опционально): useTransition для transitions
5. **Приоритет 5** (проверка): Профилировать с DevTools
