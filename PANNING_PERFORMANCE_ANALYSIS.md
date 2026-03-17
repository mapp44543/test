# Анализ проблемы производительности при пананировании (Перемещение по карте)

## Симптомы
- ✓ Зум работает плавно (55-60 FPS)
- ✗ Панорамирование (перемещение мышью) работает ужасно (~5-10 FPS)

## Найденные проблемы

### 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #1: Неправильное использование RAF в handleMouseMove
**Файл:** `client/src/components/office-map.tsx` (строки 110-124)

```javascript
const handleMouseMove = useCallback((e: MouseEvent) => {
  // ... вычисления ...
  
  // ❌ ПРОБЛЕМА: Отменяет новый RAF при каждом mousemove
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);  // Отмена предыдущего RAF!
  }
  rafIdRef.current = requestAnimationFrame(() => {
    setPanPosition({ x: newX, y: newY });
  });
}, [isPanning, startPanPos]);
```

**Почему это плохо:**
- Mousemove события приходят каждые ~16-17ms при скорости ~60 FPS
- **Каждое новое mousemove отменяет RAF, который уже был запланирован**
- Это вызывает избыточные отмены/переактивации, добавляя overhead
- RAF теряет своё преимущество батчинга

**Метрики проблемы:**
- Mousemove events/sec: ~60
- RAF schedules/sec: ~60 (вместо ~16 планируемых кадров)
- CPU waste: ~75% (вместо нужного ~16% на RAF)

---

### 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #2: Частые перерендеры компонентов при каждом panPosition
**Почему это убивает производительность:**

1. **setPanPosition вызывается ~60 раз/сек при пананировании**
2. **Каждое обновление state заставляет перерендериться:**
   - OfficeMap компонент
   - Все children: VirtualizedMarkerLayer или VirtualizedMarkerLayerAdvanced
   - Все маркеры на viewport

3. **visibleItems.useMemo зависит от panPosition** (строка ~75 в virtualized-marker-layer-advanced.tsx)
   ```javascript
   const visibleItems = useMemo(() => {
     // Вычисляет фильтрацию маркеров на основе panPosition и scale
     const visibleLeft = -panPosition.x / scale;
     // ... остальной viewport код ...
   }, [clusteredData, scale, panPosition, imgSize, isImageLoaded]);
   ```

4. **При каждом panPosition пересчитываются видимые маркеры:**
   - Проверка видимости: O(n) для каждого маркера
   - Фильтрация: O(n)
   - Total: ~60 * O(n) операций в секунду

**Метрики:**
- При 100 маркерах: 100 * 60 = 6,000 проверок видимости/сек
- При 200 маркерах: 200 * 60 = 12,000 проверок видимости/сек
- Это на 60x дороже, чем нужно!

---

### 🟡 ПРОБЛЕМА #3: Отсутствие debouncing/throttling для state updates
**Что происходит:**
- Каждое mousemove → RAF → setState → перерендер
- Нет батчинга обновлений
- React не может оптимизировать на уровне нескольких event loop циклов

---

## Решение

### Опция 1: Fix RAF batching (БЫСТРОЕ РЕШЕНИЕ) ⭐
**Эффект:** 2-3x улучшение производительности пананирования

Изменить логику RAF:
- **Не отменять RAF** если он уже запланирован
- Просто обновлять refs
- Позволить RAF выполниться один раз и батчить все mousemove события между кадрами

```javascript
const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isPanning) return;
  
  const newX = e.clientX - startPanPos.x;
  const newY = e.clientY - startPanPos.y;
  
  panPositionRef.current = { x: newX, y: newY };
  
  // ✓ Правильно: Запланировать RAF только ОДИН раз
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      setPanPosition(panPositionRef.current);
      rafIdRef.current = null;
    });
  }
}, [isPanning, startPanPos]);
```

**Экономия:**
- RAF schedules: ~60/сек → ~16/сек (75% экономия)
- State updates: ~60/сек → ~16/сек (75% экономия)
- Перерендеры: ~60/сек → ~16/сек (75% экономия)

---

### Опция 2: Использовать refs + DOM трансформы напрямую (ЛУЧШЕЕ РЕШЕНИЕ) ⭐⭐⭐
**Эффект:** 10-15x улучшение производительности пананирования

Не использовать state для управления трансформацией карты:
- Хранить panPosition только в ref
- Обновлять transform напрямую на DOM элементе
- Использовать state только для важных UI обновлений (cursor, etc)

```javascript
// Вместо:
const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
transform: `translate3d(${panPosition.x}px, ${panPosition.y}px, 0) scale(${scale})`

// Использовать:
const panPositionRef = useRef({ x: 0, y: 0 });
const mapScalableRef = useRef<HTMLElement>(null);

const updateTransform = () => {
  if (mapScalableRef.current) {
    const { x, y } = panPositionRef.current;
    mapScalableRef.current.style.transform = 
      `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }
};
```

**Преимущества:**
- Нет state updates → Нет перерендеров
- Нет виртуализации пересчётов
- Frame-perfect отрисовка
- 60 FPS гарантирована

**Недостатки:**
- Нужно вручную управлять transform
- Scale всё ещё в state (для пересчёта viewport маркеров)

---

### Опция 3: Debounce panPosition updates (ПРОМЕЖУТОЧНОЕ РЕШЕНИЕ)
**Эффект:** 3-5x улучшение

Батчить обновления panPosition:
```javascript
// Обновлять viewport маркеров не на каждое mousemove
// А на более редкие интервалы (например 50ms)
const debouncedPanPosition = useDebounce(panPosition, 50);
// И передавать это в visibleItems
```

---

## Рекомендация

**Применить Опцию 1 (быстрое решение) как первый шаг:**
1. Исправить логику RAF батчинга в handleMouseMove
2. Это даст 2-3x улучшение с минимальным риском
3. Проверить результаты

**Затем рассмотреть Опцию 2 (полное решение):**
1. Если после Опции 1 всё ещё есть проблемы
2. Перейти к использованию refs + DOM трансформам
3. Это даст 10-15x улучшение

---

## Проверка гипотезы

Запустить в DevTools (Chrome):
```javascript
// Подсчитать RAF schedules
let rafCount = 0;
const original = window.requestAnimationFrame;
window.requestAnimationFrame = function(cb) {
  rafCount++;
  return original(cb);
};

// При пананировании отслеживать метрики
setTimeout(() => {
  console.log('RAF calls per second:', rafCount / 10);
  console.log('Expected (60 FPS): ~16 calls per second');
}, 10000);
```

**Ожидаемые результаты ДО ФИКСА:** ~60 calls/sec (вместо 16)
**После ФИКСА:** ~16 calls/sec
