'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Cell {
  x: number;
  y: number;
  alpha: number;
  target: number;
  speed: number;
}

/**
 * Fundo animado de "bits" verdes em grade, imitando a matriz de LEDs
 * de um placar de estádio. Canvas + rAF, leve e com respeito a
 * prefers-reduced-motion (vira um padrão estático).
 */
export function StadiumBits({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const PITCH = 16 * dpr; // espaçamento da grade
    const DOT = 4 * dpr; // tamanho do "pixel"
    const DENSITY = 0.16; // fração de células acesas

    let cells: Cell[] = [];
    let raf = 0;
    let sweepX = 0; // onda de varredura horizontal, como refresh de painel

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      cells = [];
      for (let x = PITCH / 2; x < canvas.width; x += PITCH) {
        for (let y = PITCH / 2; y < canvas.height; y += PITCH) {
          if (Math.random() < DENSITY) {
            cells.push({
              x,
              y,
              alpha: Math.random() * 0.35,
              target: Math.random() * 0.5,
              speed: 0.01 + Math.random() * 0.04,
            });
          }
        }
      }
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sweepX = (sweepX + canvas.width / 480) % (canvas.width * 1.4);

      for (const cell of cells) {
        // flicker: persegue o alvo e sorteia um novo ao chegar
        cell.alpha += (cell.target - cell.alpha) * cell.speed * 4;
        if (Math.abs(cell.target - cell.alpha) < 0.01) {
          cell.target = Math.random() < 0.08 ? 0.85 : Math.random() * 0.45;
        }
        // brilho extra na passagem da varredura
        const distance = Math.abs(cell.x - sweepX);
        const sweepBoost = distance < PITCH * 4 ? (1 - distance / (PITCH * 4)) * 0.5 : 0;
        const alpha = Math.min(1, cell.alpha + sweepBoost);
        if (alpha < 0.03) continue;

        ctx.fillStyle = `rgba(62, 214, 124, ${alpha})`;
        ctx.fillRect(cell.x - DOT / 2, cell.y - DOT / 2, DOT, DOT);
        // halo fosforescente nos bits mais acesos
        if (alpha > 0.6) {
          ctx.fillStyle = `rgba(62, 214, 124, ${(alpha - 0.6) * 0.25})`;
          ctx.fillRect(cell.x - DOT, cell.y - DOT, DOT * 2, DOT * 2);
        }
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    if (reduced) {
      // estático: um frame só, sem varredura
      sweepX = -9999;
      draw();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}
