export function outcomeFromScore(home, away) {
  if (Number(home) > Number(away)) return "HOME";
  if (Number(home) < Number(away)) return "AWAY";
  return "DRAW";
}

export function validateScoreMatchesOutcome(predictedOutcome, predictedScore) {
  if (!predictedOutcome || !predictedScore) return false;
  return outcomeFromScore(predictedScore.homeScore, predictedScore.awayScore) === predictedOutcome;
}

export function scoreOutcomePrediction(prediction, result) {
  if (!prediction || !result) return 0;
  return prediction === result ? 3 : 1;
}

export function scoreExactScoreBonus(predictedScore, finalScore) {
  if (!predictedScore || !finalScore) return 0;
  return Number(predictedScore.homeScore) === Number(finalScore.homeScore) &&
    Number(predictedScore.awayScore) === Number(finalScore.awayScore)
    ? 2
    : 0;
}
