package network

import (
	"fmt"
	"time"
)

type Node struct {
	ID           string           // Уникальный идентификатор
	Peers        map[string]*Node // Связанные узлы (ID -> Node)
	Consensus    *ConsensusState  // Текущее состояние консенсуса 
	MessageQueue chan Message     // Канал для входящих сообщений
	Network      *Network         // Ссылка на общую сеть (для широковещательных сообщений)
	IsOnline     bool             // Статус узла (в сети/отключен)
	StopChan     chan struct{}    // Канал для остановки ноды
}

func NewNode(id string, network *Network) *Node {
	return &Node{
		ID:           id,
		Peers:        make(map[string]*Node),
		Consensus:    NewConsensusState(),
		MessageQueue: make(chan Message, 100), // Буферизованный канал
		Network:      network,
		IsOnline:     true,
		StopChan:     make(chan struct{}),
	}
}

// Запуск обработки сообщений ноды
func (n *Node) Start() {
	go n.processMessages()
	fmt.Printf("Узел %s запущен\n", n.ID)
}

// Остановка ноды
func (n *Node) Stop() {
	if !n.IsOnline {
		return
	}
	n.IsOnline = false
	close(n.StopChan)

	// Сбрасываем состояние консенсуса при отключении
	n.Consensus.Phase = "IDLE"
	n.Consensus.IsLeader = false

	fmt.Printf("Узел %s остановлен\n", n.ID)
}

// Основной цикл обработки сообщений
func (n *Node) processMessages() {
	for {
		select {
		case msg := <-n.MessageQueue:
			if !n.IsOnline {
				continue
			}
			n.handleMessage(msg)
		case <-n.StopChan:
			return
		}
	}
}

// Обработка входящих сообщений
func (n *Node) handleMessage(msg Message) {
	// Уменьшаем TTL только если это пересылка
    if msg.To != n.ID && msg.To != "broadcast" {
        msg.TTL--
        if msg.TTL <= 0 {
            fmt.Printf("[TTL EXPIRED] Сообщение от %s до %s\n", msg.From, msg.To)
            return
        }
    }

	// Имитация сетевой задержки
	time.Sleep(time.Duration(50+randomInt(50)) * time.Millisecond)

	fmt.Printf("[DEBUG] Узел %s получил от %s: тип=%s, раунд=%d\n",
		n.ID, msg.From, msg.Type, msg.Round)

	// Пересылаем сообщение, если оно не для нас и не было перенаправлено
	if msg.To != n.ID && msg.To != "broadcast" {
		// Маршрутизируем через ближайшего соседа
        n.routeMessage(msg)
		return
	}

	// Отправляем событие в MessageBus для визуализации
	n.Network.MessageBus <- BroadcastMessage{
		Type: "message",
		Data: fmt.Sprintf("Узел %s получил сообщение от %s: тип=%s, значение=%v",
			n.ID, msg.From, msg.Type, msg.Value),
	}

	switch msg.Type {
	case "PROPOSE":
		n.handlePropose(msg)
	case "VOTE":
		n.handleVote(msg)
	case "DECISION":
		n.handleDecision(msg)
	}
}

func (n *Node) routeMessage(msg Message) {
    // Простая маршрутизация: если получатель - наш сосед, отправляем напрямую
    if peer, exists := n.Peers[msg.To]; exists && peer.IsOnline {
        n.sendMessage(msg)
        return
    }
    
    // Ищем получателя в сети
    if peer, exists := n.Network.Nodes[msg.To]; exists && peer.IsOnline {
        // Если получатель не сосед, отправляем через соседей
        for _, neighbor := range n.Peers {
            if neighbor.IsOnline && neighbor.ID != n.ID && neighbor.ID != msg.From {
                forwardMsg := msg
                forwardMsg.From = n.ID
                neighbor.MessageQueue <- forwardMsg
                return
            }
        }
    }
}

// Обработка предложения (для не-лидеров)
func (n *Node) handlePropose(msg Message) {
	if n.Consensus.IsLeader {
		return 
	}

	n.Consensus.Phase = "VOTE"
	n.Consensus.ProposedValue = msg.Value
	n.Consensus.CurrentRound = msg.Round

	fmt.Printf("[NODE %s] Перешел в фазу VOTE, предложение: %v\n", 
        n.ID, msg.Value)

	// Отправляем событие об обновлении фазы
    n.Network.MessageBus <- BroadcastMessage{
        Type: "nodeUpdate",
        Data: NodeUpdate{
            NodeID:   n.ID,
            Phase:    n.Consensus.Phase,
            Decision: n.Consensus.Decision,
            Online:   n.IsOnline,
            IsLeader: n.Consensus.IsLeader,
        },
    }

	// Проверка (всегда соглашаемся с непустым значением)
	vote := "NO"
	if msg.Value != nil && msg.Value != "" {
		vote = "YES"
	}

	// Отправляем голос лидеру
	n.sendMessage(Message{
		From:  n.ID,
		To:    msg.From, // Отправляем лидеру
		Type:  "VOTE",
		Value: vote,
		Round: msg.Round,
		TTL:   10, 
	})
}

// Обработка голоса (для лидера)
func (n *Node) handleVote(msg Message) {
    if !n.Consensus.IsLeader || n.Consensus.Phase != "VOTE" {
        return
    }

    // Сохраняем голос
    voteValue, ok := msg.Value.(string)
    if !ok {
        return
    }
    n.Consensus.ReceivedVotes[msg.From] = voteValue

    fmt.Printf("[VOTE COUNT] Лидер %s получил голос от %s: %s\n", 
        n.ID, msg.From, voteValue)
    fmt.Printf("[VOTE COUNT] Всего голосов: %d\n", len(n.Consensus.ReceivedVotes))

    // Подсчитываем онлайн узлы (исключая себя)
    onlineNodes := 0
    for _, node := range n.Network.Nodes {
        if node.IsOnline && node.ID != n.ID {
            onlineNodes++
        }
    }

    if onlineNodes == 0 {
        return
    }

    yesCount := 0
    for _, vote := range n.Consensus.ReceivedVotes {
        if vote == "YES" {
            yesCount++
        }
    }

    fmt.Printf("[VOTE STATS] Да: %d, Всего онлайн узлов (без лидера): %d\n", 
        yesCount, onlineNodes)

    // Проверяем, есть ли у нас большинство среди онлайн-узлов
    if yesCount > onlineNodes/2 {
        fmt.Printf("[CONSENSUS ACHIEVED] Большинство достигнуто!\n")
        
        n.Consensus.Phase = "DECIDED"
        n.Consensus.Decision = n.Consensus.ProposedValue

        // Рассылаем решение всем
        n.broadcast(Message{
            From:  n.ID,
            To:    "broadcast",
            Type:  "DECISION",
            Value: n.Consensus.Decision,
            Round: n.Consensus.CurrentRound,
            TTL:   5,
        })

        // Отправляем событие
        n.Network.MessageBus <- BroadcastMessage{
            Type: "consensus",
            Data: fmt.Sprintf("КОНСЕНСУС ДОСТИГНУТ! Решение: %v", n.Consensus.Decision),
        }

        // Обновляем свое состояние
        n.Network.MessageBus <- BroadcastMessage{
            Type: "nodeUpdate",
            Data: NodeUpdate{
                NodeID:   n.ID,
                Phase:    n.Consensus.Phase,
                Decision: n.Consensus.Decision,
                Online:   n.IsOnline,
                IsLeader: n.Consensus.IsLeader,
            },
        }
    }
}

// Обработка финального решения
func (n *Node) handleDecision(msg Message) {
	n.Consensus.Phase = "DECIDED"
	n.Consensus.Decision = msg.Value
	n.Consensus.CurrentRound = msg.Round

	// Обновляем состояние для визуализации
	n.Network.MessageBus <- BroadcastMessage{
		Type: "nodeUpdate",
		Data: NodeUpdate{
			NodeID:   n.ID,
			Phase:    n.Consensus.Phase,
			Decision: n.Consensus.Decision,
			Online:   n.IsOnline,
			IsLeader: n.Consensus.IsLeader,
		},
	}
}

// Отправка сообщения конкретному узлу
func (n *Node) sendMessage(msg Message) {
	fmt.Printf("[SEND] %s -> %s: тип=%s, TTL=%d\n", 
        n.ID, msg.To, msg.Type, msg.TTL)

	if msg.To == "broadcast" {
		n.broadcast(msg)
		return
	}

	// Ищем получателя среди пиров
	peer, exists := n.Peers[msg.To]
	if !exists {
		// Если нет среди пиров, ищем в сети
		peer, exists = n.Network.Nodes[msg.To]
		if !exists {
			return
		}
	}

	if peer.IsOnline {
		// Имитация задержки отправки
		time.Sleep(time.Duration(randomInt(50)) * time.Millisecond)

		// Отправляем событие для визуализации
		n.Network.MessageBus <- BroadcastMessage{
			Type: "message",
			Data: fmt.Sprintf("Узел %s отправил сообщение узлу %s: тип=%s",
				n.ID, peer.ID, msg.Type),
		}

		// Отправляем сообщение
		peer.MessageQueue <- msg
	}
}

func (n *Node) broadcast(msg Message) {
    fmt.Printf("[BROADCAST] %s рассылает %s своим соседям\n", n.ID, msg.Type)
    
    // Рассылаем только непосредственным соседям
    for _, peer := range n.Peers {
        if peer.ID != n.ID && peer.IsOnline {
            fmt.Printf("[BROADCAST] %s -> %s\n", n.ID, peer.ID)
            
            // Создаем сообщение для соседа
            peerMsg := Message{
                From:  msg.From,
                To:    peer.ID,
                Type:  msg.Type,
                Value: msg.Value,
                Round: msg.Round,
                TTL:   5, // Time To Live - максимальное число хопов
            }
            
            n.sendMessage(peerMsg)
        }
    }
}

// Соединение с другим узлом
func (n *Node) ConnectTo(peer *Node) {
	if n.ID == peer.ID {
		return
	}

	// Проверяем, нет ли уже такого соединения
	if _, exists := n.Peers[peer.ID]; exists {
		return
	}

	n.Peers[peer.ID] = peer
	peer.Peers[n.ID] = n // Взаимное соединение

	n.Network.MessageBus <- BroadcastMessage{
		Type: "connection",
		Data: fmt.Sprintf("Узел %s соединен с узлом %s", n.ID, peer.ID),
	}
}

// Начать предложение (для лидера)
func (n *Node) Propose(value interface{}) {
	if !n.Consensus.IsLeader {
		return
	}

	n.Consensus.Phase = "VOTE"
	n.Consensus.ProposedValue = value
	n.Consensus.CurrentRound++
	n.Consensus.ReceivedVotes = make(map[string]string) // Сбрасываем голоса

	// Рассылаем предложение всем пирам
	n.broadcast(Message{
		From:  n.ID,
		To:    "broadcast",
		Type:  "PROPOSE",
		Value: value,
		Round: n.Consensus.CurrentRound,
	})

	n.Network.MessageBus <- BroadcastMessage{
		Type: "consensus",
		Data: fmt.Sprintf("Лидер %s предложил значение: %v", n.ID, value),
	}
}

// Вспомогательная функция для случайных чисел
func randomInt(max int) int {
	return int(time.Now().UnixNano() % int64(max))
}
