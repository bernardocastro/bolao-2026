import { Home, Trophy, ListChecks, Newspaper, Medal, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/pools', label: 'Bolões', icon: Trophy },
  { href: '/matches', label: 'Palpites', icon: ListChecks },
  { href: '/ranking', label: 'Ranking', icon: Medal },
  { href: '/feed', label: 'Feed', icon: Newspaper },
];
