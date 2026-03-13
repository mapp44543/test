# Production Deployment Guide - Floor Plans Fix

## Проблема
При развертывании на Ubuntu сервер с systemctl floor-plans исчезают и выдается 500 ошибка при загрузке новых планов.

## Причина
1. Файлы floor-plans хранятся в `server/public/floor-plans`
2. При production build Vite копирует только `client/public` в `dist/public`
3. Поэтому `dist/public/floor-plans` не содержит файлы, которые были загружены
4. Production код ищет файлы в `dist/public/floor-plans` по пути `__dirname + /public/floor-plans`

## Решение на Production Сервере

### Шаг 1: Инициализировать этажи в БД
```bash
cd /opt/test/
npm run init:floors
```
Это создаст 3 этажа по умолчанию (5, 9, МСК) если их нет в БД.

### Шаг 2: Синхронизировать floor-plans файлы
```bash
# Скопировать имеющиеся floor-plans из server/public в dist/public
cp server/public/floor-plans/* dist/public/floor-plans/ 2>/dev/null || true

# Убедиться что папка доступна для записи
chmod 755 dist/public/floor-plans
```

### Шаг 3: Перезапустить systemctl сервис
```bash
sudo systemctl restart office-map.service
sudo systemctl status office-map.service
```

### Шаг 4: Проверить работу
```bash
# Проверить списокэтажей
curl http://localhost:5000/api/floors

# Проверить что файлы доступны
curl http://localhost:5000/floor-plans/1.svg
```

## Долгосрочное Решение

### Вариант 1: Автоматическая синхронизация при запуске
Добавить в systemd unit (/etc/systemd/system/office-map.service):
```ini
[Unit]
...

[Service]
...
# Синхронизировать floor-plans перед запуском
ExecStartPre=/opt/test/sync-floor-plans.sh
ExecStart=/usr/bin/node ...
...
```

### Вариант 2: Хранить floor-plans в client/public
1. Скопировать файлы в client/public/floor-plans
2. Пересоздать production build: `npm run build`
3. Файлы будут компилироваться в dist/public/floor-plans автоматически

### Вариант 3: Использовать внешнее хранилище (S3, CDN)
Хранить файлы в облачном хранилище вместо локальной папки.

## Файлы для Production

После этих шагов в `dist/public/floor-plans/` должны быть:
- 1.svg
- ts.svg
- 5.svg
- 9.svg
- MSK.svg
- Pyatyy_etazh.svg
- Devyatyy_etazh.svg
- Moskva.svg
- 12.png
- 123.png
- example-floor-plan.svg

## Если floor-plans Все еще Не Работают

1. Проверить логи:
```bash
sudo journalctl -u office-map.service -n 100 --no-pager
```

2. Проверить разрешения:
```bash
ls -ld /opt/test/dist/public/floor-plans/
ls /opt/test/dist/public/floor-plans/
```

3. Проверить что приложение может писать в папку:
```bash
touch /opt/test/dist/public/floor-plans/.write-test
rm /opt/test/dist/public/floor-plans/.write-test
```

4. Проверить БД содержит корректные ссылки:
```bash
psql $DATABASE_URL -c "SELECT code, image_url FROM floors;"
```

## Скрипты

### init-floors.ts
Инициализирует 3 этажа по умолчанию если их нет в БД.
Запуск: `npm run init:floors`

### sync-floor-plans.sh
Синхронизирует floor-plans из server/public в dist/public.
Запуск: `bash sync-floor-plans.sh`
