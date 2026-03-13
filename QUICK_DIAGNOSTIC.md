# 🔍 БЫСТРАЯ ДИАГНОСТИКА ПРОЕКТА

**Дата создания:** 13 марта 2026  
**Цель:** Быстро проверить текущее состояние проекта  
**Время выполнения:** 10-15 минут

---

## ⚡ БЫСТРЫЕ КОМАНДЫ ПРОВЕРКИ

### 1️⃣ Проверить версии главных пакетов

```bash
npm ls react react-dom @types/react @types/react-dom
```

**Ожидаемый результат:** React и React-DOM должны быть на ОДНОЙ версии

---

### 2️⃣ Проверить Tailwind версии (КРИТИЧНО)

```bash
npm ls tailwindcss @tailwindcss/vite @tailwindcss/typography
```

**⚠️ ПРОБЛЕМА если увидите:**
```
tailwindcss@3.4.17
@tailwindcss/vite@4.1.3  ❌ КОНФЛИКТ!
```

---

### 3️⃣ Полная проверка безопасности

```bash
npm audit
```

**Action items если есть output:**
- 🔴 RED (Critical) - ОБНОВИТЬ СЕЙЧАС
- 🟠 ORANGE (High) - ОБНОВИТЬ НА ЭТОЙ НЕДЕЛЕ  
- 🟡 YELLOW (Moderate) - ОБНОВИТЬ КОГДА СМОЖЕТЕ

---

### 4️⃣ Проверить что можно обновить

```bash
npm outdated
```

**Что смотреть:**
- `Current` - текущая версия
- `Wanted` - последняя версия в текущем диапазоне
- `Latest` - самая актуальная версия

**Пример output:**
```
Package           Current  Wanted  Latest  Location
@types/react      19.0.0   19.0.0  19.0.0  node_modules/@types/react
express           4.21.2   4.21.2  4.21.2  node_modules/express
drizzle-orm       0.39.1   0.39.1  0.40.1  node_modules/drizzle-orm
typescript        5.6.3    5.7.0   5.7.0   node_modules/typescript
vite              5.4.19   5.5.2   5.5.2   node_modules/vite
```

---

### 5️⃣ TypeScript синтаксис проверка

```bash
npm run check
```

**Output:**
- ✅ Без ошибок = хорошо
- ❌ С ошибками = нужно исправить перед обновлением

---

### 6️⃣ Проверить что build работает

```bash
npm run build
```

**Output:**
- ✅ `npm notice` и path к dist/ = успешный build
- ❌ ошибки = нужно исправить

---

### 7️⃣ Запустить development сервер

```bash
npm run dev
```

**Проверить в браузере:**
- Открыть http://localhost:5173
- ✅ Страница загружается
- ✅ Нет красных ошибок в консоли браузера
- ✅ Можно кликать на элементы

---

## 📊 СВОДНАЯ ТАБЛИЦА ПРОВЕРОК

Запустить все эти команды по порядку и заполнить таблицу:

```bash
# Скопировать и вставить всё:
echo "=== PROJECT DIAGNOSTIC ===" && \
echo "" && \
echo "1. React versions:" && npm ls react react-dom 2>/dev/null | grep -E "react|react-dom" && \
echo "" && \
echo "2. Tailwind versions:" && npm ls tailwindcss @tailwindcss/vite 2>/dev/null | grep -E "tailwind" && \
echo "" && \
echo "3. Outdated packages:" && npm outdated 2>/dev/null | head -20 && \
echo "" && \
echo "4. TypeScript check:" && npm run check 2>&1 | tail -5 && \
echo "" && \
echo "5. Node and npm versions:" && node --version && npm --version
```

---

## 🎯 ИНТЕРПРЕТАЦИЯ РЕЗУЛЬТАТОВ

### Сценарий A: Всё хорошо ✅

**Признаки:**
```
- React и React-DOM на одной версии
- Tailwindcss и @tailwindcss/vite совпадают по major версии
- npm audit показывает 0 vulnerabilities
- npm outdated показывает несколько outdated пакетов (нормально)
- npm run check - никаких ошибок
- npm run build - успешный build
```

**Рекомендация:** Можно выполнить обновления согласно [DEPENDENCIES_UPDATE_GUIDE.md](DEPENDENCIES_UPDATE_GUIDE.md)

---

### Сценарий B: Есть проблемы безопасности 🔴

**Признаки:**
```
npm audit output показывает:
- critical vulnerabilities
- high severity issues
```

**Немедленные действия:**
```bash
npm audit fix
npm audit fix --force  # если первое не помогло
npm audit  # проверить что исправилось
```

---

### Сценарий C: TypeScript ошибки ❌

**Признаки:**
```
npm run check вывел ошибки типов
```

**Рекомендация:**
1. Просмотреть ошибки внимательно
2. Исправить в коде (обычно в получении типов на React компонентах)
3. Повторить `npm run check`

**Если не знаете как исправить:**
- Это часто может быть проблемой несовместимости @types
- Попробовать: `npm install @types/react@latest @types/react-dom@latest`

---

### Сценарий D: Build ошибки 🔨

**Признаки:**
```
npm run build выводит ошибки компиляции
```

**Что искать:**
1. Ошибки Tailwind (если обновляли)
2. Ошибки esbuild (если обновляли версию)
3. Ошибки в коде TypeScript

**Быстрое исправление:**
```bash
# Очистить всё и переустановить
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

### Сценарий E: Dev сервер не стартует 💥

**Признаки:**
```
npm run dev выводит ошибку и не запускается
```

**Действия:**
1. Проверить консоль, какая ошибка
2. Если это Vite ошибка - посмотреть [vite.config.ts](vite.config.ts)
3. Если это React ошибка - посмотреть [client/src/main.tsx](client/src/main.tsx)
4. Откатить последнее изменение: `git checkout HEAD~1`

---

## 📋 КОНТРОЛЬНЫЙ СПИСОК

```
ДИАГНОСТИКА:
☐ Запустил npm ls react react-dom
☐ Запустил npm ls tailwindcss @tailwindcss/vite
☐ Запустил npm audit
☐ Запустил npm outdated
☐ Запустил npm run check
☐ Запустил npm run build
☐ Запустил npm run dev и проверил в браузере

РЕЗУЛЬТАТЫ:
☐ React версии совпадают: ДА / НЕТ
☐ Tailwind версии совпадают: ДА / НЕТ
☐ Security issues: ЕСТЬ / НЕТУ
☐ TypeScript errors: ЕСТЬ / НЕТУ
☐ Build errors: ЕСТЬ / НЕТУ
☐ Dev server работает: ДА / НЕТ

ВЫВОД:
☐ Проект готов к обновлению
☐ Нужно сначала исправить проблемы (указать какие):
   ...
☐ Нужна консультация (указать вопрос):
   ...
```

---

## 🚀 ЕСЛИ ХОТЕТЕ ВЫПОЛНИТЬ ОБНОВЛЕНИЯ

После диагностики и понимания статуса:

```bash
# 1. Создать ветку "feature branch"
git checkout -b feat/dependencies-update

# 2. Следовать инструкциям в [DEPENDENCIES_UPDATE_GUIDE.md](DEPENDENCIES_UPDATE_GUIDE.md)

# 3. После каждого шага запускать проверки:
npm run check
npm run build
npm run dev

# 4. После всех обновлений:
git add package.json package-lock.json
git commit -m "chore(deps): update dependencies - phase [1/2/3]"

# 5. Когда всё готово:
git push origin feat/dependencies-update
# Создать Pull Request в main/master
```

---

## 🔗 ПОЛЕЗНЫЕ КОМАНДЫ

```bash
# Просмотреть какая версия доступна для пакета
npm view PACKAGE_NAME versions --json | tail -n 15

# Просмотреть информацию о пакете
npm info PACKAGE_NAME

# Проверить уязвимости конкретного пакета
npm audit --package PACKAGE_NAME

# Проверить что можно обновить до последних версий
npm check-updates

# Проверить что зависит от конкретного пакета
npm ls PACKAGE_NAME

# Очистить кэш npm (если глюки)
npm cache clean --force

# Reinstall всё с нуля (ядерный вариант)
rm -rf node_modules package-lock.json && npm install
```

---

## ⏱️ ПРИМЕРНОЕ ВРЕМЯ

| Действие | Время |
|----------|-------|
| Запустить диагностику | 10-15 мин |
| Исправить security issues | 5-10 мин |
| Обновить критичные пакеты (фаза 1) | 20-30 мин |
| Обновить средние пакеты (фаза 2) | 15-20 мин |
| Обновить опциональные пакеты (фаза 3) | 10-15 мин |
| Тестирование всех фаз | 30-60 мин |
| **ИТОГО** | **2-3 часа** |

---

## 📞 ЕСЛИ ЗАСТРЯЛИ

1. **Гугл ошибку:** `[ERROR_TEXT] site:stackoverflow.com`
2. **Проверить github issues пакета:** `https://github.com/PACKAGE/issues`
3. **Посмотреть changelog:** `https://github.com/PACKAGE/releases`
4. **Откатить на шаг назад:** `git reset --hard HEAD~1`
5. **Полный reset:** Смотреть "ROLLBACK всех изменений" в [DEPENDENCIES_UPDATE_GUIDE.md](DEPENDENCIES_UPDATE_GUIDE.md)

---

**Следующий шаг:** Запустить диагностику и отчитаться о результатах по [DEPENDENCIES_UPDATE_ANALYSIS.md](DEPENDENCIES_UPDATE_ANALYSIS.md) и [DEPENDENCIES_UPDATE_GUIDE.md](DEPENDENCIES_UPDATE_GUIDE.md)
