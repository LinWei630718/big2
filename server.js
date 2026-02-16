const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { dealCards, findStarter } = require('./gameLogic');
const { calculateAiPlay, evaluate } = require('./aiLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

function startGame(roomNum) {
    const room = rooms[roomNum];
    room.gameStarted = true;
    const hands = dealCards();
    room.currentTurn = findStarter(hands);
    room.isFirstTurn = true;
    room.lastPlay = null;
    room.consecutivePasses = 0;
    
    room.players.forEach((player, index) => {
        player.handCards = hands[index];
        if (!player.isAI) {
            io.to(player.id).emit('game_start', {
                yourIndex: index,
                hand: player.handCards,
                currentTurn: room.currentTurn,
                opponentsCount: room.players.map(p => p.handCards.length)
            });
        }
    });

    if (room.players[room.currentTurn].isAI) processNextTurn(roomNum);
}

function processNextTurn(roomNum) {
    const room = rooms[roomNum];
    if (!room) return;
    const currentPlayer = room.players[room.currentTurn];

    if (currentPlayer.isAI) {
        setTimeout(() => {
            const chosenCards = calculateAiPlay(currentPlayer.handCards, room.lastPlay, room.isFirstTurn);

            if (chosenCards) {
                room.lastPlay = evaluate(chosenCards);
                room.lastPlayerIndex = room.currentTurn;
                room.isFirstTurn = false;
                room.consecutivePasses = 0;
                
                currentPlayer.handCards = currentPlayer.handCards.filter(
                    c => !chosenCards.some(played => played.rank === c.rank && played.suit === c.suit)
                );

                io.to(roomNum).emit('player_action', {
                    playerIndex: room.currentTurn,
                    action: 'play',
                    cards: chosenCards,
                    opponentsCount: room.players.map(p => p.handCards.length),
                    nextTurn: (room.currentTurn + 1) % 4
                });

                if (currentPlayer.handCards.length === 0) {
                    io.to(roomNum).emit('game_over', { winnerIndex: room.currentTurn });
                } else {
                    room.currentTurn = (room.currentTurn + 1) % 4;
                    processNextTurn(roomNum);
                }
            } else {
                room.consecutivePasses++;
                io.to(roomNum).emit('player_action', {
                    playerIndex: room.currentTurn, action: 'pass', nextTurn: (room.currentTurn + 1) % 4
                });

                if (room.consecutivePasses >= 3) {
                    room.lastPlay = null;
                    room.consecutivePasses = 0;
                    room.currentTurn = room.lastPlayerIndex;
                } else {
                    room.currentTurn = (room.currentTurn + 1) % 4;
                }
                processNextTurn(roomNum);
            }
        }, 1200);
    }
}

io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        const { roomNum, playerId } = data;
        if (!rooms[roomNum]) rooms[roomNum] = { players: [], gameStarted: false, hostId: socket.id };
        const room = rooms[roomNum];
        
        // 斷線重連邏輯
        const existingPlayerIndex = room.players.findIndex(p => p.playerId === playerId);
        if (existingPlayerIndex !== -1 && room.gameStarted) {
            const p = room.players[existingPlayerIndex];
            p.id = socket.id; p.isAI = false;
            socket.join(roomNum);
            socket.emit('reconnect_sync', {
                yourIndex: existingPlayerIndex, hand: p.handCards, currentTurn: room.currentTurn,
                lastPlay: room.lastPlay, opponentsCount: room.players.map(p => p.handCards.length)
            });
            io.to(roomNum).emit('player_reconnected', { playerIndex: existingPlayerIndex });
            return;
        }

        if (room.players.length >= 4 || room.gameStarted) return socket.emit('error', '無法加入房間');

        room.players.push({ id: socket.id, playerId: playerId, isAI: false });
        socket.join(roomNum);
        io.to(roomNum).emit('room_update', { playerCount: room.players.length, isHost: room.players[0].id === socket.id });

        if (room.players.length === 4) startGame(roomNum);
    });

    socket.on('force_start', (roomNum) => {
        const room = rooms[roomNum];
        if (room && socket.id === room.hostId && !room.gameStarted) {
            while (room.players.length < 4) room.players.push({ id: `AI_${Math.random()}`, isAI: true });
            startGame(roomNum);
        }
    });

    socket.on('play_cards', (data) => {
        const { room: roomNum, cards } = data;
        const room = rooms[roomNum];
        if (!room) return;
        
        room.lastPlay = evaluate(cards);
        room.lastPlayerIndex = room.currentTurn;
        room.isFirstTurn = false;
        room.consecutivePasses = 0;
        
        const player = room.players[room.currentTurn];
        player.handCards = player.handCards.filter(c => !cards.some(played => played.rank === c.rank && played.suit === c.suit));

        io.to(roomNum).emit('player_action', {
            playerIndex: room.currentTurn, action: 'play', cards: cards,
            opponentsCount: room.players.map(p => p.handCards.length), nextTurn: (room.currentTurn + 1) % 4
        });

        if (player.handCards.length === 0) {
            io.to(roomNum).emit('game_over', { winnerIndex: room.currentTurn });
        } else {
            room.currentTurn = (room.currentTurn + 1) % 4;
            processNextTurn(roomNum);
        }
    });

    socket.on('pass_turn', (data) => {
        const { room: roomNum } = data;
        const room = rooms[roomNum];
        if (!room) return;
        
        room.consecutivePasses++;
        io.to(roomNum).emit('player_action', { playerIndex: room.currentTurn, action: 'pass', nextTurn: (room.currentTurn + 1) % 4 });

        if (room.consecutivePasses >= 3) {
            room.lastPlay = null; room.consecutivePasses = 0; room.currentTurn = room.lastPlayerIndex;
        } else {
            room.currentTurn = (room.currentTurn + 1) % 4;
        }
        processNextTurn(roomNum);
    });

    socket.on('disconnect', () => {
        for (const roomNum in rooms) {
            const room = rooms[roomNum];
            const pIndex = room.players.findIndex(p => p.id === socket.id);
            if (pIndex !== -1 && room.gameStarted) {
                room.players[pIndex].isAI = true;
                io.to(roomNum).emit('player_disconnected', { playerIndex: pIndex });
                if (room.currentTurn === pIndex) processNextTurn(roomNum);
                break;
            } else if (pIndex !== -1 && !room.gameStarted) {
                room.players.splice(pIndex, 1);
                io.to(roomNum).emit('room_update', { playerCount: room.players.length, isHost: room.players.length > 0 });
                break;
            }
        }
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`伺服器啟動於 port ${process.env.PORT || 3000}`);
});