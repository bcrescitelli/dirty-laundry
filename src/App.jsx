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
  getDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { 
  Users, Clock, Fingerprint, Edit3, ShieldAlert, 
  FileText, Send, Lock, Zap, ArrowRight, Eye, Volume2, VolumeX, Mic, Play, Pause, Gavel, ThumbsUp, Mail, CheckCircle, XCircle
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION
  -----------------------------------------------------------------------
*/
// Default backup weapons if players are uncreative
const DEFAULT_WEAPONS = [
  'Rusty Axe', 'Poisoned Gumbo', 'Bear Trap', 'Hunting Rifle', 'Canoe Paddle', 'Fireplace Poker', 'Strangulation'
];

// Firebase Config
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
  STYLES & ANIMATIONS
  -----------------------------------------------------------------------
*/
const GameStyles = () => (
  <style>{`
    @keyframes fog {
      0% { transform: translateX(-5%) translateY(0); opacity: 0.3; }
      50% { opacity: 0.7; }
      100% { transform: translateX(5%) translateY(-2%); opacity: 0.3; }
    }
    .fog-layer {
      position: absolute;
      top: 0; left: -50%; width: 200%; height: 120%;
      background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.4"/%3E%3C/svg%3E');
      background-size: 200px 200px;
      animation: fog 30s ease-in-out infinite alternate;
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: overlay;
    }
    @keyframes flicker {
      0%, 100% { opacity: 1; }
      33% { opacity: 0.8; }
      34% { opacity: 0.9; }
      35% { opacity: 0.1; }
      36% { opacity: 1; }
      70% { opacity: 0.7; }
      71% { opacity: 1; }
    }
    .cabin-flicker {
      animation: flicker 8s infinite;
    }
    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
    .crt-scanline {
      position: absolute;
      top: 0; left: 0; right: 0; height: 4px;
      background: rgba(255, 255, 255, 0.1);
      animation: scanline 6s linear infinite;
      pointer-events: none;
      z-index: 50;
    }
    .crt-overlay {
      background: radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%);
      pointer-events: none;
    }
  `}</style>
);

const SpookyBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Dark Base */}
    <div className="absolute inset-0 bg-slate-950 z-0"></div>
    {/* Fog Layers */}
    <div className="fog-layer" style={{ animationDuration: '45s', opacity: 0.4 }}></div>
    <div className="fog-layer" style={{ animationDuration: '25s', top: '-20%', transform: 'scaleX(-1)', opacity: 0.3 }}></div>
    {/* Flicker Overlay */}
    <div className="absolute inset-0 z-10 bg-black/10 cabin-flicker mix-blend-multiply"></div>
    {/* Vignette & Scanlines */}
    <div className="absolute inset-0 z-20 crt-overlay"></div>
    <div className="crt-scanline"></div>
  </div>
);

/* -----------------------------------------------------------------------
  UTILITY COMPONENTS
  -----------------------------------------------------------------------
*/

const Timer = ({ duration, onComplete, label = "TIME REMAINING" }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  useEffect(() => setTimeLeft(duration), [duration]);
  useEffect(() => {
    if (timeLeft <= 0) { onComplete && onComplete(); return; }
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  return (
    <div className="flex flex-col items-center relative z-30">
      <div className="text-xs text-red-400 font-mono tracking-widest mb-1 bg-black/80 px-2 rounded">{label}</div>
      <div className={`text-3xl font-mono font-bold px-4 py-2 rounded-lg border-2 bg-black/80 backdrop-blur-md ${timeLeft < 10 ? 'text-red-500 border-red-500 animate-pulse' : 'text-slate-200 border-slate-700'}`}>
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
      // Auto-stop after 10 seconds
      setTimeout(() => { 
          if(mediaRecorderRef.current?.state === 'recording') stopRecording(); 
      }, 10000);
    } catch (err) {
      console.error("Mic error", err);
      alert("Microphone access denied. Check browser permissions.");
    }
  };

  const stopRecording = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if(mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        setRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div className="text-sm text-slate-400 uppercase tracking-widest">{label}</div>
      {!audioData ? (
        <button 
          onMouseDown={startRecording} 
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${recording ? 'bg-red-600 scale-110 shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          <Mic className="w-8 h-8 text-white" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-green-400 font-bold">Recorded!</div>
          <button onClick={() => setAudioData(null)} className="text-xs text-slate-500 underline">Retry</button>
        </div>
      )}
      <div className="text-xs text-slate-500">{recording ? "Recording... (Max 10s)" : "Hold to Record"}</div>
    </div>
  );
};

const DrawingCanvas = ({ initialImage, onSave, strokeColor = '#ffffff' }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initialImage) {
      const img = new Image();
      img.src = initialImage;
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = strokeColor;
  }, []); 

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault(); setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (e) => {
    e.preventDefault(); if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y); ctx.stroke();
  };
  const stop = () => setIsDrawing(false);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef} width={300} height={300}
        className="bg-slate-800 rounded-lg border-2 border-slate-600 touch-none cursor-crosshair shadow-lg"
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
      />
      <button onClick={() => onSave(canvasRef.current.toDataURL())} className="bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-slate-200">
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
  
  const audioRef = useRef(null); // Background music
  const effectAudioRef = useRef(null); // Evidence audio
  const sfxRef = useRef(null); // Join Sound

  // Auth & Listeners
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { setError("Auth failed"); }
    };
    initAuth();
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !gameId) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    return onSnapshot(gameRef, (snap) => {
      if (snap.exists()) setGameState(snap.data());
    });
  }, [user, gameId]);

  useEffect(() => {
    if (!user || !gameId || view !== 'player') return;
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    return onSnapshot(playerRef, (snap) => {
      if (snap.exists()) setPlayerState(snap.data());
    });
  }, [user, gameId, view]);

  // HOST MUSIC LOGIC
  useEffect(() => {
    if (!audioRef.current || view !== 'host') return;
    const isDebrief = gameState?.status.includes('debrief') || gameState?.status === 'lobby';
    
    if (isDebrief && !isMuted) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [gameState?.status, isMuted, view]);

  // JOIN SOUND EFFECT & DUCKING
  const prevPlayerCount = useRef(0);
  useEffect(() => {
      if (view === 'host' && gameState?.status === 'lobby') {
          const count = gameState.players?.length || 0;
          if (count > prevPlayerCount.current) {
              // Play join sound
              if (sfxRef.current) {
                  // DUCK MUSIC
                  if (audioRef.current) audioRef.current.volume = 0.1;
                  
                  sfxRef.current.volume = 1.0;
                  sfxRef.current.currentTime = 0;
                  sfxRef.current.play()
                    .then(() => {
                        // RESTORE MUSIC AFTER SFX
                        setTimeout(() => {
                            if (audioRef.current && !isMuted) audioRef.current.volume = 0.3;
                        }, 1000); // 1s duck
                    })
                    .catch(e => console.log("SFX Blocked", e));
              }
          }
          prevPlayerCount.current = count;
      }
  }, [gameState?.players, view, gameState?.status, isMuted]);

  // ACTIONS
  const createGame = async () => {
    if (!user) return;
    const newGameId = Math.random().toString(36).substring(2, 6).toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', newGameId), {
      roomCode: newGameId,
      hostId: user.uid,
      status: 'lobby',
      players: [],
      messages: [],
      roundStats: {},
      possibleWeapons: [], // Populated in brainstorm
      murderWeapon: '',
      createdAt: new Date().toISOString()
    });
    setGameId(newGameId);
    setView('host');
  };

  const joinGame = async (code, name) => {
    if (!user) return;
    const cleanCode = code.toUpperCase();
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) { setError('Room not found'); return; }

    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${cleanCode}_${user.uid}`);
    await setDoc(playerRef, {
      uid: user.uid,
      name: name,
      dossier: {}, 
      roleName: 'TBD',
      isMurderer: false,
      hasSubmittedDossier: false,
      score: 0,
      hand: [], 
      inbox: [], 
      advantageClue: null, 
      guessesLeft: 5,
      submittedWeapons: [] 
    });
    await updateDoc(gameRef, { players: arrayUnion({ uid: user.uid, name: name }) });
    setGameId(cleanCode);
    setView('player');
  };

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white overflow-hidden relative">
      <GameStyles />
      {view === 'host' && (
          <>
            <audio ref={audioRef} src="/music.mp3" loop />
            <audio ref={sfxRef} src="/join.mp3" />
          </>
      )}
      
      {/* Volume Toggle */}
      {view === 'host' && (
        <button onClick={() => setIsMuted(!isMuted)} className="absolute top-4 right-4 z-50 p-2 bg-slate-800 rounded-full border border-slate-600 hover:bg-slate-700 transition-colors">
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
        </button>
      )}

      {view === 'home' && <HomeScreen onCreate={createGame} onJoin={joinGame} error={error} />}
      {view === 'host' && gameState && <HostView gameId={gameId} gameState={gameState} effectAudioRef={effectAudioRef} />}
      {view === 'player' && gameState && <PlayerView gameId={gameId} gameState={gameState} playerState={playerState} user={user} />}
    </div>
  );
}

// --- HOME SCREEN ---
function HomeScreen({ onCreate, onJoin, error }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto w-full text-center relative overflow-hidden">
      <SpookyBackground />
      <div className="mb-8 relative z-10">
        <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
        <h1 className="text-4xl font-serif font-bold mb-2 text-white drop-shadow-md">MURDER AT THE CABIN</h1>
        <p className="text-slate-400">7 Suspects. 1 Killer. 49 Permutations.</p>
      </div>
      <div className="w-full space-y-4 bg-slate-900/80 p-6 rounded-xl border border-slate-800 relative z-10 backdrop-blur-sm">
        <input type="text" placeholder="ROOM CODE" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full bg-slate-950/50 border border-slate-700 rounded p-3 text-center text-xl tracking-widest outline-none focus:border-red-500 transition-colors" />
        <input type="text" placeholder="YOUR NAME" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded p-3 text-center outline-none focus:border-red-500 transition-colors" />
        <button onClick={() => name && code && onJoin(code, name)} className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition-all active:scale-95">ENTER CABIN</button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <button onClick={onCreate} className="text-slate-500 text-sm hover:text-white mt-4 relative z-10">Host New Game (TV Mode)</button>
    </div>
  );
}

// --- HOST VIEW ---
function HostView({ gameId, gameState, effectAudioRef }) {
  // GAME LOOP CONTROLS
  const advance = async (nextStatus, extraData = {}) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: nextStatus,
      roundStartedAt: Date.now(),
      ...extraData
    });
  };

  const startBrainstorm = async () => {
      // Go to weapon brainstorm first
      advance('weapon_brainstorm');
  };

  const finishBrainstorm = async () => {
      // 1. Gather weapons from all players
      let allWeapons = [];
      for (const p of gameState.players) {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
          const snap = await getDoc(ref);
          if (snap.exists() && snap.data().submittedWeapons) {
              allWeapons = [...allWeapons, ...snap.data().submittedWeapons];
          }
      }
      
      // 2. Mix with defaults if needed
      if (allWeapons.length < 5) allWeapons = [...allWeapons, ...DEFAULT_WEAPONS];
      
      // 3. Shuffle and pick top 7
      allWeapons = allWeapons.sort(() => 0.5 - Math.random()).slice(0, 7);
      
      // 4. Update Game State
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
          possibleWeapons: allWeapons
      });
      
      // 5. Start Game properly
      const killerIndex = Math.floor(Math.random() * gameState.players.length);
      const killerUid = gameState.players[killerIndex].uid;
      const weapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
      
      // Assign roles
      const updates = gameState.players.map(p => {
        const isK = p.uid === killerUid;
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
        return updateDoc(ref, { isMurderer: isK });
      });
      await Promise.all(updates);

      advance('intro', { murdererId: killerUid, murderWeapon: weapon });
  };

  const restartGame = async () => {
    const players = gameState.players;
    const killerIndex = Math.floor(Math.random() * players.length);
    const killerUid = players[killerIndex].uid;
    // We will clear weapons and go back to brainstorm
    
    // FULL RESET FOR PLAYERS
    const updates = players.map(p => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
        return updateDoc(ref, { 
            isMurderer: false, 
            round1Guess: null, 
            round4Vote: null, 
            hand: [], 
            inbox: [], 
            advantageClue: null, 
            sketchVote: 0, 
            guessesLeft: 5,
            hasSubmittedRound1: false, 
            sketch: null,              
            tamperedEvidence: false,
            // CRITICAL: Clear dossier so they re-record
            dossier: {},
            hasSubmittedDossier: false,
            submittedWeapons: []
        });
    });
    await Promise.all(updates);

    // Reset Game State to Lobby so intake happens again
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
        status: 'lobby',
        roundStats: {},
        possibleWeapons: [],
        murderWeapon: '',
        sketches: [],
        round3Data: null,
        round2WinnerName: null
    });
  };

  // --- LOGIC: AGGREGATE STATS ---
  const calculateRound1Stats = async () => {
    let perfect = 0, killerOnly = 0, weaponOnly = 0, wrong = 0;
    const players = gameState.players;
    for (const p of players) {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            const guess = data.round1Guess;
            if (guess) {
                const kCorrect = guess.suspectId === gameState.murdererId;
                const wCorrect = guess.weapon === gameState.murderWeapon;
                if (kCorrect && wCorrect) perfect++;
                else if (kCorrect) killerOnly++;
                else if (wCorrect) weaponOnly++;
                else wrong++;
            }
        }
    }
    advance('round1_results', { roundStats: { perfect, killerOnly, weaponOnly, wrong }});
  };

  const setupRound2Audio = async () => {
     // Fetch innocents
     const innocents = gameState.players.filter(p => p.uid !== gameState.murdererId);
     // Shuffle
     const shuffled = innocents.sort(() => 0.5 - Math.random());
     
     // Store the audios to play
     const audiosToPlay = [];
     for (const p of shuffled) {
         if (audiosToPlay.length >= 2) break; // Only need 2
         const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
         const snap = await getDoc(ref);
         if (snap.exists() && snap.data().dossier?.descriptionAudio) {
             audiosToPlay.push(snap.data().dossier.descriptionAudio);
         }
     }
     
     // Play sequentially with pitch shift
     if (audiosToPlay.length > 0 && effectAudioRef.current) {
        const playClip = async (index) => {
            if (index >= audiosToPlay.length) return;
            
            effectAudioRef.current.src = audiosToPlay[index];
            effectAudioRef.current.playbackRate = 0.75; // Faster but still anonymous
            effectAudioRef.current.preservesPitch = false; 
            
            try {
                await effectAudioRef.current.play();
            } catch(e) {
                console.log("Audio play fail", e);
            }
            
            effectAudioRef.current.onended = () => {
                setTimeout(() => playClip(index + 1), 1000); 
            };
        };
        playClip(0);
     }
  };

  const playRevealAudio = async () => {
      // Fetch Killer's "Take Me Away" audio
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${gameState.murdererId}`);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().dossier?.impressionAudio) {
          if (effectAudioRef.current) {
              effectAudioRef.current.src = snap.data().dossier.impressionAudio;
              effectAudioRef.current.playbackRate = 1.0; 
              effectAudioRef.current.play().catch(e => console.log("Reveal Audio Failed", e));
          }
      }
  };

  const setupRound2Lineup = async () => {
      const sketches = [];
      for (const p of gameState.players) {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
          const snap = await getDoc(ref);
          if (snap.exists() && snap.data().sketch) {
              sketches.push({ uid: p.uid, name: p.name, url: snap.data().sketch, votes: 0 });
          }
      }
      advance('round2_lineup', { sketches });
  };

  const handleRound2Winner = async () => {
      const winner = gameState.players[Math.floor(Math.random() * gameState.players.length)];
      // Find an innocent person (NOT killer, NOT winner)
      const innocents = gameState.players.filter(p => p.uid !== gameState.murdererId && p.uid !== winner.uid);
      const revealedInnocent = innocents[Math.floor(Math.random() * innocents.length)];
      if (revealedInnocent) {
          const winRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${winner.uid}`);
          await updateDoc(winRef, { advantageClue: `${revealedInnocent.name} is NOT the killer.` });
      }
      advance('debrief2', { round2WinnerName: winner.name });
  };
  
  const setupRound3Transcript = async () => {
      // 1. Get Killer's answer
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${gameState.murdererId}`);
      const snap = await getDoc(ref);
      let text = "THE MURDERER WAS SEEN NEAR THE LAKE HOUSE"; // Fallback
      if (snap.exists() && snap.data().dossier?.neighborOpinion) {
          text = snap.data().dossier.neighborOpinion.toUpperCase();
      }
      
      // 2. Prepare the puzzle data with 30% revealed initially
      const phraseChars = text.split('');
      const revealed = phraseChars.map(c => {
          if(c === ' ') return true;
          return Math.random() < 0.3; // 30% chance to reveal
      }); 
      
      // 3. Store in DB
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
          round3Data: {
              phrase: phraseChars,
              revealed: revealed
          }
      });
      advance('round3');
  };

  const setupRound4Exchange = async () => {
      // 1. Fetch all rumors
      const rumors = [];
      for (const p of gameState.players) {
         const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
         const snap = await getDoc(ref);
         if (snap.exists() && snap.data()?.dossier?.rumor) {
             rumors.push({ id: Math.random().toString(), originalAuthor: p.name, text: snap.data().dossier.rumor });
         }
      }
      
      // Fallback
      if (rumors.length === 0) {
          rumors.push({ id: "default1", originalAuthor: "Anonymous", text: "I saw someone lurking outside." });
          rumors.push({ id: "default2", originalAuthor: "Anonymous", text: "Someone here is lying." });
      }
      
      // 2. Assign 2 rumors to each player's hand
      const updates = gameState.players.map(async (p) => {
          // If less than 2 rumors, repeat them
          const r1 = rumors[Math.floor(Math.random() * rumors.length)];
          const r2 = rumors[Math.floor(Math.random() * rumors.length)];
          
          const hand = [r1, r2];
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
          await updateDoc(ref, { hand: hand, inbox: [] });
      });
      await Promise.all(updates);
      advance('round4_exchange');
  };

  const startDebate = async () => {
      advance('round4_debate');
  };

  // --- RENDER ---
  
  if (gameState.status === 'lobby') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 space-y-8 relative overflow-hidden">
        <SpookyBackground />
        <h1 className="text-6xl font-serif font-bold text-slate-100 relative z-10 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">THE CABIN</h1>
        <div className="text-2xl text-slate-400 relative z-10">Room Code: <span className="text-red-500 font-mono">{gameId}</span></div>
        <div className="grid grid-cols-4 gap-4 w-full max-w-4xl relative z-10">
          {gameState.players.map(p => (
            <div key={p.uid} className="bg-slate-800/80 p-4 rounded border border-slate-700 flex flex-col items-center backdrop-blur-sm animate-in zoom-in">
              <div className="w-12 h-12 bg-black rounded-full mb-2 flex items-center justify-center text-xl">{p.name[0]}</div>
              <span className="font-bold">{p.name}</span>
            </div>
          ))}
        </div>
        {gameState.players.length > 0 && (
          <button onClick={startBrainstorm} className="bg-red-600 text-white text-2xl font-bold px-12 py-4 rounded-full shadow-lg hover:bg-red-700 relative z-10 hover:scale-105 transition-all">START NIGHT</button>
        )}
      </div>
    );
  }

  if (gameState.status === 'weapon_brainstorm') {
      return (
        <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 relative overflow-hidden">
            <SpookyBackground />
            <h2 className="text-4xl font-bold text-white mb-4 relative z-10">THE ARMORY</h2>
            <p className="text-xl text-slate-400 mb-8 relative z-10">Players are submitting potential murder weapons...</p>
            <div className="relative z-10">
                <Timer duration={30} onComplete={finishBrainstorm} />
            </div>
            <button onClick={finishBrainstorm} className="mt-8 bg-slate-700 px-6 py-2 rounded relative z-10">Skip Timer</button>
        </div>
      );
  }

  // INTRO VIDEO
  if (gameState.status === 'intro') {
      return (
          <div className="flex items-center justify-center h-screen bg-black">
              <video 
                src="/intro.mp4" 
                autoPlay 
                className="w-full h-full object-contain"
                onEnded={() => advance('round1')}
              />
          </div>
      );
  }

  if (gameState.status === 'round1') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 p-8 relative overflow-hidden animate-in fade-in duration-1000">
        <SpookyBackground />
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h2 className="text-3xl font-serif font-bold drop-shadow-md">ROUND 1: EVIDENCE REPORT</h2>
          <Timer duration={90} onComplete={calculateRound1Stats} />
        </div>
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center space-y-4">
            <p className="text-2xl text-slate-300">Detectives are analyzing the 49 Permutations...</p>
            <div className="grid grid-cols-7 gap-2 opacity-50">
              {/* Visual filler for the grid */}
              {Array.from({length:49}).map((_, i) => (
                <div key={i} className="w-8 h-8 bg-slate-800 rounded border border-slate-700 animate-pulse" style={{animationDelay: `${i*0.05}s`}} />
              ))}
            </div>
            <button onClick={calculateRound1Stats} className="bg-slate-700 text-sm px-4 py-2 rounded">Force End Round</button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.status === 'round1_results') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 space-y-8 relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-5xl font-serif font-bold mb-8 relative z-10">CASE UPDATE</h2>
        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl relative z-10">
          <ResultCard label="Perfect Match (Killer & Weapon)" value={gameState.roundStats?.perfect || 0} color="text-green-500" />
          <ResultCard label="Right Killer, Wrong Weapon" value={gameState.roundStats?.killerOnly || 0} color="text-yellow-500" />
          <ResultCard label="Wrong Killer, Right Weapon" value={gameState.roundStats?.weaponOnly || 0} color="text-yellow-500" />
          <ResultCard label="Completely Cold" value={gameState.roundStats?.wrong || 0} color="text-red-500" />
        </div>
        <div className="flex gap-4 mt-8 relative z-10">
          <button onClick={() => advance('debrief1')} className="bg-slate-700 px-8 py-4 rounded text-xl font-bold hover:bg-slate-600">Debrief (4m)</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'debrief1' || gameState.status === 'debrief2') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-6xl font-bold text-white mb-4 relative z-10 drop-shadow-lg">DEBRIEF</h2>
        {gameState.status === 'debrief2' && gameState.round2WinnerName && (
            <div className="mb-4 text-green-400 text-xl font-bold uppercase relative z-10 animate-pulse">
                Sketch Winner: {gameState.round2WinnerName} (Advantage Sent)
            </div>
        )}
        <div className="relative z-10">
            <Timer duration={240} onComplete={() => {
                if (gameState.status === 'debrief1') {
                    advance('round2');
                    setTimeout(setupRound2Audio, 1000); 
                } else {
                    setupRound3Transcript(); 
                }
            }} />
        </div>
        <button onClick={() => {
            if (gameState.status === 'debrief1') {
                advance('round2');
                setTimeout(setupRound2Audio, 1000);
            } else {
                setupRound3Transcript();
            }
        }} className="mt-8 bg-red-900/50 text-red-200 px-6 py-2 rounded hover:bg-red-800/50 relative z-10">SKIP DEBRIEF</button>
      </div>
    );
  }

  if (gameState.status === 'round2') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 p-8 relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-3xl font-serif font-bold mb-8 relative z-10">ROUND 2: EYEWITNESS</h2>
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative z-10">
          <div className="bg-black/80 p-8 rounded-xl border border-slate-700 text-center backdrop-blur-sm">
            <Volume2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-2xl font-bold">AUDIO EVIDENCE PLAYING</h3>
            <p className="text-slate-500">2 Clips. Slowed down.</p>
            {/* Hidden audio element for effects */}
            <audio ref={effectAudioRef} /> 
          </div>
          <Timer duration={120} onComplete={setupRound2Lineup} />
          <button onClick={setupRound2Lineup} className="bg-slate-700 text-sm px-4 py-2 rounded">End Sketching</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'round2_lineup') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 p-8 items-center relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-4xl font-serif font-bold mb-4 relative z-10">POLICE LINEUP</h2>
        <p className="text-slate-400 mb-8 relative z-10">Vote for the most accurate sketch on your devices.</p>
        <div className="grid grid-cols-4 gap-4 w-full relative z-10">
           {gameState.sketches && gameState.sketches.map((s, i) => (
             <div key={i} className="aspect-square bg-white rounded shadow-lg overflow-hidden relative">
                 <img src={s.url} className="w-full h-full object-cover" />
                 {/* HIDDEN NAME UNTIL WINNER */}
             </div>
           ))}
        </div>
        <div className="mt-8 relative z-10">
            <Timer duration={15} onComplete={handleRound2Winner} />
            <button onClick={handleRound2Winner} className="bg-slate-700 mt-4 px-4 py-2 rounded">End Voting</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'round3') {
    const puzzle = gameState.round3Data || { phrase: [], revealed: [] };
    
    return (
      <div className="flex flex-col h-screen bg-slate-900 p-8 items-center justify-center relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-red-500 tracking-widest text-xl mb-4 relative z-10">ROUND 3: THE TRIALS</h2>
        <div className="bg-black/90 border-2 border-red-900 p-12 rounded-xl max-w-5xl w-full text-center flex flex-wrap justify-center gap-2 relative z-10 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
           {puzzle.phrase.map((char, i) => (
               <div key={i} className={`w-12 h-16 text-4xl flex items-center justify-center font-mono ${char === ' ' ? '' : 'border-b-4'} ${puzzle.revealed[i] ? 'text-green-400 border-green-600' : 'text-transparent border-slate-600'}`}>
                   {puzzle.revealed[i] ? char : ''}
               </div>
           ))}
        </div>
        <div className="mt-8 flex gap-4 relative z-10">
           <Timer duration={90} onComplete={setupRound4Exchange} />
           <button onClick={setupRound4Exchange} className="bg-red-600 text-white font-bold px-8 py-4 rounded hover:bg-red-700">START RUMOR MILL</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'round4_exchange') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-4xl font-bold mb-4 relative z-10">ROUND 4: RUMOR EXCHANGE</h2>
        <p className="text-slate-400 text-2xl max-w-2xl text-center relative z-10">Players are sending DM rumors...</p>
        <button onClick={startDebate} className="mt-8 bg-slate-700 px-8 py-3 rounded font-bold relative z-10">Start Final Debate</button>
      </div>
    );
  }

  if (gameState.status === 'round4_debate') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-6xl font-bold mb-4 relative z-10">FINAL DEBATE</h2>
        <p className="text-slate-400 text-2xl mb-8 relative z-10">Review your DMs. Discuss. 1 Minute.</p>
        <div className="relative z-10">
            <Timer duration={60} onComplete={() => advance('voting')} />
            <button onClick={() => advance('voting')} className="mt-8 bg-red-600 px-8 py-3 rounded font-bold">GO TO FINAL VOTE</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'voting') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 animate-in fade-in relative overflow-hidden">
        <SpookyBackground />
        <h2 className="text-5xl font-bold text-white mb-8 relative z-10">FINAL JUDGMENT</h2>
        <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center animate-pulse mb-8 relative z-10">
           <Gavel className="w-12 h-12 text-black" />
        </div>
        <p className="text-slate-400 text-2xl relative z-10">Cast your votes on your devices.</p>
        <button onClick={() => {
            advance('reveal');
            setTimeout(playRevealAudio, 1000);
        }} className="mt-12 bg-white text-black font-bold px-8 py-4 rounded-full relative z-10 hover:scale-105 transition-transform">REVEAL THE TRUTH</button>
      </div>
    );
  }

  if (gameState.status === 'reveal') {
    return (
      <div className="flex flex-col h-screen bg-slate-900 items-center justify-center p-8 animate-in zoom-in duration-700 relative overflow-hidden">
        <SpookyBackground />
        <h1 className="text-7xl font-serif font-bold text-red-600 mb-8 relative z-10 drop-shadow-[0_0_20px_rgba(220,38,38,0.9)]">VERDICT</h1>
        <audio ref={effectAudioRef} />
        <div className="bg-black/90 p-8 rounded-2xl border-4 border-red-600 text-center relative z-10 max-w-2xl w-full">
           <div className="text-slate-500 uppercase tracking-widest mb-2">The Murderer Was</div>
           {/* Find killer */}
           {gameState.players.filter(p => p.uid === gameState.murdererId).map(k => (
             <div key={k.uid} className="text-6xl font-bold text-white mb-4">{k.name}</div>
           ))}
           <div className="text-xl text-red-400">Weapon: {gameState.murderWeapon}</div>
        </div>
        <button onClick={restartGame} className="mt-12 text-slate-300 font-bold bg-slate-800 px-6 py-3 rounded hover:bg-slate-700 relative z-10">Same Players, New Mystery</button>
      </div>
    );
  }

  return <div>Loading...</div>;
}

const ResultCard = ({ label, value, color }) => (
  <div className="bg-slate-800/80 p-6 rounded-lg text-center backdrop-blur-sm">
    <div className={`text-6xl font-bold ${color} mb-2`}>{value}</div>
    <div className="text-slate-400 uppercase text-sm font-bold tracking-wider">{label}</div>
  </div>
);

// --- PLAYER VIEW ---
function PlayerView({ gameId, gameState, playerState, user }) {
  const [formData, setFormData] = useState({ rumor: '' });
  const [hasVotedRound2, setHasVotedRound2] = useState(false);
  const [hasVotedFinal, setHasVotedFinal] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [weaponInput, setWeaponInput] = useState("");
  const [sketchSent, setSketchSent] = useState(false);
  
  // Round 4 State
  const [targetPlayerId, setTargetPlayerId] = useState("");
  const [currentRumorText, setCurrentRumorText] = useState("");
  const [rumorComment, setRumorComment] = useState(""); // Innocents must fill this
  const [activeCardIndex, setActiveCardIndex] = useState(0); // 0 or 1
  const [cardsSent, setCardsSent] = useState([]); // Array of card IDs sent

  useEffect(() => {
      if (playerState.hand && playerState.hand.length > activeCardIndex) {
          setCurrentRumorText(playerState.hand[activeCardIndex].text);
      }
  }, [playerState.hand, activeCardIndex]);

  // Handlers
  const saveDossier = async () => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), {
      dossier: formData,
      hasSubmittedDossier: true
    });
  };

  const submitWeapon = async () => {
      if (!weaponInput) return;
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
      await updateDoc(ref, {
          submittedWeapons: arrayUnion(weaponInput)
      });
      setWeaponInput("");
  };

  const submitCase = async (suspectId, weapon) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), {
      round1Guess: { suspectId, weapon },
      hasSubmittedRound1: true
    });
  };

  const submitVote = async (sketchUid) => {
      setHasVotedRound2(true);
  };

  const submitFinalVote = async (suspectUid) => {
      setHasVotedFinal(true);
  };
  
  const sendRumor = async () => {
      if (!targetPlayerId || !playerState.hand) return;
      
      const currentCard = playerState.hand[activeCardIndex];
      const isTampered = currentRumorText !== currentCard.text;
      
      // MURDERER CONSTRAINT: MUST TAMPER
      if (playerState.isMurderer && !isTampered) {
          alert("As the Murderer, you MUST change the text before sending!");
          return;
      }

      // INNOCENT CONSTRAINT: MUST ADD COMMENT
      if (!playerState.isMurderer && !rumorComment) {
          alert("You must add a comment to this rumor!");
          return;
      }

      const finalMessage = playerState.isMurderer ? currentRumorText : `${currentRumorText} (Note: ${rumorComment})`;

      // Add to Recipient's Inbox
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${targetPlayerId}`);
      await updateDoc(targetRef, {
          inbox: arrayUnion({
              from: user.uid, 
              originalAuthor: currentCard.originalAuthor, 
              text: finalMessage
          })
      });

      setCardsSent([...cardsSent, currentCard.id]);
      setRumorComment("");
      if (activeCardIndex === 0) setActiveCardIndex(1);
      setTargetPlayerId("");
  };

  const submitGuess = async (idx, letter) => {
      if (!gameState.round3Data || playerState.guessesLeft <= 0) return;
      
      const targetChar = gameState.round3Data.phrase[idx];
      const guessChar = letter.toUpperCase();
      
      if (guessChar === targetChar) {
          const newRevealed = [...gameState.round3Data.revealed];
          newRevealed[idx] = true;
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
              "round3Data.revealed": newRevealed
          });
      }
      
      const myRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
      await updateDoc(myRef, { guessesLeft: playerState.guessesLeft - 1 });
  };

  // --- VIEWS ---

  if (gameState.status === 'lobby') {
    if (playerState.hasSubmittedDossier) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Dossier Filed. Waiting...</div>;
    
    return (
      <div className="min-h-screen bg-slate-950 p-6 overflow-y-auto pb-20">
        <h1 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-b border-slate-800 pb-2">Intake Form</h1>
        <div className="space-y-8">
          <div>
            <label className="block text-slate-400 text-sm mb-2">Start a rumor about someone here</label>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white h-24"
              placeholder="I saw..."
              onChange={e => setFormData({...formData, rumor: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-2">What do you think of the person to your left?</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white"
              placeholder="Be honest..."
              onChange={e => setFormData({...formData, neighborOpinion: e.target.value})}
            />
          </div>
          <AudioRecorder label="Describe the Murderer" onSave={data => setFormData({...formData, descriptionAudio: data})} />
          <AudioRecorder label="Your Alibi" onSave={data => setFormData({...formData, alibiAudio: data})} />
          <AudioRecorder label="Say: 'You'll Never Take Me Away!'" onSave={data => setFormData({...formData, impressionAudio: data})} />
          
          <button onClick={saveDossier} className="w-full bg-red-600 text-white font-bold py-4 rounded-lg">SUBMIT DOSSIER</button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'weapon_brainstorm') {
      return (
          <div className="h-screen bg-slate-900 p-6">
              <h2 className="text-white font-bold mb-4">SUGGEST WEAPONS</h2>
              <div className="flex gap-2 mb-4">
                  <input 
                    className="flex-1 bg-slate-800 rounded p-3 text-white" 
                    placeholder="e.g. Frozen Fish" 
                    value={weaponInput}
                    onChange={e => setWeaponInput(e.target.value)}
                  />
                  <button onClick={submitWeapon} className="bg-blue-600 px-4 rounded text-white font-bold">ADD</button>
              </div>
              <div className="text-slate-400 text-sm">Added: {playerState.submittedWeapons?.length || 0}</div>
          </div>
      );
  }

  if (gameState.status === 'round1') {
    if (playerState.hasSubmittedRound1) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Case Submitted.</div>;

    const possibleWeapons = gameState.possibleWeapons || WEAPONS;

    return (
      <div className="h-screen bg-slate-950 p-4 overflow-y-auto">
        <h2 className="text-red-500 font-bold mb-4 sticky top-0 bg-slate-950 py-2">WHO DID IT?</h2>
        <div className="space-y-6">
          {gameState.players.map(suspect => (
            <div key={suspect.uid} className="bg-slate-900 p-4 rounded border border-slate-800">
              <div className="font-bold text-lg text-white mb-2">{suspect.name}</div>
              <div className="grid grid-cols-2 gap-2">
                {possibleWeapons.map(w => (
                  <button 
                    key={w} 
                    onClick={() => submitCase(suspect.uid, w)}
                    className="text-xs bg-slate-800 hover:bg-red-900 border border-slate-700 p-2 rounded text-slate-300"
                  >
                    with {w}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (gameState.status === 'round2') {
    if (sketchSent) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Waiting for others...</div>;

    return (
      <div className="h-screen bg-slate-950 p-4 flex flex-col items-center">
        <h2 className="text-white font-bold mb-4">SKETCH THE KILLER</h2>
        <p className="text-sm text-slate-400 mb-4 text-center">Based on the audio you just heard.</p>
        <DrawingCanvas onSave={async (url) => {
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`), { sketch: url });
           setSketchSent(true);
        }} />
      </div>
    );
  }
  
  if (gameState.status === 'round2_lineup') {
     if (hasVotedRound2) {
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
        <div className="h-screen bg-slate-950 p-4 overflow-y-auto">
           <h2 className="text-white font-bold mb-4 text-center">VOTE FOR BEST SKETCH</h2>
           <div className="grid grid-cols-2 gap-4">
              {gameState.sketches?.map(s => (
                  <div key={s.uid} onClick={() => submitVote(s.uid)} className="bg-white p-1 rounded">
                      <img src={s.url} className="w-full" />
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

  // ROUND 3: DISCRETE REVEAL
  if (gameState.status === 'round3') {
    const isMe = playerState.isMurderer;
    const puzzle = gameState.round3Data;
    
    return (
      <div className="min-h-screen p-4 flex flex-col bg-slate-900">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">YOUR ROLE</h2>
          {!showRole ? (
              <button onClick={() => setShowRole(true)} className="bg-slate-700 px-6 py-3 rounded text-slate-300 w-full font-bold border border-slate-600">
                  TAP TO REVEAL ROLE
              </button>
          ) : (
              <div className="bg-black p-4 rounded border border-slate-700 animate-in fade-in">
                  <p className={`text-lg font-mono font-bold ${isMe ? 'text-red-500' : 'text-blue-400'}`}>
                    {isMe ? "YOU ARE THE MURDERER" : "YOU ARE INNOCENT"}
                  </p>
                  <button onClick={() => setShowRole(false)} className="text-xs text-slate-500 mt-2 underline">Hide</button>
              </div>
          )}
        </div>
        
        {puzzle && (
            <div className="flex-1">
                <h3 className="text-slate-400 text-sm uppercase mb-4 text-center">Guess The Clue ({playerState.guessesLeft} left)</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                    {puzzle.phrase.map((char, i) => {
                        const isRevealed = puzzle.revealed[i];
                        if (char === ' ') return <div key={i} className="w-8"></div>;
                        return (
                            <button 
                                key={i}
                                disabled={isRevealed || playerState.guessesLeft <= 0}
                                onClick={() => {
                                    const letter = prompt("Guess this letter:");
                                    if (letter) submitGuess(i, letter);
                                }}
                                className={`w-8 h-10 border-b-2 flex items-center justify-center font-bold ${isRevealed ? 'text-green-400 border-green-500' : 'text-slate-500 border-slate-600'}`}
                            >
                                {isRevealed ? char : '?'}
                            </button>
                        )
                    })}
                </div>
            </div>
        )}
      </div>
    );
  }

  // ROUND 4: RUMOR EXCHANGE
  if (gameState.status === 'round4_exchange') {
    if (!playerState.hand || playerState.hand.length === 0) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Loading Rumors...</div>;
    
    if (cardsSent.length >= 2) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Rumors Sent. Wait for debate.</div>;

    const currentCard = playerState.hand[activeCardIndex];
    if (!currentCard) return <div>Error loading card</div>;

    return (
      <div className="h-screen bg-slate-900 p-6 flex flex-col justify-center">
        <h2 className="text-xl font-bold text-white mb-4">SEND RUMOR {activeCardIndex + 1}/2</h2>
        <div className="bg-white text-black p-6 rounded font-serif shadow-xl rotate-1 mb-6">
          <div className="text-xs text-slate-500 uppercase mb-2">Original: {currentCard.text}</div>
          {playerState.isMurderer ? (
              <div className="space-y-2">
                  <p className="text-red-600 font-bold text-xs uppercase">YOU MUST EDIT THIS:</p>
                  <textarea 
                    className="w-full border-b border-black outline-none h-32 text-lg bg-red-50 p-2" 
                    value={currentRumorText} 
                    onChange={(e) => setCurrentRumorText(e.target.value)}
                  />
              </div>
          ) : (
              <div className="space-y-2">
                  <p className="font-bold text-lg">{currentCard.text}</p>
                  <div className="border-t border-slate-300 pt-2">
                      <p className="text-xs uppercase text-slate-500">Add Comment (Required):</p>
                      <input 
                        className="w-full bg-slate-100 p-2 rounded" 
                        placeholder="I think..."
                        value={rumorComment}
                        onChange={e => setRumorComment(e.target.value)}
                      />
                  </div>
              </div>
          )}
        </div>
        
        <div className="space-y-4">
            <select 
                className="w-full bg-slate-800 text-white p-3 rounded"
                value={targetPlayerId}
                onChange={(e) => setTargetPlayerId(e.target.value)}
            >
                <option value="">Select Recipient...</option>
                {gameState.players.filter(p => p.uid !== user.uid).map(p => (
                    <option key={p.uid} value={p.uid}>{p.name}</option>
                ))}
            </select>
            <button onClick={sendRumor} disabled={!targetPlayerId} className="w-full bg-blue-600 text-white font-bold py-4 rounded disabled:opacity-50">
               SEND & FORGET
            </button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'round4_debate') {
      return (
        <div className="h-screen bg-slate-900 p-6 flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-2">INBOX</h2>
            <div className="space-y-4 overflow-y-auto">
                {playerState.inbox && playerState.inbox.length > 0 ? (
                    playerState.inbox.map((msg, i) => (
                        <div key={i} className="bg-slate-800 p-4 rounded border-l-4 border-blue-500">
                            <div className="text-xs text-slate-400 uppercase mb-1">From a player...</div>
                            <p className="text-lg text-white">"{msg.text}"</p>
                        </div>
                    ))
                ) : (
                    <div className="text-slate-500 italic">No rumors received.</div>
                )}
            </div>
        </div>
      );
  }

  // FINAL VOTING
  if (gameState.status === 'voting') {
      if (hasVotedFinal) return <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">Judgment Cast.</div>;

      return (
        <div className="h-screen bg-slate-900 p-4">
            <h2 className="text-red-500 font-bold mb-6 text-center text-2xl">WHO IS THE KILLER?</h2>
            <div className="grid grid-cols-2 gap-4">
                {gameState.players.map(p => (
                    <button key={p.uid} onClick={() => submitFinalVote(p.uid)} className="bg-slate-800 p-6 rounded border border-slate-700 hover:bg-red-900 transition-colors">
                        <div className="text-xl font-bold text-white">{p.name}</div>
                    </button>
                ))}
            </div>
        </div>
      );
  }

  // REVEAL
  if (gameState.status === 'reveal') {
      const isMe = playerState.isMurderer;
      return (
        <div className={`h-screen flex flex-col items-center justify-center p-8 text-center ${isMe ? 'bg-red-950' : 'bg-slate-900'}`}>
            <h1 className="text-4xl font-bold text-white mb-4">{isMe ? "YOU GOT CAUGHT" : "GAME OVER"}</h1>
            <p className="text-slate-400">Look at the TV for results.</p>
        </div>
      );
  }

  // DEFAULT / WAITING
  return (
    <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">
      Wait for the host...
    </div>
  );
}