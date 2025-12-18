package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/confluentinc/confluent-kafka-go/kafka"
)

// Количество сообщений после которых будет выполняться commit offset
const MIN_COMMIT_COUNT = 10

func main() {

	// Настройка конфигурации консьюмера
	config := &kafka.ConfigMap{
		// Список брокеров Kafka для первоначального подключения
		"bootstrap.servers": "localhost:9092,localhost:9093,localhost:9094",
		// Идентификатор группы консьюмеров
		"group.id": "myGroup",

		// Поведение при отсутствии сохраненного offset
		// "earliest" - начать читать с самого старого сообщения в топике
		// "latest" - начать читать только новые сообщения (по умолчанию)
		// "none" - выбросить ошибку если offset не найден
		"auto.offset.reset": "earliest",
	}

	// Инициализация консьюмера
	consumer, err := kafka.NewConsumer(config)
	if err != nil {
		panic(fmt.Sprintf("Failed to create consumer: %v", err))
	}

	// Подписка на топики
	err = consumer.SubscribeTopics([]string{"async-topic", "sync-topic"}, nil)
	if err != nil {
		panic(err)
	}
	fmt.Println("Consumer initialized")

	// Обработка сигналов для graceful shutdown
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	// Счетчик обработанных сообщений
	msg_count := 0
	// Флаг работы основного цикла
	run := true

	for run {
		select {
		case sig := <-sigchan:
			fmt.Printf("Caught signal %v: terminating\n", sig)
			run = false
		default:
			ev := consumer.Poll(100)
			if ev == nil {
				continue
			}
			switch e := ev.(type) {
			case *kafka.Message:
				msg_count++
				fmt.Printf("Message on %s: %s\n",
					e.TopicPartition, string(e.Value))

				// Коммитим каждые MIN_COMMIT_COUNT сообщений
				if msg_count%MIN_COMMIT_COUNT == 0 {
					_, err := consumer.Commit()
					if err != nil {
						fmt.Printf("Commit error: %v\n", err)
					}
				}
			case kafka.PartitionEOF:
				// PartitionEOF - достигнут конец партиции
				fmt.Printf("Reached %v\n", e)
			case kafka.Error:
				fmt.Fprintf(os.Stderr, "%% Error: %v\n", e)
				run = false
			default:
				// Игнорируем другие события
			}
		}
	}

	// Закрываем консьюмер
	consumer.Close()
}
