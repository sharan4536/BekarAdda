const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Attempt Mongo DB connection gracefully
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bekaradda';
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error, falling back to memory/cache:', err.message));

const User = require('./models/User');
const Prediction = require('./models/Prediction');

const MemeContent = require('./models/MemeContent');
const AppAsset = require('./models/AppAsset');
const AdminConfig = require('./models/AdminConfig');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const fs = require('fs');
const path = require('path');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/api/admin/upload-base64', (req, res) => {
    try {
        const { filename, base64 } = req.body;
        if (!filename || !base64) return res.status(400).json({ error: 'Missing file data' });

        // Bypass Render.com ephemeral disk wiping completely!
        // We will natively return the Base64 Data URI to be directly embedded into MongoDB Atlas.
        res.json({ url: base64 });
    } catch (e) {
        console.error("Upload error", e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.use('/api/auth', require('./routes/auth'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let rooms = {};

// ================= ADMIN API ROUTES =================
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalEmoji = await AppAsset.countDocuments({ type: 'emoji' });
        const totalGif = await AppAsset.countDocuments({ type: 'gif' });
        const totalSound = await AppAsset.countDocuments({ type: 'sound' });
        
        let activeUsers = 0;
        const activeRooms = Object.keys(rooms).length;
        Object.values(rooms).forEach(r => activeUsers += r.users.length);

        res.json({
            assets: { emoji: totalEmoji, gif: totalGif, sound: totalSound },
            live: { rooms: activeRooms, users: activeUsers }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/resolve-media', async (req, res) => {
    try {
        const { url, type } = req.query;
        if (!url) return res.status(400).json({ error: 'Missing URL' });
        
        let finalUrl = url;
        
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            if (type === 'sound') {
                const audioMatch = html.match(/<meta[^>]*property=['"]og:audio['"][^>]*content=['"]([^'"]+)['"][^>]*>/i) || 
                                   html.match(/<meta[^>]*content=['"]([^'"]+)['"][^>]*property=['"]og:audio['"][^>]*>/i) ||
                                   html.match(/(https?:\/\/[^"'\s]+\.(?:mp3|wav|ogg|m4a))/i);
                if (audioMatch && audioMatch[1]) {
                    finalUrl = audioMatch[1];
                }
            } else {
                const imageMatch = html.match(/<meta[^>]*property=['"]og:(?:image|video)['"][^>]*content=['"]([^'"]+)['"][^>]*>/i) || 
                                   html.match(/<meta[^>]*content=['"]([^'"]+)['"][^>]*property=['"]og:(?:image|video)['"][^>]*>/i) ||
                                   html.match(/(https?:\/\/[^"'\s]+\.gif)/i);
                if (imageMatch && imageMatch[1]) {
                    finalUrl = imageMatch[1];
                }
            }
        } catch(e) {
            console.log("Extraction bypassed for invalid HTTP source");
        }
        
        res.json({ url: finalUrl });
    } catch (e) {
        console.error("Resolve media error:", e);
        res.status(500).json({ error: 'Failed to resolve media' });
    }
});

app.get('/api/admin/assets', async (req, res) => {
    try {
        const query = req.query.type ? { type: req.query.type } : {};
        const assets = await AppAsset.find(query).sort({ createdAt: -1 });
        res.json(assets);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/assets', async (req, res) => {
    try {
        const asset = new AppAsset(req.body);
        await asset.save();
        io.emit('contentUpdated');
        res.status(201).json(asset);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/assets/:id', async (req, res) => {
    try {
        await AppAsset.findByIdAndDelete(req.params.id);
        io.emit('contentUpdated');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/assets/:id', async (req, res) => {
    try {
        const asset = await AppAsset.findByIdAndUpdate(req.params.id, req.body, { new: true });
        io.emit('contentUpdated');
        res.json(asset);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/config', async (req, res) => {
    try {
        let config = await AdminConfig.findOne();
        if (!config) {
            config = await AdminConfig.create({});
        }
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/config', async (req, res) => {
    try {
        let config = await AdminConfig.findOne();
        if (!config) config = new AdminConfig();
        
        config.features = { ...config.features, ...req.body };
        config.updatedAt = Date.now();
        await config.save();
        
        io.emit('configUpdated', config);
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ====================================================

// Socket.io Handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', async ({ roomId, user, mode }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        mode: mode, // 'cricket' or 'movie'
        host: socket.id,
        cricketState: { currentRoundId: null, predictions: {}, windowStart: 0, phase: 'idle' },
        leaderboard: {},
        dares: []
      };
    }
    
    // Keep track of socket's current active room internally
    socket.roomId = roomId;

    const existingUser = rooms[roomId].users.find(u => u.id === user.id);
    if (!existingUser) {
        rooms[roomId].users.push({ socketId: socket.id, ...user });
        if(!rooms[roomId].leaderboard[user.id]) rooms[roomId].leaderboard[user.id] = { username: user.username, points: 0, streak: 0 };
        socket.to(roomId).emit('user_joined', { socketId: socket.id, user });
    } else {
        existingUser.socketId = socket.id;
    }

    io.to(roomId).emit('room_update', rooms[roomId]);
    io.to(roomId).emit('chat_message', { system: true, message: `${user.username || 'A user'} joined the room.` });

    // Broadcast Chat History to the newly joining user only
    try {
        const history = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(100).populate('user', 'username avatarUrl');
        const formattedHistory = history.map(h => ({
            user: h.user ? { id: h.user._id, username: h.user.username, avatarUrl: h.user.avatarUrl } : { username: 'System', id: 'system' },
            message: h.message,
            image: h.image,
            effect: h.effect,
            replyTo: h.replyTo,
            system: h.system
        }));
        socket.emit('chat_history', formattedHistory);
    } catch(e) {
        console.error("History fetch error", e);
    }
  });

  socket.on('chat_message', async ({ roomId, user, message, image, replyTo, effect }) => {
    try {
        if (user && user.id && user.id.length === 24) { 
            const msg = new Message({
                roomId,
                user: user.id,
                message,
                image,
                replyTo,
                effect
            });
            await msg.save();
        } else {
            const msg = new Message({
                roomId,
                message,
                image,
                replyTo,
                effect,
                system: !user || user.id === 'system'
            });
            await msg.save();
        }
    } catch (e) {
        console.error("Message save error", e);
    }
    io.to(roomId).emit('chat_message', { user, message, image, replyTo, effect });
  });

  socket.on('host_action', ({ roomId, action, targetSocketId }) => {
      const room = rooms[roomId];
      if (room && room.host === socket.id) {
          if (action === 'mute') {
              io.to(targetSocketId).emit('force_mute');
          } else if (action === 'kick') {
              io.to(targetSocketId).emit('force_kick');
              room.users = room.users.filter(u => u.socketId !== targetSocketId);
              const targetSocket = io.sockets.sockets.get(targetSocketId);
              if(targetSocket) targetSocket.leave(roomId);
              
              io.to(roomId).emit('room_update', room);
              io.to(roomId).emit('user_left', { socketId: targetSocketId });
          }
      }
  });

  socket.on('movie_reaction', ({ roomId, user, reactionType, emoji, message, image }) => {
     io.to(roomId).emit('movie_reaction', { user, reactionType, emoji, message, image });
  });

  socket.on('play_sound', ({ roomId, user, soundId }) => {
      io.to(roomId).emit('play_sound', { user, soundId });
  });

  socket.on('webrtc_signal', ({ signal, to }) => {
      io.to(to).emit('webrtc_signal', { signal, from: socket.id });
  });

  socket.on('offer', ({ offer, to }) => {
      io.to(to).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ answer, to }) => {
      io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Meme & Audio sync
  socket.on('trigger_meme', ({ roomId, memeData }) => {
      io.to(roomId).emit('play_meme', memeData);
  });



  socket.on('cricket_prediction', ({ roomId, userId, roundId, predictedRuns, predictedWicket }) => {
      if(rooms[roomId]) {
          if(!rooms[roomId].cricketState.predictions[roundId]) {
             rooms[roomId].cricketState.predictions[roundId] = [];
          }
          rooms[roomId].cricketState.predictions[roundId].push({ userId, predictedRuns, predictedWicket, timestamp: Date.now() });
      }
  });

  socket.on('cricket_action', ({ roomId, action, payload }) => {
      let room = rooms[roomId];
      if (room && room.host === socket.id) {
          
          if (action === 'start_prediction') {
              if (room.cricketState.phase !== 'idle') return; 
              
              room.cricketState.isLooping = true;
              const roundId = `round_${Math.random().toString(36).substr(2,6)}`;
              room.cricketState.phase = 'predicting';
              room.cricketState.currentRoundId = roundId;
              room.cricketState.windowStart = Date.now();
              room.cricketState.predictions[roundId] = [];
              
              io.to(roomId).emit('prediction_window', { roundId, duration: 4 });
              setTimeout(() => {
                  if(room.cricketState.currentRoundId === roundId) {
                      room.cricketState.phase = 'host_input';
                      io.to(roomId).emit('prediction_locked');
                  }
              }, 5000); 

          } else if (action === 'cancel_prediction') {
              room.cricketState.isLooping = false;
              room.cricketState.phase = 'idle';
              room.cricketState.currentRoundId = null;
              io.to(roomId).emit('cancel_prediction');
          
          } else if (action === 'submit_result' && payload) {
              const { roundId, runs, isWicket, outcomeStr } = payload;
              
              if (room.cricketState.currentRoundId === roundId && room.cricketState.predictions[roundId]) {
                 
                 room.cricketState.predictions[roundId].forEach(p => {
                      let isCorrect = false;
                      if(p.predictedWicket && isWicket) isCorrect = true;
                      if(!p.predictedWicket && p.predictedRuns === runs) isCorrect = true;

                      if (room.leaderboard[p.userId]) {
                        if(isCorrect) {
                            room.leaderboard[p.userId].points += 1;
                        } else {
                            room.leaderboard[p.userId].streak = 0;
                        }
                      }
                 });
                 io.to(roomId).emit('leaderboard_update', Object.values(room.leaderboard).sort((a,b) => b.points - a.points));
                 
                 // Emit exactly what was submitted to trigger visual Confetti correctly via exact string!
                 io.to(roomId).emit('cricket_event', {
                     type: 'result_declared',
                     roundId,
                     lastOutcome: outcomeStr, 
                     isWicket,
                     runs
                 });

                 // Reset Game Master Engine
                 room.cricketState.phase = 'idle';
                 room.cricketState.currentRoundId = null;
                 delete room.cricketState.predictions[roundId];
                 io.to(roomId).emit('cancel_prediction'); // Clears prediction UI block
                 
                 // CONTINUOUS PREDICTION LOOP ENGINE
                 if (room.cricketState.isLooping) {
                     setTimeout(() => {
                         if(rooms[roomId] && rooms[roomId].cricketState.isLooping && rooms[roomId].cricketState.phase === 'idle') {
                             const nextRoundId = `round_${Math.random().toString(36).substr(2,6)}`;
                             rooms[roomId].cricketState.phase = 'predicting';
                             rooms[roomId].cricketState.currentRoundId = nextRoundId;
                             rooms[roomId].cricketState.windowStart = Date.now();
                             rooms[roomId].cricketState.predictions[nextRoundId] = [];
                             
                             io.to(roomId).emit('prediction_window', { roundId: nextRoundId, duration: 4 });
                             setTimeout(() => {
                                 if(rooms[roomId] && rooms[roomId].cricketState.currentRoundId === nextRoundId) {
                                     rooms[roomId].cricketState.phase = 'host_input';
                                     io.to(roomId).emit('prediction_locked');
                                 }
                             }, 5000);
                         }
                     }, 1500); // Wait 1.5 seconds so users see result confetti, then blast next loop implicitly.
                 }
              }
          }
      }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const roomId in rooms) {
       rooms[roomId].users = rooms[roomId].users.filter(u => u.socketId !== socket.id);
       io.to(roomId).emit('user_left', { socketId: socket.id });
       if (rooms[roomId].users.length === 0) {
           delete rooms[roomId];
       } else {
           if(rooms[roomId].host === socket.id) {
               rooms[roomId].host = rooms[roomId].users[0].socketId; // Reassign host
           }
           io.to(roomId).emit('room_update', rooms[roomId]);
       }
    }
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
