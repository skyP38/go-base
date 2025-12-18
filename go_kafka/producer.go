package main

import (
	"fmt"
	"os"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
)

func main() {
	// Настройка конфигурации продюсера
	config := &kafka.ConfigMap{
		// Адреса брокеров Kafka для первоначального подключения
		"bootstrap.servers": "localhost:9092,localhost:9093,localhost:9094",
		// Ожидание подтверждения от всех реплик
		"acks": "all",
		// Идентификатор клиента для мониторинга и отладки
		"client.id": "myProducer",
	}

	// Инициализация продюсера
	producer, err := kafka.NewProducer(config)
	if err != nil {
		fmt.Printf("Failed to create producer: %s\n", err)
		os.Exit(1)
	}

	defer producer.Close()
	fmt.Println("Producer initialized")

	// Асинхронная отправка
	go func() {
		topic := "async-topic"
		for _, word := range []string{"this", "is", "asynchronous", "message", "delivery", "in", "kafka", "with", "Go", "Client"} {
			producer.Produce(&kafka.Message{
				TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
				Value:          []byte(word),
			}, nil)
			time.Sleep(100 * time.Millisecond) // Задержка для наглядности
		}
	}()

	// Асинхронная обработка событий продюсера
	go func() {
		for e := range producer.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					fmt.Printf("Failed to deliver message: %v\n", ev.TopicPartition.Error)
				} else {
					fmt.Printf("Successfully produced record to topic %s partition [%d] @ offset %v\n",
						*ev.TopicPartition.Topic, ev.TopicPartition.Partition, ev.TopicPartition.Offset)
				}
			}
		}
	}()

	// Канал для получения подтверждений доставки
	deliveryChan := make(chan kafka.Event)

	// Отправка сообщений в синхронном режиме
	topic := "sync-topic"
	for _, word := range []string{"this", "is", "synchronous", "message", "delivery", "in", "kafka", "with", "Go", "Client"} {
		producer.Produce(&kafka.Message{
			TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
			Value:          []byte(word),
		}, deliveryChan)

		if err != nil {
			fmt.Printf("Produce failed: %v\n", err)
			continue
		}

		// Ожидание события доставки
		event := <-deliveryChan
		m := event.(*kafka.Message)

		if m.TopicPartition.Error != nil {
			fmt.Printf("Delivery failed: %v\n", m.TopicPartition.Error)
		} else {
			fmt.Printf("Delivered message to topic %s [%d] at offset %v\n",
				*m.TopicPartition.Topic, m.TopicPartition.Partition, m.TopicPartition.Offset)
		}
		time.Sleep(100 * time.Millisecond) // Задержка для наглядности
	}

	// Закрытие канала подтверждений
	close(deliveryChan)

	// Ждем завершения асинхронных отправок
	time.Sleep(2 * time.Second)
}
