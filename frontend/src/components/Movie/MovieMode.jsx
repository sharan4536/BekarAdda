import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings2, Zap, Music, Smile } from 'lucide-react';

export default function MovieMode({ socket, roomId, user, roomData }) {
  const [activeTab, setActiveTab] = useState('reactions'); // 'reactions' or 'sounds'
  
  // Dynamic Assets from Backend
  const [assets, setAssets] = useState([]);
  const [bursts, setBursts] = useState([]);
  const [language, setLanguage] = useState('General'); // Dynamically defaults to first category

  const fetchAssets = async () => {
      try {
          const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
          const res = await fetch(`${API_BASE}/api/admin/assets`);
          const data = await res.json();
          setAssets(data);
          
      } catch(e) {
          console.error("Asset Load Failed", e);
      }
  };

  useEffect(() => {
     fetchAssets();
     socket.on('contentUpdated', fetchAssets); // Admin push listener
     return () => socket.off('contentUpdated', fetchAssets);
  }, [socket]);

  // Semantic Localization Engine
  const localizedAssets = useMemo(() => {
     const map = new Map();
     assets.forEach(a => {
         const key = `${a.type}_${a.title}`;
         if (!map.has(key)) map.set(key, []);
         map.get(key).push(a);
     });
     
     const prefLang = user?.preferredLanguage || 'English';
     const finalAssets = [];
     
     map.forEach(candidates => {
         const match = candidates.find(a => a.language === prefLang) 
                       || candidates.find(a => a.language === 'English') 
                       || candidates.find(a => a.language === 'Global') 
                       || candidates[0];
         finalAssets.push(match);
     });
     return finalAssets;
  }, [assets, user?.preferredLanguage]);

  const localizedAssetsRef = useRef(localizedAssets);
  useEffect(() => {
      localizedAssetsRef.current = localizedAssets;
      // Initialize category dropdown safely based on localized slice
      const firstCat = localizedAssets.find(d => d.type === 'emoji' || d.type === 'gif')?.category;
      if (firstCat && language === 'General') setLanguage(firstCat);
  }, [localizedAssets]);

  // Derived Categorized Maps
  const soundAssets = useMemo(() => localizedAssets.filter(a => a.type === 'sound'), [localizedAssets]);
  
  const reactionAssets = useMemo(() => {
      const items = localizedAssets.filter(a => a.type === 'emoji' || a.type === 'gif');
      const grouped = {};
      items.forEach(item => {
          if (!grouped[item.category]) grouped[item.category] = [];
          
          grouped[item.category].push({
              text: item.title,
              emoji: item.type === 'emoji' ? item.url : '✨',
              image: item.type === 'gif' ? item.url : null
          });
      });
      return grouped;
  }, [localizedAssets]);
  
  // Audio Map to prevent redundant creations
  const audioRefs = useRef({});

  useEffect(() => {
    // Pre-load audio mapped dynamically whenever assets array changes
    // Must pre-load ALL assets across all languages to ensure immediate playback of semantic fallback hits without network delay
    assets.filter(a => a.type === 'sound').forEach(s => {
        if (!audioRefs.current[s._id]) {
            audioRefs.current[s._id] = new Audio(s.url);
        }
        audioRefs.current[s._id].volume = roomData?.settings?.memeVolume ?? 0.5;
    });
  }, [assets, roomData?.settings?.memeVolume]);

  useEffect(() => {
    const handleReaction = (payload) => {
        const { semanticTitle, senderFallback, user: reactionUser } = payload;
        
        let emoji = senderFallback?.emoji;
        let image = senderFallback?.image;
        
        // Semantic Routing: Override with our own user's localized payload if valid
        if(semanticTitle) {
            const localMatch = localizedAssetsRef.current.find(a => a.title === semanticTitle && (a.type === 'emoji' || a.type === 'gif'));
            if (localMatch) {
                if (localMatch.type === 'emoji') { emoji = localMatch.url; image = null; }
                else if (localMatch.type === 'gif') { image = localMatch.url; emoji = null; }
            }
        }

        const newBurst = {
            id: Math.random().toString(),
            emoji,
            image,
            left: 15 + Math.random() * 70, // Keep in bounds safely
            scale: 0.8 + Math.random() * 0.7,
        };
        setBursts(prev => [...prev, newBurst]);

        setTimeout(() => {
            setBursts(prev => prev.filter(b => b.id !== newBurst.id));
        }, 3000); // 3 sec for GIFs to play out a bit
    };

    const handlePlaySound = (payload) => {
        const { semanticTitle, senderFallbackId } = payload;
        let targetId = senderFallbackId;
        
        if (semanticTitle) {
            const localMatch = localizedAssetsRef.current.find(a => a.title === semanticTitle && a.type === 'sound');
            if (localMatch) targetId = localMatch._id;
        }

        if(audioRefs.current[targetId]) {
            // Reset and play
            audioRefs.current[targetId].currentTime = 0;
            audioRefs.current[targetId].play().catch(console.error);
        }
    };

    socket.on('movie_reaction', handleReaction);
    socket.on('play_sound', handlePlaySound);
    
    return () => {
        socket.off('movie_reaction', handleReaction);
        socket.off('play_sound', handlePlaySound);
    };
  }, [socket]);

  const sendReaction = (reaction) => {
      socket.emit('movie_reaction', { 
          roomId, 
          user, 
          semanticTitle: reaction.text,
          senderFallback: { emoji: reaction.emoji, image: reaction.image },
          message: reaction.text 
      });
      // Emitting to Chat using exactly what this sender triggered!
      socket.emit('chat_message', { roomId, user, message: reaction.text, effect: 'glow', image: reaction.image }); 
  };

  const emitSound = (sound) => {
      socket.emit('play_sound', { 
          roomId, 
          user, 
          semanticTitle: sound.title,
          senderFallbackId: sound._id
      });
      socket.emit('chat_message', { roomId, user, message: `🎵 Played Sound: ${sound.title}` });
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end p-4 pb-8 z-30">
        
        {/* Floating Emoji/GIF Bursts Area */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
             {bursts.map(burst => (
                 <div 
                    key={burst.id} 
                    className="absolute animate-in slide-in-from-bottom fade-out duration-[3000ms] pointer-events-none"
                    style={{ 
                        left: `${burst.left}%`, 
                        bottom: '20%',
                        transform: `scale(${burst.scale}) translateY(-60vh)`, // Pure CSS flying upward
                        transition: 'transform 3s ease-out',
                    }}
                 >
                     {burst.image ? (
                         <img src={burst.image} alt="reaction" className="w-24 h-24 object-cover rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
                     ) : (
                         <span className="text-6xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">{burst.emoji}</span>
                     )}
                 </div>
             ))}
        </div>

        {/* Reaction Panel Bottom Bar */}
        <div className="pointer-events-auto flex flex-col gap-2 self-center w-full max-w-3xl z-10 transition-all">
            <div className="flex items-center justify-between px-2 bg-slate-900/60 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl w-max mx-auto shadow-xl">
                <button 
                  onClick={() => setActiveTab('reactions')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${activeTab === 'reactions' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Smile size={14} /> Reactions
                </button>
                <button 
                  onClick={() => setActiveTab('sounds')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${activeTab === 'sounds' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Music size={14} /> Soundboard
                </button>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex items-center justify-start gap-3 shadow-2xl overflow-x-auto no-scrollbar w-full relative">
                
                {activeTab === 'reactions' && Object.keys(reactionAssets).length > 0 && (
                    <>
                        <select 
                            value={language} 
                            onChange={e => setLanguage(e.target.value)}
                            className="bg-slate-950/80 shrink-0 border border-white/10 text-slate-300 text-sm font-semibold rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-rose-500 sticky left-0 z-10"
                        >
                            {Object.keys(reactionAssets).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="w-[1px] h-10 bg-white/10 shrink-0 mx-1 rounded-full"></div>
                        {(reactionAssets[language] || []).map((reaction, idx) => (
                            <button 
                                key={idx}
                                onClick={() => sendReaction(reaction)}
                                className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-800/60 border border-transparent hover:border-rose-500/40 hover:bg-rose-500/20 rounded-xl transition-all hover:scale-105 active:scale-95 text-sm font-medium hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] shadow-sm"
                            >
                                {reaction.image ? <img src={reaction.image} className="w-6 h-6 rounded object-cover" /> : <span className="text-xl">{reaction.emoji}</span>}
                                <span className="text-slate-200">{reaction.text}</span>
                            </button>
                        ))}
                    </>
                )}
                {activeTab === 'reactions' && Object.keys(reactionAssets).length === 0 && (
                     <div className="text-sm text-slate-500 italic p-3">No reactions available.</div>
                )}

                {activeTab === 'sounds' && (
                   <>
                       {soundAssets.map(sound => (
                           <button 
                               key={sound._id}
                               onClick={() => emitSound(sound)}
                               className="shrink-0 flex items-center gap-2 px-4 py-3 bg-slate-800/60 border border-transparent hover:border-indigo-500/40 hover:bg-indigo-500/20 rounded-xl transition-all hover:scale-105 active:scale-95 text-sm font-medium shadow-sm group focus:outline-none hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                           >
                               <span className="text-xl group-hover:animate-pulse">🎵</span>
                               <span className="text-slate-200">{sound.title}</span>
                           </button>
                       ))}
                       {soundAssets.length === 0 && <div className="text-sm text-slate-500 italic p-3">No soundboards configured.</div>}
                   </>
                )}

            </div>
        </div>
    </div>
  );
}
