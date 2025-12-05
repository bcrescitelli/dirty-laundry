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
  Users, 
  Tv, 
  Smartphone, 
  Skull, 
  Eye, 
  EyeOff, 
  MessageSquare, 
  Clock, 
  AlertTriangle,
  Fingerprint,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

/* -----------------------------------------------------------------------
  GAME CONFIGURATION & SCENARIOS
  -----------------------------------------------------------------------
*/

const SCENARIOS = [
  {
    id: 'manor',
    title: 'The Blackwood Manor Gala',
    victim: 'Baron Blackwood',
    weapon: 'Antique Fire Poker',
    location: 'The Manor',
    rooms: ['Library', 'Kitchen', 'Garden', 'Cellar', 'Master Bedroom'],
    roles: [
      { id: 'thief', name: 'The Thief', secret: 'You were stealing silver.', alibi: 'Garden' },
      { id: 'cheat', name: 'The Cheat', secret: 'You were forging the will.', alibi: 'Library' },
      { id: 'lover', name: 'The Lover', secret: 'You were having an affair.', alibi: 'Master Bedroom' },
      { id: 'drunk', name: 'The Drunk', secret: 'You passed out and remember nothing.', alibi: 'Cellar' },
      { id: 'debtor', name: 'The Debtor', secret: 'You were begging for a loan.', alibi: 'Kitchen' },
      { id: 'rival', name: 'The Rival', secret: 'You were snooping for blackmail.', alibi: 'Library' },
      { id: 'spy', name: 'The Spy', secret: 'You were planting a bug.', alibi: 'Master Bedroom' },
    ]
  },
  {
    id: 'yacht',
    title: 'The Golden Horizon Cruise',
    victim: 'Captain Sterling',
    weapon: 'Flare Gun',
    location: 'The Superyacht',
    rooms: ['Engine Room', 'Bridge', 'Casino', 'Deck', 'VIP Cabin'],
    roles: [
      { id: 'smuggler', name: 'The Smuggler', secret: 'You were moving contraband.', alibi: 'Engine Room' },
      { id: 'gambler', name: 'The Gambler', secret: 'You were cheating at poker.', alibi: 'Casino' },
      { id: 'stowaway', name: 'The Stowaway', secret: 'You aren\'t supposed to be here.', alibi: 'Deck' },
      { id: 'saboteur', name: 'The Saboteur', secret: 'You were cutting the radio wires.', alibi: 'Bridge' },
      { id: 'heir', name: 'The Greedy Heir', secret: 'You were searching the safe.', alibi: 'VIP Cabin' },
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
  MAIN APP COMPONENT
  -----------------------------------------------------------------------
*/

export default function App() {
  const [user, setUser] = useState(null);
  const [gameId, setGameId] = useState('');
  const [gameState, setGameState] = useState(null);
  const [playerState, setPlayerState] = useState(null); // My player data
  const [view, setView] = useState('home'); // home, host, player
  const [error, setError] = useState('');

  // 1. Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      // Since you are using your own Firebase project, we skip the custom token check
      // which was intended for the internal preview environment.
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setError("Authentication failed. Check your Firebase config.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. Game State Listener
  useEffect(() => {
    if (!user || !gameId) return;

    // Listen to the public game state
    // FIX: Added 'games' collection segment to ensure even number of path segments
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId);
    const unsubGame = onSnapshot(gameRef, (snap) => {
      if (snap.exists()) {
        setGameState(snap.data());
      } else {
        setError('Game not found.');
      }
    }, (err) => console.error("Game listener error", err));

    return () => {
      unsubGame();
    };
  }, [user, gameId]);

  // 3. Private Player Data Listener
  useEffect(() => {
    if (!user || !gameId || view !== 'player') return;

    // FIX: Added 'players' collection segment
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${user.uid}`);
    const unsubPlayer = onSnapshot(playerRef, (snap) => {
      if (snap.exists()) {
        setPlayerState(snap.data());
      }
    }, (err) => console.error("Player listener error", err));

    return () => {
      unsubPlayer();
    };
  }, [user, gameId, view]);


  // Actions
  const createGame = async () => {
    if (!user) return;
    const newGameId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

    const initialGameState = {
      roomCode: newGameId,
      hostId: user.uid,
      status: 'lobby',
      scenario: scenario,
      players: [], // List of {uid, name} for easy display
      round: 0,
      roundData: {},
      createdAt: new Date().toISOString()
    };

    // FIX: Added 'games' collection segment
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', newGameId), initialGameState);
    setGameId(newGameId);
    setView('host');
  };

  const joinGame = async (code, name) => {
    if (!user) return;
    const cleanCode = code.toUpperCase();
    // FIX: Added 'games' collection segment
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', cleanCode);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
      setError('Room not found');
      return;
    }

    // FIX: Added 'players' collection segment
    const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${cleanCode}_${user.uid}`);
    
    // Create private player doc
    await setDoc(playerRef, {
      uid: user.uid,
      name: name,
      isMurderer: false,
      roleName: 'TBD',
      secretObjective: 'TBD',
      group: 'TBD',
      rumors: [], // Rumors I know about others
      trustScore: 0,
      suspicionScore: 0
    });

    // Add to public player list
    await updateDoc(gameRef, {
      players: arrayUnion({ uid: user.uid, name: name })
    });

    setGameId(cleanCode);
    setView('player');
  };

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Connecting to servers...</div>;

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
      <div className="mb-8 text-center">
        <div className="inline-block p-4 rounded-full bg-slate-900 border border-slate-800 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
          <Fingerprint className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-slate-100 mb-2">DIRTY LAUNDRY</h1>
        <p className="text-slate-400">A game of secrets, lies, and murder.</p>
      </div>

      <div className="w-full space-y-4">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Join Room</h2>
          <input 
            type="text" 
            placeholder="Room Code" 
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-center text-2xl tracking-widest uppercase focus:outline-none focus:border-red-500 transition-colors"
          />
          <input 
            type="text" 
            placeholder="Your Name" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-center focus:outline-none focus:border-red-500 transition-colors"
          />
          <button 
            onClick={() => name && code && onJoin(code, name)}
            disabled={!name || !code}
            className="w-full bg-slate-100 text-slate-950 font-bold py-3 rounded-lg hover:bg-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ENTER
          </button>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-950 text-slate-500">OR</span>
          </div>
        </div>

        <button 
          onClick={onCreate}
          className="w-full bg-slate-800 text-slate-300 font-bold py-3 rounded-lg hover:bg-slate-700 active:scale-95 transition-all border border-slate-700"
        >
          HOST NEW GAME
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
  HOST VIEW (TV SCREEN)
  -----------------------------------------------------------------------
*/
function HostView({ gameId, gameState }) {
  
  // Host Logic: Start Game
  const startGame = async () => {
    if (gameState.players.length < 3) return; // Min 3 players

    // 1. Assign Murderer
    const players = [...gameState.players];
    const murdererIndex = Math.floor(Math.random() * players.length);
    const murdererUid = players[murdererIndex].uid;

    // 2. Assign Groups (A/B)
    // Shuffle players first
    players.sort(() => Math.random() - 0.5);
    const groupA = players.slice(0, Math.ceil(players.length / 2));
    const groupB = players.slice(Math.ceil(players.length / 2));

    // 3. Assign Roles & Write to Private Docs
    const scenario = gameState.scenario;
    const availableRoles = [...scenario.roles].sort(() => Math.random() - 0.5);

    const updates = players.map((p, idx) => {
      const isKiller = p.uid === murdererUid;
      const role = availableRoles[idx % availableRoles.length];
      const group = groupA.find(g => g.uid === p.uid) ? 'A' : 'B';
      
      // Update private doc
      // FIX: Added 'players' collection segment
      const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
      return updateDoc(playerRef, {
        isMurderer: isKiller,
        roleName: isKiller ? 'The Killer' : role.name,
        // If killer, their secret is the murder, but they get a fake alibi to stick to
        secretObjective: isKiller 
          ? `You KILLED ${scenario.victim}. You must hide this.` 
          : role.secret,
        alibi: role.alibi, // Everyone gets an alibi location to lie about
        group: group
      });
    });

    await Promise.all(updates);

    // 4. Update Game State
    // FIX: Added 'games' collection segment
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: 'round1',
      round: 1,
      murdererId: murdererUid,
      groupA: groupA,
      groupB: groupB,
      roundData: {
        introText: `Police have arrived at ${scenario.location}. The body of ${scenario.victim} was found in the ${scenario.weapon === 'Flare Gun' ? 'Sea' : 'Study'}.`
      }
    });
  };

  // Host Logic: Advance Rounds
  const nextRound = async () => {
    let nextStatus = '';
    let nextRoundNum = gameState.round + 1;
    let updates = {};

    if (gameState.status === 'round1') nextStatus = 'round2';
    else if (gameState.status === 'round2') nextStatus = 'round3';
    else if (gameState.status === 'round3') nextStatus = 'reveal';

    // Round 2 Logic: Generate Rumors
    if (nextStatus === 'round2') {
      const players = gameState.players;
      // Generate circular rumors: P1 gets dirt on P2, P2 on P3...
      const rumorUpdates = players.map(async (p, i) => {
        const target = players[(i + 1) % players.length];
        // FIX: Added 'players' collection segment
        const playerRef = doc(db, 'artifacts', appId, 'public', 'data', 'players', `${gameId}_${p.uid}`);
        
        // Fetch target's role to make rumor semi-accurate
        // In a real app we'd fetch, but here let's make generic spooky rumors
        const rumors = [
          `You saw ${target.name} wiping something off their hands.`,
          `You heard ${target.name} whispering threateningly.`,
          `You saw ${target.name} throw an object into the trash.`,
          `You found a note written by ${target.name} that said "It's done."`
        ];
        const randomRumor = rumors[Math.floor(Math.random() * rumors.length)];
        
        await updateDoc(playerRef, {
          currentRumor: { targetId: target.uid, targetName: target.name, text: randomRumor }
        });
      });
      await Promise.all(rumorUpdates);
    }

    // FIX: Added 'games' collection segment
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', gameId), {
      status: nextStatus,
      round: nextRoundNum,
      ...updates
    });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-center p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div className="text-left">
          <h2 className="text-2xl font-serif font-bold text-slate-100">{gameState.scenario.title}</h2>
          <p className="text-slate-500">Room Code: <span className="text-red-500 font-mono text-xl">{gameId}</span></p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-full flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>{gameState.players.length} Players</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center">
        
        {gameState.status === 'lobby' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <h1 className="text-6xl font-serif font-bold tracking-tight">WAITING FOR DETECTIVES</h1>
            <div className="flex flex-wrap gap-4 justify-center max-w-4xl">
              {gameState.players.map(p => (
                <div key={p.uid} className="bg-slate-800 border border-slate-700 px-6 py-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="font-bold text-lg">{p.name[0]}</span>
                  </div>
                  <span className="text-xl font-bold">{p.name}</span>
                </div>
              ))}
            </div>
            {gameState.players.length < 3 && (
              <p className="text-slate-500 italic">Need at least 3 players to start...</p>
            )}
            {gameState.players.length >= 3 && (
              <button onClick={startGame} className="bg-red-600 text-white text-2xl font-bold px-12 py-4 rounded-full hover:bg-red-700 transition-all hover:scale-105 shadow-[0_0_50px_rgba(220,38,38,0.4)]">
                START INVESTIGATION
              </button>
            )}
          </div>
        )}

        {gameState.status === 'round1' && (
          <div className="max-w-4xl w-full space-y-8">
            <div className="text-red-500 font-mono text-xl tracking-[0.3em] uppercase mb-4">Round 1: The Split</div>
            <h1 className="text-5xl font-serif font-bold mb-8">CONFLICTING REPORTS</h1>
            
            <div className="grid grid-cols-2 gap-12">
              <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700">
                <h3 className="text-2xl font-bold mb-4 text-blue-400">GROUP A</h3>
                <div className="text-left space-y-2">
                  {gameState.groupA.map(p => <div key={p.uid} className="bg-slate-900 p-2 rounded">{p.name}</div>)}
                </div>
                <div className="mt-8 p-4 bg-slate-950 rounded border border-blue-900/50 text-slate-400 text-sm">
                  Checking phones for intel...
                </div>
              </div>
              <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700">
                <h3 className="text-2xl font-bold mb-4 text-orange-400">GROUP B</h3>
                <div className="text-left space-y-2">
                  {gameState.groupB.map(p => <div key={p.uid} className="bg-slate-900 p-2 rounded">{p.name}</div>)}
                </div>
                <div className="mt-8 p-4 bg-slate-950 rounded border border-orange-900/50 text-slate-400 text-sm">
                  Checking phones for intel...
                </div>
              </div>
            </div>
            <p className="text-xl text-slate-300 italic mt-8">"Check your devices. The police have sent different info to each group."</p>
            <button onClick={nextRound} className="mt-12 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg">Next Round</button>
          </div>
        )}

        {gameState.status === 'round2' && (
          <div className="max-w-4xl w-full space-y-8">
            <div className="text-red-500 font-mono text-xl tracking-[0.3em] uppercase mb-4">Round 2: The Rumor Mill</div>
            <h1 className="text-5xl font-serif font-bold mb-8">DIRTY LAUNDRY</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {/* This would dynamically populate as players choose to publish rumors */}
              <div className="col-span-full bg-slate-800 p-8 rounded-xl border border-slate-700 min-h-[300px] flex items-center justify-center flex-col">
                <MessageSquare className="w-16 h-16 text-slate-600 mb-4" />
                <p className="text-2xl text-slate-400">Waiting for rumors to leak...</p>
                <p className="text-slate-500 mt-2">Players are deciding whether to BURY or PUBLISH secrets.</p>
              </div>
            </div>
            <button onClick={nextRound} className="mt-12 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg">Next Round</button>
          </div>
        )}

        {gameState.status === 'round3' && (
           <div className="max-w-4xl w-full space-y-8">
           <div className="text-red-500 font-mono text-xl tracking-[0.3em] uppercase mb-4">Round 3: The Timeline</div>
           <h1 className="text-5xl font-serif font-bold mb-8">INTERROGATION</h1>
           
           <div className="w-full bg-slate-800 p-8 rounded-xl border border-slate-700 relative overflow-hidden">
             {/* Timeline Visual */}
             <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-600 -translate-y-1/2"></div>
             <div className="flex justify-between relative z-10">
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-600 w-1/4">
                  <div className="text-slate-400 text-xs uppercase mb-1">8:00 PM</div>
                  <div className="font-bold">Dinner</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-600 w-1/4">
                  <div className="text-slate-400 text-xs uppercase mb-1">9:00 PM</div>
                  <div className="font-bold text-red-400">Blackout</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-600 w-1/4">
                  <div className="text-slate-400 text-xs uppercase mb-1">10:00 PM</div>
                  <div className="font-bold">Body Found</div>
                </div>
             </div>
             <div className="mt-12 text-slate-300">
               <p>Discuss: Where were you during the 9:00 PM Blackout?</p>
               <p className="text-sm text-slate-500 mt-2">The killer must lie. The innocent must lie to hide their petty crimes.</p>
             </div>
           </div>
           <button onClick={nextRound} className="mt-12 bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg">Reveal The Killer</button>
         </div>
        )}

        {gameState.status === 'reveal' && (
          <div className="max-w-3xl w-full space-y-8 text-center animate-in zoom-in duration-700">
            <h1 className="text-6xl font-serif font-bold text-red-500 mb-8">CASE CLOSED</h1>
            
            <div className="bg-slate-900 p-8 rounded-2xl border-2 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.3)]">
              <p className="text-slate-400 uppercase tracking-widest mb-4">The Murderer Was</p>
              {gameState.players.filter(p => p.uid === gameState.murdererId).map(m => (
                 <div key={m.uid} className="space-y-4">
                    <div className="text-5xl font-bold text-white">{m.name}</div>
                    <div className="text-xl text-red-400">Weapon: {gameState.scenario.weapon}</div>
                 </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left">
               <h3 className="col-span-full text-center text-slate-500 uppercase tracking-widest">The Dirty Laundry</h3>
               {gameState.players.filter(p => p.uid !== gameState.murdererId).map(p => (
                 <div key={p.uid} className="bg-slate-800 p-4 rounded border border-slate-700 opacity-70">
                   <div className="font-bold text-white">{p.name}</div>
                   <div className="text-sm text-slate-400">Secretly just a petty criminal.</div>
                 </div>
               ))}
            </div>

            <button onClick={() => window.location.reload()} className="mt-12 text-slate-400 hover:text-white underline">New Game</button>
          </div>
        )}

      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
  PLAYER VIEW (PHONE)
  -----------------------------------------------------------------------
*/
function PlayerView({ gameId, gameState, playerState, user }) {
  const [showSecret, setShowSecret] = useState(false);
  const [actionTaken, setActionTaken] = useState(false);

  if (!playerState) return <div className="h-screen bg-black text-white flex items-center justify-center">Loading dossier...</div>;

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 font-sans pb-20">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 pt-2">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{playerState.name}</div>
        <div className="bg-slate-900 px-3 py-1 rounded border border-slate-800 text-xs font-mono">{gameId}</div>
      </div>

      {/* LOBBY STATE */}
      {gameState.status === 'lobby' && (
        <div className="text-center space-y-6 mt-12">
          <div className="w-20 h-20 bg-slate-900 rounded-full mx-auto flex items-center justify-center border border-slate-800">
            <Users className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-2xl font-bold">You're In.</h2>
          <p className="text-slate-400">Wait for the host to start the game. Don't let anyone see your screen once the game begins.</p>
        </div>
      )}

      {/* GAME ACTIVE STATES */}
      {gameState.status !== 'lobby' && gameState.status !== 'reveal' && (
        <>
          {/* PERSISTENT SECRET FOOTER (HOLD TO REVEAL) */}
          <div 
            className={`fixed bottom-0 left-0 right-0 p-6 transition-colors duration-200 cursor-pointer select-none touch-none ${showSecret ? 'bg-red-900' : 'bg-slate-900'} border-t border-slate-800`}
            onPointerDown={() => setShowSecret(true)}
            onPointerUp={() => setShowSecret(false)}
            onPointerLeave={() => setShowSecret(false)}
          >
            <div className="flex flex-col items-center gap-2">
              {showSecret ? <Eye className="w-6 h-6 text-white" /> : <EyeOff className="w-6 h-6 text-slate-500" />}
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {showSecret ? 'Release to Hide' : 'Hold for Secret Role'}
              </span>
            </div>
            
            {showSecret && (
              <div className="mt-4 animate-in slide-in-from-bottom-5">
                <div className="text-2xl font-bold text-white mb-1">{playerState.roleName}</div>
                <div className="text-red-200 leading-tight mb-4 font-serif">{playerState.secretObjective}</div>
                
                <div className="bg-black/30 p-3 rounded text-left">
                  <div className="text-xs text-red-300 uppercase font-bold mb-1">Your Alibi</div>
                  <div className="text-sm">If asked, you were in the <span className="font-bold text-white">{playerState.alibi}</span>.</div>
                </div>
              </div>
            )}
          </div>

          {/* ROUND 1: CONFLICTING INTEL */}
          {gameState.status === 'round1' && (
            <div className="space-y-6">
              <div className="bg-slate-900 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="text-xs uppercase text-slate-500 mb-1">Your Group</h3>
                <div className="text-xl font-bold">Group {playerState.group}</div>
              </div>

              <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-lg">
                <div className="flex items-center gap-2 text-red-500 mb-3">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="font-bold uppercase tracking-widest text-sm">Police Report</span>
                </div>
                <p className="text-lg leading-relaxed">
                  "We have confirmed the killer was hiding among <span className="font-bold text-white">Group {playerState.group === 'A' ? 'B' : 'A'}</span> during the blackout."
                </p>
                <p className="mt-4 text-sm text-slate-400 italic border-t border-slate-700 pt-3">
                  (Note: The other group received a report saying the killer is in YOUR group. They will attack you. Defend your team.)
                </p>
              </div>
            </div>
          )}

          {/* ROUND 2: RUMOR MILL */}
          {gameState.status === 'round2' && playerState.currentRumor && (
            <div className="space-y-6">
               <h2 className="text-xl font-bold text-center">Incoming Dirt</h2>
               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                  <p className="text-sm text-slate-500 uppercase mb-2">Subject: {playerState.currentRumor.targetName}</p>
                  <p className="text-lg italic text-white mb-6">"{playerState.currentRumor.text}"</p>
                  
                  {!actionTaken ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setActionTaken(true)}
                        className="bg-slate-700 p-4 rounded-lg font-bold hover:bg-slate-600 transition-colors"
                      >
                        <div className="text-xs uppercase text-slate-400 mb-1">Safety</div>
                        Bury It
                      </button>
                      <button 
                        onClick={() => setActionTaken(true)}
                        className="bg-red-600 p-4 rounded-lg font-bold hover:bg-red-700 transition-colors"
                      >
                        <div className="text-xs uppercase text-red-200 mb-1">Chaos</div>
                        Publish
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-green-500 font-bold bg-slate-900 p-3 rounded">
                      Action Confirmed
                    </div>
                  )}
               </div>
               <p className="text-sm text-slate-500 text-center">Publishing causes chaos but deflects suspicion. Burying builds trust.</p>
            </div>
          )}

          {/* ROUND 3: INTERROGATION */}
          {gameState.status === 'round3' && (
             <div className="space-y-6">
               <h2 className="text-xl font-bold text-center">Stick to the Story</h2>
               <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="mb-4">The group is discussing the timeline.</p>
                  <div className="bg-black/40 p-4 rounded border border-slate-600">
                    <p className="text-xs text-slate-400 uppercase mb-1">Reminder: Your Alibi</p>
                    <p className="text-xl font-bold text-white">{playerState.alibi}</p>
                  </div>
                  <p className="text-sm text-slate-400 mt-4">Do not contradict this location, or you will expose your secret role.</p>
               </div>
             </div>
          )}
        </>
      )}

      {gameState.status === 'reveal' && (
        <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
           {playerState.isMurderer ? (
             <div className="text-center">
               <Skull className="w-20 h-20 text-red-500 mx-auto mb-4" />
               <h1 className="text-3xl font-bold text-white">YOU WERE CAUGHT</h1>
               <p className="text-slate-400">But you took them down with you.</p>
             </div>
           ) : (
             <div className="text-center">
               <ShieldAlert className="w-20 h-20 text-blue-500 mx-auto mb-4" />
               <h1 className="text-3xl font-bold text-white">GAME OVER</h1>
               <p className="text-slate-400">Check the main screen for the verdict.</p>
             </div>
           )}
        </div>
      )}

    </div>
  );
}
