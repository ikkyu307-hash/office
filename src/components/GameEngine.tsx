import React, { useEffect, useRef, useState } from 'react';
import type { EmployeeProfile } from '../types';
import { dbService } from '../lib/supabaseClient';

interface GameEngineProps {
  currentProfile: EmployeeProfile | null;
  onProfileUpdate: (updated: EmployeeProfile) => void;
  onZoneChange: (zone: 'desk' | 'meeting' | 'break' | 'hallway') => void;
  allProfiles: EmployeeProfile[];
}

export const GameEngine: React.FC<GameEngineProps> = ({
  currentProfile,
  onProfileUpdate,
  onZoneChange,
  allProfiles,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Local movement state
  const [pos, setPos] = useState({ x: 120, y: 160 });
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [isWalking, setIsWalking] = useState(false);
  const walkFrameRef = useRef(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const posRef = useRef({ x: 120, y: 160 });

  // Map limits and obstacle bounds
  const mapWidth = 640;
  const mapHeight = 480;

  // Collision map definitions
  const obstacles = [
    // Outer walls
    { x: 0, y: 0, w: 640, h: 20 },
    { x: 0, y: 0, w: 20, h: 480 },
    { x: 620, y: 0, w: 20, h: 480 },
    { x: 0, y: 460, w: 640, h: 20 },
    
    // Meeting Room glass partitions (top right)
    { x: 400, y: 20, w: 10, h: 140 },
    { x: 400, y: 200, w: 10, h: 60 },
    { x: 400, y: 260, w: 220, h: 10 },

    // Desks / Furniture
    { x: 80, y: 100, w: 90, h: 45 },  // Tech desk 1
    { x: 240, y: 100, w: 90, h: 45 }, // Tech desk 2
    { x: 80, y: 220, w: 90, h: 45 },  // Designer desk
    { x: 240, y: 220, w: 90, h: 45 }, // PM desk

    // Meeting Room table
    { x: 460, y: 100, w: 110, h: 70 },

    // Break Room Counter/Coffee area (bottom-left)
    { x: 20, y: 380, w: 160, h: 30 },
    { x: 20, y: 380, w: 40, h: 80 },
  ];

  // Desk Chairs (seats)
  const deskChairs = [
    { name: 'Developer Desk', x: 120, y: 160, zone: 'desk' as const, chairDir: 'up' as const },
    { name: 'Tech Lead Desk', x: 285, y: 160, zone: 'desk' as const, chairDir: 'up' as const },
    { name: 'Designer Desk', x: 120, y: 280, zone: 'desk' as const, chairDir: 'up' as const },
    { name: 'PM Desk', x: 285, y: 280, zone: 'desk' as const, chairDir: 'up' as const },
  ];

  // Zones regions
  const getZoneAt = (x: number, y: number) => {
    // Break Room (bottom-left)
    if (x < 240 && y > 320) return 'break';
    // Meeting Room (top-right)
    if (x > 400 && y < 260) return 'meeting';
    // Individual desks seating triggers
    for (const chair of deskChairs) {
      const dist = Math.hypot(x - chair.x, y - chair.y);
      if (dist < 20) return 'desk';
    }
    return 'hallway';
  };

  // Sync profile when currentProfile changes (or starts)
  useEffect(() => {
    if (currentProfile) {
      setPos({ x: currentProfile.x, y: currentProfile.y });
      posRef.current = { x: currentProfile.x, y: currentProfile.y };
    }
  }, [currentProfile?.id]);

  // Key Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        keysPressedRef.current[key] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        keysPressedRef.current[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Sync position updates to DB throttled
  const lastSyncRef = useRef<number>(0);
  const syncPositionToDB = (x: number, y: number) => {
    if (!currentProfile) return;
    const now = Date.now();
    if (now - lastSyncRef.current > 150) { // sync positions every 150ms
      dbService.updateProfile({
        id: currentProfile.id,
        x: Math.round(x),
        y: Math.round(y)
      }).then((updated) => {
        onProfileUpdate(updated);
      }).catch(err => console.warn(err));
      lastSyncRef.current = now;
    }
  };

  // Canvas Logic and Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const checkCollision = (newX: number, newY: number) => {
      const charRadius = 12;
      for (const obs of obstacles) {
        if (
          newX + charRadius > obs.x &&
          newX - charRadius < obs.x + obs.w &&
          newY + charRadius > obs.y &&
          newY - charRadius < obs.y + obs.h
        ) {
          return true; // Collided
        }
      }
      return false;
    };

    const loop = () => {
      // 1. UPDATE LOGIC
      let dx = 0;
      let dy = 0;
      const speed = 1.5;

      const keys = keysPressedRef.current;
      if (keys['w'] || keys['arrowup']) { dy = -1; setDirection('up'); }
      else if (keys['s'] || keys['arrowdown']) { dy = 1; setDirection('down'); }
      
      if (keys['a'] || keys['arrowleft']) { dx = -1; setDirection('left'); }
      else if (keys['d'] || keys['arrowright']) { dx = 1; setDirection('right'); }

      // Normalize diagonal speed
      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      dx *= speed;
      dy *= speed;

      const walking = dx !== 0 || dy !== 0;
      setIsWalking(walking);

      if (walking) {
        walkFrameRef.current = (walkFrameRef.current + 0.1) % 4;

        let nextX = posRef.current.x + dx;
        let nextY = posRef.current.y + dy;

        // Boundary checks
        if (nextX < 15) nextX = 15;
        if (nextX > mapWidth - 15) nextX = mapWidth - 15;
        if (nextY < 15) nextY = 15;
        if (nextY > mapHeight - 15) nextY = mapHeight - 15;

        // Collision validation
        if (!checkCollision(nextX, posRef.current.y)) {
          posRef.current.x = nextX;
        }
        if (!checkCollision(posRef.current.x, nextY)) {
          posRef.current.y = nextY;
        }

        setPos({ x: posRef.current.x, y: posRef.current.y });
        
        // Zone Trigger check
        const currentZone = getZoneAt(posRef.current.x, posRef.current.y);
        onZoneChange(currentZone);

        // Sync coordinates to Supabase
        syncPositionToDB(posRef.current.x, posRef.current.y);
      }

      // 2. RENDER MAP & OBJECTS
      ctx.clearRect(0, 0, mapWidth, mapHeight);

      // Floor grid drawing (16-bit retro feeling tiles)
      const tileSize = 32;
      for (let tx = 0; tx < mapWidth; tx += tileSize) {
        for (let ty = 0; ty < mapHeight; ty += tileSize) {
          ctx.strokeStyle = '#151724';
          ctx.strokeRect(tx, ty, tileSize, tileSize);
        }
      }

      // Draw Zone Markings
      // Meeting Room Zone Highlight
      ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
      ctx.fillRect(400, 20, 220, 240);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.strokeRect(400, 20, 220, 240);

      // Break Room Zone Highlight
      ctx.fillStyle = 'rgba(157, 78, 221, 0.03)';
      ctx.fillRect(20, 320, 220, 140);
      ctx.strokeStyle = 'rgba(157, 78, 221, 0.15)';
      ctx.strokeRect(20, 320, 220, 140);

      // Draw obstacle boundaries (retro isometric details)
      obstacles.forEach(obs => {
        // Floor shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(obs.x + 3, obs.y + obs.h - 4, obs.w, 8);

        // Drawing obstacles - cyber tech style borders
        ctx.fillStyle = '#1c1e30';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#2f3456';
        ctx.lineWidth = 1;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // Add a neon stripe for meeting room glass partitions
        if (obs.x === 400 || obs.y === 260) {
          ctx.strokeStyle = 'var(--accent-cyan)';
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'var(--accent-cyan)';
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          ctx.shadowBlur = 0; // reset
        }
      });

      // Draw desks items (monitors, keyboards, glowing screens)
      const drawDeskOverlay = (x: number, y: number, label: string) => {
        // Desk shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + 5, y + 15, 80, 25);
        
        // Desk top
        ctx.fillStyle = '#22263f';
        ctx.fillRect(x + 5, y + 5, 80, 20);
        ctx.strokeStyle = '#3a4066';
        ctx.strokeRect(x + 5, y + 5, 80, 20);

        // Monitor Base
        ctx.fillStyle = '#111322';
        ctx.fillRect(x + 35, y + 10, 20, 4);

        // Monitor Screen (Neon Glow flicker)
        const screenFlicker = Math.random() > 0.05 ? 'var(--accent-cyan)' : 'var(--bg-primary)';
        ctx.fillStyle = screenFlicker;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'var(--accent-cyan)';
        ctx.fillRect(x + 30, y + 2, 30, 8);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#8e95b3';
        ctx.font = '8px monospace';
        ctx.fillText(label, x + 8, y + 42);
      };

      drawDeskOverlay(80, 100, 'Developer');
      drawDeskOverlay(240, 100, 'Tech Lead');
      drawDeskOverlay(80, 220, 'Designer');
      drawDeskOverlay(240, 220, 'Product Mgr');

      // Draw meeting table
      ctx.fillStyle = '#1f1512'; // wooden dark table
      ctx.fillRect(460, 100, 110, 70);
      ctx.strokeStyle = '#5a3d32';
      ctx.strokeRect(460, 100, 110, 70);
      ctx.fillStyle = '#8e95b3';
      ctx.fillText('Conf Table', 490, 140);

      // Draw plant decorations
      const drawPlant = (px: number, py: number) => {
        ctx.fillStyle = '#0f380f';
        ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e6f1d';
        ctx.beginPath(); ctx.arc(px - 3, py - 3, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#39ff14';
        ctx.beginPath(); ctx.arc(px + 2, py - 4, 3, 0, Math.PI * 2); ctx.fill();
      };
      drawPlant(45, 45);
      drawPlant(595, 45);
      drawPlant(595, 435);

      // Draw Animated Coffee Machine in Break Room
      ctx.fillStyle = '#333';
      ctx.fillRect(30, 390, 15, 20);
      ctx.fillStyle = 'var(--accent-cyan)';
      // Water cup indicator
      if (Math.floor(Date.now() / 400) % 2 === 0) {
        ctx.fillRect(35, 402, 5, 5);
      }

      // Draw desk chairs
      deskChairs.forEach(chair => {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(chair.x, chair.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#777';
        ctx.stroke();
      });

      // 3. RENDER ALL PLAYERS & BOTS (Procedural layered sprites)
      allProfiles.forEach(profile => {
        const isSelf = profile.id === currentProfile?.id;
        const playerX = isSelf ? pos.x : profile.x;
        const playerY = isSelf ? pos.y : profile.y;

        // Shadow under player
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(playerX, playerY + 12, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Render Body Base (Skin Tone)
        const skinTone = profile.skin_tone_id === 1 ? '#ffcc99' : profile.skin_tone_id === 2 ? '#e2a65d' : '#8d5524';
        ctx.fillStyle = skinTone;
        ctx.fillRect(playerX - 8, playerY - 14, 16, 20); // Head & Body

        // Animation leg offset
        let walkOffset = 0;
        if (isSelf ? isWalking : Math.abs(playerX % 10) > 2) {
          const currentFrame = isSelf ? walkFrameRef.current : (Math.floor(Date.now() / 150) % 4);
          walkOffset = Math.sin(currentFrame * Math.PI / 2) * 3;
        }

        // Draw legs
        ctx.fillStyle = '#222';
        ctx.fillRect(playerX - 6, playerY + 6 + (walkOffset > 0 ? walkOffset : 0), 4, 6);
        ctx.fillRect(playerX + 2, playerY + 6 + (walkOffset < 0 ? -walkOffset : 0), 4, 6);

        // 2. Render Outfit (Suit, Jacket, Hoodie by Department/Position)
        let outfitColor = '#555555'; // default Grey
        switch (profile.department) {
          case 'Tech': outfitColor = '#0080ff'; break;     // Tech Lead / Dev -> Cyan-blue
          case 'Design': outfitColor = '#9d4edd'; break;   // UI/UX -> Purple
          case 'Marketing': outfitColor = '#e24177'; break;// Marketing -> Magenta-pink
          case 'HR': outfitColor = '#39ff14'; break;       // HR -> Bright green
          case 'Management': outfitColor = '#222222'; break; // PM / Boss -> Sleek Black suit
        }
        ctx.fillStyle = outfitColor;
        ctx.fillRect(playerX - 8, playerY - 4, 16, 10); // Torso

        // Tie or detail on management suit
        if (profile.department === 'Management') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(playerX - 2, playerY - 4, 4, 5);
          ctx.fillStyle = 'red';
          ctx.fillRect(playerX - 1, playerY - 1, 2, 4);
        }

        // 3. Render Hair
        ctx.fillStyle = profile.hair_color_hex || '#ff5733';
        if (profile.hair_style_id === 1) { // Curly / Bob cut
          ctx.fillRect(playerX - 9, playerY - 18, 18, 5);
          ctx.fillRect(playerX - 9, playerY - 14, 3, 8);
          ctx.fillRect(playerX + 6, playerY - 14, 3, 8);
        } else if (profile.hair_style_id === 2) { // Short crop
          ctx.fillRect(playerX - 8, playerY - 18, 16, 4);
          ctx.fillRect(playerX - 5, playerY - 20, 10, 2);
        } else if (profile.hair_style_id === 3) { // Spiky / Punk
          ctx.fillRect(playerX - 8, playerY - 17, 16, 4);
          ctx.beginPath();
          ctx.moveTo(playerX - 7, playerY - 17);
          ctx.lineTo(playerX - 5, playerY - 22);
          ctx.lineTo(playerX - 3, playerY - 17);
          ctx.lineTo(playerX, playerY - 23);
          ctx.lineTo(playerX + 3, playerY - 17);
          ctx.lineTo(playerX + 5, playerY - 22);
          ctx.lineTo(playerX + 7, playerY - 17);
          ctx.fill();
        } else { // Bald or headband
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(playerX - 8, playerY - 15, 16, 2);
        }

        // Eyes (drawn based on direction)
        ctx.fillStyle = '#111111';
        const pDir = isSelf ? direction : (profile.x % 4 === 0 ? 'left' : 'down');
        if (pDir === 'down') {
          ctx.fillRect(playerX - 4, playerY - 11, 2, 2);
          ctx.fillRect(playerX + 2, playerY - 11, 2, 2);
        } else if (pDir === 'left') {
          ctx.fillRect(playerX - 6, playerY - 11, 2, 2);
        } else if (pDir === 'right') {
          ctx.fillRect(playerX + 4, playerY - 11, 2, 2);
        } else if (pDir === 'up') {
          // Back of head, no eyes
        }

        // 4. Render Accessories
        if (profile.accessory_id === 1) { // Glasses
          ctx.strokeStyle = 'var(--accent-cyan)';
          ctx.lineWidth = 1;
          ctx.strokeRect(playerX - 5, playerY - 12, 3, 3);
          ctx.strokeRect(playerX + 2, playerY - 12, 3, 3);
          ctx.beginPath();
          ctx.moveTo(playerX - 2, playerY - 11);
          ctx.lineTo(playerX + 2, playerY - 11);
          ctx.stroke();
        } else if (profile.accessory_id === 2) { // Headset
          ctx.fillStyle = '#111';
          ctx.fillRect(playerX - 9, playerY - 12, 2, 6);
          ctx.fillRect(playerX + 7, playerY - 12, 2, 6);
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(playerX, playerY - 14, 8, Math.PI, 0);
          ctx.stroke();
        } else if (profile.accessory_id === 3) { // Developer badge
          ctx.fillStyle = 'var(--accent-yellow)';
          ctx.fillRect(playerX + 3, playerY, 2, 3);
        }

        // Floating name bubble & status dot
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(playerX - 35, playerY - 34, 70, 12);
        ctx.fillStyle = '#fff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(profile.nickname || profile.name, playerX, playerY - 26);

        // Status circle dot
        let statusDotColor = 'var(--accent-green)';
        switch (profile.status) {
          case 'Focus Mode': statusDotColor = 'var(--accent-magenta)'; break;
          case 'In a Meeting': statusDotColor = 'var(--accent-cyan)'; break;
          case 'Away From Keyboard': statusDotColor = 'var(--accent-yellow)'; break;
          case 'Resting': statusDotColor = 'var(--accent-purple)'; break;
        }
        ctx.fillStyle = statusDotColor;
        ctx.beginPath();
        ctx.arc(playerX + 28, playerY - 28, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bot speech/status bubble simulation details
        if (profile.id !== 'user-id-123') {
          // If typing or active, show a small "💬" bubble
          if (profile.status === 'Focus Mode' && Math.floor(Date.now() / 1000) % 8 < 3) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.fillRect(playerX - 10, playerY - 52, 20, 12);
            ctx.strokeRect(playerX - 10, playerY - 52, 20, 12);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('⌨️', playerX, playerY - 43);
          } else if (profile.status === 'In a Meeting' && Math.floor(Date.now() / 1000) % 6 < 2) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.fillRect(playerX - 10, playerY - 52, 20, 12);
            ctx.strokeRect(playerX - 10, playerY - 52, 20, 12);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('💬', playerX, playerY - 43);
          }
        }
      });

      // Canvas loop recurse
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [allProfiles, currentProfile?.id, pos.x, pos.y, direction, isWalking]);

  // Click to navigate support
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProfile) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Direct snap-teleport movement or simple slide towards click position
    // For retro feel, instant snap is solid, or we slide posRef
    posRef.current.x = clickX;
    posRef.current.y = clickY;
    setPos({ x: clickX, y: clickY });
    onZoneChange(getZoneAt(clickX, clickY));
    syncPositionToDB(clickX, clickY);
  };

  return (
    <div ref={containerRef} className="retro-screen w-full h-[480px] bg-[#0c0d16] flex items-center justify-center relative">
      <canvas
        ref={canvasRef}
        width={mapWidth}
        height={mapHeight}
        onClick={handleCanvasClick}
        className="cursor-crosshair block"
      />
      {/* HUD overlay labels */}
      <div className="absolute top-3 left-3 bg-[rgba(10,11,16,0.8)] border border-[rgba(255,255,255,0.15)] px-3 py-1.5 rounded text-[10px] text-zinc-400 font-mono flex items-center gap-3">
        <span>🎮 WASD / Arrows to Move</span>
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
        <span>🖱️ Click Map to Jump</span>
      </div>
      <div className="absolute bottom-3 right-3 bg-[rgba(10,11,16,0.8)] border border-[rgba(255,255,255,0.15)] px-3 py-1.5 rounded text-[10px] text-zinc-400 font-mono">
        Active Zone: <span className="text-cyan-400 font-bold capitalize">{getZoneAt(pos.x, pos.y)}</span>
      </div>
    </div>
  );
};
