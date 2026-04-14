import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, X, Save } from 'lucide-react';
import './Header.css';

const Header = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
      username: '',
      preferredLanguage: 'English'
  });

  const handleLogout = () => {
      localStorage.removeItem('token');
      if (setUser) setUser(null);
      navigate('/');
  };

  const openProfile = () => {
      setEditFormData({
          username: user.username,
          preferredLanguage: user.preferredLanguage || 'English'
      });
      setShowProfile(true);
  };

  const saveProfile = async (e) => {
      e.preventDefault();
      try {
          const token = localStorage.getItem('token');
          const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
          const res = await fetch(`${API_BASE}/api/auth/profile`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(editFormData)
          });
          if(res.ok) {
              const updatedUser = await res.json();
              if(setUser) setUser({ id: updatedUser._id, username: updatedUser.username, avatarUrl: updatedUser.avatarUrl, preferredLanguage: updatedUser.preferredLanguage });
              setShowProfile(false);
          }
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <>
    <header className="bekar-header">
      <div className="header-left">
        <div className="brand-container cursor-pointer" onClick={() => navigate('/modes')}>
          <div className="logo-icon">⚡</div>
          <h1 className="brand-title">BekarAdda</h1>
        </div>
        <p className="brand-tagline">A place where people gather for fun timepass</p>
      </div>
      
      <div className="header-right">
        {user ? (
          <div className="user-profile flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition" onClick={openProfile}>
                {user.avatarUrl ? <img src={user.avatarUrl} className="w-8 h-8 rounded-full border border-indigo-500 object-cover" /> : <span className="profile-icon">👤</span>}
                <span className="username font-bold">{user.username || user.name || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-rose-400 hover:text-rose-300 ml-4 border border-rose-500/30 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition">Logout</button>
          </div>
        ) : (
          <div className="header-actions">
            <button className="neon-button" onClick={() => navigate('/')}>
              <span>Join / Create Room</span>
            </button>
          </div>
        )}
      </div>
    </header>

    {showProfile && user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Settings size={20} className="text-indigo-400"/> Profile Settings</h2>
                    <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <form onSubmit={saveProfile} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">Username</label>
                            <input 
                                type="text"
                                required
                                value={editFormData.username}
                                onChange={e => setEditFormData({...editFormData, username: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">Preferred Language</label>
                            <p className="text-xs text-slate-500 mb-3 leading-relaxed">This determines the language of the memes, sounds, and GIFs you experience in watch parties.</p>
                            <select 
                                value={editFormData.preferredLanguage}
                                onChange={e => setEditFormData({...editFormData, preferredLanguage: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none appearance-none text-white font-medium"
                            >
                                <option value="English">English</option>
                                <option value="Telugu">Telugu</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Tamil">Tamil</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                            <Save size={18} /> Save Changes
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Header;
