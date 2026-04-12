import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Share2, Users, MessageSquare, Mic, MicOff, LogOut, MonitorOff, MonitorUp, UserMinus, X } from 'lucide-react';
import CricketMode from '../components/Cricket/CricketMode';
import MovieMode from '../components/Movie/MovieMode';

let socket;

const RemoteAudio = ({ stream }) => {
    const audioRef = useRef(null);
    useEffect(() => {
        if(audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.error("Audio autoplay error:", e));
        }
    }, [stream]);
    return <audio ref={audioRef} playsInline />;
};

const AvatarNode = ({ u, stream, isMe, isMuted }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    useEffect(() => {
        if (!stream) return;
        
        let audioContext;
        let animationFrame;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser); // We don't connect to destination to avoid echo, just analyse
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkVolume = () => {
                if (isMe && isMuted) {
                    setIsSpeaking(false);
                    animationFrame = requestAnimationFrame(checkVolume);
                    return;
                }
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const average = sum / dataArray.length;
                setIsSpeaking(average > 15);
                animationFrame = requestAnimationFrame(checkVolume);
            };
            checkVolume();
        } catch(e) {
            console.error("Audio block issue:", e);
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (audioContext && audioContext.state !== 'closed') audioContext.close();
        };
    }, [stream, isMe, isMuted]);

    return (
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold shadow-md relative shrink-0 transition-all duration-200 overflow-hidden ${isSpeaking ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)] scale-110 z-10' : 'border border-white/10'}`}>
            {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
        </div>
    );
};

export default function Room({ user }) {
  const { id: roomId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'cricket';
  const navigate = useNavigate();

  const [roomData, setRoomData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  
  // Advanced Chat Mechanics
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedEffect, setSelectedEffect] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const localAudioRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState({});
  const [debugLog, setDebugLog] = useState("");
  const appendDebug = (msg) => setDebugLog(prev => prev + msg + "\n");

  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const peersRef = useRef({});

  const [adminConfig, setAdminConfig] = useState({ features: { mentions: true, imageSharing: true, animatedText: true }});

  const fetchAdminConfig = async () => {
      try {
          const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
          const res = await fetch(`${API_BASE}/api/admin/config`);
          const data = await res.json();
          if (data && data.features) setAdminConfig(data);
      } catch (e) {
          console.error("Failed to load admin config", e);
      }
  };

  useEffect(() => {
      fetchAdminConfig();
  }, []);

  const roomDataRef = useRef(roomData);
  useEffect(() => { roomDataRef.current = roomData; }, [roomData]);

  const pcConfig = {
      iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
      ]
  };

  const createPeer = (peerSocketId) => {
      if (peersRef.current[peerSocketId]) return peersRef.current[peerSocketId];

      const pc = new RTCPeerConnection(pcConfig);
      pc._iceQueue = [];
      pc._makingOffer = false;

      // Force instant negotiation and ICE ICE tunnel establishment regardless of camera state!
      pc.createDataChannel('sync');

      pc.onnegotiationneeded = async () => {
          // Dodge Safari Rollback Crashes by assigning absolute topology: ONLY the Host sends initial Offers!
          if (roomDataRef.current?.host !== socket?.id) return;
          try {
              appendDebug(`[NEG] Generating Master Offer`);
              pc._makingOffer = true;
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              if (socket) {
                  socket.emit('offer', { to: peerSocketId, offer: pc.localDescription });
              }
          } catch (err) {
              appendDebug(`[NEG FAIL] ${err.message}`);
          } finally {
              pc._makingOffer = false;
          }
      };

      pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
              console.log("ICE candidate generated, emitting...");
              socket.emit('ice-candidate', { to: peerSocketId, candidate: event.candidate });
          }
      };

      pc.onconnectionstatechange = () => {
          console.log(`connectionState: ${pc.connectionState}`);
      };

      pc.oniceconnectionstatechange = () => {
          appendDebug(`[ICE] state: ${pc.iceConnectionState}`);
      };

      pc.ontrack = (event) => {
          appendDebug(`[ONTRACK] Kind: ${event.track.kind}`);
          if (event.track.kind === 'video') {
              if (event.streams && event.streams[0]) {
                  setRemoteScreenStream(event.streams[0]);
              } else {
                  setRemoteScreenStream(new MediaStream([event.track]));
              }
          } else if (event.track.kind === 'audio') {
              setRemoteAudioTracks(prev => ({
                  ...prev,
                  [peerSocketId]: new MediaStream([event.track])
              }));
          }
      };

      // Push local microphone track if available natively via addTrack
      if (localAudioRef.current && !isMuted) {
          const audioTrack = localAudioRef.current.getAudioTracks()[0];
          if (audioTrack) {
              pc.addTrack(audioTrack, localAudioRef.current);
          }
      }

      // Push local screen track if available
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
              // Only add if it doesn't already exist on the connection
              const existingSender = pc.getSenders().find(s => s.track === track);
              if (!existingSender) {
                  pc.addTrack(track, localStreamRef.current);
              }
          });
      }

      peersRef.current[peerSocketId] = pc;
      return pc;
  };

  useEffect(() => {
    // Acquire local microphone on join
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        localAudioRef.current = stream;
        // Retroactively push it to peers if they joined before the user accepted the mic popup!
        Object.keys(peersRef.current).forEach(socketId => {
            const pc = peersRef.current[socketId];
            stream.getTracks().forEach(track => {
                const existing = pc.getSenders().find(s => s.track === track);
                if (!existing && !isMuted) {
                    pc.addTrack(track, stream);
                }
            });
        });
    }).catch(err => console.log('Mic error:', err));

    return () => {
        if(localAudioRef.current) {
            localAudioRef.current.getTracks().forEach(t => t.stop());
        }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/?returnTo=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    socket = io(SOCKET_URL);
    socket.emit('join_room', { roomId, user, mode });

    socket.on('room_update', (data) => {
      setRoomData(data);
      // Universal Peer Bootstrapper: Host strictly constructs architecture topology to prevent double-offer collisions!
      if (data && data.users && data.host === socket?.id) {
          data.users.forEach(u => {
              if (u.socketId !== socket?.id && !peersRef.current[u.socketId]) {
                  createPeer(u.socketId);
              }
          });
      }
    });

    socket.on('chat_history', (history) => {
        setMessages(history);
    });

    socket.on('chat_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('user_joined', async ({ socketId }) => {
        createPeer(socketId);
    });

    socket.on('user_left', ({ socketId }) => {
        if(peersRef.current[socketId]) {
            peersRef.current[socketId].close();
            delete peersRef.current[socketId];
        }
        setRemoteAudioTracks(prev => {
            const next = {...prev};
            delete next[socketId];
            return next;
        });
    });

    socket.on('configUpdated', (newConfig) => {
        if (newConfig && newConfig.features) setAdminConfig(newConfig);
    });

    socket.on('force_mute', () => {
        setIsMuted(true);
    });

    socket.on('force_kick', () => {
        alert("You have been removed from the party by the host.");
        navigate('/modes');
    });

    socket.on('offer', async ({ from, offer }) => {
        console.log("Received Offer from", from);
        let pc = peersRef.current[from];
        if (!pc) pc = createPeer(from);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: from, answer: pc.localDescription });
            if(pc._iceQueue && pc._iceQueue.length > 0) {
                pc._iceQueue.forEach(c => pc.addIceCandidate(c).catch(e=>console.error(e)));
                pc._iceQueue = [];
            }
        } catch(e) { console.error("Offer Error:", e); }
    });

    socket.on('answer', async ({ from, answer }) => {
        console.log("Received Answer from", from);
        const pc = peersRef.current[from];
        if(!pc) return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            if(pc._iceQueue && pc._iceQueue.length > 0) {
                pc._iceQueue.forEach(c => pc.addIceCandidate(c).catch(e=>console.error(e)));
                pc._iceQueue = [];
            }
        } catch(e) { console.error("Answer Error:", e); }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
        const pc = peersRef.current[from];
        if(!pc) return;
        const iceCand = new RTCIceCandidate(candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(iceCand).catch(e => console.error("ICE add error:", e));
        } else {
            pc._iceQueue.push(iceCand);
        }
    });

    return () => {
      for(let key in peersRef.current) {
          peersRef.current[key].close();
      }
      peersRef.current = {};
      socket.disconnect();
    };
  }, [roomId, user, mode, navigate]);

  useEffect(() => {
      if(localAudioRef.current) {
          localAudioRef.current.getAudioTracks().forEach(track => {
              track.enabled = !isMuted;
          });
      }
  }, [isMuted]);

  // Update video element mapping
  useEffect(() => {
     if(videoRef.current) {
         if (roomData?.host === socket?.id && localStream) {
             videoRef.current.srcObject = localStream;
             videoRef.current.muted = true; // Host shouldn't hear themselves
             videoRef.current.play().catch(e => console.error('Host video autoplay blocked:', e));
         } else if (remoteScreenStream && roomData?.host !== socket?.id) {
             console.log("Binding remote screen stream to video element:", remoteScreenStream.getTracks());
             videoRef.current.srcObject = remoteScreenStream;
             videoRef.current.play().catch(e => console.error('Guest video autoplay blocked:', e));
         }
     }
  }, [localStream, remoteScreenStream, roomData]);

  const stopScreenShare = async () => {
     if (localStreamRef.current) {
         localStreamRef.current.getTracks().forEach(track => track.stop());
         setLocalStream(null);
         localStreamRef.current = null;

         Object.keys(peersRef.current).forEach((socketId) => {
             const pc = peersRef.current[socketId];
             // Remove specifically the screen share tracks, NOT the microphone!
             const senders = pc.getSenders().filter(s => s.track && localStreamRef.current.getTracks().includes(s.track));
             senders.forEach(sender => pc.removeTrack(sender));
         });
     }
  };

  const startScreenShare = async () => {
     try {
         const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
         stream.getVideoTracks()[0].onended = () => stopScreenShare();
         
         setLocalStream(stream);
         localStreamRef.current = stream;

         // Add screen tracks directly. Perfect Negotiation handles SDP renegotiation automatically.
         Object.keys(peersRef.current).forEach((socketId) => {
             const pc = peersRef.current[socketId];
             stream.getTracks().forEach(track => {
                 pc.addTrack(track, stream);
             });
         });
     } catch (err) {
         console.error('Error sharing screen:', err);
     }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showChat]);

  const handleImageSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) {
              alert("Image must be smaller than 2MB");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setSelectedImage(reader.result);
          };
          reader.readAsDataURL(file);
      }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if(chatInput.trim() || selectedImage) {
      socket.emit('chat_message', { 
          id: Math.random().toString(36).substr(2,9),
          roomId, 
          user, 
          message: chatInput,
          image: selectedImage,
          replyTo: replyingTo,
          effect: selectedEffect
      });
      setChatInput('');
      setSelectedImage(null);
      setReplyingTo(null);
      setSelectedEffect('');
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Mention parsing function
  const renderMessageText = (text) => {
      if (!text) return null;
      if (!adminConfig.features.mentions) return text; // Bypass mentions if globally diisabled

      const parts = text.split(/(@\w+)/g);
      return parts.map((part, i) => {
          if (part.startsWith('@')) {
              return <span key={i} className="text-pink-400 font-bold bg-pink-500/10 px-1 rounded inline-block shadow-sm transition hover:scale-105 cursor-pointer">{part}</span>;
          }
          return <span key={i}>{part}</span>;
      });
  };

  if(!roomData) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono animate-pulse">Establishing Room Connection...</div>
  }

  const isHost = roomData.host === socket?.id;

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden font-sans">
      
      {/* Left Sidebar (Participants) */}
      <div className="w-64 bg-slate-900 border-r border-white/5 flex flex-col z-20 shrink-0 hidden md:flex">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Participants ({roomData.users.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
               {roomData.users.map(u => (
                   <div key={u.id} className="flex items-center gap-3 bg-black/20 hover:bg-black/40 p-2.5 rounded-xl group relative border border-white/5 transition-colors">
                       <AvatarNode 
                           u={u} 
                           stream={u.id === user.id ? localAudioRef.current : remoteAudioTracks[u.socketId]} 
                           isMe={u.id === user.id} 
                           isMuted={isMuted} 
                       />
                       
                       <div className="flex-1 min-w-0 pr-6">
                           <p className="text-sm font-medium truncate text-slate-200">
                               {u.username} {u.id === user.id && <span className="text-indigo-400 text-xs ml-1">(You)</span>}
                           </p>
                           {roomData.host === u.socketId && <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wide">Host</p>}
                       </div>

                       {/* Moderation Tools */}
                       {isHost && u.id !== user.id && (
                           <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-800 p-1 rounded-lg flex gap-1 opacity-0 group-hover:opacity-100 transition shadow-xl border border-white/10">
                               <button onClick={() => socket.emit('host_action', { action: 'mute', targetSocketId: u.socketId, roomId })} className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Mute Guest">
                                   <MicOff size={14} />
                               </button>
                               <button onClick={() => socket.emit('host_action', { action: 'kick', targetSocketId: u.socketId, roomId })} className="p-1 hover:bg-red-600/30 rounded text-red-500 hover:text-red-400" title="Remove Guest">
                                   <UserMinus size={14} />
                               </button>
                           </div>
                       )}

                       {/* Audio Output */}
                       {remoteAudioTracks[u.socketId] && <RemoteAudio stream={remoteAudioTracks[u.socketId]} />}
                   </div>
               ))}
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <pre className="absolute top-16 right-4 z-[999] pointer-events-none text-[10px] sm:text-xs bg-black/80 text-lime-400 p-2 max-w-[250px] overflow-y-auto max-h-40 rounded border border-lime-800 break-words whitespace-pre-wrap">{debugLog}</pre>
        
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 z-20 shadow-sm relative">
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold tracking-wider uppercase">
                {roomData.mode} Party
             </div>
             <h2 className="font-semibold text-lg max-w-sm ml-2 tracking-wide text-slate-300">#{roomId}</h2>
          </div>
          <div className="flex items-center gap-3">
             <button 
                 onClick={() => setShowChat(!showChat)}
                 title="Toggle Chat Window"
                 className={`p-2 rounded-lg transition-colors border border-white/5 flex items-center gap-2 ${showChat ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
             >
                 <MessageSquare size={18} /> <span className="text-sm font-medium hidden sm:inline">Chat</span>
             </button>
             {isHost && (
                 <button 
                     onClick={localStream ? stopScreenShare : startScreenShare}
                     title={localStream ? "Stop screen sharing" : "Share screen"}
                     className={`p-2 rounded-lg transition-colors border border-white/5 flex items-center gap-2 ml-2 ${localStream ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                 >
                     {localStream ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
                 </button>
             )}
             <button 
                 onClick={() => {
                     navigator.clipboard.writeText(window.location.href);
                     alert('Room link copied to clipboard!');
                 }}
                 className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors border border-white/5 flex items-center gap-2"
                 title="Copy Room Link"
             >
                 <Share2 size={16} />
             </button>
             <button 
                 onClick={() => setIsMuted(!isMuted)} 
                 className={`p-2 rounded-lg transition-colors border border-white/5 ml-2 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                 title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
             >
                 {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
             </button>
             <button 
                 onClick={() => navigate('/modes')}
                 className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg transition-all border border-red-500/30 flex items-center gap-2 ml-4 relative overflow-hidden group"
             >
                 <LogOut size={16} className="relative z-10" /> <span className="text-sm font-bold relative z-10">Leave</span>
                 <div className="absolute inset-0 bg-red-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></div>
             </button>
          </div>
        </header>

        {/* Video Player / Screen Share Area */}
        <div className="flex-1 p-6 flex flex-col relative overflow-hidden bg-slate-950">
           
           <div className="flex-1 rounded-2xl bg-black border border-white/5 flex items-center justify-center relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
               {isHost ? (
                   !localStream ? (
                       <div className="text-center p-8 bg-slate-900/50 rounded-3xl border border-white/5 backdrop-blur">
                           <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-400">
                              <MonitorUp size={36} />
                           </div>
                           <h3 className="text-xl font-bold mb-2">You are the Game Master!</h3>
                           <p className="text-slate-400 mb-8 max-w-sm">Share your screen so your guests can tune into the live BekarAdda session.</p>
                           <button onClick={startScreenShare} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-bold text-lg tracking-wide transition shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] hover:-translate-y-1 flex items-center gap-3 mx-auto">
                               Start Stream
                           </button>
                       </div>
                   ) : (
                       <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain rounded-2xl" />
                   )
               ) : (
                   remoteScreenStream ? (
                       <video ref={videoRef} autoPlay playsInline controls className="w-full h-full object-contain rounded-2xl" />
                   ) : (
                       <div className="text-center text-slate-500 flex flex-col items-center">
                           <div className="w-20 h-20 border-[4px] border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-8"></div>
                           <p className="font-semibold text-lg animate-pulse tracking-wide text-slate-400">Waiting for host to go live...</p>
                       </div>
                   )
               )}

               {/* MOVIE MODE EFFECTS: Emoji Bursts overlay */}
               {roomData.mode === 'movie' && (
                 <MovieMode socket={socket} roomId={roomId} user={user} />
               )}
           </div>

           {/* CRICKET MODE EXTRA OVERLAYS */}
           {roomData.mode === 'cricket' && (
               <CricketMode socket={socket} roomId={roomId} user={user} roomData={roomData} />
           )}
        </div>
      </div>

      {/* Right Sidebar (Chat) */}
      {showChat && (
          <div className="w-80 bg-slate-900 border-l border-white/5 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] z-30 animate-in slide-in-from-right-8 duration-300">
             
             {/* Header */}
             <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-300">Room Chat</h3>
                <button onClick={() => setShowChat(false)} className="text-slate-500 hover:text-white transition">
                    <X size={18} />
                </button>
             </div>

             <div className="flex-1 flex flex-col overflow-hidden">
                 {/* CSS Block for Inline Chat Effects */}
                 <style>{`
                    @keyframes chatWiggle { 0%, 100% { transform: rotate(-3deg) scale(1.02); } 50% { transform: rotate(3deg) scale(1.05); } }
                    .effect-shake { animation: chatWiggle 0.3s ease-in-out infinite; }
                    .effect-glow { box-shadow: 0 0 15px rgba(129, 140, 248, 0.4); border-color: rgba(129, 140, 248, 0.5); border-width: 1px; }
                 `}</style>
                 
                 {/* Chat Messages */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-5">
                     {messages.map((m, i) => {
                        const isMe = m.user?.id === user.id;
                        let effectClass = "";
                        if (m.effect === 'shake') effectClass = "effect-shake";
                        else if (m.effect === 'bounce') effectClass = "animate-bounce";
                        else if (m.effect === 'glow') effectClass = "effect-glow";

                        return (
                        <div key={m.id || i} className={`flex flex-col ${m.system ? 'items-center' : (isMe ? 'items-end' : 'items-start')} group`}>
                            {m.system ? (
                                <span className="text-xs text-slate-400 bg-black/40 px-4 py-1.5 rounded-full font-medium tracking-wide shadow-inner">{m.message}</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {/* Quick Reply Button on Hover */}
                                    {!isMe && (
                                        <button onClick={() => setReplyingTo({ id: m.id, user: m.user?.username, text: m.message || 'Image' })} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-all hover:scale-110 active:scale-95 shadow-md">
                                            <Share2 size={12} className="rotate-180" />
                                        </button>
                                    )}

                                    <div className={`max-w-[85%] flex flex-col ${isMe ? 'bg-indigo-600 rounded-l-2xl rounded-tr-2xl text-white' : 'bg-slate-800 border border-white/5 rounded-r-2xl rounded-tl-2xl text-slate-200'} p-3.5 shadow-lg transition-all ${effectClass}`}>
                                        
                                        {/* Reply Banner */}
                                        {m.replyTo && (
                                            <div className={`text-[10px] pl-2 mb-2 border-l-2 ${isMe ? 'border-indigo-300 text-indigo-100 bg-indigo-700/50' : 'border-slate-500 text-slate-300 bg-slate-900/50'} py-1 pr-2 rounded-r flex flex-col gap-0.5`}>
                                                <span className="font-bold opacity-80">@{m.replyTo.user}</span>
                                                <span className="truncate max-w-[150px] opacity-70">{m.replyTo.text}</span>
                                            </div>
                                        )}

                                        {!isMe && <p className="text-[11px] text-indigo-300 font-bold mb-1 tracking-wider uppercase">{m.user?.username}</p>}
                                        
                                        {/* Image Display */}
                                        {m.image && (
                                            <img src={m.image} alt="shared" className="max-w-[200px] w-full max-h-[250px] object-cover rounded-xl mt-1 mb-2 shadow-inner border border-black/10 cursor-pointer transition-colors" />
                                        )}

                                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                                            {renderMessageText(m.message)}
                                        </p>
                                    </div>
                                    
                                    {isMe && <div className="w-[20px]"></div>} {/* spacer to align correctly visually against the reply button width */}
                                </div>
                            )}
                        </div>
                     )})}
                     <div ref={messagesEndRef} />
                 </div>

                 {/* Chat Input Area */}
                 <div className="flex flex-col bg-slate-900 border-t border-white/5 z-10 relative shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
                     
                     {/* Active Reply Banner */}
                     {replyingTo && (
                         <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-indigo-500/20 text-xs">
                             <div className="flex flex-col min-w-0 pr-4 border-l-2 border-indigo-500 pl-2">
                                 <span className="text-indigo-400 font-bold truncate">Replying to @{replyingTo.user}</span>
                                 <span className="text-slate-400 truncate opacity-80 block max-h-5 overflow-hidden">{replyingTo.text}</span>
                             </div>
                             <button type="button" onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white p-1 rounded-full"><X size={14}/></button>
                         </div>
                     )}
                     
                     {/* Image Preview Banner */}
                     {selectedImage && (
                          <div className="px-4 py-3 bg-slate-900/90 flex relative border-b border-white/5 pt-2">
                              <img src={selectedImage} alt="preview" className="h-16 w-auto rounded-lg border border-indigo-500/50 shadow-md" />
                              <button type="button" onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value=''; }} className="absolute top-1 left-2 bg-rose-600 border border-white/10 text-white rounded-full p-0.5 backdrop-blur hover:bg-rose-500 shadow-xl transition-transform hover:scale-110"><X size={12}/></button>
                          </div>
                      )}

                     <form onSubmit={sendChat} className="p-3">
                         <div className="flex items-center gap-2">
                             
                             {/* File Attachment */}
                             {adminConfig.features.imageSharing && (
                                 <>
                                     <input type="file" accept="image/png, image/jpeg, image/gif" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                                     <button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-indigo-400 p-2.5 bg-slate-950 border border-white/5 hover:border-indigo-500/30 rounded-xl transition-all shrink-0 hover:scale-105 active:scale-95 shadow-sm" title="Upload Image (Max 2MB)">
                                         <Share2 size={16} />
                                     </button>
                                 </>
                             )}

                             {/* Effect Selector */}
                             {adminConfig.features.animatedText && (
                                 <select 
                                     value={selectedEffect} 
                                     onChange={e => setSelectedEffect(e.target.value)}
                                     className="bg-slate-950 text-slate-300 border border-white/5 text-xs rounded-xl px-2 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shrink-0 min-w-0 max-w-[40px] truncate shadow-sm appearance-none overflow-hidden cursor-pointer"
                                     title="Text Effects"
                                 >
                                     <option value="">✨</option>
                                     <option value="shake">💥 Shake</option>
                                     <option value="bounce">🪀 Bounce</option>
                                     <option value="glow">💡 Glow</option>
                                 </select>
                             )}

                             {/* Text Input */}
                             <div className="relative flex-1 min-w-0">
                                 <input 
                                     type="text" 
                                     value={chatInput}
                                     onChange={e => setChatInput(e.target.value)}
                                     placeholder={replyingTo ? "Write your reply..." : "Type message... (@mention)"}
                                     className="w-full bg-black/50 border border-white/5 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 shadow-inner"
                                     autoComplete="off"
                                 />
                             </div>
                         </div>
                     </form>
                 </div>
             </div>
             
          </div>
      )}

    </div>
  );
}
