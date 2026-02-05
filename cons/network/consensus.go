package network

type Message struct {
	From  string
	To    string
	Type  string // "PROPOSE", "VOTE", "DECISION"
	Value interface{}
	Round int
	TTL   int    // Time To Live
}

// Сообщение для широковещательной рассылки
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

type ConsensusState struct {
	CurrentRound  int
	ProposedValue interface{}
	ReceivedVotes map[string]string // ID узла -> его голос ("YES"/"NO")
	Phase         string            // "IDLE", "PROPOSE", "VOTE", "DECIDED"
	Decision      interface{}       // Финальное решение
	IsLeader      bool
}

func NewConsensusState() *ConsensusState {
	return &ConsensusState{
		CurrentRound:  0,
		ProposedValue: nil,
		ReceivedVotes: make(map[string]string),
		Phase:         "IDLE",
		Decision:      nil,
		IsLeader:      false,
	}
}
