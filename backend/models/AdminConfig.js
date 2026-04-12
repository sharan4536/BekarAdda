const mongoose = require('mongoose');

const AdminConfigSchema = new mongoose.Schema({
  // A singleton document tracking global configuration state
  features: {
    mentions: { type: Boolean, default: true },
    imageSharing: { type: Boolean, default: true },
    animatedText: { type: Boolean, default: true }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminConfig', AdminConfigSchema);
