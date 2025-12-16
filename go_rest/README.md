# URL Shortener - Сервис сокращения ссылок

Простой и эффективный микросервис для сокращения URL-адресов, написанный на Go. Сервис предоставляет REST API для создания коротких ссылок и автоматически перенаправляет пользователей по исходным URL.

## Возможности

- Создание коротких ссылок с кастомными алиасами
- Автогенерация алиасов (6 случайных символов)
- Автоматический редирект по коротким ссылкам
- Базовая HTTP-аутентификация для API
- Подробное логирование запросов
- Валидация входных данных
- SQLite хранилище данных
- Unit и интеграционные тесты

## Технологический стек

- **Язык:** Go 1.25+
- **Фреймворк:** Chi Router
- **База данных:** SQLite3
- **Логирование:** slog с красивым выводом
- **Валидация:** go-playground/validator
- **Конфигурация:** cleanenv
- **Тестирование:** testify + httpexpect
- **Моки:** mockery

## Архитектура

```
url-shortener/
├── cmd/url-shortener/     # Точка входа
├── internal/
│   ├── config/            # Конфигурация
│   ├── http-server/       # HTTP слой
│   │   ├── handlers/      # Обработчики запросов
│   │   └── middleware/    # Middleware
│   ├── lib/              # Вспомогательные библиотеки
│   └── storage/          # Слой данных
├── config/               # Конфигурационные файлы
├── storage/              # SQLite база данных
└── tests/                # Интеграционные тесты
```

## Использование API

### Запуск сервера

```bash
go run cmd/url-shortener/main.go
```

Сервер запустится на `http://localhost:8082`

### Создание короткой ссылки

**Запрос:**
```bash
curl -X POST http://localhost:8082/url \
  -H "Content-Type: application/json" \
  -u myuser:mypass \
  -d '{"url": "https://example.com", "alias": "example"}'
```

**Успешный ответ (200 OK):**
```json
{
  "status": "OK",
  "alias": "example"
}
```

**Параметры:**
- `url` (обязательный) - URL для сокращения (должен быть валидным)
- `alias` (опциональный) - Кастомный алиас (если не указан, генерируется автоматически)

### Использование короткой ссылки

**Прямой переход в браузере:**
```
http://localhost:8082/example
```
Пользователь будет автоматически перенаправлен на `https://example.com`

**Проверка через curl:**
```bash
curl -v http://localhost:8082/example
```

### Получение информации

**Проверка существующих записей в БД:**
```bash
sqlite3 ./storage/storage.db "SELECT * FROM url;"
```

## Конфигурация

### Конфигурационный файл (YAML)

Пример `config/local.yaml`:
```yaml
env: "local"                    # Окружение: local, dev, prod
storage_path: "./storage/storage.db"  # Путь к SQLite базе

http_server:
  address: "localhost:8082"     # Адрес и порт сервера
  timeout: 4s                   # Таймаут запросов
  idle_timeout: 30s             # Таймаут простоя
  User: "myuser"               # Логин для базовой аутентификации
  Password: "mypass"           # Пароль для базовой аутентификации
```

### Переменные окружения

Все параметры можно настроить через переменные окружения:

```bash
export CONFIG_PATH="./config/local.yaml"
export HTTP_SERVER_PASSWORD="mypass"  # Переопределяет пароль из конфига
```

## Тестирование

### Запуск unit-тестов

```bash
# Все тесты
go test ./...

# Тесты конкретного пакета
go test ./internal/http-server/handlers/url/save/...
go test ./internal/http-server/handlers/redirect/...

# С покрытием
go test -cover ./...

# Интеграционные тесты
go test ./tests/...
```

### Генерация моков

```bash
# Генерация моков для интерфейсов
go generate ./internal/http-server/handlers/url/save

go generate ./internal/http-server/handlers/redirect
```

## Логирование

Сервер использует структурированное логирование с разным уровнем детализации для разных окружений:

- **local** - Цветной текстовый вывод с DEBUG уровнем
- **dev** - JSON формат с DEBUG уровнем
- **prod** - JSON формат с INFO уровнем

Пример лога:
```
[15:05:05.000] INFO: request completed method=POST path=/url status=200 duration=2.5ms
```

## Примеры использования

### Создание нескольких ссылок

```bash
#!/bin/bash

BASE_URL="http://localhost:8082"
CREDS="-u myuser:mypass"

# Создаем ссылки с кастомными алиасами
curl -X POST $BASE_URL/url $CREDS -H "Content-Type: application/json" \
  -d '{"url": "https://github.com", "alias": "gh"}'

curl -X POST $BASE_URL/url $CREDS -H "Content-Type: application/json" \
  -d '{"url": "https://stackoverflow.com", "alias": "so"}'

# Создаем ссылку с автогенерацией алиаса
curl -X POST $BASE_URL/url $CREDS -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
```