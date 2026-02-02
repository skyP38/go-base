package network

type Message struct {
	From  string
	To    string // или "broadcast"
	Type  string // "PROPOSE", "VOTE", "DECISION"
	Value interface{}
	Round int
}

// Сообщение для широковещательной рассылки (для визуализации)
type BroadcastMessage struct {
	Type string      // "message", "nodeUpdate", "connection", "consensus"
	Data interface{} // Данные любого типа
}

// Структура для обновления состояния узла
type NodeUpdate struct {
	NodeID   string
	Phase    string
	Decision interface{}
	Online   bool
	IsLeader bool
}
