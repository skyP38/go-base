package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

// основная структура конфигурации приложения
type Config struct {
	Env            string        `yaml:"env" env-default:"local"`                    // Окружение
	StoragePath    string        `yaml:"storage_path" env-required:"true"`           // Путь к БД
	GRPC           GRPCConfig    `yaml:"grpc"`                                       // Конфиг gRPC
	MigrationsPath string        `yaml:"migrations_path" env-default:"./migrations"` // Путь к миграциям
	TokenTTL       time.Duration `yaml:"token_ttl" env-default:"1h"`                 // Время жизни токена
}

// конфигурация gRPC сервера
type GRPCConfig struct {
	Port    int           `yaml:"port"`    // Порт сервера
	Timeout time.Duration `yaml:"timeout"` // Таймаут запросов
}

// загружает конфигурацию или паникует при ошибке
func MustLoad() *Config {
	configPath := fetchConfigPath()
	if configPath == "" {
		panic("config path is empty")
	}

	return MustLoadPath(configPath)
}

// загружает конфигурацию из указанного пути
func MustLoadPath(configPath string) *Config {
	// Проверка существования файла
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		panic("config file does not exist: " + configPath)
	}

	var cfg Config

	// Чтение конфигурации из YAML файла
	if err := cleanenv.ReadConfig(configPath, &cfg); err != nil {
		panic("config path is empty: " + err.Error())
	}

	return &cfg
}

// fetchConfigPath - получение пути к конфигурации (флаг > env > default)
func fetchConfigPath() string {
	var res string

	flag.StringVar(&res, "config", "", "path to config file")
	flag.Parse()

	if res == "" {
		res = os.Getenv("CONFIG_PATH")
	}

	return res
}
