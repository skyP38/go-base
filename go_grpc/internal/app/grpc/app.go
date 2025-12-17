package grpcapp

import (
	"context"
	"fmt"
	"log/slog"
	"net"

	authgrpc "go_grpc/internal/grpc/auth"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/logging"
	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/recovery"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

type App struct {
	log        *slog.Logger
	gRPCServer *grpc.Server
	port       int // Порт, на котором будет работать grpc-сервер
}

// создание нового gRPC приложения
func New(log *slog.Logger, authService authgrpc.Auth, port int) *App {
	// Настройки логирования
	loggingOpts := []logging.Option{
		logging.WithLogOnEvents(
			logging.PayloadReceived, logging.PayloadSent,
		),
	}

	// обработка паник
	recoveryOpts := []recovery.Option{
		recovery.WithRecoveryHandler(func(p interface{}) (err error) {
			// Логируем информацию о панике с уровнем Error
			log.Error("Recovered from panic", slog.Any("panic", p))
			return status.Errorf(codes.Internal, "internal error")
		}),
	}

	// Создаем gRPC сервер с единственным интерсептором
	gRPCServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		recovery.UnaryServerInterceptor(recoveryOpts...),
		logging.UnaryServerInterceptor(InterceptorLogger(log), loggingOpts...),
	))

	// Регистрация сервиса аутентификации
	authgrpc.Register(gRPCServer, authService)

	// Включение Reflection API
	reflection.Register(gRPCServer)

	return &App{
		log:        log,
		gRPCServer: gRPCServer, port: port,
	}
}

// адаптер slog.Logger для gRPC интерсептора с маскировкой паролей
func InterceptorLogger(l *slog.Logger) logging.Logger {
	return logging.LoggerFunc(func(ctx context.Context, lvl logging.Level, msg string, fields ...any) {
		// Маскировка полей с паролями
		for i := 0; i < len(fields); i += 2 {
			if fields[i] == "password" || fields[i] == "pass" {
				if i+1 < len(fields) {
					fields[i+1] = "***"
				}
			}
		}
		l.Log(ctx, slog.Level(lvl), msg, fields...)
	})
}

// запуск сервера с паникой при ошибке
func (a *App) MustRun() {
	if err := a.Run(); err != nil {
		panic(err)
	}
}

// запуск gRPC сервера
func (a *App) Run() error {
	const op = "grpcapp.Run"

	// Создание TCP listener
	l, err := net.Listen("tcp", fmt.Sprintf(":%d", a.port))
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}

	a.log.Info("grpc server started", slog.String("addr", l.Addr().String()))

	// Запуск сервера
	if err := a.gRPCServer.Serve(l); err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}

	return nil
}

// остановка сервера
func (a *App) Stop() {
	const op = "grpcapp.Stop"

	a.log.With(slog.String("op", op)).
		Info("stopping gRPC server", slog.Int("port", a.port))

	// Graceful shutdown
	a.gRPCServer.GracefulStop()
}
