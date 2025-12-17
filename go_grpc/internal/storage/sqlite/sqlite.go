package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"go_grpc/internal/domain/models"
	"go_grpc/internal/storage"

	"github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

// структура для работы с SQLite
type Storage struct {
	db *sql.DB
}

// Конструктор Storage
func New(storagePath string) (*Storage, error) {
	const op = "storage.sqlite.New"

	// Указываем путь до файла БД
	db, err := sql.Open("sqlite3", storagePath)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}

	return &Storage{db: db}, nil
}

// сохранение пользователя в БД
func (s *Storage) SaveUser(ctx context.Context, email string, passHash []byte) (int64, error) {
	const op = "storage.sqlite.SaveUser"

	// Подготовка SQL запроса
	stmt, err := s.db.Prepare("INSERT INTO users(email, pass_hash) VALUES(?, ?)")
	if err != nil {
		return 0, fmt.Errorf("%s: %w", op, err)
	}

	// Выполняем запрос, передав параметры
	res, err := stmt.ExecContext(ctx, email, passHash)
	if err != nil {
		var sqliteErr sqlite3.Error

		// Проверка на нарушение уникальности email
		if errors.As(err, &sqliteErr) && sqliteErr.ExtendedCode == sqlite3.ErrConstraintUnique {
			return 0, fmt.Errorf("%s: %w", op, storage.ErrUserExists)
		}

		return 0, fmt.Errorf("%s: %w", op, err)
	}

	// Получаем ID созданной записи
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("%s: %w", op, err)
	}

	return id, nil
}

// получение пользователя по email
func (s *Storage) User(ctx context.Context, email string) (models.User, error) {
	const op = "storage.sqlite.User"

	// Поиск пользователя по email
	stmt, err := s.db.Prepare("SELECT id, email, pass_hash FROM users WHERE email = ?")
	if err != nil {
		return models.User{}, fmt.Errorf("%s: %w", op, err)
	}

	row := stmt.QueryRowContext(ctx, email)

	var user models.User
	err = row.Scan(&user.ID, &user.Email, &user.PassHash)
	if err != nil {
		// Обработка случая "не найдено"
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, fmt.Errorf("%s: %w", op, storage.ErrUserNotFound)
		}

		return models.User{}, fmt.Errorf("%s: %w", op, err)
	}

	return user, nil
}

// получение приложения по ID
func (s *Storage) App(ctx context.Context, id int) (models.App, error) {
	const op = "storage.sqlite.App"

	// Поиск приложения по ID
	stmt, err := s.db.Prepare("SELECT id, name, secret FROM apps WHERE id = ?")
	if err != nil {
		return models.App{}, fmt.Errorf("%s: %w", op, err)
	}

	row := stmt.QueryRowContext(ctx, id)

	var app models.App
	err = row.Scan(&app.ID, &app.Name, &app.Secret)
	if err != nil {
		// Обработка случая "не найдено"
		if errors.Is(err, sql.ErrNoRows) {
			return models.App{}, fmt.Errorf("%s: %w", op, storage.ErrAppNotFound)
		}

		return models.App{}, fmt.Errorf("%s: %w", op, err)
	}

	return app, nil
}

// регистрация нового пользователя
func (s *Storage) RegisterNewUser(ctx context.Context, email string, pass string) (int64, error) {
	const op = "storage.sqlite.RegisterNewUser"

	// Генерация хэш пароля
	passHash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", op, err)
	}

	// Сохранение пользователя
	return s.SaveUser(ctx, email, passHash)
}

// проверка прав администратора (заглушка)
func (s *Storage) IsAdmin(ctx context.Context, userID int64) (bool, error) {
	const op = "storage.sqlite.IsAdmin"

	// В текущей схеме нет таблицы админов, поэтому всегда false
	// TODO: добавить таблицу админов и реальную логику
	return false, nil
}

// закрытие соединения с БД
func (s *Storage) Close() error {
	return s.db.Close()
}
