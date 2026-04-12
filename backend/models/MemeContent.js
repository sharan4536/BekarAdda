const mongoose = require('mongoose');

const MemeContentSchema = new mongoose.Schema({
  type: { type: String, enum: ['audio', 'text'] },
  category: String, 
  triggerType: { type: String, enum: ['auto', 'manual'] },
  triggerEvent: String, 
  fileUrl: String, 
  text: String
});

module.exports = mongoose.model('MemeContent', MemeContentSchema);
