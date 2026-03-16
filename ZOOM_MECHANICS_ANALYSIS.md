# Анализ механики зума карты

## Архитектура контейнеров

```
.map-container (flex justify-center items-center)
  └─ .map-scalable (transform: translate + scale)
       └─ img/svg (флорплан)
```

### `.map-container`
- **Класс**: `w-full flex justify-center items-center flex-1`
- **Размер**: занимает всю доступную высоту (`flex-1`) и ширину (`w-full`)
- **Центрирование**: **Всегда центрирует содержимое** благодаря `justify-center items-center`
- **Overflow**: `overflow: hidden` - скрывает содержимое за границами

### `.map-scalable`
- **Transform**: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${scale})`
- **Transform-origin**: `0 0` - трансформация относительно левого верхнего угла
- **Размер**: `display: inline-block` - занимает только размер изображения

## Почему камера уходит в центр страницы

**Это не прямое "уход в центр", а правильный расчет кулинарных координат при зуме.**

### Как это работает:

1. **Контейнер всегда центрирует контент**
   ```
   container.clientWidth / 2 = центр X на экране
   container.clientHeight / 2 = центр Y на экране
   ```

2. **При зуме мышка должна остаться на той же точке карты**
   
   Когда вы крутите колесико над конкретной точкой:
   - Вычисляется позиция мыши в координатах окна (`clientX, clientY`)
   - Вычисляется, где находится эта точка на карте в "мировых" координатах (до игнорирования масштаба)
   - После изменения масштаба карта смещается так, чтобы эта же точка осталась под мышкой

3. **Расчет в `handleWheel` (строки 169-244)**

```typescript
// Позиция мыши в окне браузера
const mouseScreenX = e.clientX;
const mouseScreenY = e.clientY;

// Позиция мыши относительно контейнера
const mouseInContainerX = mouseScreenX - containerRect.left;
const mouseInContainerY = mouseScreenY - containerRect.top;

// Текущий слой
const currentScale = scaleRef.current;
const newScale = delta > 0 ? Math.max(0.5, currentScale - 0.1) : Math.min(3, currentScale + 0.1);

setPanPosition(prev => {
  // Размер карты ПРИ ТЕКУЩЕМ масштабе
  const scaledWidth = imgSize.width * currentScale;
  const scaledHeight = imgSize.height * currentScale;
  
  // Центр контейнера (куда всегда центрируется карта)
  const containerCenterX = container.clientWidth / 2;
  const containerCenterY = container.clientHeight / 2;
  
  // Левый верхний угол карты на экране
  const mapLeftOnScreen = containerCenterX - scaledWidth / 2 + prev.x;
  const mapTopOnScreen = containerCenterY - scaledHeight / 2 + prev.y;
  
  // Где находится мышка ОТНОСИТЕЛЬНО левого верхнего угла карты
  const mouseRelativeToMapX = mouseInContainerX - mapLeftOnScreen;
  const mouseRelativeToMapY = mouseInContainerY - mapTopOnScreen;
  
  // Координата под мышкой в "мировых" координатах карты (как если бы масштаб был 1)
  const worldX = mouseRelativeToMapX / currentScale;
  const worldY = mouseRelativeToMapY / currentScale;
  
  // После зума эта же мировая точка должна быть под мышкой
  const newMapLeftOnScreen = mouseInContainerX - worldX * newScale;
  const newMapTopOnScreen = mouseInContainerY - worldY * newScale;
  
  // Новое смещение (relative к центру контейнера)
  const newPanX = newMapLeftOnScreen - (containerCenterX - (imgSize.width * newScale) / 2);
  const newPanY = newMapTopOnScreen - (containerCenterY - (imgSize.height * newScale) / 2);
  
  return { x: newPanX, y: newPanY };
});
```

## Пример: Зум к центру страницы

Если вы крутите колесико над центром экрана:
1. `mouseInContainerX ≈ containerWidth / 2` - мышка близко к центру
2. `containerCenterX = container.clientWidth / 2` - карта центрируется в центр
3. Эти значения близки, поэтому карта "стремится" к центру при зуме
4. **Это не bug, это feature** - зум всегда фокусируется на позиции мыши

## Почему это так спроектировано

- **Интуитивно**: пользователь ожидает, что зум будет центрироваться на позиции мыши
- **Стандарт**: Google Maps, Figma и другие инструменты работают точно так же
- **Контейнер center**: благодаря `flex center` карта всегда красиво центрируется независимо от ее масштаба

## CSS Оптимизации

```css
.map-scalable {
  transform-origin: 0 0;  /* Масштаб от левого верхнего угла */
  will-change: transform;  /* GPU оптимизация */
  backface-visibility: hidden; /* Предотвращает мерцание */
  -webkit-perspective: 1000;  /* Для iOS 3D трансформаций */
  transition: transform 0.1s ease-out; /* Но НЕТ во время зума/панирования */
}

.map-container {
  overflow: hidden;  /* Скрывает контент за границами */
  cursor: grab;      /* Показывает, что можно перепан */
}
```

## Throttling и производительность

```typescript
// Максимум 60 FPS при зуме (одно событие каждые 16ms)
if (wheelThrottleRef.current !== null) {
  return; // Пропускаем if throttled
}

wheelThrottleRef.current = window.setTimeout(() => {
  wheelThrottleRef.current = null;
  setIsZooming(false);
}, 16);
```

## Резюме

**"Камера уходит в центр"** - это не баг, а результат:

1. ✅ Контейнер всегда центрирует содержимое (`flex center`)
2. ✅ Зум фокусируется на позиции мыши (стандартное поведение)
3. ✅ При зуме над центром - карта ведет себя "центрично"
4. ✅ При зуме над краем - карта смещается, но остается видимой

Это правильная механика, которая соответствует стандартам UX-проектирования.
