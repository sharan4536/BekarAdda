const mongoose = require('mongoose');

const roomLogSchema = new mongoose.Schema({
    roomId: { type: String, required: true },
    mode: { type: String, required: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    peakUsers: { type: Number, default: 0 }
});

module.exports = mongoose.model('RoomLog', roomLogSchema);
