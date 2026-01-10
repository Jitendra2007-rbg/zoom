
import React, { useRef, useEffect, useState } from 'react';

interface WhiteboardProps {
  isHost: boolean;
  roomId: string;
  sigChannel: any;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ isHost, roomId, sigChannel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = containerRef.current;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
      }
    };

    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 50);

    // Sync listener for participants
    if (!isHost && sigChannel) {
      const sub = sigChannel.on('broadcast', { event: 'whiteboard-draw' }, ({ payload }: any) => {
        const { x, y, type, color: strokeColor } = payload;
        const c = canvasRef.current;
        const context = c?.getContext('2d');
        if (!context) return;

        context.strokeStyle = strokeColor;
        if (type === 'start') {
          context.beginPath();
          context.moveTo(x, y);
        } else if (type === 'draw') {
          context.lineTo(x, y);
          context.stroke();
        } else if (type === 'clear') {
          context.clearRect(0, 0, c!.width, c!.height);
        }
      });
    }

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [color, isHost, sigChannel]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isHost) return;
    setIsDrawing(true);
    const coords = getCoords(e);
    if (!coords) return;
    
    drawLogic(coords.x, coords.y, 'start');
  };

  const draw = (e: any) => {
    if (!isDrawing || !isHost) return;
    const coords = getCoords(e);
    if (!coords) return;
    
    drawLogic(coords.x, coords.y, 'draw');
  };

  const endDrawing = () => {
    if (!isHost) return;
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const getCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const drawLogic = (x: number, y: number, type: 'start' | 'draw') => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.strokeStyle = color;
    if (type === 'start') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Broadcast to participants
    if (sigChannel) {
      sigChannel.send({
        type: 'broadcast',
        event: 'whiteboard-draw',
        payload: { x, y, type, color }
      });
    }
  };

  const clearCanvas = () => {
    if (!isHost) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (sigChannel) {
        sigChannel.send({
          type: 'broadcast',
          event: 'whiteboard-draw',
          payload: { type: 'clear' }
        });
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0b0f] pb-14 md:pb-0">
      <div className="h-10 md:h-12 flex items-center justify-between px-4 md:px-6 bg-[#121218] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest hidden sm:inline">Whiteboard</span>
          {isHost && (
            <div className="flex gap-2">
              {['#6366f1', '#ec4899', '#10b981', '#ffffff'].map(c => (
                <button 
                  key={c} 
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border border-white/10 transition-transform ${color === c ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
          {!isHost && <span className="text-[8px] font-bold text-slate-600 uppercase">Host View Only</span>}
        </div>
        {isHost && (
          <button 
            onClick={clearCanvas}
            className="px-3 md:px-4 py-1.5 rounded-lg text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all uppercase tracking-widest"
          >
            Clear
          </button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 relative cursor-crosshair overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-80">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseOut={endDrawing}
          onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
          onTouchMove={(e) => { e.preventDefault(); draw(e); }}
          onTouchEnd={(e) => { e.preventDefault(); endDrawing(); }}
          className={`absolute inset-0 touch-none ${!isHost ? 'pointer-events-none' : ''}`}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
