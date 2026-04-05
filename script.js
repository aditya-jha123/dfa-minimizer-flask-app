let dfa = null;
let partitions = [];
let stepCount = 0;
let isDone = false;

// 1. Parse Input & Initialize
// Automatically add one empty row when the page loads
document.addEventListener('DOMContentLoaded', () => addTransitionRow());

function addTransitionRow(from = '', sym = '', to = '') {
    const tbody = document.getElementById('transition-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="t-from" value="${from}" placeholder="q0"></td>
        <td><input type="text" class="t-sym" value="${sym}" placeholder="0"></td>
        <td><button class="btn-arrow" tabindex="-1">➔</button></td>
        <td><input type="text" class="t-to" value="${to}" placeholder="q1"></td>
        <td><button type="button" class="btn-remove" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    tbody.appendChild(tr);
}
function initialize() {
    // 1. Grab and clean the user inputs
    const statesRaw = document.getElementById('states').value.split(',').map(s => s.trim()).filter(s => s);
    const alphabet = document.getElementById('alphabet').value.split(',').map(s => s.trim()).filter(s => s);
    const start = document.getElementById('start').value.trim();
    const acceptRaw = document.getElementById('accept').value.split(',').map(s => s.trim()).filter(s => s);
    
    // 2. Build the transitions dictionary
    // 2. Build the transitions dictionary from the TABLE
    // 2. Build the transitions dictionary from the MATRIX
    const transitions = {};
    statesRaw.forEach(s => transitions[s] = {});
    
    const matrixInputs = document.querySelectorAll('#input-matrix input');
    matrixInputs.forEach(input => {
        const state = input.getAttribute('data-from');
        const symbol = input.getAttribute('data-sym');
        const nextState = input.value.trim();
        
        // If the user typed a state in the box, save it
        if (nextState) {
            if (transitions[state]) transitions[state][symbol] = nextState;
        }
    });

    // ==========================================
    //  UNREACHABLE STATE REMOVAL (BFS)
    // ==========================================
    let reachable = new Set();
    let queue = [start];
    reachable.add(start);

    // Explore every connected path
    while (queue.length > 0) {
        let current = queue.shift();
        alphabet.forEach(sym => {
            let nextState = transitions[current][sym];
            if (nextState && !reachable.has(nextState)) {
                reachable.add(nextState);
                queue.push(nextState);
            }
        });
    }

    // Filter out the dead states
    const states = statesRaw.filter(s => reachable.has(s));
    const accept = acceptRaw.filter(s => reachable.has(s));
    const removedStates = statesRaw.filter(s => !reachable.has(s));

    // Save the clean DFA globally
    dfa = { states, alphabet, start, accept, transitions };

    // ==========================================
    // BUILD P0 (0-Equivalent Partition)
    // ==========================================
    const nonAccept = states.filter(s => !accept.includes(s));
    let initialPartition = [];
    if (accept.length > 0) initialPartition.push(accept);
    if (nonAccept.length > 0) initialPartition.push(nonAccept);
    
    partitions = [initialPartition];
    stepCount = 0;
    isDone = false;

    // 3. Update the UI Log
    const log = document.getElementById('partition-log');
    log.innerHTML = ''; // Clear old logs
    
    // Announce if we deleted anything!
    if (removedStates.length > 0) {
        log.innerHTML += `<div class="partition-step" style="border-color: #ef4444;">
            <h4 style="color: #ef4444;">Step 0: Reachability Analysis</h4>
            <div>Removed Unreachable States: <span class="group" style="background: #fee2e2; color: #991b1b; border-color: #fca5a5;">${removedStates.join(', ')}</span></div>
        </div>`;
    }

    log.innerHTML += `<div class="partition-step">
        <h4>Initialization (P0)</h4>
        ${initialPartition.map(g => `<span class="group">{${g.join(', ')}}</span>`).join('')}
    </div>`;

    document.getElementById('btn-next').disabled = false;
    document.getElementById('network-graph').innerHTML = ''; // Clear old graph
}

// 2. Step-by-Step Logic
function nextStep() {
    if (isDone) return;

    const currentP = partitions[partitions.length - 1];
    let nextP = [];

    // Helper to find which group a state goes to on a specific symbol
    const getGroupIndex = (state, symbol, partitionList) => {
        const targetState = dfa.transitions[state][symbol];
        return partitionList.findIndex(group => group.includes(targetState));
    };

    // Check transitions for all groups
    for (let group of currentP) {
        if (group.length === 1) {
            nextP.push(group); // Can't split a single state
            continue;
        }

        // Group states by their transition "signature"
        let signatureMap = {};
        for (let state of group) {
            // Create a string signature: e.g., "groupOf(0),groupOf(1)"
            let signature = dfa.alphabet.map(sym => getGroupIndex(state, sym, currentP)).join('|');
            if (!signatureMap[signature]) signatureMap[signature] = [];
            signatureMap[signature].push(state);
        }

        // Add newly formed groups to the next partition
        for (let sig in signatureMap) {
            nextP.push(signatureMap[sig]);
        }
    }

    stepCount++;
    
    // Sort to easily compare arrays
    const sortP = (p) => p.map(g => [...g].sort()).sort();
    const isSame = JSON.stringify(sortP(currentP)) === JSON.stringify(sortP(nextP));

    if (isSame) {
        isDone = true;
        document.getElementById('btn-next').disabled = true;
        logPartition(`P${stepCount} (No change. Minimization Complete!)`, nextP, true);
        drawGraph(nextP);
    } else {
        partitions.push(nextP);
        logPartition(`P${stepCount} (Split based on transitions)`, nextP);
    }
}

// 3. UI Helper to render the text partitions
function logPartition(title, partitionGroups, final = false) {
    const logDiv = document.getElementById('partition-log');
    const stepDiv = document.createElement('div');
    stepDiv.className = 'partition-step';
    if (final) stepDiv.style.borderColor = '#22c55e'; // Green border for completion
    
    let html = `<h4>${title}</h4>`;
    partitionGroups.forEach(group => {
        html += `<div class="group">{ ${group.join(', ')} }</div>`;
    });
    
    stepDiv.innerHTML = html;
    logDiv.appendChild(stepDiv);
    logDiv.scrollTop = logDiv.scrollHeight;
}
function generateMatrixTable() {
    const statesRaw = document.getElementById('states').value.split(',').map(s => s.trim()).filter(s => s);
    const alphabet = document.getElementById('alphabet').value.split(',').map(s => s.trim()).filter(s => s);
    
    if (statesRaw.length === 0 || alphabet.length === 0) {
        alert("Please enter at least one State and one Alphabet symbol first!");
        return;
    }

    const head = document.getElementById('matrix-head');
    const body = document.getElementById('matrix-body');
    
    // Build Headers: State | δ(0) | δ(1)
    let headHTML = `<tr><th>State</th>`;
    alphabet.forEach(sym => { headHTML += `<th>δ(${sym})</th>`; });
    headHTML += `</tr>`;
    head.innerHTML = headHTML;

    // Build Rows for each State
    let bodyHTML = '';
    statesRaw.forEach(state => {
        bodyHTML += `<tr><td>${state}</td>`;
        alphabet.forEach(sym => {
            // Store the 'from' and 'symbol' in data attributes so we can easily read them later
            bodyHTML += `<td><input type="text" data-from="${state}" data-sym="${sym}" placeholder="-"></td>`;
        });
        bodyHTML += `</tr>`;
    });
    body.innerHTML = bodyHTML;

    // Show the table container
    document.getElementById('matrix-container').style.display = 'block';
}

// 4. Render Minimized Graph using Vis.js
function drawGraph(finalPartition) {
    // Find which new group the start state belongs to
    const startGroup = finalPartition.find(g => g.includes(dfa.start));
    
    // Map old states to new combined names (e.g., "q0,q1")
    const groupNames = finalPartition.map(g => g.join(','));
    
    const nodes = finalPartition.map((group, index) => {
            const name = group.join(',');
            const isAccept = group.some(s => dfa.accept.includes(s));
            const isStart = group.includes(dfa.start);
            
            // Default look for standard nodes
            let nodeProps = {
                id: index,
                label: name,
                shape: 'circle',
                color: { 
                    background: isStart ? '#e0e7ff' : '#ffffff', 
                    border: '#4f46e5' 
                },
                borderWidth: 2,
                font: { size: 16, color: '#1f2937', face: 'monospace' }
            };

            // If it's an Accept State, generate a custom Double Circle SVG
            if (isAccept) {
                // Calculate the radius needed based on how long the state name is
                const textWidth = name.length * 9.5; 
                const rOuter = Math.max(30, (textWidth / 2) + 12); // Outer ring
                const rInner = rOuter - 6;                         // Inner ring
                const svgSize = rOuter * 2 + 4;                    // Total canvas size
                const center = svgSize / 2;

                // Create the raw SVG markup
                const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}">
                    <circle cx="${center}" cy="${center}" r="${rOuter}" stroke="#4f46e5" stroke-width="2" fill="${isStart ? '#e0e7ff' : '#ffffff'}"/>
                    <circle cx="${center}" cy="${center}" r="${rInner}" stroke="#4f46e5" stroke-width="2" fill="${isStart ? '#e0e7ff' : '#ffffff'}"/>
                    <text x="${center}" y="${center}" dominant-baseline="central" font-family="monospace" font-size="16px" text-anchor="middle" fill="#1f2937">${name}</text>
                </svg>`;
                
                // Tell Vis.js to render this SVG as an image node
                nodeProps.shape = 'image';
                nodeProps.image = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
                nodeProps.label = undefined; // Hide the default text since we drew it inside the SVG
            }

            return nodeProps;
        });


    const edges = [];
    finalPartition.forEach((group, fromIndex) => {
        // We only need to check the transition of the FIRST state in the group
        // because by definition, all states in this group have identical behavior.
        const repState = group[0];
        
        dfa.alphabet.forEach(sym => {
            const targetState = dfa.transitions[repState][sym];
            const toIndex = finalPartition.findIndex(g => g.includes(targetState));
            
            // Check if edge already exists to group multiple symbols on one arrow
            let existingEdge = edges.find(e => e.from === fromIndex && e.to === toIndex);
            if (existingEdge) {
                existingEdge.label += `, ${sym}`;
            } else {
                edges.push({
                    from: fromIndex,
                    to: toIndex,
                    label: sym,
                    arrows: 'to',
                    font: { align: 'top' }
                });
            }
        });
    });

    const container = document.getElementById('network-graph');
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        physics: { enabled: true, barnesHut: { springLength: 150 } },
        nodes: { font: { size: 16 } },
        edges: { font: { size: 14 }, smooth: { type: 'dynamic' } }
    };

    new vis.Network(container, data, options);
    // ==========================================
    // GENERATE THE FINAL MINIMIZED TABLE
    // ==========================================
    const tableContainer = document.getElementById('minimized-table-container');
    let tableHTML = `<h3 style="margin-top: 25px; margin-bottom: 15px; text-align: center; color: #1e293b; font-weight: 700;">Minimized Transition Table</h3>
                     <div class="table-wrapper">
                     <table class="styled-table">
                     <thead><tr><th>State</th>`;
    
    // Add Alphabet Headers
    dfa.alphabet.forEach(sym => { tableHTML += `<th>Input '${sym}'</th>`; });
    tableHTML += `</tr></thead><tbody>`;

    // Add Rows for each minimized group
    finalPartition.forEach(group => {
        const stateName = '{' + group.join(', ') + '}';
        let badgesHTML = '';
        
        if (group.includes(dfa.start)) {
            badgesHTML += `<span class="badge badge-start">Start ➔</span>`;
        }
        if (group.some(s => dfa.accept.includes(s))) {
            badgesHTML += `<span class="badge badge-accept">★ Accept</span>`;
        }
        
        tableHTML += `<tr>
            <td style="text-align: left; padding-left: 20px;">
                <span class="state-name">${stateName}</span>${badgesHTML}
            </td>`;
        
        // Find where this group goes for each symbol
        dfa.alphabet.forEach(sym => {
            const repState = group[0];
            const targetState = dfa.transitions[repState][sym];
            
            if (targetState) {
                const targetGroup = finalPartition.find(g => g.includes(targetState));
                tableHTML += `<td><span class="state-name" style="color: #475569;">{${targetGroup.join(', ')}}</span></td>`;
            } else {
                tableHTML += `<td style="color: #94a3b8; font-weight: bold;">—</td>`; // Elegant dash for dead states
            }
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    tableContainer.innerHTML = tableHTML;}

// Load default example on startup
window.onload = initialize;