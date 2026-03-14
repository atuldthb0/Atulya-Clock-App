/**
 * Atulya Clock — React Native (Expo)
 * Copyright (C) 2025 Tboc. <https://tboc.work>
 * GNU Affero General Public License v3.0
 *
 * Install dependencies:
 *   npx expo install react-native-svg
 *   npx expo install @react-native-async-storage/async-storage
 *   npx expo install @react-native-picker/picker
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Svg,
  Circle,
  Line,
  Path,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { Picker } from "@react-native-picker/picker";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Timezone { label: string; offset: number; }
interface Point    { x: number; y: number; }

interface HandProps {
  cx: number; cy: number;
  angle: number; length: number;
  tailLength?: number;
  width: number; color: string;
}

// ─── AsyncStorage helpers ─────────────────────────────────────────────────────
const LS_BIRTH_KEY = "atulya_birth_year";
const LS_TZ_KEY    = "atulya_tz_offset";

async function asGet(key: string, fallback: number): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return isNaN(parsed) ? fallback : parsed;
  } catch { return fallback; }
}

async function asSet(key: string, value: number): Promise<void> {
  try { await AsyncStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
function polarToXY(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startDeg: number, endDeg: number,
  gapDeg = 0.8,
): string {
  const s = startDeg + gapDeg / 2;
  const e = endDeg   - gapDeg / 2;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const large = (e - s + 360) % 360 > 180 ? 1 : 0;
  const cos = Math.cos, sin = Math.sin;
  const sr = toRad(s), er = toRad(e);
  return [
    `M${cx + outerR * cos(sr)} ${cy + outerR * sin(sr)}`,
    `A${outerR} ${outerR} 0 ${large} 1 ${cx + outerR * cos(er)} ${cy + outerR * sin(er)}`,
    `L${cx + innerR * cos(er)} ${cy + innerR * sin(er)}`,
    `A${innerR} ${innerR} 0 ${large} 0 ${cx + innerR * cos(sr)} ${cy + innerR * sin(sr)}`,
    `Z`,
  ].join(" ");
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

// ─── Static data ──────────────────────────────────────────────────────────────
const TIMEZONES: Timezone[] = [
  { label: "UTC+0 (London)",                 offset:    0 },
  { label: "UTC+1 (Paris/Berlin)",            offset:   60 },
  { label: "UTC+2 (Cairo/Athens)",            offset:  120 },
  { label: "UTC+3 (Moscow/Riyadh)",           offset:  180 },
  { label: "UTC+3:30 (Tehran)",               offset:  210 },
  { label: "UTC+4 (Dubai/Baku)",              offset:  240 },
  { label: "UTC+4:30 (Kabul)",                offset:  270 },
  { label: "UTC+5 (Karachi)",                 offset:  300 },
  { label: "UTC+5:30 (IST — Kolkata/Mumbai)", offset:  330 },
  { label: "UTC+5:45 (Nepal)",                offset:  345 },
  { label: "UTC+6 (Dhaka)",                   offset:  360 },
  { label: "UTC+6:30 (Yangon)",               offset:  390 },
  { label: "UTC+7 (Bangkok/Jakarta)",         offset:  420 },
  { label: "UTC+8 (Beijing/Singapore)",       offset:  480 },
  { label: "UTC+9 (Tokyo/Seoul)",             offset:  540 },
  { label: "UTC+9:30 (Adelaide)",             offset:  570 },
  { label: "UTC+10 (Sydney)",                 offset:  600 },
  { label: "UTC+12 (Auckland)",               offset:  720 },
  { label: "UTC-3:30 (Newfoundland)",         offset: -210 },
  { label: "UTC-4 (Halifax/Caracas)",         offset: -240 },
  { label: "UTC-5 (EST / New York)",          offset: -300 },
  { label: "UTC-6 (CST / Chicago)",           offset: -360 },
  { label: "UTC-7 (MST / Denver)",            offset: -420 },
  { label: "UTC-8 (PST / Los Angeles)",       offset: -480 },
  { label: "UTC-9 (Alaska)",                  offset: -540 },
  { label: "UTC-10 (Hawaii)",                 offset: -600 },
];

const DAY_LONG   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_PALETTE = ["#fef9f9","#fff8f1","#fefce8","#f0fdf4","#eff6ff"];

const Q_META = [
  { bg: "#ffe4e6", active: "#e11d48", text: "#9f1239", label: "Q1" },
  { bg: "#dcfce7", active: "#16a34a", text: "#15803d", label: "Q2" },
  { bg: "#fef9c3", active: "#ca8a04", text: "#92400e", label: "Q3" },
  { bg: "#ffedd5", active: "#ea580c", text: "#9a3412", label: "Q4" },
];

const LIFE_PHASE_META = [
  { bg: "#e0f2fe", active: "#0284c7", text: "#075985", label: "0–25",  sublabel: "Youth"  },
  { bg: "#dcfce7", active: "#16a34a", text: "#14532d", label: "25–50", sublabel: "Prime"  },
  { bg: "#fef9c3", active: "#b45309", text: "#78350f", label: "50–75", sublabel: "Wisdom" },
  { bg: "#fce7f3", active: "#be185d", text: "#831843", label: "75–100",sublabel: "Legacy" },
];

const BAND_PALETTE = [
  "#f0f9ff","#ecfdf5","#fefce8","#fff7ed","#fdf4ff",
  "#f0f9ff","#ecfdf5","#fefce8","#fff7ed","#fdf4ff",
  "#f0f9ff","#ecfdf5","#fefce8","#fff7ed","#fdf4ff",
  "#f0f9ff","#ecfdf5","#fefce8","#fff7ed","#fdf4ff",
];

const SOCIAL_LINKS = [
  { id: "pixelfed",  href: "https://gram.social/tboc.work",          label: "Pixelfed"  },
  { id: "mastodon",  href: "https://mas.to/@atulyaraaj",              label: "Mastodon"  },
  { id: "codeberg",  href: "https://codeberg.org/atuld",              label: "Codeberg"  },
  { id: "instagram", href: "https://instagram.com/tboc.work",         label: "Instagram" },
  { id: "penpot",    href: "https://design.penpot.app/",              label: "Penpot"    },
  { id: "github",    href: "https://github.com/atuldthb0/atulya-clock",label: "GitHub"   },
];

// ─── SVG layout (300 × 300 viewBox) ──────────────────────────────────────────
const CX = 150, CY = 150;
const RIM_R = 147;

const LP_O  = 145.80, LP_I  = 137.18;
const LB_O  = 135.75, LB_I  = 127.13;
const LY_O  = 125.70, LY_I  = 117.80;
const CQ_O  = 116.37, CQ_I  = 107.75;
const MO_O  = 106.32, MO_I  =  97.70;
const DM_O  =  96.27, DM_I  =  88.37;
const WK_O  =  86.94, WK_I  =  79.76;
const DW_O  =  78.33, DW_I  =  69.00;

const TCK_O  = 66;
const TCK_MJ = 57;
const TCK_MN = 61;
const HR_R   = 53;
const MG_R   = 50;
const ML_R   = 46;

// ─── Hand component ───────────────────────────────────────────────────────────
function Hand({ cx, cy, angle, length, tailLength = 0, width, color }: HandProps) {
  const tip  = polarToXY(cx, cy,  length,     angle);
  const tail = polarToXY(cx, cy, -tailLength, angle);
  return (
    <Line
      x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y}
      stroke={color} strokeWidth={width} strokeLinecap="round"
    />
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const screenWidth = Dimensions.get("window").width;
  const clockSize   = Math.min(screenWidth - 32, 380);

  const [tzOffset,  setTzOffsetState]  = useState<number>(330);
  const [birthYear, setBirthYearState] = useState<number>(1990);
  const [utcMs,     setUtcMs]          = useState<number>(() => Date.now());
  const [loaded,    setLoaded]          = useState<boolean>(false);
  const [pickerOpen, setPickerOpen]    = useState<boolean>(false);

  // Load persisted values on mount
  useEffect(() => {
    (async () => {
      const [savedTz, savedBirth] = await Promise.all([
        asGet(LS_TZ_KEY, 330),
        asGet(LS_BIRTH_KEY, 1990),
      ]);
      setTzOffsetState(savedTz);
      setBirthYearState(savedBirth);
      setLoaded(true);
    })();
  }, []);

  // Tick
  useEffect(() => {
    const id = setInterval(() => setUtcMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const setTzOffset = useCallback((val: number) => {
    setTzOffsetState(val);
    asSet(LS_TZ_KEY, val);
  }, []);

  const setBirthYear = useCallback((val: number | ((p: number) => number)) => {
    setBirthYearState(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      asSet(LS_BIRTH_KEY, next);
      return next;
    });
  }, []);

  // ── Time ──
  const localMs  = utcMs + tzOffset * 60 * 1000;
  const d        = new Date(localMs);
  const h        = d.getUTCHours();
  const m        = d.getUTCMinutes();
  const s        = d.getUTCSeconds();
  const dowToday = d.getUTCDay();
  const domToday = d.getUTCDate();
  const monthIdx = d.getUTCMonth();
  const calYear  = d.getUTCFullYear();

  // ── Life math ──
  const currentAge    = Math.max(0, Math.min(99, calYear - birthYear));
  const lifePhaseIdx  = Math.floor(currentAge / 25);
  const fiveYrBandIdx = Math.floor(currentAge / 5);

  // ── Calendar ──
  const totalDays        = new Date(Date.UTC(calYear, monthIdx + 1, 0)).getUTCDate();
  const firstDOW         = new Date(Date.UTC(calYear, monthIdx, 1)).getUTCDay();
  const totalWeeks       = Math.ceil((totalDays + firstDOW) / 7);
  const weekOfMonthToday = Math.ceil((domToday + firstDOW) / 7);
  const quarterIdx       = Math.floor(monthIdx / 3);
  const degPerDay        = 360 / totalDays;

  // ── Angles ──
  const hourAngle   = ((h + m / 60 + s / 3600) / 24) * 360;
  const minuteAngle = ((m + s / 60) / 60) * 360;
  const secondAngle = (s / 60) * 360;
  const secTail     = polarToXY(CX, CY, -14, secondAngle);

  // ── Ring data ──
  const lifePhaseSegs = LIFE_PHASE_META.map((meta, i) => {
    const sDeg = i * 90, eDeg = (i + 1) * 90;
    const mid  = polarToXY(CX, CY, (LP_O + LP_I) / 2, (sDeg + eDeg) / 2);
    return { i, sDeg, eDeg, mid, isActive: i === lifePhaseIdx, ...meta };
  });

  const lifeBandSegs = Array.from({ length: 20 }, (_, i) => {
    const sDeg = i * 18, eDeg = (i + 1) * 18;
    const mid  = polarToXY(CX, CY, (LB_O + LB_I) / 2, (sDeg + eDeg) / 2);
    return { i, startAge: i * 5, sDeg, eDeg, mid, phaseIdx: Math.floor(i / 5), isActive: i === fiveYrBandIdx };
  });

  const lifeYearSegs = Array.from({ length: 100 }, (_, i) => {
    const sDeg = i * 3.6, eDeg = (i + 1) * 3.6;
    const mid  = polarToXY(CX, CY, (LY_O + LY_I) / 2, (sDeg + eDeg) / 2);
    return { age: i, sDeg, eDeg, mid, phaseIdx: Math.floor(i / 25), isActive: i === currentAge, isBandStart: i % 5 === 0 };
  });

  const calQSegs = Q_META.map((meta, i) => {
    const sDeg = i * 90, eDeg = (i + 1) * 90;
    const mid  = polarToXY(CX, CY, (CQ_O + CQ_I) / 2, (sDeg + eDeg) / 2);
    return { i, sDeg, eDeg, mid, isActive: i === quarterIdx, ...meta };
  });

  const monthSegs = MONTH_SHORT.map((name, i) => {
    const sDeg = i * 30, eDeg = (i + 1) * 30;
    const mid  = polarToXY(CX, CY, (MO_O + MO_I) / 2, (sDeg + eDeg) / 2);
    return { name, sDeg, eDeg, mid, qIdx: Math.floor(i / 3), isCurrent: i === monthIdx };
  });

  const domSegs = Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    const sDeg = i * degPerDay, eDeg = (i + 1) * degPerDay;
    const mid  = polarToXY(CX, CY, (DM_O + DM_I) / 2, (sDeg + eDeg) / 2);
    const dow  = (firstDOW + i) % 7;
    return { day, sDeg, eDeg, mid, wkIdx: Math.ceil((day + firstDOW) / 7) - 1, isToday: day === domToday, isWeekend: dow === 0 || dow === 6 };
  });

  const wkSegs = Array.from({ length: totalWeeks }, (_, i) => {
    const fd = Math.max(1, i * 7 - firstDOW + 1), ld = Math.min(totalDays, fd + 6);
    const sDeg = (fd - 1) * degPerDay, eDeg = ld * degPerDay;
    const mid  = polarToXY(CX, CY, (WK_O + WK_I) / 2, (sDeg + eDeg) / 2);
    return { wkNum: i + 1, sDeg, eDeg, mid, isActive: i + 1 === weekOfMonthToday };
  });

  const dowSegs = DAY_SHORT.map((name, i) => {
    const sDeg = (i / 7) * 360, eDeg = ((i + 1) / 7) * 360;
    const mid  = polarToXY(CX, CY, (DW_O + DW_I) / 2, (sDeg + eDeg) / 2);
    return { name, sDeg, eDeg, mid, isActive: i === dowToday, isWeekend: i === 0 || i === 6 };
  });

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 360, isMajor = i % 5 === 0;
    return { i, isMajor, p1: polarToXY(CX, CY, TCK_O, angle), p2: polarToXY(CX, CY, isMajor ? TCK_MJ : TCK_MN, angle) };
  });

  const hourLabels = Array.from({ length: 24 }, (_, i) => ({
    i, pos: polarToXY(CX, CY, HR_R, (i / 24) * 360),
    label: i === 0 ? "24" : pad2(i), isAnchor: i === 0 || i === 12, isCurrent: i === h,
  }));

  const minLabels = Array.from({ length: 11 }, (_, i) => ({
    val: (i + 1) * 5, pos: polarToXY(CX, CY, ML_R, ((i + 1) / 12) * 360),
  }));

  const timeStr = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  const dateStr = `${DAY_LONG[dowToday]}, ${MONTH_NAMES[monthIdx]} ${domToday}, ${calYear}`;
  const lifeStr = `Age ${currentAge} · ${LIFE_PHASE_META[lifePhaseIdx].sublabel} · ${Q_META[quarterIdx].label}`;
  const weekStr = `Week ${weekOfMonthToday} of ${totalWeeks} · ${MONTH_NAMES[monthIdx]} ${calYear}`;

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Atulya...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f4f4f5" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ATULYA</Text>
        <Text style={styles.headerSubtitle}>THE INCREDIBLE TIMEPIECE</Text>
      </View>

      {/* ── Clock SVG ── */}
      <View style={[styles.clockContainer, { width: clockSize, height: clockSize }]}>
        <Svg
          width={clockSize}
          height={clockSize}
          viewBox="0 0 300 300"
        >
          <Defs>
            <RadialGradient id="rimG" cx="38%" cy="32%" r="60%">
              <Stop offset="0%"   stopColor="#e8e8e8" />
              <Stop offset="55%"  stopColor="#c4c4c4" />
              <Stop offset="100%" stopColor="#9e9e9e" />
            </RadialGradient>
            <RadialGradient id="faceG" cx="38%" cy="32%" r="60%">
              <Stop offset="0%"   stopColor="#ffffff" />
              <Stop offset="100%" stopColor="#f4f4f4" />
            </RadialGradient>
          </Defs>

          {/* Rim */}
          <Circle cx={CX} cy={CY} r={RIM_R} fill="url(#rimG)" />
          <Circle cx={CX} cy={CY} r={RIM_R - 3} fill="none" stroke="#b0b0b0" strokeWidth="0.6" />

          {/* Face */}
          <Circle cx={CX} cy={CY} r={DW_I - 1} fill="url(#faceG)" />

          {/* RING 1 — Life Phase */}
          {lifePhaseSegs.map(({ i, sDeg, eDeg, mid, isActive, bg, active, text, label, sublabel }) => {
            const lp = polarToXY(CX, CY, (LP_O + LP_I) / 2 + 0.5, (sDeg + eDeg) / 2 - 2);
            const sp = polarToXY(CX, CY, (LP_O + LP_I) / 2 - 0.5, (sDeg + eDeg) / 2 + 3);
            return (
              <React.Fragment key={`lp-${i}`}>
                <Path d={donutArc(CX, CY, LP_I, LP_O, sDeg, eDeg, 1.5)} fill={isActive ? active : bg} stroke="#d1d5db" strokeWidth="0.3" />
                <SvgText x={lp.x} y={lp.y} textAnchor="middle" alignmentBaseline="central" fontSize="3.5" fontWeight="bold" fill={isActive ? "#fff" : text}>{label}</SvgText>
                <SvgText x={sp.x} y={sp.y} textAnchor="middle" alignmentBaseline="central" fontSize="3" fill={isActive ? "rgba(255,255,255,0.85)" : text}>{sublabel}</SvgText>
              </React.Fragment>
            );
          })}

          {/* RING 2 — Life 5yr Band */}
          {lifeBandSegs.map(({ i, startAge, sDeg, eDeg, mid, phaseIdx, isActive }) => {
            const pMeta = LIFE_PHASE_META[phaseIdx];
            return (
              <React.Fragment key={`lb-${i}`}>
                <Path d={donutArc(CX, CY, LB_I, LB_O, sDeg, eDeg, 1.0)} fill={isActive ? pMeta.active : BAND_PALETTE[i % BAND_PALETTE.length]} stroke="#e5e7eb" strokeWidth="0.25" />
                <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="3" fontWeight={isActive ? "bold" : "normal"} fill={isActive ? "#fff" : pMeta.text}>{startAge}</SvgText>
              </React.Fragment>
            );
          })}

          {/* RING 3 — Life Year */}
          {lifeYearSegs.map(({ age, sDeg, eDeg, mid, phaseIdx, isActive, isBandStart }) => {
            const pMeta = LIFE_PHASE_META[phaseIdx];
            const bg = isActive ? "#dc2626" : isBandStart ? pMeta.bg : "#f8fafc";
            const fg = isActive ? "#fff"    : isBandStart ? pMeta.text : "#94a3b8";
            return (
              <React.Fragment key={`ly-${age}`}>
                <Path d={donutArc(CX, CY, LY_I, LY_O, sDeg, eDeg, 0.3)} fill={bg} stroke="#e2e8f0" strokeWidth="0.2" />
                {(age % 5 === 0 || isActive) && (
                  <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="2.8" fontWeight={isActive ? "bold" : "normal"} fill={fg}>{age}</SvgText>
                )}
              </React.Fragment>
            );
          })}

          {/* RING 4 — Calendar Quarter */}
          {calQSegs.map(({ i, sDeg, eDeg, mid, isActive, bg, active, text, label }) => (
            <React.Fragment key={`cq-${i}`}>
              <Path d={donutArc(CX, CY, CQ_I, CQ_O, sDeg, eDeg, 1.5)} fill={isActive ? active : bg} stroke="#d1d5db" strokeWidth="0.3" />
              <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="5" fontWeight="bold" fill={isActive ? "#fff" : text}>{label}</SvgText>
            </React.Fragment>
          ))}

          {/* RING 5 — Month */}
          {monthSegs.map(({ name, sDeg, eDeg, mid, qIdx, isCurrent }) => (
            <React.Fragment key={`mo-${name}`}>
              <Path d={donutArc(CX, CY, MO_I, MO_O, sDeg, eDeg, 0.8)} fill={isCurrent ? "#dc2626" : Q_META[qIdx].bg} stroke="#e5e7eb" strokeWidth="0.25" />
              <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="4.5" fontWeight={isCurrent ? "bold" : "normal"} fill={isCurrent ? "#fff" : Q_META[qIdx].text}>{name}</SvgText>
            </React.Fragment>
          ))}

          {/* RING 6 — Day of month */}
          {domSegs.map(({ day, sDeg, eDeg, mid, wkIdx, isToday, isWeekend }) => {
            const bg = isToday ? "#dc2626" : isWeekend ? "#dde3ec" : WEEK_PALETTE[wkIdx % WEEK_PALETTE.length];
            const fg = isToday ? "#fff" : isWeekend ? "#475569" : "#374151";
            return (
              <React.Fragment key={`dm-${day}`}>
                <Path d={donutArc(CX, CY, DM_I, DM_O, sDeg, eDeg, 0.5)} fill={bg} stroke="#e5e7eb" strokeWidth="0.25" />
                <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="4" fontWeight={isToday ? "bold" : "normal"} fill={fg}>{day}</SvgText>
              </React.Fragment>
            );
          })}

          {/* RING 7 — Week */}
          {wkSegs.map(({ wkNum, sDeg, eDeg, mid, isActive }) => (
            <React.Fragment key={`wk-${wkNum}`}>
              <Path d={donutArc(CX, CY, WK_I, WK_O, sDeg, eDeg, 1.0)} fill={isActive ? "#dc2626" : "#f1f5f9"} stroke="#cbd5e1" strokeWidth="0.3" />
              <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="4.5" fontWeight={isActive ? "bold" : "normal"} fill={isActive ? "#fff" : "#64748b"}>W{wkNum}</SvgText>
            </React.Fragment>
          ))}

          {/* RING 8 — Day of week */}
          {dowSegs.map(({ name, sDeg, eDeg, mid, isActive, isWeekend }) => (
            <React.Fragment key={`dw-${name}`}>
              <Path d={donutArc(CX, CY, DW_I, DW_O, sDeg, eDeg, 1.5)} fill={isActive ? "#dc2626" : isWeekend ? "#dde3ec" : "#f1f5f9"} stroke="#cbd5e1" strokeWidth="0.3" />
              <SvgText x={mid.x} y={mid.y} textAnchor="middle" alignmentBaseline="central" fontSize="6" fontWeight={isActive ? "bold" : "normal"} fill={isActive ? "#fff" : isWeekend ? "#475569" : "#374151"}>{name}</SvgText>
            </React.Fragment>
          ))}

          {/* Ticks */}
          {ticks.map(({ i, p1, p2, isMajor }) => (
            <Line key={`tk-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={isMajor ? "#2a2a2a" : "#c0c0c0"} strokeWidth={isMajor ? 1.2 : 0.5} strokeLinecap="round" />
          ))}

          {/* Hour numbers */}
          {hourLabels.map(({ i, pos, label, isAnchor, isCurrent }) => (
            <SvgText key={`hr-${i}`} x={pos.x} y={pos.y} textAnchor="middle" alignmentBaseline="central"
              fontSize={isAnchor ? 6.5 : 5} fontWeight={isAnchor || isCurrent ? "bold" : "normal"}
              fill={isAnchor || isCurrent ? "#dc2626" : "#1a1a1a"}>
              {label}
            </SvgText>
          ))}

          {/* Minute guide */}
          <Circle cx={CX} cy={CY} r={MG_R} fill="none" stroke="#e4e4e4" strokeWidth="0.3" strokeDasharray="1 2.5" />
          {minLabels.map(({ val, pos }) => (
            <SvgText key={`ml-${val}`} x={pos.x} y={pos.y} textAnchor="middle" alignmentBaseline="central" fontSize="3.8" fill="#b0b0b0">{val}</SvgText>
          ))}

          {/* Hour hand */}
          <Hand cx={CX} cy={CY} angle={hourAngle}   length={44} tailLength={8}  width={2.7} color="#dc2626" />
          {/* Minute hand */}
          <Hand cx={CX} cy={CY} angle={minuteAngle} length={60} tailLength={10} width={1.8} color="#1a1a1a" />
          {/* Second hand */}
          <Hand cx={CX} cy={CY} angle={secondAngle} length={65} tailLength={14} width={0.8} color="#dc2626" />
          <Circle cx={secTail.x} cy={secTail.y} r={2.4} fill="#dc2626" />

          {/* Centre jewel */}
          <Circle cx={CX} cy={CY} r={5.5} fill="#1a1a1a" />
          <Circle cx={CX} cy={CY} r={3.3} fill="#dc2626" />
          <Circle cx={CX} cy={CY} r={1.3} fill="#ffffff" />
        </Svg>
      </View>

      {/* ── Digital readout ── */}
      <View style={styles.readout}>
        <Text style={styles.timeText}>{timeStr}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
        <Text style={styles.lifeText}>{lifeStr}</Text>
        <Text style={styles.weekText}>{weekStr}</Text>
      </View>

      {/* ── Controls ── */}
      <View style={styles.controls}>

        {/* Birth Year */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>BIRTH YEAR</Text>
          <View style={styles.birthYearRow}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setBirthYear(y => Math.max(1900, y - 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.birthYearValue}>{birthYear}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setBirthYear(y => Math.min(calYear, y + 1))}
              activeOpacity={0.7}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.savedLabel}>saved locally ✓</Text>
        </View>

        {/* Timezone */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>TIMEZONE</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={tzOffset}
              onValueChange={(val) => setTzOffset(Number(val))}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#374151"
              
            >
              {TIMEZONES.map(tz => (
                <Picker.Item key={tz.offset} label={tz.label} value={tz.offset} />
              ))}
            </Picker>
          </View>
          <Text style={styles.savedLabel}>saved locally ✓</Text>
        </View>
      </View>

      {/* ── Legend ── */}
      <View style={styles.legend}>
        {[
          { color: "#0284c7", label: "Youth (0–25)"    },
          { color: "#16a34a", label: "Prime (25–50)"   },
          { color: "#b45309", label: "Wisdom (50–75)"  },
          { color: "#be185d", label: "Legacy (75–100)" },
          { color: "#dc2626", label: "Active now"      },
          { color: "#dde3ec", label: "Weekend",    textColor: "#475569" },
        ].map(({ color, label, textColor }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={[styles.legendLabel, textColor ? { color: textColor } : {}]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />

        {/* Brand link */}
        <TouchableOpacity
          onPress={() => Linking.openURL("https://tboc.work")}
          activeOpacity={0.7}
          style={styles.brandRow}
        >
          <Text style={styles.brandName}>Tboc.</Text>
          <Text style={styles.footerStatus}>
            Engineered with Heart{" "}
            <Text style={styles.footerActive}>— ACTIVE</Text>
          </Text>
        </TouchableOpacity>

        {/* Social links */}
        <View style={styles.socialRow}>
          {SOCIAL_LINKS.map(({ id, href, label }) => (
            <TouchableOpacity
              key={id}
              onPress={() => Linking.openURL(href)}
              activeOpacity={0.7}
              style={styles.socialBtn}
            >
              <Text style={styles.socialLabel}>{label.substring(0, 2).toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom meta */}
        <View style={styles.footerMeta}>
          <Text style={styles.footerMetaText}>ATULYA CLOCK</Text>
          <Text style={styles.footerMetaText}>© {new Date().getFullYear()} Tboc.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, backgroundColor: "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },
  loadingText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 14, color: "#71717a", letterSpacing: 4,
  },
  scrollView: {
    flex: 1, backgroundColor: "#f4f4f5",
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },

  // Header
  header: { alignItems: "center", marginBottom: 16 },
  headerTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 26, fontWeight: "900", color: "#3f3f46",
    letterSpacing: 8,
  },
  headerSubtitle: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 10, color: "#a1a1aa", letterSpacing: 5, marginTop: 2,
  },

  // Clock
  clockContainer: {
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
    elevation: 8, marginBottom: 16,
  },

  // Readout
  readout: { alignItems: "center", marginBottom: 20, gap: 2 },
  timeText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 34, fontWeight: "600", color: "#27272a",
    letterSpacing: 4,
  },
  dateText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 11, color: "#71717a", letterSpacing: 3, textTransform: "uppercase",
  },
  lifeText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 11, color: "#a1a1aa",
  },
  weekText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 11, color: "#a1a1aa",
  },

  // Controls
  controls: {
    width: "100%", maxWidth: 400,
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 16, marginBottom: 16,
  },
  controlGroup: { alignItems: "center", minWidth: 140 },
  controlLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 10, color: "#a1a1aa", letterSpacing: 4, marginBottom: 6,
  },
  birthYearRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d4d4d8",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2, elevation: 2,
  },
  stepBtnText: { fontSize: 16, fontWeight: "700", color: "#3f3f46", lineHeight: 18 },
  birthYearValue: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 16, fontWeight: "700", color: "#27272a", width: 52, textAlign: "center",
  },
  pickerWrapper: {
    backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "#d4d4d8",
    borderRadius: 8, overflow: "hidden",
    width: 220,
  },
  picker: { height: Platform.OS === "ios" ? 120 : 50, color: "#374151",   width: "100%",  },
  pickerItem: { fontSize: 11 },
  savedLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 9, color: "#d4d4d8", marginTop: 4, letterSpacing: 2,
  },

  // Legend
  legend: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 10,
    marginBottom: 24, maxWidth: 360,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 10, color: "#71717a",
  },

  // Footer
  footer: { width: "100%", maxWidth: 400, alignItems: "center", gap: 12 },
  footerDivider: { width: "100%", height: 1, backgroundColor: "#000000" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 22, fontWeight: "900", color: "#000000",
  },
  footerStatus: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 10, color: "#a1a1aa", letterSpacing: 1,
  },
  footerActive: { color: "#DC143C", fontWeight: "700" },
  socialRow: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 8,
  },
  socialBtn: {
    width: 40, height: 40,
    borderWidth: 1, borderColor: "#000000",
    backgroundColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
  },
  socialLabel: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 10, fontWeight: "700", color: "#000000",
  },
  footerMeta: {
    flexDirection: "row", justifyContent: "space-between",
    width: "100%", paddingTop: 4,
  },
  footerMetaText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 9, color: "#d4d4d8", letterSpacing: 2,
  },
});
