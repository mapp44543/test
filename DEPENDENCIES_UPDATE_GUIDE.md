# 🔧 ПОШАГОВОЕ РУКОВОДСТВО ПО ОБНОВЛЕНИЮ ЗАВИСИМОСТЕЙ

**Дата создания:** 13 марта 2026  
**Статус:** Документация для выполнения обновлений  
**Тестировано на:** Linux, Node.js 18+

---

## 📌 ПЕРЕД НАЧАЛОМ

### Предварительные проверки:

```bash
# 1. Убедиться, что проект в чистом состоянии git
git status
# Все изменения либо закоммитить, либо очистить

# 2. Создать отдельную ветку для обновлений
git checkout -b feat/dependencies-update

# 3. Проверить текущие версии node и npm
node --version  # Должно быть 18+
npm --version   # Должно быть 9+

# 4. Очистить кэш npm (опционально, но рекомендуется)
npm cache clean --force

# 5. Удалить node_modules и package-lock.json для чистого install
rm -rf node_modules package-lock.json
```

---

## 🔴 ФАЗА 1: КРИТИЧНЫЕ ОБНОВЛЕНИЯ

### Шаг 1.1: Проверить текущее состояние

```bash
npm outdated
npm audit
```

**Что искать:**
- Красные строки в `npm outdated` = есть обновления
- Критичные уязвимости в `npm audit`

---

### Шаг 1.2: Обновить React и React-DOM

```bash
# Проверить последние версии
npm view react versions --json | tail -n 10
npm view react-dom versions --json | tail -n 10

# Обновить до последней версии 19.x
npm install react@latest react-dom@latest
```

**Ожидаемый результат:**
```json
"react": "^19.1.0" или выше,
"react-dom": "^19.1.0" или выше (ДОЛЖНЫ СОВПАДАТЬ)
```

**Проверка:**
```bash
npm ls react react-dom
# Оба должны быть на одной версии!
```

---

### Шаг 1.3: Исправить Tailwind CSS версии

**КРИТИЧНО:** На данный момент есть конфликт между tailwindcss (v3) и @tailwindcss/vite (v4)

#### Опция A: Обновить на Tailwind v4 (Рекомендуется)

```bash
# Обновить основной пакет
npm install tailwindcss@^4.0.0

# Убедиться что @tailwindcss/vite совпадает
npm install @tailwindcss/vite@^4.0.0

# Проверить что другие tailwind плагины совместимы
npm install tailwindcss-animate@latest tw-animate-css@latest

# Проверить версии
npm ls tailwindcss @tailwindcss/vite @tailwindcss/typography
```

**Возможные изменения конфига:**
- [Проверить миграцию Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4-0)
- Возможно потребуется обновить `tailwind.config.ts`

#### Опция B: Понизить @tailwindcss/vite (Если v4 вызывает проблемы)

```bash
# Откатить plugin к v3
npm install @tailwindcss/vite@^3.0.0

# Проверить версии
npm ls tailwindcss @tailwindcss/vite
# tailwindcss должна быть ^3.4.x
# @tailwindcss/vite должна быть ^3.x.x
```

**Тестирование стилей:**
```bash
npm run build  # Проверить что CSS компилируется
npm run dev    # Визуально проверить стили в браузере
```

---

### Шаг 1.4: Запустить Security Audit и исправить

```bash
# Полная проверка безопасности
npm audit

# Попытка автоматического исправления
npm audit fix

# Если остались проблемы - посмотреть детали
npm audit --detailed
```

**Что может вывести npm audit:**
```
# Пример:
┌─────────────────┬──────────────────────────────────────┐
│ moderate        │ Cross-site Scripting (XSS)           │
├─────────────────┼──────────────────────────────────────┤
│ Package         │ dependency-name                      │
│ Severity        │ moderate                             │
│ Vulnerable Vers │ >= 1.0.0, < 2.0.0                   │
│ Patched in      │ >= 2.0.0                             │
│ Dependency of   │ your-package                         │
└─────────────────┴──────────────────────────────────────┘
```

**Рекомендуемые действия:**
- Для security-critical (红色) - обновить ОБЯЗАТЕЛЬНО
- Для moderate/low - обновить рекомендуется, но можно отложить

---

### Шаг 1.5: Проверить TypeScript компиляция

```bash
# Запустить type check
npm run check

# Если есть ошибки:
# 1. Просмотреть ошибки в выводе
# 2. Исправить типы в коде
# 3. Повторить до успеха

# После обновления React могут быть changes в @types/react
npm install @types/react@latest @types/react-dom@latest
npm run check
```

---

## 🟠 ФАЗА 2: СРЕДНЕЕ ПРИОРИТЕТ

### Шаг 2.1: Обновить Radix UI компоненты

```bash
# Обновить все radix ui пакеты сразу
npm install @radix-ui/*@latest

# Проверить что все версии согласованы
npm ls @radix-ui/react-*
```

**Ожидание:** Все компоненты должны быть на похожих версиях (например, все ^1.2.x или все ^2.x.x)

**Проверка в коде:**
```bash
# Проверить что импорты работают
npm run check
```

---

### Шаг 2.2: Обновить Drizzle ORM

```bash
# Обновить основную библиотеку ORM
npm install drizzle-orm@latest

# Обновить драйвер и CLI вместе
npm install drizzle-kit@latest drizzle-zod@latest

# Проверить совместимость
npm ls drizzle-orm drizzle-kit drizzle-zod
```

**Тестирование базы данных:**
```bash
# Проверить что миграции все еще работают
npm run db:migrate

# Если есть проблемы - посмотреть Drizzle changelog
# https://github.com/drizzle-team/drizzle-orm/releases
```

---

### Шаг 2.3: Обновить Tools

```bash
# TypeScript
npm install typescript@latest

# Vite и плагины
npm install vite@latest @vitejs/plugin-react@latest

# PostCSS и зависимые
npm install postcss@latest autoprefixer@latest cross-env@latest

# ESBuild
npm install esbuild@latest

# Проверить TypeScript
npm run check
```

---

### Шаг 2.4: Обновить React специфичные типы

```bash
# Если еще не обновили
npm install @types/react@latest @types/react-dom@latest

# Проверить что версии совпадают с react/react-dom
npm ls react @types/react react-dom @types/react-dom
```

---

## 🟡 ФАЗА 3: ОПЦИОНАЛЬНЫЕ ОБНОВЛЕНИЯ

### Шаг 3.1: Проверить Passport и LDAP

```bash
# Обновить authentication пакеты
npm install passport@latest passport-local@latest

# Проверить LDAP (более рискованно)
npm view ldapjs versions --json | tail -n 5
npm audit ldapjs  # Проверить уязвимости

# Если есть более новая версия без уязвимостей:
npm install ldapjs@latest

# Проверить типы
npm install @types/ldapjs@latest
```

**Важно untuk Passport:** 
```bash
# Убедиться что локальная стратегия работает
npm run dev
# Тестировать login функцию в UI
```

---

### Шаг 3.2: Обновить другие зависимости по желанию

```bash
# Проверить что есть для обновления
npm outdated

# Обновить всё остальное
npm update

# Или конкретные пакеты
npm install date-fns@latest
npm install zod@latest
npm install framer-motion@latest
npm install react-window@latest
npm install recharts@latest
npm install lucide-react@latest
```

---

## ✅ ФИНАЛЬНЫЕ ПРОВЕРКИ

### Проверка 1: Полная компиляция и build

```bash
# Очистить build
rm -rf dist

# TypeScript check
npm run check

# Production build
npm run build

# Проверить что dist создана без ошибок
ls -la dist/
```

**Ожидаемый результат:**
```
dist/
├── index.html
├── assets/
│   ├── index-XXXXX.js
│   ├── index-XXXXX.css
│   └── ...
└── index.js  (server entry point)
```

---

### Проверка 2: Development сервер

```bash
# Убить все старые процессы
pkill -f node
pkill -f npm
sleep 2

# Запустить dev сервер
npm run dev

# Открыть в браузере http://localhost:5173
# Проверить:
# - Страница загружается без ошибок
# - Все компоненты рендерятся
# - Нет красных ошибок в консоли
# - Нет жёлтых warnings React
```

---

### Проверка 3: UI компоненты (все Radix UI)

После запуска dev сервера проверить в браузере:

```
Проверить компоненты:
☐ Modal диалоги (alert-dialog, dialog)
☐ Dropdown меню
☐ Tooltips
☐ Popover
☐ Select (выбор)
☐ Tabs
☐ Accordion
☐ Radio buttons
☐ Checkboxes
☐ Sliders
☐ Toggle кнопки
☐ Switch элементы
☐ Все должны открываться/закрываться

Проверить стили:
☐ Цвета применяются правильно
☐ Dark/Light mode работает
☐ Responsive дизайн работает
☐ Анимации smooth (если были)
```

---

### Проверка 4: Специфичные функции приложения

```bash
# Тестировать основной функционал в браузере:

☐ Загрузить карту с 100+ локациями
☐ Zoom in/out (проверить FPS)
☐ Pan карту (левый клик и drag)
☐ Клик на маркер
☐ Expand кластеры
☐ Поиск по локациям
☐ Фильтры
☐ Авторизация (если используется LDAP)
☐ Admin панель (если есть)
```

---

### Проверка 5: Performance (критично для React 19)

```bash
# В браузере консоль:
# На вкладке Performance:

1. Открыть DevTools (F12)
2. Перейти на вкладку Performance
3. Нажать запись (Record)
4. Выполнить:
   - Zoom in/out несколько раз
   - Pan карту несколько раз
   - Клик на несколько маркеров
5. Остановить запись
6. Анализировать результаты

Ожидаемо:
- FPS должен быть 50+ при пан/зум
- React re-renders должны быть оптимальными
- Нет частых компиляций стилей
```

---

### Проверка 6: Database

```bash
# Убедиться что DB всё ещё работает
npm run db:migrate

# Если есть ошибки - откатить последнюю миграцию
# и понять что изменилось в версии ORM
```

---

## 🚨 ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

### Сценарий 1: Build ошибки TypeScript

```bash
# Посмотреть детальные ошибки
npm run check 2>&1 | head -100

# Исправить проблемы в коде
# Чаще всего это в типах React компонентов

# Можно откатить конкретный пакет
npm install react@19.0.0 react-dom@19.0.0
npm install @types/react@19.0.0 @types/react-dom@19.0.0
npm run check
```

### Сценарий 2: Стили не работают (Tailwind)

```bash
# Если выбрали Tailwind v4 и стили сломались:

# Откатить на v3
npm install tailwindcss@^3.4.17 @tailwindcss/vite@^3.4.0

# Очистить кэш
npm cache clean --force

# Перебилдить
npm run build
npm run dev

# Проверить стили в браузере
```

### Сценарий 3: Radix UI компоненты сломались

```bash
# Откатить до предыдущих версий
npm install @radix-ui/react-dialog@1.1.7 @radix-ui/react-dropdown-menu@2.1.7

# Или вернуть все сразу
git checkout package.json
npm install
```

### Сценарий 4: Performance тухнет (особенно React 19)

```bash
# Возможно одно из обновлений сломало оптимизации
# Посмотреть на Performance issues файлы в этом репо:

# Файлы с исправлениями performance:
- PERFORMANCE_FIXES_COMPLETED.md
- REACT19_FIXES_SUMMARY.md

# Убедиться что исправления там все ещё применены:
grep -r "useCallback" client/src/components/office-map.tsx
grep -r "isPanningRef" client/src/components/office-map.tsx

# Если исправления потеряны - применить их заново
```

### Сценарий 5: Rollback всех изменений

```bash
# Если все совсем сломалось:

# 1. Очистить ветку
git clean -fd
rm -rf node_modules dist

# 2. Вернуться к исходному состоянию
git checkout main  # или master
git pull

# 3. Переустановить пакеты
npm install

# 4. Проверить
npm run check
npm run build
npm run dev
```

---

## 📊 CHECKLIST ВЫПОЛНЕНИЯ

```
ФАЗА 1: КРИТИЧНЫЕ
☐ Создана новая ветка feat/dependencies-update
☐ Проверен npm audit - исправлены security issues
☐ Обновлены react и react-dom до одной версии
☐ Исправлен конфликт tailwindcss версий
☐ npm run check проходит без ошибок

ФАЗА 2: СРЕДНЕЕ
☐ Обновлены все @radix-ui/* компоненты
☐ Обновлены drizzle-orm и drizzle-kit
☐ Обновлены typescript и vite
☐ Обновлены @types для react компонентов

ФАЗА 3: ОПЦИОНАЛЬНЫЕ
☐ Обновлены passport и ldapjs (если нужно)
☐ Обновлены остальные зависимости

ФИНАЛЬНЫЕ ПРОВЕРКИ
☐ npm run build успешно создал dist/
☐ npm run dev запустился без ошибок
☐ Все UI компоненты trabajo правильно в браузере
☐ Карта загружается и работает
☐ Zoom/Pan работает с хорошим FPS (50+)
☐ Database миграции успешны
☐ Performance не деградировала

ЗАВЕРШЕНИЕ
☐ Все изменения закоммичены
☐ Ветка отправлена на review/merge
☐ Обновлён этот документ или создан новый с результатами
```

---

## 📝 ШАБЛОН COMMIT MESSAGES

```bash
# После каждой фазы создать коммит:

git add package.json package-lock.json
git commit -m "chore(deps): update critical dependencies (phase 1)

- Updated react and react-dom to latest v19.x
- Fixed tailwindcss version conflict (v3 -> v4)
- Fixed security vulnerabilities with npm audit fix
- All types checked with npm run check"

# После второй фазы:
git commit -m "chore(deps): update medium-priority dependencies (phase 2)

- Updated all @radix-ui components to latest versions
- Updated drizzle-orm, drizzle-kit to latest
- Updated typescript, vite, and build tools
- Verified with npm run build"

# После финальных проверок:
git commit -m "chore(deps): verify dependency updates

- All tests passing
- Development server runs without errors
- Production build successful
- UI components working correctly
- Performance metrics maintained"
```

---

**Статус документации:** ✅ Актуальна на 13 марта 2026  
**Время выполнения:** ~2-3 часа на все фазы + тестирование  
**Сложность:** Средняя (требует внимательности и тестирования)  
**Риск регрессии:** Низкий (при соблюдении всех проверок)
