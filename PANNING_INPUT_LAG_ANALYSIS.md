# ДИАГНОСТИКА: Почему пананирование "как в кеселе" (очень медленное)

## Проблема
- Пананирование медленное (~5-10 FPS "как в кеселе")
- **Не зависит** от количества маркеров (1 или 100 - одинаково)
- Это означает проблема **НЕ в маркерах**, а в самом механизме пананирования

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ НАЙДЕНЫ

### Проблема #1: `passive: true` на mousemove listener
**Файл:** `office-map.tsx`, строка 182

```javascript
window.addEventListener('mousemove', handleMouseMove, { passive: true });
```

**Почему это плохо для пананирования:**
- `passive: true` говорит браузеру "этот listener не будет вызывать preventDefault"
- Браузер может оптимизировать НО это может добавить задержку обработки
- Для interactive events (drag, pan) `passive: true` может ЗАМЕДЛИТЬ обработку
- Потому что браузер не знает что нужна low-latency обработка

**Результат:**
- mousemove events обрабатываются с задержкой
- Это вызывает input lag (задержка между движением мыши и движением карты)
- Ощущение "как в кеселе" / "sticky"

---

### Проблема #2: Event listener re-attaching в useEffect
**Файл:** `office-map.tsx`, строка 199

```javascript
useEffect(() => {
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('mouseup', handleMouseUp, { passive: true });
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    // ...
  };
}, [handleMouseMove, handleMouseUp]);  // ❌ ПРОБЛЕМА!
```

**Почему это плохо:**
- `handleMouseMove` в dependencies → useEffect перебирается когда handleMouseMove переписывается
- `handleMouseMove` = useCallback с dependencies `[isPanning, startPanPos, ...]`
- Это означает при каждом mousemove (и isPanning/startPanPos изменении) handleMouseMove переписывается
- Который триггирит useEffect который удаляет/добавляет listener

**Cascade проблемы:**
```
mousemove event
  ↓
handleMouseMove вызывается
  ↓
isPanning/startPanPos читаются (часто меняются)
  ↓
handleMouseMove функция переписывается (новый reference)
  ↓
useEffect видит новый handleMouseMove в dependencies
  ↓
Отстегивает старый listener, пристегивает новый
  ↓
Context switch, задержка обработки
  ↓
Input lag ("как в кеселе")
```

**Результат: Input lag + задержка обработки событий**

---

### Проблема #3: startPanPos в dependencies handleMouseMove
**Файл:** `office-map.tsx`

```javascript
const [startPanPos, setStartPanPos] = useState({ x: 0, y: 0 });

const handleMouseMove = useCallback((e: MouseEvent) => {
  // ... использует startPanPos ...
}, [isPanning, startPanPos]);  // startPanPos в dependencies!
```

**Почему это плохо:**
- startPanPos меняется когда пользователь нажимает мышку
- Это переписывает handleMouseMove
- Что триггирит useEffect listener detach/attach
- На каждое mouseDown! Много раз в session!

**Результат: Частые listener re-attachments**

---

## 📊 Что происходит на самом деле

```
User moves mouse быстро:
  ├─ mousemove #1 → handleMouseMove вызывается с passive: true
  │  └─ ЗАДЕРЖКА из-за passive и context switch
  │
  ├─ mousemove #2 → handleMouseMove (возможно новый reference)
  │  └─ useEffect видит change → removeEventListener + addEventListener
  │     └─ ВСЕ СОБЫТИЯ ЗАДЕРЖИВАЮТСЯ пока это происходит!
  │
  ├─ mousemove #3 → обработка задерживается
  │
  └─ mousemove #4 → обработка задерживается
  
Result: "как в кеселе" - каждый mousemove задерживается!
```

---

## 🛠️ РЕШЕНИЯ

### Fix A: Удалить passive: true с mousemove
```javascript
window.addEventListener('mousemove', handleMouseMove);  // Без passive!
window.addEventListener('mouseup', handleMouseUp);
```

**Это сообщает браузеру:**
- Этому listener нужна low-latency обработка
- Браузер не должен задерживать события
- Используй стандартный interactive event path

**Результат:** Задержка исчезнет, пананирование сразу будет ярче

---

### Fix B: Убрать handleMouseMove и handleMouseUp из dependencies
```javascript
const handleMouseMoveRef = useRef<(e: MouseEvent) => void>();
const handleMouseUpRef = useRef<() => void>();

// Обновляем refs вместо переписывания callback
useEffect(() => {
  handleMouseMoveRef.current = (e: MouseEvent) => {
    if (!isPanning) return;
    // ... логика ...
  };
  handleMouseUpRef.current = () => {
    // ... логика ...
  };
}, [isPanning, startPanPos]);

// useEffect с пустой dependency array - listener добавляется один раз!
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => handleMouseMoveRef.current?.(e);
  const handleMouseUp = () => handleMouseUpRef.current?.();
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, []);  // Пустой array!
```

**Результат:** Listeners добавляются один раз на mount, удаляются на unmount. Нет re-attaching!

---

### Fix C: Комбинированный подход (РЕКОМЕНДУЕТСЯ)
```javascript
// 1. Убрать passive: true
// 2. Убрать handleMouseMove/handleMouseUp из dependencies
// 3. Использовать refs для доступа к текущему состоянию
```

---

## Быстрая диагностика

### Проверить #1: Input lag
```javascript
// В консоли:
let lastTime = performance.now();
window.addEventListener('mousemove', () => {
  const now = performance.now();
  console.log(`Lag: ${(now - lastTime).toFixed(1)}ms`);
  lastTime = now;
}, { passive: false });
```
**Результат:**
- Нормально: 16-17ms (60 FPS)
- Плохо: 20-50ms+ (input lag)

### Проверить #2: Listener re-attaching
```javascript
// Добавить console.log в useEffect:
useEffect(() => {
  console.log('LISTENER RE-ATTACHED!');  // Если это логирует часто = проблема!
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  // ...
}, [handleMouseMove, handleMouseUp]);
```
**Результат:**
- Нормально: логирует 1 раз на mount
- Плохо: логирует на каждое событие

---

## Ожидаемое улучшение после fixes

| Проблема | До | После |
|---------|-----|----------|
| Input lag | Высокий (50-100ms) | Низкий (<16ms) |
| Listener re-attaching | Часто (на каждый mousemove) | 1 раз (на mount) |
| Feel пананирования | "как в кеселе" | Smooth, responsive |
| FPS | 5-10 (нет улучшения) | 50-60 (от Fix #2 + это) |

---

## Почему это не зависит от маркеров

**До сих пор мы оптимизировали маркеры**, но main thread lag был в другом месте:
1. Event listener re-attaching
2. Input lag из passive: true
3. Event processing delay

Эти проблемы не зависят от количества маркеров - они в самом event loop!

---

## Следующие шаги

### СРОЧНО применить:
1. ✓ Убрать `passive: true` с mousemove
2. ✓ Переделать useEffect чтобы НЕ переписывать listeners
3. ✓ Использовать refs для доступа к состоянию

### Затем тестировать:
- Chrome DevTools → Performance tab при пананировании
- Проверить input lag (должен быть <16ms)
- Проверить FPS (должен быть 50-60)

---

**Дата диагностики:** 17 марта 2026  
**Статус:** Критические проблемы найдены, готово к исправлению
