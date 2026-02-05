package network

import (
	"fmt"
	"math/rand"
	"sort"
)

type Network struct {
	Nodes          map[string]*Node      // Все узлы в сети
	MessageBus     chan BroadcastMessage // Общий канал для наблюдения за сообщениями
	AddNodeChan    chan *Node            // Канал для добавления узлов
	DelNodeChan    chan string           // Канал для удаления узлов (по ID)
	StopChan       chan struct{}         // Канал для остановки сети
	NodeAdded      chan string
}

// Создать сеть
func NewNetwork() *Network {
	network := &Network{
		Nodes:       make(map[string]*Node),
		MessageBus:  make(chan BroadcastMessage, 1000), 
		AddNodeChan: make(chan *Node, 10),
		DelNodeChan: make(chan string, 10),
		StopChan:    make(chan struct{}),
		NodeAdded:   make(chan string, 10),
	}

	// Запускаем обработчик событий сети
	go network.eventHandler()

	return network
}

// Обработчик событий сети
func (n *Network) eventHandler() {
	for {
		select {
		case node := <-n.AddNodeChan:
			n.addNodeInternal(node)
		case nodeID := <-n.DelNodeChan:
			n.removeNodeInternal(nodeID)
		case <-n.StopChan:
			return
		}
	}
}

// Создать и добавить узел в сеть.
func (n *Network) AddNode(nodeID string) error {
	if _, ok := n.Nodes[nodeID]; ok {
		return fmt.Errorf("узел %s уже существует", nodeID)
	}

	node := NewNode(nodeID, n)
	n.AddNodeChan <- node

	return nil
}

// Внутренний метод добавления узла
func (n *Network) addNodeInternal(node *Node) {
	n.Nodes[node.ID] = node
	node.Start()

	n.NodeAdded <- node.ID

	// Отправляем полную информацию о новом узле
	nodeData := map[string]interface{}{
		"id":       node.ID,
		"online":   node.IsOnline,
		"phase":    node.Consensus.Phase,
		"decision": node.Consensus.Decision,
		"peers":    len(node.Peers),
		"isLeader": node.Consensus.IsLeader,
	}

	n.MessageBus <- BroadcastMessage{
		Type: "nodeAdded",
		Data: nodeData,
	}
}

// Отключить и удалить узел.
func (n *Network) RemoveNode(nodeID string) error {
	if _, ok := n.Nodes[nodeID]; !ok {
		return fmt.Errorf("узел %s не найден", nodeID)
	}

	n.DelNodeChan <- nodeID
	return nil
}

// Внутренний метод удаления узла
func (n *Network) removeNodeInternal(nodeID string) {
	node, exists := n.Nodes[nodeID]
	if !exists {
		return
	}

	// Останавливаем узел
	node.Stop()

	// Удаляем соединения с другими узлами
	for _, peer := range node.Peers {
		delete(peer.Peers, nodeID)
		// Отправляем событие об удалении соединения
		n.MessageBus <- BroadcastMessage{
			Type: "connection",
			Data: fmt.Sprintf("Соединение %s ↔ %s разорвано", nodeID, peer.ID),
		}
	}

	// Удаляем узел из сети
	delete(n.Nodes, nodeID)

	// Отправляем событие удаления узла
	n.MessageBus <- BroadcastMessage{
		Type: "nodeRemoved",
		Data: nodeID,
	}

	// Отправляем событие
	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: fmt.Sprintf("Узел %s удален из сети", nodeID),
	}
}

// Соединить два узла
func (n *Network) ConnectNodes(nodeID1, nodeID2 string) error {
	node1, exists1 := n.Nodes[nodeID1]
	node2, exists2 := n.Nodes[nodeID2]

	if !exists1 || !exists2 {
		return fmt.Errorf("один из узлов не найден")
	}

	node1.ConnectTo(node2)
	return nil
}

// Начать раунд консенсуса
func (n *Network) StartConsensusRound(proposedValue interface{}) error {
	fmt.Printf("StartConsensusRound called with value: %v\n", proposedValue)
	if len(n.Nodes) == 0 {
		return fmt.Errorf("в сети нет узлов")
	}

	fmt.Printf("Total nodes in network: %d\n", len(n.Nodes))

	// Выбираем лидера (первый узел в отсортированном списке)
	var leader *Node
	nodeIDs := make([]string, 0, len(n.Nodes))
	for id := range n.Nodes {
		nodeIDs = append(nodeIDs, id)
	}
	sort.Strings(nodeIDs)

	for _, id := range nodeIDs {
		if node, exists := n.Nodes[id]; exists && node.IsOnline {
			leader = node
			fmt.Printf("Selected leader: %s\n", leader.ID)
			break
		}
	}

	if leader == nil {
		return fmt.Errorf("нет активных узлов")
	}

	// Устанавливаем лидера
    for _, node := range n.Nodes {
        node.Consensus.IsLeader = (node.ID == leader.ID)
        node.Consensus.CurrentRound++
        node.Consensus.ReceivedVotes = make(map[string]string)
        node.Consensus.Phase = "IDLE"
        
        // Отправляем обновление состояния
        n.MessageBus <- BroadcastMessage{
            Type: "nodeUpdate",
            Data: NodeUpdate{
                NodeID:   node.ID,
                Phase:    node.Consensus.Phase,
                Decision: node.Consensus.Decision,
                Online:   node.IsOnline,
                IsLeader: node.Consensus.IsLeader,
            },
        }
    }
    
    // Устанавливаем фазу PROPOSE только для лидера
    leader.Consensus.Phase = "PROPOSE"
    leader.Consensus.ProposedValue = proposedValue

	// Сбрасываем состояние консенсуса у всех узлов
	for _, node := range n.Nodes {
		node.Consensus = NewConsensusState()
		node.Consensus.IsLeader = (node.ID == leader.ID)

		// Отправляем обновление состояния для каждого узла
		n.MessageBus <- BroadcastMessage{
			Type: "nodeUpdate",
			Data: NodeUpdate{
				NodeID:   node.ID,
				Phase:    node.Consensus.Phase,
				Decision: node.Consensus.Decision,
				Online:   node.IsOnline,
			},
		}
	}

	// Отправляем событие
	n.MessageBus <- BroadcastMessage{
		Type: "consensus",
		Data: fmt.Sprintf("Начинается раунд консенсуса. Лидер: %s. Предложение: %v",
			leader.ID, proposedValue),
	}

	fmt.Printf("Calling leader.Propose()\n")
	// Запускаем предложение
	leader.Propose(proposedValue)

	return nil
}

// Получить состояние всех узлов
func (n *Network) GetNetworkState() map[string]interface{} {
	state := make(map[string]interface{})

	for id, node := range n.Nodes {
		nodeState := map[string]interface{}{
			"id":       node.ID,
			"online":   node.IsOnline,
			"phase":    node.Consensus.Phase,
			"decision": node.Consensus.Decision,
			"peers":    len(node.Peers),
			"isLeader": node.Consensus.IsLeader,
		}
		state[id] = nodeState
	}

	return state
}

// Остановить сеть
func (n *Network) Stop() {
	close(n.StopChan)

	// Останавливаем все узлы
	for _, node := range n.Nodes {
		node.Stop()
	}
}

// Создать полную сеть (каждый с каждым)
func (n *Network) CreateFullMesh() {
	nodeIDs := make([]string, 0, len(n.Nodes))
	for id := range n.Nodes {
		nodeIDs = append(nodeIDs, id)
	}

	// Очищаем все существующие соединения
	for _, node := range n.Nodes {
		node.Peers = make(map[string]*Node)
	}

	for i := 0; i < len(nodeIDs); i++ {
		for j := i + 1; j < len(nodeIDs); j++ {
			n.ConnectNodes(nodeIDs[i], nodeIDs[j])
		}
	}

	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: "Created full mesh network topology",
	}
}

// Создать кольцевую топологию
func (n *Network) CreateRingTopology() {
	nodeIDs := make([]string, 0, len(n.Nodes))
	for id := range n.Nodes {
		nodeIDs = append(nodeIDs, id)
	}

	if len(nodeIDs) < 2 {
		return
	}

	// Сортируем узлы по алфавиту
	sort.Strings(nodeIDs)

	// Очищаем все существующие соединения
	for _, node := range n.Nodes {
		node.Peers = make(map[string]*Node)
	}

	// Соединяем узлы в кольцо
	for i := 0; i < len(nodeIDs); i++ {
		next := (i + 1) % len(nodeIDs)
		n.ConnectNodes(nodeIDs[i], nodeIDs[next])
	}

	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: "Created ring network topology",
	}
}

// Отключить все соединения
func (n *Network) DisconnectAll() {
	for _, node := range n.Nodes {
		node.Peers = make(map[string]*Node)
	}

	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: "All connections removed",
	}

	// Отправляем событие с обновленными соединениями
	connections := n.GetAllConnectionsForFrontend()
	n.MessageBus <- BroadcastMessage{
		Type: "connectionsUpdate",
		Data: connections,
	}
}

// Сбросить состояние консенсуса
func (n *Network) ResetConsensusState() {
	for _, node := range n.Nodes {
		node.Consensus = NewConsensusState()

		// Отправляем обновление состояния
		n.MessageBus <- BroadcastMessage{
			Type: "nodeUpdate",
			Data: NodeUpdate{
				NodeID:   node.ID,
				Phase:    node.Consensus.Phase,
				Decision: node.Consensus.Decision,
				Online:   node.IsOnline,
				IsLeader: node.Consensus.IsLeader,
			},
		}
	}

	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: "Consensus state reset",
	}

	// Отправляем обновление соединений
	connections := n.GetAllConnectionsForFrontend()
	n.MessageBus <- BroadcastMessage{
		Type: "connectionsUpdate",
		Data: connections,
	}
}

// Симулировать случайный сбой
func (n *Network) SimulateRandomFailure() {
	if len(n.Nodes) == 0 {
		return
	}

	// Собираем все онлайн узлы
	onlineNodes := make([]*Node, 0)
	for _, node := range n.Nodes {
		if node.IsOnline {
			onlineNodes = append(onlineNodes, node)
		}
	}

	if len(onlineNodes) == 0 {
		return
	}

	// Выбираем случайный онлайн узел
	randomNode := onlineNodes[rand.Intn(len(onlineNodes))]

	// Сохраняем предыдущее состояние
	wasOnline := randomNode.IsOnline
	randomNode.IsOnline = !randomNode.IsOnline

	// Обновляем обработку сообщений
	if randomNode.IsOnline {
		// Запускаем обработку сообщений
		go randomNode.processMessages()
	} else {
		// Останавливаем через канал StopChan
		close(randomNode.StopChan)
		randomNode.StopChan = make(chan struct{})
	}

	// Отправляем обновление состояния
	n.MessageBus <- BroadcastMessage{
		Type: "nodeUpdate",
		Data: NodeUpdate{
			NodeID:   randomNode.ID,
			Phase:    randomNode.Consensus.Phase,
			Decision: randomNode.Consensus.Decision,
			Online:   randomNode.IsOnline,
			IsLeader: randomNode.Consensus.IsLeader,
		},
	}

	// Не удаляем связи, только обновляем их стиль
	connections := n.GetAllConnectionsForFrontend()
	n.MessageBus <- BroadcastMessage{
		Type: "connectionsUpdate",
		Data: connections,
	}

	// Отправляем соответствующее сообщение
	status := "online"
	if !randomNode.IsOnline {
		status = "offline"
	}

	n.MessageBus <- BroadcastMessage{
		Type: "system",
		Data: fmt.Sprintf("Node %s is now %s (was %t)",
			randomNode.ID, status, wasOnline),
	}
}

// Получить все соединения для фронтенда
func (n *Network) GetAllConnectionsForFrontend() []map[string]interface{} {
	connections := []map[string]interface{}{}
	added := make(map[string]bool)

	for _, node := range n.Nodes {
		for peerID := range node.Peers {
			// Создаем уникальный идентификатор для связи (упорядоченный)
			edgeID := ""
			if node.ID < peerID {
				edgeID = node.ID + "-" + peerID
			} else {
				edgeID = peerID + "-" + node.ID
			}

			if !added[edgeID] {
				// Проверяем, что оба узла существуют в сети
				peer, exists := n.Nodes[peerID]
				if exists {
					dashes := !node.IsOnline || !peer.IsOnline

					connections = append(connections, map[string]interface{}{
						"id":     edgeID,
						"from":   node.ID,
						"to":     peerID,
						"dashes": dashes,
						// Связь пунктирная, если хотя бы один узел офлайн
						"fromOnline": node.IsOnline,
						"toOnline":   peer.IsOnline,
					})
					added[edgeID] = true
				}
			}
		}
	}

	fmt.Printf("Total connections found: %d\n", len(connections))
	return connections
}
