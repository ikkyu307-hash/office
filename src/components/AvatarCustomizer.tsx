import React, { useState, useEffect, useRef } from 'react';
import type { EmployeeProfile } from '../types';
import { dbService } from '../lib/supabaseClient';
import { X, Check } from 'lucide-react';

interface AvatarCustomizerProps {
  profile: EmployeeProfile | null;
  onClose: () => void;
  onSave: (updated: EmployeeProfile) => void;
}

export const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({
  profile,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(profile?.name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [department, setDepartment] = useState(profile?.department || 'Tech');
  const [position, setPosition] = useState(profile?.position || 'Developer');
  
  const [skinToneId, setSkinToneId] = useState(profile?.skin_tone_id || 1);
  const [hairStyleId, setHairStyleId] = useState(profile?.hair_style_id || 1);
  const [hairColor, setHairColor] = useState(profile?.hair_color_hex || '#dfa62a');
  const [accessoryId, setAccessoryId] = useState(profile?.accessory_id || 0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Position choices based on department selected
  const getPositionsForDepartment = (dept: string) => {
    switch (dept) {
      case 'Tech': return ['Tech Lead', 'Developer'];
      case 'Design': return ['UI/UX Designer'];
      case 'Marketing': return ['Marketing Lead'];
      case 'HR': return ['HR Manager'];
      case 'Management': return ['PM'];
      default: return ['Developer'];
    }
  };

  // Adjust position when department changes
  useEffect(() => {
    const validPositions = getPositionsForDepartment(department);
    if (!validPositions.includes(position)) {
      setPosition(validPositions[0] as any);
    }
  }, [department]);

  // Live preview animation loop
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let walkFrame = 0;

    const drawPreview = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const px = canvas.width / 2;
      const py = canvas.height / 2 - 5;

      // Floor Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(px, py + 18, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Skin Tone
      const skinColor = skinToneId === 1 ? '#ffcc99' : skinToneId === 2 ? '#e2a65d' : '#8d5524';
      ctx.fillStyle = skinColor;
      ctx.fillRect(px - 10, px - 18, 20, 26); // Head & neck/body base

      // Leg Walk Cycles
      walkFrame = (walkFrame + 0.15) % 4;
      const walkOffset = Math.sin(walkFrame * Math.PI / 2) * 5;
      
      ctx.fillStyle = '#222';
      ctx.fillRect(px - 7, py + 12 + (walkOffset > 0 ? walkOffset : 0), 5, 8);
      ctx.fillRect(px + 2, py + 12 + (walkOffset < 0 ? -walkOffset : 0), 5, 8);

      // Outfit (based on selected department)
      let outfitColor = '#555555';
      switch (department) {
        case 'Tech': outfitColor = '#0080ff'; break;
        case 'Design': outfitColor = '#9d4edd'; break;
        case 'Marketing': outfitColor = '#e24177'; break;
        case 'HR': outfitColor = '#39ff14'; break;
        case 'Management': outfitColor = '#222222'; break;
      }
      ctx.fillStyle = outfitColor;
      ctx.fillRect(px - 10, py - 5, 20, 15);

      if (department === 'Management') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2, py - 5, 4, 7);
        ctx.fillStyle = 'red';
        ctx.fillRect(px - 1, py - 1, 2, 5);
      }

      // Hair
      ctx.fillStyle = hairColor;
      if (hairStyleId === 1) { // Curly / Bob
        ctx.fillRect(px - 11, py - 23, 22, 6);
        ctx.fillRect(px - 11, py - 17, 3, 10);
        ctx.fillRect(px + 8, py - 17, 3, 10);
      } else if (hairStyleId === 2) { // Short crop
        ctx.fillRect(px - 10, py - 23, 20, 5);
        ctx.fillRect(px - 6, py - 25, 12, 2);
      } else if (hairStyleId === 3) { // Spiky
        ctx.fillRect(px - 10, py - 22, 20, 5);
        ctx.beginPath();
        ctx.moveTo(px - 9, py - 22);
        ctx.lineTo(px - 6, py - 28);
        ctx.lineTo(px - 3, py - 22);
        ctx.lineTo(px, py - 30);
        ctx.lineTo(px + 3, py - 22);
        ctx.lineTo(px + 6, py - 28);
        ctx.lineTo(px + 9, py - 22);
        ctx.fill();
      } else { // Band / Bald
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px - 10, py - 19, 20, 3);
      }

      // Eyes (looking straight)
      ctx.fillStyle = '#111111';
      ctx.fillRect(px - 5, py - 14, 2, 3);
      ctx.fillRect(px + 3, py - 14, 2, 3);

      // Accessory
      if (accessoryId === 1) { // Glasses
        ctx.strokeStyle = 'var(--accent-cyan)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 7, py - 15, 5, 4);
        ctx.strokeRect(px + 2, py - 15, 5, 4);
        ctx.beginPath();
        ctx.moveTo(px - 2, py - 13);
        ctx.lineTo(px + 2, py - 13);
        ctx.stroke();
      } else if (accessoryId === 2) { // Headset
        ctx.fillStyle = '#111';
        ctx.fillRect(px - 11, py - 14, 2, 8);
        ctx.fillRect(px + 9, py - 14, 2, 8);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py - 18, 10, Math.PI, 0);
        ctx.stroke();
      } else if (accessoryId === 3) { // Developer badge
        ctx.fillStyle = 'var(--accent-yellow)';
        ctx.fillRect(px + 4, py + 1, 3, 4);
      }

      frameId = requestAnimationFrame(drawPreview);
    };

    drawPreview();
    return () => cancelAnimationFrame(frameId);
  }, [skinToneId, hairStyleId, hairColor, department, accessoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const updated = await dbService.updateProfile({
        id: profile.id,
        name,
        nickname,
        department: department as any,
        position: position as any,
        skin_tone_id: skinToneId,
        hair_style_id: hairStyleId,
        hair_color_hex: hairColor,
        accessory_id: accessoryId,
      });
      onSave(updated);
    } catch (err) {
      console.error('Failed to update avatar details:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,4,7,0.85)] backdrop-blur-md p-4">
      <div className="hud-panel w-full max-w-lg border-2 border-[rgba(0,240,255,0.25)] overflow-hidden radar-brackets radar-bottom-brackets shadow-[0_0_40px_rgba(0,240,255,0.15)] bg-[rgba(9,11,18,0.95)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[rgba(25,27,44,0.6)]">
          <h2 className="text-sm font-bold text-[var(--accent-cyan)] flex items-center gap-2 font-hud tracking-widest">
            🎨 CHARACTER UPLINK PORTAL
          </h2>
          <button onClick={onClose} className="p-1 hover:text-[var(--accent-magenta)] transition-colors text-zinc-400">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col md:flex-row gap-6">
          
          {/* Left Side Preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-32 h-32 retro-screen bg-[#07080d] flex items-center justify-center rounded-lg border-[var(--border-color)] radar-brackets radar-bottom-brackets">
              <canvas ref={previewCanvasRef} width={80} height={80} className="w-24 h-24" />
            </div>
            <span className="text-[10px] text-zinc-500 uppercase font-hud tracking-wider font-bold">TRANSMISSION ACTIVE</span>
          </div>

          {/* Right Side Options */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[350px] md:max-h-[50vh] pr-2">
            
            {/* Identity details */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Employee Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="input-retro text-xs w-full"
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Avatar Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
                className="input-retro text-xs w-full"
                placeholder="e.g. Johnny"
              />
            </div>

            {/* Department Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value as any)}
                  className="input-retro text-xs w-full cursor-pointer bg-[#10121e]"
                >
                  <option value="Tech">Tech</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Management">Management</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Job Position</label>
                <select
                  value={position}
                  onChange={e => setPosition(e.target.value as any)}
                  className="input-retro text-xs w-full cursor-pointer bg-[#10121e]"
                >
                  {getPositionsForDepartment(department).map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-t border-[var(--border-color)] my-2" />

            {/* Customize Layers */}
            {/* 1. Skin Tone selection */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Base Skin Tone</label>
              <div className="flex gap-3">
                {[1, 2, 3].map(toneId => (
                  <button
                    key={toneId}
                    type="button"
                    onClick={() => setSkinToneId(toneId)}
                    className={`w-8 h-8 rounded border-2 transition-all ${skinToneId === toneId ? 'border-[var(--accent-cyan)] shadow-[0_0_8px_rgba(0,240,255,0.4)]' : 'border-transparent'}`}
                    style={{
                      backgroundColor: toneId === 1 ? '#ffcc99' : toneId === 2 ? '#e2a65d' : '#8d5524'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 2. Hair styles */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Hair Style</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 1, label: 'Bob / Curly' },
                  { id: 2, label: 'Crop Cut' },
                  { id: 3, label: 'Spiky' },
                  { id: 4, label: 'Band / Bald' }
                ].map(hair => (
                  <button
                    key={hair.id}
                    type="button"
                    onClick={() => setHairStyleId(hair.id)}
                    className={`btn-retro text-[9px] py-2 text-center justify-center ${hairStyleId === hair.id ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)] shadow-[0_0_6px_rgba(0,240,255,0.2)]' : 'border-zinc-800'}`}
                  >
                    {hair.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Hair color tint */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Hair Tint Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={hairColor}
                  onChange={e => setHairColor(e.target.value)}
                  className="w-10 h-8 bg-transparent border border-[var(--border-color)] rounded cursor-pointer p-0.5"
                />
                <span className="text-xs uppercase font-mono text-[var(--accent-cyan)] font-bold">{hairColor}</span>
              </div>
            </div>

            {/* 4. Accessories */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-zinc-400 font-hud tracking-wider uppercase">Accessory Layer</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 0, label: 'None' },
                  { id: 1, label: 'Glasses' },
                  { id: 2, label: 'Headset' },
                  { id: 3, label: 'ID Badge' }
                ].map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccessoryId(acc.id)}
                    className={`btn-retro text-[9px] py-2 text-center justify-center ${accessoryId === acc.id ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)] shadow-[0_0_6px_rgba(0,240,255,0.2)]' : 'border-zinc-800'}`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </form>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-color)] bg-[rgba(25,27,44,0.6)]">
          <button type="button" onClick={onClose} className="btn-retro">
            Cancel
          </button>
          <button onClick={handleSubmit} type="button" className="btn-retro border-[var(--accent-cyan)] text-[var(--accent-cyan)] flex gap-1">
            <Check size={14} /> Save Avatar
          </button>
        </div>

      </div>
    </div>
  );
};
