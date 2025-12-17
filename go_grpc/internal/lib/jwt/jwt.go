package jwt

import (
	"go_grpc/internal/domain/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// создание JWT токена для пользователя и приложения
func NewToken(user models.User, app models.App, duration time.Duration) (string, error) {
	// Создание нового токена с алгоритмом HS256
	token := jwt.New(jwt.SigningMethodHS256)

	// Добавление claims (данных) в токен
	claims := token.Claims.(jwt.MapClaims)
	claims["uid"] = user.ID
	claims["email"] = user.Email
	claims["exp"] = time.Now().Add(duration).Unix()
	claims["app_id"] = app.ID

	// Подпись токена секретным ключом приложения
	tokenString, err := token.SignedString([]byte(app.Secret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
