# Kafka Go Pet Project

## Описание

Этот проект представляет собой минимальную реализацию клиентов для Apache Kafka на языке Go. Проект включает:

- **Producer (продюсер)** - отправляет сообщения в Kafka топики
- **Consumer (консьюмер)** - читает сообщения из Kafka топиков
- **Docker Compose конфигурацию** - для запуска локального кластера Kafka

Проект демонстрирует два режима работы:
1. **Асинхронный режим** - быстрая отправка без ожидания подтверждения
2. **Синхронный режим** - надежная отправка с ожиданием подтверждения

### Параметры Kafka кластера:
- **Репликация**: данные реплицируются между 3 брокерами
- **Партиции**: топики создаются с 3 партициями по умолчанию
- **Отказоустойчивость**: кластер может работать при отказе одного брокера

## Архитектура

```
┌─────────────────┐     ┌──────────────────────────────────┐     ┌──────────────────┐
│   Producer Go   │───▶│     Apache Kafka Cluster         │───▶│  Consumer Go     │
│                 │     │(3 брокера для отказоустойчивости)│     │                  │
│ - async-topic   │     │                                  │     │-Группа: myGroup  │
│ - sync-topic    │     │  ├──────┐  ├──────┐  ├──────┐    │     └──────────────────┘
└─────────────────┘     │  │kafka1│  │kafka2│  │kafka3│    │   
                        │  └──────┘  └──────┘  └──────┘    │    
                        │            Zookeeper             │
                        └──────────────────────────────────┘
```

## Структура проекта

```
kafka-go-pet-project/
├── docker-compose.yml  # Конфигурация Kafka кластера (3 брокера + Zookeeper)
├── producer.go         # Producer - отправляет сообщения в Kafka
├── consumer.go         # Consumer - читает сообщения из Kafka
├── go.mod              # Go модули
├── go.sum              # Зависимости
└── README.md           # Эта документация
```

## Использование

### Producer (producer.go)
Отправляет сообщения в два топика:
- **async-topic** - асинхронная отправка (10 сообщений)
- **sync-topic** - синхронная отправка (10 сообщений)

**Режимы работы:**
- **Асинхронный**: отправка без ожидания подтверждения, результаты обрабатываются в отдельной горутине
- **Синхронный**: каждое сообщение ожидает подтверждения доставки перед отправкой следующего

### Consumer (consumer.go)
Читает сообщения из обоих топиков:
- Подписан на топики `async-topic` и `sync-topic`
- Использует consumer group `myGroup`
- Начинает чтение с самого старого сообщения (`earliest`)
- Коммитит offset каждые 10 сообщений

### Kafka кластер (docker-compose.yml)
Запускает полноценный Kafka кластер:
- **Zookeeper** (1 инстанс) - координатор кластера
- **Kafka** (3 брокера) - для отказоустойчивости и репликации

**Порты:**
- Zookeeper: 2181
- Kafka1: 9092 (внешний), 29092 (docker)
- Kafka2: 9093 (внешний), 29093 (docker)
- Kafka3: 9094 (внешний), 29094 (docker)

### Запуск клиентов

**В терминале 1 - Запуск Consumer:**
```bash
go run consumer.go
```

**В терминале 2 - Запуск Producer:**
```bash
go run producer.go
```


## Примеры работы

### Пример вывода Producer:
```
Producer initialized
Successfully produced record to topic async-topic partition [0] @ offset 0
Successfully produced record to topic async-topic partition [0] @ offset 1
Delivered message to topic sync-topic [2] at offset 0
Delivered message to topic sync-topic [2] at offset 1
```

### Пример вывода Consumer:
```
Consumer initialized
Message on async-topic [0]@0: this
Message on async-topic [0]@1: is
Message on sync-topic [2]@0: this
Message on sync-topic [2]@1: is
```