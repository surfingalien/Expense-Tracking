'use client'

import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Music,
  PawPrint,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  UtensilsCrossed,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Receipt,
  HeartPulse,
  Plane,
  GraduationCap,
  MoreHorizontal,
  Tag,
  Coffee,
  Zap,
  Home,
  Briefcase,
  Gift,
  Music,
  Dumbbell,
  Wrench,
  PawPrint,
  Baby,
  BookOpen,
  Laptop,
  Shirt,
}

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] || Tag
  return <Icon className={className} aria-hidden="true" />
}
