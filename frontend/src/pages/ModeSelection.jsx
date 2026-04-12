import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Film, ArrowRight, Users } from 'lucide-react';

export default function ModeSelection({ user }) {
  const navigate = useNavigate();
  const [joinInput, setJoinInput] = useState('');

  const handleCreateRoom = (mode) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i=0; i<6; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    
    navigate(`/room/${roomId}?mode=${mode}`);
  };

  const handleJoinExisting = (e) => {
      e.preventDefault();
      let input = joinInput.trim();
      if (!input) return;

      if (input.includes('/room/')) {
          const match = input.match(/\/room\/([a-zA-Z0-9_-]+)/);
          if (match) {
              const targetPath = input.substring(input.indexOf('/room/'));
              navigate(targetPath);
              return;
          }
      }
      
      const cleanCode = input.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if(cleanCode) {
          navigate(`/room/${cleanCode}?mode=cricket`);
      }
  };

  if(!user) {
      setTimeout(() => navigate('/'), 0);
      return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white relative">
      <div className="text-center mb-12 z-10">
        <h1 className="text-4xl font-bold mb-3">Choose Your Experience</h1>
        <p className="text-slate-400">Select what you want to watch with your friends today.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl px-6 z-10">
        {/* Cricket Mode Card */}
        <div 
          onClick={() => handleCreateRoom('cricket')}
          className="group flex-1 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/20 hover:border-emerald-400/50 rounded-3xl p-8 cursor-pointer transition-all hover:scale-[1.02] overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy size={120} />
          </div>
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Trophy className="text-emerald-400" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Watch Cricket Match 🏏</h2>
          <p className="text-slate-300 mb-8 max-w-sm">
            Live scores, interactive predictions, and real-time leaderboards. Challenge friends to predict the next ball!
          </p>
          <button className="flex items-center gap-2 text-emerald-400 font-medium group-hover:translate-x-2 transition-transform">
            Start Party <ArrowRight size={18} />
          </button>
        </div>

        {/* Movie Mode Card */}
        <div 
          onClick={() => handleCreateRoom('movie')}
          className="group flex-1 bg-gradient-to-br from-rose-900/40 to-purple-900/40 border border-rose-500/20 hover:border-rose-400/50 rounded-3xl p-8 cursor-pointer transition-all hover:scale-[1.02] overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Film size={120} />
          </div>
          <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Film className="text-rose-400" size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Watch Movie 🎬</h2>
          <p className="text-slate-300 mb-8 max-w-sm">
            Sync video playback, use smart language-specific reactions, spam emojis, and vibe with your squad.
          </p>
          <button className="flex items-center gap-2 text-rose-400 font-medium group-hover:translate-x-2 transition-transform">
            Start Party <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Join Existing Party UI */}
      <div className="w-full max-w-4xl px-6 z-10 mt-8">
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 transform transition-all hover:border-white/10 shadow-xl">
              <div className="flex items-center gap-4 text-center sm:text-left w-full sm:w-auto">
                  <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                      <Users className="text-indigo-400" size={28} />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold mb-1">Have a Party Code?</h3>
                      <p className="text-sm text-slate-400">Paste your room link or ID to join instantly.</p>
                  </div>
              </div>
              <form onSubmit={handleJoinExisting} className="flex relative w-full sm:w-auto sm:min-w-[320px]">
                  <input 
                      type="text" 
                      placeholder="e.g. A8X9B2"
                      value={joinInput}
                      onChange={e => setJoinInput(e.target.value.toUpperCase())}
                      className="bg-black/50 border border-white/10 rounded-xl py-4 pl-5 pr-24 w-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono uppercase"
                  />
                  <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg px-6 font-bold shadow-md transition-colors">
                      Join
                  </button>
              </form>
          </div>
      </div>

      {/* Developer Contact Footer */}
      <div className="mt-12 text-center text-slate-500 text-sm pb-8 z-10">
        <p>Contact <a href="https://instagram.com/real_sharan_" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">@real_sharan_</a></p>
      </div>

    </div>
  );
}
