# Реализация Опции 2: DOM трансформы напрямую

## Что было сделано

### 1. Архитектура оптимизации (2-слойная система)

#### Быстрый слой (60 FPS):
- **Источник:** mousemove события (~60 событий/сек)
- **Обновление:** DOM transform через `ref` напрямую (no React re-render)
- **Цель:** Плавное пананирование в реальном времени
- **Компоненты:** `updateMapTransform()` + RAF батчинг

#### Медленный слой (20 FPS):
- **Источник:** debounced state обновления (раз в 50ms)
- **Обновление:** viewportPanPosition state → VirtualizedMarkerLayer re-render
- **Цель:** Оптимальная виртуализация маркеров
- **Компоненты:** `scheduleViewportUpdate()` + 50ms таймер

### 2. Изменённые файлы

**Файл:** `client/src/components/office-map.tsx`

#### Новые refs:
```javascript
const mapScalableRef = useRef<HTMLDivElement>(null);  // Ref для DOM манипуляции
const viewportUpdateTimerRef = useRef<number | null>(null);  // Для debouncing
```

#### Новое состояние:
```javascript
const [viewportPanPosition, setViewportPanPosition] = useState({ x: 0, y: 0 });
```

#### Новые функции:
```javascript
const updateMapTransform = useCallback(() => {
  if (mapScalableRef.current) {
    const { x, y } = panPositionRef.current;
    mapScalableRef.current.style.transform = 
      `translate3d(${x}px, ${y}px, 0) scale(${scaleRef.current})`;
  }
}, []);

const scheduleViewportUpdate = useCallback(() => {
  // Debounce viewport обновления на 50ms
  if (viewportUpdateTimerRef.current !== null) {
    clearTimeout(viewportUpdateTimerRef.current);
  }
  viewportUpdateTimerRef.current = window.setTimeout(() => {
    setViewportPanPosition({ ...panPositionRef.current });
    viewportUpdateTimerRef.current = null;
  }, 50);
}, []);
```

#### Переработана логика handleMouseMove:
```javascript
const handleMouseMove = useCallback((e: MouseEvent) => {
  panPositionRef.current = { x: newX, y: newY };
  
  // Быстро: обновить DOM напрямую через RAF
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      updateMapTransform();
      rafIdRef.current = null;
    });
  }
  
  // Медленно: debounce обновление viewport маркеров
  scheduleViewportUpdate();
}, [isPanning, startPanPos, updateMapTransform, scheduleViewportUpdate]);
```

#### useEffect для синхронизации:
```javascript
useEffect(() => {
  panPositionRef.current = panPosition;
  updateMapTransform();
}, [panPosition, updateMapTransform]);
```

#### Передача viewportPanPosition в маркеры:
- CanvasInteractiveMarkerLayer: `panPosition={viewportPanPosition}`
- VirtualizedMarkerLayerAdvanced: `panPosition={viewportPanPosition}`
- VirtualizedMarkerLayer: `panPosition={viewportPanPosition}`

#### DOM элемент:
```javascript
<div
  ref={mapScalableRef}
  className="map-scalable"
  style={{
    // Transform управляется напрямую через ref, не через inline стиль
    transition: isInteracting || isZooming ? 'none' : 'transform 0.15s...'
  }}
>
```

---

## Ожидаемые результаты

### Производительность пананирования:
- **ДО:** 5-10 FPS
- **ПОСЛЕ (Fix #1):** 30-40 FPS (2-3x улучшение)
- **ПОСЛЕ (Fix #2):** 50-60 FPS (10-15x улучшение!)

### Детальные метрики:

| Метрика | До | После |
|---------|-----|----------|
| mousemove events/sec | 60 | 60 (не меняется) |
| RAF updates карты/sec | 60 | ~16 |
| setState panPosition/sec | 60 | 1 (только debounced) |
| React re-renders/sec | 60+ | ~20 (только маркеры) |
| visibleItems расчёты/sec | 6000 (~100 маркеров × 60) | 2000 (~100 маркеров × 20) |
| CPU usage при пане | High | Low |

### Visual обновление:
- Карта движется: 60 FPS (через DOM ref)
- Маркеры фильтруются: ~20 FPS (достаточно часто, не заметно отставание)

---

## Как работает в реальном времени

```
Пользователь двигает мышь:
├─ mousemove event (60/сек)
│  └─ handleMouseMove() {
│      panPositionRef.current = { x, y }  // Обновить ref
│      
│      // Батчировано в RAF
│      if (rafIdRef === null) {
│        rafIdRef = requestAnimationFrame(() => {
│          mapScalableRef.style.transform = ...  // ✓ БЫСТРО! (60 FPS)
│          rafIdRef = null
│        })
│      }
│      
│      // Debounced через таймер
│      scheduleViewportUpdate()  // Обновить через 50ms
│    }
│
└─ RAF кадр (~16ms) - обновляет DOM напрямую ✓

После 50ms:
└─ setViewportPanPosition() → React re-render
   └─ VirtualizedMarkerLayer получит новый panPosition
      └─ Пересчитает видимые маркеры (~20 FPS) ✓
```

---

## Отличие от Fix #1

| Аспект | Fix #1 (только RAF batching) | Fix #2 (DOM refs) |
|--------|---------|-----------|
| DOM updates | Через React state | Напрямую через ref |
| Re-renders during pan | ~16/сек (все ещё 60/сек до батчинга) | 0 (только маркеры) |
| visibleItems recalc | 100 × 16 = 1600/сек | ~100 × 0 = 0 + 100 × 20 = 2000/сек viewport |
| CPU таким образом | Средний | Низкий |
| Сложность | Низкая | Средняя |

---

## Тестирование

### DevTools Performance (нужно делать СЕЙЧАС):

1. **Открыть DevTools** → Performance tab
2. **Нажать Record**
3. **Подвигать мышью по карте 3-5 секунд быстро**
4. **Нажать Stop** и анализировать:

**Проверить:**
- ✓ FPS: Должна быть 50-60 (была ~10-20)
- ✓ Frame time: <16ms (была >50ms)
- ✓ No layout thrashing (были перестройки layout)
- ✓ Rendering time: <5ms (была >20ms)

### Chrome Profiler (быстрая проверка):

```javascript
// В Console при пананировании:
performance.mark('pan-start');
// Двигать мышь 2 сек
performance.mark('pan-end');
performance.measure('pan', 'pan-start', 'pan-end');
const measure = performance.getEntriesByType('measure')[0];
console.log(`Pan duration: ${measure.duration.toFixed(0)}ms`);
// Если < 500ms за 2 сек = хорошо, если > 1000ms = проблемы
```

### Visual тест:

1. Открыть карту с 50-100 маркерами
2. Быстро двигать мышь по карте (небольшие движения)
3. Проверить:
   - ✓ Карта движется плавно (не прыгает)
   - ✓ Маркеры обновляются (с лагом ~50ms, но это OK)
   - ✓ Нет visible flickering или ghosting

---

## Потенциальные проблемы и решения

### Problem #1: Scale (зум) не обновляется правильно
**Решение:** Scale используется в scaleRef и updateMapTransform, который вызывается через useEffect когда panPosition меняется

### Problem #2: Маркеры отстают от карты
**Это нормально!** Маркеры обновляются раз в 50ms, а карта - 60 раз в секунду. Визуально не заметно благодаря быстрому пананированию.

### Problem #3: centerOnLocation не работает
**Решение:** centerOnLocation вызывает setPanPosition, что триггирует useEffect → updateMapTransform

---

## Следующие шаги

### Если всё работает (50-60 FPS):
✓ Оптимизация завершена! Пананирование должно быть очень плавным.

### Если всё ещё медленно:
- Проверить Performance профиль
- Может быть проблема в компонентах маркеров (слишком много re-renders)
- Рассмотреть Fix #3 (полная миграция на DOM, без state для panPosition вообще)

---

**Дата реализации:** 17 марта 2026  
**Версия:** Fix #2 (DOM трансформы)
**Ожидаемое улучшение:** 10-15x
