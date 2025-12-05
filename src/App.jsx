import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  increment,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { 
  Users, Tv, Smartphone, Skull, Eye, EyeOff, MessageSquare, 
  Clock, AlertTriangle, Fingerprint, Edit3, ShieldAlert, 
  FileText, Send, Lock
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION & SCENARIOS
  -----------------------------------------------------------------------
*/
const SCENARIOS = [
  {
    id: 'manor',
    title: 'Murder at Blackwood Manor',
    intro: 'The Gala was going perfectly until the lights went out.',
    victim: 'The Baron',
    questions: [
      { id: 'item', text: 'What is one object you always carry with you?' },
      { id: 'location', text: 'Where do you go to be alone?' },
      { id: 'habit', text: 'What is your worst habit?' }
    ]
  },
  {
    id: 'tech',
    title: 'The Silicon Valley Crash',
    intro: 'The IPO launch party ended in tragedy.',
    victim: 'The CEO',
    questions: [
      { id: 'item', text: 'What is your favorite gadget?' },
      { id: 'location', text: 'Which office room do you hate the most?' },
      { id: 'habit', text: 'What do you do when you are stressed?' }
    ]
  }
];

// Firebase Setup
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

const Timer = ({ duration, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete && onComplete();
      return;
    }
    const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  return (
    <div className="flex items-center gap-2 text-2xl font-mono font-bold text-red-500 bg-black/50 px-4 py-2 rounded-lg border border-red-900">
      <Clock className="w-6 h-6 animate-pulse" />
      <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
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
    
    // Set white background initially if no image
    if (!initialImage) {
      ctx.fillStyle = '#1e293b'; // Slate-800
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const img = new Image();
      img.src = initialImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    }

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = strokeColor;
  }, [initialImage, strokeColor]);

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
    e.preventDefault(); // Prevent scrolling
    setIsDrawing(true);
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
    if (isDrawing) {
        setIsDrawing(false);
        onSave(canvasRef.current.toDataURL());
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="bg-slate-800 rounded-lg border border-slate-600 touch-none mx-auto cursor-crosshair shadow-lg"
      onMouseDown={start}
      onMouseMove={draw}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchMove={draw}
      onTouchEnd={stop}
    />
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

  // Game Logic
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
      evidenceList: [],
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
    
    // Initialize Player State (Empty Dossier)
    await setDoc(playerRef, {
      uid: user.uid,
      name: name,
      dossier: {}, // Answers go here
      drawing: null, // Initial selfie
      sketch: null, // Round 2 sketch
      isMurderer: false,
      roleName: 'Innocent',
      hasSubmittedDossier: false,
      myEvidence: null, // Assigned evidence to tamper
      tamperedEvidence: false
    });

    await updateDoc(gameRef, {
      players: arrayUnion({ uid: user.uid, name: name })
    });

    setGameId(cleanCode);
    setView('player');
  };

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Connecting to secure server...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white overflow-hidden">
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
  HOST VIEW
  -----------------------------------------------------------------------
*/
function HostView({ gameId, gameState }) {
  
  // LOGIC: Start Game & Round Management
  const startGame = async () => {
    // 1. Pick 1 Murderer
    const players = gameState.players;
    const murdererIndex = Math.floor(Math.random() * players.length);
    const murdererUid = players[murdererIndex].uid;

    // 2. Fetch all player dossiers (we need these to generate evidence)
    // NOTE: In a real app we'd fetch these. For this single-file demo, 
    // we assume we can generate evidence later or players have submitted.
    // We will advance to Round 1.
    
    // 3. Generate Evidence Pool
    // For simplicity, we create placeholders. The Player View will handle content generation based on local data if needed,
    // but ideally we query the 'players' collection here. 
    // We will just set the status and let the players "receive" their packets.
    
    // We assign the murdererId publicly in the game doc (it's safe-ish here, players don't query game doc directly for secrets usually)
    // But to be safer, we store it and only revealing logic uses it.
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'round1',
      murdererId: murdererUid,
      roundStartedAt: Date.now()
    });

    // Assign roles/evidence to each player privately
    const updates = players.map(async (p) => {
      const isKiller = p.uid === murdererUid;
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
      
      // Update role
      await updateDoc(playerRef, {
        isMurderer: isKiller,
        roleName: isKiller ? 'Unknowing Suspect' : 'Innocent',
        // Note: We don't tell them they are the killer yet!
      });
    });
    await Promise.all(updates);
  };

  const nextRound = async () => {
    let next = '';
    if (gameState.status === 'round1') next = 'round2';
    else if (gameState.status === 'round2') next = 'round3';
    else if (gameState.status === 'round3') next = 'round4';
    else if (gameState.status === 'round4') next = 'reveal';

    // Special logic for Round 2 (Swapping Sketches)
    if (next === 'round2') {
      const players = gameState.players;
      // Cycle sketches: P1 gets P2's sketch, etc.
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const target = players[(i + 1) % players.length]; // Next player
        
        // Get target's selfie (In real app, fetch doc. Here we assume we can access via ID pattern if we had it)
        // We'll trigger the player clients to fetch the 'target' sketch themselves using the target's ID
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
        await updateDoc(playerRef, { sketchTargetId: target.uid, sketchTargetName: target.name });
      }
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: next,
      roundStartedAt: Date.now()
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-center p-8">
      {/* HUD */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-100">{gameState.scenario.title}</h2>
          <div className="text-slate-500 font-mono text-xl">{gameId}</div>
        </div>
        <div className="flex items-center gap-4">
           {/* Auto-timer for rounds */}
           {(gameState.status === 'round2' || gameState.status === 'round3') && (
             <Timer duration={gameState.status === 'round2' ? 60 : 120} onComplete={nextRound} />
           )}
           <div className="bg-slate-800 px-4 py-2 rounded-full flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{gameState.players.length}</span>
          </div>
        </div>
      </div>

      {/* STAGE: LOBBY */}
      {gameState.status === 'lobby' && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-8">
          <h1 className="text-5xl font-serif font-bold">THE DOSSIER</h1>
          <p className="text-xl text-slate-400">Players: Fill out your forms. Your answers will be used as evidence.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
            {gameState.players.map(p => (
              <div key={p.uid} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center gap-2 animate-in slide-in-from-bottom-2">
                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border-2 border-slate-600">
                  {p.hasSubmittedDossier ? <div className="w-full h-full bg-green-500 rounded-full animate-pulse"/> : <span className="text-slate-500 text-lg">{p.name[0]}</span>}
                </div>
                <span className="font-bold truncate w-full">{p.name}</span>
              </div>
            ))}
          </div>

          {gameState.players.length >= 3 && (
            <button onClick={startGame} className="bg-red-600 text-white text-2xl font-bold px-12 py-4 rounded-full hover:bg-red-700 transition-all shadow-lg hover:scale-105">
              BEGIN INVESTIGATION
            </button>
          )}
        </div>
      )}

      {/* STAGE: ROUND 1 (EVIDENCE) */}
      {gameState.status === 'round1' && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-8 animate-in fade-in duration-700">
          <div className="text-red-500 font-mono tracking-[0.5em] text-xl">CASE FILES #001</div>
          <h1 className="text-6xl font-serif font-bold">CHAIN OF CUSTODY</h1>
          <div className="max-w-2xl text-xl text-slate-300 leading-relaxed">
            "I dropped the files! The evidence is everywhere. Take a look at what we found... feel free to 'correct' any errors you see before filing them."
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mt-8">
             {/* We rely on players sending data to populate this in a real app. 
                 For visuals, we show 'Live Feed' of evidence being processed. */}
             <div className="bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-600 flex items-center justify-center min-h-[200px]">
                <div className="text-slate-500 animate-pulse">Waiting for detectives to file evidence...</div>
             </div>
             <div className="bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-600 flex items-center justify-center min-h-[200px]">
                <div className="text-slate-500 animate-pulse delay-75">Processing redactions...</div>
             </div>
             <div className="bg-slate-800/50 p-6 rounded-xl border border-dashed border-slate-600 flex items-center justify-center min-h-[200px]">
                <div className="text-slate-500 animate-pulse delay-150">Analyzing fingerprints...</div>
             </div>
          </div>
          <button onClick={nextRound} className="mt-8 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg">
            Evidence Collected (Next)
          </button>
        </div>
      )}

      {/* STAGE: ROUND 2 (SKETCH) */}
      {gameState.status === 'round2' && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-8 animate-in fade-in duration-500">
           <div className="text-red-500 font-mono tracking-[0.5em] text-xl">CASE FILES #002</div>
           <h1 className="text-6xl font-serif font-bold">THE COMPOSITE</h1>
           <p className="text-xl text-slate-400">
             "We have preliminary sketches of the suspect. <br/>
             <span className="text-white font-bold">Enhance them.</span> Make them look guilty."
           </p>
           <div className="w-full max-w-4xl bg-slate-800 h-2 rounded-full overflow-hidden">
             <div className="h-full bg-red-600 animate-[width_60s_linear_forwards] w-full origin-left"></div>
           </div>
        </div>
      )}

      {/* STAGE: ROUND 3 (CONFIDE) */}
      {gameState.status === 'round3' && (
        <div className="flex-1 flex flex-col justify-center items-center space-y-6">
           <div className="text-red-500 font-mono tracking-[0.5em] text-xl">INTERCEPTED COMMS</div>
           <h1 className="text-6xl font-serif font-bold">THE WIRETAP</h1>
           
           <div className="w-full max-w-2xl h-[400px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              {/* Message Feed */}
              {gameState.messages && gameState.messages.map((msg, idx) => (
                <div key={idx} className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <div className="bg-slate-800 p-4 rounded-lg rounded-tl-none border-l-4 border-red-500 text-left">
                    <div className="flex justify-between text-xs text-slate-500 mb-1 uppercase tracking-wider">
                      <span>Signal Intercepted</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-lg font-mono text-green-400">"{msg.text}"</div>
                    {msg.evidence && (
                       <div className="mt-2 bg-black p-2 rounded text-sm text-red-400 font-mono border border-red-900/50">
                         ATTACHMENT: EVIDENCE FILE #{Math.floor(Math.random()*9000)}
                       </div>
                    )}
                  </div>
                </div>
              ))}
              {(!gameState.messages || gameState.messages.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <div className="animate-pulse">Listening for signals...</div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* STAGE: ROUND 4 (LINEUP) */}
      {gameState.status === 'round4' && (
        <div className="flex-1 flex flex-col items-center pt-8 overflow-y-auto pb-20">
           <h1 className="text-5xl font-serif font-bold mb-8">THE LINEUP</h1>
           
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl px-4">
              {gameState.players.map(p => (
                 <div key={p.uid} className={`relative group ${p.tamperedEvidence ? 'ring-2 ring-red-500' : ''}`}>
                    <div className="bg-white p-2 pb-8 rounded shadow-xl rotate-1 group-hover:rotate-0 transition-transform duration-300">
                       {/* Show Modified Sketch */}
                       <div className="aspect-square bg-slate-200 mb-2 overflow-hidden bg-cover bg-center" style={{ backgroundImage: `url(${p.sketch || p.drawing})`}}>
                       </div>
                       <div className="text-slate-900 font-bold font-mono text-xl uppercase text-center">{p.name}</div>
                    </div>
                    {/* Tamper Reveal Tag - Only shown if Host triggers reveal, but for simplicity we show now */}
                    {p.tamperedEvidence && (
                      <div className="absolute -top-2 -right-2 bg-red-600 text-white font-bold px-3 py-1 rounded-full text-xs uppercase shadow-lg transform rotate-12">
                        Tampered with Evidence
                      </div>
                    )}
                 </div>
              ))}
           </div>
           
           <button onClick={nextRound} className="mt-12 bg-red-600 text-white px-12 py-4 rounded-full font-bold text-xl hover:bg-red-700 shadow-lg">
             REVEAL THE KILLER
           </button>
        </div>
      )}

      {/* STAGE: REVEAL */}
      {gameState.status === 'reveal' && (
        <div className="flex-1 flex flex-col justify-center items-center animate-in zoom-in duration-1000">
           <h1 className="text-7xl font-serif font-bold text-red-600 mb-4">GUILTY</h1>
           
           {gameState.players.filter(p => p.uid === gameState.murdererId).map(m => (
             <div key={m.uid} className="bg-slate-800 p-8 rounded-2xl border-2 border-red-600 shadow-[0_0_100px_rgba(220,38,38,0.5)] max-w-2xl w-full">
                <div className="w-40 h-40 mx-auto bg-slate-700 rounded-full mb-6 overflow-hidden border-4 border-slate-600">
                   {m.sketch ? <img src={m.sketch} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">{m.name[0]}</div>}
                </div>
                <div className="text-5xl font-bold mb-2">{m.name}</div>
                <div className="text-xl text-slate-400 mb-8 font-mono">THE UNKNOWING SUSPECT</div>
                
                <div className="bg-black/50 p-6 rounded text-left space-y-2 font-mono text-sm text-green-400">
                  <div>MATCH_FOUND: True</div>
                  <div>WEAPON_TRACE: {gameState.scenario.victim} killed via {gameState.scenario.questions[0].id}</div>
                  <div>MOTIVE_DETECTED: {m.dossier?.habit || 'Unknown'}</div>
                </div>
             </div>
           ))}
           <button onClick={() => window.location.reload()} className="mt-8 text-slate-500 underline">Close Case</button>
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
  const [round2Drawing, setRound2Drawing] = useState(null);
  const [evidenceAction, setEvidenceAction] = useState(null); // 'edit' or 'submit'
  const [editedEvidence, setEditedEvidence] = useState('');
  const [message, setMessage] = useState('');
  
  // Handlers
  const submitDossier = async () => {
    if (!myDrawing) return;
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    await updateDoc(playerRef, {
      dossier: formData,
      drawing: myDrawing, // The 'Selfie'
      hasSubmittedDossier: true
    });
  };

  const submitEvidence = async (isTampered) => {
    // In a real app we'd save the specific evidence ID. Here we just flag the player.
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    await updateDoc(playerRef, {
      tamperedEvidence: isTampered,
      evidenceSubmitted: true
    });
    setEvidenceAction('done');
  };

  const submitSketch = async (dataUrl) => {
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    // We are saving the sketch OF the target, TO our profile (or theirs). 
    // To simplify: we save the result to MY profile as "the sketch I made". 
    // The Host will map "Player X made sketch Y" to the target.
    await updateDoc(playerRef, {
      sketch: dataUrl
    });
    setRound2Drawing('submitted');
  };

  const sendMessage = async () => {
    if (!message) return;
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    await updateDoc(gameRef, {
      messages: arrayUnion({
        senderId: user.uid,
        text: message,
        timestamp: Date.now()
      })
    });
    setMessage('');
  };

  // 1. LOBBY / DOSSIER FORM
  if (gameState.status === 'lobby') {
    if (playerState.hasSubmittedDossier) {
      return (
        <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
           <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
             <Fingerprint className="w-8 h-8 text-black" />
           </div>
           <h2 className="text-2xl font-bold text-white">Dossier Filed</h2>
           <p className="text-slate-400 mt-2">Wait for the other suspects...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 p-6 overflow-y-auto pb-20">
         <h1 className="text-2xl font-bold text-white mb-6 border-b border-slate-800 pb-4">New Suspect Form</h1>
         
         <div className="space-y-6">
            {gameState.scenario.questions.map((q, i) => (
              <div key={q.id}>
                <label className="block text-slate-400 text-sm mb-2 uppercase tracking-wide">{q.text}</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-red-500 outline-none transition-colors"
                  onChange={(e) => setFormData({...formData, [q.id]: e.target.value})}
                />
              </div>
            ))}
            
            <div>
               <label className="block text-slate-400 text-sm mb-2 uppercase tracking-wide">Draw Yourself (Selfie)</label>
               <DrawingCanvas onSave={setMyDrawing} />
               <p className="text-xs text-slate-500 text-center mt-2">Draw your face. Or a mask.</p>
            </div>

            <button 
              onClick={submitDossier}
              className="w-full bg-red-600 text-white font-bold py-4 rounded-lg mt-8 mb-8"
            >
              SUBMIT DOSSIER
            </button>
         </div>
      </div>
    );
  }

  // 2. ROUND 1: EVIDENCE
  if (gameState.status === 'round1') {
    if (evidenceAction === 'done') {
      return <div className="h-screen flex items-center justify-center text-slate-400">Evidence Filed.</div>;
    }
    
    // Generate mock evidence based on local role for display
    const mockEvidence = `Witness saw ${playerState.name} near the ${gameState.scenario.questions[1].text} holding a suspicious object.`;

    return (
      <div className="h-screen bg-slate-950 p-6 flex flex-col">
         <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="bg-white text-slate-900 p-6 rounded shadow-lg transform rotate-1">
               <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                 <FileText className="w-5 h-5 text-red-600" />
                 <span className="font-bold uppercase text-xs tracking-widest">Official Evidence</span>
               </div>
               
               {evidenceAction === 'edit' ? (
                 <textarea 
                   className="w-full h-32 border-2 border-red-300 rounded p-2 font-serif text-lg leading-relaxed focus:outline-none focus:border-red-500 bg-red-50"
                   defaultValue={mockEvidence}
                   onChange={(e) => setEditedEvidence(e.target.value)}
                 />
               ) : (
                 <p className="font-serif text-lg leading-relaxed">{mockEvidence}</p>
               )}

               <div className="mt-4 flex justify-between items-center text-xs text-slate-400 uppercase">
                  <span>Case #9921</span>
                  {evidenceAction === 'edit' && <span className="text-red-500 font-bold animate-pulse">TAMPERING...</span>}
               </div>
            </div>

            {evidenceAction !== 'edit' && (
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => submitEvidence(false)} className="bg-slate-800 text-slate-300 py-4 rounded font-bold">
                    SUBMIT AS IS
                 </button>
                 <button onClick={() => setEvidenceAction('edit')} className="bg-red-900/20 text-red-500 border border-red-900 py-4 rounded font-bold flex items-center justify-center gap-2">
                    <Edit3 className="w-4 h-4" /> TAMPER
                 </button>
              </div>
            )}
            
            {evidenceAction === 'edit' && (
              <button onClick={() => submitEvidence(true)} className="w-full bg-red-600 text-white py-4 rounded font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                 SUBMIT FALSIFIED RECORD
              </button>
            )}
         </div>
      </div>
    );
  }

  // 3. ROUND 2: SKETCH
  if (gameState.status === 'round2') {
    if (round2Drawing === 'submitted') {
       return <div className="h-screen flex items-center justify-center text-slate-400">Sketch Submitted.</div>;
    }

    // We need to fetch the target's original sketch. 
    // In this simplified version, we just don't have the image data of others easily without complex fetching.
    // So we will just provide a blank canvas but prompt them to draw "The Suspect".
    return (
      <div className="min-h-screen bg-slate-950 p-4 flex flex-col">
         <h2 className="text-center text-xl font-bold mb-2">Enhance The Suspect</h2>
         <p className="text-center text-sm text-slate-400 mb-4">
           You are drawing: <span className="text-white font-bold">{playerState.sketchTargetName || 'Unknown'}</span>.
           <br/>Make them look like a criminal.
         </p>
         
         <div className="flex-1">
            <DrawingCanvas onSave={submitSketch} strokeColor="#ef4444" />
         </div>
         <p className="text-center text-xs text-slate-500 mt-4">Red ink provided for maximum drama.</p>
      </div>
    );
  }

  // 4. ROUND 3: CONFIDE
  if (gameState.status === 'round3') {
    return (
      <div className="h-screen bg-slate-950 p-6 flex flex-col justify-center">
         <div className="mb-8 text-center">
           <Lock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
           <h2 className="text-2xl font-bold">Secure Line</h2>
           <p className="text-slate-400">Whisper to the group. <br/>Be careful what you say.</p>
         </div>

         <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white h-32 mb-4 focus:border-blue-500 outline-none font-mono"
            placeholder="I saw Blue tampering with the files..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
         />
         
         <button 
           onClick={sendMessage}
           className="bg-blue-600 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
         >
           <Send className="w-5 h-5" /> ENCRYPT & SEND
         </button>
         
         <p className="text-xs text-slate-500 text-center mt-6">
           Warning: Encryption protocols are unstable.
         </p>
      </div>
    );
  }

  // 5. ROUND 4 & REVEAL (Passive)
  return (
    <div className="h-screen flex items-center justify-center bg-black text-white p-8 text-center">
      <div>
        <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-6 animate-pulse" />
        <h2 className="text-2xl font-bold mb-2">Look at the TV</h2>
        <p className="text-slate-400">The truth is being revealed.</p>
      </div>
    </div>
  );
}