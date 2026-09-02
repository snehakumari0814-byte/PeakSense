import {
  LayoutDashboard,
  Map,
  TrendingUp,
  ShieldAlert,
  FlaskConical,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Mumbai Digital Twin", href: "/digital-twin", icon: Map },
  { label: "Forecast", href: "/forecast", icon: TrendingUp },
  { label: "Peak Prevention", href: "/peak-prevention", icon: ShieldAlert },
  { label: "What-If Simulator", href: "/simulator", icon: FlaskConical },
  { label: "Model Intelligence", href: "/model-intelligence", icon: BrainCircuit },
];
