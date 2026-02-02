package network

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
