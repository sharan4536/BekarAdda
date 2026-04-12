import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import ModeSelection from './pages/ModeSelection';
import Room from './pages/Room';
import AuthPage from './pages/AuthPage';
import Header from './components/Header';
import AdminConsole from './pages/AdminConsole';

function StandardLayout({ user }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
      <div className="flex flex-col min-h-screen relative w-full h-full">
         {!isAdmin && <Header user={user} setUser={setUser} />}
         <main className="flex-grow flex flex-col relative w-full h-full" style={{ paddingTop: isAdmin ? '0' : '65px' }}>
            <Routes>
              <Route path="/" element={<AuthPage onLogin={setUser => null /* Lifted to App wrapper normally */} />} />
              <Route path="/modes" element={<ModeSelection user={user} />} />
              <Route path="/room/:id" element={<Room user={user} />} />
              <Route path="/admin" element={<AdminConsole />} />
            </Routes>
         </main>
      </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null); // Local state for simplicity in MVP
  const [loadingOverlay, setLoadingOverlay] = useState(true);

  React.useEffect(() => {
     const parseToken = async () => {
         const token = localStorage.getItem('token');
         if (!token) {
             setLoadingOverlay(false);
             return;
         }
         try {
             const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
             const res = await fetch(`${API_BASE}/api/auth/me`, {
                 headers: { 'Authorization': `Bearer ${token}` }
             });
             if (res.ok) {
                 const data = await res.json();
                 setUser({ id: data._id, username: data.username, avatarUrl: data.avatarUrl });
             } else {
                 localStorage.removeItem('token');
             }
         } catch(e) {
             console.error("Token restore failed");
         } finally {
             setLoadingOverlay(false);
         }
     };
     parseToken();
  }, []);

  if (loadingOverlay) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <BrowserRouter>
       <Routes>
           <Route path="/admin" element={<AdminConsole />} />
           <Route path="*" element={
               <div className="flex flex-col min-h-screen">
                 <Header user={user} setUser={setUser} />
                 <main className="flex-grow flex flex-col relative w-full h-full">
                   <Routes>
                     <Route path="/" element={<AuthPage onLogin={setUser} />} />
                     <Route path="/modes" element={<ModeSelection user={user} />} />
                     <Route path="/room/:id" element={<Room user={user} />} />
                   </Routes>
                 </main>
               </div>
           } />
       </Routes>
    </BrowserRouter>
  );
}
