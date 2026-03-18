# HOTFIX: Исправление потери функциональности пананирования

## Проблема
После оптимизаций перестало работать пананирование вообще - карта не двигается.

---

## Найденная причина

### Timing bug в `handleMouseDown`

**Проблема:**
```javascript
const handleMouseDown = (e) => {
  setIsPanning(true);           // Асинхронно
  setStartPanPos({ x, y });     // Асинхронно
  
  // В это time:
  // - isPanningRef.current = false (не обновлён ещё!)
  // - startPanPosRef.current = старое значение
};

const useEffect = () => {
  isPanningRef.current = isPanning;  // Обновляется позже
}, [isPanning]);

const handleMouseMove = () => {
  if (!isPanningRef.current) return;  // ❌ FALSE! event игнорируется
};
```

**Результат:**
1. User кликает на карту → handleMouseDown
2. setIsPanning(true) - асинхронно
3. handleMouseMove может быть вызван до того как refs обновлены
4. isPanningRef.current = false → mousemove игнорируется
5. Карта не двигается! ❌

---

## Решение

### 1. Синхронное обновление refs в handleMouseDown

```javascript
const handleMouseDown = (e) => {
  // ...валидация...
  
  // ✓ НОВОЕ: Обновляем refs синхронно, ДО setState!
  const newStartPanPos = {
    x: e.clientX - panPositionRef.current.x,
    y: e.clientY - panPositionRef.current.y
  };
  isPanningRef.current = true;           // СИНХРОННО!
  startPanPosRef.current = newStartPanPos;  // СИНХРОННО!
  
  // Теперь setState (для маркеров и прочего)
  setIsPanning(true);
  setStartPanPos(newStartPanPos);
};
```

**Почему это работает:**
- isPanningRef.current и startPanPosRef.current обновляются СРАЗУ
- Даже если mousemove вызовется до setState, refs уже готовы
- handleMouseMove может читать актуальные значения

### 2. Синхронное обновление refs в handleMouseUp

```javascript
const handleMouseUp = useCallback(() => {
  // ✓ НОВОЕ: Синхронно отключаем пананирование
  isPanningRef.current = false;
  
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }
  
  setIsPanning(false);
  setIsInteracting(false);
  // ...
}, []);
```

**Почему это работает:**
- Отключаем isPanningRef.current ДО остановки RAF
- handleMouseMove знает что пананирование закончилось
- Нет race conditions

---

## Архитектура после исправления

```
User clicks на карту:
  │
  ├─ handleMouseDown() [СИНХРОННО]
  │  ├─ isPanningRef.current = true ✓ (сейчас же!)
  │  ├─ startPanPosRef.current = newValue ✓ (сейчас же!)
  │  └─ setState (для маркеров и UI)
  │
  ├─ User moves mouse:
  │  ├─ mousemove event
  │  ├─ handleMouseMove() [СИНХРОННО и БЫСТРО]
  │  │  ├─ if (!isPanningRef.current) = FALSE ✗ (но мы ОБНОВИЛИ!)
  │  │  ├─ panPositionRef.current = новая позиция
  │  │  ├─ RAF батч обновление
  │  │  └─ scheduleViewportUpdate()
  │  └─ RAF кадр
  │     └─ updateMapTransform()
  │        └─ ✓ DOM THE updateMapTransform → mapScalableRef.style.transform
  │
  └─ User отпускает мышь:
     ├─ mouseup event
     └─ handleMouseUp() [СИНХРОННО]
        ├─ isPanningRef.current = false ✓ (сейчас же!)
        ├─ Отмена RAF
        └─ setIsPanning(false)
```

---

## Что было исправлено

**Файл:** `client/src/components/office-map.tsx`

### handleMouseDown
- ✅ Добавлено: Синхронное обновление isPanningRef.current и startPanPosRef.current
- ✅ Ключ: Обновления происходят ДО setState, гарантируя timing

### handleMouseUp
- ✅ Добавлено: Синхронное обновление isPanningRef.current = false
- ✅ Ключ: Гарантирует что mousemove знает что пананирование закончилось

---

## Почему это критически важно

### Race condition которую мы избежали:

```javascript
// БЫЛО (bug):
handleMouseDown() {
  setIsPanning(true);  // ← Асинхронно, в будущем
  // Но mousemove может быть обработан ДО этого!
}

handleMouseMove() {
  if (!isPanning) return;  // ← Читает старое значение!
}

// РЕЗУЛЬТАТ: Первые mousemove события игнорируются
```

```javascript
// СТАЛО (fixed):
handleMouseDown() {
  isPanningRef.current = true;  // ← Сейчас же!
  setIsPanning(true);           // ← Асинхронно для маркеров
}

handleMouseMove() {
  if (!isPanningRef.current) return;  // ← Читает НОВОЕ значение!
}

// РЕЗУЛЬТАТ: Ловит ВСЕ mousemove события
```

---

## Тестирование

### ✓ КРИТИЧНО: Проверить что пананирование работает!

```
1. Открыть карту
2. Кликнуть и ТЯНУТЬ мышь по карте
3. Проверить:
   ✓ Карта двигается сразу при начале drag?
   ✓ Карта движется плавно?
   ✓ Карта останавливается когда отпустить мышь?
```

**Ожидаемый результат:** Пананирование работает нормально как раньше!

### Проверить на разных этажах:
- ✓ Этаж с 1 маркером
- ✓ Этаж с 10 маркерами
- ✓ Этаж с 100 маркерами

Должно работать одинаково везде.

---

## Резюме

**Баг:** Timing issue - refs не обновлялись сразу, mousemove события обрабатывались до того как refs были готовы

**Решение:** Синхронное обновление refs в handleMouseDown/handleMouseUp перед setState

**Статус:** ✅ Исправлено, готово к тестированию

**Дата:** 18 марта 2026
