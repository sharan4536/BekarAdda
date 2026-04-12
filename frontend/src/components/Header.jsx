import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

const Header = ({ user, setUser }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
      localStorage.removeItem('token');
      if (setUser) setUser(null);
      navigate('/');
  };

  return (
    <header className="bekar-header">
      <div className="header-left">
        <div className="brand-container">
          <div className="logo-icon">⚡</div>
          <h1 className="brand-title">BekarAdda</h1>
        </div>
        <p className="brand-tagline">A place where people gather for fun timepass</p>
      </div>
      
      <div className="header-right">
        {user ? (
          <div className="user-profile flex items-center gap-4">
            <div className="flex items-center gap-2">
                {user.avatarUrl ? <img src={user.avatarUrl} className="w-8 h-8 rounded-full border border-indigo-500 object-cover" /> : <span className="profile-icon">👤</span>}
                <span className="username">{user.username || user.name || 'User'}</span>
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
  );
};

export default Header;
