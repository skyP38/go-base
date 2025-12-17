package app

import (
	"log/slog"
	"time"

	grpcapp "go_grpc/internal/app/grpc"
	"go_grpc/internal/services/auth"
	"go_grpc/internal/storage/sqlite"
)

// главное приложение, объединяющее все компоненты
type App struct {
	GRPCServer *grpcapp.App
	Storage    *sqlite.Storage
}

// инициализация приложения
func New(
	log *slog.Logger,
	grpcPort int,
	storagePath string,
	tokenTTL time.Duration,
) *App {
	// Инициализация хранилища
	storage, err := sqlite.New(storagePath)
	if err != nil {
		panic(err)
	}

	// Создание сервиса аутентификации
	authService := auth.New(log, storage, storage, storage, tokenTTL)

	// Создание gRPC приложения
	grpcApp := grpcapp.New(log, authService, grpcPort)

	return &App{
		GRPCServer: grpcApp,
		Storage:    storage,
	}
}

// остановка приложения с graceful shutdown
func (a *App) Stop() {
	// Остановка gRPC сервера
	a.GRPCServer.Stop()

	// Закрытие соединения с БД
	if err := a.Storage.Close(); err != nil {
		slog.Error("failed to close storage", slog.Any("error", interface{}(err)))
	}
}
