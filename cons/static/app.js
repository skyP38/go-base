class ConsensusSimulator {
    constructor() {
        this.ws = null;
        this.network = null;
        this.nodes = {};
        this.edges = {};
        this.uptime = 0;
        this.roundsCompleted = 0;
        this.logsPaused = false;
        this.selectedNodeId = null;
        this.connected = false;
        
        this.initializeWebSocket();
        this.initializeNetwork();
        this.initializeEventListeners();
        this.startUptimeCounter();
        this.addLog('System initialized. Connecting to WebSocket...', 'system');
    }

    getEdgeId(node1, node2) {
        return node1 < node2 ? `${node1}-${node2}` : `${node2}-${node1}`;
    }


    clearAllEdges() {
        console.log("Clearing all edges");
        
        // Очищаем локальный словарь связей
        this.edges = {};
        
        // Очищаем визуальные связи
        const edges = this.network.body.data.edges;
        edges.clear();
        
        this.updateNetworkStats();
    }

    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.connected = true;
            this.addLog('WebSocket connection established', 'system');
        };
        
        this.ws.onclose = () => {
            this.connected = false;
            this.addLog('WebSocket connection lost. Reconnecting in 3 seconds...', 'system');
            
            setTimeout(() => {
                this.initializeWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            this.addLog(`WebSocket error: ${error}`, 'system');
        };
        
        this.ws.onmessage = (event) => {
            this.handleWebSocketMessage(event.data);
        };
    }

    initializeNetwork() {
        const container = document.getElementById('networkCanvas');
        
        const options = {
            nodes: {
                shape: 'dot',
                size: 30,
                font: {
                    size: 14,
                    color: '#ffffff',
                    strokeWidth: 0
                },
                borderWidth: 2,
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.5)',
                    size: 10,
                    x: 0,
                    y: 0
                }
            },
            edges: {
                width: 2,
                color: {
                    color: '#4b5563',
                    highlight: '#3b82f6'
                },
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                arrows: {
                    to: {
                        enabled: false
                    }
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.3)',
                    size: 3
                }
            },
            physics: {
                enabled: true,
                stabilization: {
                    iterations: 1000
                },
                barnesHut: {
                    gravitationalConstant: -2000,
                    springLength: 150,
                    springConstant: 0.04,
                    damping: 0.09
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: false,
                selectable: true
            }
        };
        
        this.network = new vis.Network(container, {}, options);
        
        // Обработчик клика по узлу
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.showNodeInfo(nodeId);
            }
        });
        
        // Обработчик двойного клика по узлу
        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.toggleNodeOnline(nodeId);
            }
        });
    }

    handleWebSocketMessage(data) {  
        const message = JSON.parse(data);
        console.log("Parsed message:", message);          
        switch (message.type) {
            case 'init':
                this.handleNetworkInit(message.data);
                    break;
                case 'nodeAdded':
                    this.handleNodeAdded(message.data);
                    break;
                case 'nodeUpdate':
                    console.log("Node update:", message.data);
                    this.handleNodeUpdate(message.data);
                    break;
                case 'nodeRemoved':
                    this.handleNodeRemoved(message.data);
                    break;
                case 'message':
                    this.addLog(message.data, 'message');
                    break;
                case 'consensus':
                    this.handleConsensusMessage(message.data);
                    break;
                case 'connection':
                    this.handleConnection(message.data);
                    break;
                case 'system':
                    this.handleSystemMessage(message.data);
                    break;
                case 'networkState':
                    this.updateNetworkState(message.data);
                    break;
                case 'connectionsUpdate': 
                    this.handleConnectionsUpdate(message.data);
                    break;
                case 'error':
                    this.handleError(message.data);
                    break;
            }
    }


    handleConnectionsUpdate(connections) {
        console.log("Updating connections:", connections);
        
        const edges = this.network.body.data.edges;
        
        // Создаем набор текущих связей
        const currentEdges = new Set();
        edges.get().forEach(edge => {
            console.log(`Current edge: ${edge.id} (${edge.from} ↔ ${edge.to})`);
            currentEdges.add(edge.id);
        });
        
        // Создаем набор новых связей
        const newEdges = new Set();
        
        if (Array.isArray(connections)) {
            connections.forEach(connection => {
                const edgeId = connection.id;

                if (!edgeId) {
                    console.warn("Connection missing id:", connection);
                    return;
                }
            
                newEdges.add(edgeId);

                // Получаем информацию о статусе узлов из connection или из локальных данных
                const fromNode = this.nodes[connection.from] || { online: connection.fromOnline || true };
                const toNode = this.nodes[connection.to] || { online: connection.toOnline || true };

                // Используем dashes из connection или вычисляем на основе статуса узлов
                const dashes = connection.dashes !== undefined ? 
                    connection.dashes : (!fromNode.online || !toNode.online);
                
                if (!currentEdges.has(edgeId)) {
                    // Добавляем новую связь
                    edges.add({
                        id: edgeId,
                        from: connection.from,
                        to: connection.to,
                        dashes: dashes,
                        color: dashes ? '#6b7280' : '#4b5563',
                        width: dashes ? 1.5 : 2
                    });

                    console.log("Adding edge:", edgeData);
                    edges.add(edgeData);

                    // Сохраняем в локальном словаре
                    this.edges[edgeId] = {
                        from: connection.from,
                        to: connection.to,
                        dashes: dashes
                    };
                } else {
                    // Обновляем существующую связь
                    edges.update({
                        id: edgeId,
                        dashes: dashes,
                        color: dashes ? '#6b7280' : '#4b5563',
                        width: dashes ? 1.5 : 2
                    });

                    console.log("Updating edge:", edgeData);
                    edges.update(edgeData);

                    // Обновляем локальный словарь
                    if (this.edges[edgeId]) {
                        this.edges[edgeId].dashes = dashes;
                    }
                    
                    console.log(`Updated existing edge: ${edgeId}`);
                }
            });
        }
        
        this.updateNetworkStats();
    }

    handleSystemMessage(message) {
         if (message.includes('is now online') || message.includes('is now offline')) {
            // Не добавляем в лог, чтобы избежать дублирования
            return;
        }
        
        this.addLog(message, 'system');
        
        // Если сообщение о создании топологии или отключении
        if (message.includes('full mesh') || 
            message.includes('ring topology') || 
            message.includes('All connections removed') ||
            message.includes('is now offline') ||
            message.includes('is now online')) {
            
            // Запрашиваем актуальное состояние
            setTimeout(() => {
                this.sendCommand('getState');
            }, 500);
            
            // Если это сообщение о сбое, добавляем визуальный эффект
            if (message.includes('failure') || message.includes('offline') || message.includes('online')) {
                // Найдем все связи с прерывистым стилем и анимируем их
                setTimeout(() => {
                    this.animateFailedConnections();
                }, 300);
            }
        }
    }

    handleConsensusStart(leaderId, proposal) {
        console.log(`Consensus started: Leader=${leaderId}, Proposal=${proposal}`);
        
        // Обновляем UI
        this.updateConsensusUI(leaderId, proposal);
        
        // Визуализируем начало раунда
        this.visualizeConsensusStart(leaderId, proposal);
        
        // Анимируем лидера
        this.animateLeaderProposal(leaderId);
    }

    updateConsensusUI(leaderId, proposal) {
        // Обновляем элементы UI, если они существуют
        const proposalElement = document.getElementById('proposalValue');
        if (proposalElement && proposal) {
            proposalElement.value = proposal;
        }
        
        // Можно добавить временное уведомление
        this.showNotification(`Consensus round started! Leader: ${leaderId}, Proposal: ${proposal}`, 'consensus');
    }

    animateLeaderProposal(leaderId) {
        const leaderNode = this.network.body.nodes[leaderId];
        if (!leaderNode) return;
        
        // Пульсирующая анимация для лидера
        let pulseCount = 0;
        const originalColor = this.getNodeColor(this.nodes[leaderId]);
        const pulseColor = { background: '#fbbf24', border: '#f59e0b' };
        
        const pulseInterval = setInterval(() => {
            leaderNode.setOptions({
                color: pulseCount % 2 === 0 ? pulseColor : originalColor,
                size: pulseCount % 2 === 0 ? 45 : 40
            });
            
            pulseCount++;
            if (pulseCount > 10) {
                clearInterval(pulseInterval);
                leaderNode.setOptions({
                    color: originalColor,
                    size: 40
                });
            }
        }, 400);
        
        // Рассылаем "волны" предложения
        setTimeout(() => {
            this.createProposalRipple(leaderId);
        }, 500);
    }

    createProposalRipple(sourceNodeId) {
        // Находим всех соседей лидера
        const edges = this.network.body.data.edges.get();
        const neighbors = new Set();
        
        edges.forEach(edge => {
            if (edge.from === sourceNodeId) neighbors.add(edge.to);
            if (edge.to === sourceNodeId) neighbors.add(edge.from);
        });
        
        // Анимируем передачу предложения каждому соседу
        neighbors.forEach(neighborId => {
            this.animateMessageFlow(sourceNodeId, neighborId, '#3b82f6', 'proposal');
        });
    }

    animateMessageFlow(fromNodeId, toNodeId, color, messageType = 'message') {
        // Создаем временную линию для анимации сообщения
        const edgeId = `msg-${Date.now()}-${fromNodeId}-${toNodeId}`;
        const edges = this.network.body.data.edges;
        
        // Получаем существующую связь или создаем временную
        const existingEdge = this.getExistingEdge(fromNodeId, toNodeId);
        
        if (existingEdge) {
            // Анимируем существующую связь
            this.animateExistingEdge(existingEdge.id, color);
        } else {
            // Создаем временную связь для анимации
            edges.add({
                id: edgeId,
                from: fromNodeId,
                to: toNodeId,
                color: color,
                width: 4,
                dashes: true,
                smooth: true
            });
            
            // Удаляем через 2 секунды
            setTimeout(() => {
                edges.remove(edgeId);
            }, 2000);
        }
        
        // Обновляем статус получателя
        const toNode = this.nodes[toNodeId];
        if (toNode && messageType === 'proposal') {
            // Временно меняем фазу узла для визуализации
            const originalPhase = toNode.phase;
            toNode.phase = 'PROPOSE';
            
            setTimeout(() => {
                toNode.phase = originalPhase;
                this.updateNodeVisualization(toNodeId, { phase: 'PROPOSE' });
            }, 1000);
        }
    }

    getExistingEdge(fromNodeId, toNodeId) {
        const edges = this.network.body.data.edges.get();
        return edges.find(edge => 
            (edge.from === fromNodeId && edge.to === toNodeId) ||
            (edge.from === toNodeId && edge.to === fromNodeId)
        );
    }

    animateExistingEdge(edgeId, color) {
        const edge = this.network.body.edges[edgeId];
        if (!edge) return;
        
        const originalColor = edge.options.color;
        const originalWidth = edge.options.width;
        
        // Пульсирующая анимация
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
            edge.setOptions({
                color: pulseCount % 2 === 0 ? color : originalColor,
                width: pulseCount % 2 === 0 ? 4 : originalWidth
            });
            
            pulseCount++;
            if (pulseCount > 6) {
                clearInterval(pulseInterval);
                edge.setOptions({
                    color: originalColor,
                    width: originalWidth
                });
            }
        }, 300);
    }

    animateFailedConnections() {
        const edges = this.network.body.data.edges.get();
        
        edges.forEach(edge => {
            if (edge.dashes) {
                const fromNode = this.nodes[edge.from];
                const toNode = this.nodes[edge.to];
                
                if ((fromNode && !fromNode.online) || (toNode && !toNode.online)) {
                    this.animateEdgeFailure(edge.id);
                }
            }
        });
    }

    handleError(errorMessage) {
        this.addLog(`ERROR: ${errorMessage}`, 'system');
        
        // Показываем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${errorMessage}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    handleNetworkInit(networkState) {         
        // Проверяем формат данных
        if (networkState && networkState.nodes && networkState.connections) {
            console.log("Using new format with nodes and connections");
            this.handleNewNetworkInit(networkState);
        } else if (networkState && typeof networkState === 'object' && !networkState.nodes) {
            console.log("Using old format (plain nodes object)");
            this.handleOldNetworkInit(networkState);
        } else {
            console.error("Unknown network state format:", networkState);
            // Инициализируем пустую сеть
            this.nodes = {};
            this.edges = {};
            this.network.setData({ 
                nodes: new vis.DataSet(), 
                edges: new vis.DataSet() 
            });
        }
    }


    handleNewNetworkInit(networkState) {
        const nodesData = networkState.nodes || {};
        const connectionsData = networkState.connections || [];


        this.nodes = nodesData;
        this.edges = {};
        
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();

        console.log("Nodes data:", nodesData);
        console.log("Connections data:", connectionsData);
        
        Object.keys(nodesData).forEach(nodeId => {
            const node = nodesData[nodeId];
            
            nodes.add({
                id: nodeId,
                label: nodeId,
                color: this.getNodeColor(node),
                shape: node.isLeader ? 'star' : 'dot',
                size: node.isLeader ? 40 : 30,
                title: this.getNodeTooltip(node)
            });
            
            // Добавляем связи
            if (Array.isArray(connectionsData)) {
                connectionsData.forEach(connection => {
                    const from = connection.from;
                    const to = connection.to;
                    const edgeId = this.getEdgeId(from, to);
                    
                    if (!this.edges[edgeId]) {
                        // Проверяем, что оба узла существуют
                        if (this.nodes[from] && this.nodes[to]) {
                            edges.add({
                                id: edgeId,
                                from: from,
                                to: to,
                                dashes: !this.nodes[from].online || !this.nodes[to].online,
                            });
                            this.edges[edgeId] = true;
                        }
                    }
                });
            }
        });
        
        this.network.setData({ nodes, edges });
        this.updateNetworkStats();
    }

    handleOldNetworkInit(networkState) {
        this.nodes = networkState || {};
        this.edges = {};
        
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();
        
        Object.keys(this.nodes).forEach(nodeId => {
            const node = this.nodes[nodeId];
            
            nodes.add({
                id: nodeId,
                label: nodeId,
                color: this.getNodeColor(node),
                shape: node.isLeader ? 'star' : 'dot',
                size: node.isLeader ? 40 : 30,
                title: this.getNodeTooltip(node)
            });
        });
        
        // Не создаем автоматических связей в старом формате
        this.network.setData({ nodes, edges });
        this.updateNetworkStats();
    }

    handleNodeAdded(nodeData) {
        // Добавляем узел в локальный список
        this.nodes[nodeData.id] = {
            id: nodeData.id,
            online: nodeData.online,
            phase: nodeData.phase,
            decision: nodeData.decision,
            peers: nodeData.peers,
            isLeader: nodeData.isLeader
        };
        
        // Добавляем узел в визуализацию
        const nodes = this.network.body.data.nodes;
        nodes.add({
            id: nodeData.id,
            label: nodeData.id,
            color: this.getNodeColor(this.nodes[nodeData.id]),
            shape: nodeData.isLeader ? 'star' : 'dot',
            size: nodeData.isLeader ? 40 : 30,
            title: this.getNodeTooltip(this.nodes[nodeData.id])
        });
        
        // Анимируем появление узла
        this.animateNodeAppearance(nodeData.id);
        
        this.addLog(`Node ${nodeData.id} added to network`, 'nodeUpdate');
        this.updateNetworkStats();
    }

    animateNodeAppearance(nodeId) {
        const node = this.network.body.nodes[nodeId];
        if (!node) return;
        
        // Временное увеличение узла для анимации
        node.setOptions({ size: 50 });
        
        setTimeout(() => {
            node.setOptions({ 
                size: this.nodes[nodeId].isLeader ? 40 : 30 
            });
        }, 500);
        
        // Мигание узла
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            const currentColor = this.getNodeColor(this.nodes[nodeId]);
            const blinkColor = {
                background: '#ffffff',
                border: '#3b82f6'
            };
            
            node.setOptions({
                color: blinkCount % 2 === 0 ? blinkColor : currentColor
            });
            
            blinkCount++;
            if (blinkCount > 5) {
                clearInterval(blinkInterval);
                node.setOptions({ color: currentColor });
            }
        }, 200);
    }

    handleNodeRemoved(nodeId) {
        // Удаляем узел из локального списка
        delete this.nodes[nodeId];
        
        // Удаляем узел из визуализации
        const nodes = this.network.body.data.nodes;
        nodes.remove(nodeId);
        
        // Удаляем все связи с этим узлом
        const edges = this.network.body.data.edges;
        const edgesToRemove = [];
        
        edges.get().forEach(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                edgesToRemove.push(edge.id);
                delete this.edges[edge.id];
            }
        });
        
        edges.remove(edgesToRemove);
        
        this.addLog(`Node ${nodeId} removed from network`, 'nodeUpdate');
        this.updateNetworkStats();
    }

    updateNetworkStats() {
        const activeNodes = Object.values(this.nodes).filter(node => node.online).length;
        const totalNodes = Object.keys(this.nodes).length;
        const totalEdges = Object.keys(this.edges).length;
        
        document.getElementById('nodeCount').textContent = `Nodes: ${totalNodes}`;
        document.getElementById('activeNodesCount').textContent = activeNodes;
        document.getElementById('connectionsCount').textContent = totalEdges;
        
        // Подсчитываем голоса для текущего раунда
        let yesVotes = 0;
        let noVotes = 0;
        let currentDecision = 'None';
        
        Object.values(this.nodes).forEach(node => {
            // Находим решение
            if (node.phase === 'DECIDED' && node.decision) {
                currentDecision = node.decision;
            }
            
            // Подсчитываем голоса из consensus state
            if (node.Consensus && node.Consensus.ReceivedVotes) {
                Object.values(node.Consensus.ReceivedVotes).forEach(vote => {
                    if (vote === 'YES') yesVotes++;
                    if (vote === 'NO') noVotes++;
                });
            }
        });
        
        // Обновляем фазовые счетчики
        const phaseCounts = { IDLE: 0, PROPOSE: 0, VOTE: 0, DECIDED: 0 };
        Object.values(this.nodes).forEach(node => {
            const phase = node.phase || 'IDLE';
            phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
        });

        // Обновляем прогресс-бары консенсуса
        this.updateConsensusProgress(phaseCounts, totalNodes);
    }

    handleConnection(message) {
        console.log("Connection message:", message); // Для отладки
        
        if (typeof message === 'string') {
            this.addLog(message, 'connection');
            
            // Пытаемся извлечь информацию о соединении из сообщения
            const connectionPatterns = [
                /Узел (\S+) соединен с узлом (\S+)/,
                /Node (\S+) connected to Node (\S+)/,
                /Connection: (\S+) ↔ (\S+)/
            ];
            
            let node1 = null, node2 = null;
            
            for (const pattern of connectionPatterns) {
                const match = message.match(pattern);
                if (match && match.length >= 3) {
                    node1 = match[1];
                    node2 = match[2];
                    break;
                }
            }
            
            if (node1 && node2) {
                console.log(`Creating connection: ${node1} ↔ ${node2}`);
                this.addEdge(node1, node2);
            }
        } else if (typeof message === 'object') {
            // Если сообщение уже является объектом с данными о соединении
            if (message.from && message.to) {
                console.log(`Creating connection from object: ${message.from} ↔ ${message.to}`);
                this.addEdge(message.from, message.to);
            }
        }
    }

    addEdge(node1, node2) {
        if (!this.nodes[node1] || !this.nodes[node2]) {
            console.warn(`Cannot create edge: nodes ${node1} or ${node2} not found`);
            return;
        }
        
        const edgeId = this.getEdgeId(node1, node2);
        
        // Проверяем, нет ли уже такой связи
        if (this.edgeExists(node1, node2)) {
            console.log(`Edge ${edgeId} already exists`);
            return;
        }
        
        // Определяем стиль связи
        const node1Online = this.nodes[node1].online;
        const node2Online = this.nodes[node2].online;
        const dashes = !node1Online || !node2Online;
        
        // Добавляем связь
        const edges = this.network.body.data.edges;
        edges.add({
            id: edgeId,
            from: node1,
            to: node2,
            dashes: dashes,
            color: dashes ? '#6b7280' : '#4b5563',
            width: dashes ? 1.5 : 2
        });
        
        this.edges[edgeId] = true;
        this.updateNetworkStats();
        
        // Анимируем создание связи
        this.animateEdgeCreation(edgeId);
    }

    edgeExists(node1, node2) {
        const edgeId = this.getEdgeId(node1, node2);
        return this.edges[edgeId] === true;
    }

    animateEdgeCreation(edgeId) {
        const edge = this.network.body.edges[edgeId];
        if (!edge) return;
        
        // Мигание связи
        let blinkCount = 0;
        const originalColor = edge.options.color;
        const blinkColor = '#3b82f6';
        
        const blinkInterval = setInterval(() => {
            edge.setOptions({
                color: blinkCount % 2 === 0 ? blinkColor : originalColor,
                width: blinkCount % 2 === 0 ? 4 : 2
            });
            
            blinkCount++;
            if (blinkCount > 5) {
                clearInterval(blinkInterval);
                edge.setOptions({ 
                    color: originalColor,
                    width: 2 
                });
            }
        }, 300);
    }


    handleNodeUpdate(nodeUpdate) {
        console.log("Node update received:", nodeUpdate);
        
        // Обрабатываем оба формата
       let nodeId, phase, decision, online, isLeader;
    
        if (nodeUpdate && nodeUpdate.nodeId) {
            // Новый формат (скорее всего, уже исправлен)
            nodeId = nodeUpdate.nodeId;
            phase = nodeUpdate.phase;
            decision = nodeUpdate.decision;
            online = nodeUpdate.online;
            isLeader = nodeUpdate.isLeader;
        } else if (nodeUpdate && nodeUpdate.NodeID) {
            // Старый формат (NodeUpdate структура)
            nodeId = nodeUpdate.NodeID;
            phase = nodeUpdate.Phase;
            decision = nodeUpdate.Decision;
            online = nodeUpdate.Online;
            isLeader = nodeUpdate.IsLeader; // Добавляем
        } else {
            return;
        }

         // Сохраняем предыдущее состояние
        const prevState = {
            online: this.nodes[nodeId] ? this.nodes[nodeId].online : false,
            phase: this.nodes[nodeId] ? this.nodes[nodeId].phase : 'IDLE',
            decision: this.nodes[nodeId] ? this.nodes[nodeId].decision : null,
            isLeader: this.nodes[nodeId] ? this.nodes[nodeId].isLeader : false
        };
        
        // Сохраняем все поля в локальном состоянии
        if (!this.nodes[nodeId]) {
            this.nodes[nodeId] = {};
        }
    
        // Обновляем все поля
        if (online !== undefined) this.nodes[nodeId].online = online;
        if (phase !== undefined) this.nodes[nodeId].phase = phase;
        if (decision !== undefined) this.nodes[nodeId].decision = decision;
        if (isLeader !== undefined) this.nodes[nodeId].isLeader = isLeader;
        

        // Логируем изменения ТОЛЬКО здесь
        if (prevState.online !== online && online !== undefined) {
            const status = online ? 'online' : 'offline';
            this.addLog(`Node ${nodeId} is now ${status}`, 'nodeUpdate');
        }
        
        if (prevState.phase !== phase && phase !== undefined) {
            this.addLog(`Node ${nodeId} changed phase: ${prevState.phase} → ${phase}`, 'nodeUpdate');
        }
        
        if (prevState.isLeader !== isLeader && isLeader !== undefined) {
            const leaderStatus = isLeader ? 'became leader' : 'is no longer leader';
            this.addLog(`Node ${nodeId} ${leaderStatus}`, 'nodeUpdate');
        }


        this.updateNodeVisualization(nodeId, prevState);
    }

    updateNodeVisualization(nodeId, prevState) {
        const node = this.nodes[nodeId];
        const visNode = this.network.body.data.nodes;
        
        // Обновляем узел в визуализации
        visNode.update({
            id: nodeId,
            color: this.getNodeColor(node),
            shape: node.isLeader ? 'star' : 'dot',
            size: node.isLeader ? 40 : 30,
            title: this.getNodeTooltip(node)
        });
        
        // Анимации изменения состояния
        if (prevState.online !== node.online) {
            if (!node.online) {
                this.animateNodeFailure(nodeId);
            } else {
                this.animateNodeRecovery(nodeId);
            }
        }

        // Обновляем связанные связи
        this.updateConnectedEdgesForNode(nodeId);
        
        this.updateNetworkStats();
    }

    updateConnectedEdgesForNode(nodeId) {
        const edges = this.network.body.data.edges;
        const node = this.nodes[nodeId];
        
        if (!node) return;
        
        // Находим все связи, связанные с этим узлом
        edges.get().forEach(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                const otherNodeId = edge.from === nodeId ? edge.to : edge.from;
                const otherNode = this.nodes[otherNodeId];
                
                if (otherNode) {
                    const dashes = !node.online || !otherNode.online;
                    
                    edges.update({
                        id: edge.id,
                        dashes: dashes,
                        color: dashes ? '#6b7280' : '#4b5563',
                        width: dashes ? 1.5 : 2
                    });
                }
            }
        });
    }

    animateEdgeFailure(edgeId) {
        const edge = this.network.body.edges[edgeId];
        if (!edge) return;
        
        let blinkCount = 0;
        const originalColor = edge.options.color;
        const failureColor = '#ef4444';
        
        const blinkInterval = setInterval(() => {
            edge.setOptions({
                color: blinkCount % 2 === 0 ? failureColor : originalColor,
                width: blinkCount % 2 === 0 ? 3 : 1,
                dashes: blinkCount % 2 === 0 ? [10, 5] : false
            });
            
            blinkCount++;
            if (blinkCount > 8) {
                clearInterval(blinkInterval);
                edge.setOptions({ 
                    color: originalColor,
                    width: 2,
                    dashes: edge.options.originalDashes || false
                });
            }
        }, 150);
    }

    updateConnectedEdges(nodeId) {
        const edges = this.network.body.data.edges;
        const node = this.nodes[nodeId];
        
        if (!node) return;
        
        // Находим все связи, связанные с этим узлом
        edges.get().forEach(edge => {
            if (edge.from === nodeId || edge.to === nodeId) {
                const otherNodeId = edge.from === nodeId ? edge.to : edge.from;
                const otherNode = this.nodes[otherNodeId];
                
                if (otherNode) {
                    const dashes = !node.online || !otherNode.online;
                    
                    // Если узел только что отключился, анимируем связь
                    if (!node.online && otherNode.online) {
                        this.animateEdgeFailure(edge.id);
                    }
                    
                    edges.update({
                        id: edge.id,
                        dashes: dashes,
                        color: dashes ? '#6b7280' : '#4b5563',
                        width: dashes ? 1.5 : 2
                    });
                }
            }
        });
    }

    animateNodeFailure(nodeId) {
        const node = this.network.body.nodes[nodeId];
        if (!node) return;
        
        // Простая анимация затемнения
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            const colors = blinkCount % 2 === 0 
                ? { background: '#ef4444', border: '#dc2626' }
                : this.getNodeColor(this.nodes[nodeId]);
            
            node.setOptions({ color: colors });
            
            blinkCount++;
            if (blinkCount > 5) {
                clearInterval(blinkInterval);
                node.setOptions({ 
                    color: this.getNodeColor(this.nodes[nodeId])
                });
            }
        }, 200);
    }

    animateNodeRecovery(nodeId) {
        const node = this.network.body.nodes[nodeId];
        if (!node) return;
        
        // Анимация восстановления (зеленое свечение)
        let recoveryCount = 0;
        const recoveryInterval = setInterval(() => {
            const colors = [
                { background: '#10b981', border: '#059669' },
                this.getNodeColor(this.nodes[nodeId])
            ];
            
            node.setOptions({
                color: colors[recoveryCount % 2],
                size: recoveryCount % 2 === 0 ? 35 : 30
            });
            
            recoveryCount++;
            if (recoveryCount > 6) {
                clearInterval(recoveryInterval);
                node.setOptions({ 
                    color: this.getNodeColor(this.nodes[nodeId]),
                    size: this.nodes[nodeId].isLeader ? 40 : 30
                });
            }
        }, 200);
    }


    handleConsensusMessage(message) {
        this.addLog(message, 'consensus');
        
        if (typeof message === 'string') {
            // Парсим сообщение для визуализации
            if (message.includes('Начинается раунд консенсуса')) {
                const match = message.match(/Лидер: (\S+)\. Предложение: (.+)/);
                if (match) {
                    const leaderId = match[1];
                    const proposal = match[2];
                    
                    // Визуализируем начало раунда
                    this.handleConsensusStart(leaderId, proposal);
                }
            }

            if (message.includes('голосовал') || message.includes('voted')) {
                const match = message.match(/Узел (\S+) (?:голосовал|voted) (\w+)/i);
                if (match) {
                    const nodeId = match[1];
                    const vote = match[2];
                    
                    // Анимируем голосование
                    this.animateVote(nodeId, vote);
                }
            }
            
            if (message.includes('Лидер') && message.includes('предложил значение')) {
                const match = message.match(/Лидер (\S+) предложил значение: (.+)/);
                if (match) {
                    const leaderId = match[1];
                    const value = match[2];
                    
                    // Анимация предложения
                    this.animateProposal(leaderId, value);
                }
            }
            
            if (message.includes('КОНСЕНСУС ДОСТИГНУТ')) {
                this.roundsCompleted++;
                document.getElementById('roundsCount').textContent = this.roundsCompleted;
                
                // Извлекаем решение
                const match = message.match(/Решение: (.+)/);
                if (match) {
                    const decision = match[1];
                    this.celebrateConsensus(decision);
                }
            }

            // Обработка сообщений о передаче предложения
            if (message.includes('рассылает PROPOSE') || message.includes('broadcasts PROPOSE')) {
                const match = message.match(/Узел (\S+) (?:рассылает|broadcasts) PROPOSE/);
                if (match) {
                    const senderId = match[1];
                    // Визуализируем рассылку предложения
                    this.visualizeProposalBroadcast(senderId);
                }
            }
            
            // Обработка получения предложения
            if (message.includes('получил') && message.includes('PROPOSE')) {
                const match = message.match(/Узел (\S+) получил от (\S+): тип=PROPOSE/);
                if (match) {
                    const receiverId = match[1];
                    const senderId = match[2];
                    // Визуализируем получение предложения
                    this.visualizeProposalReceived(receiverId, senderId);
                }
            }
        }
    }


    visualizeProposalBroadcast(senderId) {
        // Подсвечиваем отправителя
        const senderNode = this.network.body.nodes[senderId];
        if (senderNode) {
            const originalColor = this.getNodeColor(this.nodes[senderId]);
            const highlightColor = { background: '#3b82f6', border: '#2563eb' };
            
            senderNode.setOptions({ color: highlightColor });
            
            setTimeout(() => {
                senderNode.setOptions({ color: originalColor });
            }, 1000);
        }
    }

    visualizeProposalReceived(receiverId, senderId) {
        // Подсвечиваем получателя
        const receiverNode = this.network.body.nodes[receiverId];
        if (receiverNode) {
            const originalColor = this.getNodeColor(this.nodes[receiverId]);
            const highlightColor = { background: '#8b5cf6', border: '#7c3aed' };
            
            receiverNode.setOptions({ color: highlightColor });
            
            setTimeout(() => {
                receiverNode.setOptions({ color: originalColor });
            }, 1000);
        }
        
        // Анимируем поток сообщения
        this.animateMessageFlow(senderId, receiverId, '#8b5cf6', 'proposal');
    }


    animateVote(nodeId, vote) {
        const node = this.network.body.nodes[nodeId];
        if (!node) return;
        
        const voteColor = vote === 'YES' 
            ? { background: '#10b981', border: '#059669' } 
            : { background: '#ef4444', border: '#dc2626' };
        
        // Временно меняем цвет узла
        const originalColor = this.getNodeColor(this.nodes[nodeId]);
        node.setOptions({ color: voteColor });
        
        // Возвращаем исходный цвет через 1 секунду
        setTimeout(() => {
            node.setOptions({ color: originalColor });
        }, 1000);
        
        // Показываем уведомление о голосовании
        this.showNotification(`Node ${nodeId} voted: ${vote}`, 'vote');
    }

    visualizeConsensusStart(leaderId, proposal) {
        // Подсвечиваем лидера
        const leaderNode = this.network.body.nodes[leaderId];
        if (leaderNode) {
            let blinkCount = 0;
            const blinkInterval = setInterval(() => {
                const currentColor = this.getNodeColor(this.nodes[leaderId]);
                const highlightColor = {
                    background: '#fbbf24',
                    border: '#f59e0b'
                };
                
                leaderNode.setOptions({
                    color: blinkCount % 2 === 0 ? highlightColor : currentColor,
                    size: blinkCount % 2 === 0 ? 45 : 40
                });
                
                blinkCount++;
                if (blinkCount > 8) {
                    clearInterval(blinkInterval);
                    leaderNode.setOptions({ 
                        color: currentColor,
                        size: 40 
                    });
                }
            }, 400);
        }
        
        // Показываем предложение во всплывающем окне
        this.showNotification(`Consensus started! Leader: ${leaderId}, Proposal: ${proposal}`, 'info');
    }

    animateProposal(leaderId, value) {
        // Создаем эффект рассылки предложения
        this.createRippleEffect(leaderId, '#3b82f6');
        
        // Обновляем информацию о предложении
        document.getElementById('proposalValue').value = value;
        
        // Показываем анимацию
        this.showNotification(`Leader ${leaderId} proposed: ${value}`, 'proposal');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'info' ? 'info-circle' : type === 'proposal' ? 'bullhorn' : 'check-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }

    createRippleEffect(sourceNodeId, color) {
        const sourceNode = this.network.body.nodes[sourceNodeId];
        if (!sourceNode) return;
        
        // Находим все узлы, связанные с источником
        const edges = this.network.body.data.edges.get();
        const connectedNodes = new Set();
        
        edges.forEach(edge => {
            if (edge.from === sourceNodeId) connectedNodes.add(edge.to);
            if (edge.to === sourceNodeId) connectedNodes.add(edge.from);
        });
        
        // Анимируем каждое соединение
        connectedNodes.forEach(targetNodeId => {
            this.animateMessageFlow(sourceNodeId, targetNodeId, color);
        });
    }

    animateMessageFlow(fromNodeId, toNodeId, color) {
        const edgeId = `msg-flow-${Date.now()}-${fromNodeId}-${toNodeId}`;
        const edges = this.network.body.data.edges;
        
        // Создаем временную линию для анимации сообщения
        edges.add({
            id: edgeId,
            from: fromNodeId,
            to: toNodeId,
            color: {
                color: color,
                highlight: color,
                opacity: 0.7
            },
            width: 4,
            dashes: false,
            smooth: {
                type: 'continuous',
                roundness: 0.5
            }
        });
        
        // Анимация пульсации
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
            const currentWidth = pulseCount % 2 === 0 ? 6 : 4;
            edges.update({
                id: edgeId,
                width: currentWidth
            });
            
            pulseCount++;
            if (pulseCount > 6) {
                clearInterval(pulseInterval);
                edges.remove(edgeId);
            }
        }, 300);
    }

    getNodeColor(node) {
        if (!node.online) {
            return { background: '#ef4444', border: '#dc2626' };
        }
        
        switch (node.phase) {
            case 'PROPOSE':
                return { background: '#3b82f6', border: '#2563eb' };
            case 'VOTE':
                return { background: '#8b5cf6', border: '#7c3aed' };
            case 'DECIDED':
                return { background: '#10b981', border: '#059669' };
            default:
                return node.isLeader 
                    ? { background: '#f59e0b', border: '#d97706' }
                    : { background: '#4b5563', border: '#374151' };
        }
    }

    getNodeTooltip(node) {
        return `
            <div style="text-align: left; padding: 5px;">
                <strong>${node.id}</strong><br/>
                Status: ${node.online ? 'Online' : 'Offline'}<br/>
                Phase: ${node.phase}<br/>
                Decision: ${node.decision || 'None'}<br/>
                Connections: ${node.peers}<br/>
                ${node.isLeader ? '⭐ Leader' : ''}
            </div>
        `;
    }

    edgeExists(node1, node2) {
        return this.edges[`${node1}-${node2}`] || this.edges[`${node2}-${node1}`];
    }

    addLog(message, type = 'system') {
        if (this.logsPaused && type !== 'system') return;
        
        const logsContainer = document.getElementById('eventLogs');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        logEntry.innerHTML = `
            <span class="log-time">[${timeString}]</span>
            <span class="log-message">${message}</span>
        `;
        
        logsContainer.appendChild(logEntry);
        
        // Автоскролл к новым сообщениям
        logsContainer.scrollTop = logsContainer.scrollHeight;
        
        // Ограничение количества логов
        const maxLogs = 100;
        const logs = logsContainer.getElementsByClassName('log-entry');
        if (logs.length > maxLogs) {
            logs[0].remove();
        }
    }

    updateNetworkStats() {
        const activeNodes = Object.values(this.nodes).filter(node => node.online).length;
        const totalNodes = Object.keys(this.nodes).length;
        const totalEdges = Object.keys(this.edges).length;
        
        // document.getElementById('nodeCount').textContent = `Nodes: ${totalNodes}`;
        document.getElementById('activeNodesCount').textContent = activeNodes;
        document.getElementById('connectionsCount').textContent = totalEdges;
        
        // Обновляем фазовые счетчики
        const phaseCounts = { IDLE: 0, PROPOSE: 0, VOTE: 0, DECIDED: 0 };
        Object.values(this.nodes).forEach(node => {
            phaseCounts[node.phase] = (phaseCounts[node.phase] || 0) + 1;
        });

        // Обновляем прогресс-бары
        this.updateConsensusProgress(phaseCounts, totalNodes);
    }

    updateConsensusProgress(phaseCounts, totalNodes) {
        if (totalNodes === 0) return;
        
        // Прогресс для каждой фазы
        const proposalPercent = (phaseCounts.PROPOSE / totalNodes) * 100;
        const votingPercent = (phaseCounts.VOTE / totalNodes) * 100;
        const decisionPercent = (phaseCounts.DECIDED / totalNodes) * 100;
        
        // Обновляем только если элементы существуют
        const proposalProgress = document.getElementById('proposalProgress');
        const votingProgress = document.getElementById('votingProgress');
        const decisionProgress = document.getElementById('decisionProgress');
        
        if (proposalProgress) proposalProgress.style.width = `${proposalPercent}%`;
        if (votingProgress) votingProgress.style.width = `${votingPercent}%`;
        if (decisionProgress) decisionProgress.style.width = `${decisionPercent}%`;
    }

    updateNetworkState(state) {
        console.log("updateNetworkState called with:", state);
        this.nodes = state;
        
        // Обновляем только узлы, не трогая связи
        const nodes = this.network.body.data.nodes;
        
        Object.keys(state).forEach(nodeId => {
            const node = state[nodeId];

            // Сохраняем предыдущее состояние для анимации
            const prevNode = this.nodes[nodeId];
            
            nodes.update({
                id: nodeId,
                color: this.getNodeColor(node),
                shape: node.isLeader ? 'star' : 'dot',
                size: node.isLeader ? 40 : 30,
                title: this.getNodeTooltip(node)
            });

            // Если статус узла изменился, анимируем
            if (prevNode && prevNode.online !== node.online) {
                if (!node.online) {
                    this.animateNodeFailure(nodeId);
                } else {
                    this.animateNodeRecovery(nodeId);
                }
                this.updateConnectedEdges(nodeId);
            }
        });
        
        this.updateNetworkStats();
    }

    showNodeInfo(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return;
        
        this.selectedNodeId = nodeId;
        
        document.getElementById('detailNodeId').textContent = nodeId;
        document.getElementById('detailStatus').textContent = node.online ? 'Online' : 'Offline';
        document.getElementById('detailStatus').style.color = node.online ? '#10b981' : '#ef4444';
        document.getElementById('detailPhase').textContent = node.phase;
        document.getElementById('detailDecision').textContent = node.decision || 'None';
        document.getElementById('detailQueue').textContent = `${node.messageQueue || 0} messages`;
        
        // Обновляем список соединений (упрощенно)
        const connectionsDiv = document.getElementById('detailConnections');
        connectionsDiv.innerHTML = '';
        
        // Предположим, что у нас есть 3 случайных соединения для демонстрации
        const sampleConnections = Object.keys(this.nodes)
            .filter(id => id !== nodeId)
            .slice(0, 3);
        
        sampleConnections.forEach(connId => {
            const span = document.createElement('span');
            span.className = 'connection-tag';
            span.textContent = connId;
            connectionsDiv.appendChild(span);
        });
        
        // Показываем модальное окно
        document.getElementById('nodeInfoModal').style.display = 'block';
    }

    toggleNodeOnline(nodeId) {
        if (!nodeId || !this.nodes[nodeId]) return;
        
        // Отправляем команду на сервер
        this.sendCommand('toggleNode', { nodeId: nodeId });

        const node = this.nodes[nodeId];
        this.showNotification(`Toggling node ${nodeId}...`, 'info');
    }

    celebrateConsensus() {
        // Простая анимация для празднования консенсуса
        const canvas = document.getElementById('networkCanvas');
        canvas.style.boxShadow = '0 0 30px #10b981';
        
        setTimeout(() => {
            canvas.style.boxShadow = '';
        }, 2000);
    }

    sendCommand(action, data = {}) {
        if (!this.connected) {
            this.addLog('Cannot send command: WebSocket not connected', 'system');
            return;
        }
        
        const command = {
            action,
            ...data,
            timestamp: Date.now()
        };
        console.log("Sending command:", command);
        this.ws.send(JSON.stringify(command));
    }

    initializeEventListeners() {
        // Управление узлами
        document.getElementById('btnAddNode').addEventListener('click', () => {
            if (isAddingNode) return; // Если уже добавляется, игнорируем
            const nodeId = document.getElementById('nodeIdInput').value.trim();
            if (nodeId) {
                this.sendCommand('addNode', { nodeId });
                document.getElementById('nodeIdInput').value = '';
                this.addLog(`Request to add node: ${nodeId}`, 'system');
            }
        });

        document.getElementById('btnRemoveNode').addEventListener('click', () => {
            const nodeId = document.getElementById('removeNodeId').value.trim();
            if (nodeId) {
                this.sendCommand('removeNode', { nodeId });
                document.getElementById('removeNodeId').value = '';
                this.addLog(`Request to remove node: ${nodeId}`, 'system');
            }
        });

        document.getElementById('btnConnectNodes').addEventListener('click', () => {
            const node1 = document.getElementById('node1Input').value.trim();
            const node2 = document.getElementById('node2Input').value.trim();
            if (node1 && node2) {
                this.sendCommand('connectNodes', { node1, node2 });
                this.addLog(`Request to connect ${node1} ↔ ${node2}`, 'system');
            }
        });

        // Быстрые действия
        document.getElementById('btnAddRandomNode').addEventListener('click', () => {
            const randomId = `Node_${Math.floor(Math.random() * 1000)}`;
            this.sendCommand('addNode', { nodeId: randomId });
            this.addLog(`Added random node: ${randomId}`, 'system');
        });

        document.getElementById('btnCreateMesh').addEventListener('click', () => {
            this.sendCommand('createMesh');
            this.addLog('Creating full mesh network', 'system');
        });

        document.getElementById('btnCreateRing').addEventListener('click', () => {
            this.sendCommand('createRing');
            this.addLog('Creating ring topology', 'system');
        });

        document.getElementById('btnDisconnectAll').addEventListener('click', () => {
            this.sendCommand('disconnectAll');
            this.addLog('Disconnecting all nodes', 'system');
        });

        // Управление консенсусом
        document.getElementById('btnStartConsensus').addEventListener('click', () => {
            const value = document.getElementById('proposalValue').value.trim() || 'Block_1';
            this.sendCommand('startConsensus', { value });
            this.addLog(`Starting consensus round with value: ${value}`, 'consensus');
        });

        document.getElementById('btnResetConsensus').addEventListener('click', () => {
            this.sendCommand('resetConsensus');
            this.addLog('Resetting consensus state', 'system');
        });

        // Управление логами
        document.getElementById('btnClearLogs').addEventListener('click', () => {
            document.getElementById('eventLogs').innerHTML = '';
            this.addLog('Logs cleared', 'system');
        });

        document.getElementById('btnPauseLogs').addEventListener('click', (e) => {
            this.logsPaused = !this.logsPaused;
            e.target.innerHTML = this.logsPaused 
                ? '<i class="fas fa-play"></i> Resume'
                : '<i class="fas fa-pause"></i> Pause';
            this.addLog(`Logs ${this.logsPaused ? 'paused' : 'resumed'}`, 'system');
        });

        // Визуализация
        document.getElementById('btnResetView').addEventListener('click', () => {
            this.network.fit();
            this.addLog('Network view reset', 'system');
        });

        // Модальное окно
        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('nodeInfoModal').style.display = 'none';
        });

        document.getElementById('btnToggleNode').addEventListener('click', () => {
            if (this.selectedNodeId) {
                this.toggleNodeOnline(this.selectedNodeId);
            }
        });

        // Фильтрация логов
        document.querySelectorAll('input[name="logFilter"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const logType = e.target.value;
                const show = e.target.checked;
                
                const logs = document.querySelectorAll(`.log-entry.${logType}`);
                logs.forEach(log => {
                    log.style.display = show ? '' : 'none';
                });
            });
        });

        // Экспорт логов
        document.getElementById('btnExportLogs').addEventListener('click', () => {
            const logs = document.querySelectorAll('.log-message');
            const logText = Array.from(logs).map(log => log.textContent).join('\n');
            
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `consensus-logs-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.addLog('Logs exported', 'system');
        });

        // Симуляция сбоя
        document.getElementById('btnSimulateFailure').addEventListener('click', () => {
            this.sendCommand('simulateFailure');
            this.addLog('Simulating network failure', 'system');
        });

        // Закрытие модального окна по клику вне его
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('nodeInfoModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Ввод по Enter в текстовых полях
        ['nodeIdInput', 'removeNodeId', 'node1Input', 'node2Input', 'proposalValue'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const buttonId = `btn${id.charAt(0).toUpperCase() + id.slice(1).replace('Input', '')}`;
                    if (document.getElementById(buttonId)) {
                        document.getElementById(buttonId).click();
                    }
                }
            });
        });
    }

    startUptimeCounter() {
        setInterval(() => {
            this.uptime++;
            const hours = Math.floor(this.uptime / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((this.uptime % 3600) / 60).toString().padStart(2, '0');
            const seconds = (this.uptime % 60).toString().padStart(2, '0');
            document.getElementById('uptimeCounter').textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
    }
}

// Инициализация приложения
let simulator;

document.addEventListener('DOMContentLoaded', () => {
    simulator = new ConsensusSimulator();
        
    // Переопределяем обработку сообщений консенсуса
    const originalHandleConsensus = simulator.handleConsensusMessage.bind(simulator);
    simulator.handleConsensusMessage = function(message) {
        originalHandleConsensus(message);
        
        if (typeof message === 'string') {
            if (message.includes('Начинается раунд консенсуса')) {
                const match = message.match(/Лидер: (\S+)\. Предложение: (.+)/);
                if (match) {
                    const leaderId = match[1];
                    const proposal = match[2];
                }
            }
        }
    };
    
    // Дополнительные демонстрационные сообщения
    setTimeout(() => {
        if (simulator.connected) {
            simulator.addLog('Network simulator ready. Try adding nodes and starting consensus!', 'system');
            simulator.addLog('Click "Start Consensus Round" to see step-by-step visualization', 'system');
        }
    }, 1000);
});