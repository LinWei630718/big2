const { rankValue, suitValue } = require('./gameLogic');

// 將您原始前端代碼中的 evaluate 與 getCombinations 貼入此處
function evaluate(cards) {
    function sameRank(cards){ return cards.every(c => c.rank == cards[0].rank); }
    function getPower(card){ return rankValue[card.rank] * 10 + suitValue[card.suit]; }
    
    if(cards.length == 1) return {type: 1, value: getPower(cards[0]), cards: cards};
    if(cards.length == 2 && sameRank(cards)) return {type: 2, value: getPower(cards[0]), cards: cards};
    // ... 貼上您完整的 evaluate 邏輯 ...
    return null;
}

function getCombinations(array, size) {
    let result = [];
    function p(t, i) {
        if (t.length === size) { result.push(t); return; }
        if (i + 1 > array.length) return;
        p(t.concat(array[i]), i + 1); p(t, i + 1);
    } p([], 0); return result;
}

function calculateAiPlay(hand, lastPlay, isFirstTurn) {
    if (hand.length === 0) return null;
    let allPlays = [];

    if (lastPlay === null) {
        allPlays.push(...hand.map(c => [c]));
        if (isFirstTurn) {
            allPlays = allPlays.filter(play => play.some(c => c.rank === 3 && c.suit === "♣"));
        }
        allPlays.sort((a, b) => evaluate(a).value - evaluate(b).value);
        return allPlays.length > 0 ? allPlays[0] : null;
    } else {
        let typeNeeded = lastPlay.type;
        if (typeNeeded === 1) {
            allPlays = hand.map(c => [c]).filter(cards => evaluate(cards).value > lastPlay.value);
        }
        allPlays.sort((a, b) => evaluate(a).value - evaluate(b).value);
        return allPlays.length > 0 ? allPlays[0] : null;
    }
}

module.exports = { calculateAiPlay, evaluate };