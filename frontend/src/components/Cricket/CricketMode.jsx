import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Trophy, Clock, X, Check, PlayCircle, Flame, Target, MessageSquareCode, Music, Smile, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const MEMES = [
    { id: 1, label: 'Airhorn', emoji: '🎺', url: 'https://www.myinstants.com/media/sounds/better-ipl-horn.mp3' },
    { id: 2, label: 'Sad Trombone', emoji: '📉', url: 'https://www.myinstants.com/media/sounds/sad-trombone.mp3' },
    { id: 3, label: 'Bruh', emoji: '😂', url: 'https://www.myinstants.com/media/sounds/movie_1.mp3' },
    { id: 4, label: 'Applause', emoji: '👏', url: 'https://www.myinstants.com/media/sounds/golfclap.mp3' }
];

export default function CricketMode({ socket, roomId, user, roomData }) {
    const [predictionWindow, setPredictionWindow] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [myPrediction, setMyPrediction] = useState(null);
    const [lastEvent, setLastEvent] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    // Reaction Engine states
    const [assets, setAssets] = useState([]);
    const [bursts, setBursts] = useState([]);
    const [activeTab, setActiveTab] = useState('reactions');
    const [language, setLanguage] = useState('General');
    const [showMenu, setShowMenu] = useState(false);
    const audioRefs = useRef({});

    const fetchAssets = async () => {
        try {
            const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
            const res = await fetch(`${API_BASE}/api/admin/assets`);
            const data = await res.json();
            setAssets(data);
            const firstCat = data.find(d => d.type === 'emoji' || d.type === 'gif')?.category;
            if (firstCat && language === 'General') {
                setLanguage(firstCat);
            }
        } catch (error) {
            console.error("Failed to load assets", error);
        }
    };


    useEffect(() => {
        fetchAssets();
        socket.on('contentUpdated', fetchAssets);
        return () => socket.off('contentUpdated', fetchAssets);
    }, [socket]);

    const soundAssets = useMemo(() => assets.filter(a => a.type === 'sound'), [assets]);

    const reactionAssets = useMemo(() => {
        const items = assets.filter(a => a.type === 'emoji' || a.type === 'gif');
        const grouped = {};
        items.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push({ text: item.title, emoji: item.type === 'emoji' ? item.url : '✨', image: item.type === 'gif' ? item.url : null, _id: item._id });
        });
        return grouped;
    }, [assets]);

    useEffect(() => {
        soundAssets.forEach(s => {
            if (!audioRefs.current[s._id]) {
                let finalUrl = s.url;
                const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

                // Legacy DB mapping correction for mixed-content
                if (finalUrl.includes('localhost:5001')) {
                    finalUrl = finalUrl.replace(/https?:\/\/localhost:5001/i, baseUrl);
                } else if (finalUrl.startsWith('/uploads')) {
                    finalUrl = `${baseUrl}${finalUrl}`;
                }

                audioRefs.current[s._id] = new Audio(finalUrl);
                audioRefs.current[s._id].volume = roomData?.settings?.memeVolume ?? 0.5;
                audioRefs.current[s._id].preload = "auto";
            }
        });
    }, [soundAssets]);

    const myPredictionRef = useRef(myPrediction);
    useEffect(() => { myPredictionRef.current = myPrediction; }, [myPrediction]);

    useEffect(() => {
        socket.on('cricket_event', (event) => {
            setLastEvent(event);

            // Trigger cheers if prediction matches exactly
            if (myPredictionRef.current === event.lastOutcome) {
                confetti({
                    particleCount: 200,
                    spread: 120,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b', '#ffffff'],
                    zIndex: 9999
                });
            }
        });

        socket.on('prediction_window', ({ roundId, duration }) => {
            setPredictionWindow(roundId);
            setIsLocked(false);
            setTimeLeft(duration);
            setMyPrediction(null); // Reset for new round
        });

        socket.on('prediction_locked', () => {
            setIsLocked(true);
            setTimeLeft(0);
        });

        socket.on('cancel_prediction', () => {
            setPredictionWindow(null);
            setIsLocked(false);
            setTimeLeft(0);
            setMyPrediction(null);
        });

        socket.on('leaderboard_update', (lb) => {
            setLeaderboard(lb);
            setShowLeaderboard(true);
            setTimeout(() => setShowLeaderboard(false), 3000);
        });

        // Dynamic Reactions
        socket.on('movie_reaction', ({ user: reactionUser, emoji, image }) => {
            const newBurst = { id: Math.random().toString(), emoji, image, left: 15 + Math.random() * 70, scale: 0.8 + Math.random() * 0.7 };
            setBursts(prev => [...prev, newBurst]);
            setTimeout(() => setBursts(prev => prev.filter(b => b.id !== newBurst.id)), 3000);
        });

        socket.on('play_sound', ({ user: soundUser, soundId }) => {
            if (audioRefs.current[soundId]) {
                audioRefs.current[soundId].currentTime = 0;
                audioRefs.current[soundId].play().catch(console.error);
            }
        });

        socket.on('play_meme', (memeData) => {
            try {
                const audio = new Audio(memeData.url);
                audio.volume = roomData?.settings?.memeVolume ?? 0.5;
                audio.play().catch(e => console.log('Audio autoplay blocked', e));
            } catch (e) { }
        });


        return () => {
            socket.off('cricket_event');
            socket.off('prediction_window');
            socket.off('cancel_prediction');
            socket.off('leaderboard_update');
            socket.off('movie_reaction');
            socket.off('play_sound');
            socket.off('play_meme');

        };
    }, [socket, user.id]);

    useEffect(() => {
        if (timeLeft > 0 && !isLocked) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [timeLeft, isLocked]);

    const submitPrediction = (runs = null, wicket = false) => {
        if (!predictionWindow || isLocked) return;
        socket.emit('cricket_prediction', {
            roomId,
            userId: user.id,
            roundId: predictionWindow,
            predictedRuns: runs,
            predictedWicket: wicket
        });
        setMyPrediction(wicket ? 'Wicket' : `${runs} Runs`);
    };

    const submitHostResult = (runs, isWicket) => {
        socket.emit('cricket_action', {
            roomId,
            action: 'submit_result',
            payload: {
                roundId: predictionWindow,
                runs: runs,
                isWicket: isWicket,
                outcomeStr: isWicket ? 'Wicket' : `${runs} Runs`
            }
        });
    };

    const sendReaction = (reaction) => {
        socket.emit('movie_reaction', { roomId, user, reactionType: language, emoji: reaction.emoji, image: reaction.image, message: reaction.text });
        socket.emit('chat_message', { roomId, user, message: reaction.text, effect: 'glow', image: reaction.image });
    };

    const emitSound = (sound) => {
        // Physically play locally in the exact same synchronous frame as the mouse click to dodge Chrome's Context blocks!
        if (audioRefs.current[sound._id]) {
            audioRefs.current[sound._id].currentTime = 0;
            audioRefs.current[sound._id].play().catch(console.error);
        }

        socket.emit('play_sound', { roomId, user, soundId: sound._id });
        socket.emit('chat_message', { roomId, user, message: `🎵 Played Sound: ${sound.title}` });
    };

    const playMeme = (url) => {
        socket.emit('trigger_meme', { roomId, memeData: { url } });
    };


    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-30">

            {/* Floating Emoji/GIF Bursts Area */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {bursts.map(burst => (
                    <div
                        key={burst.id}
                        className="absolute animate-in slide-in-from-bottom fade-out duration-[3000ms] pointer-events-none"
                        style={{
                            left: `${burst.left}%`,
                            bottom: '10%',
                            transform: `scale(${burst.scale}) translateY(-35vh)`,
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

            {/* Hover Menu Bottom Left */}
            <div
                className="absolute bottom-6 left-6 pointer-events-auto z-50 flex items-end gap-4"
                onMouseEnter={() => setShowMenu(true)}
                onMouseLeave={() => setShowMenu(false)}
            >
                <button className="w-14 h-14 bg-indigo-600/90 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-transform hover:scale-110">
                    <Sparkles size={24} className={showMenu ? "animate-spin" : ""} />
                </button>

                {showMenu && (
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col items-start gap-4 mb-2 animate-in slide-in-from-left-4 fade-in w-[340px]">

                        <div className="flex items-center justify-between w-full border-b border-white/10 pb-2">
                            <button
                                onClick={() => setActiveTab('reactions')}
                                className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold uppercase transition ${activeTab === 'reactions' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <Smile size={14} /> Reactions
                            </button>
                            <button
                                onClick={() => setActiveTab('sounds')}
                                className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold uppercase transition ${activeTab === 'sounds' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <Music size={14} /> Sounds
                            </button>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto w-full no-scrollbar pb-1">
                            {activeTab === 'reactions' && (
                                <>
                                    <select
                                        value={language}
                                        onChange={e => setLanguage(e.target.value)}
                                        className="bg-slate-950/80 shrink-0 border border-white/10 text-slate-300 text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-500 sticky left-0 z-10"
                                    >
                                        {Object.keys(reactionAssets).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    {(reactionAssets[language] || []).map((reaction, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => sendReaction(reaction)}
                                            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-rose-500/20 rounded-xl transition hover:scale-105 text-xs font-medium focus:outline-none"
                                        >
                                            {reaction.image ? <img src={reaction.image} className="w-5 h-5 rounded object-cover" /> : <span className="text-lg">{reaction.emoji}</span>}
                                            <span className="text-slate-200">{reaction.text}</span>
                                        </button>
                                    ))}
                                    {Object.keys(reactionAssets).length === 0 && <div className="text-xs text-slate-500 italic px-2">None</div>}
                                </>
                            )}

                            {activeTab === 'sounds' && (
                                <>
                                    {soundAssets.map(sound => (
                                        <button
                                            key={sound._id}
                                            onClick={() => emitSound(sound)}
                                            className="shrink-0 flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-indigo-500/20 rounded-xl transition hover:scale-105 text-xs font-medium focus:outline-none group"
                                        >
                                            <span className="text-lg group-hover:animate-pulse">🎵</span>
                                            <span className="text-slate-200">{sound.title}</span>
                                        </button>
                                    ))}
                                    {soundAssets.length === 0 && <div className="text-xs text-slate-500 italic px-2">None</div>}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* TOP LEVEL: Score & Leaderboard */}
            <div className="flex justify-between items-start pointer-events-auto">
                <div className="flex flex-col gap-4">

                    {/* Leaderboard Manually Trigger Icon overlaying correctly near User Panel */}
                    <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="w-10 h-10 bg-slate-900/80 backdrop-blur border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-500 hover:scale-110 transition shadow-[0_0_15px_rgba(245,158,11,0.2)]" title="Toggle Leaderboard">
                        <Trophy size={18} />
                    </button>

                    {/* Host Game Master Control */}
                    {roomData?.host === socket?.id && (
                        <div className="bg-slate-900/80 backdrop-blur-md border border-indigo-500/30 p-4 rounded-2xl shadow-xl flex flex-col justify-center items-center">
                            {!predictionWindow ? (
                                <>
                                    <button
                                        onClick={() => socket.emit('cricket_action', { roomId, action: 'start_prediction' })}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold tracking-wide transition shadow-lg shadow-indigo-500/20 flex items-center gap-2 text-sm"
                                    >
                                        <PlayCircle size={16} /> Loop Predictions
                                    </button>
                                </>
                            ) : !isLocked ? (
                                <>
                                    <button
                                        onClick={() => socket.emit('cricket_action', { roomId, action: 'cancel_prediction' })}
                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold tracking-wide transition shadow-lg shadow-red-500/20 flex items-center gap-2 text-sm"
                                    >
                                        <X size={16} /> Stop Loop
                                    </button>
                                    <p className="text-xs text-red-300 mt-2 font-medium">Predicting... ({timeLeft}s)</p>
                                </>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <h4 className="font-black text-amber-500 mb-2 tracking-widest uppercase text-xs">Enter Actual Result:</h4>
                                    <div className="grid grid-cols-4 gap-1 mb-2">
                                        {[0, 1, 2, 3, 4, 6].map(runs => (
                                            <button key={`host-${runs}`} onClick={() => submitHostResult(runs, false)} className="bg-slate-700 hover:bg-indigo-500 text-white py-1.5 px-3 rounded text-sm font-bold transition">
                                                {runs}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => submitHostResult(0, true)} className="w-full bg-red-600 hover:bg-red-500 text-white py-1.5 rounded font-bold transition uppercase text-xs tracking-widest mt-1">
                                        Wicket
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* LEADERBOARD PANEL */}
                {showLeaderboard && leaderboard.length > 0 && (
                    <div className="w-64 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Trophy size={14} className="text-amber-400" /> Leaderboard
                            </h3>
                            <button onClick={() => setShowLeaderboard(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                        </div>
                        <div className="space-y-2">
                            {leaderboard.map((lb, i) => (
                                <div key={lb.username} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="text-xs font-bold text-slate-500 w-3">{i + 1}</span>
                                        <span className="text-sm font-medium truncate">{lb.username}</span>
                                    </div>
                                    <span className="text-sm font-black text-indigo-400">{lb.points}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* BOTTOM LEVEL: Prediction, Memes */}
            <div className="flex flex-col items-center justify-end pointer-events-auto mt-auto gap-4">
                {/* ACTIVE PREDICTION UI */}
                {predictionWindow && !myPrediction && (
                    <div className="bg-slate-900/95 backdrop-blur-xl border-t-2 border-indigo-500 p-4 rounded-2xl shadow-2xl text-center max-w-sm w-full animate-in slide-in-from-bottom-4 fade-in duration-300">

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black">{isLocked ? "Host Deciding..." : "Predict Next Ball!"}</h3>
                            <div className="flex items-center gap-1.5 text-indigo-300 font-mono font-bold bg-indigo-950/50 py-1.5 px-3 rounded-full border border-indigo-500/20 text-xs shadow-inner">
                                {isLocked ? <Flame size={14} className="text-amber-500 animate-pulse" /> : <Clock size={14} />}
                                {isLocked ? 'LOCKED' : `00:${timeLeft.toString().padStart(2, '0')}`}
                            </div>
                        </div>

                        <div className="grid grid-cols-6 gap-2 mb-3">
                            {[0, 1, 2, 3, 4, 6].map(runs => (
                                <button
                                    key={runs}
                                    onClick={() => submitPrediction(runs, false)}
                                    className="bg-slate-800 hover:bg-indigo-600 border border-white/5 py-3 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95 shadow-md shadow-black/50"
                                >
                                    {runs}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => submitPrediction(null, true)}
                            className="w-full bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white py-2 rounded-xl font-black text-sm transition-all uppercase tracking-widest active:scale-95"
                        >
                            Wicket
                        </button>
                    </div>
                )}

                {/* PREDICTION LOCKED IN */}
                {myPrediction && predictionWindow && (
                    <div className="bg-emerald-950/90 backdrop-blur-xl border border-emerald-500/30 px-8 py-5 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Check size={20} />
                        </div>
                        <span className="font-medium text-emerald-100 text-lg">Prediction locked in: <strong className="text-white text-xl ml-1">{myPrediction}</strong></span>
                    </div>
                )}

                {/* UI DOCK: Memes & Dares */}
                {!predictionWindow && (
                    <div className="flex bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-2 shadow-2xl gap-4 h-16 pointer-events-auto">

                        {/* MEME SOUNDBOARD */}
                        <div className="flex items-center gap-2 border-r border-white/10 pr-4 pl-2">
                            {MEMES.map(meme => (
                                <button
                                    key={meme.id}
                                    onClick={() => playMeme(meme.url)}
                                    title={`Play ${meme.label}`}
                                    className="w-12 h-12 bg-black/40 hover:bg-indigo-500/30 border border-white/5 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110"
                                >
                                    {meme.emoji}
                                </button>
                            ))}
                        </div>



                    </div>
                )}

            </div>

        </div>
    );
}
