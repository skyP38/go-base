package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"go_grpc/internal/app"
	"go_grpc/internal/config"
)

// Константы окружений
const (
	envLocal = "local"
	envDev   = "dev"
	envProd  = "prod"
)

func main() {
	// Загрузка конфигурации
	cfg := config.MustLoad()

	// Настройка логгера
	log := setupLogger(cfg.Env)

	// Создание приложения
	application := app.New(log, cfg.GRPC.Port, cfg.StoragePath, cfg.TokenTTL)

	// Запуск gRPC сервера в горутине
	go func() {
		if err := application.GRPCServer.Run(); err != nil {
			log.Error("grpc server error", slog.Any("error", err))
		}
	}()

	// Graceful shutdown

	// Канал для сигналов ОС
	stop := make(chan os.Signal, 1)

	// Подписка на сигналы завершения
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)

	// // Ожидание сигнала SIGINT/SIGTERM
	sig := <-stop
	log.Info("Received signal", slog.String("signal", sig.String()))

	// graceful shutdown
	application.GRPCServer.Stop()
	application.Stop()
	log.Info("Gracefully stopped")
}

// настройка логгера в зависимости от окружения
func setupLogger(env string) *slog.Logger {
	var log *slog.Logger

	switch env {
	case envLocal:
		log = slog.New(
			slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}),
		)
	case envDev:
		log = slog.New(
			slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}),
		)
	case envProd:
		log = slog.New(
			slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}),
		)
	}

	return log
}
