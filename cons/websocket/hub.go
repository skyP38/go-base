package websocket

import (
	"cons/network"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // В продакшене нужно ограничить домены!
	},
}

// Клиент WebSocket
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Хаб для управления клиентами
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	network    *network.Network
	mu         sync.RWMutex
}

func NewHub(network *network.Network) *Hub {
	hub := &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
		network:    network,
	}

	go hub.run()
	go hub.listenNetworkEvents()

	return hub
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			// Отправляем текущее состояние сети новому клиенту
			state := h.network.GetNetworkState()

			// Получаем информацию о всех соединениях
			connections := h.network.GetAllConnectionsForFrontend()

			initData := map[string]interface{}{
				"nodes":       state,
				"connections": connections,
			}

			if data, err := json.Marshal(map[string]interface{}{
				"type": "init",
				"data": initData,
			}); err == nil {
				client.send <- data
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Слушаем события сети и рассылаем клиентам
func (h *Hub) listenNetworkEvents() {
	for msg := range h.network.MessageBus {
		var data []byte
		var err error

		switch v := msg.Data.(type) {
		case string:
			data, err = json.Marshal(map[string]interface{}{
				"type": msg.Type,
				"data": v,
			})
		case network.NodeUpdate:
			data, err = json.Marshal(map[string]interface{}{
				"type": msg.Type,
				"data": v,
			})
		case map[string]interface{}:
			data, err = json.Marshal(map[string]interface{}{
				"type": msg.Type,
				"data": v,
			})
		default:
			data, err = json.Marshal(map[string]interface{}{
				"type": msg.Type,
				"data": fmt.Sprintf("%v", v),
			})
		}

		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			continue
		}

		// Отправляем как чистый JSON без лишних символов
		h.broadcast <- data
	}
}

func (h *Hub) ServeWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}

	client.hub.register <- client

	// Запускаем горутины для чтения/записи
	go client.writePump()
	go client.readPump()
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for {
		message, ok := <-c.send
		if !ok {
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		// Убедимся, что сообщение - это []byte
		var msgBytes []byte = []byte(message)

		// Пишем сообщение как TextMessage
		if err := c.conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
			log.Printf("Write error: %v", err)
			return
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		// Обрабатываем команды от клиента
		c.handleCommand(message)
	}
}

func (c *Client) handleCommand(msg []byte) {
	var cmd map[string]interface{}
	if err := json.Unmarshal(msg, &cmd); err != nil {
		return
	}

	action, _ := cmd["action"].(string)
	fmt.Printf("Received command: %s, data: %v\n", action, cmd)

	switch action {
	case "addNode":
		nodeID, _ := cmd["nodeId"].(string)
		if nodeID != "" {
			if err := c.hub.network.AddNode(nodeID); err != nil {
				// Отправляем ошибку клиенту
				errorMsg := map[string]interface{}{
					"type": "error",
					"data": err.Error(),
				}
				if data, err := json.Marshal(errorMsg); err == nil {
					c.send <- data
				}
			}
		}

	case "removeNode":
		nodeID, _ := cmd["nodeId"].(string)
		if nodeID != "" {
			c.hub.network.RemoveNode(nodeID)
		}

	case "connectNodes":
		node1, _ := cmd["node1"].(string)
		node2, _ := cmd["node2"].(string)
		if node1 != "" && node2 != "" {
			if err := c.hub.network.ConnectNodes(node1, node2); err != nil {
				errorMsg := map[string]interface{}{
					"type": "error",
					"data": err.Error(),
				}
				if data, err := json.Marshal(errorMsg); err == nil {
					c.send <- data
				}
			}
		}

	case "startConsensus":
		value, _ := cmd["value"].(string)
		if value == "" {
			value = "Block_1"
		}
		fmt.Printf("Starting consensus with value: %s", value)
		if err := c.hub.network.StartConsensusRound(value); err != nil {
			errorMsg := map[string]interface{}{
				"type": "error",
				"data": err.Error(),
			}
			if data, err := json.Marshal(errorMsg); err == nil {
				c.send <- data
			}
		}

	case "getState":
		state := c.hub.network.GetNetworkState()
		if data, err := json.Marshal(map[string]interface{}{
			"type": "networkState",
			"data": state,
		}); err == nil {
			c.send <- data
		}
	case "toggleNode":
		nodeID, _ := cmd["nodeId"].(string)
		if nodeID != "" {
			if node, exists := c.hub.network.Nodes[nodeID]; exists {
				wasOnline := node.IsOnline

				// Переключаем состояние
				node.IsOnline = !node.IsOnline

				// Останавливаем/запускаем узел при необходимости
				if node.IsOnline {
					// node.Start()
					if node.StopChan == nil {
						node.StopChan = make(chan struct{})
					}
					go node.Start()
				} else {
					// node.Stop()
					if node.StopChan != nil {
						close(node.StopChan)
						node.StopChan = make(chan struct{})
					}
				}

				// Отправляем обновление состояния
				c.hub.network.MessageBus <- network.BroadcastMessage{
					Type: "nodeUpdate",
					Data: network.NodeUpdate{
						NodeID:   node.ID,
						Phase:    node.Consensus.Phase,
						Decision: node.Consensus.Decision,
						Online:   node.IsOnline,
						IsLeader: node.Consensus.IsLeader,
					},
				}

				// Логируем изменение
				status := "online"
				if !node.IsOnline {
					status = "offline"
				}

				c.hub.network.MessageBus <- network.BroadcastMessage{
					Type: "system",
					Data: fmt.Sprintf("Node %s manually set to %s (was %t)",
						node.ID, status, wasOnline),
				}

				// Обновляем связи
				connections := c.hub.network.GetAllConnectionsForFrontend()
				c.hub.network.MessageBus <- network.BroadcastMessage{
					Type: "connectionsUpdate",
					Data: connections,
				}
			}
		}

	case "createMesh":
		c.hub.network.CreateFullMesh()

	case "createRing":
		c.hub.network.CreateRingTopology()

	case "disconnectAll":
		c.hub.network.DisconnectAll()

	case "resetConsensus":
		c.hub.network.ResetConsensusState()

	case "simulateFailure":
		c.hub.network.SimulateRandomFailure()
	}
}
