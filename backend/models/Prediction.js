const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  userId: String,
  roomId: String,
  matchId: String,
  ballId: String,
  predictedRuns: Number,
  predictedWicket: Boolean,
  timestamp: { type: Date, default: Date.now },
  confidenceLevel: { type: Number, default: 100 },
  awardedPoints: { type: Number, default: 0 }
});

module.exports = mongoose.model('Prediction', PredictionSchema);
