class ConsensusVisualizer {
    constructor(simulator) {
        this.simulator = simulator;
        this.phaseTimers = {};
        this.stepAnimations = {};
        this.currentRound = 0;
        this.consensusSteps = [
            'PROPOSE',
            'VOTE',
            'DECIDED'
        ];
        
        this.initVisualizations();
    }
    
    initVisualizations() {
        // Создаем контейнер для визуализации этапов
        this.createPhaseVisualization();
        this.createStepByStepGuide();
    }
    
    createPhaseVisualization() {
        const container = document.querySelector('.visualization-panel');
        
        // Добавляем панель прогресса консенсуса
        const consensusPanel = document.createElement('div');
        consensusPanel.className = 'consensus-progress-panel';
        consensusPanel.innerHTML = `
            <h3><i class="fas fa-project-diagram"></i> Consensus Progress</h3>
            <div class="phase-track">
                <div class="phase-step" data-phase="propose">
                    <div class="phase-icon">1</div>
                    <div class="phase-label">Propose</div>
                    <div class="phase-status"></div>
                </div>
                <div class="phase-connector"></div>
                <div class="phase-step" data-phase="vote">
                    <div class="phase-icon">2</div>
                    <div class="phase-label">Vote</div>
                    <div class="phase-status"></div>
                </div>
                <div class="phase-connector"></div>
                <div class="phase-step" data-phase="decided">
                    <div class="phase-icon">3</div>
                    <div class="phase-label">Decide</div>
                    <div class="phase-status"></div>
                </div>
            </div>
            <div class="consensus-timer">
                <i class="fas fa-clock"></i>
                <span>Round Time: <span id="consensusTimer">00:00</span></span>
            </div>
        `;
        
        container.appendChild(consensusPanel);
        this.addStyles();
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .consensus-progress-panel {
                background: rgba(25, 25, 35, 0.9);
                border-radius: 12px;
                padding: 15px;
                margin-top: 15px;
                border: 1px solid #2a2a3a;
            }
            
            .phase-track {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin: 20px 0;
            }
            
            .phase-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
            }
            
            .phase-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #374151;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                margin-bottom: 8px;
                border: 3px solid transparent;
                transition: all 0.3s ease;
            }
            
            .phase-step.active .phase-icon {
                background: #3b82f6;
                border-color: #60a5fa;
                box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
                animation: pulse 2s infinite;
            }
            
            .phase-step.completed .phase-icon {
                background: #10b981;
                border-color: #34d399;
            }
            
            .phase-label {
                font-size: 0.9rem;
                color: #94a3b8;
                margin-bottom: 5px;
            }
            
            .phase-status {
                font-size: 0.8rem;
                color: #6b7280;
                min-height: 20px;
            }
            
            .phase-connector {
                flex: 1;
                height: 3px;
                background: #374151;
                margin: 0 10px;
            }
            
            .phase-connector.active {
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
            }
            
            .consensus-timer {
                text-align: center;
                padding: 10px;
                background: rgba(15, 23, 42, 0.5);
                border-radius: 8px;
                border: 1px solid #334155;
            }
            
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
            }
            
            .message-flow {
                position: absolute;
                height: 2px;
                background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                z-index: 100;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    visualizeConsensusStart(leaderId, proposal) {
        this.currentRound++;
        this.resetPhaseVisualization();
        
        // Анимируем лидера
        this.highlightLeader(leaderId);
        
        // Запускаем таймер раунда
        this.startConsensusTimer();
        
        // Показываем шаг 1: Предложение
        this.updatePhase('propose', 'active', `Leader ${leaderId} proposes: ${proposal}`);
        
        // Визуализируем рассылку предложения
        this.visualizeProposalBroadcast(leaderId, proposal);
    }
    
    visualizeProposalBroadcast(leaderId, proposal) {
        const leaderNode = this.simulator.network.body.nodes[leaderId];
        if (!leaderNode) return;
        
        // Находим все онлайн узлы кроме лидера
        const onlineNodes = Object.entries(this.simulator.nodes)
            .filter(([id, node]) => id !== leaderId && node.online)
            .map(([id]) => id);
        
        // Создаем анимацию рассылки
        onlineNodes.forEach(nodeId => {
            this.createMessageFlow(leaderId, nodeId, '#3b82f6', 'PROPOSE');
        });
        
        // Через 1.5 секунды переходим к голосованию
        setTimeout(() => {
            this.updatePhase('propose', 'completed', 'All nodes received proposal');
            this.updatePhase('vote', 'active', 'Nodes are voting...');
            
            // Визуализируем голосование
            this.visualizeVoting(leaderId);
        }, 1500);
    }
    
    visualizeVoting(leaderId) {
        const onlineNodes = Object.entries(this.simulator.nodes)
            .filter(([id, node]) => id !== leaderId && node.online)
            .map(([id]) => id);
        
        // Анимируем отправку голосов лидеру
        onlineNodes.forEach(nodeId => {
            // Задержка для реалистичности
            setTimeout(() => {
                this.createMessageFlow(nodeId, leaderId, '#8b5cf6', 'VOTE');
            }, Math.random() * 1000 + 500);
        });
        
        // Через 2 секунды переходим к решению
        setTimeout(() => {
            this.updatePhase('vote', 'completed', 'All votes received');
            this.updatePhase('decided', 'active', 'Leader making decision...');
            
            // Визуализируем рассылку решения
            setTimeout(() => {
                this.visualizeDecisionBroadcast(leaderId);
            }, 1000);
        }, 2000);
    }
    
    visualizeDecisionBroadcast(leaderId) {
        const onlineNodes = Object.entries(this.simulator.nodes)
            .filter(([id, node]) => id !== leaderId && node.online)
            .map(([id]) => id);
        
        // Рассылаем решение всем узлам
        onlineNodes.forEach(nodeId => {
            this.createMessageFlow(leaderId, nodeId, '#10b981', 'DECISION');
        });
        
        // Завершаем раунд
        setTimeout(() => {
            this.updatePhase('decided', 'completed', 'Consensus achieved!');
            this.completeConsensusRound();
        }, 1500);
    }
    
    createMessageFlow(fromNodeId, toNodeId, color, type) {
        const fromNode = this.simulator.network.body.nodes[fromNodeId];
        const toNode = this.simulator.network.body.nodes[toNodeId];
        
        if (!fromNode || !toNode) return;
        
        // Создаем временную линию
        const canvas = document.getElementById('networkCanvas');
        const rect = canvas.getBoundingClientRect();
        
        const fromPos = fromNode.getPosition();
        const toPos = toNode.getPosition();
        
        const flowLine = document.createElement('div');
        flowLine.className = 'message-flow';
        flowLine.style.cssText = `
            left: ${fromPos.x}px;
            top: ${fromPos.y}px;
            width: 0;
            background: ${color};
            transform-origin: left center;
        `;
        
        canvas.appendChild(flowLine);
        
        // Анимация движения
        const distance = Math.sqrt(
            Math.pow(toPos.x - fromPos.x, 2) + 
            Math.pow(toPos.y - fromPos.y, 2)
        );
        
        const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
        
        flowLine.style.transform = `rotate(${angle}rad)`;
        flowLine.style.width = `${distance}px`;
        
        // Подсвечиваем принимающий узел
        this.highlightNodeBriefly(toNodeId, color);
        
        // Удаляем через 1 секунду
        setTimeout(() => {
            flowLine.remove();
        }, 1000);
    }
    
    highlightNodeBriefly(nodeId, color) {
        const node = this.simulator.network.body.nodes[nodeId];
        if (!node) return;
        
        const originalColor = node.options.color;
        node.setOptions({ color: color });
        
        setTimeout(() => {
            node.setOptions({ 
                color: this.simulator.getNodeColor(this.simulator.nodes[nodeId]) 
            });
        }, 500);
    }
    
    highlightLeader(leaderId) {
        const leaderNode = this.simulator.network.body.nodes[leaderId];
        if (leaderNode) {
            let pulseCount = 0;
            const pulseInterval = setInterval(() => {
                const currentColor = this.simulator.getNodeColor(this.simulator.nodes[leaderId]);
                const leaderColor = {
                    background: '#f59e0b',
                    border: '#d97706'
                };
                
                leaderNode.setOptions({
                    color: pulseCount % 2 === 0 ? leaderColor : currentColor,
                    size: pulseCount % 2 === 0 ? 45 : 40
                });
                
                pulseCount++;
                if (pulseCount > 6) {
                    clearInterval(pulseInterval);
                    leaderNode.setOptions({ 
                        color: currentColor,
                        size: 40 
                    });
                }
            }, 300);
        }
    }
    
    updatePhase(phase, status, message) {
        const phaseElement = document.querySelector(`.phase-step[data-phase="${phase}"]`);
        if (phaseElement) {
            phaseElement.className = `phase-step ${status}`;
            const statusElement = phaseElement.querySelector('.phase-status');
            if (statusElement) {
                statusElement.textContent = message;
            }
            
            // Обновляем коннекторы
            this.updateConnectors();
        }
    }
    
    updateConnectors() {
        const connectors = document.querySelectorAll('.phase-connector');
        const steps = document.querySelectorAll('.phase-step');
        
        connectors.forEach((connector, index) => {
            const prevStep = steps[index];
            const nextStep = steps[index + 1];
            
            if (prevStep && nextStep) {
                if (prevStep.classList.contains('completed') && 
                    nextStep.classList.contains('active')) {
                    connector.classList.add('active');
                } else {
                    connector.classList.remove('active');
                }
            }
        });
    }
    
    startConsensusTimer() {
        let seconds = 0;
        const timerElement = document.getElementById('consensusTimer');
        
        if (this.consensusTimer) {
            clearInterval(this.consensusTimer);
        }
        
        this.consensusTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    completeConsensusRound() {
        if (this.consensusTimer) {
            clearInterval(this.consensusTimer);
        }
        
        // Празднуем достижение консенсуса
        this.celebrateConsensus();
    }
    
    celebrateConsensus() {
        // Анимация для всех узлов
        Object.keys(this.simulator.nodes).forEach(nodeId => {
            const node = this.simulator.network.body.nodes[nodeId];
            if (node) {
                let blinkCount = 0;
                const blinkInterval = setInterval(() => {
                    const successColor = {
                        background: '#10b981',
                        border: '#059669'
                    };
                    const currentColor = this.simulator.getNodeColor(this.simulator.nodes[nodeId]);
                    
                    node.setOptions({
                        color: blinkCount % 2 === 0 ? successColor : currentColor
                    });
                    
                    blinkCount++;
                    if (blinkCount > 8) {
                        clearInterval(blinkInterval);
                        node.setOptions({ color: currentColor });
                    }
                }, 200);
            }
        });
        
        // Показываем уведомление
        this.simulator.showNotification(
            'Consensus achieved! All nodes agreed on the proposed value.',
            'success'
        );
    }
    
    resetPhaseVisualization() {
        const steps = document.querySelectorAll('.phase-step');
        steps.forEach(step => {
            step.className = 'phase-step';
            const statusElement = step.querySelector('.phase-status');
            if (statusElement) {
                statusElement.textContent = '';
            }
        });
        
        const connectors = document.querySelectorAll('.phase-connector');
        connectors.forEach(connector => {
            connector.classList.remove('active');
        });
        
        const timerElement = document.getElementById('consensusTimer');
        if (timerElement) {
            timerElement.textContent = '00:00';
        }
    }
}
