/* ============================================================
   DFA MINIMIZER — script.js
   Three input modes: Manual · Regex · Canvas Draw
   Core: Hopcroft / Table-filling minimization
   ============================================================ */

'use strict';

// ──────────────────────────────────────────────
// GLOBAL STATE
// ──────────────────────────────────────────────
let dfa = null;
let partitions = [];
let stepCount  = 0;
let isDone     = false;

// ──────────────────────────────────────────────
// PAGE LOAD
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    generateMatrixTable();

    const statesInput   = document.getElementById('states');
    const alphabetInput = document.getElementById('alphabet');
    const update = () => {
        if (statesInput.value.trim() && alphabetInput.value.trim()) generateMatrixTable();
    };
    statesInput.addEventListener('input', update);
    alphabetInput.addEventListener('input', update);

    initCanvas();
});

// ══════════════════════════════════════════════
// 1.  TAB SWITCHING
// ══════════════════════════════════════════════
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
}

// ══════════════════════════════════════════════
// 2.  MANUAL INPUT — MATRIX GENERATION
// ══════════════════════════════════════════════
function generateMatrixTable() {
    const states   = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
    const alphabet = document.getElementById('alphabet').value.split(',').map(s => s.trim()).filter(Boolean);
    if (!states.length || !alphabet.length) return;

    const head = document.getElementById('matrix-head');
    const body = document.getElementById('matrix-body');
    if (!head || !body) return;

    head.innerHTML = `<tr><th>State</th>${alphabet.map(s => `<th>δ(${s})</th>`).join('')}</tr>`;

    body.innerHTML = states.map(st => `
        <tr>
          <td>${st}</td>
          ${alphabet.map(sym => `<td><input type="text" class="field-input" data-from="${st}" data-sym="${sym}" placeholder="—"></td>`).join('')}
        </tr>
    `).join('');

    document.getElementById('matrix-container').style.display = 'block';
}

// ══════════════════════════════════════════════
// 3.  REGEX → NFA → DFA   (Thompson + Subset)
// ══════════════════════════════════════════════

/* ── 3. PRE-PROCESSING: Exponents (e.g., a^3 -> aaa) ── */
function expandExponents(regexStr) {
    let res = regexStr;
    let i = 0;
    while (i < res.length) {
        if (res[i] === '^') {
            let j = i + 1;
            let numStr = "";
            while (j < res.length && res[j] >= '0' && res[j] <= '9') {
                numStr += res[j];
                j++;
            }
            if (numStr.length > 0) {
                let count = parseInt(numStr, 10);
                let subject = "";
                let startIdx = 0;
                
                // If preceded by a group, trace back to find the matching '('
                if (res[i-1] === ')') {
                    let parens = 1;
                    let k = i - 2;
                    while (k >= 0 && parens > 0) {
                        if (res[k] === ')') parens++;
                        else if (res[k] === '(') parens--;
                        k--;
                    }
                    startIdx = k + 1;
                    subject = res.substring(startIdx, i);
                } else {
                    // Otherwise, just grab the preceding character
                    startIdx = i - 1;
                    subject = res.substring(startIdx, i);
                }
                
                let expanded = "";
                for(let c = 0; c < count; c++) expanded += subject;
                if (count === 0) expanded = "ε"; // Fallback for ^0

                res = res.substring(0, startIdx) + expanded + res.substring(j);
                i = startIdx + expanded.length; // Move cursor past the expanded text
                continue;
            }
        }
        i++;
    }
    return res;
}


/* ── 3a. Tokeniser ── */
function tokenise(re) {
    // Insert explicit concatenation operator '·' where needed
    const out = [];
    for (let i = 0; i < re.length; i++) {
        const c = re[i];
        out.push(c);
        if (i + 1 < re.length) {
            const n = re[i + 1];
            if (c !== '(' && c !== '|' &&
                n !== ')' && n !== '|' && n !== '*' && n !== '+' && n !== '?') {
                out.push('·');
            }
        }
    }
    return out;
}

/* ── 3b. Shunting-yard → postfix ── */
function toPostfix(tokens) {
    const prec = { '|': 1, '·': 2, '*': 3, '+': 3, '?': 3 };
    const assoc = { '|': 'L', '·': 'L', '*': 'R', '+': 'R', '?': 'R' };
    const out = [], ops = [];
    for (const tok of tokens) {
        if (tok === '(') {
            ops.push(tok);
        } else if (tok === ')') {
            while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
            ops.pop();
        } else if (prec[tok] !== undefined) {
            while (ops.length && ops[ops.length - 1] !== '(' &&
                   (prec[ops[ops.length - 1]] > prec[tok] ||
                    (prec[ops[ops.length - 1]] === prec[tok] && assoc[tok] === 'L'))) {
                out.push(ops.pop());
            }
            ops.push(tok);
        } else {
            out.push(tok);
        }
    }
    while (ops.length) out.push(ops.pop());
    return out;
}

/* ── 3c. Thompson NFA ── */
let _nfaId = 0;
function newState() { return 's' + (_nfaId++); }

function buildNFA(postfix) {
    _nfaId = 0;
    const stack = [];

    const makeEdge = (from, sym, to) => ({ from, sym, to });

    for (const tok of postfix) {
        if (tok === '·') {
            const b = stack.pop(), a = stack.pop();
            // merge a.end → b.start via ε
            const transitions = [...a.transitions, ...b.transitions,
                                  makeEdge(a.end, 'ε', b.start)];
            stack.push({ start: a.start, end: b.end, transitions });
        } else if (tok === '|') {
            const b = stack.pop(), a = stack.pop();
            const s = newState(), e = newState();
            const transitions = [
                makeEdge(s, 'ε', a.start), makeEdge(s, 'ε', b.start),
                makeEdge(a.end, 'ε', e),   makeEdge(b.end, 'ε', e),
                ...a.transitions, ...b.transitions
            ];
            stack.push({ start: s, end: e, transitions });
        } else if (tok === '*') {
            const a = stack.pop();
            const s = newState(), e = newState();
            const transitions = [
                makeEdge(s, 'ε', a.start), makeEdge(s, 'ε', e),
                makeEdge(a.end, 'ε', a.start), makeEdge(a.end, 'ε', e),
                ...a.transitions
            ];
            stack.push({ start: s, end: e, transitions });
        } else if (tok === '+') {
            const a = stack.pop();
            const s = newState(), e = newState();
            const transitions = [
                makeEdge(s, 'ε', a.start),
                makeEdge(a.end, 'ε', a.start), makeEdge(a.end, 'ε', e),
                ...a.transitions
            ];
            stack.push({ start: s, end: e, transitions });
        } else if (tok === '?') {
            const a = stack.pop();
            const s = newState(), e = newState();
            const transitions = [
                makeEdge(s, 'ε', a.start), makeEdge(s, 'ε', e),
                makeEdge(a.end, 'ε', e), ...a.transitions
            ];
            stack.push({ start: s, end: e, transitions });
        } else {
            // literal symbol
            const s = newState(), e = newState();
            stack.push({ start: s, end: e, transitions: [makeEdge(s, tok, e)] });
        }
    }
    return stack[0];
}

/* ── 3d. ε-closure ── */
function epsClosure(states, edges) {
    const closure = new Set(states);
    const queue   = [...states];
    while (queue.length) {
        const cur = queue.shift();
        for (const e of edges) {
            if (e.from === cur && e.sym === 'ε' && !closure.has(e.to)) {
                closure.add(e.to);
                queue.push(e.to);
            }
        }
    }
    return [...closure].sort();
}

/* ── 3e. Subset construction (NFA → DFA) ── */
function nfaToDFA(nfa, alphabet) {
    const edges   = nfa.transitions;
    const start   = epsClosure([nfa.start], edges);
    const stateKey = s => s.join(',');

    const dfaStates = [start];
    const dfaTrans  = {};
    const queue     = [start];
    const visited   = new Set([stateKey(start)]);

    while (queue.length) {
        const cur = queue.shift();
        const ck  = stateKey(cur);
        dfaTrans[ck] = {};
        for (const sym of alphabet) {
            // move
            const moved = [];
            for (const nfaState of cur) {
                for (const e of edges) {
                    if (e.from === nfaState && e.sym === sym) moved.push(e.to);
                }
            }
            const next = epsClosure(moved, edges);
            if (!next.length) continue;
            const nk = stateKey(next);
            dfaTrans[ck][sym] = nk;
            if (!visited.has(nk)) {
                visited.add(nk);
                dfaStates.push(next);
                queue.push(next);
            }
        }
    }

    // rename to q0, q1, ...
    const idx   = {};
    dfaStates.forEach((st, i) => { idx[stateKey(st)] = 'q' + i; });

    const states  = dfaStates.map((_, i) => 'q' + i);
    const startSt = idx[stateKey(start)];
    const accept  = dfaStates
        .filter(st => st.includes(nfa.end))
        .map(st => idx[stateKey(st)]);

    const transitions = {};
    for (const [ck, symMap] of Object.entries(dfaTrans)) {
        const name = idx[ck];
        transitions[name] = {};
        for (const [sym, nk] of Object.entries(symMap)) {
            transitions[name][sym] = idx[nk];
        }
    }

    return { states, alphabet, start: startSt, accept, transitions };
}

/* ── 3f. Public: convert regex then populate manual fields ── */
function convertRegexToDFA() {
    let re   = document.getElementById('regex-input').value.trim();
    const alph = document.getElementById('regex-alphabet').value.split(',').map(s => s.trim()).filter(Boolean);
    const status = document.getElementById('regex-status');

    if (!re) { showStatus(status, 'err', 'Please enter a regular expression.'); return; }
    if (!alph.length) { showStatus(status, 'err', 'Please enter the alphabet.'); return; }

    try {
        re = expandExponents(re); // Process exponents like ^3
        const tokens  = tokenise(re);
        const postfix = toPostfix(tokens);
        const nfa     = buildNFA(postfix);
        const result  = nfaToDFA(nfa, alph);

        // Populate manual fields
        document.getElementById('states').value  = result.states.join(',');
        document.getElementById('alphabet').value = result.alphabet.join(',');
        document.getElementById('start').value   = result.start;
        document.getElementById('accept').value  = result.accept.join(',');

        generateMatrixTable();

        // Fill matrix
        setTimeout(() => {
            document.querySelectorAll('#matrix-body input').forEach(inp => {
                const from = inp.getAttribute('data-from');
                const sym  = inp.getAttribute('data-sym');
                inp.value  = (result.transitions[from] && result.transitions[from][sym]) || '';
            });
        }, 60);

        const msg = `✓ Converted! ${result.states.length} states, ${result.accept.length} accept state(s).`;
        showStatus(status, 'ok', msg);

        // Switch to manual tab so user sees the filled matrix
        setTimeout(() => switchTab('manual'), 800);

    } catch (e) {
        showStatus(status, 'err', 'Parse error: ' + e.message);
    }
}

function showStatus(el, cls, msg) {
    el.className = 'regex-status ' + cls;
    el.textContent = msg;
    el.style.display = 'block';
}

// ══════════════════════════════════════════════
// 4.  CANVAS — HAND-DRAWN DFA INPUT
// ══════════════════════════════════════════════
const C = {
    states:       [],   // { id, x, y, accept, label }
    arrows:       [],   // { from, to, label }
    tool:         'state',
    dragging:     null,
    arrowFrom:    null,
    mouseX:       0,
    mouseY:       0,
    pendingArrow: null,
    dblTimer:     null,
    nextId:       0,
    canvas:       null,
    ctx:          null
};

function initCanvas() {
    C.canvas = document.getElementById('dfa-canvas');
    if (!C.canvas) return;
    C.ctx = C.canvas.getContext('2d');
    resizeCanvas();

    C.canvas.addEventListener('mousedown',  canvasDown);
    C.canvas.addEventListener('mousemove',  canvasMove);
    C.canvas.addEventListener('mouseup',    canvasUp);
    C.canvas.addEventListener('dblclick',   canvasDbl);
    C.canvas.addEventListener('touchstart', e => { e.preventDefault(); canvasDown(e.touches[0]); }, { passive: false });
    C.canvas.addEventListener('touchmove',  e => { e.preventDefault(); canvasMove(e.touches[0]); }, { passive: false });
    C.canvas.addEventListener('touchend',   e => { e.preventDefault(); canvasUp(e.changedTouches[0]); }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
    drawCanvas();
}

function resizeCanvas() {
    if (!C.canvas) return;
    const rect = C.canvas.getBoundingClientRect();
    C.canvas.width  = rect.width  || 380;
    C.canvas.height = 300;
    drawCanvas();
}

function setTool(t) {
    C.tool = t;
    C.arrowFrom = null;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-' + t)?.classList.add('active');
    drawCanvas();
}

function canvasPos(e) {
    const r = C.canvas.getBoundingClientRect();
    return { x: (e.clientX || e.pageX) - r.left, y: (e.clientY || e.pageY) - r.top };
}

function hitState(x, y) {
    return C.states.find(s => Math.hypot(s.x - x, s.y - y) <= 24);
}

function hitArrow(x, y) {
    return C.arrows.find(a => {
        const from = C.states.find(s => s.id === a.from);
        const to   = C.states.find(s => s.id === a.to);
        if (!from || !to) return false;
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        return Math.hypot(mx - x, my - y) < 22;
    });
}

function canvasDown(e) {
    const { x, y } = canvasPos(e);
    C.mouseX = x; C.mouseY = y;

    if (C.tool === 'state') {
        const hit = hitState(x, y);
        if (hit) { C.dragging = hit; return; }
        // Add new state
        const label = 'q' + C.nextId++;
        C.states.push({ id: C.nextId, x, y, accept: false, label });
        drawCanvas();
        return;
    }

    if (C.tool === 'arrow') {
        const hit = hitState(x, y);
        if (hit) {
            if (!C.arrowFrom) {
                C.arrowFrom = hit;
            } else {
                // complete arrow
                openArrowModal(C.arrowFrom.id, hit.id);
                C.arrowFrom = null;
            }
        } else {
            C.arrowFrom = null;
        }
        drawCanvas();
        return;
    }

    if (C.tool === 'erase') {
        const hitS = hitState(x, y);
        if (hitS) {
            C.states   = C.states.filter(s => s.id !== hitS.id);
            C.arrows   = C.arrows.filter(a => a.from !== hitS.id && a.to !== hitS.id);
            drawCanvas(); return;
        }
        const hitA = hitArrow(x, y);
        if (hitA) {
            C.arrows = C.arrows.filter(a => a !== hitA);
            drawCanvas();
        }
    }
}

function canvasMove(e) {
    const { x, y } = canvasPos(e);
    C.mouseX = x; C.mouseY = y;
    if (C.dragging) { C.dragging.x = x; C.dragging.y = y; }
    drawCanvas();
}

function canvasUp(e) {
    C.dragging = null;
}

function canvasDbl(e) {
    const { x, y } = canvasPos(e);
    const hit = hitState(x, y);
    if (hit) { hit.accept = !hit.accept; drawCanvas(); }
}

// ── Arrow label modal ──
let _arrowModalResolve = null;

function openArrowModal(fromId, toId) {
    C.pendingArrow = { from: fromId, to: toId };
    document.getElementById('arrow-label-input').value = '';
    document.getElementById('arrow-modal').classList.add('open');
    setTimeout(() => document.getElementById('arrow-label-input').focus(), 50);
}

function closeArrowModal(confirm) {
    document.getElementById('arrow-modal').classList.remove('open');
    if (confirm && C.pendingArrow) {
        const lbl = document.getElementById('arrow-label-input').value.trim() || '?';
        C.arrows.push({ from: C.pendingArrow.from, to: C.pendingArrow.to, label: lbl });
        drawCanvas();
    }
    C.pendingArrow = null;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('arrow-modal').classList.contains('open')) {
        closeArrowModal(true);
    }
    if (e.key === 'Escape') closeArrowModal(false);
});

// ── Draw ──
function drawCanvas() {
    if (!C.ctx) return;
    const ctx = C.ctx, W = C.canvas.width, H = C.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // arrows
    C.arrows.forEach(a => drawArrow(ctx, a));

    // live arrow preview
    if (C.arrowFrom && C.tool === 'arrow') {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(0,255,200,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(C.arrowFrom.x, C.arrowFrom.y);
        ctx.lineTo(C.mouseX, C.mouseY);
        ctx.stroke();
        ctx.restore();
    }

    // states
    C.states.forEach((s, i) => drawState(ctx, s, i === 0));
}

function drawState(ctx, s, isStart) {
    ctx.save();
    // outer circle
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
    ctx.fillStyle   = isStart ? 'rgba(0,255,200,0.15)' : 'rgba(167,139,250,0.12)';
    ctx.strokeStyle = isStart ? '#00ffc8' : (s.accept ? '#ff6b35' : '#a78bfa');
    ctx.lineWidth   = isStart || C.arrowFrom?.id === s.id ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();

    // double ring for accept
    if (s.accept) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 17, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // start arrow indicator
    if (isStart) {
        ctx.beginPath();
        ctx.moveTo(s.x - 40, s.y);
        ctx.lineTo(s.x - 24, s.y);
        ctx.strokeStyle = '#00ffc8'; ctx.lineWidth = 1.5;
        ctx.stroke();
        arrowHead(ctx, s.x - 24, s.y, 0);
    }

    // label
    ctx.font = '600 11px "Fira Code", monospace';
    ctx.fillStyle   = '#e8edf5';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, s.x, s.y);
    ctx.restore();
}

function drawArrow(ctx, a) {
    const from = C.states.find(s => s.id === a.from);
    const to   = C.states.find(s => s.id === a.to);
    if (!from || !to) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.fillStyle   = 'rgba(255,255,255,0.45)';

    if (from === to) {
        // self-loop
        ctx.beginPath();
        ctx.arc(from.x, from.y - 22, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '500 10px "Fira Code", monospace';
        ctx.fillStyle = '#00ffc8'; ctx.textAlign = 'center';
        ctx.fillText(a.label, from.x, from.y - 46);
        ctx.restore(); return;
    }

    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;

    const sx = from.x + ux * 24, sy = from.y + uy * 24;
    const ex = to.x   - ux * 24, ey = to.y   - uy * 24;

    ctx.beginPath();
    ctx.moveTo(sx, sy);

    // slight curve
    const cx = (sx + ex) / 2 - uy * 20, cy = (sy + ey) / 2 + ux * 20;
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    // arrow head
    const angle = Math.atan2(ey - cy, ex - cx);
    arrowHead(ctx, ex, ey, angle);

    // label
    ctx.font = '500 10px "Fira Code", monospace';
    ctx.fillStyle = '#00ffc8'; ctx.textAlign = 'center';
    ctx.fillText(a.label, (sx + cx) / 2 + (-uy * 6), (sy + cy) / 2 + (ux * 6) - 4);

    ctx.restore();
}

function arrowHead(ctx, x, y, angle) {
    const size = 8;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size,  size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function clearCanvas() {
    C.states = []; C.arrows = []; C.nextId = 0; C.arrowFrom = null;
    drawCanvas();
}

function extractCanvasDFA() {
    if (!C.states.length) { alert('Draw some states first!'); return; }

    const startSt = C.states[0];
    const alpha   = [...new Set(C.arrows.map(a => a.label.split(',').map(s => s.trim())).flat())].filter(Boolean);

    const states   = C.states.map(s => s.label);
    const accept   = C.states.filter(s => s.accept).map(s => s.label);
    const transMap = {};

    states.forEach(st => transMap[st] = {});
    C.arrows.forEach(a => {
        const from = C.states.find(s => s.id === a.from);
        const to   = C.states.find(s => s.id === a.to);
        if (!from || !to) return;
        a.label.split(',').forEach(sym => {
            sym = sym.trim();
            if (sym) transMap[from.label][sym] = to.label;
        });
    });

    document.getElementById('states').value   = states.join(',');
    document.getElementById('alphabet').value = alpha.join(',');
    document.getElementById('start').value    = startSt.label;
    document.getElementById('accept').value   = accept.join(',');

    generateMatrixTable();

    setTimeout(() => {
        document.querySelectorAll('#matrix-body input').forEach(inp => {
            const from = inp.getAttribute('data-from');
            const sym  = inp.getAttribute('data-sym');
            inp.value  = (transMap[from] && transMap[from][sym]) || '';
        });
    }, 60);

    switchTab('manual');
}

// ══════════════════════════════════════════════
// 5.  CORE DFA LOGIC — INITIALIZATION
// ══════════════════════════════════════════════
function initialize() {
    const statesRaw = document.getElementById('states').value.split(',').map(s => s.trim()).filter(Boolean);
    const alphabet  = document.getElementById('alphabet').value.split(',').map(s => s.trim()).filter(Boolean);
    const start     = document.getElementById('start').value.trim();
    const acceptRaw = document.getElementById('accept').value.split(',').map(s => s.trim()).filter(Boolean);

    const matrixInputs = document.querySelectorAll('#matrix-body input');
    if (!matrixInputs.length) { alert('Generate and fill the transition matrix first.'); return false; }

    const transitions = {};
    statesRaw.forEach(s => transitions[s] = {});
    matrixInputs.forEach(inp => {
        const state = inp.getAttribute('data-from');
        const sym   = inp.getAttribute('data-sym');
        const next  = inp.value.trim();
        if (next) transitions[state][sym] = next;
    });

    // BFS reachability
    const reachable = new Set([start]);
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift();
        if (!transitions[cur]) continue;
        alphabet.forEach(sym => {
            const nxt = transitions[cur][sym];
            if (nxt && !reachable.has(nxt)) { reachable.add(nxt); queue.push(nxt); }
        });
    }

    const states   = statesRaw.filter(s => reachable.has(s));
    const accept   = acceptRaw.filter(s => reachable.has(s));
    const removed  = statesRaw.filter(s => !reachable.has(s));

    dfa = { states, alphabet, start, accept, transitions };

    const nonAccept = states.filter(s => !accept.includes(s));
    let initialP = [];
    if (accept.length)    initialP.push(accept);
    if (nonAccept.length) initialP.push(nonAccept);

    partitions = [initialP];
    stepCount  = 0;
    isDone     = false;

    // Reset UI
    document.getElementById('partition-log').innerHTML       = '';
    document.getElementById('network-graph').innerHTML       = '<div class="graph-placeholder"><p>Running…</p></div>';
    document.getElementById('minimized-table-container').innerHTML = '';
    document.getElementById('dynamic-theory-content').innerHTML   = '';
    document.getElementById('dynamic-theory-panel').style.display = 'none';
    document.getElementById('btn-next').disabled = false;

    logPartition('P₀ (Init)', initialP, false);
    explainInitialization(accept, nonAccept, removed);

    return true;
}

// ══════════════════════════════════════════════
// 6.  CORE — NEXT STEP
// ══════════════════════════════════════════════
function nextStep() {
    if (isDone) return;

    const currentP = partitions[partitions.length - 1];
    let nextP = [];
    let splitDetails = [];

    const getGroupIndex = (state, sym, P) => {
        if (!dfa.transitions[state]) return -1;
        const tgt = dfa.transitions[state][sym];
        return P.findIndex(g => g.includes(tgt));
    };

    for (const group of currentP) {
        if (group.length === 1) { nextP.push(group); continue; }

        const sigMap = {};
        for (const st of group) {
            const sig = dfa.alphabet.map(sym => getGroupIndex(st, sym, currentP)).join('|');
            if (!sigMap[sig]) sigMap[sig] = [];
            sigMap[sig].push(st);
        }

        const sigKeys = Object.keys(sigMap);
        if (sigKeys.length > 1) {
            const stA = sigMap[sigKeys[0]][0], stB = sigMap[sigKeys[1]][0];
            let splitSym = '', destA, destB, grpA, grpB;
            for (const sym of dfa.alphabet) {
                const gA = getGroupIndex(stA, sym, currentP);
                const gB = getGroupIndex(stB, sym, currentP);
                if (gA !== gB) {
                    splitSym = sym;
                    destA = (dfa.transitions[stA] || {})[sym] || '∅';
                    destB = (dfa.transitions[stB] || {})[sym] || '∅';
                    grpA = gA; grpB = gB;
                    break;
                }
            }
            splitDetails.push({ originalGroup: group, stA, destA, grpA, stB, destB, grpB, sym: splitSym });
        }

        for (const sig in sigMap) nextP.push(sigMap[sig]);
    }

    stepCount++;
    const sortP = p => p.map(g => [...g].sort()).sort();
    const same  = JSON.stringify(sortP(currentP)) === JSON.stringify(sortP(nextP));

    if (same) {
        isDone = true;
        document.getElementById('btn-next').disabled = true;
        logPartition(`P${stepCount} (Complete ✓)`, nextP, true);
        explainStep(stepCount, currentP, nextP, []);
        drawGraph(nextP);
        generateMinimizedTable(nextP);
    } else {
        partitions.push(nextP);
        logPartition(`P${stepCount} (Split)`, nextP, false);
        explainStep(stepCount, currentP, nextP, splitDetails);
    }
}

// ══════════════════════════════════════════════
// 7.  UI — LIVE COMMENTARY
// ══════════════════════════════════════════════
function explainInitialization(accept, nonAccept, removed) {
    const panel = document.getElementById('dynamic-theory-panel');
    const box   = document.getElementById('dynamic-theory-content');
    panel.style.display = 'block';

    let html = `<h3>Step 0 — Initialization</h3>`;
    if (removed.length)
        html += `<p style="color:var(--coral)"><strong>Removed unreachable states:</strong> { ${removed.join(', ')} }</p>`;
    html += `
        <p>The algorithm separates states into two initial groups — accept states can never be equivalent to non-accept states.</p>
        <ul>
          <li><strong>Accept (F):</strong> { ${accept.join(', ') || 'none'} }</li>
          <li><strong>Non-accept (Q∖F):</strong> { ${nonAccept.join(', ') || 'none'} }</li>
        </ul>
        <div class="algo-result">P₀ = [ {${accept.join(', ')}} , {${nonAccept.join(', ')}} ]</div>
    `;
    box.innerHTML = html;
}

function explainStep(stepNum, oldP, newP, splits) {
    const box = document.getElementById('dynamic-theory-content');
    let html = `<h3>Step ${stepNum} — P${stepNum}</h3>`;

    if (!splits.length) {
        html += `
            <p style="color:var(--cyan)"><strong>No groups were split.</strong></p>
            <p>P${stepNum} is identical to P${stepNum - 1} — the minimization is complete.</p>
        `;
    } else {
        html += `<p>The following groups were split because states behave differently:</p>`;
        splits.forEach(d => {
            html += `
            <div class="split-detail">
              <strong>Group { ${d.originalGroup.join(', ')} }:</strong><br>
              On input <code>'${d.sym}'</code>, <strong>${d.stA}</strong> → ${d.destA} (group ${d.grpA}),
              but <strong>${d.stB}</strong> → ${d.destB} (group ${d.grpB}).
              <em style="color:var(--text-muted)">Different groups → must split.</em>
            </div>`;
        });
        const fmt = newP.map(g => `{${g.join(', ')}}`).join(', ');
        html += `<div class="algo-result">P${stepNum} = [ ${fmt} ]</div>`;
    }

    box.innerHTML += html;
    const panel = document.getElementById('dynamic-theory-panel');
    const tc    = document.getElementById('dynamic-theory-content');
    tc.scrollTop = tc.scrollHeight;
}

// ══════════════════════════════════════════════
// 8.  OUTPUT — PARTITION LOG
// ══════════════════════════════════════════════
function logPartition(title, groups, final) {
    const log  = document.getElementById('partition-log');
    const div  = document.createElement('div');
    div.className = 'partition-step' + (final ? ' final' : '');
    div.innerHTML = `<h4>${title}</h4>` +
        groups.map(g => `<span class="group">{ ${g.join(', ')} }</span>`).join('');
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

// ══════════════════════════════════════════════
// 9.  OUTPUT — GRAPH
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// 9.  OUTPUT — GRAPH
// ══════════════════════════════════════════════
function drawGraph(finalP) {
    const container = document.getElementById('network-graph');
    container.innerHTML = '';

    const options = {
        // Disabled hierarchical layout: this allows for curvedCW edges 
        // to properly separate bidirectional arrows and fix self-loops.
        layout: {
            hierarchical: false 
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -3500,
                centralGravity: 0.15,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.15
            },
            stabilization: { enabled: true, iterations: 1000, fit: true }
        },
        edges: { 
            smooth: { 
                enabled: true,
                type: 'curvedCW', // Separates A->B and B->A into a neat loop
                roundness: 0.25 
            },
            color: { color: '#6b7a96', highlight: '#00ffc8' }, 
            font: { 
                color: '#00ffc8', 
                size: 14, 
                face: 'Fira Code', 
                align: 'top', // Prevents label from slicing directly through the line
                background: '#0e1420', 
                strokeWidth: 0 
            },
            arrows: { to: { enabled: true, scaleFactor: 1.1 } },
            width: 2,
            selfReferenceSize: 35, 
            selfReference: { 
                size: 35, 
                angle: Math.PI / 4, // Angles the self-loop cleanly to the top-right
                renderBehindTheNode: false 
            }
        },
        nodes: { 
            font: { face: 'Fira Code', color: '#e8edf5' },
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10 }
        },
        interaction: { zoomView: true, dragView: true, hover: true }
    };

    const nodes = finalP.map((group, i) => {
        const name    = '{' + group.join(',') + '}';
        const isAccept = group.some(s => dfa.accept.includes(s));
        const isStart  = group.includes(dfa.start);

        if (isAccept) {
            const r = Math.max(32, name.length * 5 + 18);
            const sz = r * 2 + 4; const cx = sz / 2;
            const bg = isStart ? '#0e2820' : '#0e1420';
            const stk = isStart ? '#00ffc8' : '#ff6b35';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}">
                <circle cx="${cx}" cy="${cx}" r="${r}"   stroke="${stk}" stroke-width="2" fill="${bg}"/>
                <circle cx="${cx}" cy="${cx}" r="${r-7}" stroke="${stk}" stroke-width="1.5" fill="${bg}"/>
                <text x="${cx}" y="${cx}" dominant-baseline="central" font-family="Fira Code" font-size="12" text-anchor="middle" fill="#e8edf5">${name}</text>
            </svg>`;
            // Added `size: r` so the edges attach to the outer border, not the center
            return { id: i, label: undefined, shape: 'image', image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), size: r };
        }

        return {
            id: i, label: name, shape: 'ellipse',
            color: { background: isStart ? '#0e2820' : '#14142a', border: isStart ? '#00ffc8' : '#a78bfa', highlight: { background: '#1a2030', border: '#00ffc8' } }
        };
    });

    const edges = [];
    finalP.forEach((group, fi) => {
        const rep = group[0];
        if (!dfa.transitions[rep]) return;
        dfa.alphabet.forEach(sym => {
            const tgt = dfa.transitions[rep][sym];
            if (!tgt) return;
            const ti = finalP.findIndex(g => g.includes(tgt));
            if (ti === -1) return;
            
            const ex = edges.find(e => e.from === fi && e.to === ti);
            if (ex) {
                let labels = ex.label.split(',').map(s => s.trim());
                if (!labels.includes(sym)) labels.push(sym);
                ex.label = labels.sort().join(', ');
            } else {
                edges.push({ from: fi, to: ti, label: sym });
            }
        });
    });

    const network = new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, options);
    network.once('stabilizationIterationsDone', () => {
        network.fit({ animation: { duration: 600 } });
    });
    network.on('zoom', p => {
        if (p.scale < 0.3) network.moveTo({ scale: 0.3 });
        if (p.scale > 3)   network.moveTo({ scale: 3 });
    });
}

// ══════════════════════════════════════════════
// 10.  OUTPUT — MINIMIZED TABLE
// ══════════════════════════════════════════════
function generateMinimizedTable(finalP) {
    const wrap = document.getElementById('minimized-table-container');

    const thCols = dfa.alphabet.map(s => `<th>δ('${s}')</th>`).join('');
    const rows = finalP.map(group => {
        const name    = '{' + group.join(', ') + '}';
        const isStart  = group.includes(dfa.start);
        const isAccept = group.some(s => dfa.accept.includes(s));
        const badges   =
            (isStart  ? '<span class="badge-start">start</span>'  : '') +
            (isAccept ? '<span class="badge-accept">accept</span>' : '');

        const cells = dfa.alphabet.map(sym => {
            const tgt = dfa.transitions[group[0]]?.[sym];
            if (!tgt) return '<td>—</td>';
            const tg = finalP.find(g => g.includes(tgt));
            return `<td>{${tg ? tg.join(', ') : '—'}}</td>`;
        }).join('');

        return `<tr><td><strong>${name}</strong>${badges}</td>${cells}</tr>`;
    }).join('');

    wrap.innerHTML = `
        <div class="viz-section">
          <h3 class="viz-heading"><span class="viz-dot accent2"></span>Minimized Transition Table</h3>
          <div class="min-table-wrap">
            <table class="min-table">
              <thead><tr><th>State</th>${thCols}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
}

// ══════════════════════════════════════════════
// 11.  CONTROLS
// ══════════════════════════════════════════════
function minimizeDFA() {
    if (initialize()) {
        while (!isDone) nextStep();
    }
}

function resetApp() {
    window.location.reload();
}
// ══════════════════════════════════════════════
// 12. REGEX TOOLBAR INSERTER
// ══════════════════════════════════════════════
function insertRegex(char) {
    const input = document.getElementById('regex-input');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    
    // If it's the parenthesis button, insert () and put cursor inside
    if (char === '()') {
        input.value = text.slice(0, start) + '()' + text.slice(end);
        input.setSelectionRange(start + 1, start + 1);
    } 
    // Otherwise, insert the character and move cursor after it
    else {
        input.value = text.slice(0, start) + char + text.slice(end);
        input.setSelectionRange(start + char.length, start + char.length);
    }
    
    // Return focus to the input box so they can keep typing seamlessly
    input.focus();
}
