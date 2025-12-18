# Go gRPC SSO (Single Sign-On) Сервер

Полноценная система аутентификации и авторизации на основе gRPC и JWT токенов.

## Особенности

- **gRPC API** - высокопроизводительный RPC протокол
- **JWT токены** - безопасная аутентификация
- **SQLite** - легковесная база данных
- **Graceful shutdown** - корректное завершение работы
- **Structured logging** - структурированное логирование
- **Миграции БД** - управление схемой базы данных
- **Конфигурация YAML** - гибкая настройка
- **Интерсепторы** - middleware для логирования и обработки ошибок
- **Protobuf** - строгая типизация API

## Структура проекта

```
go_grpc/
├── cmd/
│   ├── sso/          # Основное приложение
│   └── migrator/     # Утилита миграций БД
├── internal/
│   ├── app/          # Инициализация и жизненный цикл приложения
│   ├── config/       # Конфигурация
│   ├── domain/       # Доменные модели
│   ├── grpc/         # gRPC обработчики
│   ├── lib/          # Вспомогательные библиотеки (jwt, logger)
│   ├── services/     # Бизнес-логика (сервис аутентификации)
│   └── storage/      # Работа с БД (SQLite)
├── migrations/       # SQL миграции
├── proto/           # Protobuf определения API
├── gen/go/          # Сгенерированный из proto Go код
├── config/          # Файлы конфигурации
├── storage/         # Файлы базы данных SQLite
└── scripts/         # Вспомогательные скрипты
```

## База данных

### Схема БД

```sql
-- Таблица пользователей
CREATE TABLE users (
    id        INTEGER PRIMARY KEY,
    email     TEXT    NOT NULL UNIQUE,
    pass_hash BLOB    NOT NULL
);

-- Таблица приложений
CREATE TABLE apps (
    id     INTEGER PRIMARY KEY,
    name   TEXT    NOT NULL UNIQUE,
    secret TEXT    NOT NULL UNIQUE
);
```

### Настройка базы данных

```bash
# Применение миграций
go run cmd/migrator/main.go \
    --storage-path=./storage/sso.db \
    --migrations-path=./migrations
```

## API Методы

### Регистрация пользователя

```protobuf
rpc Register (RegisterRequest) returns (RegisterResponse);
```

**Запрос:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Ответ:**
```json
{
  "userId": 1
}
```

### Вход в систему

```protobuf
rpc Login (LoginRequest) returns (LoginResponse);
```

**Запрос:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "app_id": 1
}
```

**Ответ:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Проверка прав администратора

```protobuf
rpc IsAdmin (IsAdminRequest) returns (IsAdminResponse);
```

**Запрос:**
```json
{
  "user_id": 1
}
```

**Ответ:**
```json
{
  "is_admin": false
}
```

## Тестирование

### Использование grpcurl

```bash
# Проверка доступных методов
grpcurl -plaintext localhost:44044 list

# Регистрация пользователя
grpcurl -plaintext -d '{"email": "test@example.com", "password": "password123"}' \
    localhost:44044 auth.Auth/Register

# Вход в систему
grpcurl -plaintext -d '{"email": "test@example.com", "password": "password123", "app_id": 1}' \
    localhost:44044 auth.Auth/Login

# Проверка прав администратора
grpcurl -plaintext -d '{"user_id": 1}' \
    localhost:44044 auth.Auth/IsAdmin
```

## Настройка окружений

### Локальное окружение (local)
- Текстовые логи с уровнем Debug
- Reflection API включен
- Подходит для разработки

### Разработка (dev)
- JSON логи с уровнем Debug
- Reflection API включен
- Подходит для тестирования

### Продакшн (prod)
- JSON логи с уровнем Info
- Reflection API отключен
- Максимальная производительность и безопасность



## Безопасность

### Особенности безопасности

1. **Хэширование паролей** - bcrypt с солью
2. **JWT токены** - подписанные секретным ключом приложения
3. **Маскировка паролей** в логах
4. **Валидация входных данных** на всех уровнях
5. **Обработка ошибок** без утечки информации

## Логирование

### Форматы логов

- **local** - текстовый формат с цветами
- **dev/prod** - JSON формат для парсинга

### Уровни логирования

- **Debug** - детальная информация для разработки
- **Info** - основные события приложения
- **Warn** - потенциальные проблемы
- **Error** - критические ошибки

## Отладка

### Включение детального логирования

```bash
# Запуск с уровнем логирования Debug
LOG_LEVEL=debug go run cmd/sso/main.go
```

### Проверка состояния БД

```bash
# Просмотр схемы
sqlite3 storage/sso.db ".schema"

# Просмотр данных
sqlite3 storage/sso.db "SELECT * FROM users;"
sqlite3 storage/sso.db "SELECT * FROM apps;"
```

### Тестирование с разными данными

```sql
-- Добавление нескольких тестовых приложений
INSERT INTO apps (id, name, secret) VALUES 
(1, 'test-app', 'test-secret-1'),
(2, 'mobile-app', 'mobile-secret-2'),
(3, 'web-app', 'web-secret-3');
```

## Расширение функционала

### Добавление нового метода API

1. Добавьте метод в `proto/sso/sso.proto`
2. Сгенерируйте код: `task generate`
3. Реализуйте обработчик в `internal/grpc/auth/server.go`
4. Добавьте бизнес-логику в `internal/services/auth/auth.go`

### Добавление новой таблицы в БД

1. Создайте файлы миграции в `migrations/`
2. Примените миграции
3. Добавьте методы в хранилище `internal/storage/sqlite/sqlite.go`

---

## Быстрый старт

```bash
# 1. Установите зависимости
go mod download

# 2. Сгенерируйте код из proto
go-task generate

# 3. Настройте БД
mkdir -p storage
go run cmd/migrator/main.go \
    --storage-path=./storage/sso.db \
    --migrations-path=./migrations

# 4. Добавьте тестовое приложение
sqlite3 storage/sso.db "INSERT INTO apps (id, name, secret) VALUES (1, 'test-app', 'test-secret-key');"

# 5. Запустите сервер
go run cmd/sso/main.go -config=./config/config.yaml

# 6. Протестируйте
grpcurl -plaintext localhost:44044 auth.Auth/Register -d '{"email": "test@example.com", "password": "password123"}'
```