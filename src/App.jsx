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
  CheckCircle, XCircle, Camera, Skull, Ghost
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION
  -----------------------------------------------------------------------
*/
const DEFAULT_WEAPONS = [
  'Rusty Axe', 'Poisoned Gumbo', 'Bear Trap', 'Hunting Rifle', 
  'Canoe Paddle', 'Fireplace Poker', 'Strangulation'
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
  AUDIO & VISUAL UTILITIES
  -----------------------------------------------------------------------
*/

// Advanced Audio Distortion (Ring Modulator + Pitch Shift)
const playDistortedAudio = async (url) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // 1. Pitch Shift (Deep Voice)
    source.playbackRate.value = 0.85; 

    // 2. Ring Modulator (Robotic/Metallic Effect)
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 50; // Frequency of the "robotic" buzz
    
    // Gain nodes to mix Dry (original) and Wet (effect) signals
    const dryGain = audioCtx.createGain();
    const wetGain = audioCtx.createGain();
    const effectGain = audioCtx.createGain();

    dryGain.gain.value = 0.4; // Keep some original clarity
    wetGain.gain.value = 0.6; // Heavy effect

    // Connect Source -> Dry -> Out
    source.connect(dryGain);
    dryGain.connect(audioCtx.destination);

    // Connect Source -> Effect Gain -> Wet -> Out
    source.connect(effectGain);
    
    // Connect Oscillator to modulate the Effect Gain (AM Synthesis)
    oscillator.connect(effectGain.gain);
    
    effectGain.connect(wetGain);
    wetGain.connect(audioCtx.destination);

    oscillator.start();
    source.start();
    
    return new Promise((resolve) => {
      source.onended = () => {
        oscillator.stop();
        audioCtx.close();
        resolve();
      };
    });
  } catch (e) {
    console.error("Audio distortion failed", e);
  }
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
    @keyframes flicker {
      0%, 100% { opacity: 1; }
      33% { opacity: 0.8; }
      34% { opacity: 0.9; }
      35% { opacity: 0.1; }
      36% { opacity: 1; }
      40% { opacity: 0.2; }
      41% { opacity: 1; }
    }
    .cabin-flicker {
      animation: flicker 10s infinite;
    }
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
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
    <div className="absolute inset-0 z-10 bg-black/10 cabin-flicker mix-blend-multiply"></div>
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
  
  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete && onComplete();
      return;
    }
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
        reader.onloadend = () => {
          setAudioData(reader.result);
          onSave(reader.result);
        };
      };
      
      mediaRecorderRef.current.start();
      setRecording(true);
      
      // Auto-stop after 10s
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 10000);
    } catch (err) {
      console.error("Mic Error:", err);
      // Don't alert here to avoid spamming if permission denied globally
    }
  };

  const stopRecording = (e) => {
    if (e) e.preventDefault();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-700 w-full shadow-lg">
      <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">{label}</div>
      {!audioData ? (
        <button 
          onMouseDown={startRecording} 
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${recording ? 'bg-red-600 scale-110 shadow-[0_0_25px_rgba(220,38,38,0.8)]' : 'bg-slate-600 hover:bg-slate-500'}`}
        >
          <Mic className="w-8 h-8 text-white" />
        </button>
      ) : (
        <div className="flex flex-col items-center animate-in">
          <div className="w-20 h-20 rounded-full bg-green-900 border-2 border-green-500 flex items-center justify-center mb-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <button onClick={() => setAudioData(null)} className="text-xs text-slate-400 underline hover:text-white">Record Again</button>
        </div>
      )}
      <div className="text-xs text-slate-500 mt-1 font-mono">
        {recording ? <span className="text-red-400 animate-pulse">RECORDING... (10s MAX)</span> : "HOLD TO RECORD"}
      </div>
    </div>
  );
};

const CameraCapture = ({ onSave }) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        onSave(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-700 w-full shadow-lg">
      <div className="text-xs uppercase text-slate-400 font-bold tracking-wider">MUGSHOT (REQUIRED)</div>
      {preview ? (
        <div className="relative animate-in">
          <img src={preview} className="w-32 h-32 object-cover rounded-lg bg-black border-2 border-white shadow-xl" alt="Mugshot" />
          <button 
            onClick={() => { setPreview(null); onSave(null); }} 
            className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
          >
            <XCircle className="w-5 h-5 text-white" />
          </button>
        </div>
      ) : (
        <button 
          onClick={() => fileInputRef.current.click()} 
          className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center hover:bg-slate-500 transition-colors"
        >
          <Camera className="w-8 h-8 text-white" />
        </button>
      )}
      <input 
        type="file" 
        accept="image/*" 
        capture="user" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />
      {/* Fallback for testing without camera */}
      {!preview && <button onClick={() => { onSave("skipped"); setPreview("/api/placeholder/100/100"); }} className="text-[10px] text-slate-600 underline mt-2">Skip (Testing Only)</button>}
    </div>
  );
};

const DrawingCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e293b'; // Slate-800 background
      ctx.fillRect(0, 0, 300, 300);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'white';
      ctx.lineCap = 'round';
    }
  }, []);

  const draw = (e) => {
    // Only draw if primary mouse button is held or touch is active
    if (!e.touches && e.buttons !== 1) return;
    
    e.preventDefault(); // Prevent scrolling on touch
    setHasDrawn(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  return (
    <div className="flex flex-col gap-4 w-full items-center">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={300} 
        className="bg-slate-800 rounded-lg touch-none border-4 border-slate-600 shadow-2xl cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onTouchStart={startDraw}
        onTouchMove={draw}
      />
      <button 
        onClick={() => onSave(canvasRef.current.toDataURL())} 
        disabled={!hasDrawn} 
        className="w-full bg-white text-black py-4 rounded-lg font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors uppercase tracking-widest"
      >
        SUBMIT SKETCH
      </button>
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

  // Authentication
  useEffect(() => {
    const init = async () => { 
      try { await signInAnonymously(auth); } 
      catch(e) { setError("Authentication Error. Refresh page."); } 
    };
    init();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Global Game Listener
  useEffect(() => {
    if (!user || !gameId) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), (snap) => {
      if (snap.exists()) setGameState(snap.data());
      else setError("Game ID not found.");
    });
    return () => unsub();
  }, [user, gameId]);

  // Private Player Listener
  useEffect(() => {
    if (!user || !gameId || view !== 'player') return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), (snap) => {
      if (snap.exists()) setPlayerState(snap.data());
    });
    return () => unsub();
  }, [user, gameId, view]);

  // Music & SFX Logic
  useEffect(() => {
    if (!audioRef.current || view !== 'host') return;
    
    // Music is louder in Lobby/Debrief, quieter during active gameplay rounds
    const isQuietRound = ['brainstorm', 'round1_suspect', 'round1_weapon', 'round2', 'round4_exchange'].includes(gameState?.status);
    const targetVolume = isMuted ? 0 : (isQuietRound ? 0.1 : 0.3);
    
    audioRef.current.volume = targetVolume;
    audioRef.current.play().catch(() => { /* Auto-play policy handler */ });
  }, [gameState?.status, isMuted, view]);

  const prevPlayerCount = useRef(0);
  useEffect(() => {
    if (view === 'host' && gameState?.status === 'lobby') {
      const count = gameState.players?.length || 0;
      if (count > prevPlayerCount.current && sfxRef.current && !isMuted) {
        // AGGRESSIVE DUCKING: Silence music completely
        audioRef.current.volume = 0; 
        sfxRef.current.currentTime = 0;
        sfxRef.current.play().then(() => {
          // Restore volume after sound effect finishes (approx 1.5s)
          setTimeout(() => { 
            if (audioRef.current && !isMuted) audioRef.current.volume = 0.3; 
          }, 1500);
        }).catch(() => {});
      }
      prevPlayerCount.current = count;
    }
  }, [gameState?.players, view, isMuted]);

  // --- ACTIONS ---

  const createGame = async () => {
    if(!user) return;
    const code = Math.random().toString(36).substring(2,6).toUpperCase();
    const initialGameState = {
      roomCode: code,
      hostId: user.uid,
      status: 'lobby',
      players: [],
      messages: [],
      roundStats: {},
      possibleWeapons: [],
      murderWeapon: '',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', code), initialGameState);
    setGameId(code);
    setView('host');
  };

  const joinGame = async (code, name) => {
    if(!user) return;
    const cleanCode = code.toUpperCase();
    const gameDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode));
    
    if(!gameDoc.exists()) { 
      setError("Room code not found."); 
      return; 
    }
    
    // Create Player Profile
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${cleanCode}_${user.uid}`), {
      uid: user.uid,
      name,
      dossier: {}, 
      roleName: 'TBD',
      isMurderer: false,
      hasSubmittedDossier: false,
      score: 0,
      hand: [], 
      inbox: [], 
      advantageClue: null, 
      guessesLeft: 5,
      submittedWeapons: [],
      r1Suspect: null,
      r1Weapon: null,
      sketch: null,
      finalVote: null
    });

    // Add to Player List
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode), {
      players: arrayUnion({uid: user.uid, name})
    });

    setGameId(cleanCode);
    setView('player');
  };

  if(!user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono">ESTABLISHING CONNECTION...</div>;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative selection:bg-red-900 selection:text-white">
      <GameStyles />
      {view === 'host' && (
        <>
          <audio ref={audioRef} src="/music.mp3" loop />
          <audio ref={sfxRef} src="/join.mp3" />
        </>
      )}
      
      {/* Global Background Effects (Fog, Scanlines) */}
      {view !== 'home' && <SpookyBackground />}
      
      {view === 'home' && <HomeScreen onCreate={createGame} onJoin={joinGame} error={error} />}
      {view === 'host' && gameState && <HostView gameId={gameId} gameState={gameState} />}
      {view === 'player' && gameState && <PlayerView gameId={gameId} gameState={gameState} playerState={playerState} user={user} />}
    </div>
  );
}

// --- HOME SCREEN ---
const HomeScreen = ({ onCreate, onJoin, error }) => {
  const [c, setC] = useState(''); 
  const [n, setN] = useState('');
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 relative z-10 text-center">
      <ShieldAlert className="w-24 h-24 text-red-600 mb-6 drop-shadow-[0_0_25px_rgba(220,38,38,0.8)] animate-pulse" />
      <h1 className="text-7xl font-black text-white mb-2 drop-shadow-lg tracking-tighter">
        MURDER<br/>
        <span className="text-red-600">AT THE CABIN</span>
      </h1>
      <p className="text-slate-400 mb-12 max-w-md mx-auto text-lg font-mono">
        One Killer. Seven Suspects. Infinite Permutations.
      </p>
      
      <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-700 w-full max-w-sm backdrop-blur-md shadow-2xl">
        <input 
          className="w-full bg-black/50 p-4 rounded-lg mb-3 text-center border border-slate-600 font-mono text-2xl tracking-widest uppercase placeholder:text-slate-700 focus:border-red-500 focus:outline-none transition-colors" 
          placeholder="ROOM CODE" 
          value={c} 
          onChange={e=>setC(e.target.value.toUpperCase())} 
        />
        <input 
          className="w-full bg-black/50 p-4 rounded-lg mb-6 text-center border border-slate-600 text-xl font-bold placeholder:text-slate-700 focus:border-red-500 focus:outline-none transition-colors" 
          placeholder="YOUR NAME" 
          value={n} 
          onChange={e=>setN(e.target.value)} 
        />
        <button 
          onClick={()=>onJoin(c,n)} 
          disabled={!c || !n}
          className="w-full bg-red-600 py-4 rounded-lg font-black text-xl tracking-wide hover:bg-red-700 transition-all active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ENTER CABIN
        </button>
        {error && <p className="text-red-500 text-sm mt-4 font-bold uppercase animate-bounce">{error}</p>}
      </div>
      
      <button onClick={onCreate} className="mt-8 text-slate-500 text-sm hover:text-white transition-colors underline decoration-slate-700 underline-offset-4">
        Host New Game (TV Mode)
      </button>
    </div>
  );
};

// --- HOST VIEW ---
const HostView = ({ gameId, gameState }) => {
  const advance = (s, d={}) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), { status: s, roundStartedAt: Date.now(), ...d });

  // AUTO ADVANCE LOGIC (Monitors Players)
  useEffect(() => {
    const checkAdvance = async () => {
      if(!gameState.players.length) return;
      
      const playersSnap = await Promise.all(gameState.players.map(p => getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`))));
      const playersData = playersSnap.map(s => s.data());

      // 1. Brainstorm -> Finish when all submitted
      if (gameState.status === 'brainstorm') {
        if (playersData.every(p => p?.hasSubmittedWeapons)) finishBrainstorm();
      }
      // 2. Round 1 Suspect -> Weapon
      if (gameState.status === 'round1_suspect') {
        if (playersData.every(p => p?.r1Suspect)) advance('round1_weapon');
      }
      // 3. Round 1 Weapon -> Results
      if (gameState.status === 'round1_weapon') {
        if (playersData.every(p => p?.r1Weapon)) calculateR1Stats();
      }
      // 4. Sketches -> Lineup
      if (gameState.status === 'round2') {
        if (playersData.every(p => p?.sketch)) setupLineup();
      }
      // 5. Voting -> Reveal
      if (gameState.status === 'voting') {
        if (playersData.every(p => p?.finalVote)) checkWinner();
      }
    };
    const i = setInterval(checkAdvance, 2000); // Check every 2s
    return () => clearInterval(i);
  }, [gameState.status, gameState.players]);

  // GAME LOGIC
  const startGame = () => advance('intro');
  
  const finishBrainstorm = async () => {
    let weapons = [];
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      if(d.data().weapons) weapons.push(...d.data().weapons);
    }
    // Fill with defaults if not enough
    if(weapons.length < 5) weapons = [...weapons, ...DEFAULT_WEAPONS];
    
    // Pick unique set
    const uniqueWeapons = [...new Set(weapons)];
    const finalWeapons = uniqueWeapons.sort(()=>0.5-Math.random()).slice(0, 8); 
    
    // Assign Roles
    const kIndex = Math.floor(Math.random() * gameState.players.length);
    const kUid = gameState.players[kIndex].uid;
    const weapon = finalWeapons[Math.floor(Math.random() * finalWeapons.length)];
    
    await Promise.all(gameState.players.map(p => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), { isMurderer: p.uid === kUid })));
    
    advance('round1_suspect', { possibleWeapons: finalWeapons, murderWeapon: weapon, murdererId: kUid });
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

  const playEvidenceAudio = async () => {
    // Pick 2 DISTINCT innocents
    const innocents = gameState.players.filter(p => p.uid !== gameState.murdererId);
    const shuffled = innocents.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);

    // Play first
    if(selected[0]) {
      const d1 = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${selected[0].uid}`));
      if(d1.data().dossier?.descAudio) await playDistortedAudio(d1.data().dossier.descAudio);
    }
    // Play second after delay
    if(selected[1]) {
      setTimeout(async () => {
        const d2 = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${selected[1].uid}`));
        if(d2.data().dossier?.descAudio) await playDistortedAudio(d2.data().dossier.descAudio);
      }, 5000); 
    }
  };

  const setupLineup = async () => {
    const sketches = [];
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      if(d.data().sketch) sketches.push({ id: p.uid, url: d.data().sketch });
    }
    advance('lineup', { sketches });
  };

  const setupTranscript = async () => {
    const kDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${gameState.murdererId}`));
    const text = (kDoc.data().dossier?.neighbor || "THE LAKE HOUSE").toUpperCase();
    
    // Initial reveal state: spaces are revealed, plus ~30% of letters
    const phrase = text.split('').map(c => ({ 
      char: c, 
      revealed: c === ' ' || Math.random() < 0.3 
    })); 
    
    advance('round3', { puzzle: phrase });
  };

  const setupRumors = async () => {
    let rumors = [];
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      if(d.data().dossier?.rumor) rumors.push({ text: d.data().dossier.rumor, author: p.name });
    }
    // Fallbacks
    if(rumors.length < 2) {
      rumors.push({text: "I saw someone washing blood off their hands.", author: "Anon"});
      rumors.push({text: "They were arguing loudly before the lights went out.", author: "Anon"});
    }
    
    // Distribute 2 random to each
    await Promise.all(gameState.players.map(async p => {
      const r1 = rumors[Math.floor(Math.random() * rumors.length)];
      const r2 = rumors[Math.floor(Math.random() * rumors.length)];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), { hand: [r1, r2], inbox: [] });
    }));
    advance('round4_exchange');
  };

  const checkWinner = async () => {
    const votes = {}; 
    const wVotes = {};
    
    for(const p of gameState.players) {
      const d = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`));
      const v = d.data().finalVote; 
      if(v) {
        votes[v.suspect] = (votes[v.suspect] || 0) + 1;
        wVotes[v.weapon] = (wVotes[v.weapon] || 0) + 1;
      }
    }
    
    // Determine winners (Simple Majority)
    const topSuspect = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b, null);
    const topWeapon = Object.keys(wVotes).reduce((a, b) => wVotes[a] > wVotes[b] ? a : b, null);
    
    // Win Condition: Must get BOTH correct
    const caught = topSuspect === gameState.murdererId && topWeapon === gameState.murderWeapon;
    advance('reveal', { caught });
  };

  const restart = async () => {
    // HARD RESET of all player operational data, keeping only UID/Name
    await Promise.all(gameState.players.map(p => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`), {
      uid: p.uid, 
      name: p.name, 
      dossier: {}, // Cleared
      score: 0, 
      hand: [], 
      inbox: [],
      hasSubmittedDossier: false,
      submittedWeapons: [],
      r1Suspect: null,
      r1Weapon: null,
      sketch: null,
      finalVote: null
    })));
    
    // Reset Game
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'lobby', 
      possibleWeapons: [], 
      murderWeapon: '', 
      roundStats: {}, 
      sketches: [], 
      puzzle: null
    });
  };

  // --- RENDER HOST VIEWS ---
  if(gameState.status === 'lobby') return (
    <div className="flex flex-col items-center justify-center h-full relative z-10 text-center">
      <h1 className="text-7xl font-black text-red-600 mb-4 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] tracking-tighter">LOBBY</h1>
      <div className="text-3xl text-slate-400 mb-8 font-mono bg-black/60 px-6 py-2 rounded-lg border border-slate-700">Code: <span className="text-white font-bold">{gameId}</span></div>
      <div className="grid grid-cols-4 gap-6 mb-12 w-full max-w-5xl px-8">
        {gameState.players.map(p => (
          <div key={p.uid} className="bg-slate-800/80 p-6 rounded-xl text-2xl font-bold border-2 border-slate-600 flex items-center justify-center shadow-lg animate-in">
            {p.name}
          </div>
        ))}
      </div>
      {gameState.players.length > 0 && (
        <button onClick={startGame} className="bg-red-600 px-16 py-6 text-3xl font-black rounded-full shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:scale-105 transition-transform hover:bg-red-500">
          START NIGHT
        </button>
      )}
    </div>
  );

  if(gameState.status === 'intro') {
    return (
      <div className="h-full w-full bg-black relative z-50">
        <video 
          src="/intro.mp4" 
          autoPlay 
          className="w-full h-full object-contain" 
          onEnded={()=>advance('brainstorm')} 
        />
      </div>
    );
  }

  if(gameState.status === 'brainstorm') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-6xl font-bold mb-8">THE ARMORY</h2><p className="text-2xl text-slate-400 mb-8">Detectives are identifying potential weapons...</p><Timer duration={60} onComplete={finishBrainstorm}/></div>;

  if(gameState.status === 'round1_suspect') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-6xl font-bold mb-8 text-red-500 drop-shadow-lg">WHO IS THE KILLER?</h2><p className="text-3xl text-slate-400">Cast your suspicions...</p></div>;
  if(gameState.status === 'round1_weapon') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-6xl font-bold mb-8 text-blue-500 drop-shadow-lg">WHAT DID THEY USE?</h2><p className="text-3xl text-slate-400">Select the weapon...</p></div>;

  if(gameState.status === 'debrief1') return (
    <div className="h-full flex flex-col items-center justify-center relative z-10">
      <h2 className="text-6xl font-black mb-12 tracking-tight">EVIDENCE REPORT</h2>
      <div className="grid grid-cols-2 gap-8 w-full max-w-5xl mb-12">
        <div className="bg-green-900/40 p-8 rounded-2xl text-center border-2 border-green-600 backdrop-blur-sm"><div className="text-7xl font-black text-green-400 mb-2">{gameState.r1Stats.perfect}</div><div className="text-green-200 font-bold tracking-widest">PERFECT MATCH</div></div>
        <div className="bg-yellow-900/40 p-8 rounded-2xl text-center border-2 border-yellow-600 backdrop-blur-sm"><div className="text-7xl font-black text-yellow-400 mb-2">{gameState.r1Stats.kOnly + gameState.r1Stats.wOnly}</div><div className="text-yellow-200 font-bold tracking-widest">PARTIAL MATCH</div></div>
        <div className="bg-red-900/40 p-8 rounded-2xl text-center border-2 border-red-600 backdrop-blur-sm col-span-2 mx-auto w-1/2"><div className="text-7xl font-black text-red-400 mb-2">{gameState.r1Stats.wrong}</div><div className="text-red-200 font-bold tracking-widest">COLD</div></div>
      </div>
      <div className="flex flex-col items-center gap-6">
        <Timer duration={240} onComplete={() => { advance('round2'); setTimeout(playEvidenceAudio, 1000); }} />
        <button onClick={() => { advance('round2'); setTimeout(playEvidenceAudio, 1000); }} className="bg-slate-800 px-8 py-3 rounded text-lg font-bold hover:bg-slate-700 border border-slate-600">Skip to Round 2</button>
      </div>
    </div>
  );

  if(gameState.status === 'round2') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-6xl font-bold mb-8">EYEWITNESS ACCOUNTS</h2><p className="text-2xl text-slate-400 mb-8">Listening to altered tapes...</p><Timer duration={45} onComplete={setupLineup}/></div>;

  if(gameState.status === 'lineup') return (
    <div className="h-full flex flex-col items-center justify-center relative z-10">
      <h2 className="text-6xl font-bold mb-12">POLICE SKETCHES</h2>
      <div className="flex gap-6 mb-12 flex-wrap justify-center max-w-6xl">
        {gameState.sketches.map((s, i) => <img key={i} src={s.url} className="w-48 h-48 bg-white rounded-lg object-cover border-4 border-white shadow-2xl rotate-1 hover:scale-110 transition-transform" />)}
      </div>
      <Timer duration={45} onComplete={()=>advance('debrief2')}/>
    </div>
  );

  if(gameState.status === 'debrief2') return (
    <div className="h-full flex flex-col items-center justify-center relative z-10">
      <h2 className="text-7xl font-black mb-8">DEBRIEF</h2>
      {gameState.round2WinnerName && <div className="mb-8 text-green-400 text-3xl font-bold uppercase animate-pulse border-b-2 border-green-500 pb-2">Winner: {gameState.round2WinnerName} (Advantage Sent)</div>}
      <Timer duration={240} onComplete={setupTranscript}/>
      <button onClick={setupTranscript} className="mt-8 bg-slate-800 px-8 py-3 rounded text-lg font-bold hover:bg-slate-700 border border-slate-600">Skip to Trials</button>
    </div>
  );

  if(gameState.status === 'round3') return (
    <div className="h-full flex flex-col items-center justify-center relative z-10">
      <h2 className="text-red-500 text-4xl mb-12 font-black tracking-widest uppercase">Intercepted Transcript</h2>
      <div className="flex flex-wrap gap-3 max-w-6xl justify-center font-mono text-5xl mb-12 px-8">
        {gameState.puzzle.map((l, i) => (
          <div key={i} className={`w-14 h-20 flex items-center justify-center ${l.char === ' ' ? '' : 'border-b-4'} ${l.revealed ? 'text-green-400 border-green-500' : 'text-transparent border-slate-700'}`}>
            {l.revealed ? l.char : ''}
          </div>
        ))}
      </div>
      <Timer duration={90} onComplete={setupRumors}/>
      <button onClick={setupRumors} className="mt-8 bg-red-600 text-white font-bold px-10 py-4 rounded-full shadow-lg hover:bg-red-700">START RUMOR MILL</button>
    </div>
  );

  if(gameState.status === 'round4_exchange') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-6xl font-bold mb-8">RUMOR MILL</h2><p className="text-3xl text-slate-400">Circulating Information...</p></div>;
  if(gameState.status === 'round4_debate') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-7xl font-black mb-8">FINAL ARGUMENTS</h2><Timer duration={60} onComplete={()=>advance('voting')}/><button onClick={()=>advance('voting')} className="mt-12 bg-red-600 px-12 py-4 text-2xl rounded-full font-bold shadow-lg">VOTE NOW</button></div>;

  if(gameState.status === 'voting') return <div className="h-full flex flex-col items-center justify-center relative z-10"><h2 className="text-7xl font-black mb-8 text-red-500">FINAL JUDGMENT</h2><p className="text-3xl text-slate-400 mb-12">Select Killer AND Weapon.</p><button onClick={checkWinner} className="bg-white text-black px-12 py-6 text-3xl font-black rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform">REVEAL VERDICT</button></div>;

  if(gameState.status === 'reveal') return (
    <div className="h-full flex flex-col items-center justify-center relative z-10">
      <h1 className={`text-9xl font-black mb-12 drop-shadow-2xl ${gameState.caught ? 'text-green-500' : 'text-red-600'}`}>{gameState.caught ? "JUSTICE SERVED" : "KILLER ESCAPED"}</h1>
      <div className="flex gap-12 justify-center items-center">
        {gameState.players.filter(p => p.uid === gameState.murdererId).map(k => (
           <div key={k.uid} className="text-center bg-slate-900/90 p-8 rounded-2xl border-4 border-red-600 shadow-2xl backdrop-blur-md">
             {/* Note: In real app, store mugshot URL in player doc and display here. For now, name only. */}
             <div className="text-5xl font-black mb-4 text-white">{k.name}</div>
             <div className="text-3xl text-red-400 font-bold">Weapon: {gameState.murderWeapon}</div>
           </div>
        ))}
      </div>
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

  const send = (d) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), d);

  // FIX: Handle Null Player State
  if (!playerState) return <div className="h-full flex items-center justify-center text-slate-500 font-bold text-xl animate-pulse">LOADING PROFILE...</div>;

  // Re-sync rumor text when hand updates
  // Safe Access: check for playerState before accessing properties
  const currentCard = playerState.hand && playerState.hand[cardIdx];
  
  // LOBBY
  if(gameState.status === 'lobby') {
    if(playerState.hasSubmittedDossier) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><CheckCircle className="w-20 h-20 text-green-500 mb-6" /><div className="text-2xl font-bold text-white">Dossier Secured.</div><div className="text-sm mt-2 opacity-50">Wait for other detectives...</div></div>;
    return (
      <div className="p-6 h-full overflow-y-auto pb-32 relative z-10">
        <h2 className="text-2xl font-black mb-6 border-b-2 border-slate-800 pb-4 text-white">INTAKE FORM</h2>
        <div className="space-y-8">
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Start a Rumor</label>
            <textarea className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:border-red-500 outline-none" placeholder="I saw someone..." onChange={e=>setForm({...form, rumor: e.target.value})} />
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Opinion on neighbor (left)</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:border-red-500 outline-none" placeholder="Be honest..." onChange={e=>setForm({...form, neighbor: e.target.value})} />
          </div>
          <AudioRecorder label="Describe the Murderer" onSave={d=>setForm({...form, descAudio: d})} />
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
      <div className="p-6 h-full flex flex-col relative z-10">
        <h2 className="text-2xl font-bold mb-2">SUGGEST WEAPONS</h2>
        <p className="text-sm text-slate-400 mb-6">Enter weird items found in a cabin.</p>
        <div className="flex gap-2 mb-4">
          <input className="flex-1 bg-slate-800 rounded-lg p-4 text-white border border-slate-700 text-lg" value={wInput} onChange={e=>setWInput(e.target.value)} placeholder="e.g. Frozen Fish" />
          <button onClick={async ()=>{
             if(!wInput) return;
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), { submittedWeapons: arrayUnion(wInput) });
             setWInput("");
          }} className="bg-blue-600 px-6 rounded-lg font-bold text-lg active:scale-95 transition-transform">ADD</button>
        </div>
        <div className="flex-1 overflow-y-auto">
           {playerState.submittedWeapons?.map((w,i) => <div key={i} className="text-slate-500 border-b border-slate-800 py-2">{w}</div>)}
        </div>
        <button onClick={()=>send({ hasSubmittedWeapons: true })} className="w-full bg-green-600 py-4 rounded-xl mt-4 font-bold shadow-lg text-lg">I'M DONE</button>
      </div>
    );
  }

  // ROUND 1 SUSPECT
  if(gameState.status === 'round1_suspect') {
    if(playerState.r1Suspect) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><Lock className="w-16 h-16 text-slate-600 mb-4"/><div>Suspect Locked.</div></div>;
    return (
      <div className="p-4 grid grid-cols-2 gap-4 h-full overflow-y-auto pb-20 relative z-10">
        <div className="col-span-2 text-center text-slate-400 uppercase text-xs font-bold mb-2">Vote for the Killer</div>
        {gameState.players.map(p => <button key={p.uid} onClick={()=>send({ r1Suspect: p.uid })} className="bg-slate-800 p-6 rounded-xl font-bold border-2 border-slate-700 hover:bg-slate-700 hover:border-slate-500 text-lg">{p.name}</button>)}
      </div>
    );
  }
  // ROUND 1 WEAPON
  if(gameState.status === 'round1_weapon') {
    if(playerState.r1Weapon) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><Lock className="w-16 h-16 text-slate-600 mb-4"/><div>Weapon Locked.</div></div>;
    return (
      <div className="p-4 grid grid-cols-2 gap-4 h-full overflow-y-auto pb-20 relative z-10">
        <div className="col-span-2 text-center text-slate-400 uppercase text-xs font-bold mb-2">Vote for the Weapon</div>
        {gameState.possibleWeapons.map(w => <button key={w} onClick={()=>send({ r1Weapon: w })} className="bg-slate-800 p-4 rounded-xl text-sm font-bold border-2 border-slate-700 hover:bg-slate-700">{w}</button>)}
      </div>
    );
  }

  // ROUND 2
  if(gameState.status === 'round2') {
    if(playerState.sketch) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><CheckCircle className="w-16 h-16 text-green-500 mb-4"/><div>Sketch Submitted.</div><div className="text-xs mt-2">Waiting for artists...</div></div>;
    return (
      <div className="p-4 flex flex-col items-center h-full relative z-10">
        <h2 className="font-bold mb-4 text-xl">SKETCH THE KILLER</h2>
        <DrawingCanvas onSave={d=>send({ sketch: d })} />
      </div>
    );
  }

  // ROUND 3 REVEAL
  if(gameState.status === 'round3') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-900 relative z-10">
        <h2 className="text-2xl font-bold mb-8">YOUR ROLE</h2>
        {showRole ? (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-8 animate-in zoom-in">
             <div className={`p-8 rounded-full border-4 ${playerState.isMurderer ? 'border-red-600 text-red-500' : 'border-blue-500 text-blue-400'} mb-8 shadow-2xl`}>
               {playerState.isMurderer ? <Skull className="w-32 h-32" /> : <ShieldAlert className="w-32 h-32" />}
             </div>
             <h1 className={`text-5xl font-black mb-4 ${playerState.isMurderer ? 'text-red-600' : 'text-blue-500'}`}>{playerState.isMurderer ? "MURDERER" : "INNOCENT"}</h1>
             <button onClick={()=>setShowRole(false)} className="mt-12 text-slate-500 underline text-sm">Tap to Hide</button>
          </div>
        ) : (
          <button onClick={()=>setShowRole(true)} className="w-64 h-64 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold shadow-2xl border-4 border-slate-700 active:scale-95 transition-transform">TAP TO REVEAL</button>
        )}
      </div>
    );
  }

  // ROUND 4 EXCHANGE
  if(gameState.status === 'round4_exchange') {
    if(!currentCard) return <div className="h-full flex items-center justify-center text-slate-500">Waiting for hand...</div>;
    
    return (
      <div className="p-6 h-full flex flex-col relative z-10">
        <h2 className="text-xl font-bold mb-4 text-center">PASS THE RUMOR</h2>
        <div className="bg-white text-black p-6 rounded-lg mb-6 font-serif shadow-xl rotate-1 text-lg leading-relaxed">
          <div className="text-xs text-slate-500 uppercase mb-2 font-sans font-bold">ORIGINAL MESSAGE:</div>
          {currentCard.text}
        </div>
        
        {playerState.isMurderer ? (
          <div className="mb-4 flex-1">
            <p className="text-red-500 font-bold text-xs uppercase mb-2 flex items-center gap-2"><Edit3 className="w-4 h-4"/> ALTER THE TEXT:</p>
            <textarea className="w-full h-32 bg-slate-800 text-white p-4 rounded-lg border border-red-900/50 focus:border-red-500 outline-none text-lg" value={rumorEdit} onChange={e=>setRumorEdit(e.target.value)} />
          </div>
        ) : (
          <div className="mb-4 flex-1">
            <p className="text-blue-400 font-bold text-xs uppercase mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> VERIFY (RETYPE EXACTLY):</p>
            <textarea className="w-full h-32 bg-slate-800 text-white p-4 rounded-lg border border-blue-900/50 focus:border-blue-500 outline-none text-lg" value={rumorNote} onChange={e=>setRumorNote(e.target.value)} placeholder="Type the rumor above..." />
          </div>
        )}

        <select className="w-full bg-slate-800 p-4 rounded-lg mb-4 text-white border border-slate-700 text-lg" onChange={e=>setTargetId(e.target.value)} value={targetId}>
           <option value="">Select Recipient...</option>
           {gameState.players.filter(p=>p.uid!==user.uid).map(p=><option key={p.uid} value={p.uid}>{p.name}</option>)}
        </select>

        <button disabled={!targetId || (playerState.isMurderer ? !rumorEdit : !rumorNote)} 
          onClick={async ()=>{
             const txt = playerState.isMurderer ? rumorEdit : `${currentCard.text}`;
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${targetId}`), { inbox: arrayUnion({ text: txt }) });
             setRumorEdit(""); setRumorNote(""); setTargetId("");
             if(cardIdx === 0) setCardIdx(1); else send({ finishedExchange: true });
          }} 
          className="w-full bg-blue-600 py-4 rounded-xl font-bold disabled:opacity-50 shadow-lg text-lg">SEND</button>
      </div>
    );
  }

  // FINAL VOTING
  if(gameState.status === 'voting') {
    if(playerState.finalVote) return <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center animate-in"><Gavel className="w-16 h-16 mb-6 text-slate-600" /><div className="text-2xl font-bold text-white">Judgment Cast.</div><div className="mt-2 text-sm">Waiting for verdict...</div></div>;
    return (
      <div className="p-4 h-full overflow-y-auto pb-32 relative z-10">
        <h2 className="text-2xl font-black mb-6 text-red-500 text-center">FINAL JUDGMENT</h2>
        
        <p className="text-sm uppercase text-slate-400 mb-3 font-bold sticky top-0 bg-slate-950 py-2 z-10">Select Killer</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
           {gameState.players.map(p => <button key={p.uid} onClick={()=>setVote({...vote, suspect: p.uid})} className={`p-4 rounded-xl font-bold border-2 transition-all ${vote.suspect===p.uid ? 'bg-red-600 border-red-400 scale-105 shadow-lg' : 'bg-slate-800 border-slate-700'}`}>{p.name}</button>)}
        </div>
        
        <p className="text-sm uppercase text-slate-400 mb-3 font-bold sticky top-0 bg-slate-950 py-2 z-10">Select Weapon</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
           {gameState.possibleWeapons.map(w => <button key={w} onClick={()=>setVote({...vote, weapon: w})} className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${vote.weapon===w ? 'bg-blue-600 border-blue-400 scale-105 shadow-lg' : 'bg-slate-800 border-slate-700'}`}>{w}</button>)}
        </div>
        
        <button disabled={!vote.suspect || !vote.weapon} onClick={()=>send({ finalVote: vote })} className="w-full bg-white text-black py-5 rounded-xl font-black text-xl disabled:opacity-50 shadow-xl fixed bottom-4 left-4 right-4 max-w-[calc(100%-2rem)] mx-auto">CAST VOTE</button>
      </div>
    );
  }

  return <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">Check the TV...</div>;
};