document.addEventListener("DOMContentLoaded", () => {
    // Basic Cytoscape initialization
    const cy = cytoscape({
        container: document.getElementById('cy-container'),
        elements: [],
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#1f2833',
                    'border-width': 2,
                    'border-color': '#45a29e',
                    'label': 'data(id)',
                    'color': '#c5c6c7',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '14px',
                    'font-weight': 'bold',
                    'text-outline-width': 2,
                    'text-outline-color': '#0b0c10',
                    'width': 40,
                    'height': 40,
                    'transition-property': 'background-color, border-color, border-width',
                    'transition-duration': '0.5s'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#45a29e',
                    'target-arrow-shape': 'none',
                    'label': 'data(weight)',
                    'color': '#66fcf1',
                    'font-size': '14px',
                    'text-background-color': '#0b0c10',
                    'text-background-opacity': 1,
                    'text-background-padding': '2px',
                    'transition-property': 'line-color, width',
                    'transition-duration': '0.5s'
                }
            },
            {
                selector: '.selected-node',
                style: {
                    'background-color': '#ff4c4c',
                    'border-color': '#ff4c4c',
                    'color': '#ffffff'
                }
            },
            {
                selector: '.visited-node',
                style: {
                    'background-color': '#45a29e',
                    'border-color': '#66fcf1'
                }
            },
            {
                selector: '.visiting-edge',
                style: {
                    'line-color': '#ff4c4c',
                    'width': 5
                }
            },
            {
                selector: '.selected-edge',
                style: {
                    'line-color': '#66fcf1',
                    'width': 5
                }
            },
            {
                selector: '.eh-handle',
                style: {
                    'background-color': '#ff4c4c',
                    'width': 12,
                    'height': 12,
                    'shape': 'ellipse',
                    'overlay-opacity': 0,
                    'border-width': 12,
                    'border-opacity': 0
                }
            },
            {
                selector: '.eh-hover',
                style: {
                    'background-color': '#ff4c4c'
                }
            },
            {
                selector: '.eh-source',
                style: {
                    'border-width': 2,
                    'border-color': '#ff4c4c'
                }
            },
            {
                selector: '.eh-target',
                style: {
                    'border-width': 2,
                    'border-color': '#ff4c4c'
                }
            },
            {
                selector: '.eh-preview, .eh-ghost-edge',
                style: {
                    'background-color': '#ff4c4c',
                    'line-color': '#ff4c4c',
                    'target-arrow-color': '#ff4c4c',
                    'source-arrow-color': '#ff4c4c'
                }
            },
            {
                selector: '.eh-ghost-edge.eh-preview-active',
                style: {
                    'opacity': 0
                }
            }
        ],
        layout: {
            name: 'preset' // Used as nodes will have absolute positions from click
        },
        userZoomingEnabled: false,
        userPanningEnabled: false
    });

    // edgehandles configuration
    const ehConfig = {
        snap: false,
        noEdgeEventsInDraw: true,
        disableBrowserGestures: true,
        complete: function(sourceNode, targetNode, addedEles){
            if(sourceNode.id() === targetNode.id()) {
                addedEles.remove();
                return;
            }
            
            const existingEdge = cy.edges().filter(e => 
                (e.source().id() === sourceNode.id() && e.target().id() === targetNode.id()) ||
                (e.source().id() === targetNode.id() && e.target().id() === sourceNode.id())
            );

            if(existingEdge.length > 1) { 
                addedEles.remove(); 
                statusText.innerText = "Edge already exists.";
                return;
            }

            const weight = document.getElementById('edge-weight').value || 1;
            addedEles.data('weight', weight);
            addedEles.data('id', `e${sourceNode.id()}-${targetNode.id()}`);
            document.getElementById('status-text').innerText = `Connected Node ${sourceNode.id()} to Node ${targetNode.id()} (weight: ${weight})`;
        }
    };
    let eh = null;
    try {
        if (typeof cy.edgehandles === 'function') {
            eh = cy.edgehandles(ehConfig);
        } else {
            console.warn("Edgehandles plugin not loaded. Edge drawing will fallback to manual nodes.");
        }
    } catch (e) {
        console.error(e);
    }

    let nodeCount = 0;
    let currentSteps = [];
    let currentStepIndex = 0;
    let isPlaying = false;
    let playInterval = null;

    let currentMode = 'move'; // 'move' or 'edge'

    const btnClear = document.getElementById('btn-clear');
    const startSelect = document.getElementById('algo-start');
    const statusText = document.getElementById('status-text');

    // UI Action
    document.getElementById('btn-add-node').addEventListener('click', () => {
        if (currentSteps.length > 0) return;
        const extent = cy.extent();
        const posX = extent.x1 + extent.w / 2 + (Math.random() * 60 - 30);
        const posY = extent.y1 + extent.h / 2 + (Math.random() * 60 - 30);
        
        cy.add({
            group: 'nodes',
            data: { id: nodeCount.toString() },
            position: { x: posX, y: posY }
        });
        updateSelects();
        statusText.innerText = `Added Node ${nodeCount} to canvas.`;
        nodeCount++;
    });

    // UI Mode Selection
    document.getElementById('mode-move').addEventListener('click', (e) => {
        currentMode = 'move';
        e.target.classList.add('active');
        document.getElementById('mode-edge').classList.remove('active');
        if (eh) eh.disableDrawMode();
        statusText.innerText = "Move mode. You can reposition nodes, or tap canvas to spawn a node.";
    });

    document.getElementById('mode-edge').addEventListener('click', (e) => {
        currentMode = 'edge';
        e.target.classList.add('active');
        document.getElementById('mode-move').classList.remove('active');
        if (eh) eh.enableDrawMode();
        statusText.innerText = "Draw Edge mode. Drag your finger from one node to another to connect them.";
    });

    // UI Updates
    function updateSelects() {
        startSelect.innerHTML = '<option value="">Select a node</option>';
        cy.nodes().forEach(node => {
            const opt = document.createElement('option');
            opt.value = node.id();
            opt.textContent = 'Node ' + node.id();
            startSelect.appendChild(opt);
        });
    }

    // Graph Interaction
    cy.on('tap', (evt) => {
        if (currentSteps.length > 0) return; 

        if (currentMode === 'move' && evt.target === cy) {
            cy.add({
                group: 'nodes',
                data: { id: nodeCount.toString() },
                position: { x: evt.position.x, y: evt.position.y }
            });
            updateSelects();
            statusText.innerText = `Added Node ${nodeCount} by tapping canvas.`;
            nodeCount++;
        }
    });

    // Edit individual edge weight on tap
    cy.on('tap', 'edge', (evt) => {
        if (currentSteps.length > 0) return; 
        
        const edge = evt.target;
        const currentWeight = edge.data('weight');
        const newWeight = prompt(`Enter new weight for edge ${edge.id()}:`, currentWeight);
        
        if (newWeight !== null && newWeight.trim() !== "" && !isNaN(newWeight)) {
            const parsedWeight = parseFloat(newWeight);
            edge.data('weight', parsedWeight);
            statusText.innerText = `Updated edge weight to ${parsedWeight}`;
        }
    });

    function resetVisuals() {
        cy.elements().removeClass('selected-node visited-node visiting-edge selected-edge');
        cy.nodes().forEach(n => {
            if (n.data('originalLabel')) {
                n.style('label', n.data('originalLabel'));
            } else {
                n.style('label', n.id());
            }
        });
    }

    function resetAnimationState() {
        pauseAnimation();
        currentSteps = [];
        currentStepIndex = 0;
        document.getElementById('btn-play').disabled = true;
        document.getElementById('btn-pause').disabled = true;
        document.getElementById('btn-step').disabled = true;
        document.getElementById('btn-reset').disabled = true;
        resetVisuals();
    }

    btnClear.addEventListener('click', () => {
        resetAnimationState();
        cy.elements().remove();
        nodeCount = 0;
        sourceNode = null;
        updateSelects();
        statusText.innerText = "Graph cleared. Click on the canvas to add nodes.";
    });

    function setupAnimation(steps) {
        resetAnimationState();
        // save original labels
        cy.nodes().forEach(n => n.data('originalLabel', n.id()));
        
        currentSteps = steps;
        currentStepIndex = 0;
        document.getElementById('btn-play').disabled = false;
        document.getElementById('btn-step').disabled = false;
        document.getElementById('btn-reset').disabled = false;
        statusText.innerText = "Algorithm ready. Press Play or Step.";
    }

    function playAnimation() {
        if (currentStepIndex >= currentSteps.length) return;
        isPlaying = true;
        document.getElementById('btn-play').disabled = true;
        document.getElementById('btn-pause').disabled = false;
        document.getElementById('btn-step').disabled = true;
        
        playInterval = setInterval(() => {
            if (currentStepIndex < currentSteps.length) {
                executeStep(currentSteps[currentStepIndex]);
                currentStepIndex++;
            } else {
                pauseAnimation();
                statusText.innerText += "\nAlgorithm finished.";
            }
        }, 1000); 
    }

    function pauseAnimation() {
        isPlaying = false;
        clearInterval(playInterval);
        if (currentSteps.length > 0 && currentStepIndex < currentSteps.length) {
            document.getElementById('btn-play').disabled = false;
            document.getElementById('btn-step').disabled = false;
        }
        document.getElementById('btn-pause').disabled = true;
    }

    document.getElementById('btn-play').addEventListener('click', playAnimation);
    document.getElementById('btn-pause').addEventListener('click', pauseAnimation);
    document.getElementById('btn-step').addEventListener('click', () => {
        if (currentStepIndex < currentSteps.length) {
            executeStep(currentSteps[currentStepIndex]);
            currentStepIndex++;
            if (currentStepIndex >= currentSteps.length) {
                document.getElementById('btn-step').disabled = true;
                document.getElementById('btn-play').disabled = true;
                statusText.innerText += "\nAlgorithm finished.";
            }
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        pauseAnimation();
        resetVisuals();
        currentStepIndex = 0;
        document.getElementById('btn-play').disabled = false;
        document.getElementById('btn-step').disabled = false;
        statusText.innerText = "Visuals reset to start of algorithm.";
    });

    function executeStep(step) {
        statusText.innerText = step.message;
        
        cy.edges().removeClass('visiting-edge');
        
        switch (step.type) {
            case 'select_node':
                cy.getElementById(step.id).addClass('selected-node').addClass('visited-node');
                break;
            case 'visit_edge':
                cy.getElementById(step.id).addClass('visiting-edge');
                break;
            case 'select_edge':
                cy.getElementById(step.id).addClass('selected-edge');
                break;
            case 'update_node':
                // Append distance label
                cy.getElementById(step.id).style('label', `${step.id} (${step.label})`);
                break;
            case 'info':
                break;
        }
    }

    // Connect Algorithms
    document.getElementById('btn-dijkstra').addEventListener('click', () => {
        const start = startSelect.value;
        if (!start) {
            alert("Please build the graph and select a start node.");
            return;
        }
        if(!window.Algorithms) return alert("Algorithms module missing.");
        const steps = window.Algorithms.runDijkstra(cy, start);
        setupAnimation(steps);
    });

    document.getElementById('btn-prim').addEventListener('click', () => {
        const start = startSelect.value;
        if (!start) {
            alert("Please build the graph and select a start node.");
            return;
        }
        if(!window.Algorithms) return alert("Algorithms module missing.");
        const steps = window.Algorithms.runPrim(cy, start);
        setupAnimation(steps);
    });

    document.getElementById('btn-kruskal').addEventListener('click', () => {
        if (cy.nodes().length === 0) {
            alert("Please build a graph first.");
            return;
        }
        if(!window.Algorithms) return alert("Algorithms module missing.");
        const steps = window.Algorithms.runKruskal(cy);
        setupAnimation(steps);
    });

    // Make window resizable properly
    window.addEventListener('resize', () => {
        cy.resize();
    });
});
