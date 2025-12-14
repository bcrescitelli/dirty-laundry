import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { 
  Users, Clock, ShieldAlert, FileText, Send, Lock, Zap, ArrowRight, 
  Eye, Volume2, VolumeX, Mic, Play, Pause, Gavel, ThumbsUp, Mail, 
  CheckCircle, XCircle, Camera, Skull, Ghost, AlertTriangle, RefreshCw, Edit3
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION
  -----------------------------------------------------------------------
*/
const DEFAULT_WEAPONS = [
  'Rusty Axe', 'Poisoned Gumbo', 'Bear Trap', 'Hunting Rifle', 
  'Canoe Paddle', 'Fireplace Poker', 'Strangulation', 'Ice Pick',
  'Chainsaw', 'Antler', 'Fishing Line', 'Heavy Skillet', 'Flare Gun'
];

const firebaseConfig = {
  apiKey: "AIzaSyAvM_8kKHGCG0q0FoDJR8-QL1fIjn1iCAw",
  authDomain: "dirty-laundry-bd46a.firebaseapp.com",
  projectId: "dirty-laundry-bd46a",
  storageBucket: "dirty-laundry-bd46a.firebasestorage.app",
  messagingSenderId: "480140003624",
  appId: "1:480140003624:web:e45ed010e9239a15fe681d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "murder-at-the-cabin";

/* -----------------------------------------------------------------------
  UTILITIES
  -----------------------------------------------------------------------
*/
const resizeImage = (file, maxWidth = 300) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

const GameStyles = () => (
  <style>{`
    @keyframes fog { 
      0% { transform: translateX(-5%) translateY(0); opacity: 0.3; } 
      50% { opacity: 0.6; }
      100% { transform: translateX(5%) translateY(-2%); opacity: 0.3; } 
    }
    .fog-layer {
      position: absolute; inset: -50%; width: 200%; height: 200%;
      background: radial-gradient(circle at 50% 50%, transparent 20%, rgba(200,200,200,0.1) 60%, transparent 80%);
      animation: fog 30s infinite alternate ease-in-out; 
      pointer-events: none; z-index: 1;
    }
    .crt-scanline {
      position: absolute; inset: 0; 
      background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2));
      background-size: 100% 4px; 
      pointer-events: none; z-index: 50;
    }
    .crt-vignette {
      position: absolute; inset: 0;
      background: radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.8) 100%);
      pointer-events: none; z-index: 49;
    }
    .animate-in { animation: fadeIn 0.5s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `}</style>
);

const SpookyBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-slate-950 z-0"></div>
    <div className="fog-layer"></div>
    <div className="crt-vignette"></div>
    <div className="crt-scanline"></div>
  </div>
);

/* -----------------------------------------------------------------------
  COMPONENTS
  -----------------------------------------------------------------------
*/
const Timer = ({ duration, onComplete, label = "TIME REMAINING" }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  useEffect(() => setTimeLeft(duration), [duration]);
  useEffect(() => {
    if (timeLeft <= 0) { onComplete && onComplete(); return; }
    const interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  return (
    <div className="flex flex-col items-center relative z-30">
      <div className="text-xs text-red-500 font-mono tracking-widest bg-black px-2 mb-1 border border-red-900/50 rounded">{label}</div>
      <div className={`text-4xl font-mono font-bold px-6 py-2 rounded-lg border-2 bg-black/80 backdrop-blur-md ${timeLeft < 10 ? 'text-red-500 border-red-500 animate-pulse' : 'text-slate-200 border-slate-700'}`}>
        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
};

const AudioRecorder = ({ onSave, label }) => {
  const [recording, setRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async (e) => {
    if (e) e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => { setAudioData(reader.result); onSave(reader.result); };
      };
      mediaRecorderRef.current.start();
      setRecording(true);
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') stopRecording(); }, 10000);
    } catch (err) { console.error("Mic Error:", err); }
  };
  const stopRecording = (e) => { if (e) e.preventDefault(); if (mediaRecorderRef.current?.state === 'recording') { mediaRecorderRef.current.stop(); setRecording(false); } };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-700 w-full shadow-lg">
      <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">{label}</div>
      {!audioData ? (
        <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${recording ? 'bg-red-600 scale-110' : 'bg-slate-600 hover:bg-slate-500'}`}><Mic className="w-8 h-8 text-white" /></button>
      ) : (
        <div className="flex flex-col items-center animate-in">
          <div className="w-20 h-20 rounded-full bg-green-900 border-2 border-green-500 flex items-center justify-center mb-2"><CheckCircle className="w-8 h-8 text-green-400" /></div>
          <button onClick={() => setAudioData(null)} className="text-xs text-slate-400 underline hover:text-white">Record Again</button>
        </div>
      )}
      <div className="text-xs text-slate-500 mt-1 font-mono">{recording ? <span className="text-red-400 animate-pulse">RECORDING... (10s MAX)</span> : "HOLD TO RECORD"}</div>
    </div>
  );
};

const CameraCapture = ({ onSave }) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const resizedBase64 = await resizeImage(file);
      setPreview(resizedBase64);
      onSave(resizedBase64);
    }
  };
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-700 w-full shadow-lg">
      <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">MUGSHOT (REQUIRED)</div>
      {preview ? (
        <div className="relative animate-in"><img src={preview} className="w-32 h-32 object-cover rounded-lg bg-black border-2 border-white shadow-xl" /><button onClick={() => { setPreview(null); onSave(null); }} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1"><XCircle className="w-5 h-5 text-white" /></button></div>
      ) : (
        <button onClick={() => fileInputRef.current.click()} className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors"><Camera className="w-8 h-8 text-white" /></button>
      )}
      <input type="file" accept="image/*" capture="user" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
    </div>
  );
};

const DrawingCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 300, 300);
    ctx.lineWidth = 4; ctx.strokeStyle = 'white'; ctx.lineCap = 'round';
  }, []);
  const draw = (e) => {
    if (!e.touches && e.buttons !== 1) return;
    e.preventDefault(); setHasDrawn(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };
  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  return (
    <div className="flex flex-col gap-4 w-full items-center">
      <canvas ref={canvasRef} width={300} height={300} className="bg-slate-800 rounded-lg touch-none border-4 border-slate-600 shadow-2xl cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onTouchStart={startDraw} onTouchMove={draw} />
      <button onClick={() => onSave(canvasRef.current.toDataURL('image/jpeg', 0.5))} disabled={!hasDrawn} className="w-full bg-white text-black py-4 rounded-lg font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors uppercase tracking-widest">SUBMIT SKETCH</button>
    </div>
  );
};

/* -----------------------------------------------------------------------
  MAIN APP COMPONENT
  -----------------------------------------------------------------------
*/
export default function App() {
  const [user, setUser] = useState(null);
  const [gameId, setGameId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [view, setView] = useState('home'); 
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef(null); 
  const sfxRef = useRef(null);

  useEffect(() => {
    const init = async () => { try { await signInAnonymously(auth); } catch(e) { setError("Auth Error"); } };
    init();
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !gameId) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) setGameState(snap.data());
      else setError("Game ID not found.");
    });
  }, [user, gameId]);

  useEffect(() => {
    if (!user || !gameId || view !== 'player') return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), (snap) => {
      if (snap.exists()) setPlayerState(snap.data());
    });
  }, [user, gameId, view]);

  // Music & SFX
  useEffect(() => {
    if (!audioRef.current || view !== 'host') return;
    const isPlayingMedia = gameState?.status === 'intro';
    // Audio playback in R2 is replaced by text, so we only mute for Intro video
    if (isPlayingMedia) {
        audioRef.current.pause(); 
    } else {
        if (audioRef.current.paused) audioRef.current.play().catch(()=>{});
        const isQuiet = ['brainstorm', 'round1_suspect', 'round1_weapon', 'round2', 'round4_exchange'].includes(gameState?.status);
        audioRef.current.volume = isMuted ? 0 : (isQuiet ? 0.1 : 0.3);
    }
  }, [gameState?.status, isMuted, view]);

  const prevPlayerCount = useRef(0);
  useEffect(() => {
    if (view === 'host' && gameState?.status === 'lobby') {
      const count = gameState.players?.length || 0;
      if (count > prevPlayerCount.current && sfxRef.current && !isMuted) {
        audioRef.current.volume = 0; 
        sfxRef.current.currentTime = 0;
        sfxRef.current.play().then(() => {
          setTimeout(() => { if (audioRef.current && !isMuted) audioRef.current.volume = 0.3; }, 1500);
        }).catch(() => {});
      }
      prevPlayerCount.current = count;
    }
  }, [gameState?.players, view, isMuted]);

  // ACTIONS
  const createGame = async () => {
    if(!user) return;
    const code = Math.random().toString(36).substring(2,6).toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), {
      roomCode: code, hostId: user.uid, status: 'lobby', players: [], messages: [], roundStats: {}, possibleWeapons: [], murderWeapon: '', sketchPrompts: [], createdAt: new Date().toISOString()
    });
    setGameId(code); setView('host');
  };

  const joinGame = async (code, name) => {
    if(!user) return;
    const cleanCode = code.toUpperCase();
    const gameDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode));
    if(!gameDoc.exists()) { setError("Room code not found."); return; }
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${cleanCode}_${user.uid}`), {
      uid: user.uid, name, dossier: {}, roleName: 'TBD', isMurderer: false, hasSubmittedDossier: false,
      score: 0, hand: [], inbox: [], advantageClue: null, guessesLeft: 5, submittedWeapons: [], 
      r1Suspect: null, r1Weapon: null, sketch: null, finalVote: null
    });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode), {
      players: arrayUnion({uid: user.uid, name})
    });
    setGameId(cleanCode); setView('player');
  };

  if(!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono">ESTABLISHING CONNECTION...</div>;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative selection:bg-red-900 selection:text-white">
      <GameStyles />
      {view === 'host' && <><audio ref={audioRef} src="/music.mp3" loop /><audio ref={sfxRef} src="/join.mp3" /></>}
      {view !== 'player' && <SpookyBackground />}
      {view === 'home' && <HomeScreen onCreate={createGame} onJoin={joinGame} error={error} />}
      {view === 'host' && gameState && <HostView gameId={gameId} gameState={gameState} />}
      {view === 'player' && gameState && <PlayerView gameId={gameId} gameState={gameState} playerState={playerState} user={user} />}
    </div>
  );
}

// --- HOME ---
const HomeScreen = ({ onCreate, onJoin, error }) => {
  const [c, setC] = useState(''); const [n, setN] = useState('');
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 relative z-10 text-center">
      <ShieldAlert className="w-24 h-24 text-red-600 mb-6 drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] animate-pulse" />
      <h1 className="text-7xl font-black text-white mb-2 drop-shadow-lg tracking-tighter">MURDER<br/><span className="text-red-600">AT THE CABIN</span></h1>
      <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 w-full max-w-sm backdrop-blur-md shadow-2xl mt-8">
        <input className="w-full bg-black/50 p-4 rounded-lg mb-3 text-center border border-slate-600 font-mono text-2xl uppercase" placeholder="ROOM CODE" value={c} onChange={e=>setC(e.target.value.toUpperCase())} />
        <input className="w-full bg-black/50 p-4 rounded-lg mb-6 text-center border border-slate-600 text-xl font-bold" placeholder="YOUR NAME" value={n} onChange={e=>setN(e.target.value)} />
        <button onClick={()=>onJoin(c,n)} disabled={!c || !n} className="w-full bg-red-600 py-4 rounded-lg font-black text-xl hover:bg-red-700 transition-all disabled:opacity-50">ENTER CABIN</button>
        {error && <p className="text-red-500 text-sm mt-4 font-bold">{error}</p>}
      </div>
      <button onClick={onCreate} className="mt-8 text-slate-500 text-sm hover:text-white underline">Host New Game (TV Mode)</button>
    </div>
  );
};

// --- HOST ---
const HostView = ({ gameId, gameState }) => {
  const [mugshots, setMugshots] = useState({});
  const advance = (s, d={}) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { status: s, roundStartedAt: Date.now(), ...d });

  useEffect(() => {
    const fetchMugshots = async () => {
        const ms = {};
        for(const p of gameState.players) {
            const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
            if(d.exists() && d.data().dossier?.mugshot) ms[p.uid] = d.data().dossier.mugshot;
        }
        setMugshots(ms);
    };
    if (['round1_suspect', 'reveal', 'voting'].includes(gameState.status)) fetchMugshots();
  }, [gameState.status, gameState.players]);

  useEffect(() => {
    const check = async () => {
      if(!gameState.players.length) return;
      const snaps = await Promise.all(gameState.players.map(p => getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`))));
      const data = snaps.map(s => s.data());
      if (gameState.status === 'brainstorm' && data.every(p => p?.hasSubmittedWeapons)) finishBrainstorm();
      if (gameState.status === 'round1_suspect' && data.every(p => p?.r1Suspect)) advance('round1_weapon');
      if (gameState.status === 'round1_weapon' && data.every(p => p?.r1Weapon)) calculateR1Stats();
      if (gameState.status === 'round2' && data.every(p => p?.sketch)) setupLineup();
      if (gameState.status === 'round4_exchange' && data.every(p => p?.finishedExchange)) advance('round4_debate');
      if (gameState.status === 'voting' && data.every(p => p?.finalVote)) checkWinner();
    };
    const i = setInterval(check, 2000);
    return () => clearInterval(i);
  }, [gameState.status, gameState.players]);

  const startGame = () => advance('intro');

  const finishBrainstorm = async () => {
    let weapons = [];
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      if(d.data().submittedWeapons) weapons.push(...d.data().submittedWeapons);
    }
    if(weapons.length < 5) weapons = [...weapons, ...DEFAULT_WEAPONS];
    weapons = [...new Set(weapons)].sort(()=>0.5-Math.random()).slice(0, 15);
    const kIndex = Math.floor(Math.random() * gameState.players.length);
    const kUid = gameState.players[kIndex].uid;
    const weapon = weapons[Math.floor(Math.random() * weapons.length)];
    await Promise.all(gameState.players.map(p => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), { isMurderer: p.uid === kUid })));
    advance('round1_suspect', { possibleWeapons: weapons, murderWeapon: weapon, murdererId: kUid });
  };

  const calculateR1Stats = async () => {
    let perfect=0, kOnly=0, wOnly=0, wrong=0;
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      const g = d.data();
      if(g.r1Suspect === gameState.murdererId && g.r1Weapon === gameState.murderWeapon) perfect++;
      else if(g.r1Suspect === gameState.murdererId) kOnly++;
      else if(g.r1Weapon === gameState.murderWeapon) wOnly++;
      else wrong++;
    }
    advance('debrief1', { r1Stats: { perfect, kOnly, wOnly, wrong }});
  };

  const setupSketchRound = async () => {
    // REPLACED AUDIO WITH TEXT MASHUP
    const innocents = gameState.players.filter(p => p.uid !== gameState.murdererId).sort(()=>0.5-Math.random());
    const prompts = [];
    for(const p of innocents) {
        if(prompts.length >= 2) break;
        const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
        if(d.data().dossier?.descriptionText) prompts.push(d.data().dossier.descriptionText);
    }
    // Fallbacks
    if(prompts.length < 1) prompts.push("A shadowy figure.");
    if(prompts.length < 2) prompts.push("Wearing a mask.");
    
    advance('round2', { sketchPrompts: prompts });
  };

  const setupLineup = async () => {
    // We signal lineup state. Players fetch sketches individually to avoid Host DB crash.
    advance('lineup'); 
  };

  const handleRound2Winner = async () => {
    const votes = {};
    for(const p of gameState.players) {
        const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
        const v = d.data().sketchVote;
        if(v) votes[v] = (votes[v] || 0) + 1;
    }
    // Simple max vote or random if tie/empty
    let winnerId = gameState.players[0].uid;
    let maxVotes = -1;
    Object.entries(votes).forEach(([uid, count]) => { if(count > maxVotes) { maxVotes = count; winnerId = uid; }});
    
    const winner = gameState.players.find(p => p.uid === winnerId);
    
    // Advantage Logic (Works for 2 players now)
    const innocents = gameState.players.filter(p => p.uid !== gameState.murdererId && p.uid !== winnerId);
    let clueText = "Trust your instincts.";
    if (innocents.length > 0) {
        const revealedInnocent = innocents[Math.floor(Math.random() * innocents.length)];
        clueText = `${revealedInnocent.name} is INNOCENT.`;
    } 

    if (winnerId) {
       const winRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${winnerId}`);
       await updateDoc(winRef, { advantageClue: clueText });
    }
    advance('debrief2', { round2WinnerName: winner?.name || "No One" });
  };

  const setupTranscript = async () => {
    // 15s Timer for Role Reveal Sync
    advance('role_reveal_sync');
  };

  const startPuzzle = async () => {
    const kDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${gameState.murdererId}`));
    const text = (kDoc.data().dossier?.neighbor || "THE LAKE HOUSE").toUpperCase();
    const phrase = text.split('').map(c => ({ char: c, revealed: c===' ' || Math.random() < 0.3 })); 
    advance('round3', { puzzle: phrase });
  };

  const setupRumors = async () => {
    let rumors = [];
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      if(d.data().dossier?.rumor) rumors.push({ text: d.data().dossier.rumor, author: p.name });
    }
    if(rumors.length<2) { rumors.push({text:"I saw blood.", author:"Anon"}); rumors.push({text:"He is lying.", author:"Anon"}); }
    await Promise.all(gameState.players.map(async p => {
      const r1 = rumors[Math.floor(Math.random()*rumors.length)];
      const r2 = rumors[Math.floor(Math.random()*rumors.length)];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), { hand: [r1, r2], inbox: [] });
    }));
    advance('round4_exchange');
  };

  const checkWinner = async () => {
    const votes = {}; const wVotes = {};
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      const v = d.data().finalVote; 
      if(v) { votes[v.suspect] = (votes[v.suspect] || 0) + 1; wVotes[v.weapon] = (wVotes[v.weapon] || 0) + 1; }
    }
    const topSuspect = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b, null);
    const topWeapon = Object.keys(wVotes).reduce((a, b) => wVotes[a] > wVotes[b] ? a : b, null);
    const caught = topSuspect === gameState.murdererId && topWeapon === gameState.murderWeapon;
    advance('reveal', { caught });
  };

  const restart = async () => {
    await Promise.all(gameState.players.map(p => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), {
      uid: p.uid, name: p.name, dossier: {}, score: 0, hand: [], inbox: [],
      hasSubmittedDossier: false, submittedWeapons: [], r1Suspect: null, r1Weapon: null, sketch: null, finalVote: null, sketchVote: null
    })));
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'lobby', possibleWeapons: [], murderWeapon: '', roundStats: {}, sketches: [], puzzle: null
    });
  };

  // --- RENDER HOST ---
  if(gameState.status === 'lobby') return <div className="h-full flex flex-col items-center justify-center relative z-20 text-center"><h1 className="text-8xl font-black text-red-600 mb-4 drop-shadow-lg">LOBBY</h1><div className="text-4xl text-white mb-8 font-mono">{gameId}</div><div className="grid grid-cols-4 gap-6 w-full max-w-6xl">{gameState.players.map(p => <div key={p.uid} className="bg-slate-800 p-6 rounded-xl text-3xl font-bold border-2 border-slate-600 text-center">{p.name}</div>)}</div>{gameState.players.length > 0 && <button onClick={startGame} className="mt-12 bg-red-600 px-16 py-6 text-4xl font-black rounded-full shadow-lg">START NIGHT</button>}</div>;

  if(gameState.status === 'intro') return <div className="h-full w-full bg-black relative z-50"><video src="/intro.mp4" autoPlay className="w-full h-full object-contain" onEnded={()=>advance('brainstorm')} /><button onClick={()=>advance('brainstorm')} className="absolute top-4 right-4 bg-slate-800 text-white px-6 py-2 rounded-full font-bold border border-slate-600 z-50">SKIP VIDEO</button></div>;

  if(gameState.status === 'brainstorm') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-8">THE ARMORY</h2><p className="text-2xl text-slate-400 mb-8">Detectives are identifying potential weapons...</p><Timer duration={60} onComplete={finishBrainstorm}/></div>;

  if(gameState.status === 'round1_suspect') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-8 text-red-500 drop-shadow-lg">WHO IS THE KILLER?</h2><div className="grid grid-cols-4 gap-4 w-full max-w-5xl">{gameState.players.map(p => <div key={p.uid} className="flex flex-col items-center"><img src={mugshots[p.uid] || 'placeholder'} className="w-32 h-32 rounded-full object-cover border-4 border-slate-700 mb-2"/><div className="text-xl font-bold">{p.name}</div></div>)}</div></div>;
  if(gameState.status === 'round1_weapon') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-8 text-blue-500 drop-shadow-lg">WHAT DID THEY USE?</h2><div className="flex flex-wrap justify-center gap-4 max-w-6xl">{gameState.possibleWeapons.map(w=><div key={w} className="bg-slate-800 px-6 py-3 rounded-full text-xl border border-slate-600">{w}</div>)}</div></div>;

  if(gameState.status === 'debrief1') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-7xl font-black mb-8">RESULTS</h2><div className="flex gap-8 mb-12"><div className="text-center"><div className="text-8xl font-black text-green-500">{gameState.r1Stats.perfect}</div><div>PERFECT</div></div><div className="text-center"><div className="text-8xl font-black text-yellow-500">{gameState.r1Stats.kOnly + gameState.r1Stats.wOnly}</div><div>PARTIAL</div></div><div className="text-center"><div className="text-8xl font-black text-red-500">{gameState.r1Stats.wrong}</div><div>WRONG</div></div></div><Timer duration={240} onComplete={setupSketchRound}/><button onClick={setupSketchRound} className="mt-8 bg-slate-700 px-8 py-3 rounded font-bold">Skip Debrief</button></div>;

  if(gameState.status === 'round2') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-8">WITNESS STATEMENTS</h2><div className="flex gap-8 mb-12">{gameState.sketchPrompts?.map((t,i)=><div key={i} className="bg-black/50 p-8 rounded-xl border-2 border-red-500 text-3xl font-serif text-white max-w-md">"{t}"</div>)}</div><p className="text-xl text-slate-400 mb-8">Draw a suspect based on these clues.</p><Timer duration={90} onComplete={setupLineup}/></div>;

  if(gameState.status === 'lineup') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-12">SKETCH VOTING</h2><div className="text-3xl text-slate-400 animate-pulse">Vote on your devices...</div><div className="mt-8"><Timer duration={45} onComplete={handleRound2Winner}/></div><button onClick={handleRound2Winner} className="mt-8 bg-slate-800 px-6 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-700">Force End Voting</button></div>;

  if(gameState.status === 'debrief2') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-7xl font-black mb-4">DEBRIEF</h2>{gameState.round2WinnerName && <div className="text-3xl text-green-400 mb-8 font-bold">WINNER: {gameState.round2WinnerName} (Advantage Sent)</div>}<Timer duration={240} onComplete={setupTranscript}/><button onClick={setupTranscript} className="mt-8 bg-slate-700 px-8 py-3 rounded font-bold">Skip</button></div>;

  if(gameState.status === 'role_reveal_sync') return <div className="h-full flex flex-col items-center justify-center relative z-20 bg-black"><h1 className="text-8xl font-black text-white mb-8 animate-pulse">CHECK YOUR PHONE</h1><Timer duration={15} onComplete={startPuzzle}/></div>;

  if(gameState.status === 'round3') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-5xl font-bold mb-12 text-red-500 tracking-widest">DECODE THE TRANSCRIPT</h2><div className="flex flex-wrap gap-2 justify-center max-w-6xl">{gameState.puzzle?.map((l,i)=><div key={i} className={`w-12 h-16 flex items-center justify-center text-4xl border-b-4 ${l.revealed?'text-green-500 border-green-500':'text-transparent border-slate-700'}`}>{l.revealed?l.char:''}</div>)}</div><div className="mt-12"><Timer duration={90} onComplete={setupRumors}/></div><button onClick={setupRumors} className="mt-6 bg-red-600 px-8 py-3 rounded font-bold">Start Rumors</button></div>;

  if(gameState.status === 'round4_exchange') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-6xl font-bold mb-4">RUMOR MILL</h2><p className="text-3xl text-slate-400">Tampering in progress...</p><button onClick={()=>advance('round4_debate')} className="mt-8 bg-slate-700 px-6 py-2 rounded">Force Debate</button></div>;
  if(gameState.status === 'round4_debate') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-7xl font-black mb-8">FINAL ARGUMENTS</h2><div className="text-3xl text-slate-400 mb-8">Check your Inbox</div><Timer duration={60} onComplete={()=>advance('voting')}/><button onClick={()=>advance('voting')} className="mt-12 bg-red-600 px-12 py-4 text-2xl rounded-full font-bold shadow-lg">VOTE NOW</button></div>;

  if(gameState.status === 'voting') return <div className="h-full flex flex-col items-center justify-center relative z-20"><h2 className="text-7xl font-black mb-8 text-red-500">FINAL JUDGMENT</h2><div className="grid grid-cols-4 gap-4 w-full max-w-6xl mb-8">{gameState.players.map(p=><div key={p.uid} className="flex flex-col items-center"><img src={mugshots[p.uid]} className="w-24 h-24 rounded-full object-cover border-2 border-slate-600 mb-2"/><div className="font-bold">{p.name}</div></div>)}</div><p className="text-2xl text-slate-400">Cast your votes.</p></div>;

  if(gameState.status === 'reveal') return (
    <div className="h-full flex flex-col items-center justify-center relative z-20">
      <h1 className={`text-9xl font-black mb-12 drop-shadow-2xl ${gameState.caught ? 'text-green-500' : 'text-red-600'}`}>{gameState.caught ? "JUSTICE SERVED" : "KILLER ESCAPED"}</h1>
      {gameState.players.filter(p=>p.uid===gameState.murdererId).map(k=>(
         <div key={k.uid} className="text-center bg-black/80 p-12 rounded-2xl border-4 border-red-600">
           <img src={mugshots[k.uid]} className="w-64 h-64 rounded-full object-cover border-4 border-white mb-6 mx-auto"/>
           <div className="text-6xl font-black text-white mb-2">{k.name}</div>
           <div className="text-4xl text-red-500 font-bold">Weapon: {gameState.murderWeapon}</div>
         </div>
      ))}
      <button onClick={restart} className="mt-16 bg-slate-800 px-10 py-4 rounded-full text-2xl font-bold hover:bg-slate-700 border border-slate-500">New Mystery</button>
    </div>
  );

  return null;
};

// --- PLAYER VIEW ---
const PlayerView = ({ gameId, gameState, playerState, user }) => {
  const [form, setForm] = useState({});
  const [wInput, setWInput] = useState("");
  const [vote, setVote] = useState({});
  const [showRole, setShowRole] = useState(false);
  const [rumorEdit, setRumorEdit] = useState("");
  const [rumorNote, setRumorNote] = useState("");
  const [cardIdx, setCardIdx] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [mugshots, setMugshots] = useState({});
  const [sketches, setSketches] = useState([]);

  useEffect(() => { setWaiting(false); }, [gameState.status]);
  
  // FETCH MUGSHOTS/SKETCHES WHEN NEEDED
  useEffect(() => {
    const fetchData = async () => {
        if(gameState.status === 'round1_suspect' || gameState.status === 'voting') {
            gameState.players.forEach(async p => {
                const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
                if(d.exists() && d.data().dossier?.mugshot) setMugshots(prev => ({...prev, [p.uid]: d.data().dossier.mugshot}));
            });
        }
        if(gameState.status === 'lineup') {
             const s = [];
             for(const p of gameState.players) {
                 const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
                 if(d.exists() && d.data().sketch) s.push({id:p.uid, url:d.data().sketch});
             }
             setSketches(s);
        }
    };
    fetchData();
  }, [gameState.status]);

  const send = async (d) => { setWaiting(true); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), d); };
  const submitGuess = async (idx, char) => {
    if(!gameState.round3Data) return;
    const target = gameState.round3Data.phrase[idx];
    if(char.toUpperCase() === target) {
        const newRevealed = [...gameState.round3Data.revealed];
        newRevealed[idx] = true;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
            "round3Data.revealed": newRevealed
        });
    }
  };

  if(!playerState) return <div className="h-full flex items-center justify-center text-slate-500 font-bold text-xl animate-pulse">LOADING PROFILE...</div>;
  if(waiting) return <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-pulse"><CheckCircle className="w-16 h-16 text-green-500 mb-4"/><div>Submitted. Waiting for others...</div></div>;

  // LOBBY
  if(gameState.status === 'lobby') {
    if(playerState.hasSubmittedDossier) return <div className="h-full flex items-center justify-center text-slate-500 p-8 text-center animate-in"><CheckCircle className="w-20 h-20 text-green-500 mb-6" /><div className="text-2xl font-bold text-white">Dossier Secured.</div><div className="text-sm mt-2 opacity-50">Wait for other detectives...</div></div>;
    return (
      <div className="p-6 h-full overflow-y-auto pb-32 relative z-30">
        <h2 className="text-2xl font-black mb-6 border-b-2 border-slate-800 pb-4 text-white">INTAKE FORM</h2>
        <div className="space-y-8">
          <div className="bg-slate-800/50 p-4 rounded-lg"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Start a Rumor</label><textarea className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:border-red-500 outline-none" placeholder="I saw someone..." onChange={e=>setForm({...form, rumor: e.target.value})} /></div>
          <div className="bg-slate-800/50 p-4 rounded-lg"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Opinion on neighbor (left)</label><input className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:border-red-500 outline-none" placeholder="Be honest..." onChange={e => {const val = e.target.value.replace(/[^a-zA-Z\s]/g, ''); setForm({...form, neighbor: val});}} value={form.neighbor || ''} /></div>
          <div className="bg-slate-800/50 p-4 rounded-lg"><label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Describe the Murderer (Looks)</label><textarea className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:border-red-500 outline-none" placeholder="They looked like..." onChange={e=>setForm({...form, descriptionText: e.target.value})} /></div>
          <AudioRecorder label="Say: 'You'll Never Take Me!'" onSave={d=>setForm({...form, impAudio: d})} />
          <CameraCapture onSave={d=>setForm({...form, mugshot: d})} />
          <button disabled={!form.mugshot} onClick={()=>send({ dossier: form, hasSubmittedDossier: true })} className="w-full bg-red-600 py-5 rounded-xl font-black text-lg mt-4 shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100">SUBMIT DOSSIER</button>
        </div>
      </div>
    );
  }

  // BRAINSTORM
  if(gameState.status === 'brainstorm') {
    if(playerState.hasSubmittedWeapons) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><CheckCircle className="w-16 h-16 text-blue-500 mb-4" /><div className="text-xl text-white font-bold">Weapons Logged.</div></div>;
    return (
      <div className="p-6 h-full flex flex-col relative z-30">
        <h2 className="text-2xl font-bold mb-2">SUGGEST WEAPONS</h2>
        <div className="flex gap-2 mb-4"><input className="flex-1 bg-slate-800 rounded-lg p-4 text-white border border-slate-700 text-lg" value={wInput} onChange={e=>setWInput(e.target.value)} placeholder="e.g. Frozen Fish" /><button onClick={async ()=>{if(!wInput) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), { submittedWeapons: arrayUnion(wInput) }); setWInput("");}} className="bg-blue-600 px-6 rounded-lg font-bold text-lg active:scale-95 transition-transform">ADD</button></div>
        <div className="flex-1 overflow-y-auto">{playerState.submittedWeapons?.map((w,i)=><div key={i} className="text-slate-500 border-b border-slate-800 py-2">{w}</div>)}</div>
        <button onClick={()=>send({ hasSubmittedWeapons: true })} className="w-full bg-green-600 py-4 rounded-xl mt-4 font-bold shadow-lg text-lg">I'M DONE</button>
      </div>
    );
  }

  // ROUND 1 SUSPECT
  if(gameState.status === 'round1_suspect') {
    if(playerState.r1Suspect) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><Lock className="w-16 h-16 text-slate-600 mb-4"/><div>Suspect Locked.</div></div>;
    return (
      <div className="p-4 grid grid-cols-2 gap-4 h-full overflow-y-auto pb-20 relative z-30">
        <div className="col-span-2 text-center text-slate-400 uppercase text-xs font-bold mb-2">Vote for the Killer</div>
        {gameState.players.map(p => <button key={p.uid} onClick={()=>send({ r1Suspect: p.uid })} className="bg-slate-800 p-4 rounded-xl font-bold border-2 border-slate-700 hover:bg-slate-700 flex flex-col items-center">{mugshots[p.uid] && <img src={mugshots[p.uid]} className="w-20 h-20 rounded-full mb-2 object-cover"/>}{p.name}</button>)}
      </div>
    );
  }
  // ROUND 1 WEAPON
  if(gameState.status === 'round1_weapon') {
    if(playerState.r1Weapon) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><Lock className="w-16 h-16 text-slate-600 mb-4"/><div>Weapon Locked.</div></div>;
    return (
      <div className="p-4 grid grid-cols-2 gap-4 h-full overflow-y-auto pb-20 relative z-30">
        <div className="col-span-2 text-center text-slate-400 uppercase text-xs font-bold mb-2">Vote for the Weapon</div>
        {gameState.possibleWeapons.map(w => <button key={w} onClick={()=>send({ r1Weapon: w })} className="bg-slate-800 p-4 rounded-xl text-sm font-bold border-2 border-slate-700 hover:bg-slate-700">{w}</button>)}
      </div>
    );
  }

  // ROUND 2
  if(gameState.status === 'round2') {
    if(playerState.sketch) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><CheckCircle className="w-16 h-16 text-green-500 mb-4"/><div>Sketch Submitted.</div></div>;
    return (
      <div className="p-4 flex flex-col items-center h-full relative z-30">
        <h2 className="font-bold mb-4 text-xl">SKETCH THE KILLER</h2>
        <div className="bg-slate-800 p-4 rounded mb-4 text-sm w-full">
            <div className="uppercase text-xs text-slate-500 mb-2">Combine these features:</div>
            {gameState.sketchPrompts?.map((t,i) => <div key={i} className="mb-1 text-white border-l-2 border-red-500 pl-2">"{t}"</div>)}
        </div>
        <DrawingCanvas onSave={d=>send({ sketch: d })} />
      </div>
    );
  }

  // LINEUP VOTE
  if(gameState.status === 'lineup') {
      if(playerState.sketchVote) {
         return (
             <div className="h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                 <div>Vote Submitted.</div>
                 {playerState.advantageClue && (
                     <div className="mt-4 bg-green-900 p-4 rounded text-green-200 border border-green-700 animate-in slide-in-from-bottom">
                         <div className="font-bold uppercase text-xs mb-1">Winner Advantage</div>
                         {playerState.advantageClue}
                     </div>
                 )}
             </div>
         );
     }
     
     return (
        <div className="h-screen bg-slate-900 p-4 overflow-y-auto">
           <h2 className="text-white font-bold mb-4 text-center">VOTE FOR BEST SKETCH</h2>
           <div className="grid grid-cols-2 gap-4">
              {sketches.map(s => (
                  <div key={s.id} onClick={() => send({ sketchVote: s.id })} className="bg-white p-1 rounded aspect-square">
                      <img src={s.url} className="w-full h-full object-cover" />
                  </div>
              ))}
           </div>
        </div>
     );
  }
  
  if (gameState.status === 'debrief2') {
      return (
          <div className="h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
             <div>Debrief in Progress on TV...</div>
             {playerState.advantageClue && (
                 <div className="mt-4 bg-green-900 p-4 rounded text-green-200 border border-green-700">
                     <div className="font-bold uppercase text-xs mb-1">Winner Advantage</div>
                     {playerState.advantageClue}
                 </div>
             )}
          </div>
      );
  }

  // ROLE REVEAL
  if(gameState.status === 'role_reveal_sync' || gameState.status === 'round3') {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-900 relative z-30">
           {!showRole ? <button onClick={()=>setShowRole(true)} className="w-64 h-64 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold shadow-2xl border-4 border-slate-700">TAP TO REVEAL</button>
           : <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8"><h1 className={`text-5xl font-black mb-4 ${playerState.isMurderer?'text-red-600':'text-blue-500'}`}>{playerState.isMurderer?"MURDERER":"INNOCENT"}</h1><button onClick={()=>setShowRole(false)} className="mt-12 text-slate-500">Hide</button></div>}
           
           {gameState.status === 'round3' && gameState.round3Data && (
             <div className="mt-8 w-full max-w-sm">
                 <p className="text-center text-slate-500 mb-4">Tap letters to guess (5 guesses left)</p>
                 <div className="flex flex-wrap gap-1 justify-center">
                    {gameState.round3Data.phrase.map((l, i) => (
                        <button key={i} onClick={()=>{
                            const g = prompt("Guess letter:");
                            if(g) submitGuess(i, g);
                        }} disabled={gameState.round3Data.revealed[i]} className={`w-8 h-10 border text-center flex items-center justify-center font-bold ${gameState.round3Data.revealed[i] ? 'border-green-500 text-green-400' : 'border-slate-700 text-transparent'}`}>
                            {gameState.round3Data.revealed[i] ? l : '?'}
                        </button>
                    ))}
                 </div>
             </div>
           )}
        </div>
      );
  }

  // RUMOR MILL
  if(gameState.status === 'round4_exchange') {
      const currentCard = playerState.hand && playerState.hand[cardIdx];
      if(!currentCard) return <div className="h-full flex items-center justify-center text-slate-500">Waiting for cards...</div>;
      return (
        <div className="p-6 h-full flex flex-col relative z-30 overflow-y-auto">
            <h2 className="text-center font-bold text-white mb-4">RUMOR MILL</h2>
            <div className="bg-white text-black p-4 rounded mb-6 font-serif text-lg shadow-lg rotate-1">
                <div className="text-xs uppercase text-slate-500 font-sans mb-1">Incoming Rumor:</div>
                {currentCard.text}
            </div>
            
            {playerState.isMurderer ? (
                <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded">
                    <p className="text-red-500 font-bold text-sm uppercase mb-2 flex gap-2"><AlertTriangle className="w-4 h-4"/> TAMPER REQUIRED</p>
                    <textarea className="w-full h-24 bg-slate-800 text-white p-3 rounded border border-red-500/50 focus:border-red-500 outline-none" value={rumorEdit} onChange={e=>setRumorEdit(e.target.value)} placeholder="Rewrite this rumor..." />
                </div>
            ) : (
                <div className="mb-4">
                     <p className="text-blue-400 font-bold text-xs uppercase mb-2">VERIFY (RETYPE EXACTLY):</p>
                     <textarea className="w-full h-24 bg-slate-800 text-white p-3 rounded border border-blue-500/50 focus:border-blue-500 outline-none" value={rumorNote} onChange={e=>setRumorNote(e.target.value)} placeholder="Type original rumor here..." />
                </div>
            )}

            <select className="w-full bg-slate-800 p-4 rounded mb-4 text-white border border-slate-700 text-lg" onChange={e=>setTargetId(e.target.value)} value={targetId}>
               <option value="">Select Recipient...</option>
               {gameState.players.filter(p=>p.uid!==user.uid).map(p=><option key={p.uid} value={p.uid}>{p.name}</option>)}
            </select>

            <button disabled={!targetId || (playerState.isMurderer ? !rumorEdit : rumorNote.trim().toLowerCase() !== currentCard.text.trim().toLowerCase())} onClick={async ()=>{
                const txt = playerState.isMurderer ? rumorEdit : currentCard.text;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${targetId}`), { inbox: arrayUnion({ text: txt }) });
                setRumorEdit(""); setRumorNote(""); setTargetId("");
                if(cardIdx===0) setCardIdx(1); else send({finishedExchange:true});
            }} className="w-full bg-blue-600 py-4 rounded-xl font-bold disabled:opacity-50 shadow-lg text-lg">SEND</button>
        </div>
      );
  }

  if(gameState.status === 'round4_debate') {
       return (
        <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2">INBOX</h2>
            <div className="space-y-4">
                {playerState.inbox && playerState.inbox.length > 0 ? playerState.inbox.map((msg, i) => (
                    <div key={i} className="bg-slate-800 p-4 rounded border-l-4 border-blue-500">
                        <div className="text-xs text-slate-400 uppercase mb-1">Anonymous Tip</div>
                        <p className="text-white font-serif text-lg">"{msg.text}"</p>
                    </div>
                )) : <div className="text-slate-500 italic">No rumors received.</div>}
            </div>
        </div>
       );
  }

  // FINAL VOTING
  if(gameState.status === 'voting') {
    if(playerState.finalVote) return <div className="h-full flex items-center justify-center text-slate-500">Vote Cast.</div>;
    return (
      <div className="p-4 h-full overflow-y-auto pb-32 relative z-30">
        <h2 className="text-xl font-bold mb-4 text-red-500">FINAL VOTE</h2>
        <p className="text-xs uppercase text-slate-400 mb-2">Select Killer</p>
        <div className="grid grid-cols-2 gap-2 mb-6">{gameState.players.map(p=><button key={p.uid} onClick={()=>setVote({...vote, suspect: p.uid})} className={`p-4 rounded border ${vote.suspect===p.uid?'bg-red-600':'bg-slate-800'} flex flex-col items-center`}>{mugshots[p.uid] && <img src={mugshots[p.uid]} className="w-16 h-16 rounded-full mb-1 object-cover"/>}{p.name}</button>)}</div>
        <p className="text-xs uppercase text-slate-400 mb-2">Select Weapon</p>
        <div className="grid grid-cols-2 gap-2 mb-6">{gameState.possibleWeapons.map(w=><button key={w} onClick={()=>setVote({...vote, weapon: w})} className={`p-3 rounded border text-xs ${vote.weapon===w?'bg-blue-600':'bg-slate-800'}`}>{w}</button>)}</div>
        <button disabled={!vote.suspect || !vote.weapon} onClick={()=>send({ finalVote: vote })} className="w-full bg-white text-black py-5 rounded font-bold disabled:opacity-50 fixed bottom-4 left-4 right-4 max-w-[calc(100%-2rem)] mx-auto">CAST VOTE</button>
      </div>
    );
  }

  return <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">Check TV...</div>;
};