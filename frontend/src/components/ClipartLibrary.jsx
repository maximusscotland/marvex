import React, { useState } from "react";
import {
  Sparkles, Star, Heart, Flame, Sun, Moon, Cloud, CloudRain, Snowflake,
  Zap, Lightbulb, Rocket, Telescope, Atom, FlaskConical, Brain,
  Trophy, Crown, Award, Medal, Gift, PartyPopper, Cake, Coffee, Pizza,
  Music, Headphones, Volume2, Camera, Film, Mic,
  Map, Compass, Globe, Mountain, Trees, Flower2, Leaf,
  Anchor, Ship, Plane, Car, Bike,
  Dog, Cat, Bird, Fish, Bug, Rabbit,
  Smile, Laugh, ThumbsUp, ThumbsDown, MessageCircle, Quote,
  Flag, Target, Bomb, Bell, AlarmClock, Hourglass, Clock,
  Lock, Key, Shield, Eye, Search,
  CheckCircle2, AlertCircle, Info, HelpCircle, X as XIcon,
  ArrowUp, ArrowDown, ArrowRight, ArrowLeft, ArrowUpRight, RefreshCw,
  Diamond, Hexagon, Triangle, Square, Circle, Octagon,
  // Money / commerce
  DollarSign, Euro, PoundSterling, JapaneseYen, IndianRupee, Bitcoin,
  CreditCard, Banknote, Wallet, PiggyBank, Receipt, ShoppingCart, ShoppingBag,
  TrendingUp, TrendingDown, BarChart3, LineChart, PieChart, Percent, Tag,
  // Symbols / special characters
  Hash, AtSign, Asterisk, Equal, Divide, Plus, Minus, Infinity, Pi,
  Copyright, Sigma, Slash,
  // Tech / dev
  Code, Terminal, Cpu, Database, Server, Wifi, Bluetooth, Battery,
  // People / orgs
  User, Users, Building, Briefcase, GraduationCap, Stethoscope, Hammer,
  X,
} from "lucide-react";

/**
 * Clipart registry — a curated set of fun, decorative SVG icons users can
 * drop onto the canvas as standalone "clipart" annotations. Distinct from
 * IconPicker (node icons): clipart items are free-floating, resizable, and
 * primarily decorative.
 *
 * Each entry has an optional default colour to give the canvas a vibrant,
 * non-monochrome feel right out of the box.
 */
export const CLIPART_REGISTRY = {
  // Vibe / energy
  sparkles:    { component: Sparkles,    label: "Sparkles",    color: "#ffd166" },
  star:        { component: Star,        label: "Star",        color: "#ffd166" },
  heart:       { component: Heart,       label: "Heart",       color: "#ff6ad5" },
  flame:       { component: Flame,       label: "Flame",       color: "#ff6b3d" },
  zap:         { component: Zap,         label: "Bolt",        color: "#ffec3d" },
  lightbulb:   { component: Lightbulb,   label: "Idea",        color: "#ffd166" },
  bomb:        { component: Bomb,        label: "Bomb",        color: "#ff6ad5" },
  partypopper: { component: PartyPopper, label: "Party",       color: "#ff6ad5" },
  // Sky / cosmos
  sun:         { component: Sun,         label: "Sun",         color: "#ffb547" },
  moon:        { component: Moon,        label: "Moon",        color: "#cfe0ff" },
  cloud:       { component: Cloud,       label: "Cloud",       color: "#a8d3ff" },
  rain:        { component: CloudRain,   label: "Rain",        color: "#5fb6ff" },
  snowflake:   { component: Snowflake,   label: "Snow",        color: "#a8efff" },
  rocket:      { component: Rocket,      label: "Rocket",      color: "#ff6b3d" },
  telescope:   { component: Telescope,   label: "Telescope",   color: "#8a5bff" },
  atom:        { component: Atom,        label: "Atom",        color: "#00f0ff" },
  flask:       { component: FlaskConical,label: "Lab",         color: "#3ddc84" },
  brain:       { component: Brain,       label: "Brain",       color: "#ff6ad5" },
  // Achievements
  trophy:      { component: Trophy,      label: "Trophy",      color: "#ffd166" },
  crown:       { component: Crown,       label: "Crown",       color: "#ffd166" },
  award:       { component: Award,       label: "Award",       color: "#3ddc84" },
  medal:       { component: Medal,       label: "Medal",       color: "#ffb547" },
  gift:        { component: Gift,        label: "Gift",        color: "#ff6ad5" },
  cake:        { component: Cake,        label: "Cake",        color: "#ff6ad5" },
  coffee:      { component: Coffee,      label: "Coffee",      color: "#caa472" },
  pizza:       { component: Pizza,       label: "Pizza",       color: "#ffb547" },
  // Media
  music:       { component: Music,       label: "Music",       color: "#ff6ad5" },
  headphones:  { component: Headphones,  label: "Headphones",  color: "#8a5bff" },
  volume:      { component: Volume2,     label: "Volume",      color: "#00f0ff" },
  camera:      { component: Camera,      label: "Camera",      color: "#cfe0ff" },
  film:        { component: Film,        label: "Film",        color: "#ff6b3d" },
  mic:         { component: Mic,         label: "Mic",         color: "#ff6ad5" },
  // Travel / nature
  map:         { component: Map,         label: "Map",         color: "#3ddc84" },
  compass:     { component: Compass,     label: "Compass",     color: "#00f0ff" },
  globe:       { component: Globe,       label: "Globe",       color: "#5fb6ff" },
  mountain:    { component: Mountain,    label: "Mountain",    color: "#a8d3ff" },
  trees:       { component: Trees,       label: "Trees",       color: "#3ddc84" },
  flower:      { component: Flower2,     label: "Flower",      color: "#ff6ad5" },
  leaf:        { component: Leaf,        label: "Leaf",        color: "#3ddc84" },
  anchor:      { component: Anchor,      label: "Anchor",      color: "#5fb6ff" },
  ship:        { component: Ship,        label: "Ship",        color: "#5fb6ff" },
  plane:       { component: Plane,       label: "Plane",       color: "#cfe0ff" },
  car:         { component: Car,         label: "Car",         color: "#ff6b3d" },
  bike:        { component: Bike,        label: "Bike",        color: "#ffb547" },
  // Animals
  dog:         { component: Dog,         label: "Dog",         color: "#caa472" },
  cat:         { component: Cat,         label: "Cat",         color: "#ffd166" },
  bird:        { component: Bird,        label: "Bird",        color: "#5fb6ff" },
  fish:        { component: Fish,        label: "Fish",        color: "#00f0ff" },
  bug:         { component: Bug,         label: "Bug",         color: "#3ddc84" },
  rabbit:      { component: Rabbit,      label: "Rabbit",      color: "#cfe0ff" },
  // Reactions
  smile:       { component: Smile,       label: "Smile",       color: "#ffd166" },
  laugh:       { component: Laugh,       label: "Laugh",       color: "#ffd166" },
  thumbsup:    { component: ThumbsUp,    label: "Thumbs up",   color: "#3ddc84" },
  thumbsdown:  { component: ThumbsDown,  label: "Thumbs down", color: "#ff6b3d" },
  comment:     { component: MessageCircle, label: "Comment",   color: "#00f0ff" },
  quote:       { component: Quote,       label: "Quote",       color: "#cfe0ff" },
  // Action / time
  flag:        { component: Flag,        label: "Flag",        color: "#ff6b3d" },
  target:      { component: Target,      label: "Target",      color: "#ff6ad5" },
  bell:        { component: Bell,        label: "Bell",        color: "#ffd166" },
  alarm:       { component: AlarmClock,  label: "Alarm",       color: "#ff6b3d" },
  hourglass:   { component: Hourglass,   label: "Hourglass",   color: "#ffd166" },
  clock:       { component: Clock,       label: "Clock",       color: "#cfe0ff" },
  // Security
  lock:        { component: Lock,        label: "Lock",        color: "#cfe0ff" },
  key:         { component: Key,         label: "Key",         color: "#ffd166" },
  shield:      { component: Shield,      label: "Shield",      color: "#3ddc84" },
  eye:         { component: Eye,         label: "Eye",         color: "#00f0ff" },
  search:      { component: Search,      label: "Search",      color: "#00f0ff" },
  // Status
  check:       { component: CheckCircle2,label: "Check",       color: "#3ddc84" },
  warning:     { component: AlertCircle, label: "Warning",     color: "#ffb547" },
  info:        { component: Info,        label: "Info",        color: "#5fb6ff" },
  question:    { component: HelpCircle,  label: "Question",    color: "#8a5bff" },
  // Arrows
  up:          { component: ArrowUp,     label: "Up",          color: "#3ddc84" },
  down:        { component: ArrowDown,   label: "Down",        color: "#ff6b3d" },
  left:        { component: ArrowLeft,   label: "Left",        color: "#5fb6ff" },
  right:       { component: ArrowRight,  label: "Right",       color: "#ff6ad5" },
  rising:      { component: ArrowUpRight,label: "Rising",      color: "#3ddc84" },
  refresh:     { component: RefreshCw,   label: "Refresh",     color: "#00f0ff" },
  // Shapes
  diamond:     { component: Diamond,     label: "Diamond",     color: "#00f0ff" },
  hexagon:     { component: Hexagon,     label: "Hexagon",     color: "#8a5bff" },
  triangle:    { component: Triangle,    label: "Triangle",    color: "#ffd166" },
  square:      { component: Square,      label: "Square",      color: "#cfe0ff" },
  circle:      { component: Circle,      label: "Circle",      color: "#ff6ad5" },
  octagon:     { component: Octagon,     label: "Octagon",     color: "#ff6b3d" },
  // Money / commerce
  dollar:      { component: DollarSign,    label: "Dollar",     color: "#3ddc84" },
  euro:        { component: Euro,          label: "Euro",       color: "#5fb6ff" },
  pound:       { component: PoundSterling, label: "Pound",      color: "#a78bfa" },
  yen:         { component: JapaneseYen,   label: "Yen",        color: "#ff6ad5" },
  rupee:       { component: IndianRupee,   label: "Rupee",      color: "#ff8a3d" },
  bitcoin:     { component: Bitcoin,       label: "Bitcoin",    color: "#ffb547" },
  card:        { component: CreditCard,    label: "Card",       color: "#5fb6ff" },
  banknote:    { component: Banknote,      label: "Banknote",   color: "#3ddc84" },
  wallet:      { component: Wallet,        label: "Wallet",     color: "#caa472" },
  piggy:       { component: PiggyBank,     label: "Savings",    color: "#ff6ad5" },
  receipt:     { component: Receipt,       label: "Receipt",    color: "#cfe0ff" },
  cart:        { component: ShoppingCart,  label: "Cart",       color: "#5fb6ff" },
  bag:         { component: ShoppingBag,   label: "Bag",        color: "#ff8a3d" },
  trendUp:     { component: TrendingUp,    label: "Trend up",   color: "#3ddc84" },
  trendDown:   { component: TrendingDown,  label: "Trend down", color: "#ff4f5e" },
  barChart:    { component: BarChart3,     label: "Bar chart",  color: "#5fb6ff" },
  lineChart:   { component: LineChart,     label: "Line chart", color: "#00f0ff" },
  pieChart:    { component: PieChart,      label: "Pie chart",  color: "#ffb547" },
  percent:     { component: Percent,       label: "Percent",    color: "#ffd166" },
  tag:         { component: Tag,           label: "Tag",        color: "#ff6ad5" },
  // Symbols / special characters
  hash:        { component: Hash,          label: "Hash #",     color: "#cfe0ff" },
  at:          { component: AtSign,        label: "At @",       color: "#5fb6ff" },
  asterisk:    { component: Asterisk,      label: "Asterisk",   color: "#ffd166" },
  equal:       { component: Equal,         label: "Equal =",    color: "#3ddc84" },
  divide:      { component: Divide,        label: "Divide ÷",   color: "#a78bfa" },
  plus:        { component: Plus,          label: "Plus +",     color: "#3ddc84" },
  minus:       { component: Minus,         label: "Minus −",    color: "#ff4f5e" },
  infinity:    { component: Infinity,      label: "Infinity",   color: "#00f0ff" },
  pi:          { component: Pi,            label: "Pi π",       color: "#ff6ad5" },
  sigma:       { component: Sigma,         label: "Sigma Σ",    color: "#a78bfa" },
  copyright:   { component: Copyright,     label: "Copyright",  color: "#cfe0ff" },
  slash:       { component: Slash,         label: "Slash /",    color: "#9aaad0" },
  // Flags & destinations
  flagSquare:  { component: Flag,          label: "Flag",       color: "#ff4f5e" },
  // Tech / dev
  code:        { component: Code,          label: "Code",       color: "#00f0ff" },
  terminal:    { component: Terminal,      label: "Terminal",   color: "#3ddc84" },
  cpu:         { component: Cpu,           label: "CPU",        color: "#a78bfa" },
  database:    { component: Database,      label: "Database",   color: "#5fb6ff" },
  server:      { component: Server,        label: "Server",     color: "#cfe0ff" },
  wifi:        { component: Wifi,          label: "Wi-Fi",      color: "#00f0ff" },
  bluetooth:   { component: Bluetooth,     label: "Bluetooth",  color: "#5fb6ff" },
  battery:     { component: Battery,       label: "Battery",    color: "#3ddc84" },
  // People / orgs
  user:        { component: User,          label: "User",       color: "#cfe0ff" },
  users:       { component: Users,         label: "Team",       color: "#a78bfa" },
  building:    { component: Building,      label: "Office",     color: "#9aaad0" },
  briefcase:   { component: Briefcase,     label: "Work",       color: "#caa472" },
  grad:        { component: GraduationCap, label: "Graduate",   color: "#ffd166" },
  doctor:      { component: Stethoscope,   label: "Medical",    color: "#3ddc84" },
  hammer:      { component: Hammer,        label: "Build",      color: "#ff8a3d" },
};

export const getClipart = (name) => CLIPART_REGISTRY[name] || null;

/**
 * ClipartPicker — modal grid of decorative SVG cliparts. The user picks one
 * and we drop it as a `clipart` annotation onto the centre of the canvas.
 */
export default function ClipartPicker({ onPick, onClose }) {
  const [filter, setFilter] = useState("");
  const lower = filter.trim().toLowerCase();
  const entries = Object.entries(CLIPART_REGISTRY)
    .map(([name, v]) => ({ name, ...v }))
    .filter((e) =>
      !lower ||
      e.label.toLowerCase().includes(lower) ||
      e.name.toLowerCase().includes(lower),
    );

  return (
    <div
      data-testid="mm-clipart-picker"
      className="fixed inset-0 z-[60] grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl glass-panel rounded-2xl p-6 fade-up"
        style={{ borderColor: "rgba(255,106,213,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-1">
              Clipart library
            </div>
            <h3 className="text-lg font-semibold text-white">Drop a decorative icon</h3>
            <p className="text-[12px] text-[#7a87ad] mt-1 leading-relaxed">
              Resize from the corner handles, drag to position, right-click to delete or duplicate.
            </p>
          </div>
          <button
            data-testid="mm-clipart-picker-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>
        <input
          data-testid="mm-clipart-picker-search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search clipart (rocket, flame, music, …)"
          className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-fuchsia-400/60 text-white placeholder-[#566187] mb-4"
        />
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {entries.map(({ name, component: Icon, label, color }) => (
            <button
              key={name}
              data-testid={`mm-clipart-${name}`}
              onClick={() => onPick(name, color)}
              title={label}
              className="group h-12 rounded-lg border border-white/10 bg-white/[0.02] hover:border-fuchsia-400/50 hover:bg-fuchsia-500/5 flex items-center justify-center transition-all"
              style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
            >
              <Icon size={18} style={{ color }} />
            </button>
          ))}
          {entries.length === 0 && (
            <div className="col-span-full text-center text-[#7a87ad] py-8 text-sm">
              No matches. Try a broader search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
