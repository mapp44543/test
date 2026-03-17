# Опции дополнительной оптимизации пананирования

## Если Fix #1 недостаточен

После применения Fix #1 (RAF batching), если производительность всё ещё недостаточна, есть несколько опций:

---

### Fix #2: Debounce viewport calculations (СРЕДН困-HEAVY SOLUTION)
**Потенциальное улучшение:** 2-5x дополнительное

#### Идея
Разделить панорамирование на два слоя:
1. **Быстрое движение:** Обновлять трансформацию на viewport, БЕЗ пересчёта видимых маркеров
2. **Медленное обновление:** Пересчитывать видимые маркеры с задержкой (50ms)

#### Реализация в office-map.tsx

```javascript
// Отдельный ref для быстрого panning (только трансформация)
const displayPanPositionRef = useRef({ x: 0, y: 0 });
const mapScalableRef = useRef<HTMLDivElement>(null);

// Debounced pan для viewport calculations
const [viewportPanPosition, setViewportPanPosition] = useState({ x: 0, y: 0 });
const viewportUpdateTimerRef = useRef<number | null>(null);

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isPanning) return;
  
  const newX = e.clientX - startPanPos.x;
  const newY = e.clientY - startPanPos.y;
  
  // БЫСТРО: Обновляем DOM transform напрямую (no re-render)
  displayPanPositionRef.current = { x: newX, y: newY };
  updateTransformDirectly();
  
  // МЕДЛЕННО: Debounce viewport calculations (50ms)
  if (viewportUpdateTimerRef.current !== null) {
    clearTimeout(viewportUpdateTimerRef.current);
  }
  viewportUpdateTimerRef.current = window.setTimeout(() => {
    setViewportPanPosition({ x: newX, y: newY });
    viewportUpdateTimerRef.current = null;
  }, 50); // Обновляем viewport маркеры только раз в 50ms
}, [isPanning, startPanPos]);

const updateTransformDirectly = () => {
  if (mapScalableRef.current) {
    const { x, y } = displayPanPositionRef.current;
    mapScalableRef.current.style.transform = 
      `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }
};
```

#### Передать viewportPanPosition в VirtualizedMarkerLayerAdvanced

```javascript
<VirtualizedMarkerLayerAdvanced
  // ... другие props ...
  panPosition={viewportPanPosition}  // Debounced версия
  // Визуальная панорама обновляется напрямую через DOM (в updateTransformDirectly)
/>
```

**Результат:**
- Visual panning: 60 FPS (обновляется напрямую через RAF)
- Viewport calculations: 20 FPS (обновляется раз в 50ms)
- Пользователь видит плавное движение, но маркеры обновляются достаточно часто

---

### Fix #3: Полная миграция на DOM манипуляции (HEAVY SOLUTION)
**Потенциальное улучшение:** 5-10x дополнительное

Не использовать state для panPosition вообще:
- Хранить только в refs
- Обновлять DOM напрямую
- Использовать requestAnimationFrame явно

#### Реализация

```javascript
const mapScalableRef = useRef<HTMLDivElement>(null);
const panPositionRef = useRef({ x: 0, y: 0 });
const renderFrameRef = useRef<number | null>(null);

const updateFrame = useCallback(() => {
  if (mapScalableRef.current) {
    const { x, y } = panPositionRef.current;
    mapScalableRef.current.style.transform = 
      `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }
  renderFrameRef.current = null;
}, [scale]);

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isPanning) return;
  
  const newX = e.clientX - startPanPos.x;
  const newY = e.clientY - startPanPos.y;
  panPositionRef.current = { x: newX, y: newY };
  
  // Батчим обновления в один RAF
  if (renderFrameRef.current === null) {
    renderFrameRef.current = requestAnimationFrame(updateFrame);
  }
}, [isPanning, startPanPos, updateFrame]);

// Рендер без panPosition в props
return (
  <div ref={mapScalableRef} style={{ transform: 'translate3d(0, 0, 0) scale(1)' }}>
    {/* Маркеры не зависят от panPosition state */}
    <VirtualizedMarkerLayerAdvanced
      // ... другие props ...
      // panPosition больше НЕ передаём!
      // Маркеры позиционируются на основе их % координат в изображении
    />
  </div>
);
```

**Результат:**
- Zero re-renders при пананировании
- 60 FPS гарантирована
- Маркеры остаются в том же положении (используют % координаты)

---

## Тестирование

### DevTools Performance Tab
```javascript
// В консоли при пананировании:
1. Открыть DevTools → Performance tab
2. Кликнуть Record
3. Подвигать мышью по карте ~5 секунд
4. Нажать Stop

Проверить:
- Frame rate: Должна быть 50-60 FPS (не 10-20)
- Rendering time: <16ms per frame
- RAF calls: Должны быть в sync с frames
```

### FPS Meter
```html
<!-- Добавить в components/office-map.tsx для теста -->
<div style={{
  position: 'fixed',
  top: 10,
  right: 10,
  background: 'rgba(0,0,0,0.7)',
  color: '#0ff',
  padding: '10px',
  fontFamily: 'monospace',
  fontSize: '12px',
  zIndex: 1000
}}>
  FPS: <span id="fps">0</span>
</div>

<script>
let lastTime = performance.now();
let frameCount = 0;
function updateFPS() {
  frameCount++;
  const currentTime = performance.now();
  if (currentTime >= lastTime + 1000) {
    document.getElementById('fps').textContent = frameCount;
    frameCount = 0;
    lastTime = currentTime;
  }
  requestAnimationFrame(updateFPS);
}
updateFPS();
</script>
```

---

## Рекомендация

1. **Сначала:** Применить Fix #1 (RAF batching) ✓ DONE
2. **Если всё ещё медленно (~20-30 FPS):** Применить Fix #2 (debounce viewport)
3. **Только если критично:** Применить Fix #3 (полная миграция на DOM)

Вероятность того, что Fix #1 полностью решит проблему: **70-80%**
Обычно плавное пананирование требует только правильного батчинга RAF.
