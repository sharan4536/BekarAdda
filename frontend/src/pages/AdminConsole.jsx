import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Smile, FileVideo, Music, MessageSquare, Trash2, Edit, Plus, Activity, Users, Home, ActivitySquare, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001') + '/api/admin';

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ assets: {}, live: {} });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [assets, setAssets] = useState([]);
  const [config, setConfig] = useState(null);
  
  // Form States
  const [formData, setFormData] = useState({ title: '', url: '', category: 'General', type: 'emoji' });
  const [isEditing, setIsEditing] = useState(null);
  const navigate = useNavigate();

  const fetchStats = async () => {
      try {
          const res = await fetch(`${API_BASE}/stats`);
          const data = await res.json();
          setStats(data);
      } catch (e) {
          console.error(e);
      }
  };

  const fetchAssets = async (type) => {
      try {
          const res = await fetch(`${API_BASE}/assets?type=${type}`);
          setAssets(await res.json());
      } catch (e) {
          console.error(e);
      }
  };

  const fetchConfig = async () => {
      try {
          const res = await fetch(`${API_BASE}/config`);
          setConfig(await res.json());
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
     if (activeTab === 'dashboard') fetchStats();
     else if (['emoji', 'gif', 'sound'].includes(activeTab)) {
         setFormData(prev => ({...prev, type: activeTab, url: '', title: ''}));
         fetchAssets(activeTab);
     }
     else if (activeTab === 'chat') fetchConfig();
  }, [activeTab]);

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
              const res = await fetch(`${API_BASE}/upload-base64`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: file.name, base64: reader.result })
              });
              const data = await res.json();
              if(data.url) setFormData(prev => ({...prev, url: data.url}));
          } catch (err) {
              console.error(err);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleSaveAsset = async (e) => {
      e.preventDefault();
      try {
          let targetUrl = formData.url;
          
          if ((activeTab === 'gif' || activeTab === 'sound') && !targetUrl.match(/\.(gif|mp3|wav|ogg|m4a)$/i) && !targetUrl.startsWith('data:')) {
               const resolveRes = await fetch(`${API_BASE}/resolve-media?url=${encodeURIComponent(targetUrl)}&type=${activeTab}`);
               const resolveData = await resolveRes.json();
               if(resolveData.url) targetUrl = resolveData.url;
          }

          const method = isEditing ? 'PUT' : 'POST';
          const endpoint = isEditing ? `${API_BASE}/assets/${isEditing}` : `${API_BASE}/assets`;
          
          await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...formData, url: targetUrl })
          });
          
          setFormData({ title: '', url: '', category: 'General', type: activeTab });
          setIsEditing(null);
          fetchAssets(activeTab);
      } catch (e) {
          console.error(e);
      }
  };

  const handleDeleteAsset = async (id) => {
      if(!window.confirm('Delete this asset permanently?')) return;
      
      // Optimistic instant UI update to prevent browser FETCH caching sync-delays
      setAssets(prev => prev.filter(a => a._id !== id));
      
      try {
          await fetch(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
          fetchAssets(activeTab);
      } catch (e) {
          console.error(e);
          fetchAssets(activeTab); // Revert UI if server fails
      }
  };

  const toggleConfig = async (key) => {
      try {
          const newConfig = { ...config.features, [key]: !config.features[key] };
          const res = await fetch(`${API_BASE}/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newConfig)
          });
          setConfig(await res.json());
      } catch(e) {
          console.error(e);
      }
  };

  const NAV_ITEMS = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'emoji', label: 'Emoji Manager', icon: <Smile size={18} /> },
      { id: 'gif', label: 'GIF Manager', icon: <FileVideo size={18} /> },
      { id: 'sound', label: 'Soundboard', icon: <Music size={18} /> },
      { id: 'chat', label: 'Chat Controls', icon: <MessageSquare size={18} /> },
  ];

  const handleLogin = (e) => {
      e.preventDefault();
      if(loginPassword === '2224') {
          setIsAuthenticated(true);
          setLoginError('');
      } else {
          setLoginError('Invalid Administrator Password');
      }
  };

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-200">
              <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.15)] w-full max-w-md animate-in slide-in-from-bottom-8 duration-500">
                  <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <LayoutDashboard className="text-indigo-400" size={32} />
                  </div>
                  <h1 className="text-2xl font-black text-center mb-2 tracking-wide">Developer Console</h1>
                  <p className="text-sm text-slate-400 text-center mb-8">Restricted Access Array</p>
                  
                  <form onSubmit={handleLogin} className="space-y-5">
                      <div>
                          <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">Clearance Code</label>
                          <input 
                              type="password" 
                              value={loginPassword} 
                              onChange={e => setLoginPassword(e.target.value)} 
                              className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-center tracking-[1em] text-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition" 
                              placeholder="••••"
                              autoFocus
                          />
                      </div>
                      {loginError && <p className="text-red-400 text-xs font-bold text-center animate-bounce">{loginError}</p>}
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]">
                          Authenticate
                      </button>
                  </form>
                  <button onClick={() => navigate('/modes')} className="w-full mt-4 py-3 text-slate-500 hover:text-slate-300 text-sm font-bold transition">
                      Return to Lobby
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex font-sans overflow-hidden">
        
        {/* Sidebar */}
        <aside className={`bg-slate-900 border-r border-indigo-500/20 shadow-[5px_0_30px_rgba(0,0,0,0.5)] transition-all flex flex-col z-20 ${sidebarOpen ? 'w-64 relative' : 'w-0 absolute -left-64'}`}>
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                   <h1 className="text-xl font-bold tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">BekarAdda</h1>
                   <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-1">DEVELOPER CONSOLE</p>
                </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {NAV_ITEMS.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border ${activeTab === item.id ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        {item.icon} {item.label}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5">
                <button onClick={() => navigate('/modes')} className="w-full flex items-center gap-2 justify-center px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition text-sm font-bold text-slate-300">
                    <Home size={16} /> Exit to App
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
            
            <header className="h-20 border-b border-white/5 bg-slate-900/50 backdrop-blur flex items-center px-8 sticky top-0 z-10 shrink-0">
                <h2 className="text-2xl font-bold tracking-wide flex items-center gap-3">
                    {NAV_ITEMS.find(n => n.id === activeTab)?.icon} 
                    {NAV_ITEMS.find(n => n.id === activeTab)?.label}
                </h2>
            </header>

            <div className="p-8 max-w-7xl mx-auto w-full">
                
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:-translate-y-1 transition">
                                <ActivitySquare className="text-indigo-400 mb-4" size={28} />
                                <h3 className="text-3xl font-black">{stats.live?.rooms || 0}</h3>
                                <p className="text-xs tracking-widest text-slate-500 font-bold uppercase mt-1">Active Rooms</p>
                            </div>
                            <div className="bg-slate-900 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:-translate-y-1 transition">
                                <Users className="text-cyan-400 mb-4" size={28} />
                                <h3 className="text-3xl font-black">{stats.live?.users || 0}</h3>
                                <p className="text-xs tracking-widest text-slate-500 font-bold uppercase mt-1">Live Users</p>
                            </div>
                            <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl hover:-translate-y-1 transition">
                                <Smile className="text-slate-400 mb-4" size={28} />
                                <h3 className="text-3xl font-black">{stats.assets?.emoji || 0}</h3>
                                <p className="text-xs tracking-widest text-slate-500 font-bold uppercase mt-1">Configured Emojis</p>
                            </div>
                            <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl hover:-translate-y-1 transition">
                                <FileVideo className="text-slate-400 mb-4" size={28} />
                                <h3 className="text-3xl font-black">{stats.assets?.gif || 0}</h3>
                                <p className="text-xs tracking-widest text-slate-500 font-bold uppercase mt-1">Active GIFs</p>
                            </div>
                            <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl hover:-translate-y-1 transition">
                                <Music className="text-slate-400 mb-4" size={28} />
                                <h3 className="text-3xl font-black">{stats.assets?.sound || 0}</h3>
                                <p className="text-xs tracking-widest text-slate-500 font-bold uppercase mt-1">Soundboard Assets</p>
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 mt-8">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={20} className="text-emerald-400"/> System Status</h3>
                            <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-sm text-emerald-400">
                                [SYS_OK] BekarAdda Socket Layer Active.<br/>
                                [SYS_OK] Admin Control Plane Listening on Port 5001.
                            </div>
                        </div>
                    </div>
                )}

                {/* ASSET MANAGERS (Emoji, GIF, Sound) */}
                {['emoji', 'gif', 'sound'].includes(activeTab) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* Editor Form */}
                        <div className="bg-slate-900 border border-indigo-500/20 p-6 rounded-3xl shadow-xl lg:col-span-1 h-fit">
                            <h3 className="text-lg font-bold mb-6">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h3>
                            <form onSubmit={handleSaveAsset} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">Display Title</label>
                                    <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="e.g. Crazy Laugh" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">{activeTab === 'emoji' ? 'Emoji / Image URL' : 'Media URL'}</label>
                                    <div className="flex gap-2">
                                        <input required type="text" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none" placeholder={activeTab === 'emoji' ? "Emoji Char or URL" : "https://..."} />
                                        {(activeTab === 'gif' || activeTab === 'sound') && (
                                            <div className="relative overflow-hidden shrink-0 flex items-center justify-center bg-indigo-500/20 px-4 rounded-xl border border-indigo-500/30 hover:bg-indigo-500/40 cursor-pointer transition">
                                                 <span className="text-indigo-300 font-bold text-sm pointer-events-none">Upload</span>
                                                 <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept={activeTab==='gif' ? 'image/gif,image/png,image/jpeg' : 'audio/mp3,audio/wav,audio/ogg,audio/mpeg'} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-2 block">Category Filter</label>
                                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none" />
                                </div>
                                
                                <div className="pt-4 flex gap-3">
                                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                                        <Save size={18} /> {isEditing ? 'Update' : 'Publish'} Asset
                                    </button>
                                    {isEditing && (
                                        <button type="button" onClick={() => { setIsEditing(null); setFormData({...formData, url: '', title: ''}); }} className="px-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition">
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Grid View */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {assets.map(asset => (
                                    <div key={asset._id} className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:border-white/20 transition group">
                                        
                                        <div className="w-16 h-16 shrink-0 bg-black/50 rounded-xl flex items-center justify-center border border-white/5 overflow-hidden">
                                            {activeTab === 'emoji' && (asset.url.length <= 4 ? <span className="text-3xl">{asset.url}</span> : <img src={asset.url} className="w-full h-full object-cover"/>)}
                                            {activeTab === 'gif' && <img src={asset.url} className="w-full h-full object-cover"/>}
                                            {activeTab === 'sound' && <Music className="text-indigo-400" />}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-200 truncate">{asset.title}</h4>
                                            <p className="text-xs text-slate-500 uppercase tracking-widest">{asset.category}</p>
                                        </div>

                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => { setIsEditing(asset._id); setFormData({ title: asset.title, url: asset.url, category: asset.category, type: asset.type }); }} className="p-2 bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteAsset(asset._id)} className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {assets.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-slate-500 flex flex-col items-center">
                                        <Plus size={32} className="mb-2 opacity-50" />
                                        <p>No assets found. Add your first {activeTab}!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CHAT CONTROLS TAB */}
                {activeTab === 'chat' && config && (
                    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 shadow-xl">
                            <h3 className="text-xl font-bold mb-2">Platform Mechanics</h3>
                            <p className="text-sm text-slate-400 mb-8">Toggle core interaction protocols across all live active rooms seamlessly. Changes broadcast instantly via WebSockets.</p>
                            
                            <div className="space-y-4">
                                {Object.entries(config.features).map(([key, val]) => (
                                    <div key={key} className="flex items-center justify-between p-4 bg-black/30 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition">
                                        <div>
                                            <h4 className="font-bold text-slate-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                                            <p className="text-xs text-slate-500 mt-1">Allow users to utilize {key.replace(/([A-Z])/g, ' $1').toLowerCase()} features globally.</p>
                                        </div>
                                        <button 
                                            onClick={() => toggleConfig(key)}
                                            className={`w-14 h-8 rounded-full transition-colors relative shadow-inner ${val ? 'bg-indigo-500' : 'bg-slate-800'}`}
                                        >
                                            <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${val ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </main>
    </div>
  );
}
