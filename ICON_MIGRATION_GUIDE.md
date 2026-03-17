# Icon Migration Guide for Server Deployment

После pull'а версии с английскими названиями иконок, нужно обновить базу данных и файлы на сервере.

## 📋 Чек-лист для сервера Ubuntu

### 1. **Pull кода**
```bash
cd /path/to/office-map
git pull origin main
```

### 2. **Удалить старые иконки с русскими названиями**
```bash
rm -f public/icons/user/сотрудник.svg
rm -f public/icons/user/сотрудник\ с\ охранным\ полем.svg
rm -f public/icons/user/раб\ место\ свободное.svg
rm -f public/icons/user/раб\ место\ свободное\ с\ охранным\ полем.svg
rm -f "public/icons/user/Рабочее место в работах.svg"
rm -f "public/icons/user/Рабочее место в работах с охранным полем.svg"
```

### 3. **Обновить базу данных** (выберите один из вариантов)

#### Вариант A: TypeScript скрипт (PostgreSQL) - **РЕКОМЕНДУЕТСЯ**
```bash
# Убедитесь, что DATABASE_URL задана в .env
npx tsx migrate-icons-postgres.ts
```

#### Вариант B: SQL напрямую (если PostgreSQL)
```bash
psql $DATABASE_URL < rename-icons.sql
```

#### Вариант C: SQLite (если используется SQLite)
```bash
sqlite3 storage.db < rename-icons-sqlite.sql
```

### 4. **Обновить зависимости (если были изменения)**
```bash
npm install
```

### 5. **Пересобрать (если используется build)**
```bash
npm run build
```

### 6. **Перезагрузить приложение**
```bash
# Если используется PM2
pm2 restart office-map

# Если используется systemctl
sudo systemctl restart office-map

# Если используется Docker
docker-compose restart web
```

### 7. **Проверить логи**
```bash
# PM2
pm2 logs office-map

# Systemctl
sudo journalctl -u office-map -f

# Docker
docker-compose logs -f web
```

## 🔄 Что обновляется в БД

Скрипт обновляет поле `custom_fields->customIcon` в таблице `locations` для всех рабочих станций:

| Старое (Russian) | Новое (English) |
|---|---|
| `сотрудник.svg` | `employee.svg` |
| `сотрудник с охранным полем.svg` | `employee-secure.svg` |
| `раб место свободное.svg` | `workstation-free.svg` |
| `раб место свободное с охранным полем.svg` | `workstation-free-secure.svg` |
| `Рабочее место в работах.svg` | `workstation-repair.svg` |
| `Рабочее место в работах с охранным полем.svg` | `workstation-repair-secure.svg` |

## ⚠️ Важно!

1. **Бэкап БД**: Перед миграцией сделайте резервную копию:
   ```bash
   # PostgreSQL
   pg_dump $DATABASE_URL > backup-icons.sql
   
   # SQLite
   cp storage.db storage.db.backup
   ```

2. **Проверьте иконки**: После миграции убедитесь, что иконки отображаются на карте в браузере

3. **Если что-то пошло не так**: Есть файлы миграции для отката (если нужны)

## 📝 Файлы миграции

- `migrate-icons-postgres.ts` - основной скрипт для PostgreSQL ✅ ИСПОЛЬЗУЙТЕ ЭТОТ
- `migrate-icons-sqlite.ts` - альтернатива для SQLite
- `rename-icons.sql` - SQL скрипт (для PostgreSQL)
- `rename-icons.sql` - SQL скрипт для SQLite

## 🆘 Если возникнут проблемы

1. Проверьте `DATABASE_URL` в .env
2. Убедитесь, что все новые иконки есть в `/public/icons/user/` после git pull
3. Проверьте логи приложения
4. Если иконки не отображаются - проверьте браузерную консоль (F12)
