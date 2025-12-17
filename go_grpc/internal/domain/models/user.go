package models

// модель пользователя системы
type User struct {
	ID       int64  // Уникальный идентификатор
	Email    string // Email пользователя (уникальный)
	PassHash []byte // Хэш пароля (bcrypt)
}

// модель приложения
type App struct {
	ID     int    // Уникальный идентификатор приложения
	Name   string // Название приложения
	Secret string // Секретный ключ для подписи JWT
}
