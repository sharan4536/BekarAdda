const mongoose = require('mongoose');

const DareSchema = new mongoose.Schema({
  roomId: String,
  creatorId: String,  
  targetUserId: String, 
  condition: String, 
  description: String,
  status: { type: String, enum: ['pending', 'accepted', 'completed', 'missed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dare', DareSchema);
