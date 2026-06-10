'use client';

import { motion } from 'framer-motion';
import { Eye, Flame, Sparkles, Crown, Target, Swords, Award, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  eye: Eye,
  flame: Flame,
  sparkles: Sparkles,
  crown: Crown,
  target: Target,
  swords: Swords,
};

interface AchievementBadgeProps {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: number;
  unlockedAt: string | null;
}

const TIER_STYLES = [
  'from-zinc-600 to-zinc-800',
  'from-pitch-500 to-pitch-800',
  'from-amber-400 to-amber-700',
];

export function AchievementBadge({ name, description, icon, tier, unlockedAt }: AchievementBadgeProps) {
  const Icon = ICONS[icon] ?? Award;
  const unlocked = unlockedAt !== null;

  return (
    <motion.div
      whileHover={unlocked ? { scale: 1.05, rotate: [-1, 1, 0] } : undefined}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-opacity',
        !unlocked && 'opacity-35 grayscale',
      )}
    >
      <motion.div
        initial={unlocked ? { scale: 0, rotate: -180 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br shadow-lg',
          TIER_STYLES[tier - 1] ?? TIER_STYLES[0],
        )}
      >
        <Icon className="h-7 w-7 text-white" />
      </motion.div>
      <p className="text-sm font-bold">{name}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {unlocked && (
        <span className="text-[10px] font-medium text-primary">
          Desbloqueada {new Date(unlockedAt).toLocaleDateString('pt-BR')}
        </span>
      )}
    </motion.div>
  );
}
