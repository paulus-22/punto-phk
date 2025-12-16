const COLORS = ['red', 'green', 'blue', 'yellow'];
const PLAYER_NAMES = ['Pemain 1', 'Pemain 2', 'Pemain 3', 'Pemain 4'];

const AI_TYPES = [
    { id: 'smart', label: 'AI Smart (Heuristic + Minimax)' },
    { id: 'paranoid', label: 'AI Paranoid (Minimax + Alpha-Beta)' }
]

function clampInt(n, lo, hi) {
    n = parseInt(n, 10)
    if (Number.isNaN(n)) return lo
    return Math.max(lo, Math.min(hi, n))
}

// === GAME FLOW CONTROL & STATS ===
let autoPlayDelay = 500
let isPaused = false
let stepRequested = false

const matchStats = {
  moves: 0,
  aiTurns: {}, // key: aiType+level
}

function togglePause() {
  isPaused = !isPaused
  document.getElementById('pauseBtn').textContent = isPaused ? '▶ Resume' : '⏸ Pause'
}

function stepOnce() {
  if (!isPaused) return
  stepRequested = true
}

let game = {
    players: [],
    currentPlayer: 0,
    board: Array(9).fill(null).map(() => Array(9).fill(null)),
    selectedCard: null,
    firstMovePlaced: false,
    gameEnded: false,
    winLength: 4,
    ui: { numPlayers: 4, mode: 'human' }
};

const moveHistory = []
function buildSetupUI() {
    const numSel = document.getElementById('numPlayersSelect')
    const modeSel = document.getElementById('modeSelect')
    const container = document.getElementById('aiConfig')

    if (!numSel || !modeSel || !container) return

    const numPlayers = clampInt(numSel.value, 2, 4)
    const mode = modeSel.value === 'aivai' ? 'aivai' : 'human'

    game.ui.numPlayers = numPlayers
    game.ui.mode = mode

    container.innerHTML = ''

    // Player 1 role
    const p0 = document.createElement('div')
    p0.className = 'info-box'
    p0.style.fontSize = '0.45em'
    p0.innerHTML = mode === 'aivai'
        ? '<b>Pemain 1</b>: AI'
        : '<b>Pemain 1</b>: Human'
    container.appendChild(p0)

    // AI config rows for each player slot
    for (let i = 0; i < numPlayers; i++) {
        const isHuman = (mode === 'human' && i === 0)
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.gap = '10px'
        row.style.flexWrap = 'wrap'
        row.style.justifyContent = 'center'

        const label = document.createElement('div')
        label.className = 'info-box'
        label.style.fontSize = '0.42em'
        label.textContent = `Pemain ${i+1}`
        row.appendChild(label)

        if (isHuman) {
            const human = document.createElement('div')
            human.className = 'info-box'
            human.style.fontSize = '0.42em'
            human.textContent = 'Human'
            row.appendChild(human)
        } else {
            const type = document.createElement('select')
            type.id = `aiType_${i}`
            type.style.fontSize = '0.9em'
            type.style.padding = '4px 6px'
            AI_TYPES.forEach(t => {
                const opt = document.createElement('option')
                opt.value = t.id
                opt.textContent = t.label
                type.appendChild(opt)
            })

            const level = document.createElement('select')
            level.id = `aiLevel_${i}`
            level.style.fontSize = '0.9em'
            level.style.padding = '4px 6px'
            ;[1,2,3].forEach(l => {
                const opt = document.createElement('option')
                opt.value = String(l)
                opt.textContent = `Level ${l}`
                level.appendChild(opt)
            })
            level.value = '2'

            const box = document.createElement('div')
            box.className = 'info-box'
            box.style.fontSize = '0.42em'
            box.style.display = 'flex'
            box.style.gap = '8px'
            box.style.alignItems = 'center'
            box.appendChild(type)
            box.appendChild(level)
            row.appendChild(box)
        }

        container.appendChild(row)
    }
}

function startConfiguredGame() {
    const numSel = document.getElementById('numPlayersSelect')
    const modeSel = document.getElementById('modeSelect')
    const numPlayers = clampInt(numSel?.value ?? 4, 2, 4)
    const mode = modeSel?.value === 'aivai' ? 'aivai' : 'human'

    // Gather per-player AI config
    const aiConfig = []
    for (let i = 0; i < numPlayers; i++) {
        const isHuman = (mode === 'human' && i === 0)
        const typeEl = document.getElementById(`aiType_${i}`)
        const lvlEl = document.getElementById(`aiLevel_${i}`)
        aiConfig.push({
            isHuman,
            aiType: isHuman ? null : (typeEl?.value ?? 'smart'),
            aiLevel: isHuman ? null : clampInt(lvlEl?.value ?? 2, 1, 3)
        })
    }

    startGame({ numPlayers, mode, aiConfig })
}

// Build setup UI once DOM is ready
window.addEventListener('load', () => {
  const numSel = document.getElementById('numPlayersSelect')
  const modeSel = document.getElementById('modeSelect')
  if (numSel) numSel.addEventListener('change', buildSetupUI)
  if (modeSel) modeSel.addEventListener('change', buildSetupUI)
  buildSetupUI()
})

function createDeck(color) {
    let deck = [];
    for (let i = 1; i <= 9; i++) {
        deck.push({value: i, color: color});
        deck.push({value: i, color: color});
    }
    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function startGame(config) {
    const numPlayers = clampInt(config?.numPlayers ?? 4, 2, 4)
    const mode = config?.mode === 'aivai' ? 'aivai' : 'human'
    const aiConfig = Array.isArray(config?.aiConfig) ? config.aiConfig : []

    game.winLength = numPlayers === 2 ? 5 : 4
    game.players = []

    // Randomize colors
    const shuffledColors = shuffle([...COLORS]).slice(0, numPlayers)

    for (let i = 0; i < numPlayers; i++) {
        const cfg = aiConfig[i] || { isHuman: (mode === 'human' && i === 0), aiType: 'smart', aiLevel: 2 }
        const isHuman = !!cfg.isHuman

        game.players.push({
            name: isHuman ? PLAYER_NAMES[i] : `🤖 AI ${i+1}`,
            color: shuffledColors[i],
            deck: createDeck(shuffledColors[i]),
            hand: [],
            isAI: !isHuman,
            aiType: isHuman ? null : (cfg.aiType || 'smart'),
            aiLevel: isHuman ? null : clampInt(cfg.aiLevel ?? 2, 1, 3)
        })
    }

    console.log('=== GAME START ===')
    console.log('Players:', game.players.map(p => `${p.name} (${p.color}) [${p.isAI ? (p.aiType+':L'+p.aiLevel) : 'human'}]`))

    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';

    // Show player areas first (without cards)
    game.players.forEach((p, idx) => {
        const playerArea = document.getElementById(`playerArea${idx}`);
        if (!playerArea) return;

        playerArea.className = 'player-area';
        if (idx === 0) playerArea.classList.add('player-p1');
        else if (idx === 1) playerArea.classList.add('player-p2');
        else if (idx === 2) playerArea.classList.add('player-p3');
        else if (idx === 3) playerArea.classList.add('player-p4');

        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        const header = document.createElement('div');
        header.className = 'player-header';
        header.innerHTML = `
            <span class="player-name" style="color: var(--color-${p.color})">${p.name}</span>
            <span class="cards-left">0</span>
        `;
        playerInfo.appendChild(header);

        const hand = document.createElement('div');
        hand.className = 'hand';
        playerInfo.appendChild(hand);

        playerArea.innerHTML = '';
        playerArea.appendChild(playerInfo);
    });

    // Show dealing animation in board area
    await showDealingAnimationInBoard(numPlayers);

    // Now show the actual board
    initBoard();
    updateUI();

    kickOffIfAITurn()
}
function kickOffIfAITurn() {
  if (game.gameEnded) return

  const current = game.players[game.currentPlayer]
  if (!current?.isAI) return

  const delay = parseInt(document.getElementById('autoPlaySpeed')?.value || autoPlayDelay)

  if (isPaused && !stepRequested) return
  stepRequested = false

  setTimeout(() => aiTurnForCurrentPlayer(), delay)
}

async function showDealingAnimationInBoard(numPlayers) {
    return new Promise(async (resolve) => {
        const boardContainer = document.querySelector('.board-container');
        const animContainer = document.createElement('div');
        animContainer.className = 'dealing-animation-container';
        animContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        `;

        const deckPile = document.createElement('div');
        deckPile.className = 'deck-pile-inline';
        deckPile.style.cssText = `
            position: relative;
            width: 100px;
            height: 140px;
        `;

        animContainer.appendChild(deckPile);
        boardContainer.appendChild(animContainer);

        // Create deck pile
        for (let i = 0; i < 15; i++) {
            const card = document.createElement('div');
            card.className = 'animated-card-inline';
            card.style.cssText = `
                position: absolute;
                width: 80px;
                height: 112px;
                background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
                border: 3px solid #1a252f;
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                color: #7f8c8d;
                box-shadow: 0 4px 8px rgba(0,0,0,0.5);
                transition: all 0.5s ease;
                top: ${i * 2}px;
                left: ${i * 2}px;
            `;
            card.textContent = '?';
            deckPile.appendChild(card);
        }

        // Shuffle animation
        setTimeout(() => {
            deckPile.style.animation = 'shuffle 0.5s ease-in-out';
        }, 300);

        // Deal cards animation - one by one
        setTimeout(async () => {
            const cards = deckPile.querySelectorAll('.animated-card-inline');
            let cardIndex = 0;
            
            for (let round = 0; round < 3; round++) {
                for (let player = 0; player < numPlayers; player++) {
                    await new Promise(resolveCard => {
                        setTimeout(() => {
                            if (cards[cardIndex]) {
                                const playerArea = document.getElementById(`playerArea${player}`);
                                const rect = playerArea.getBoundingClientRect();
                                const containerRect = boardContainer.getBoundingClientRect();
                                
                                const x = rect.left + rect.width / 2 - containerRect.left - containerRect.width / 2;
                                const y = rect.top + rect.height / 2 - containerRect.top - containerRect.height / 2;
                                
                                cards[cardIndex].style.transform = `translate(${x}px, ${y}px) scale(0.5) rotate(${Math.random() * 360}deg)`;
                                cards[cardIndex].style.opacity = '0';
                                
                                // Add card to player's hand
                                game.players[player].hand.push(game.players[player].deck.pop());
                                
                                // Update card count immediately
                                setTimeout(() => {
                                    updatePlayerCardCount(player);
                                }, 300);
                            }
                            cardIndex++;
                            resolveCard();
                        }, 200);
                    });
                }
            }

            setTimeout(() => {
                animContainer.remove();
                resolve();
            }, 500);
        }, 1000);
    });
}

function updatePlayerCardCount(playerIndex) {
    const playerArea = document.getElementById(`playerArea${playerIndex}`);
    if (!playerArea) return;
    
    const cardsLeft = playerArea.querySelector('.cards-left');
    if (cardsLeft) {
        const player = game.players[playerIndex];
        cardsLeft.textContent = player.deck.length + player.hand.length;
    }
}

async function dealNewCardAnimation(playerIndex) {
    return new Promise((resolve) => {
        const boardContainer = document.querySelector('.board-container');
        const playerArea = document.getElementById(`playerArea${playerIndex}`);
        
        if (!boardContainer || !playerArea) {
            resolve();
            return;
        }

        // Create single card in center of board
        const card = document.createElement('div');
        card.className = 'dealing-card';
        card.style.cssText = `
            position: absolute;
            width: 60px;
            height: 84px;
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            border: 3px solid #1a252f;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            color: #7f8c8d;
            box-shadow: 0 4px 8px rgba(0,0,0,0.5);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 100;
            transition: all 0.6s ease;
        `;
        card.textContent = '?';

        boardContainer.style.position = 'relative';
        boardContainer.appendChild(card);

        // Animate to player
        setTimeout(() => {
            const rect = playerArea.getBoundingClientRect();
            const containerRect = boardContainer.getBoundingClientRect();
            
            const x = rect.left + rect.width / 2 - containerRect.left - containerRect.width / 2;
            const y = rect.top + rect.height / 2 - containerRect.top - containerRect.height / 2;
            
            card.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.5) rotate(${Math.random() * 360}deg)`;
            card.style.opacity = '0';
        }, 50);

        setTimeout(() => {
            card.remove();
            resolve();
        }, 700);
    });
}

function initBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    boardEl.style.display = 'grid';
    
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (i === 4 && j === 4) cell.classList.add('center');
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.onclick = () => placeCard(i, j);
            boardEl.appendChild(cell);
        }
    }
}

function updateUI() {
    const player = game.players[game.currentPlayer];
    document.getElementById('currentPlayer').textContent = player.name;
    document.getElementById('selectedCard').textContent = game.selectedCard ? `${game.selectedCard.value} (${game.selectedCard.color})` : '-'

    game.players.forEach((p, idx) => {
        const playerArea = document.getElementById(`playerArea${idx}`);
        if (!playerArea) return;

        playerArea.className = 'player-area';
        
        if (idx === 0) playerArea.classList.add('player-p1');
        else if (idx === 1) playerArea.classList.add('player-p2');
        else if (idx === 2) playerArea.classList.add('player-p3');
        else if (idx === 3) playerArea.classList.add('player-p4');

        if (idx === game.currentPlayer) {
            playerArea.classList.add('active');
        }

        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        const header = document.createElement('div');
        header.className = 'player-header';
        header.innerHTML = `
            <span class="player-name" style="color: var(--color-${p.color})">${p.name}</span>
            <span class="cards-left">${p.deck.length + p.hand.length}</span>
        `;
        playerInfo.appendChild(header);

        const hand = document.createElement('div');
        hand.className = 'hand';

        // Player can only see their own cards
        if ((idx === game.currentPlayer && !p.isAI) || game.ui.mode === 'aivai') {
            p.hand.forEach((card, cardIdx) => {
                const cardEl = document.createElement('div');
                cardEl.className = `card color-${card.color}`;
                if (game.selectedCard === card) cardEl.classList.add('selected');
                cardEl.textContent = card.value;
                cardEl.onclick = () => selectCard(cardIdx);
                hand.appendChild(cardEl);
            });
        } else {
            // Show card backs for other players
            for (let i = 0; i < p.hand.length; i++) {
                const cardBack = document.createElement('div');
                cardBack.className = 'card-back';
                hand.appendChild(cardBack);
            }
        }

        playerInfo.appendChild(hand);
        playerArea.innerHTML = '';
        playerArea.appendChild(playerInfo);
    });

    updateBoard();
    highlightValidMoves();
}

function updateBoard() {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const cell = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
            if (!cell) continue;
            cell.innerHTML = '';
            if (game.board[i][j]) {
                const cardDiv = document.createElement('div');
                cardDiv.className = `card-on-board color-${game.board[i][j].color}`;
                cardDiv.textContent = game.board[i][j].value;
                cell.appendChild(cardDiv);
            }
        }
    }
}

function selectCard(cardIdx) {
    const player = game.players[game.currentPlayer];
    game.selectedCard = player.hand[cardIdx];
    updateUI();
}

function highlightValidMoves() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('valid-move');
    });

    if (!game.selectedCard) return;

    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (isValidMove(i, j)) {
                const cell = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                if (cell) cell.classList.add('valid-move');
            }
        }
    }
}

function isValidMove(row, col) {
    if (!game.firstMovePlaced) {
        return row === 4 && col === 4;
    }

    const currentCard = game.board[row][col];
    if (currentCard && currentCard.value >= game.selectedCard.value) {
        return false;
    }

    let hasAdjacent = false;
    const directions = [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];
    for (let [dr, dc] of directions) {
        const newR = row + dr;
        const newC = col + dc;
        if (newR >= 0 && newR < 9 && newC >= 0 && newC < 9 && game.board[newR][newC]) {
            hasAdjacent = true;
            break;
        }
    }

    return hasAdjacent;
}

function placeCard(row, col) {
    if (game.gameEnded) return;
    if (!game.selectedCard) return;
    if (game.players[game.currentPlayer].isAI) return;
    if (!isValidMove(row, col)) return;

    executeMove(row, col);
}

async function executeMove(row, col) {
    const current = game.players[game.currentPlayer]
    matchStats.moves++
    const player = game.players[game.currentPlayer];
    const playerIndex = game.currentPlayer;

    // Log move before changing state
    moveHistory.push({
      turn: matchStats.moves,
      playerIndex: game.currentPlayer,
      playerName: current.name,
      color: current.color,
      isAI: current.isAI,
      aiType: current.aiType,
      aiLevel: current.aiLevel,
      card: game.board[row][col]?.value,
      position: { row, col },
      reason: current.isAI ? (current.lastAIReason || 'UNKNOWN') : 'HUMAN'
    })

    game.board[row][col] = {...game.selectedCard};
    game.firstMovePlaced = true;

    const cardIdx = player.hand.indexOf(game.selectedCard);
    player.hand.splice(cardIdx, 1);

    const needNewCard = player.deck.length > 0;

    game.selectedCard = null;

    const winner = checkWinner();
    if (winner) {
        endGame(winner);
        return;
    }

    if (checkDraw()) {
        const drawWinner = calculateDrawWinner();
        endGame(drawWinner, true);
        return;
    }

    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    updateUI();

    // Animate new card dealing if needed
    if (needNewCard) {
        await dealNewCardAnimation(playerIndex);
        player.hand.push(player.deck.pop());
        updateUI();
    }

    kickOffIfAITurn()
}

function checkWinner() {
    for (let color of COLORS) {
        if (checkColor(color)) {
            return game.players.find(p => p.color === color);
        }
    }
    return null;
}

function checkColor(color) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color === color) {
                if (checkDirection(i, j, color, 0, 1) ||
                    checkDirection(i, j, color, 1, 0) ||
                    checkDirection(i, j, color, 1, 1) ||
                    checkDirection(i, j, color, 1, -1)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function checkDirection(row, col, color, dr, dc) {
    let count = 0;
    for (let i = 0; i < game.winLength; i++) {
        const r = row + i * dr;
        const c = col + i * dc;
        if (r >= 0 && r < 9 && c >= 0 && c < 9 && game.board[r][c]?.color === color) {
            count++;
        } else {
            break;
        }
    }
    return count >= game.winLength;
}

function checkDraw() {
    return game.players.every(p => p.hand.length === 0 && p.deck.length === 0);
}

function calculateDrawWinner() {
    let bestPlayer = null;
    let bestScore = {sequences: 0, totalValue: 0};

    game.players.forEach(player => {
        const score = countSequences(player.color);
        if (score.sequences > bestScore.sequences ||
            (score.sequences === bestScore.sequences && score.totalValue > bestScore.totalValue)) {
            bestScore = score;
            bestPlayer = player;
        }
    });

    return bestPlayer;
}

function countSequences(color) {
    let sequences = 0;
    let totalValue = 0;
    const counted = Array(9).fill(null).map(() => Array(9).fill(false));

    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (game.board[i][j]?.color === color && !counted[i][j]) {
                const directions = [[0,1], [1,0], [1,1], [1,-1]];
                for (let [dr, dc] of directions) {
                    let len = 0;
                    let value = 0;
                    for (let k = 0; k < 4; k++) {
                        const r = i + k * dr;
                        const c = j + k * dc;
                        if (r >= 0 && r < 9 && c >= 0 && c < 9 && game.board[r][c]?.color === color) {
                            len++;
                            value += game.board[r][c].value;
                            counted[r][c] = true;
                        } else {
                            break;
                        }
                    }
                    if (len >= 2) {
                        sequences++;
                        totalValue += value;
                    }
                }
            }
        }
    }

    return {sequences, totalValue};
}

function endGame(winner, isDraw = false) {
    game.gameEnded = true;

    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('winnerScreen').style.display = 'block';

    // MATCH SUMMARY PANEL
    const summary = []
    summary.push(`<b>Total Moves:</b> ${matchStats.moves}`)

    Object.entries(matchStats.aiTurns).forEach(([key, v]) => {
      const avg = Math.round(v.totalTime / v.count)
      summary.push(`<b>${key}</b> → Avg Think: ${avg} ms (${v.count} turns)`)
    })
    document.getElementById('matchSummary').innerHTML = summary.join('<br>')

    let infoText = `<div style="color: var(--color-${winner.color}); font-size: 2em; margin: 20px 0;">${winner.name} Menang!</div>`;

    if (isDraw) {
        const score = countSequences(winner.color);
        infoText += `<p>Game berakhir draw!</p>`;
        infoText += `<p>Pemenang ditentukan berdasarkan:</p>`;
        infoText += `<p>Jumlah deret: ${score.sequences}</p>`;
        infoText += `<p>Total nilai: ${score.totalValue}</p>`;
    } else {
        infoText += `<p>Berhasil menyusun 4 kartu beruntun!</p>`;
    }

    document.getElementById('winnerInfo').innerHTML = infoText;
}
// AI entrypoint for new multi-AI config
function aiTurnForCurrentPlayer() {
    if (typeof window.runAITurn === 'function') {
        window.runAITurn()
    } else {
        console.warn('AI not loaded: runAITurn() missing')
    }
}
// Export match as JSON
function exportMatchJSON() {
  const winnerIndex = game.players.findIndex(p => {
    const winnerInfo = document.getElementById('winnerInfo')?.textContent || ''
    return winnerInfo.includes(p.name)
  })

  const data = {
    timestamp: new Date().toISOString(),
    config: {
      winLength: game.winLength,
      players: game.players.length,
      mode: game.ui.mode
    },
    players: game.players.map((p, i) => ({
      index: i,
      name: p.name,
      color: p.color,
      isAI: p.isAI,
      aiType: p.aiType,
      aiLevel: p.aiLevel
    })),
    winner: {
      index: winnerIndex,
      name: game.players[winnerIndex]?.name,
      color: game.players[winnerIndex]?.color
    },
    stats: matchStats,
    moves: moveHistory
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `punto_match_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}