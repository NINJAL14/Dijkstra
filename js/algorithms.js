// Priority Queue for Algorithms
class PriorityQueue {
    constructor() {
        this.elements = [];
    }
    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }
    dequeue() {
        return this.elements.shift().element;
    }
    isEmpty() {
        return this.elements.length === 0;
    }
}

// Convert Cytoscape graph to Adjacency List for directed/undirected algorithm execution
function getAdjacencyList(cy) {
    const adj = {};
    cy.nodes().forEach(node => {
        adj[node.id()] = [];
    });
    cy.edges().forEach(edge => {
        const source = edge.source().id();
        const target = edge.target().id();
        const weight = parseFloat(edge.data('weight') || 1);
        // Undirected graph assumption
        adj[source].push({ node: target, weight, edgeId: edge.id() });
        adj[target].push({ node: source, weight, edgeId: edge.id() });
    });
    return adj;
}

// algorithms returning an array of steps
// step: { type: 'info'|'select_node'|'visit_edge'|'select_edge'|'update_node', id: string, message: string, label: string }

function runDijkstra(cy, startNodeId) {
    const adj = getAdjacencyList(cy);
    const distances = {};
    const previous = {};
    const steps = [];
    const pq = new PriorityQueue();
    const visited = new Set();

    cy.nodes().forEach(n => {
        distances[n.id()] = Infinity;
        previous[n.id()] = null;
    });

    distances[startNodeId] = 0;
    pq.enqueue(startNodeId, 0);

    steps.push({ type: 'info', message: `Initializing Dijkstra's algorithm: Setting distance to starting Node ${startNodeId} to 0, and all other nodes to Infinity.` });
    steps.push({ type: 'update_node', id: startNodeId, label: '0', message: `Node ${startNodeId} is the starting point (Distance: 0).` });

    while (!pq.isEmpty()) {
        const currentId = pq.dequeue();
        
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        
        steps.push({ type: 'select_node', id: currentId, message: `Selecting Node ${currentId} as the current node because it has the shortest known path distance.` });

        for (let neighbor of adj[currentId]) {
            const { node: neighborId, weight, edgeId } = neighbor;
            
            if (visited.has(neighborId)) continue;

            steps.push({ type: 'visit_edge', id: edgeId, message: `Evaluating path to neighbor Node ${neighborId} via edge ${currentId}-${neighborId} (weight: ${weight}).` });

            const newDist = distances[currentId] + weight;
            if (newDist < distances[neighborId]) {
                distances[neighborId] = newDist;
                previous[neighborId] = currentId;
                pq.enqueue(neighborId, newDist);
                
                steps.push({ type: 'update_node', id: neighborId, label: `${newDist}`, message: `Found a shorter path! Path length through Node ${currentId} is ${distances[currentId]} + ${weight} = ${newDist}. Updating Node ${neighborId} memory...` });
            }
        }
    }
    
    let totalPathWeight = 0;
    // Highlight shortest paths
    for (let nodeId in previous) {
        if (previous[nodeId] !== null) {
            const edge = cy.edges().filter(e => 
                (e.source().id() === nodeId && e.target().id() === previous[nodeId]) ||
                (e.source().id() === previous[nodeId] && e.target().id() === nodeId)
            )[0];
            if (edge) {
                totalPathWeight += parseFloat(edge.data('weight') || 1);
                steps.push({ type: 'select_edge', id: edge.id(), message: `Final shortest path trace traces back through edge ${previous[nodeId]}-${nodeId}.` });
            }
        }
    }

    steps.push({ type: 'info', message: `Dijkstra's Algorithm complete! Shortest paths from Node ${startNodeId} to all reachable nodes have been found. Final sum (total weight of path tree): ${totalPathWeight}.` });
    return steps;
}

function runPrim(cy, startNodeId) {
    const adj = getAdjacencyList(cy);
    const steps = [];
    const pq = new PriorityQueue();
    const visited = new Set();
    let totalWeight = 0;

    steps.push({ type: 'info', message: `Initializing Prim's algorithm: The Minimum Spanning Tree (MST) begins at Node ${startNodeId}.` });
    visited.add(startNodeId);
    steps.push({ type: 'select_node', id: startNodeId, message: `Node ${startNodeId} added to the MST. We will now look at its connecting edges.` });

    function addEdges(nodeId) {
        for (let neighbor of adj[nodeId]) {
            if (!visited.has(neighbor.node)) {
                pq.enqueue({ source: nodeId, target: neighbor.node, weight: neighbor.weight, edgeId: neighbor.edgeId }, neighbor.weight);
            }
        }
    }

    addEdges(startNodeId);

    while (!pq.isEmpty()) {
        const minEdge = pq.dequeue();
        if (visited.has(minEdge.target)) continue;

        steps.push({ type: 'visit_edge', id: minEdge.edgeId, message: `The absolute smallest available connecting edge is ${minEdge.source}-${minEdge.target} (weight: ${minEdge.weight}). Let's check it!` });
        
        visited.add(minEdge.target);
        totalWeight += minEdge.weight;
        
        steps.push({ type: 'select_edge', id: minEdge.edgeId, message: `Node ${minEdge.target} isn't in our tree yet! Adding edge ${minEdge.source}-${minEdge.target} to our MST.` });
        steps.push({ type: 'select_node', id: minEdge.target, message: `Node ${minEdge.target} successfully joined the MST.` });
        
        addEdges(minEdge.target);
    }
    
    steps.push({ type: 'info', message: `Prim's Algorithm complete! All interconnected nodes are in the MST. Final sum (total weight): ${totalWeight}.` });
    return steps;
}

class DisjointSet {
    constructor(nodes) {
        this.parent = {};
        this.rank = {};
        nodes.forEach(n => {
            this.parent[n] = n;
            this.rank[n] = 0;
        });
    }
    find(i) {
        if (this.parent[i] == i) return i;
        this.parent[i] = this.find(this.parent[i]);
        return this.parent[i];
    }
    union(i, j) {
        let rootI = this.find(i);
        let rootJ = this.find(j);
        if (rootI !== rootJ) {
            if (this.rank[rootI] < this.rank[rootJ]) {
                this.parent[rootI] = rootJ;
            } else if (this.rank[rootI] > this.rank[rootJ]) {
                this.parent[rootJ] = rootI;
            } else {
                this.parent[rootJ] = rootI;
                this.rank[rootI]++;
            }
            return true;
        }
        return false;
    }
}

function runKruskal(cy) {
    const steps = [];
    const nodes = cy.nodes().map(n => n.id());
    const ds = new DisjointSet(nodes);
    const edges = [];
    
    cy.edges().forEach(e => {
        edges.push({
            id: e.id(),
            source: e.source().id(),
            target: e.target().id(),
            weight: parseFloat(e.data('weight') || 1)
        });
    });

    edges.sort((a, b) => a.weight - b.weight);
    
    steps.push({ type: 'info', message: `Initializing Kruskal's algorithm: First, we globally sorted all ${edges.length} edges from lowest weight to highest weight.` });
    
    let totalWeight = 0;
    for (let edge of edges) {
        steps.push({ type: 'visit_edge', id: edge.id, message: `Checking the next smallest edge in the graph: ${edge.source}-${edge.target} (weight: ${edge.weight}).` });
        
        if (ds.union(edge.source, edge.target)) {
            totalWeight += edge.weight;
            steps.push({ type: 'select_edge', id: edge.id, message: `Nodes ${edge.source} and ${edge.target} are in different groups! This edge safely connects them without creating a cycle. Adding to MST!` });
            steps.push({ type: 'select_node', id: edge.source, message: `Node ${edge.source} merged into the expanding spanning tree.` });
            steps.push({ type: 'select_node', id: edge.target, message: `Node ${edge.target} merged into the expanding spanning tree.` });
        } else {
            steps.push({ type: 'info', message: `Wait! Nodes ${edge.source} and ${edge.target} are already connected to each other via other edges. Adding this would create a cycle! Discarding edge.` });
        }
    }
    
    steps.push({ type: 'info', message: `Kruskal's Algorithm complete! We connected the entire graph using the absolute lowest weight edges. Total MST weight: ${totalWeight}.` });
    return steps;
}

// Expose algorithms to main script
window.Algorithms = { runDijkstra, runPrim, runKruskal };
