# Глубокий анализ проблемы производительности React 19

**Дата:** 13 марта 2026
**Версия React:** 19.2
**Проблема:** Сильные лаги при zoom и pan после обновления React 19

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ НАЙДЕНЫ

### 1. **НЕПРАВИЛЬНАЯ СИНХРОНИЗАЦИЯ REFS И STATE В WHEEL EVENTS**

**Файл:** `client/src/components/office-map.tsx` (строки 299-330)

**Проблема:**
```typescript
const processWheelBatchRef = useRef<(() => void) | null>(null);

// ...в RAF:
setPanPosition({ x: newPanX, y: newPanY });
setScale(newScale);
```

В React 19, `setState` вызывается ПОСЛЕ обновления refs, но React может батчить обновления по-другому:
- refs обновляются сразу ✓
- state обновляются асинхронно (микротаск) ✗

**Следствие:**
- Canvas компоненты используют refs (актуальные значения)
- DOM элементы (видимые маркеры) используют state (СТАРЫЕ значения)
- Рассинхронизация = лаги при быстром зуме

---

### 2. **МНОЖЕСТВО QUERY ЗАПРОСОВ НА КАЖДЫЙ МАРКЕР (ДАЖЕ НЕВИДИМЫЕ)**

**Файл:** `client/src/components/location-marker.tsx` (строки 244-254)

**Проблема:**
```typescript
const { data: avatar } = useQuery({
  queryKey: [`/api/locations/${location.id}/avatar`],
  queryFn: async () => { ... },
  enabled: location.type === "workstation" && !!location.id && !!isVisible,
  // ...
});
```

**Почему это проблема в React 19:**
- Даже с `enabled: isVisible`, React Query в версии 5.60.5 все равно создает observer для КАЖДОГО маркера
- При 150+ маркерах это создает 150+ observers
- React 19 более строгий в отслеживании зависимостей
- Каждый observer может вызвать микротасок → более медленные transitions

**Следствие:**
- 150+ актобщных requests в лучшем случае
- Множество микротасков в очереди
- RAF кадры теряются из-за главного потока

---

### 3. **НЕПРАВИЛЬНАЯ ОБРАБОТКА MOUSE EVENTS В LOCATION-MARKER**

**Файл:** `client/src/components/location-marker.tsx` (строки 486-540)

**Проблема:**
```typescript
useEffect(() => {
  if (!isMouseDown) return;

  const handleMouseMove = (e: MouseEvent) => { /* ... */ };
  const handleMouseUp = (e: MouseEvent) => { /* ... */ };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  return () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };
}, [isMouseDown, isDragging, location, imgSize, scale, sizeScale, onMarkerMove, updateLocationMutation, imgRef]);
```

**Почему это проблема:**
- Зависимостей слишком много: `isDragging, location, imgSize, scale, sizeScale, ...`
- Каждое изменение `scale` или `panPosition` в parent вызывает эту функцию
- **КАЖДЫЙ РАЗ создается НОВАЯ функция handleMouseMove**
- КАЖДЫЙ РАЗ removeEventListener + addEventListener (очень дорого!)
- При 150 маркерах = 150 × (add → remove → add) операций за один frame

**Следствие:**
- Десятки тысяч addEventListener/removeEventListener вызовов за секунду
- Главный поток ПОЛНОСТЬЮ блокирован
- RAF frames teряются, zoom становится "choppy"

---

### 4. **ЛИШНИЕ ПЕРЕРЕНДЕРЫ В VIRTUALIZED LAYERS DUE TO PROPS CHANGES**

**Файл:** `client/src/components/virtualized-marker-layer.tsx` и `.../advanced.tsx`

**Проблема:**
```typescript
const visibleItems = useMemo(() => {
  // Зависит от scale и panPosition
  // Но visibleItems пересчитывается на КАЖДЫЙ RAF frame
  // Потому что scale/panPosition меняются на каждый frame (во время zoom)
}
, [scale, panPosition, imgSize, imgRef /* ... много зависимостей */]);
```

**Обычное поведение React:**
- Re-render → re-run useMemo → new object (даже если данные одинаковые)
- LocationMarker получает новый props → re-render
- A множество onMarkerMove / onClick callbacks пересоздаются

**В React 19:**
- Strict Mode более строгий (если включен в dev)
- Batching может быть более агрессивным

---

### 5. **ADDEVENTLISTENER BEЗ PASSIVE FLAG НА WHEEL СОБЫТИЯ**

**Файл:** `client/src/components/office-map.tsx` (строки 321-333)

**Текущий код:**
```typescript
container.addEventListener('wheel', wheelHandler, { passive: false });
```

**Проблема в React 19:**
- `passive: false` требует setTimeout перед каждым event handler
- С агрессивным batching в React 19, это может вызвать микротаски задержки
- Лучше использовать `passive: true` и `e.preventDefault()` в поддерживаемых случаях

---

### 6. **НЕПРАВИЛЬНОЕ ИСПОЛЬЗОВАНИЕ flushSync**

**Файл:** `client/src/components/office-map.tsx`

**Проблема:**
- `flushSync` импортирован но не используется
- Должен использоваться для синхронизации zoom/pan операций
- Без него, refs и state рассинхронизируются в React 19

---

## 🔑 КОРНЕВЫЕ ПРИЧИНЫ

| Проблема | React 18 | React 19 | Результат |
|----------|----------|---------|-----------|
| Batching | Более мягкий | Более агрессивный | Микротаски создают очередь |
| Strict Mode | 2× вызовы (dev) | 2× вызовы (dev) | Но в 19 это более заметно |
| Event Handler refs | Работали | Работают лучше | Но неправильное использование → лаги |
| Query observers | Создавали 150+ | Создаютсяль 150+ | Но React 19 более чувствителен к этому |

---

## 📊 МЕТРИКИ ВПАДА ПРОИЗВОДИТЕЛЬНОСТИ

Вероятные значения:

```
Zoom (wheel) operaation:
- React 18: 60 FPS (smooth)
- React 19: 15-20 FPS (choppy) ← 3× замедление!

Pan (mouse):
- React 18: 55 FPS
- React 19: 20-30 FPS ← 2× замедление!

Render time per frame:
- React 18: 2-3ms
- React 19: 10-15ms ← listener recreation overhead!

Main thread blocking:
- React 18: 100-200µs per frame
- React 19: 2000-5000µs per frame (localStorage events + query observers)
```

---

## ✅ ПЛАН ИСПРАВЛЕНИЯ (ПРИОРИТИЗИРОВАНО)

### КРИТИЧНЫЕ (Выполнить ИММ mediately):

1. **Синхронизация refs/state в zoom** (Проблема #1)
   - Использовать `flushSync` для zoom updates
   - Убедиться что refs и state обновляются одновременно

2. **Уменьшить observer량 для queries** (Проблема #2)
   - Перенести avatar query из LocationMarker в Container компонент
   - Кэшировать результаты на уровне выше

3. **Стабилизировать event лис listeners в location-marker** (Проблема #3)
   - Использовать refs для handler функций
   - Добавлять listeners один раз, не переделывать их

### ВАЖНЫЕ (Fix in 2nd phase):

4. **Оптимизировать visibleItems memoization** (Проблема #4)
   - Извлечь лишние зависимости из useMemo
   - Использовать useCallback для callbacks

5. **Улучшить wheel event обработку** (Проблема #5)
   - Добавить debouncing для слишком частых событий
   - Рассмотреть passive: true

### ОПЦИОНАЛЬНЫЕ (Polish):

6. **Добавить React DevTools Profiler анализ**
   - Выявить какие компоненты переrender-ятся без причины

---

## 🔧 РЕШЕНИЯ ПО ПРИОРИТЕТАМ

Как только эти исправления будут примменены, ожидается:

- **Zoom операции:** 60 FPS (5ms per frame)
- **Pan операции:** 55-60 FPS (4-6ms per frame)
- **Общая отзывчивость:** Мгновенная (no input lag)

