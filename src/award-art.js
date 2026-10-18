/* Значки наград — общие для профиля, лавки и церемоний (src/learn-celebrate.jsx): значок печати
   по её icon и рисунок марки месяца (значок, цвет и сокращение месяца). */
import {
  Footprints, Check, Flame, Landmark, Shapes, GraduationCap, ScrollText, ShoppingBag, Shirt, Sunrise, Moon, PiggyBank, CalendarDays, Gem, Flag,
  Snowflake, Heart, Flower2, Umbrella, Sprout, Sun, Waves, Wheat, BookOpen, Leaf, CloudRain, TreePine,
} from 'lucide-react';

export const ACH_ICON = { footprints: Footprints, check: Check, flame: Flame, landmark: Landmark, shapes: Shapes, graduation: GraduationCap, scroll: ScrollText, shopping: ShoppingBag, shirt: Shirt, sunrise: Sunrise, moon: Moon, piggy: PiggyBank, calendar: CalendarDays, gem: Gem, flag: Flag };
export const MONTH_ART = [
  [Snowflake, '#2F6E9E'], [Heart, '#A33A5E'], [Flower2, '#8A4FA0'], [Umbrella, '#2E6B8A'], [Sprout, '#4B7A1E'], [Sun, '#C27A12'],
  [Waves, '#1F7A8C'], [Wheat, '#A5701A'], [BookOpen, '#8A5A2B'], [Leaf, '#B4531A'], [CloudRain, '#5A6E8C'], [TreePine, '#2E6B4A'],
];
export const MONTH_ABBR = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
