'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Eye,
  Unlock,
  Lock,
  Trophy,
  Volume2,
  Edit3,
  Flame,
  HelpCircle,
  FastForward,
  UserCheck,
  BookOpen,
  QrCode,
  Users,
  Wifi,
} from 'lucide-react';
import { QuizState, QuizPhase } from '@/lib/types';
import { soundManager } from '@/lib/soundEffects';
import { HostRunbookModal } from '@/components/HostRunbookModal';
import { resolveParticipantJoinUrl } from '@/lib/networkHelper';

const subscribeOrigin = () => () => {};
const getOriginSnapshot = () => (typeof window !== 'undefined' ? window.location.origin : '');
const getOriginServerSnapshot = () => '';

interface HostConsoleProps {
  state: QuizState;
  executeAction: (action: string, payload?: Record<string, unknown>) => Promise<{ success: boolean }>;
}

const PHASES_SEQUENCE: { id: QuizPhase; label: string; group: string }[] = [
  { id: 'LOBBY', label: 'Lobby', group: 'Intro' },
  { id: 'ROUND_1_RULES', label: 'R1 Rules', group: 'Round 1' },
  { id: 'ROUND_1_ACTIVE', label: 'R1 Play', group: 'Round 1' },
  { id: 'ROUND_1_LEADERBOARD', label: 'R1 Scores', group: 'Round 1' },
  { id: 'ROUND_2_RULES', label: 'R2 Rules', group: 'Round 2' },
  { id: 'ROUND_2_ACTIVE', label: 'R2 Play', group: 'Round 2' },
  { id: 'ROUND_2_LEADERBOARD', label: 'R2 Scores', group: 'Round 2' },
  { id: 'ROUND_3_RULES', label: 'R3 Rules', group: 'Round 3' },
  { id: 'ROUND_3_ACTIVE', label: 'R3 Play', group: 'Round 3' },
  { id: 'ROUND_3_LEADERBOARD', label: 'R3 Scores', group: 'Round 3' },
  { id: 'TIE_BREAKER_RULES', label: 'TB Rules', group: 'Tie Breaker' },
  { id: 'TIE_BREAKER_ACTIVE', label: 'TB Play', group: 'Tie Breaker' },
  { id: 'FINAL_PODIUM', label: 'Final Podium', group: 'Finale' },
];

export function HostConsole({ state, executeAction }: HostConsoleProps) {
  const [selectedSeatScoreEdit, setSelectedSeatScoreEdit] = useState<string>('p1');
  const [scoreDelta, setScoreDelta] = useState<number>(5);
  const [selectedRoundEdit, setSelectedRoundEdit] = useState<'round1' | 'round2' | 'round3' | 'tieBreaker'>('round1');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showRunbookModal, setShowRunbookModal] = useState(false);
  const [networkIpInput, setNetworkIpInput] = useState<string>(state.customHostUrl || state.detectedNetworkIp || '');

  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const safeExecuteAction = async (action: string, payload?: Record<string, unknown>) => {
    if (isProcessingAction) return { success: false };
    setIsProcessingAction(true);
    try {
      return await executeAction(action, payload);
    } finally {
      setTimeout(() => setIsProcessingAction(false), 350);
    }
  };

  const currentOrigin = React.useSyncExternalStore(subscribeOrigin, getOriginSnapshot, getOriginServerSnapshot);
  const resolvedJoinUrl = resolveParticipantJoinUrl(
    currentOrigin,
    state.customHostUrl,
    state.detectedNetworkIp
  );

  const {
    phase,
    timer,
    participants,
    round1Questions,
    round2Sets,
    round3Questions,
    tieBreakerQuestions,
    round1State,
    round2State,
    round3State,
    tieBreakerState,
    buzzerState,
  } = state;

  const currentPhaseIndex = PHASES_SEQUENCE.findIndex((p) => p.id === phase);

  // Timer controls
  const handleStartTimer = (seconds?: number) => {
    safeExecuteAction('set_timer', {
      secondsLeft: seconds !== undefined ? seconds : timer.secondsLeft,
      isRunning: true,
    });
  };

  const handlePauseTimer = () => {
    safeExecuteAction('set_timer', {
      secondsLeft: timer.secondsLeft,
      isRunning: false,
    });
  };

  const handleResetTimer = (seconds: number) => {
    safeExecuteAction('set_timer', {
      secondsLeft: seconds,
      isRunning: false,
    });
  };

  const handleAddTimer = (seconds: number) => {
    safeExecuteAction('set_timer', {
      secondsLeft: timer.secondsLeft + seconds,
      isRunning: timer.isRunning,
    });
  };

  // Phase navigation
  const goToPhase = (newPhase: QuizPhase) => {
    safeExecuteAction('set_phase', { phase: newPhase });
  };

  const goToNextPhase = () => {
    if (currentPhaseIndex < PHASES_SEQUENCE.length - 1) {
      goToPhase(PHASES_SEQUENCE[currentPhaseIndex + 1].id);
    }
  };

  const goToPrevPhase = () => {
    if (currentPhaseIndex > 0) {
      goToPhase(PHASES_SEQUENCE[currentPhaseIndex - 1].id);
    }
  };

  // Helper lookups
  const getParticipantBySeat = (seat: number) => participants.find((p) => p.seatNumber === seat);
  const getParticipantById = (id: string | null) => (id ? participants.find((p) => p.id === id) : null);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6 animate-fadeIn text-amber-100">
      {/* Host Master Title Bar & Stepper */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#170e28] border-2 border-amber-500/40 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-cinzel text-amber-300">
                Quiz Master Control Deck
              </h2>
              <p className="text-xs text-amber-200/70">
                Direct all 3 rounds, manage timers, lock buzzers, and award points
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pop-out Presenter in New Window */}
            <a
              href="/?view=presenter&standalone=true"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Open Presenter screen in a separate clean window for projector"
            >
              <FastForward className="w-3.5 h-3.5 text-purple-300" />
              <span>Pop-out Presenter ↗</span>
            </a>

            {/* Undo Last Score Change */}
            {state.lastScoreChange && (
              <button
                onClick={() => executeAction('undo_last_score_change')}
                className="px-3 py-1.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-black flex items-center gap-1.5 shadow animate-fadeIn"
                title={`Revert: ${state.lastScoreChange.description}`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  Undo Last ({state.lastScoreChange.delta > 0 ? `+${state.lastScoreChange.delta}` : state.lastScoreChange.delta} pts)
                </span>
              </button>
            )}

            <button
              onClick={() => setShowRunbookModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-black shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5 text-black" />
              <span>Host Runbook</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all scores to 0 and return the quiz to Lobby?')) {
                  executeAction('reset_quiz');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Reset all scores to 0 and return to Lobby"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Quiz</span>
            </button>

            <button
              onClick={() => setShowScoreModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-300" />
              <span>Score Adjuster</span>
            </button>
            <button
              onClick={goToPrevPhase}
              disabled={currentPhaseIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 disabled:opacity-30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
            >
              ← Prev Step
            </button>
            <button
              onClick={goToNextPhase}
              disabled={currentPhaseIndex === PHASES_SEQUENCE.length - 1}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-30 text-black text-xs font-black shadow transition-all flex items-center gap-1"
            >
              <span>Next Step →</span>
            </button>
          </div>
        </div>

        {/* Dedicated Pause / Resume Control Bar */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
            state.isPaused
              ? 'bg-gradient-to-r from-red-950/90 to-amber-950/90 border-red-500 text-red-200 shadow-[0_0_25px_rgba(239,68,68,0.4)]'
              : 'bg-black/40 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                state.isPaused ? 'bg-red-500 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                {state.isPaused ? '⏸️ ROUND CURRENTLY PAUSED' : 'ACTIVE ROUND LIVE'}
              </div>
              <div className="text-[11px] text-amber-300/70">
                {state.isPaused
                  ? 'All clocks & buzzers frozen. Contestants and Presenter see pause announcement.'
                  : 'Questions, timers, and buzzer submissions are operating normally.'}
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              executeAction('toggle_pause_round', { isPaused: !state.isPaused })
            }
            className={`px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all ${
              state.isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse'
                : 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200'
            }`}
          >
            {state.isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-rose-300" />}
            <span>{state.isPaused ? '▶️ Resume Round Now' : '⏸️ Stop / Pause Round'}</span>
          </button>
        </div>

        {/* Phase Stepper Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {PHASES_SEQUENCE.map((item, idx) => {
            const isCurrent = item.id === phase;
            const isPast = idx < currentPhaseIndex;
            return (
              <button
                key={item.id}
                onClick={() => goToPhase(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  isCurrent
                    ? 'bg-amber-500 text-black border-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.5)] font-bold'
                    : isPast
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                    : 'bg-black/30 text-amber-200/60 border-amber-500/20 hover:text-amber-100 hover:bg-amber-950/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Quick Timer & Soundboard Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Universal Timer Deck */}
        <div className="p-4 rounded-2xl bg-[#140c24] border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Clock</div>
            <div className="font-mono text-3xl font-black text-amber-300 bg-black/60 px-3 py-1 rounded-xl border border-amber-500/30">
              {String(timer.secondsLeft).padStart(2, '0')}s
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {timer.isRunning ? (
              <button
                onClick={handlePauseTimer}
                className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs flex items-center gap-1"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            ) : (
              <button
                onClick={() => handleStartTimer()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" /> Start
              </button>
            )}

            <button
              onClick={() => handleResetTimer(30)}
              className="p-1.5 rounded-lg bg-black/50 hover:bg-black text-amber-300 border border-amber-500/30 text-xs font-semibold"
              title="Reset to 30s"
            >
              30s
            </button>
            <button
              onClick={() => handleResetTimer(60)}
              className="p-1.5 rounded-lg bg-black/50 hover:bg-black text-amber-300 border border-amber-500/30 text-xs font-semibold"
              title="Reset to 60s"
            >
              60s
            </button>
            <button
              onClick={() => handleResetTimer(15)}
              className="p-1.5 rounded-lg bg-black/50 hover:bg-black text-amber-300 border border-amber-500/30 text-xs font-semibold"
              title="Reset to 15s"
            >
              15s
            </button>
            <button
              onClick={() => handleAddTimer(5)}
              className="px-2 py-1.5 rounded-lg bg-black/50 hover:bg-black text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> 5s
            </button>
          </div>
        </div>

        {/* Sound Effects Board */}
        <div className="p-4 rounded-2xl bg-[#140c24] border border-amber-500/30 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Volume2 className="w-4 h-4" /> Soundboard
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => soundManager.playBell()}
              className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 text-amber-300 text-xs font-semibold"
            >
              🔔 Bell
            </button>
            <button
              onClick={() => soundManager.playConch()}
              className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 text-amber-300 text-xs font-semibold"
            >
              🐚 Conch
            </button>
            <button
              onClick={() => soundManager.playBuzzer()}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-semibold"
            >
              ⚡ Buzzer
            </button>
            <button
              onClick={() => soundManager.playCorrect()}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
            >
              ✅ Correct
            </button>
            <button
              onClick={() => soundManager.playWrong()}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-semibold"
            >
              ❌ Wrong
            </button>
          </div>
        </div>
      </div>

      {/* PHASE SPECIFIC CONTROL DECKS */}

      {/* 1. LOBBY CONTROLS: LIVE CHECK-IN ROSTER */}
      {phase === 'LOBBY' && (() => {
        const claimedCount = participants.filter((p) => Boolean(p.isClaimed)).length;
        const allReady = claimedCount >= 6;

        return (
          <div className="p-6 rounded-3xl bg-[#1a1030] border-2 border-amber-500/40 text-center space-y-6">
            <div className="space-y-2">
              <div className="text-4xl">🦚</div>
              <h3 className="text-2xl font-bold font-cinzel text-amber-300">
                Stage Contestant Check-In ({claimedCount} / 6 Ready)
              </h3>
              <p className="text-sm text-amber-200/80 max-w-xl mx-auto">
                Contestants scan the QR code displayed on the Projector, enter their name, and pick Seats 1–6.
              </p>
            </div>

            {/* Wi-Fi Direct Network IP / QR URL Configuration Bar */}
            <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-200">
                    Wi-Fi Network IP for QR Code &amp; Contestant Devices
                  </div>
                  <div className="text-[11px] text-amber-300/80">
                    Live QR URL: <span className="font-mono text-amber-300 font-bold">{resolvedJoinUrl.joinUrl}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={networkIpInput}
                  onChange={(e) => setNetworkIpInput(e.target.value)}
                  placeholder="e.g. 192.168.1.15:3000"
                  className="px-3 py-1.5 rounded-xl bg-black/70 border border-amber-500/40 text-amber-100 font-mono text-xs w-full sm:w-52 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = networkIpInput.trim();
                    const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
                      ? trimmed
                      : `http://${trimmed}`;
                    executeAction('set_custom_host_url', { url: fullUrl });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
                >
                  Update QR
                </button>
              </div>
            </div>

            {/* 6 Seat Live Roster */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {participants.map((p) => {
                const isReady = Boolean(p.isClaimed);

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                      isReady
                        ? 'bg-gradient-to-b from-amber-950/60 to-black/80 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-black/40 border-amber-500/20 opacity-70'
                    }`}
                  >
                    <div>
                      <span className="text-2xl">{p.avatar}</span>
                      <div className="text-xs font-bold text-amber-300 mt-1">Seat {p.seatNumber}</div>
                      <div className="text-xs font-bold truncate mt-0.5">
                        {isReady ? (
                          <span className="text-amber-100">{p.claimedName || p.spiritualName}</span>
                        ) : (
                          <span className="text-amber-300/40 italic">Waiting...</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex flex-col items-center gap-1">
                      {isReady ? (
                        <>
                          <span className="text-[10px] font-bold text-emerald-300 uppercase">
                            ● Checked In
                          </span>
                          <button
                            type="button"
                            onClick={() => executeAction('release_seat', { seatNumber: p.seatNumber })}
                            className="text-[9px] text-amber-400/60 hover:text-amber-200 underline mt-0.5"
                            title="Release seat if assigned mistakenly"
                          >
                            Release
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-400/50 uppercase">
                          ○ Waiting...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowRunbookModal(true)}
                className="px-5 py-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-sm flex items-center gap-2 transition-all"
              >
                <BookOpen className="w-4 h-4 text-amber-300" />
                <span>Open Conductor Runbook</span>
              </button>

              <button
                type="button"
                onClick={() => soundManager.playConch()}
                className="px-4 py-3 rounded-2xl bg-black/40 hover:bg-black/60 border border-amber-500/30 text-amber-300 font-bold text-sm flex items-center gap-1.5 transition-all"
              >
                <span>🐚 Sound Conch</span>
              </button>

              <button
                type="button"
                onClick={() => executeAction('reset_check_ins')}
                className="px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 font-bold text-sm transition-all"
                title="Reset all 6 seats to unclaimed status"
              >
                Reset All Check-Ins
              </button>

              <button
                type="button"
                onClick={() => goToPhase('ROUND_1_RULES')}
                className={`px-6 py-3 rounded-2xl font-black text-sm sm:text-base shadow-xl flex items-center gap-2 transition-all ${
                  allReady
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-pulse'
                    : 'bg-amber-600 hover:bg-amber-500 text-black'
                }`}
              >
                <span>Begin Quiz: Show Round 1 Rules →</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 2. ROUND 1 CONTROLS: DIRECT & PASS */}
      {phase === 'ROUND_1_ACTIVE' && (() => {
        const qIndex = round1State.currentQuestionIndex;
        const q = round1Questions[qIndex];
        const activeParticipant = getParticipantBySeat(round1State.targetSeat);
        const originalParticipant = q ? getParticipantBySeat(q.assignedSeat) : null;

        return (
          <div className="p-6 rounded-3xl bg-[#180f2d] border-2 border-amber-500/40 space-y-6 shadow-xl">
            {/* Header & Question Selector */}
            <div className="flex flex-col gap-3 pb-4 border-b border-amber-500/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                      Round 1 • Sub-Round {Math.floor(qIndex / 6) + 1} of 3
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                      20s Direct / 10s Pass
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-cinzel text-amber-200">
                    Question #{qIndex + 1} of {round1Questions.length} (Assigned to Seat {q?.assignedSeat})
                  </h3>
                </div>

                <div className="text-xs font-mono text-amber-300/80">
                  {round1State.isPassed ? 'Passed Turn: 10s Timer' : 'Direct Turn: 20s Timer'}
                </div>
              </div>

              {/* Sub-Rounds 1, 2, 3 Question Jumpers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {[0, 1, 2].map((subRoundIdx) => {
                  const subQuestions = round1Questions.slice(subRoundIdx * 6, subRoundIdx * 6 + 6);
                  const isCurrentSubRound = Math.floor(qIndex / 6) === subRoundIdx;

                  return (
                    <div
                      key={subRoundIdx}
                      className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                        isCurrentSubRound
                          ? 'bg-amber-950/40 border-amber-400 shadow-md'
                          : 'bg-black/40 border-amber-500/20 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 uppercase">
                        <span>Sub-Round {subRoundIdx + 1} (Seats 1-6)</span>
                        {isCurrentSubRound && (
                          <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-black">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {subQuestions.map((item, localIdx) => {
                          const realIdx = subRoundIdx * 6 + localIdx;
                          return (
                            <button
                              key={item.id}
                              onClick={() => executeAction('set_round1_question', { questionIndex: realIdx })}
                              className={`py-1 rounded text-[11px] font-bold border transition-colors ${
                                realIdx === qIndex
                                  ? 'bg-amber-500 text-black border-yellow-300 font-black'
                                  : 'bg-black/60 text-amber-200/70 border-amber-500/20 hover:text-amber-100'
                              }`}
                              title={`Q${realIdx + 1} (Seat ${item.assignedSeat})`}
                            >
                              S{item.assignedSeat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Turn & Pass Status Bar */}
            <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{activeParticipant?.avatar}</div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {round1State.isPassed ? '⚠️ QUESTION PASSED TO' : 'DIRECT TURN FOR'}
                  </div>
                  <div className="text-lg font-black text-amber-100">
                    Seat {round1State.targetSeat}: {activeParticipant?.name} ({activeParticipant?.spiritualName})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                    round1State.isPassed
                      ? 'bg-amber-600 text-black border-yellow-300'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {round1State.isPassed ? 'Pass Value: +5 Points' : 'Direct Value: +10 Points'}
                </span>
              </div>
            </div>

            {/* Question Details Card */}
            <div className="p-5 rounded-2xl bg-black/40 border border-amber-500/20 space-y-3">
              <div className="text-xs text-amber-400/80 font-semibold uppercase">Question Content:</div>
              <p className="text-base sm:text-lg font-medium text-amber-100 leading-snug">
                {q?.question}
              </p>
              {q?.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => executeAction('select_round1_option', { optionIndex: i })}
                      className={`text-left text-xs p-2.5 rounded-xl border transition-all ${
                        round1State.selectedOptionIndex === i
                          ? 'ring-2 ring-amber-400 bg-amber-500/25 border-amber-300 text-amber-100 font-bold shadow'
                          : opt === q.correctAnswer
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-black/30 border-amber-500/10 text-amber-200/80 hover:border-amber-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-amber-400 mr-2">{['A', 'B', 'C', 'D'][i]}:</span>
                          <span>{opt}</span>
                        </div>
                        {round1State.selectedOptionIndex === i && (
                          <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-black shrink-0">
                            SELECTED
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="pt-2 text-xs text-emerald-300 font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Correct Answer: {q?.correctAnswer}</span>
              </div>
            </div>

            {/* Primary Action Buttons for Round 1: Unified 3-Button Deck */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Unified Check Answer Button */}
              <button
                type="button"
                onClick={async () => {
                  const res = await executeAction('check_round1_answer');
                  if (res && (res as { isCorrect?: boolean }).isCorrect) {
                    soundManager.playCorrect();
                  } else {
                    soundManager.playWrong();
                  }
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <CheckCircle className="w-5 h-5 text-white" />
                <span>
                  ✓ Check Answer {round1State.selectedOptionIndex !== null ? `(${['A','B','C','D'][round1State.selectedOptionIndex]})` : ''}
                </span>
              </button>

              {/* 2. Reveal Answer Button */}
              <button
                type="button"
                onClick={() => {
                  executeAction('reveal_round1_answer');
                }}
                className={`p-4 rounded-2xl border font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
                  round1State.isAnswerRevealed
                    ? 'bg-purple-950/40 border-purple-500/30 text-purple-300/70'
                    : 'bg-purple-900/90 hover:bg-purple-800 border-purple-400 text-purple-100 shadow-lg'
                }`}
              >
                <Eye className="w-5 h-5 text-purple-300" />
                <span>{round1State.isAnswerRevealed ? 'Answer Revealed' : 'Reveal Answer'}</span>
              </button>

              {/* Reset / Retry Question Attempt */}
              <button
                type="button"
                onClick={() => {
                  executeAction('reset_round1_question_attempt');
                }}
                className="p-4 rounded-2xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Reset this question back to original seat attempt with 30s timer"
              >
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <span>Reset Question Attempt</span>
              </button>

              {/* 3. Next Question / Finish Round */}
              <button
                type="button"
                onClick={() => {
                  const nextIdx = qIndex + 1;
                  if (nextIdx < round1Questions.length) {
                    executeAction('set_round1_question', { questionIndex: nextIdx });
                  } else {
                    goToPhase('ROUND_1_LEADERBOARD');
                  }
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <FastForward className="w-5 h-5 text-black" />
                <span>
                  {qIndex < round1Questions.length - 1 ? 'Next Question →' : 'Finish Round 1 →'}
                </span>
              </button>
            </div>

            {/* Quick Score Mistake Removal Bar for Round 1 */}
            <div className="p-3.5 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span>Score Mistake Removal for Seat {round1State.targetSeat} ({activeParticipant?.spiritualName}):</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() =>
                    executeAction('adjust_score', {
                      participantId: activeParticipant?.id,
                      round: 'round1',
                      delta: -10,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold"
                  title="Remove 10 points mistakenly awarded"
                >
                  -10 pts (Remove Direct)
                </button>
                <button
                  onClick={() =>
                    executeAction('adjust_score', {
                      participantId: activeParticipant?.id,
                      round: 'round1',
                      delta: -5,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold"
                  title="Remove 5 points mistakenly awarded"
                >
                  -5 pts (Remove Pass)
                </button>
                <button
                  onClick={() =>
                    executeAction('adjust_score', {
                      participantId: activeParticipant?.id,
                      round: 'round1',
                      delta: -1,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black border border-amber-500/30 text-amber-300 text-xs font-bold"
                >
                  -1 pt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. ROUND 2 CONTROLS: RAPID FIRE */}
      {phase === 'ROUND_2_ACTIVE' && (() => {
        const activeSeat = round2State.currentSeat;
        const currentSet = round2Sets.find((s) => s.seatNumber === activeSeat);
        const qIndex = round2State.currentQuestionIndex;
        const currentQ = currentSet?.questions[qIndex];
        const participant = getParticipantBySeat(activeSeat);

        return (
          <div className="p-6 rounded-3xl bg-[#180f2d] border-2 border-amber-500/40 space-y-6 shadow-xl">
            {/* Header & Seat Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400" /> Round 2 • Rapid Fire Blitz
                </span>
                <h3 className="text-xl font-bold font-cinzel text-amber-200">
                  Seat {activeSeat}: {participant?.spiritualName} ({round2State.currentQuestionIndex + 1}/10)
                </h3>
              </div>

              {/* Select Seat */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[1, 2, 3, 4, 5, 6].map((seat) => (
                  <button
                    key={seat}
                    onClick={() => executeAction('set_rapid_seat', { seatNumber: seat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      seat === activeSeat
                        ? 'bg-amber-500 text-black border-yellow-300'
                        : 'bg-black/40 text-amber-300/70 border-amber-500/30 hover:text-amber-100'
                    }`}
                  >
                    Seat {seat}
                  </button>
                ))}
              </div>
            </div>

            {/* Rapid Fire Progress & Timer Action */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 text-center">
                <div className="text-xs text-amber-400 font-bold uppercase">Rapid Score</div>
                <div className="text-2xl font-black font-mono text-amber-300">
                  +{round2State.correctCount * 10} pts
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 text-center">
                <div className="text-xs text-amber-400 font-bold uppercase">Correct Count</div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {round2State.correctCount} / 10
                </div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 text-center flex flex-col items-center justify-center">
                <button
                  onClick={() => handleStartTimer(60)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Start 60s Blitz Clock
                </button>
              </div>
            </div>

            {/* Active Rapid Question Prompt */}
            <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/30 space-y-2">
              <div className="text-xs font-bold text-amber-400 uppercase">
                Active Question #{qIndex + 1} of 10:
              </div>
              <p className="text-lg font-bold text-amber-100">{currentQ?.question}</p>

              {/* Render options if present */}
              {currentQ?.options && currentQ.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {currentQ.options.map((opt, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-2"
                    >
                      <span className="font-bold text-amber-400">{['A', 'B', 'C', 'D'][i]}:</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-xs text-emerald-300 font-bold">
                Answer Key: {currentQ?.answer}
              </div>
            </div>

            {/* Rapid Fire Tap Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  executeAction('record_rapid_answer', { isCorrect: true });
                  soundManager.playCorrect();
                }}
                disabled={round2State.isCompleted}
                className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-40 text-white font-black text-lg shadow-lg flex items-center justify-center gap-3 transition-all"
              >
                <CheckCircle className="w-6 h-6" />
                <span>CORRECT (+10 PTS)</span>
              </button>

              <button
                onClick={() => {
                  executeAction('record_rapid_answer', { isCorrect: false });
                  soundManager.playTick();
                }}
                disabled={round2State.isCompleted}
                className="p-5 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-950 hover:from-rose-800 hover:to-rose-900 disabled:opacity-40 text-rose-200 font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all"
              >
                <XCircle className="w-6 h-6" />
                <span>PASS / WRONG (NEXT Q)</span>
              </button>
            </div>

            {/* Switch to next participant when finished */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  if (activeSeat < 6) {
                    executeAction('set_rapid_seat', { seatNumber: activeSeat + 1 });
                  } else {
                    goToPhase('ROUND_2_LEADERBOARD');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-sm shadow transition-all"
              >
                {activeSeat < 6 ? `Next Seat (${activeSeat + 1}) →` : 'Finish Round 2 →'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 4. ROUND 3 CONTROLS: BUZZER ROUND */}
      {phase === 'ROUND_3_ACTIVE' && (() => {
        const qIndex = round3State.currentQuestionIndex;
        const q = round3Questions[qIndex];
        const buzzedParticipant = getParticipantById(buzzerState.buzzedParticipantId);

        return (
          <div className="p-6 rounded-3xl bg-[#180f2d] border-2 border-amber-500/40 space-y-6 shadow-xl">
            {/* Header & Question Jumper */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Round 3 • High-Voltage Buzzer Round
                </span>
                <h3 className="text-xl font-bold font-cinzel text-amber-200">
                  Question #{qIndex + 1} of {round3Questions.length}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {round3Questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => executeAction('set_round3_question', { questionIndex: idx })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      idx === qIndex
                        ? 'bg-amber-500 text-black border-yellow-300'
                        : 'bg-black/40 text-amber-300/70 border-amber-500/30'
                    }`}
                  >
                    B{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* BUZZER MASTER CONTROLS */}
            <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 uppercase">Buzzer State:</span>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
                    buzzerState.status === 'BUZZED'
                      ? 'bg-amber-500 text-black'
                      : buzzerState.isUnlocked
                      ? 'bg-emerald-600 text-white animate-pulse'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {buzzerState.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {buzzerState.isUnlocked ? (
                  <button
                    onClick={() => executeAction('lock_buzzer')}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Lock Buzzers</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      executeAction('unlock_buzzer');
                      soundManager.playTick();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>🔓 Unlock Buzzers</span>
                  </button>
                )}

                <button
                  onClick={() => executeAction('set_round3_question', { questionIndex: qIndex })}
                  className="px-3 py-2 rounded-xl bg-black/60 hover:bg-black text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  Reset Buzzer
                </button>
              </div>
            </div>

            {/* Buzzer Spotlight Box */}
            {buzzerState.status === 'BUZZED' && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-500 text-black space-y-3 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{buzzedParticipant?.avatar}</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-black/80">Buzzed In First</div>
                      <div className="text-xl font-black font-cinzel text-black">
                        Seat {buzzedParticipant?.seatNumber}: {buzzedParticipant?.spiritualName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 10-Second Clock Display */}
                    <div className={`px-3 py-1.5 rounded-xl font-mono font-black text-xs border flex items-center gap-1.5 shadow ${
                      timer.secondsLeft <= 3
                        ? 'bg-red-600 text-white border-red-300 animate-bounce'
                        : 'bg-black text-yellow-300 border-yellow-200'
                    }`}>
                      <span>⏱️</span>
                      <span>10s Clock: {timer.secondsLeft}s</span>
                    </div>

                    {/* Immediate contestant selection display */}
                    {buzzerState.selectedOptionIndex !== null ? (
                      <div className="px-3.5 py-1.5 rounded-xl bg-black text-amber-300 border border-yellow-200 text-xs font-black uppercase tracking-wider animate-pulse">
                        Contestant Picked: Option {['A', 'B', 'C', 'D'][buzzerState.selectedOptionIndex]}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-black/80 bg-black/10 px-3 py-1 rounded-lg">
                        Waiting for contestant option...
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {/* CHECK ANSWER BUTTON */}
                  <button
                    onClick={async () => {
                      const res = await executeAction('check_round3_answer');
                      if (res && (res as { isCorrect?: boolean }).isCorrect) {
                        soundManager.playCorrect();
                      } else {
                        soundManager.playWrong();
                      }
                    }}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 text-white" />
                    <span>✓ Check Answer (+15 / -5)</span>
                  </button>

                  {/* ONE-CLICK REVEAL & SCORE: Works when option is picked */}
                  <button
                    onClick={() => {
                      executeAction('reveal_round3_answer');
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-purple-950 text-purple-100 hover:bg-purple-900 border border-purple-400 font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Eye className="w-4 h-4 text-purple-300" />
                    <span>✨ Reveal Answer &amp; Evaluate Score</span>
                  </button>

                  <button
                    onClick={() => {
                      executeAction('mark_buzzer_answer', { isCorrect: true });
                      soundManager.playCorrect();
                    }}
                    className="py-3 px-4 rounded-xl bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-400 font-black text-xs shadow flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Correct (+15)</span>
                  </button>

                  <button
                    onClick={() => {
                      executeAction('mark_buzzer_answer', { isCorrect: false });
                      soundManager.playWrong();
                    }}
                    className="py-3 px-4 rounded-xl bg-rose-950 text-rose-200 hover:bg-rose-900 border border-rose-400 font-black text-xs shadow flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>Wrong (-5)</span>
                  </button>

                  <button
                    onClick={() => {
                      executeAction('unlock_buzzer');
                      soundManager.playTick();
                    }}
                    className="py-3 px-3 rounded-xl bg-black/60 hover:bg-black text-amber-200 text-xs font-bold"
                    title="Unlock buzzer again for other seats if wrong"
                  >
                    Re-Unlock Buzzer
                  </button>
                </div>

                {/* Direct quick undo / score correction for buzzed participant */}
                <div className="flex items-center gap-2 pt-2 border-t border-black/20 justify-end">
                  <span className="text-[11px] font-bold text-black/80 mr-1 flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-black" />
                    <span>Mistake Fix:</span>
                  </span>
                  <button
                    onClick={() =>
                      executeAction('adjust_score', {
                        participantId: buzzedParticipant?.id,
                        round: 'round3',
                        delta: -15,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-amber-200 text-xs font-bold"
                    title="Revert 15 points if awarded by mistake"
                  >
                    -15 pts (Revert +15)
                  </button>
                  <button
                    onClick={() =>
                      executeAction('adjust_score', {
                        participantId: buzzedParticipant?.id,
                        round: 'round3',
                        delta: +5,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-amber-200 text-xs font-bold"
                    title="Cancel -5 penalty if applied by mistake"
                  >
                    +5 pts (Cancel -5)
                  </button>
                </div>
              </div>
            )}

            {/* Question Details with Option Click for Verbal Answers */}
            <div className="p-5 rounded-2xl bg-black/40 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase">
                <span>Active Question &amp; Options:</span>
                <span className="text-[11px] text-amber-300/70 font-normal">
                  Host can click an option below on contestant&apos;s verbal answer:
                </span>
              </div>
              <p className="text-base font-semibold text-amber-100">{q?.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {q?.options.map((opt, i) => {
                  const isSelected = buzzerState.selectedOptionIndex === i;
                  const isCorrect = i === q.correctOptionIndex;

                  let style = 'bg-black/30 border-amber-500/10 text-amber-200/80 hover:border-amber-400';
                  if (isSelected) {
                    style = 'bg-amber-500/30 border-2 border-amber-400 text-amber-100 font-bold';
                  } else if (isCorrect && round3State.isAnswerRevealed) {
                    style = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 font-bold';
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        buzzerState.buzzedParticipantId &&
                        executeAction('select_buzzer_option', {
                          participantId: buzzerState.buzzedParticipantId,
                          optionIndex: i,
                        })
                      }
                      className={`text-xs p-3 rounded-xl border text-left flex items-center justify-between transition-all ${style}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-400">{['A', 'B', 'C', 'D'][i]}:</span>
                        <span>{opt}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500 text-black">
                          Selected
                        </span>
                      )}
                      {isCorrect && round3State.isAnswerRevealed && (
                        <span className="text-[10px] uppercase font-bold text-emerald-400">
                          Key ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    executeAction('reveal_round3_answer');
                    soundManager.playBell();
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span>Reveal Answer</span>
                </button>

                <button
                  onClick={() => {
                    executeAction('reset_round3_question_attempt');
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5"
                  title="Reset buzzer and option selection for this question"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Reset Buzzer / Re-ask</span>
                </button>
              </div>

              <button
                onClick={() => {
                  const nextIdx = qIndex + 1;
                  if (nextIdx < round3Questions.length) {
                    executeAction('set_round3_question', { questionIndex: nextIdx });
                  } else {
                    goToPhase('ROUND_3_LEADERBOARD');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs shadow"
              >
                {qIndex < round3Questions.length - 1 ? 'Next Buzzer Question →' : 'Finish Round 3 →'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 5. TIE BREAKER CONTROLS */}
      {phase === 'TIE_BREAKER_ACTIVE' && (() => {
        const qIndex = tieBreakerState.currentQuestionIndex;
        const currentQ = tieBreakerQuestions[qIndex];

        return (
          <div className="p-6 rounded-3xl bg-[#180f2d] border-2 border-cyan-500/40 space-y-6 shadow-xl">
            {/* Header & Question Jumper (up to 3 questions) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-cyan-500/20">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                  Tie Breaker • Speed Battle
                </span>
                <h3 className="text-xl font-bold font-cinzel text-cyan-200">
                  Question #{qIndex + 1} of {Math.min(tieBreakerQuestions.length, 3)}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {[0, 1, 2].slice(0, Math.min(tieBreakerQuestions.length, 3)).map((idx) => (
                  <button
                    key={idx}
                    onClick={() => safeExecuteAction('set_tie_breaker_question', { questionIndex: idx })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      idx === qIndex
                        ? 'bg-cyan-500 text-black border-cyan-300'
                        : 'bg-black/40 text-cyan-300/70 border-cyan-500/30'
                    }`}
                  >
                    TB Q{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1: Select Tied Participants */}
            <div className="p-4 rounded-2xl bg-black/40 border border-cyan-500/30 space-y-3">
              <div className="text-xs font-bold text-cyan-400 uppercase">1. Selected Tied Participants:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {participants.map((p) => {
                  const isSelected = tieBreakerState.tiedParticipantIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        const newTied = isSelected
                          ? tieBreakerState.tiedParticipantIds.filter((id) => id !== p.id)
                          : [...tieBreakerState.tiedParticipantIds, p.id];
                        safeExecuteAction('init_tie_breaker', { tiedParticipantIds: newTied });
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-cyan-600 text-black border-cyan-300 font-bold shadow'
                          : 'bg-black/30 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-xl">{p.avatar}</div>
                      <div className="text-xs font-bold truncate">{p.spiritualName}</div>
                      <div className="text-[10px] text-cyan-200 font-mono">{p.totalScore} pts</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Details & Launch Controls */}
            <div className="p-5 rounded-2xl bg-black/50 border border-cyan-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-cyan-400 uppercase">
                  2. Question #{qIndex + 1} Preview &amp; Launch Status:
                </div>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
                    tieBreakerState.isQuestionLaunched
                      ? 'bg-emerald-500 text-black animate-pulse'
                      : 'bg-amber-500/30 border border-amber-400 text-amber-200'
                  }`}
                >
                  {tieBreakerState.isQuestionLaunched ? '🚀 QUESTION LIVE ON TIED DEVICES' : '⏳ WAITING TO LAUNCH'}
                </span>
              </div>

              <p className="text-lg font-bold text-cyan-100">{currentQ?.question}</p>

              {currentQ?.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentQ.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        i === currentQ.correctOptionIndex
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold'
                          : 'bg-black/40 border-cyan-500/20 text-cyan-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-400">{['A', 'B', 'C', 'D'][i]}:</span>
                        <span>{opt}</span>
                      </div>
                      {i === currentQ.correctOptionIndex && (
                        <span className="text-[10px] bg-emerald-500 text-black px-1.5 py-0.5 rounded font-black">
                          CORRECT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Launch Question Button */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => safeExecuteAction('launch_tie_breaker_question')}
                  disabled={Boolean(tieBreakerState.isQuestionLaunched)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 text-black font-black text-sm shadow-xl flex items-center gap-2 transition-all active:scale-95"
                >
                  <span>🚀 Launch Question #{qIndex + 1} to Tied Devices</span>
                </button>

                {qIndex < 2 && (
                  <button
                    onClick={() => safeExecuteAction('set_tie_breaker_question', { questionIndex: qIndex + 1 })}
                    className="px-4 py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold"
                  >
                    Next Tie Question (#{qIndex + 2}) →
                  </button>
                )}
              </div>

              {/* Live Submissions Tracker for Host */}
              <div className="p-4 rounded-2xl bg-black/40 border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-cyan-400 uppercase">
                    3. Live Tied Submissions Received ({Object.keys(tieBreakerState.submissions).length} / {tieBreakerState.tiedParticipantIds.length || participants.length})
                  </div>
                  {tieBreakerState.isCompleted && (
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-black uppercase">
                      Winner Determined!
                    </span>
                  )}
                </div>

                {Object.keys(tieBreakerState.submissions).length === 0 ? (
                  <div className="text-xs text-cyan-200/50 italic py-2">
                    Waiting for tied contestants to submit their answers on mobile...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(tieBreakerState.submissions).map((sub) => {
                      const participantObj = participants.find((p) => p.id === sub.participantId);
                      const isWinner = tieBreakerState.winnerParticipantId === sub.participantId;

                      return (
                        <div
                          key={sub.participantId}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            isWinner
                              ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/20 border-yellow-300 text-yellow-100 font-bold shadow'
                              : sub.isCorrect
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{participantObj?.avatar || '👤'}</span>
                            <span className="font-bold">
                              Seat {participantObj?.seatNumber}: {participantObj?.spiritualName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded">
                              {(sub.timeTakenMs / 1000).toFixed(2)}s
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              sub.isCorrect ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                            }`}>
                              Opt {['A', 'B', 'C', 'D'][sub.selectedOptionIndex]} {sub.isCorrect ? '✓' : '✗'}
                            </span>
                            {isWinner && (
                              <span className="text-[10px] font-black bg-yellow-400 text-black px-1.5 py-0.5 rounded">
                                👑 WINNER (+10)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => goToPhase('FINAL_PODIUM')}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-black font-extrabold text-sm shadow"
              >
                Proceed to Grand Podium Ceremony →
              </button>
            </div>
          </div>
        );
      })()}

      {/* 6. LEADERBOARD & PODIUM DIRECT ACTIONS */}
      {(phase.endsWith('_LEADERBOARD') || phase === 'FINAL_PODIUM') && (() => {
        const sortedForTie = [...participants].sort((a, b) => b.totalScore - a.totalScore);
        const hasTieInTop3 =
          (sortedForTie.length >= 2 && sortedForTie[0].totalScore === sortedForTie[1].totalScore) ||
          (sortedForTie.length >= 3 && sortedForTie[1].totalScore === sortedForTie[2].totalScore);

        const tiedIds = sortedForTie
          .filter((p, idx, arr) => {
            if (idx < 3) {
              return arr.some((other, oIdx) => oIdx < 3 && oIdx !== idx && other.totalScore === p.totalScore);
            }
            return false;
          })
          .map((p) => p.id);

        return (
          <div className="p-6 rounded-3xl bg-[#180f2d] border border-amber-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-amber-400">Phase Overview</div>
                <div className="text-lg font-bold text-amber-100">
                  {phase === 'FINAL_PODIUM' ? 'Grand Final Podium Display Active' : 'Round Leaderboard Display Active'}
                </div>
              </div>

              {/* Special Tie Detection Guidance after Round 3 Leaderboard */}
              {phase === 'ROUND_3_LEADERBOARD' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {hasTieInTop3 ? (
                    <>
                      <button
                        onClick={() => {
                          safeExecuteAction('init_tie_breaker', { tiedParticipantIds: tiedIds });
                          goToPhase('TIE_BREAKER_RULES');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-black text-xs shadow animate-bounce"
                      >
                        ⚡ Launch Optional Tie-Breaker →
                      </button>
                      <button
                        onClick={() => goToPhase('FINAL_PODIUM')}
                        className="px-4 py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-bold"
                      >
                        Skip to Final Podium →
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => goToPhase('FINAL_PODIUM')}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-black font-extrabold text-xs shadow"
                    >
                      Proceed to Final Podium →
                    </button>
                  )}
                </div>
              )}

              {phase !== 'ROUND_3_LEADERBOARD' && (
                <button
                  onClick={goToNextPhase}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 text-black font-bold text-sm shadow"
                >
                  Advance to Next Phase →
                </button>
              )}
            </div>

            {phase === 'ROUND_3_LEADERBOARD' && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold ${hasTieInTop3 ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'}`}>
                {hasTieInTop3
                  ? '⚠️ Tie detected in top 3 positions! Click "Launch Optional Tie-Breaker" above to break the tie, or "Skip to Final Podium" if not needed.'
                  : '✓ Clear top 3 rank order. No Tie-Breaker needed! Proceed directly to Final Podium.'}
              </div>
            )}
          </div>
        );
      })()}

      {/* MANUAL SCORE EDIT MODAL */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#180f2d] border-2 border-amber-500/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <h3 className="font-bold font-cinzel text-amber-300 text-lg">Manual Score Adjustment</h3>
              <button onClick={() => setShowScoreModal(false)} className="text-amber-400/80 hover:text-amber-200">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-amber-400 uppercase">Participant</label>
                <select
                  value={selectedSeatScoreEdit}
                  onChange={(e) => setSelectedSeatScoreEdit(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg bg-black/50 border border-amber-500/30 text-amber-200 text-sm"
                >
                  {participants.map((p) => {
                    const nameStr = p.claimedName || p.spiritualName || p.name;
                    return (
                      <option key={p.id} value={p.id}>
                        Seat {p.seatNumber}: {nameStr} — {p.totalScore} pts
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-amber-400 uppercase">Round</label>
                <select
                  value={selectedRoundEdit}
                  onChange={(e) =>
                    setSelectedRoundEdit(e.target.value as 'round1' | 'round2' | 'round3' | 'tieBreaker')
                  }
                  className="w-full mt-1 p-2 rounded-lg bg-black/50 border border-amber-500/30 text-amber-200 text-sm"
                >
                  <option value="round1">Round 1 (Direct & Pass)</option>
                  <option value="round2">Round 2 (Rapid Fire)</option>
                  <option value="round3">Round 3 (Buzzer)</option>
                  <option value="tieBreaker">Tie Breaker</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="text-[11px] font-bold text-amber-400 uppercase">
                  Quick Score Correction (Add or Remove)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mt-1.5">
                  {[-15, -10, -5, -1, +1, +5, +10, +15].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => {
                        executeAction('adjust_score', {
                          participantId: selectedSeatScoreEdit,
                          round: selectedRoundEdit,
                          delta: amt,
                        });
                      }}
                      className={`py-2 rounded-lg font-bold text-xs border transition-colors ${
                        amt > 0
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                          : 'bg-rose-950/70 border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                      }`}
                    >
                      {amt > 0 ? `+${amt}` : amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/20">
                <label className="text-[11px] font-bold text-amber-300 uppercase">
                  Custom Adjustment Amount
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={scoreDelta}
                    onChange={(e) => setScoreDelta(Number(e.target.value))}
                    className="flex-1 p-2 rounded-lg bg-black/60 border border-amber-500/30 text-amber-100 text-sm font-mono text-center"
                    placeholder="Points (e.g. 5)"
                  />
                  <button
                    onClick={() => {
                      executeAction('adjust_score', {
                        participantId: selectedSeatScoreEdit,
                        round: selectedRoundEdit,
                        delta: -Math.abs(scoreDelta),
                      });
                    }}
                    className="px-3 py-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold text-xs"
                  >
                    Deduct Points (-)
                  </button>
                  <button
                    onClick={() => {
                      executeAction('adjust_score', {
                        participantId: selectedSeatScoreEdit,
                        round: selectedRoundEdit,
                        delta: Math.abs(scoreDelta),
                      });
                    }}
                    className="px-3 py-2 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs"
                  >
                    Add Points (+)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-amber-500/20 flex justify-end">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Stage Runbook Modal */}
      <HostRunbookModal
        isOpen={showRunbookModal}
        onClose={() => setShowRunbookModal(false)}
        state={state}
        onSetPhase={(newPhase) => goToPhase(newPhase)}
      />
    </div>
  );
}
