/* ai1.js - Optimized AI with Smart Stacking Strategy */

const AI_CONFIG = {
    maxDepth: 6,
    timeLimit: 8000,
    useIterativeDeepening: true,
    useMoveOrdering: true,
    useTranspositionTable: true,
    aggressiveBlocking: true,
    smartStacking: true,  // NEW: Prioritize stacking over blocking
    forwardThinking: true
};

const transpositionTable = new Map();
const transpositionTableParanoid = new Map()

// Expose a single entrypoint for script.js
window.runAITurn = async function runAITurn() {
    if (game.gameEnded) return

    const player = game.players[game.currentPlayer]
    if (!player?.isAI) return

    document.getElementById('aiThinking').style.display = 'block'

    // Small delay so UI can render the "thinking" banner
    setTimeout(async () => {
        const startTime = Date.now()

        try {
            const move = findMoveByAIProfile(player, startTime)

            if (move) {
                showAIReason(`AI ${player.aiType.toUpperCase()} (L${player.aiLevel}) memilih kartu ${move.card.value} untuk posisi (${move.row},${move.col})`)
                game.selectedCard = move.card
                updateUI()
                setTimeout(async () => {
                    await executeMove(move.row, move.col)
                    const cell = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`)
                    if (cell) {
                      const badge = document.createElement('div')
                      badge.className = 'ai-card-played'
                      badge.textContent = move.card.value
                      cell.appendChild(badge)
                      setTimeout(() => badge.remove(), 1200)
                    }
                    document.getElementById('aiThinking').style.display = 'none'
                }, 350)
            } else {
                console.error('AI could not find valid move!')
                document.getElementById('aiThinking').style.display = 'none'
            }
        } catch (e) {
            console.error('AI error:', e)
            document.getElementById('aiThinking').style.display = 'none'
        }

        const elapsed = Date.now() - startTime
        // === TRACK AI THINK TIME ===
        const key = `${player.aiType}:L${player.aiLevel}`
        if (!matchStats.aiTurns[key]) {
          matchStats.aiTurns[key] = { totalTime: 0, count: 0 }
        }
        matchStats.aiTurns[key].totalTime += elapsed
        matchStats.aiTurns[key].count++
        console.log(`[AI] ${player.name} (${player.aiType}:L${player.aiLevel}) decided in ${elapsed}ms`)
    }, 300)
}

function showAIReason(text, tag = 'SEARCH') {
  const overlay = document.getElementById('aiReasonOverlay')
  if (!overlay) return

  const player = game.players[game.currentPlayer]
  if (player) player.lastAIReason = tag

  overlay.textContent = `[${tag}] ${text}`
  overlay.style.display = 'block'
  setTimeout(() => overlay.style.display = 'none', 1800)
}

function findMoveByAIProfile(player, startTime) {
    const type = player.aiType || 'smart'
    const level = player.aiLevel || 2

    if (type === 'paranoid') {
        return findBestMoveParanoid(player, startTime, level)
    }

    // default: smart
    return findBestMoveSmart(player, startTime, level)
}

function findBestMoveSmart(player, startTime, level) {
    const aiColor = player.color;
    
    console.log('Phase 1: Checking immediate win...');
    const winMove = findImmediateWin(player);
    if (winMove) {
        showAIReason('Menang langsung!', 'WIN')
        console.log('✓ IMMEDIATE WIN FOUND!');
        return winMove;
    }
    
    console.log('Phase 2: Checking critical threats...');
    const criticalDefense = findCriticalThreats(player);
    if (criticalDefense) {
        showAIReason('Blokir lawan kritis!', 'BLOCK')
        console.log('✓ BLOCKING CRITICAL THREAT!');
        return criticalDefense;
    }
    
    // NEW PHASE 2.3: Smart Stacking Strategy
    console.log('Phase 2.3: Evaluating smart stacking...');
    const stackingMove = findOptimalStackingMove(player);
    if (stackingMove) {
        showAIReason('Stacking musuh strategis!', 'STACK')
        console.log('✓ SMART STACKING EXECUTED!');
        return stackingMove;
    }
    
    console.log('Phase 2.5: Aggressive blocking...');
    const aggressiveBlock = findAggressiveBlockingMove(player);
    if (aggressiveBlock) {
        showAIReason('Blok agresif!', 'BLOCK')
        console.log('✓ AGGRESSIVE BLOCK EXECUTED!');
        return aggressiveBlock;
    }
    
    console.log('Phase 3: Strategic search...')

    // Level mapping:
    // L1: Greedy only (win/block/stack/aggressive block)
    // L2: Shallow minimax
    // L3: Existing iterative deepening
    if (level === 1) {
        showAIReason('Greedy fallback', 'SEARCH')
        const fallback = generateAllPossibleMoves(player)
        return fallback[0] || null
    }

    if (level === 2) {
        showAIReason('Shallow minimax', 'SEARCH')
        return minimaxDepthSearch(player, startTime, 2)
    }

    showAIReason('Iterative deepening', 'SEARCH')
    return iterativeDeepeningSearch(player, startTime)
}

function minimaxDepthSearch(player, startTime, fixedDepth) {
    const moves = generateAllPossibleMoves(player)
    if (moves.length === 0) return null

    const aiColor = player.color
    let bestMove = moves[0]
    let bestScore = -Infinity
    let alpha = -Infinity
    let beta = Infinity

    orderMoves(moves, aiColor)

    for (const move of moves) {
        const backup = makeMove(move, aiColor)

        const score = minimaxAlphaBeta(
            fixedDepth - 1,
            false,
            alpha,
            beta,
            aiColor,
            startTime
        )

        undoMove(move, backup)

        if (score > bestScore) {
            bestScore = score
            bestMove = move
        }
        alpha = Math.max(alpha, score)

        if (Date.now() - startTime > 1200) break
    }

    return bestMove
}
function findBestMoveParanoid(player, startTime, level) {
    const aiColor = player.color

    // Choose depth by level
    const depth = level === 1 ? 1 : (level === 2 ? 2 : 3)

    const moves = generateAllPossibleMoves(player)
    if (moves.length === 0) return null

    orderMoves(moves, aiColor)

    let bestMove = moves[0]
    let bestScore = -Infinity
    let alpha = -Infinity
    let beta = Infinity

    for (const move of moves) {
        const backup = makeMove(move, aiColor)

        const score = paranoidAlphaBeta(
            depth - 1,
            alpha,
            beta,
            aiColor,
            startTime
        )

        undoMove(move, backup)

        if (score > bestScore) {
            bestScore = score
            bestMove = move
        }

        alpha = Math.max(alpha, bestScore)
        if (beta <= alpha) break

        // time guard
        if (Date.now() - startTime > (level === 3 ? 3500 : 1500)) break
    }

    return bestMove
}

// Paranoid search: treat all opponents as a single minimizing coalition.
function paranoidAlphaBeta(depth, alpha, beta, aiColor, startTime) {
    if (Date.now() - startTime > 6000) {
        return evaluatePosition(aiColor)
    }

    // Terminal checks
    if (checkColorWins(aiColor)) return 1000000 + depth * 10000
    for (const opp of game.players) {
        if (opp.color !== aiColor && checkColorWins(opp.color)) {
            return -1000000 - depth * 10000
        }
    }
    if (depth === 0) return evaluatePosition(aiColor)

    const boardHash = getBoardHash()
    const key = `${boardHash}_P_${depth}`
    if (AI_CONFIG.useTranspositionTable && transpositionTableParanoid.has(key)) {
        return transpositionTableParanoid.get(key)
    }

    // Minimizing coalition picks the move that minimizes AI's evaluation,
    // regardless of which opponent's turn it is.
    let best = Infinity

    // Generate a pooled list of opponent moves.
    const oppMoves = []
    for (const opp of game.players) {
        if (opp.color === aiColor) continue
        const moves = generateAllTheoreticalMoves(opp.color)
        for (const m of moves) oppMoves.push({ move: m, color: opp.color })
    }

    // If no opponent theoretical moves, fallback
    if (oppMoves.length === 0) return evaluatePosition(aiColor)

    // Simple ordering: try center-ish first
    oppMoves.sort((a, b) => {
        const da = Math.abs(a.move.row - 4) + Math.abs(a.move.col - 4)
        const db = Math.abs(b.move.row - 4) + Math.abs(b.move.col - 4)
        return da - db
    })

    for (const item of oppMoves) {
        const backup = makeMove(item.move, item.color)

        // After opponents move, AI is assumed to respond optimally (max node)
        const score = paranoidMaxNode(depth - 1, alpha, beta, aiColor, startTime)

        undoMove(item.move, backup)

        best = Math.min(best, score)
        beta = Math.min(beta, best)
        if (beta <= alpha) break

        if (Date.now() - startTime > 6000) break
    }

    if (AI_CONFIG.useTranspositionTable) transpositionTableParanoid.set(key, best)
    return best
}

function paranoidMaxNode(depth, alpha, beta, aiColor, startTime) {
    if (Date.now() - startTime > 6000) return evaluatePosition(aiColor)

    if (checkColorWins(aiColor)) return 1000000 + depth * 10000
    for (const opp of game.players) {
        if (opp.color !== aiColor && checkColorWins(opp.color)) {
            return -1000000 - depth * 10000
        }
    }
    if (depth === 0) return evaluatePosition(aiColor)

    let best = -Infinity

    const moves = generateAllTheoreticalMoves(aiColor)
    if (AI_CONFIG.useMoveOrdering) orderMoves(moves, aiColor)

    for (const move of moves) {
        const backup = makeMove(move, aiColor)
        const score = paranoidAlphaBeta(depth - 1, alpha, beta, aiColor, startTime)
        undoMove(move, backup)

        best = Math.max(best, score)
        alpha = Math.max(alpha, best)
        if (beta <= alpha) break

        if (Date.now() - startTime > 6000) break
    }

    return best
}

function findImmediateWin(player) {
    const aiColor = player.color;
    const moves = generateAllPossibleMoves(player);
    
    for (let move of moves) {
        const backup = game.board[move.row][move.col];
        game.board[move.row][move.col] = {value: move.card.value, color: aiColor};
        const wins = checkColorWins(aiColor);
        game.board[move.row][move.col] = backup;
        
        if (wins) return move;
    }
    return null;
}

function findCriticalThreats(player) {
    const aiColor = player.color;
    const opponents = game.players.filter(p => p.color !== aiColor);
    let threats = [];
    
    for (let opponent of opponents) {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (!canPlaceAt(i, j)) continue;
                
                const backup = game.board[i][j];
                game.board[i][j] = {value: 9, color: opponent.color};
                const opponentWins = checkColorWins(opponent.color);
                game.board[i][j] = backup;
                
                if (opponentWins) {
                    const threatLevel = evaluateThreatLevel(i, j, opponent.color);
                    threats.push({row: i, col: j, opponent: opponent.color, level: threatLevel});
                }
            }
        }
    }
    
    threats.sort((a, b) => b.level - a.level);
    
    if (threats.length > 0) {
        const threat = threats[0];
        for (let card of player.hand.sort((a, b) => b.value - a.value)) {
            if (isValidMoveWithCard(threat.row, threat.col, card)) {
                console.log(`Blocking ${threat.opponent} at (${threat.row},${threat.col}) - Level: ${threat.level}`);
                return {row: threat.row, col: threat.col, card: card};
            }
        }
    }
    return null;
}

/**
 * NEW: Smart Stacking Strategy - Prioritize stacking over blocking when beneficial
 */
function findOptimalStackingMove(player) {
    const aiColor = player.color;
    const opponents = game.players.filter(p => p.color !== aiColor);
    
    let stackingOptions = [];
    
    // Find all stackable positions (enemy cards on board)
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const cell = game.board[i][j];
            if (!cell) continue;
            
            // Check if it's an opponent's card
            const isOpponent = opponents.some(opp => opp.color === cell.color);
            if (!isOpponent) continue;
            
            // Evaluate if stacking here is valuable
            for (let card of player.hand) {
                if (card.value <= cell.value) continue; // Can't stack
                
                const stackValue = evaluateStackingValue(i, j, card, cell, aiColor);
                
                if (stackValue > 0) {
                    stackingOptions.push({
                        row: i,
                        col: j,
                        card: card,
                        stackValue: stackValue,
                        enemyCard: cell
                    });
                }
            }
        }
    }
    
    if (stackingOptions.length === 0) return null;
    
    // Sort by stack value
    stackingOptions.sort((a, b) => b.stackValue - a.stackValue);
    
    const bestStack = stackingOptions[0];
    
    // Only stack if it's significantly valuable (threshold)
    if (bestStack.stackValue > 1200) {
        console.log(`Stacking on enemy card at (${bestStack.row},${bestStack.col})`);
        console.log(`  Enemy card: ${bestStack.enemyCard.value} (${bestStack.enemyCard.color})`);
        console.log(`  Our card: ${bestStack.card.value}`);
        console.log(`  Stack value: ${bestStack.stackValue}`);
        return bestStack;
    }
    
    return null;
}

/**
 * Evaluate the value of stacking on an enemy card
 */
function evaluateStackingValue(row, col, ourCard, enemyCard, aiColor) {
    let value = 0;
    
    // 1. Disruption Value - breaking enemy sequences
    const enemySequenceValue = evaluateSequenceDisruption(row, col, enemyCard.color);
    value += enemySequenceValue;
    
    // 2. Our Sequence Building Value
    const backup = game.board[row][col];
    game.board[row][col] = {value: ourCard.value, color: aiColor};
    const ourSequenceValue = evaluatePositionForSequence(row, col, aiColor);
    game.board[row][col] = backup;
    value += ourSequenceValue;
    
    // 3. Strategic Position Value
    const distToCenter = Math.abs(row - 4) + Math.abs(col - 4);
    value += (8 - distToCenter) * 80;
    
    // 4. Card Efficiency - prefer using high cards to stack on high enemy cards
    const cardEfficiency = (ourCard.value - enemyCard.value) * 30;
    value += cardEfficiency;
    
    // 5. Blocking Multiple Threats
    const blockingMultiple = checksIfBlocksMultipleThreats(row, col);
    value += blockingMultiple * 500;
    
    // 6. Creating Fork Opportunity
    const forkPotential = evaluateForkAfterStack(row, col, aiColor);
    value += forkPotential;
    
    return value;
}

/**
 * Evaluate how much we disrupt enemy sequences by stacking
 */
function evaluateSequenceDisruption(row, col, enemyColor) {
    let disruptionValue = 0;
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (let [dr, dc] of directions) {
        let sequenceLength = 1; // Count the card at (row, col)
        
        // Count in both directions
        for (let dir of [-1, 1]) {
            for (let k = 1; k < 4; k++) {
                const r = row + k * dr * dir;
                const c = col + k * dc * dir;
                
                if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                
                if (game.board[r][c]?.color === enemyColor) {
                    sequenceLength++;
                } else {
                    break;
                }
            }
        }
        
        // Value based on sequence length we're disrupting
        if (sequenceLength >= 3) disruptionValue += 2500; // Breaking 3+ in a row
        else if (sequenceLength === 2) disruptionValue += 1000; // Breaking 2 in a row
    }
    
    return disruptionValue;
}

/**
 * Evaluate if position helps build our sequence
 */
function evaluatePositionForSequence(row, col, aiColor) {
    let sequenceValue = 0;
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (let [dr, dc] of directions) {
        let count = 1;
        let openEnds = 0;
        
        for (let dir of [-1, 1]) {
            let foundOpen = false;
            for (let k = 1; k < 4; k++) {
                const r = row + k * dr * dir;
                const c = col + k * dc * dir;
                
                if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                
                if (game.board[r][c]?.color === aiColor) {
                    count++;
                } else if (!game.board[r][c] && !foundOpen) {
                    openEnds++;
                    foundOpen = true;
                    break;
                } else {
                    break;
                }
            }
        }
        
        // Value our sequences
        if (count >= 3) {
            if (openEnds >= 1) sequenceValue += 1500;
            else sequenceValue += 800;
        } else if (count === 2) {
            if (openEnds >= 2) sequenceValue += 600;
            else if (openEnds === 1) sequenceValue += 300;
        }
    }
    
    return sequenceValue;
}

/**
 * Check if this position blocks multiple enemy threats
 */
function checksIfBlocksMultipleThreats(row, col) {
    const opponents = game.players.filter(p => p.color !== game.players[game.currentPlayer].color);
    let threatCount = 0;
    
    for (let opp of opponents) {
        const threats = findOpponentThreats(opp.color);
        for (let threat of threats) {
            if (threat.blockPositions.some(pos => pos.row === row && pos.col === col)) {
                threatCount++;
            }
        }
    }
    
    return threatCount;
}

/**
 * Evaluate if stacking here creates fork opportunities
 */
function evaluateForkAfterStack(row, col, aiColor) {
    let forkValue = 0;
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    let potentialThreats = 0;
    
    for (let [dr, dc] of directions) {
        let count = 1;
        let openEnds = 0;
        
        for (let dir of [-1, 1]) {
            for (let k = 1; k < 3; k++) {
                const r = row + k * dr * dir;
                const c = col + k * dc * dir;
                
                if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                
                if (game.board[r][c]?.color === aiColor) {
                    count++;
                } else if (!game.board[r][c]) {
                    openEnds++;
                    break;
                } else {
                    break;
                }
            }
        }
        
        if (count >= 2 && openEnds > 0) {
            potentialThreats++;
        }
    }
    
    if (potentialThreats >= 2) {
        forkValue = 800 * potentialThreats;
    }
    
    return forkValue;
}

function evaluateThreatLevel(row, col, color) {
    let level = 100;
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (let [dr, dc] of directions) {
        let count = 1;
        for (let dir of [-1, 1]) {
            for (let k = 1; k < 4; k++) {
                const r = row + k * dr * dir;
                const c = col + k * dc * dir;
                if (r >= 0 && r < 9 && c >= 0 && c < 9 && 
                    game.board[r][c]?.color === color) {
                    count++;
                } else break;
            }
        }
        if (count >= 4) level += 10000;
        else if (count === 3) level += 1000;
        else if (count === 2) level += 100;
    }
    return level;
}

function findAggressiveBlockingMove(player) {
    const aiColor = player.color;
    const opponents = game.players.filter(p => p.color !== aiColor);
    let blockingMoves = [];
    
    for (let opponent of opponents) {
        const threats = findOpponentThreats(opponent.color);
        
        for (let threat of threats) {
            for (let pos of threat.blockPositions) {
                for (let card of player.hand) {
                    if (isValidMoveWithCard(pos.row, pos.col, card)) {
                        const score = evaluateBlockingValue(pos.row, pos.col, card, threat);
                        blockingMoves.push({row: pos.row, col: pos.col, card: card, score: score});
                    }
                }
            }
        }
    }
    
    if (blockingMoves.length > 0) {
        blockingMoves.sort((a, b) => b.score - a.score);
        if (blockingMoves[0].score > 500) {
            return blockingMoves[0];
        }
    }
    return null;
}

function findOpponentThreats(color) {
    const threats = [];
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    const checked = new Set();
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color !== color) continue;
            
            for (let [dr, dc] of directions) {
                const key = `${i},${j},${dr},${dc}`;
                if (checked.has(key)) continue;
                
                let count = 0;
                let positions = [];
                let blockPositions = [];
                
                let k = 0;
                while (k < 5) {
                    const r = i + k * dr;
                    const c = j + k * dc;
                    
                    if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                    
                    if (game.board[r][c]?.color === color) {
                        count++;
                        positions.push({row: r, col: c});
                        checked.add(`${r},${c},${dr},${dc}`);
                        k++;
                    } else if (!game.board[r][c] && canPlaceAt(r, c)) {
                        blockPositions.push({row: r, col: c});
                        k++;
                    } else {
                        break;
                    }
                }
                
                const r_before = i - dr;
                const c_before = j - dc;
                if (r_before >= 0 && r_before < 9 && c_before >= 0 && c_before < 9) {
                    if (!game.board[r_before][c_before] && canPlaceAt(r_before, c_before)) {
                        blockPositions.push({row: r_before, col: c_before});
                    }
                }
                
                if (count >= 2) {
                    threats.push({
                        count: count,
                        positions: positions,
                        blockPositions: blockPositions,
                        direction: [dr, dc]
                    });
                }
            }
        }
    }
    
    return threats.sort((a, b) => b.count - a.count);
}

function evaluateBlockingValue(row, col, card, threat) {
    let score = 0;
    
    if (threat.count === 3) score += 2000;
    else if (threat.count === 2) score += 800;
    
    score += threat.blockPositions.length * 100;
    score -= card.value * 10;
    
    const distToCenter = Math.abs(row - 4) + Math.abs(col - 4);
    score += (8 - distToCenter) * 50;
    
    return score;
}

function iterativeDeepeningSearch(player, startTime) {
    let bestMove = null;
    let bestScore = -Infinity;
    
    for (let depth = 1; depth <= AI_CONFIG.maxDepth; depth++) {
        if (Date.now() - startTime > AI_CONFIG.timeLimit) {
            console.log(`Time limit reached at depth ${depth}`);
            break;
        }
        
        console.log(`Searching at depth ${depth}...`);
        
        const moves = generateAllPossibleMoves(player);
        
        if (AI_CONFIG.useMoveOrdering && depth > 1) {
            orderMoves(moves, player.color);
        }
        
        let alpha = -Infinity;
        let beta = Infinity;
        
        for (let move of moves) {
            const backup = makeMove(move, player.color);
            
            const score = minimaxAlphaBeta(
                depth - 1, 
                false, 
                alpha, 
                beta, 
                player.color,
                startTime
            );
            
            undoMove(move, backup);
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                alpha = score;
            }
            
            if (Date.now() - startTime > AI_CONFIG.timeLimit) break;
        }
        
        console.log(`Depth ${depth}: Best score = ${bestScore}`);
    }
    
    return bestMove || generateAllPossibleMoves(player)[0];
}

function minimaxAlphaBeta(depth, isMaximizing, alpha, beta, aiColor, startTime) {
    if (Date.now() - startTime > AI_CONFIG.timeLimit) {
        return evaluatePosition(aiColor);
    }
    
    if (checkColorWins(aiColor)) {
        return 1000000 + depth * 10000;
    }
    
    for (let opp of game.players) {
        if (opp.color !== aiColor && checkColorWins(opp.color)) {
            return -1000000 - depth * 10000;
        }
    }
    
    if (depth === 0) {
        return evaluatePosition(aiColor);
    }
    
    const boardHash = getBoardHash();
    const ttKey = `${boardHash}_${depth}_${isMaximizing}`;
    if (AI_CONFIG.useTranspositionTable && transpositionTable.has(ttKey)) {
        return transpositionTable.get(ttKey);
    }
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        const moves = generateAllTheoreticalMoves(aiColor);
        
        if (AI_CONFIG.useMoveOrdering) {
            orderMoves(moves, aiColor);
        }
        
        for (let move of moves) {
            const backup = makeMove(move, aiColor);
            
            const eval_score = minimaxAlphaBeta(
                depth - 1, 
                false, 
                alpha, 
                beta, 
                aiColor,
                startTime
            );
            
            undoMove(move, backup);
            
            maxEval = Math.max(maxEval, eval_score);
            alpha = Math.max(alpha, eval_score);
            
            if (beta <= alpha) break;
        }
        
        if (AI_CONFIG.useTranspositionTable) {
            transpositionTable.set(ttKey, maxEval);
        }
        
        return maxEval;
    } else {
        let minEval = Infinity;
        
        for (let opp of game.players) {
            if (opp.color === aiColor) continue;
            
            const moves = generateAllTheoreticalMoves(opp.color);
            
            for (let move of moves) {
                const backup = makeMove(move, opp.color);
                
                const eval_score = minimaxAlphaBeta(
                    depth - 1, 
                    true, 
                    alpha, 
                    beta, 
                    aiColor,
                    startTime
                );
                
                undoMove(move, backup);
                
                minEval = Math.min(minEval, eval_score);
                beta = Math.min(beta, eval_score);
                
                if (beta <= alpha) break;
            }
            
            if (beta <= alpha) break;
        }
        
        if (AI_CONFIG.useTranspositionTable) {
            transpositionTable.set(ttKey, minEval);
        }
        
        return minEval;
    }
}

function evaluatePosition(aiColor) {
    let score = 0;
    
    const aiSeq = analyzeSequences(aiColor);
    score += aiSeq.four * 100000;
    score += aiSeq.three * 8000;
    score += aiSeq.threeOpen * 12000;
    score += aiSeq.two * 800;
    score += aiSeq.twoOpen * 1500;
    
    for (let opp of game.players) {
        if (opp.color === aiColor) continue;
        
        const oppSeq = analyzeSequences(opp.color);
        score -= oppSeq.four * 150000;
        score -= oppSeq.three * 9000;
        score -= oppSeq.threeOpen * 13000;
        score -= oppSeq.two * 900;
        score -= oppSeq.twoOpen * 1600;
    }
    
    score += evaluatePositionalAdvantage(aiColor) * 150;
    score += countValidPositions(aiColor) * 80;
    score += evaluateCenterDominance(aiColor) * 300;
    score += evaluatePatterns(aiColor) * 400;
    score += evaluateForkingPotential(aiColor) * 600;
    score += evaluateOpponentRestriction(aiColor) * 250;
    score += evaluateStackingAdvantage(aiColor) * 350; // NEW
    
    return score;
}

/**
 * NEW: Evaluate stacking advantage
 */
function evaluateStackingAdvantage(aiColor) {
    let advantage = 0;
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const cell = game.board[i][j];
            if (!cell || cell.color === aiColor) continue;
            
            // Enemy card that we could potentially stack on
            const distToCenter = Math.abs(i - 4) + Math.abs(j - 4);
            const positionValue = (8 - distToCenter) * 2;
            
            // Check if it's in a sequence
            const inSequence = isPartOfSequence(i, j, cell.color);
            if (inSequence) {
                advantage += positionValue * 3; // High value if in sequence
            } else {
                advantage += positionValue;
            }
        }
    }
    
    return advantage;
}

function isPartOfSequence(row, col, color) {
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (let [dr, dc] of directions) {
        let count = 1;
        for (let dir of [-1, 1]) {
            for (let k = 1; k < 3; k++) {
                const r = row + k * dr * dir;
                const c = col + k * dc * dir;
                if (r >= 0 && r < 9 && c >= 0 && c < 9 && 
                    game.board[r][c]?.color === color) {
                    count++;
                } else break;
            }
        }
        if (count >= 2) return true;
    }
    return false;
}

function analyzeSequences(color) {
    const result = {
        four: 0,
        three: 0,
        threeOpen: 0,
        two: 0,
        twoOpen: 0
    };
    
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    const checked = new Set();
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color !== color) continue;
            
            for (let [dr, dc] of directions) {
                const key = `${i},${j},${dr},${dc}`;
                if (checked.has(key)) continue;
                
                let count = 0;
                let openEnds = 0;
                let positions = [];
                
                let k = 0;
                while (k < 9) {
                    const r = i + k * dr;
                    const c = j + k * dc;
                    
                    if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                    
                    if (game.board[r][c]?.color === color) {
                        count++;
                        positions.push([r, c]);
                        checked.add(`${r},${c},${dr},${dc}`);
                        k++;
                    } else if (!game.board[r][c] && count > 0) {
                        openEnds++;
                        break;
                    } else {
                        break;
                    }
                }
                
                const r_before = i - dr;
                const c_before = j - dc;
                if (r_before >= 0 && r_before < 9 && c_before >= 0 && c_before < 9) {
                    if (!game.board[r_before][c_before]) {
                        openEnds++;
                    }
                }
                
                if (count >= 4) result.four++;
                else if (count === 3) {
                    if (openEnds >= 2) result.threeOpen++;
                    else result.three++;
                }
                else if (count === 2) {
                    if (openEnds >= 2) result.twoOpen++;
                    else result.two++;
                }
            }
        }
    }
    
    return result;
}

function evaluatePositionalAdvantage(color) {
    let score = 0;
    const heatmap = [
        [3, 4, 5, 5, 6, 5, 5, 4, 3],
        [4, 6, 7, 7, 8, 7, 7, 6, 4],
        [5, 7, 8, 9, 10, 9, 8, 7, 5],
        [5, 7, 9, 10, 11, 10, 9, 7, 5],
        [6, 8, 10, 11, 12, 11, 10, 8, 6],
        [5, 7, 9, 10, 11, 10, 9, 7, 5],
        [5, 7, 8, 9, 10, 9, 8, 7, 5],
        [4, 6, 7, 7, 8, 7, 7, 6, 4],
        [3, 4, 5, 5, 6, 5, 5, 4, 3]
    ];
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color === color) {
                score += heatmap[i][j];
            }
        }
    }
    return score;
}

function countValidPositions(color) {
    let count = 0;
    const directions = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color === color) {
                for (let [dr, dc] of directions) {
                    const r = i + dr;
                    const c = j + dc;
                    if (r >= 0 && r < 9 && c >= 0 && c < 9 && !game.board[r][c]) {
                        count++;
                    }
                }
            }
        }
    }
    return count;
}

function evaluateCenterDominance(color) {
    let score = 0;
    for (let i = 3; i <= 5; i++) {
        for (let j = 3; j <= 5; j++) {
            if (game.board[i][j]?.color === color) {
                const distToCenter = Math.abs(i - 4) + Math.abs(j - 4);
                score += (3 - distToCenter) * 2;
            }
        }
    }
    return score;
}

function evaluatePatterns(color) {
    let score = 0;
    const patterns = [
        [[0,0], [0,1], [1,0]],
        [[0,0], [0,1], [0,2]],
        [[0,0], [0,1], [0,2], [1,1]],
        [[0,1], [1,0], [1,1], [1,2]]
    ];
    
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            for (let pattern of patterns) {
                let matches = 0;
                for (let [dr, dc] of pattern) {
                    if (game.board[i+dr]?.[j+dc]?.color === color) {
                        matches++;
                    }
                }
                if (matches === pattern.length) {
                    score += 5;
                }
            }
        }
    }
    return score;
}

function evaluateForkingPotential(color) {
    let forkScore = 0;
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color !== color) continue;
            
            let threatsFromHere = 0;
            const directions = [[0,1], [1,0], [1,1], [1,-1]];
            
            for (let [dr, dc] of directions) {
                let count = 1;
                let openEnds = 0;
                
                for (let dir of [-1, 1]) {
                    for (let k = 1; k < 3; k++) {
                        const r = i + k * dr * dir;
                        const c = j + k * dc * dir;
                        
                        if (r < 0 || r >= 9 || c < 0 || c >= 9) break;
                        
                        if (game.board[r][c]?.color === color) {
                            count++;
                        } else if (!game.board[r][c] && canPlaceAt(r, c)) {
                            openEnds++;
                            break;
                        } else {
                            break;
                        }
                    }
                }
                
                if (count >= 2 && openEnds > 0) {
                    threatsFromHere++;
                }
            }
            
            if (threatsFromHere >= 2) {
                forkScore += threatsFromHere * 5;
            }
        }
    }
    return forkScore;
}

function evaluateOpponentRestriction(aiColor) {
    let restrictionScore = 0;
    
    for (let opp of game.players) {
        if (opp.color === aiColor) continue;
        const oppMobility = countValidPositions(opp.color);
        restrictionScore += (50 - oppMobility) * 2;
    }
    return restrictionScore;
}

function generateAllPossibleMoves(player) {
    const moves = [];
    for (let card of player.hand) {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (isValidMoveWithCard(i, j, card)) {
                    moves.push({row: i, col: j, card: card});
                }
            }
        }
    }
    return moves;
}

function generateAllTheoreticalMoves(color) {
    const moves = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (canPlaceAt(i, j)) {
                moves.push({row: i, col: j, card: {value: 5, color: color}});
            }
        }
    }
    return moves;
}

function orderMoves(moves, color) {
    moves.sort((a, b) => {
        const scoreA = quickEvaluateMove(a, color);
        const scoreB = quickEvaluateMove(b, color);
        return scoreB - scoreA;
    });
}

function quickEvaluateMove(move, color) {
    const backup = makeMove(move, color);
    let score = 0;
    
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    for (let [dr, dc] of directions) {
        let count = 1;
        let openEnds = 0;
        
        for (let dir of [-1, 1]) {
            let blocked = false;
            for (let k = 1; k < 4; k++) {
                const r = move.row + k * dr * dir;
                const c = move.col + k * dc * dir;
                if (r >= 0 && r < 9 && c >= 0 && c < 9) {
                    if (game.board[r][c]?.color === color) {
                        count++;
                    } else if (!game.board[r][c] && canPlaceAt(r, c)) {
                        if (!blocked) openEnds++;
                        blocked = true;
                        break;
                    } else {
                        blocked = true;
                        break;
                    }
                } else break;
            }
        }
        
        if (count >= 4) score += 10000;
        else if (count === 3) {
            if (openEnds >= 2) score += 500;
            else score += 200;
        }
        else if (count === 2) {
            if (openEnds >= 2) score += 100;
            else score += 30;
        }
    }
    
    const distToCenter = Math.abs(move.row - 4) + Math.abs(move.col - 4);
    score += (8 - distToCenter) * 5;
    
    for (let opp of game.players) {
        if (opp.color === color) continue;
        let blocksOpp = 0;
        for (let [dr, dc] of directions) {
            let oppCount = 0;
            for (let dir of [-1, 1]) {
                for (let k = 1; k < 4; k++) {
                    const r = move.row + k * dr * dir;
                    const c = move.col + k * dc * dir;
                    if (r >= 0 && r < 9 && c >= 0 && c < 9 && 
                        game.board[r][c]?.color === opp.color) {
                        oppCount++;
                    } else break;
                }
            }
            if (oppCount >= 2) blocksOpp += oppCount * 80;
        }
        score += blocksOpp;
    }
    
    undoMove(move, backup);
    return score;
}

function makeMove(move, color) {
    const backup = game.board[move.row][move.col];
    game.board[move.row][move.col] = {value: move.card.value, color: color};
    return backup;
}

function undoMove(move, backup) {
    game.board[move.row][move.col] = backup;
}

function getBoardHash() {
    let hash = '';
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]) {
                hash += `${i}${j}${game.board[i][j].color[0]}${game.board[i][j].value}`;
            }
        }
    }
    return hash;
}

function checkColorWins(color) {
    const directions = [[0,1], [1,0], [1,1], [1,-1]];
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color === color) {
                for (let [dr, dc] of directions) {
                    let count = 1
                    for (let k = 1; k < game.winLength; k++) {
                        const r = i + k * dr
                        const c = j + k * dc
                        if (r >= 0 && r < 9 && c >= 0 && c < 9 && game.board[r][c]?.color === color) {
                            count++
                        } else {
                            break
                        }
                    }
                    if (count >= game.winLength) return true
                }
            }
        }
    }
    return false;
}

function canPlaceAt(row, col) {
    if (!game.firstMovePlaced) {
        return row === 4 && col === 4;
    }
    
    if (game.board[row][col]) return false;
    
    const directions = [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];
    for (let [dr, dc] of directions) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < 9 && c >= 0 && c < 9 && game.board[r][c]) {
            return true;
        }
    }
    return false;
}

function isValidMoveWithCard(row, col, card) {
    if (!canPlaceAt(row, col)) return false;
    
    const currentCard = game.board[row][col];
    if (currentCard && currentCard.value >= card.value) {
        return false;
    }
    return true;
}