package main

import (
	"cons/network"
	"cons/websocket"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"runtime"
	"time"
)

func main() {
	// Создаем сеть
	net := network.NewNetwork()

	// Добавляем несколько узлов для примера
	net.AddNode("Node1")
	time.Sleep(100 * time.Millisecond)
	net.AddNode("Node2")
	time.Sleep(100 * time.Millisecond)
	net.AddNode("Node3")

	// Даем время на инициализацию
	time.Sleep(500 * time.Millisecond)

	// Соединяем их в кольцо
	net.ConnectNodes("Node1", "Node2")
	net.ConnectNodes("Node2", "Node3")
	net.ConnectNodes("Node3", "Node1")

	// Создаем хаб WebSocket
	hub := websocket.NewHub(net)

	// Настраиваем HTTP роуты
	http.HandleFunc("/ws", hub.ServeWebSocket)

	// Статические файлы (фронтенд)
	http.Handle("/", http.FileServer(http.Dir(getStaticDir())))

	// API эндпоинты для управления сетью
	http.HandleFunc("/api/nodes", func(w http.ResponseWriter, r *http.Request) {
		handleNodesAPI(w, r, net)
	})

	// Запускаем сервер
	port := ":8080"
	fmt.Printf("Сервер запущен на http://localhost%s\n", port)
	fmt.Println("Откройте браузер и перейдите по адресу выше")
	log.Fatal(http.ListenAndServe(port, nil))
}

func handleNodesAPI(w http.ResponseWriter, r *http.Request, net *network.Network) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		// Возвращаем состояние сети
		state := net.GetNetworkState()
		json.NewEncoder(w).Encode(state)

	case "POST":
		// Добавляем новый узел
		nodeID := r.FormValue("id")
		if nodeID == "" {
			http.Error(w, "ID обязателен", http.StatusBadRequest)
			return
		}

		if err := net.AddNode(nodeID); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		fmt.Fprintf(w, `{"status": "ok", "message": "Узел %s добавлен"}`, nodeID)

	case "DELETE":
		// Удаляем узел
		nodeID := r.FormValue("id")
		if nodeID == "" {
			http.Error(w, "ID обязателен", http.StatusBadRequest)
			return
		}

		if err := net.RemoveNode(nodeID); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		fmt.Fprintf(w, `{"status": "ok", "message": "Узел %s удален"}`, nodeID)

	default:
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
	}
}

func getStaticDir() string {
	// Получаем путь к директории со статическими файлами
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "static")
}
