import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus, Image as ImageIcon } from 'lucide-react';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetTokenFlow, setResetTokenFlow] = useState(null); // stores devToken manually for demo
  const [formData, setFormData] = useState({ username: '', password: '', email: '', avatarUrl: '', token: '', newPassword: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
          setError("Avatar must be under 2MB");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData({ ...formData, avatarUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

    if (isForgotPassword) {
        if (!resetTokenFlow) {
            // STEP 1: Request Token
            try {
                const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Request failed');
                
                setSuccess(`[Simulated Email Sent] Use Token: ${data._devLink || 'Check Network Tab'}`);
                setResetTokenFlow(data._devLink || 'devLinkPlaceholder');
                setFormData({ ...formData, token: data._devLink });
            } catch (err) {
                setError(err.message);
            }
        } else {
            // STEP 2: Submit Reset Verification
            try {
                const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: formData.token, newPassword: formData.newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Reset failed');
                
                setSuccess("Password Reset Successful. You may now login.");
                setTimeout(() => {
                    setIsForgotPassword(false);
                    setResetTokenFlow(null);
                    setFormData({ ...formData, verifyToken: '', newPassword: '' });
                    setIsLogin(true);
                }, 2000);
            } catch (err) {
                setError(err.message);
            }
        }
        return;
    }

    try {
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        // Success - store token
        localStorage.setItem('token', data.token);
        onLogin(data.user);
        
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/modes');
    } catch (err) {
        setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px]" />
      
      <div className="z-10 bg-slate-900/50 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm transition-all duration-300">
        <div className="flex flex-col flex-center items-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">BekarAdda</h1>
            <p className="text-slate-400 mt-2 text-sm text-center">Watch live sports and movies with your crew.</p>
        </div>

        {/* Tab Switcher */}
        {!isForgotPassword && (
            <div className="flex bg-black/40 rounded-xl p-1 mb-6 border border-white/5">
                <button 
                    onClick={() => { setIsLogin(true); setError(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    Login
                </button>
                <button 
                    onClick={() => { setIsLogin(false); setError(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-cyan-600 shadow-md text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    Register
                </button>
            </div>
        )}

        {error && <div className="p-3 mb-4 text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-center animate-pulse">{error}</div>}
        {success && <div className="p-3 mb-4 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-center">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isForgotPassword ? (
              <>
                  <button type="button" onClick={() => { setIsForgotPassword(false); setResetTokenFlow(null); }} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold mb-4 opacity-70 underline uppercase">← Back to Login</button>
                  
                  {!resetTokenFlow ? (
                      <div>
                        <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">Your Registered Email</label>
                        <input 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                          placeholder="name@domain.com"
                          required
                        />
                      </div>
                  ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">Received Token</label>
                          <input 
                            type="text" 
                            value={formData.token}
                            onChange={(e) => setFormData({...formData, token: e.target.value})}
                            className="w-full px-4 py-2.5 rounded-lg border-emerald-500/50 bg-black/50 border outline-none focus:border-emerald-500 transition-all text-xs text-emerald-400 font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">New Password</label>
                          <input 
                            type="password" 
                            value={formData.newPassword}
                            onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                            className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 outline-none focus:border-emerald-500 transition-all placeholder:text-slate-600"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                      </>
                  )}
                  
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-lg py-3.5 mt-6 font-bold flex justify-center shadow-lg active:scale-95 transition-all text-white"
                  >
                    {!resetTokenFlow ? 'Reset Password' : 'Confirm New Password'}
                  </button>
              </>
          ) : (
              <>
                  <div>
                    <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">Username</label>
                    <input 
                      type="text" 
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                      placeholder="e.g. Maverick"
                      required
                    />
                  </div>
                  
                  {!isLogin && (
                      <div>
                        <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">Email <span className="opacity-50 lowercase tracking-normal">(Optional)</span></label>
                        <input 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                          placeholder="name@domain.com"
                        />
                      </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1 flex items-center justify-between">
                        Password
                        {isLogin && <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[10px] text-indigo-400 hover:text-indigo-300 normal-case opacity-80 border-b border-indigo-400 border-dashed">Forgot?</button>}
                    </label>
                    <input 
                      type="password" 
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className={`w-full px-4 py-2.5 rounded-lg bg-black/50 border border-white/10 outline-none focus:ring-1 transition-all placeholder:text-slate-600 ${isLogin ? 'focus:border-indigo-500 focus:ring-indigo-500' : 'focus:border-cyan-500 focus:ring-cyan-500'}`}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {!isLogin && (
                      <div className="pt-2">
                         <label className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-2">Avatar <span className="opacity-50 lowercase tracking-normal">(Optional)</span></label>
                         <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                 {formData.avatarUrl ? <img src={formData.avatarUrl} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-500" />}
                             </div>
                             <label className="flex-1 bg-slate-800 hover:bg-slate-700 border border-white/5 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition text-center text-slate-300 hover:text-white">
                                 Upload Image
                                 <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                             </label>
                         </div>
                      </div>
                  )}
                  
                  <button 
                    type="submit" 
                    className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg font-bold transition-all shadow-lg active:scale-95 mt-6 ${isLogin ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20'}`}
                  >
                    {isLogin ? <><LogIn size={18} /> Secure Login</> : <><UserPlus size={18} /> Create Account</>}
                  </button>
              </>
          )}
        </form>
      </div>
    </div>
  );
}
