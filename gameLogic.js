const suits = ["♣", "♦", "♥", "♠"];
const suitValue = {"♣":1, "♦":2, "♥":3, "♠":4};
const ranks = [3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K", "A", 2];
const rankValue = {3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, J:11, Q:12, K:13, A:14, 2:15};

function createDeck() {
    let deck = [];
    for (let r of ranks) for (let s of suits) deck.push({ rank: r, suit: s });
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards() {
    let deck = shuffle(createDeck());
    let hands = [[], [], [], []];
    for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
    hands.forEach(hand => {
        hand.sort((a, b) => {
            if (rankValue[a.rank] === rankValue[b.rank]) return suitValue[a.suit] - suitValue[b.suit];
            return rankValue[a.rank] - rankValue[b.rank];
        });
    });
    return hands;
}

function findStarter(hands) {
    for (let i = 0; i < 4; i++) {
        if (hands[i].some(c => c.rank === 3 && c.suit === "♣")) return i;
    }
    return 0;
}

module.exports = { dealCards, findStarter, rankValue, suitValue };