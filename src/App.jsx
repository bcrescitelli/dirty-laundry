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
  Users, Clock, Fingerprint, Edit3, ShieldAlert, 
  FileText, Send, Lock, Zap, ArrowRight, Eye, Volume2, VolumeX
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION & SCENARIOS
  -----------------------------------------------------------------------
*/
const SCENARIOS = [
  {
    id: 'corporate',
    title: 'The Boardroom Betrayal',
    victim: 'The CEO',
    // We use placeholders {{0}}, {{1}} to map to question indices
    introTemplate: "Police found {{0}} near the body. The suspect claimed they were craving {{1}}.",
    questions: [
      { id: 'object', text: 'Name a heavy office object.' },
      { id: 'food', text: 'What fast food are you craving right now?' },
      { id: 'alibi', text: 'Where were you 5 minutes ago?' }
    ]
  },
  {
    id: 'wedding',
    title: 'The Wedding Crasher',
    victim: 'The Best Man',
    introTemplate: "The murder weapon was a {{0}}. Witnesses say the killer smelled like {{1}}.",
    questions: [
      { id: 'object', text: 'Name a sharp object found at a wedding.' },
      { id: 'smell', text: 'What is your favorite weird smell (e.g. gasoline)?' },
      { id: 'alibi', text: 'Who were you dancing with?' }
    ]
  }
];

// Firebase Config (User Provided)
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
const appId = "dirty-laundry-game";

/* -----------------------------------------------------------------------
  UTILITY COMPONENTS
  -----------------------------------------------------------------------
*/

const Timer = ({ duration, onComplete, label = "TIME REMAINING" }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  
  useEffect(() => {
    setTimeLeft(duration); // Reset if duration changes
  }, [duration]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete && onComplete();
      return;
    }
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-xs text-red-400 font-mono tracking-widest mb-1">{label}</div>
      <div className={`text-3xl font-mono font-bold px-4 py-2 rounded-lg border-2 ${timeLeft < 10 ? 'text-red-500 border-red-500 animate-pulse bg-red-950/50' : 'text-slate-200 border-slate-700 bg-black/50'}`}>
        {minutes}:{seconds}
      </div>
    </div>
  );
};

const DrawingCanvas = ({ initialImage, onSave, strokeColor = '#ffffff' }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialImage) {
      const img = new Image();
      img.src = initialImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = strokeColor;
  }, []); // Only run once on mount

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const start = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    onSave(canvasRef.current.toDataURL());
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="bg-slate-800 rounded-lg border-2 border-slate-600 touch-none cursor-crosshair shadow-lg"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      <button 
        onClick={handleSave}
        disabled={!hasDrawn && !initialImage}
        className="bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-slate-200 disabled:opacity-50"
      >
        SUBMIT DRAWING
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

  // Auth & Listeners
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (err) { console.error(err); setError("Auth failed"); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !gameId) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    return onSnapshot(gameRef, (snap) => {
      if (snap.exists()) setGameState(snap.data());
      else setError('Game ended or does not exist.');
    });
  }, [user, gameId]);

  useEffect(() => {
    if (!user || !gameId || view !== 'player') return;
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    return onSnapshot(playerRef, (snap) => {
      if (snap.exists()) setPlayerState(snap.data());
    });
  }, [user, gameId, view]);

  // MUSIC LOGIC
  useEffect(() => {
    if (!audioRef.current) return;

    const shouldPlay = gameState?.status === 'lobby' && !isMuted;
    
    if (shouldPlay) {
      audioRef.current.volume = 0.2; // Low background volume
      // Interaction is usually required, but since user clicks "Host" or "Enter", it should work
      audioRef.current.play().catch(e => console.log("Audio autoplay prevented", e));
    } else {
      audioRef.current.pause();
      if (gameState?.status !== 'lobby') {
         // Reset song if game has started so it starts fresh next time
         audioRef.current.currentTime = 0;
      }
    }
  }, [gameState?.status, isMuted]);


  // --- ACTIONS ---

  const createGame = async () => {
    if (!user) return;
    const newGameId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', newGameId), {
      roomCode: newGameId,
      hostId: user.uid,
      status: 'lobby',
      scenario: scenario,
      players: [],
      messages: [],
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
      drawing: null, // Initial "selfie"
      sketch: null, // Round 2 sketch
      roleName: 'Innocent',
      hasSubmittedDossier: false,
      tamperedEvidence: false,
      evidenceTargetId: null, // Who's evidence am I editing?
      sketchTargetId: null // Who am I drawing?
    });

    await updateDoc(gameRef, {
      players: arrayUnion({ uid: user.uid, name: name })
    });

    setGameId(cleanCode);
    setView('player');
  };

  const toggleMute = () => setIsMuted(!isMuted);

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting to secure server...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white overflow-hidden relative">
      {/* Audio Element (Hidden) */}
      <audio ref={audioRef} src="/music.mp3" loop />
      
      {/* Mute Toggle (Always visible in corners if in game) */}
      {view !== 'home' && (
        <button 
          onClick={toggleMute} 
          className="absolute top-4 right-4 z-50 p-2 bg-slate-800 rounded-full hover:bg-slate-700 border border-slate-600"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
        </button>
      )}

      {view === 'home' && <HomeScreen onCreate={createGame} onJoin={joinGame} error={error} />}
      {view === 'host' && gameState && <HostView gameId={gameId} gameState={gameState} />}
      {view === 'player' && gameState && <PlayerView gameId={gameId} gameState={gameState} playerState={playerState} user={user} />}
    </div>
  );
}

/* -----------------------------------------------------------------------
  HOME SCREEN
  -----------------------------------------------------------------------
*/
function HomeScreen({ onCreate, onJoin, error }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto w-full">
      <div className="mb-8 text-center animate-in zoom-in duration-500">
        <div className="inline-block p-4 rounded-full bg-slate-900 border border-slate-800 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
          <Fingerprint className="w-12 h-12 text-red-600" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-slate-100 mb-2">DIRTY LAUNDRY</h1>
        <p className="text-slate-400">Trust No One. Edit Everything.</p>
      </div>

      <div className="w-full space-y-4">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <input 
            type="text" placeholder="ROOM CODE" value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-center text-2xl tracking-widest uppercase focus:outline-none focus:border-red-500 transition-colors"
          />
          <input 
            type="text" placeholder="YOUR NAME" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-center focus:outline-none focus:border-red-500 transition-colors"
          />
          <button 
            onClick={() => name && code && onJoin(code, name)}
            disabled={!name || !code}
            className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 active:scale-95 transition-all"
          >
            ENTER INVESTIGATION
          </button>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        </div>
        <button onClick={onCreate} className="w-full text-slate-500 text-sm hover:text-white mt-4">Host New Game (TV Mode)</button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
  HOST VIEW (TV)
  -----------------------------------------------------------------------
*/
function HostView({ gameId, gameState }) {
  
  // LOGIC: Start Game & Round Management
  const startGame = async () => {
    const players = gameState.players;
    const murdererIndex = Math.floor(Math.random() * players.length);
    const murdererUid = players[murdererIndex].uid;
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'round1',
      murdererId: murdererUid,
      roundStartedAt: Date.now()
    });

    // SETUP ROUND 1: EVIDENCE DISTRIBUTION
    // Shuffle players to assign who edits whose evidence
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const updates = players.map(async (p, i) => {
      const target = shuffled[i]; // Player P will edit Target's evidence
      const isKiller = p.uid === murdererUid;
      
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
      await updateDoc(playerRef, {
        isMurderer: isKiller,
        roleName: isKiller ? 'Unknowing Suspect' : 'Innocent',
        evidenceTargetId: target.uid, // "Here is the file you must tamper with"
        evidenceTargetName: target.name
      });
    });
    await Promise.all(updates);
  };

  const skipDebrief = async () => {
    // Determine next round based on current round history
    // Since 'debrief' is a single status, we need to track what we are debriefing FROM.
    // Ideally we store 'nextRound' in state, but here we can infer or simpler:
    // Just force the next logical step.
    // For simplicity in this structure: Debrief is manual.
  };

  const advanceRound = async (targetRound) => {
    // SETUP LOGIC FOR SPECIFIC ROUNDS
    if (targetRound === 'round2') {
       // SETUP ROUND 2: SKETCH
       // Logic: P1 draws the TAMPERED EVIDENCE of P2.
       // We already linked P1 -> P2 in Round 1 (evidenceTargetId).
       // So in Round 2, P1 draws based on P2's doc (which P1 just edited? No, that would be boring).
       // Let's Shuffle again for chaos! P3 draws based on P2's now-tampered evidence.
       
       const players = gameState.players;
       const shuffled = [...players].sort(() => Math.random() - 0.5);
       
       const updates = players.map(async (p, i) => {
         const target = shuffled[i];
         const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
         await updateDoc(playerRef, {
           sketchTargetId: target.uid, // "Draw this person based on their file"
           sketchTargetName: target.name
         });
       });
       await Promise.all(updates);
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: targetRound,
      roundStartedAt: Date.now()
    });
  };

  // Debrief Wrapper
  const goToDebrief = async (nextRoundName) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'debrief',
      nextRound: nextRoundName, // Store where we go after debrief
      roundStartedAt: Date.now()
    });
  };

  const handleTimerComplete = () => {
    if (gameState.status === 'round1') goToDebrief('round2');
    else if (gameState.status === 'round2') goToDebrief('round3');
    else if (gameState.status === 'round3') goToDebrief('round4');
    else if (gameState.status === 'debrief') advanceRound(gameState.nextRound);
  };

  // --- RENDERING ---

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-center p-8">
      {/* HUD */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div className="text-left">
          <h2 className="text-2xl font-serif font-bold text-slate-100">{gameState.scenario.title}</h2>
          <div className="text-slate-500 font-mono text-xl">CODE: <span className="text-red-500">{gameId}</span></div>
        </div>
        
        {/* GLOBAL TIMER */}
        {['round1', 'round2', 'round3'].includes(gameState.status) && (
          <Timer duration={150} onComplete={handleTimerComplete} label="ROUND TIMER" />
        )}
        {gameState.status === 'debrief' && (
           <div className="flex items-center gap-4">
             <Timer duration={300} onComplete={handleTimerComplete} label="DEBRIEF" />
             <button onClick={() => advanceRound(gameState.nextRound)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-bold">
               SKIP DEBRIEF
             </button>
           </div>
        )}

        <div className="bg-slate-800 px-4 py-2 rounded-full flex items-center gap-2">
           <Users className="w-4 h-4" />
           <span>{gameState.players.length}</span>
        </div>
      </div>

      {/* LOBBY */}
      {gameState.status === 'lobby' && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-8">
          <h1 className="text-5xl font-serif font-bold">THE PRECINCT</h1>
          <p className="text-xl text-slate-400">Fill out your alibis. Tell the truth... for now.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
            {gameState.players.map(p => (
              <div key={p.uid} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center gap-2">
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${p.hasSubmittedDossier ? 'bg-green-500 border-green-400' : 'bg-slate-900 border-slate-600'}`}>
                    {p.hasSubmittedDossier ? <Fingerprint className="w-6 h-6 text-black"/> : <span className="text-lg">{p.name[0]}</span>}
                 </div>
                 <span className="font-bold">{p.name}</span>
              </div>
            ))}
          </div>
          {gameState.players.length >= 3 && (
            <button onClick={startGame} className="bg-red-600 text-white text-2xl font-bold px-12 py-4 rounded-full hover:bg-red-700 shadow-lg">
              START GAME
            </button>
          )}
        </div>
      )}

      {/* ROUND 1: TAMPER */}
      {gameState.status === 'round1' && (
        <div className="flex-1 flex flex-col justify-center items-center animate-in fade-in">
           <div className="text-red-500 font-mono tracking-widest text-xl mb-2">PHASE 1</div>
           <h1 className="text-6xl font-serif font-bold mb-8">THE EVIDENCE ROOM</h1>
           <p className="text-2xl text-slate-300 max-w-3xl leading-relaxed">
             "The files are a mess. We need you to 'organize' the witness statements. 
             <br/><span className="text-white font-bold">Edit the alibis</span> of your fellow suspects to make them look guilty."
           </p>
           <div className="grid grid-cols-3 gap-8 mt-12 w-full max-w-4xl opacity-50">
              {[1,2,3].map(i => (
                <div key={i} className="bg-slate-800 h-32 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-600 animate-pulse" />
                </div>
              ))}
           </div>
        </div>
      )}

      {/* ROUND 2: SKETCH */}
      {gameState.status === 'round2' && (
        <div className="flex-1 flex flex-col justify-center items-center animate-in fade-in">
           <div className="text-red-500 font-mono tracking-widest text-xl mb-2">PHASE 2</div>
           <h1 className="text-6xl font-serif font-bold mb-8">THE SKETCH ARTIST</h1>
           <p className="text-2xl text-slate-300 max-w-3xl leading-relaxed">
             "We have the (tampered) files. Now we need visuals.
             <br/>You will receive a statement. <span className="text-white font-bold">Draw exactly what it says.</span>"
           </p>
           <div className="mt-12 w-full max-w-2xl bg-slate-800 rounded-full h-4 overflow-hidden">
             <div className="h-full bg-red-600 w-full origin-left animate-[width_150s_linear_forwards]" />
           </div>
        </div>
      )}

      {/* ROUND 3: WIRETAP */}
      {gameState.status === 'round3' && (
        <div className="flex-1 flex flex-col justify-center items-center">
           <div className="text-blue-500 font-mono tracking-widest text-xl mb-2">PHASE 3</div>
           <h1 className="text-6xl font-serif font-bold mb-8">THE WIRETAP</h1>
           <div className="w-full max-w-3xl h-[400px] bg-slate-900 border border-slate-700 rounded-xl overflow-y-auto p-4 space-y-4">
              {gameState.messages && gameState.messages.map((msg, i) => (
                <div key={i} className="bg-slate-800 p-4 rounded-lg border-l-4 border-blue-500 text-left animate-in slide-in-from-bottom-2">
                   <div className="text-xs text-slate-500 uppercase mb-1">Intercepted Signal</div>
                   <div className="text-lg font-mono text-green-400">"{msg.text}"</div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* DEBRIEF SCREENS */}
      {gameState.status === 'debrief' && (
         <div className="flex-1 flex flex-col justify-center items-center animate-in zoom-in duration-500">
            <h1 className="text-6xl font-serif font-bold text-white mb-4">DEBRIEF</h1>
            <p className="text-2xl text-slate-400 max-w-2xl mb-8">
              "Discuss the evidence. Who is acting suspicious? You have 5 minutes."
            </p>
            <div className="flex gap-4">
               <div className="bg-slate-800 p-6 rounded-lg">
                 <div className="text-4xl font-bold text-red-500">?</div>
                 <div className="text-sm text-slate-500">SUSPECTS</div>
               </div>
               <ArrowRight className="w-8 h-8 text-slate-600 self-center" />
               <div className="bg-slate-800 p-6 rounded-lg">
                 <div className="text-4xl font-bold text-white">!</div>
                 <div className="text-sm text-slate-500">THE TRUTH</div>
               </div>
            </div>
         </div>
      )}

      {/* ROUND 4: LINEUP (REVEAL) */}
      {gameState.status === 'round4' && (
        <div className="flex-1 overflow-y-auto pb-20 pt-8">
           <h1 className="text-5xl font-serif font-bold mb-12">THE FINAL LINEUP</h1>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-8">
              {gameState.players.map(p => (
                 <div key={p.uid} className="relative group perspective-1000">
                    <div className="bg-white p-3 rounded shadow-2xl transform transition-transform duration-500 hover:scale-105">
                       {/* The Drawing */}
                       <div className="aspect-square bg-slate-100 mb-2 border border-slate-200 overflow-hidden">
                          {p.sketch ? (
                            <img src={p.sketch} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">No Sketch</div>
                          )}
                       </div>
                       <div className="text-black font-bold text-center text-xl uppercase font-mono">{p.name}</div>
                       
                       {/* Reveal Logic: Host triggers this view */}
                       <div className="mt-2 text-xs text-center border-t border-slate-200 pt-2 text-slate-500">
                          {p.tamperedEvidence ? <span className="text-red-600 font-bold">EVIDENCE TAMPERED</span> : <span>Records Clean</span>}
                       </div>
                    </div>
                 </div>
              ))}
           </div>
           <button onClick={() => advanceRound('reveal')} className="mt-12 bg-red-600 text-white px-12 py-4 rounded-full font-bold text-xl hover:bg-red-700 shadow-lg mb-12">
             REVEAL THE KILLER
           </button>
        </div>
      )}

      {/* FINAL REVEAL */}
      {gameState.status === 'reveal' && (
        <div className="flex-1 flex flex-col justify-center items-center animate-in zoom-in duration-1000">
           <h1 className="text-7xl font-serif font-bold text-red-600 mb-4">GUILTY</h1>
           
           {gameState.players.filter(p => p.uid === gameState.murdererId).map(m => (
             <div key={m.uid} className="bg-slate-800 p-8 rounded-2xl border-2 border-red-600 shadow-[0_0_100px_rgba(220,38,38,0.5)] max-w-2xl w-full">
                <div className="text-6xl font-bold mb-4">{m.name}</div>
                <div className="text-2xl text-slate-400 mb-8 font-mono">UNKNOWING SUSPECT</div>
                <div className="bg-black/50 p-6 rounded text-left space-y-4 font-mono text-sm">
                   <div className="text-green-400"> {'>'} ANALYSIS COMPLETE</div>
                   <div> {'>'} VICTIM: {gameState.scenario.victim}</div>
                   <div> {'>'} MOTIVE: Craving {m.dossier?.food || 'Unknown Food'}</div>
                   <div> {'>'} ALIBI PROVEN FALSE: "{m.dossier?.alibi}"</div>
                </div>
             </div>
           ))}
           <button onClick={() => window.location.reload()} className="mt-8 text-slate-500 underline">New Game</button>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
  PLAYER VIEW (PHONE)
  -----------------------------------------------------------------------
*/
function PlayerView({ gameId, gameState, playerState, user }) {
  const [formData, setFormData] = useState({});
  const [myDrawing, setMyDrawing] = useState(null);
  
  // Data for rounds
  const [targetEvidence, setTargetEvidence] = useState(null);
  const [targetSketchPrompt, setTargetSketchPrompt] = useState(null);
  
  const [editedText, setEditedText] = useState('');
  const [message, setMessage] = useState('');
  const [hasActioned, setHasActioned] = useState(false);

  // FETCHING TARGET DATA
  // We use this effect to grab the data of the person we are supposed to edit/draw
  useEffect(() => {
    const fetchTargetData = async () => {
      // ROUND 1: Fetch Evidence Target
      if (gameState.status === 'round1' && playerState.evidenceTargetId) {
        const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${playerState.evidenceTargetId}`);
        const snap = await getDoc(targetRef);
        if (snap.exists()) {
           // Construct the sentence
           const d = snap.data().dossier;
           const tpl = gameState.scenario.introTemplate;
           // Replace {{0}} with Q1 answer, {{1}} with Q2 answer
           let text = tpl.replace('{{0}}', d.object || '???').replace('{{1}}', d.food || '???');
           text += ` They claimed they were ${d.alibi || 'somewhere'}.`;
           setTargetEvidence(text);
           setEditedText(text); // Default to original
        }
      }

      // ROUND 2: Fetch Sketch Target (The Tampered Text)
      if (gameState.status === 'round2' && playerState.sketchTargetId) {
        const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${playerState.sketchTargetId}`);
        const snap = await getDoc(targetRef);
        if (snap.exists()) {
           // We need the TAMPERED text from this player
           // Wait, the logic is: P1 edits P2. P3 draws P2 based on P1's edit.
           // So if I am P3, I need P2's 'tamperedDossierText'.
           // Let's assume P2 stored the result of P1's tampering on themselves.
           setTargetSketchPrompt(snap.data().finalEvidenceText || "Error retrieving file.");
        }
      }
    };
    fetchTargetData();
    setHasActioned(false); // Reset action state on round change
  }, [gameState.status, playerState.evidenceTargetId, playerState.sketchTargetId]);


  // HANDLERS
  const submitDossier = async () => {
    if (!myDrawing) return;
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    await updateDoc(playerRef, {
      dossier: formData,
      drawing: myDrawing, // Selfie
      hasSubmittedDossier: true
    });
  };

  const submitTamper = async () => {
    // Save the edited text onto the TARGET'S doc, so the next person can see it
    const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${playerState.evidenceTargetId}`);
    
    // Check if text changed
    const isTampered = editedText !== targetEvidence;
    
    await updateDoc(targetRef, {
      finalEvidenceText: editedText,
    });
    
    // Mark myself as having acted
    const myRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    await updateDoc(myRef, {
      tamperedEvidence: isTampered,
      hasSubmittedRound1: true
    });
    setHasActioned(true);
  };

  const submitSketch = async (dataUrl) => {
    // Save sketch to MY profile (I am the artist)
    // But we need to know who it depicts. Host handles mapping.
    const myRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    await updateDoc(myRef, {
      sketch: dataUrl,
      hasSubmittedRound2: true
    });
    setHasActioned(true);
  };

  const sendMessage = async () => {
    if (!message) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    await updateDoc(gameRef, {
      messages: arrayUnion({ senderId: user.uid, text: message, timestamp: Date.now() })
    });
    setMessage('');
  };

  // --- VIEWS ---

  if (gameState.status === 'lobby') {
    if (playerState.hasSubmittedDossier) {
      return (
        <div className="h-screen bg-slate-900 flex items-center justify-center text-slate-500">
           Waiting for squad...
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 p-6 overflow-y-auto pb-20">
         <h1 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Intake Form</h1>
         <div className="space-y-6">
            {gameState.scenario.questions.map(q => (
              <div key={q.id}>
                <label className="block text-slate-400 text-sm mb-2">{q.text}</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  onChange={(e) => setFormData({...formData, [q.id]: e.target.value})}
                />
              </div>
            ))}
            <div>
               <label className="block text-slate-400 text-sm mb-2">Draw your ID Photo</label>
               <DrawingCanvas onSave={setMyDrawing} />
            </div>
            <button onClick={submitDossier} className="w-full bg-red-600 text-white font-bold py-4 rounded-lg mt-8">
              FILE RECORD
            </button>
         </div>
      </div>
    );
  }

  if (gameState.status === 'round1') {
    if (hasActioned) return <div className="h-screen flex items-center justify-center text-slate-500">Evidence Updated.</div>;
    
    return (
      <div className="h-screen bg-slate-950 p-6 flex flex-col">
         <h2 className="text-red-500 font-bold mb-4">EDIT THE RECORD</h2>
         <p className="text-sm text-slate-400 mb-4">
           You are editing the file of: <span className="text-white font-bold">{playerState.evidenceTargetName}</span>.
           <br/>Make them sound guilty.
         </p>
         
         <div className="flex-1 bg-white text-black p-4 rounded font-serif text-lg overflow-hidden relative">
            {targetEvidence ? (
              <textarea 
                className="w-full h-full resize-none outline-none bg-transparent"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
            ) : (
              <div className="animate-pulse">Retrieving file...</div>
            )}
         </div>
         <button onClick={submitTamper} className="mt-4 bg-red-600 text-white font-bold py-4 rounded-lg">
           SUBMIT RECORD
         </button>
      </div>
    );
  }

  if (gameState.status === 'round2') {
    if (hasActioned) return <div className="h-screen flex items-center justify-center text-slate-500">Sketch Submitted.</div>;

    return (
      <div className="min-h-screen bg-slate-950 p-4 flex flex-col">
         <h2 className="text-red-500 font-bold mb-2">POLICE SKETCH</h2>
         <div className="bg-slate-800 p-4 rounded mb-4 text-sm text-slate-300 italic border-l-4 border-slate-600">
           "{targetSketchPrompt || "Loading witness statement..."}"
         </div>
         <div className="flex-1">
            <DrawingCanvas onSave={submitSketch} strokeColor="#ef4444" />
         </div>
      </div>
    );
  }

  if (gameState.status === 'round3') {
    return (
      <div className="h-screen bg-slate-950 p-6 flex flex-col justify-center">
         <div className="text-center mb-6">
           <Lock className="w-12 h-12 text-blue-500 mx-auto mb-2" />
           <h2 className="text-xl font-bold">Encrypted Channel</h2>
         </div>
         <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white h-32 mb-4 font-mono"
            placeholder="Discuss who is in the drawings..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
         />
         <button onClick={sendMessage} className="bg-blue-600 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2">
           <Send className="w-5 h-5" /> SEND
         </button>
      </div>
    );
  }

  if (gameState.status === 'debrief') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-center p-8">
        <Zap className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-white">DEBRIEF</h2>
        <p className="text-slate-400 mt-2">Look at the TV. Discuss.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-black text-white p-8 text-center">
      <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-6" />
      <h2 className="text-2xl font-bold">EYES UP</h2>
      <p className="text-slate-400">Watch the main screen.</p>
    </div>
  );
}