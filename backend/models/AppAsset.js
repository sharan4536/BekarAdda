const mongoose = require('mongoose');

const AppAssetSchema = new mongoose.Schema({
  type: { type: String, enum: ['emoji', 'gif', 'sound'], required: true },
  title: { type: String, required: true },
  url: { type: String, required: true }, // The external URL, or in the case of emoji, the raw character
  category: { type: String, default: 'General' },
  tags: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AppAsset', AppAssetSchema);
