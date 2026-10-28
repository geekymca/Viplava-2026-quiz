'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Maximize2,
  Minimize2,
  QrCode,
  Wifi,
  Users,
} from 'lucide-react';
import { QuizState } from '@/lib/types';
import { soundManager } from '@/lib/soundEffects';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { resolveParticipantJoinUrl } from '@/lib/networkHelper';

const subscribeOrigin = () => () => {};
const getOriginSnapshot = () => (typeof window !== 'undefined' ? window.location.origin : '');
const getOriginServerSnapshot = () => '';

interface PresenterScreenProps {
  state: QuizState;
  isStandalone?: boolean;
}

export function PresenterScreen({ state, isStandalone = false }: PresenterScreenProps) {
  const {
    phase,
    timer,
    participants,
    rules,
    round1Questions,
    round2Sets,
    round3Questions,
    tieBreakerQuestions,
    round1State,
    round2State,
    round3State,
    tieBreakerState,
    buzzerState,
    isPaused,
    pausedMessage,
  } = state;

  const currentOrigin = React.useSyncExternalStore(subscribeOrigin, getOriginSnapshot, getOriginServerSnapshot);
  const { joinUrl, displayAddress } = resolveParticipantJoinUrl(
    currentOrigin,
    state.customHostUrl,
    state.detectedNetworkIp
  );

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullScreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Sound cues and confetti triggers on phase transitions
  useEffect(() => {
    if (phase === 'FINAL_PODIUM') {
      soundManager.playVictory();
      const end = Date.now() + 3500;
      const colors = ['#f59e0b', '#fbbf24', '#10b981', '#ec4899', '#8b5cf6'];
      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
          colors,
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } else if (phase.endsWith('_RULES')) {
      soundManager.playConch();
    }
  }, [phase]);

  // Sound cue on buzzer hit
  useEffect(() => {
    if (buzzerState.status === 'BUZZED' && buzzerState.buzzedParticipantId) {
      soundManager.playBuzzer();
    }
  }, [buzzerState.status, buzzerState.buzzedParticipantId]);

  // Helper lookups
  const getParticipantBySeat = (seat: number) => participants.find((p) => p.seatNumber === seat);
  const getParticipantById = (id: string | null) => (id ? participants.find((p) => p.id === id) : null);

  const sortedParticipants = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  // Clean Rules Screen renderer
  const renderRulesScreen = (title: string, subtitle: string, ruleText: string, icon: string) => {
    const lines = ruleText.split('\n').filter((l) => l.trim().length > 0);
    return (
      <div className="max-w-4xl mx-auto my-auto p-6 animate-fadeIn">
        <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-b from-[#1b112d] via-[#120a1f] to-[#0a0512] border-2 border-amber-500/40 shadow-2xl text-center">
          <div className="text-5xl mb-3">{icon}</div>
          <h2 className="text-3xl md:text-5xl font-black font-cinzel text-amber-300">
            {title}
          </h2>
          <p className="text-base md:text-lg text-amber-200/80 font-medium mt-1 mb-8">
            {subtitle}
          </p>

          <div className="text-left max-w-2xl mx-auto bg-black/50 rounded-2xl p-6 border border-amber-500/30 space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-amber-400 font-bold text-lg leading-snug">❖</span>
                <span className="text-sm md:text-base text-amber-100 font-medium leading-relaxed">
                  {line.replace(/^[•\s✨⚡🔔🎯]+/, '')}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-xs text-amber-400/70 font-semibold tracking-widest uppercase">
            Viplava 2026 • Gokul Mathura Dham
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between p-4 md:p-6 bg-radial from-[#190f2e] via-[#0e071a] to-[#07030e] text-amber-50 select-none overflow-hidden">
      {/* Soft ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

      {/* TOP BAR: Clean, high-legibility projector header */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦚</span>
          <div>
            <h1 className="text-lg md:text-xl font-cinzel font-black text-amber-300 tracking-wider">
              VIPLAVA 2026 • A QUIZ ON SRILA PRABHUPADA LIFE
            </h1>
            <p className="text-xs text-amber-200/60 font-medium">
              Gokul, Mathura Dham • Youth Festival
            </p>
          </div>
        </div>

        {/* Global Timer Widget + Fullscreen Toggle */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all ${
              timer.secondsLeft <= 5 && timer.isRunning
                ? 'bg-rose-950 border-rose-500 text-rose-200 animate-pulse shadow-[0_0_25px_rgba(244,63,94,0.6)]'
                : 'bg-black/60 border-amber-500/40 text-amber-300'
            }`}
          >
            <Clock className={`w-5 h-5 ${timer.isRunning ? 'text-amber-400 animate-spin' : 'text-amber-500/70'}`} />
            <span className="font-mono text-2xl md:text-3xl font-black">
              {`${String(timer.secondsLeft).padStart(2, '0')}s`}
            </span>
          </div>

          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-xl bg-black/40 hover:bg-black/70 border border-amber-500/30 text-amber-300 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* PAUSE OVERLAY if paused */}
      {isPaused && (
        <div className="my-auto max-w-2xl mx-auto p-8 rounded-3xl bg-rose-950/95 border-2 border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.4)] text-center space-y-4 animate-fadeIn z-20">
          <div className="text-4xl">⏸️</div>
          <h2 className="text-2xl md:text-3xl font-black font-cinzel text-rose-200">
            ROUND PAUSED BY HOST
          </h2>
          <p className="text-sm md:text-base text-rose-100 font-medium">
            {pausedMessage || 'Please stand by for instructions from the Quiz Master.'}
          </p>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {!isPaused && (
        <div className="flex-1 flex flex-col justify-center py-4 z-10">
          {/* 1. LOBBY: LIVE CHECK-IN ROSTER & QR CODE */}
          {phase === 'LOBBY' && (() => {
            const claimedCount = participants.filter((p) => Boolean(p.isClaimed)).length;
            const allReady = claimedCount >= 6;

            return (
              <div className="max-w-6xl mx-auto w-full my-auto p-2 sm:p-4 animate-fadeIn space-y-6">
                {/* Header Title */}
                <div className="text-center space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>🦚 Viplava 2026</span>
                    <span>•</span>
                    <span>A Quiz on Srila Prabhupada Life</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 leading-tight">
                    Contestant Check-In &amp; Registration
                  </h2>
                  <p className="text-sm sm:text-base text-amber-200/80 max-w-xl mx-auto">
                    Scan the QR code with your smartphone, enter your name, and claim your seat.
                  </p>
                </div>

                {/* Two-Column Stage: Left = QR & Guide, Right = 6-Seat Podium Board */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left Column: QR Code + Connection Guide */}
                  <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-b from-[#1c1032] via-[#130924] to-[#0a0512] border-2 border-amber-500/40 shadow-2xl flex flex-col items-center justify-between text-center space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <QrCode className="w-4 h-4" /> Scan with Phone Camera
                      </div>
                      <div className="text-sm font-semibold text-amber-100">
                        Join as One of the 6 Contestants
                      </div>
                    </div>

                    {/* High-res Scannable QR Code */}
                    <div className="relative group">
                      <QRCodeDisplay
                        text={joinUrl}
                        size={210}
                        className="mx-auto"
                        darkColor="#0f071d"
                      />
                      <div className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-black text-[10px] uppercase shadow">
                        Live Scan
                      </div>
                    </div>

                    {/* Step-by-step short instructions */}
                    <div className="w-full text-left bg-black/40 rounded-2xl p-3.5 border border-amber-500/20 text-xs space-y-2 text-amber-200/80">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                        <span>Point camera at this QR code or navigate to Wi-Fi link below.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                        <span>Type your name on your phone.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                        <span>Pick your stage seat (1–6). Your card will glow on this screen!</span>
                      </div>
                    </div>

                    {/* Wi-Fi Direct Address */}
                    <div className="w-full text-center bg-black/50 p-2.5 rounded-xl border border-amber-500/30 space-y-1">
                      <div className="text-[10px] uppercase font-black tracking-wider text-amber-400 flex items-center justify-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5" /> Wi-Fi Network Direct Link
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-200 break-all select-all">
                        {joinUrl}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 6-Seat Visual Roster Board */}
                  <div className="lg:col-span-7 p-6 rounded-3xl bg-black/45 border-2 border-amber-500/30 shadow-2xl flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-400" />
                        <h3 className="text-base font-black font-cinzel text-amber-200">
                          Stage Seat Podiums
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold text-amber-400/80">Checked In:</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-400/40">
                          {claimedCount} / 6
                        </span>
                      </div>
                    </div>

                    {/* 6 Seat Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 flex-1">
                      {participants.map((p) => {
                        const isReady = Boolean(p.isClaimed);

                        return (
                          <div
                            key={p.id}
                            className={`relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between text-left ${
                              isReady
                                ? 'bg-gradient-to-b from-amber-950/60 via-purple-950/40 to-black/80 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                                : 'bg-black/40 border-amber-500/20 opacity-75'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-2xl">{p.avatar}</span>
                              <span
                                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                                  isReady
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-black/60 text-amber-400/70 border border-amber-500/20'
                                }`}
                              >
                                Seat {p.seatNumber}
                              </span>
                            </div>

                            <div className="mt-3">
                              <div className="text-[11px] uppercase font-bold text-amber-400/70">
                                Contestant
                              </div>
                              <div className="text-sm sm:text-base font-black truncate font-cinzel">
                                {isReady ? (
                                  <span className="text-amber-100">{p.claimedName || p.spiritualName}</span>
                                ) : (
                                  <span className="text-amber-300/40 italic">Waiting to Claim</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center gap-1.5">
                              {isReady ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                                    Ready &amp; Active
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-amber-400/50 animate-ping shrink-0" />
                                  <span className="text-[10px] font-medium text-amber-300/50 uppercase tracking-wider">
                                    Waiting to Join...
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ready Banner */}
                    <div
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        allReady
                          ? 'bg-gradient-to-r from-emerald-950/70 via-amber-950/60 to-emerald-950/70 border-emerald-400 text-emerald-200'
                          : 'bg-amber-950/20 border-amber-500/20 text-amber-300/70'
                      }`}
                    >
                      {allReady ? (
                        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-emerald-300 animate-pulse">
                          <span>🎉</span>
                          <span>All 6 Contestants Checked In! Ready for Quiz Master to Start Round 1.</span>
                        </div>
                      ) : (
                        <div className="text-xs font-medium">
                          Waiting for {6 - claimedCount} more contestant{6 - claimedCount !== 1 ? 's' : ''} to claim their seat...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2. RULES PHASES */}
          {phase === 'ROUND_1_RULES' &&
            renderRulesScreen('Round 1: Direct & Pass', 'Direct Questions (+10 pts) • Pass Allowed (+5 pts)', rules.round1, '🪷')}
          {phase === 'ROUND_2_RULES' &&
            renderRulesScreen('Round 2: Rapid Fire Blitz', '10 Questions in 60 Seconds (+10 pts each)', rules.round2, '⚡')}
          {phase === 'ROUND_3_RULES' &&
            renderRulesScreen('Round 3: Buzzer Round', 'High Stakes: +15 for Correct • -5 Penalty for Wrong!', rules.round3, '🔔')}
          {phase === 'TIE_BREAKER_RULES' &&
            renderRulesScreen('Tie Breaker: Fastest Finger', 'Speed & Accuracy Battle', rules.tieBreaker, '🎯')}

          {/* 3. ROUND 1 ACTIVE */}
          {phase === 'ROUND_1_ACTIVE' && (() => {
            const q = round1Questions[round1State.currentQuestionIndex];
            const activeSeat = round1State.targetSeat;
            const activeParticipant = getParticipantBySeat(activeSeat);
            const isRevealed = round1State.isAnswerRevealed;

            return (
              <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn">
                {/* Spotlight Header */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-amber-500/30">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{activeParticipant?.avatar}</span>
                    <div>
                      <div className="text-xs font-black uppercase text-amber-400">
                        {round1State.isPassed ? '⚡ PASSED QUESTION (+5 PTS)' : 'DIRECT QUESTION (+10 PTS)'}
                      </div>
                      <div className="text-base font-bold text-amber-100 font-cinzel">
                        Seat {activeSeat}: {activeParticipant?.claimedName || activeParticipant?.spiritualName || activeParticipant?.name || `Seat ${activeSeat}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs uppercase border border-amber-500/30">
                      Sub-Round {Math.floor(round1State.currentQuestionIndex / 6) + 1} of 3
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-black/60 text-amber-200 font-mono font-bold text-xs uppercase border border-amber-500/20">
                      Q{round1State.currentQuestionIndex + 1} of {round1Questions.length}
                    </span>
                  </div>
                </div>

                {/* Question Box */}
                <div className="p-8 md:p-10 rounded-3xl bg-gradient-to-b from-[#1b1032] to-[#0f081c] border-2 border-amber-500/40 shadow-2xl space-y-6">
                  <p className="text-2xl md:text-4xl font-cinzel font-bold text-amber-100 text-center leading-snug">
                    &ldquo;{q?.question}&rdquo;
                  </p>

                  {/* Options if available */}
                  {q?.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {q.options.map((option, idx) => {
                        const letters = ['A', 'B', 'C', 'D'];
                        const isSelected = round1State.selectedOptionIndex === idx;
                        const isCorrect = option === q.correctAnswer;

                        let style = 'bg-black/40 border-amber-500/20 text-amber-200';
                        let badge: React.ReactNode = null;

                        if (!isRevealed) {
                          if (isSelected) {
                            style = 'bg-amber-500/25 border-2 border-amber-400 ring-4 ring-amber-400/40 text-amber-50 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse';
                            badge = <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500 text-black">Seat {activeSeat} Chose</span>;
                          }
                        } else {
                          if (isSelected && isCorrect) {
                            style = 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-100 ring-4 ring-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.5)]';
                            badge = <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500 text-black">✓ CORRECT!</span>;
                          } else if (isSelected && !isCorrect) {
                            style = 'bg-rose-950/90 border-2 border-rose-500 text-rose-100 ring-4 ring-rose-500/40';
                            badge = <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-rose-600 text-white">✗ WRONG</span>;
                          } else if (isCorrect) {
                            style = 'bg-emerald-950/80 border-2 border-emerald-400 text-emerald-100';
                            badge = <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-600 text-white">✓ CORRECT ANSWER</span>;
                          }
                        }

                        return (
                          <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${style}`}>
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 bg-amber-500/20 text-amber-300">
                                {letters[idx]}
                              </span>
                              <span className="text-base font-semibold">{option}</span>
                            </div>
                            {badge}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Answer Reveal Box */}
                  {isRevealed && (
                    <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-400 text-emerald-100 space-y-1.5 animate-fadeIn">
                      <div className="text-sm font-black uppercase text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>Correct Answer: {q?.correctAnswer}</span>
                      </div>
                      {q?.explanation && <p className="text-xs text-emerald-100/90 leading-relaxed pl-7">{q.explanation}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 4. ROUND 2 ACTIVE: RAPID FIRE */}
          {phase === 'ROUND_2_ACTIVE' && (() => {
            const activeSeat = round2State.currentSeat;
            const participant = getParticipantBySeat(activeSeat);
            const currentSet = round2Sets.find((s) => s.seatNumber === activeSeat);
            const currentQ = currentSet?.questions[round2State.currentQuestionIndex];

            return (
              <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black flex items-center justify-between shadow-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{participant?.avatar}</span>
                    <div>
                      <div className="text-xs font-black uppercase">Rapid Fire Blitz</div>
                      <div className="text-xl font-black font-cinzel">
                        Seat {activeSeat}: {participant?.claimedName || participant?.spiritualName || participant?.name || `Seat ${activeSeat}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase">Rapid Score</div>
                    <div className="text-2xl font-black font-mono">+{round2State.correctCount * 10} pts</div>
                  </div>
                </div>

                {/* 10-Question Progress */}
                <div className="grid grid-cols-10 gap-1.5">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const answered = round2State.answers.find((a) => a.questionIndex === idx);
                    const isCurrent = round2State.currentQuestionIndex === idx;
                    let bg = 'bg-black/40 border-amber-500/20 text-amber-400/50';
                    if (answered) {
                      bg = answered.isCorrect ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-rose-950 text-rose-300 border-rose-500/60';
                    } else if (isCurrent) {
                      bg = 'bg-amber-500 text-black font-black border-yellow-300 animate-pulse';
                    }
                    return (
                      <div key={idx} className={`h-8 rounded-lg border flex items-center justify-center text-xs font-mono font-bold ${bg}`}>
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>

                {/* Big Question Card */}
                <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-b from-[#1b1032] to-[#0f081c] border-2 border-amber-500/40 shadow-2xl text-center space-y-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                    Question #{round2State.currentQuestionIndex + 1} of 10
                  </span>
                  <h3 className="text-2xl md:text-4xl font-cinzel font-bold text-amber-100 leading-snug">
                    {currentQ?.question || 'Waiting for next question...'}
                  </h3>

                  {currentQ?.options && currentQ.options.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 max-w-2xl mx-auto text-left">
                      {currentQ.options.map((opt, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl bg-black/50 border border-amber-500/30 text-amber-100 text-sm flex items-center gap-3 font-medium"
                        >
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center shrink-0">
                            {['A', 'B', 'C', 'D'][i]}
                          </span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 5. ROUND 3 ACTIVE: BUZZER ROUND */}
          {phase === 'ROUND_3_ACTIVE' && (() => {
            const q = round3Questions[round3State.currentQuestionIndex];
            const buzzedParticipant = getParticipantById(buzzerState.buzzedParticipantId);
            const isRevealed = round3State.isAnswerRevealed;
            const letters = ['A', 'B', 'C', 'D'];

            return (
              <div className="max-w-4xl mx-auto w-full space-y-5 animate-fadeIn">
                {/* BUZZER STATUS BANNER */}
                <div
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all shadow-xl ${
                    buzzerState.status === 'BUZZED'
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black border-yellow-200 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
                      : buzzerState.isUnlocked
                      ? 'bg-emerald-950/90 text-emerald-200 border-emerald-400 animate-pulse'
                      : 'bg-black/60 text-amber-300/80 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {buzzerState.status === 'BUZZED' ? buzzedParticipant?.avatar || '🔔' : '🔔'}
                    </span>
                    <div>
                      {buzzerState.status === 'BUZZED' ? (
                        <>
                          <div className="text-xs font-black uppercase tracking-wider text-black/80">
                            ⚡ BUZZED IN FIRST
                          </div>
                          <div className="text-lg md:text-xl font-black font-cinzel text-black">
                            Seat {buzzedParticipant?.seatNumber}: {buzzedParticipant?.claimedName || buzzedParticipant?.spiritualName || buzzedParticipant?.name || `Seat ${buzzedParticipant?.seatNumber}`}
                          </div>
                        </>
                      ) : buzzerState.isUnlocked ? (
                        <>
                          <div className="text-xs font-bold uppercase text-emerald-400">Buzzers Unlocked</div>
                          <div className="text-base font-bold text-emerald-100">Tap your mobile buzzer now!</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-semibold uppercase text-amber-400/80">Buzzer Locked</div>
                          <div className="text-sm font-medium text-amber-200">Listening to question...</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Buzzer 10s countdown clock */}
                    {buzzerState.status === 'BUZZED' && !isRevealed && (
                      <div className={`px-3.5 py-1.5 rounded-xl font-mono font-black text-sm border flex items-center gap-1.5 shadow ${
                        timer.secondsLeft <= 3
                          ? 'bg-red-600 text-white border-red-300 animate-bounce'
                          : 'bg-black text-yellow-300 border-yellow-300'
                      }`}>
                        <span>⏱️</span>
                        <span>{timer.secondsLeft}s</span>
                      </div>
                    )}

                    {/* Immediate Selection Notice if participant picked an option before reveal */}
                    {buzzerState.selectedOptionIndex !== null && !isRevealed && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-black text-amber-300 border border-yellow-300 text-xs font-black uppercase tracking-wider animate-pulse">
                        Selected: Option {letters[buzzerState.selectedOptionIndex]}
                      </div>
                    )}

                    {isRevealed && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider">
                        Answer Revealed
                      </div>
                    )}
                  </div>
                </div>

                {/* Big Question & 4 Options */}
                <div className="p-8 rounded-3xl bg-gradient-to-b from-[#1c1135] to-[#10081f] border-2 border-amber-500/40 shadow-2xl space-y-6">
                  <p className="text-2xl md:text-3xl font-cinzel font-bold text-amber-100 text-center leading-relaxed">
                    &ldquo;{q?.question}&rdquo;
                  </p>

                  {/* 4 Options Grid with Dynamic Selection & Reveal States */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    {q?.options.map((option, idx) => {
                      const isSelected = buzzerState.selectedOptionIndex === idx;
                      const isCorrect = idx === q.correctOptionIndex;

                      let cardStyle = 'bg-black/40 border-amber-500/20 text-amber-200';
                      let badgeElement: React.ReactNode = null;

                      // Phase 1: Participant Selected Option (Before Reveal)
                      if (!isRevealed) {
                        if (isSelected) {
                          cardStyle =
                            'bg-amber-500/25 border-2 border-amber-400 text-amber-50 ring-4 ring-amber-400/50 shadow-[0_0_35px_rgba(245,158,11,0.6)] animate-pulse';
                          badgeElement = (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs uppercase tracking-wider shadow">
                              <span>👉</span> Seat {buzzedParticipant?.seatNumber || ''} Selected: {letters[idx]}
                            </span>
                          );
                        }
                      } else {
                        // Phase 2: Host Revealed Answer
                        if (isSelected && isCorrect) {
                          // Winner!
                          cardStyle =
                            'bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 ring-4 ring-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.7)]';
                          badgeElement = (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow">
                              <CheckCircle2 className="w-4 h-4" /> Correct! (+15 Pts)
                            </span>
                          );
                        } else if (isSelected && !isCorrect) {
                          // Wrong!
                          cardStyle =
                            'bg-rose-950/95 border-2 border-rose-500 text-rose-100 ring-4 ring-rose-500/50 shadow-[0_0_40px_rgba(244,63,94,0.7)]';
                          badgeElement = (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs uppercase tracking-wider shadow">
                              <XCircle className="w-4 h-4" /> Wrong! (-5 Pts)
                            </span>
                          );
                        } else if (isCorrect) {
                          // The actual correct option
                          cardStyle =
                            'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.5)]';
                          badgeElement = (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow">
                              <CheckCircle2 className="w-4 h-4" /> Correct Answer
                            </span>
                          );
                        } else {
                          cardStyle = 'opacity-40 bg-black/20 border-amber-500/10 text-amber-200/50';
                        }
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${cardStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {letters[idx]}
                            </span>
                            <span className="text-base font-semibold leading-snug">{option}</span>
                          </div>
                          {badgeElement}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation card after reveal */}
                  {isRevealed && (
                    <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-400 text-emerald-100 space-y-1 animate-fadeIn">
                      <div className="text-xs font-black uppercase text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Transcendental Answer: Option {letters[q?.correctOptionIndex || 0]}</span>
                      </div>
                      {q?.explanation && (
                        <p className="text-xs text-emerald-100/90 leading-relaxed pl-6">{q.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 5. TIE BREAKER ACTIVE */}
          {phase === 'TIE_BREAKER_ACTIVE' && (() => {
            const qIndex = tieBreakerState.currentQuestionIndex;
            const q = tieBreakerQuestions[qIndex];
            const isLaunched = tieBreakerState.isQuestionLaunched;
            const tiedParticipants = participants.filter((p) => tieBreakerState.tiedParticipantIds.includes(p.id));

            return (
              <div className="max-w-4xl mx-auto w-full space-y-6 animate-fadeIn my-auto">
                {!isLaunched ? (
                  <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-b from-[#101f35] to-[#081224] border-2 border-cyan-500/40 text-center space-y-6 shadow-2xl">
                    <div className="text-5xl animate-bounce">⚡</div>
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                        Fastest Finger Speed Battle
                      </div>
                      <h2 className="text-3xl md:text-5xl font-black font-cinzel text-cyan-200">
                        Tie Breaker: Question #{qIndex + 1}
                      </h2>
                      <p className="text-base text-cyan-200/80 max-w-lg mx-auto">
                        Quiz Master is preparing the question for tied contestants. Get ready on your mobile devices!
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 max-w-xl mx-auto space-y-2">
                      <div className="text-xs font-bold text-cyan-400 uppercase">Tied Contestants in Duel:</div>
                      <div className="flex items-center justify-center gap-4 flex-wrap">
                        {tiedParticipants.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-400 text-cyan-100 text-xs font-bold">
                            <span className="text-lg">{p.avatar}</span>
                            <span>Seat {p.seatNumber}: {p.spiritualName} ({p.totalScore} pts)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-3xl bg-gradient-to-b from-[#101f35] to-[#081224] border-2 border-cyan-500/40 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-cyan-500/30">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        ⚡ Speed Tie Breaker Question #{qIndex + 1}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-cyan-500 text-black font-black text-xs uppercase animate-pulse">
                        Synchronized Speed Duel Live
                      </span>
                    </div>

                    <p className="text-2xl md:text-4xl font-cinzel font-bold text-cyan-100 text-center leading-relaxed">
                      &ldquo;{q?.question}&rdquo;
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                      {q?.options.map((opt, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-cyan-500/30 text-cyan-100 flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">
                            {['A', 'B', 'C', 'D'][idx]}
                          </span>
                          <span className="text-base font-semibold">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 6. LEADERBOARDS & FINAL PODIUM */}
          {(phase === 'ROUND_1_LEADERBOARD' || phase === 'ROUND_2_LEADERBOARD' || phase === 'ROUND_3_LEADERBOARD' || phase === 'FINAL_PODIUM') && (
            <div className="max-w-3xl mx-auto w-full space-y-5 animate-fadeIn my-auto">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>{phase === 'FINAL_PODIUM' ? 'Grand Finale Podium' : 'Current Standings'}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black font-cinzel text-amber-200">
                  {phase === 'FINAL_PODIUM' ? 'Viplava 2026 Champions' : 'Leaderboard'}
                </h2>
              </div>

              <div className="space-y-2.5">
                {sortedParticipants.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'bg-gradient-to-r from-amber-600/30 to-yellow-500/20 border-yellow-400 shadow-lg'
                        : 'bg-black/50 border-amber-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 font-black font-mono text-base text-amber-400">#{idx + 1}</span>
                      <span className="text-2xl">{p.avatar}</span>
                      <div>
                        <div className="text-sm font-bold text-amber-100">Seat {p.seatNumber}: {p.name}</div>
                        <div className="text-xs text-amber-300/70">{p.spiritualName}</div>
                      </div>
                    </div>
                    <div className="text-xl font-black font-mono text-amber-300">
                      {p.totalScore} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR: Minimalist 6-seat score cards for projector */}
      <div className="pt-3 border-t border-amber-500/20 z-10">
        <div className="grid grid-cols-6 gap-2">
          {participants.map((p) => {
            const isBuzzedNow = buzzerState.status === 'BUZZED' && buzzerState.buzzedParticipantId === p.id;
            const isRound1Active = phase === 'ROUND_1_ACTIVE' && round1State.targetSeat === p.seatNumber;
            const isRound2Active = phase === 'ROUND_2_ACTIVE' && round2State.currentSeat === p.seatNumber;

            let borderStyle = 'border-amber-500/20 bg-black/40';
            if (isBuzzedNow) {
              borderStyle = 'border-yellow-300 bg-amber-500 text-black font-black animate-pulse shadow-md';
            } else if (isRound1Active || isRound2Active) {
              borderStyle = 'border-amber-400 bg-amber-950/60 text-amber-200';
            }

            return (
              <div
                key={p.id}
                className={`p-2 rounded-xl border text-center transition-all ${borderStyle}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-base">{p.avatar}</span>
                  <span className={`text-[11px] font-bold truncate ${isBuzzedNow ? 'text-black' : 'text-amber-200'}`}>
                    {`S${p.seatNumber}`}
                  </span>
                </div>
                <div className={`text-base font-black font-mono leading-none mt-1 ${isBuzzedNow ? 'text-black' : 'text-amber-300'}`}>
                  {p.totalScore}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
