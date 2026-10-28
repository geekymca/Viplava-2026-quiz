'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Radio,
  Send,
} from 'lucide-react';
import { QuizState, TieBreakerQuestion, TieBreakerSubmission, Participant } from '@/lib/types';
import { soundManager } from '@/lib/soundEffects';

interface ParticipantMobileViewProps {
  state: QuizState;
  executeAction: (action: string, payload?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown }>;
  forcedSeat?: number | null;
}

const subscribeSeat = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('viplava-seat-change', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('viplava-seat-change', callback);
    window.removeEventListener('storage', callback);
  };
};

const getSeatSnapshot = () => {
  try {
    const saved = localStorage.getItem('viplava_participant_seat');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 6) return parsed;
    }
  } catch {}
  return 1;
};

const getSeatServerSnapshot = () => 1;

const subscribeClaimed = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('viplava-claimed-change', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('viplava-claimed-change', callback);
    window.removeEventListener('storage', callback);
  };
};

const getClaimedSnapshot = () => {
  try {
    return localStorage.getItem('viplava_has_claimed') === 'true';
  } catch {}
  return false;
};

const getClaimedServerSnapshot = () => false;

const getStoredNameSnapshot = () => {
  try {
    return localStorage.getItem('viplava_participant_name') || '';
  } catch {}
  return '';
};

const getStoredNameServerSnapshot = () => '';

export function ParticipantMobileView({ state, executeAction, forcedSeat }: ParticipantMobileViewProps) {
  const storedSeat = React.useSyncExternalStore(subscribeSeat, getSeatSnapshot, getSeatServerSnapshot);
  const storedHasClaimed = React.useSyncExternalStore(subscribeClaimed, getClaimedSnapshot, getClaimedServerSnapshot);
  const storedName = React.useSyncExternalStore(subscribeClaimed, getStoredNameSnapshot, getStoredNameServerSnapshot);

  const [overrideSeat, setOverrideSeat] = useState<number | null>(null);
  const selectedSeat = forcedSeat || overrideSeat || storedSeat;

  const [isEditingClaim, setIsEditingClaim] = useState(false);
  const [inputName, setInputName] = useState('');
  const [pendingSeat, setPendingSeat] = useState<number>(selectedSeat);

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
    isPaused,
    pausedMessage,
  } = state;

  const handleClaimSeat = async (seat: number, name: string) => {
    const finalName = name.trim();
    // Guard: Do not allow claiming if seat is already claimed by someone else
    const target = participants.find((p) => p.seatNumber === seat);
    if (target?.isClaimed && target.seatNumber !== selectedSeat) {
      return;
    }

    setOverrideSeat(seat);
    setPendingSeat(seat);
    try {
      localStorage.setItem('viplava_participant_seat', String(seat));
      if (finalName) {
        localStorage.setItem('viplava_participant_name', finalName);
      }
      localStorage.setItem('viplava_has_claimed', 'true');
      window.dispatchEvent(new Event('viplava-seat-change'));
      window.dispatchEvent(new Event('viplava-claimed-change'));
    } catch {
      // Safe fallback
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([60, 40, 60]);
      } catch {
        // Safe fallback
      }
    }
    soundManager.playTick();
    await executeAction('claim_seat', { seatNumber: seat, name: finalName, participantId: target?.id });
    setIsEditingClaim(false);
  };

  const handleSelectSeat = (seat: number) => {
    // If seat is claimed by another contestant, do not switch or give that seat
    const target = participants.find((p) => p.seatNumber === seat);
    if (target?.isClaimed && target.seatNumber !== selectedSeat) {
      return;
    }

    // Synchronize both top and bottom selected seat
    setOverrideSeat(seat);
    setPendingSeat(seat);
    try {
      localStorage.setItem('viplava_participant_seat', String(seat));
      window.dispatchEvent(new Event('viplava-seat-change'));
    } catch {
      // Safe fallback
    }
  };

  const participant = participants.find((p) => p.seatNumber === selectedSeat);
  const participantId = participant?.id || `p${selectedSeat}`;

  // Auto-clear local storage when host releases seat or resets check-ins/quiz
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (storedHasClaimed && participant && !participant.isClaimed) {
      try {
        localStorage.removeItem('viplava_has_claimed');
        localStorage.removeItem('viplava_participant_seat');
        localStorage.removeItem('viplava_participant_name');
        window.dispatchEvent(new Event('viplava-seat-change'));
        window.dispatchEvent(new Event('viplava-claimed-change'));
      } catch {
        // Safe fallback
      }
      setTimeout(() => {
        setOverrideSeat(null);
        setIsEditingClaim(false);
      }, 0);
    }
  }, [participant, storedHasClaimed]);

  // Buzzer action handler
  const handlePressBuzzer = async () => {
    if (!buzzerState.isUnlocked) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([80, 40, 120]);
      } catch {
        // Safe fallback
      }
    }

    soundManager.playBuzzer();
    await executeAction('press_buzzer', { participantId });
  };

  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // Option select handler for Round 3
  const handleSelectBuzzerOption = async (optionIndex: number) => {
    if (round3State.isAnswerRevealed) return;
    await executeAction('select_buzzer_option', { participantId, optionIndex });
  };

  // Option select handler for Round 1
  const handleSelectRound1Option = async (optionIndex: number) => {
    if (round1State.isAnswerRevealed) return;
    await executeAction('select_round1_option', { optionIndex });
  };

  // Check Answer Handler for Round 1
  const handleCheckRound1Answer = async () => {
    if (round1State.isAnswerRevealed || round1State.selectedOptionIndex === null) return;
    setIsSubmittingAnswer(true);
    try {
      const res = await executeAction('check_round1_answer');
      if (res && (res as { isCorrect?: boolean }).isCorrect) {
        soundManager.playCorrect();
      } else {
        soundManager.playWrong();
      }
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Check Answer Handler for Round 3
  const handleCheckRound3Answer = async () => {
    if (round3State.isAnswerRevealed || buzzerState.selectedOptionIndex === null) return;
    setIsSubmittingAnswer(true);
    try {
      const res = await executeAction('check_round3_answer');
      if (res && (res as { isCorrect?: boolean }).isCorrect) {
        soundManager.playCorrect();
      } else {
        soundManager.playWrong();
      }
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Turn status checks
  const isRound1MyTurn =
    phase === 'ROUND_1_ACTIVE' && round1State.targetSeat === selectedSeat;
  const isRound2MyTurn =
    phase === 'ROUND_2_ACTIVE' && round2State.currentSeat === selectedSeat;
  const didIBuzzFirst =
    buzzerState.buzzedParticipantId === participantId ||
    buzzerState.buzzedParticipantId === participant?.id ||
    buzzerState.buzzedParticipantId === `p${selectedSeat}`;

  return (
    <div className="max-w-md mx-auto p-3 sm:p-4 min-h-[calc(100vh-75px)] flex flex-col justify-between text-amber-50 animate-fadeIn">
      {/* 1. Header: Compact Seat & Score Card */}
      <div className="p-3 rounded-2xl bg-[#1a102f] border border-amber-500/30 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
              {participant?.avatar || '🦚'}
            </div>
            <div>
              <div className="text-[11px] font-black uppercase text-amber-400">
                Seat {selectedSeat}
              </div>
              <h3 className="text-base font-extrabold text-amber-100 font-cinzel leading-none">
                {participant?.claimedName || participant?.spiritualName || storedName || `Seat ${selectedSeat}`}
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-amber-300/70">Score</span>
            <div className="text-xl font-black font-mono text-amber-300 leading-none mt-0.5">
              {participant?.totalScore || 0} <span className="text-xs font-normal">pts</span>
            </div>
          </div>
        </div>

        {/* Quick Seat Switch Bar & Edit Name */}
        <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-amber-300/70 font-semibold uppercase flex items-center gap-1">
              <User className="w-3 h-3" /> Seat:
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((seat) => {
                const targetP = participants.find((p) => p.seatNumber === seat);
                const isSelected = seat === selectedSeat;
                const isClaimedByOther = targetP?.isClaimed && targetP?.seatNumber !== selectedSeat;
                // Disable other seats if user has already claimed a seat
                const isSeatDisabled = (storedHasClaimed || participant?.isClaimed) ? !isSelected : isClaimedByOther;

                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={isSeatDisabled}
                    onClick={() => handleSelectSeat(seat)}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-black border-yellow-200 font-black shadow'
                        : isSeatDisabled
                        ? 'bg-black/20 text-stone-600 border-stone-800 cursor-not-allowed opacity-30'
                        : 'bg-black/40 text-amber-300/60 border-amber-500/20 hover:text-amber-100 hover:border-amber-400'
                    }`}
                    title={isSelected ? `Your Seat ${seat}` : isSeatDisabled ? `Seat ${seat} locked` : `Select Seat ${seat}`}
                  >
                    {seat}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setInputName(participant?.claimedName || participant?.spiritualName || storedName || '');
              setPendingSeat(selectedSeat);
              setIsEditingClaim(true);
            }}
            className="text-[10px] text-amber-400 hover:text-amber-200 underline font-semibold transition-colors"
          >
            Edit Name
          </button>
        </div>
      </div>

      {/* CHECK-IN ONBOARDING MODAL / CARD */}
      {(!storedHasClaimed || isEditingClaim) && (
        <div className="my-auto p-5 rounded-3xl bg-gradient-to-b from-[#1c1032] via-[#140b24] to-[#0c0515] border-2 border-amber-500/50 shadow-2xl space-y-4 animate-fadeIn">
          <div className="text-center space-y-1">
            <div className="text-3xl mb-1">🦚</div>
            <h3 className="text-xl font-black font-cinzel text-amber-200">
              Contestant Check-In
            </h3>
            <p className="text-xs text-amber-200/70">
              Enter your name and pick your stage seat (Seats 1–6)
            </p>
          </div>

          {/* Name Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Your Name / Spiritual Name
            </label>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder={participant?.spiritualName || 'e.g. Arjuna Das / Radha'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-amber-500/40 text-amber-100 placeholder:text-amber-500/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Seat Picker Grid */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Select Your Stage Seat
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((seatNum) => {
                const targetParticipant = participants.find((p) => p.seatNumber === seatNum);
                const isSelected = pendingSeat === seatNum;
                const isAlreadyClaimed = targetParticipant?.isClaimed && targetParticipant?.seatNumber !== selectedSeat;

                return (
                  <button
                    key={seatNum}
                    type="button"
                    disabled={isAlreadyClaimed}
                    onClick={() => {
                      if (!isAlreadyClaimed) {
                        setPendingSeat(seatNum);
                        setOverrideSeat(seatNum);
                        try {
                          localStorage.setItem('viplava_participant_seat', String(seatNum));
                          window.dispatchEvent(new Event('viplava-seat-change'));
                        } catch {
                          // Safe fallback
                        }
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-black border-yellow-200 font-black shadow-lg scale-102 ring-2 ring-amber-400/50'
                        : isAlreadyClaimed
                        ? 'bg-black/20 border-stone-800 text-stone-500 opacity-40 cursor-not-allowed'
                        : 'bg-black/50 border-amber-500/30 text-amber-200 hover:border-amber-400/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{targetParticipant?.avatar}</span>
                      <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-black' : isAlreadyClaimed ? 'text-stone-500' : 'text-amber-400'}`}>
                        #{seatNum}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate mt-1">
                      Seat {seatNum}
                    </div>
                    <div className="text-[9px] truncate opacity-80">
                      {targetParticipant?.isClaimed && targetParticipant?.claimedName
                        ? `Claimed (${targetParticipant.claimedName})`
                        : 'Available'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm Button */}
          {(() => {
            const pendingTarget = participants.find((p) => p.seatNumber === pendingSeat);
            const isPendingClaimedByOther = pendingTarget?.isClaimed && pendingTarget?.seatNumber !== selectedSeat;

            return (
              <div className="pt-2 flex items-center gap-2">
                {isEditingClaim && (
                  <button
                    type="button"
                    onClick={() => setIsEditingClaim(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-amber-200 text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPendingClaimedByOther}
                  onClick={() => handleClaimSeat(pendingSeat, inputName || participant?.spiritualName || `Seat ${pendingSeat}`)}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-1.5 transition-transform active:scale-95 ${
                    isPendingClaimedByOther
                      ? 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black'
                  }`}
                >
                  <span>
                    {isPendingClaimedByOther ? `Seat ${pendingSeat} Already Claimed` : 'Confirm & Claim Seat'}
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* PAUSED WARNING */}
      {isPaused && (
        <div className="my-auto p-6 rounded-2xl bg-rose-950/90 border border-rose-500 text-center space-y-2">
          <div className="text-3xl">⏸️</div>
          <div className="text-base font-black text-rose-200">ROUND PAUSED</div>
          <p className="text-xs text-rose-100">{pausedMessage}</p>
        </div>
      )}

      {/* 2. Main Gameplay Area */}
      {!isPaused && (
        <div className="my-auto py-3 space-y-4">
          {/* LOBBY */}
          {phase === 'LOBBY' && (
            <div className="p-6 rounded-3xl bg-[#170e28] border border-amber-500/30 text-center space-y-3">
              <div className="text-4xl">🦚</div>
              <h3 className="text-xl font-bold font-cinzel text-amber-300">Viplava 2026 Quiz</h3>
              <p className="text-xs text-amber-200/80">
                You are ready at <strong>Seat #{selectedSeat}</strong> ({participant?.spiritualName}).
              </p>
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Connected &amp; Ready</span>
              </div>
            </div>
          )}

          {/* RULES SCREENS */}
          {phase.endsWith('_RULES') && (
            <div className="p-6 rounded-3xl bg-[#170e28] border border-amber-500/30 text-center space-y-2">
              <div className="text-3xl">📜</div>
              <h4 className="text-lg font-bold font-cinzel text-amber-300">Rules in Progress</h4>
              <p className="text-xs text-amber-200/70">
                Please look at the Projector Screen while the host explains this round.
              </p>
            </div>
          )}

          {/* ROUND 1: DIRECT & PASS */}
          {phase === 'ROUND_1_ACTIVE' && (() => {
            const q = round1Questions[round1State.currentQuestionIndex];
            const isRevealed = round1State.isAnswerRevealed;
            const activeSeatParticipant = participants.find((p) => p.seatNumber === round1State.targetSeat);
            const activeSeatName = activeSeatParticipant?.claimedName || activeSeatParticipant?.spiritualName || `Seat #${round1State.targetSeat}`;

            if (!isRound1MyTurn) {
              return (
                <div className="p-6 rounded-3xl bg-[#180f2d] border border-amber-500/30 text-center space-y-3 animate-fadeIn">
                  <div className="text-3xl">👀</div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Active Turn:</div>
                  <div className="text-lg font-bold font-cinzel text-amber-100">
                    Seat #{round1State.targetSeat} ({activeSeatName})
                  </div>
                  <p className="text-xs text-amber-200/70 leading-relaxed">
                    Question is currently active for candidate at Seat #{round1State.targetSeat}. Please look at the main projector display!
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-500 text-black text-center shadow-lg font-bold">
                  <div className="text-[11px] uppercase tracking-wider font-black">
                    {round1State.isPassed ? '⚡ PASSED QUESTION FOR YOU (+5 PTS)' : '⭐ DIRECT QUESTION FOR YOU (+10 PTS)'}
                  </div>
                  <div className="text-xs mt-0.5">Select your answer option or state answer verbally:</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#180f2d] border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-amber-400/80 font-bold uppercase">
                    <span>Q{round1State.currentQuestionIndex + 1} of {round1Questions.length}</span>
                    <span className="font-mono text-amber-300">{timer.secondsLeft}s left</span>
                  </div>
                  <p className="text-sm font-semibold text-amber-100">{q?.question}</p>

                  {/* If Multiple Choice Options exist */}
                  {q?.options && q.options.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, i) => {
                        const isSelected = round1State.selectedOptionIndex === i;
                        const isCorrect = opt === q.correctAnswer;
                        const letters = ['A', 'B', 'C', 'D'];

                        let optStyle = 'bg-black/40 border-amber-500/20 text-amber-200';
                        if (!isRevealed) {
                          if (isSelected) {
                            optStyle = 'bg-amber-500 text-black font-black border-yellow-200 shadow-lg';
                          }
                        } else {
                          if (isSelected && isCorrect) {
                            optStyle = 'bg-emerald-600 text-white font-black border-emerald-300';
                          } else if (isSelected && !isCorrect) {
                            optStyle = 'bg-rose-900 text-white font-black border-rose-400';
                          } else if (isCorrect) {
                            optStyle = 'bg-emerald-800 text-emerald-100 font-bold border-emerald-400';
                          }
                        }

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectRound1Option(i)}
                            disabled={isRevealed}
                            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs transition-all active:scale-[0.98] ${optStyle}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-black/20 flex items-center justify-center font-bold">
                                {letters[i]}
                              </span>
                              <span>{opt}</span>
                            </div>
                            {isSelected && !isRevealed && (
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-black text-amber-300">Selected ↗</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isRevealed && (
                    <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-400 text-emerald-200 text-xs font-bold text-center">
                      Correct: {q?.correctAnswer}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ROUND 2: RAPID FIRE */}
          {phase === 'ROUND_2_ACTIVE' && (() => {
            const currentSet = round2Sets.find((s) => s.seatNumber === round2State.currentSeat);
            const currentQ = currentSet?.questions[round2State.currentQuestionIndex];
            const activeSeatParticipant = participants.find((p) => p.seatNumber === round2State.currentSeat);
            const activeSeatName = activeSeatParticipant?.claimedName || activeSeatParticipant?.spiritualName || `Seat #${round2State.currentSeat}`;

            if (!isRound2MyTurn) {
              return (
                <div className="p-6 rounded-3xl bg-[#180f2d] border border-amber-500/30 text-center space-y-3 animate-fadeIn">
                  <div className="text-3xl">⚡</div>
                  <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Rapid Fire Blitz Active</div>
                  <div className="text-lg font-bold font-cinzel text-amber-100">
                    Seat #{round2State.currentSeat} ({activeSeatName})
                  </div>
                  <p className="text-xs text-amber-200/70 leading-relaxed">
                    Candidate at Seat #{round2State.currentSeat} is answering their 10-question rapid set. Please watch the main screen!
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black text-center shadow-lg font-black">
                  <div className="text-xs uppercase tracking-widest">⚡ YOUR RAPID FIRE BLITZ!</div>
                  <div className="text-sm">Q#{round2State.currentQuestionIndex + 1} / 10</div>
                </div>

                <div className="p-5 rounded-2xl bg-[#180f2d] border border-amber-500/30 text-center space-y-3">
                  <div className="text-xs text-amber-400/80 font-bold uppercase">
                    Rapid Question {round2State.currentQuestionIndex + 1} / 10
                  </div>
                  <p className="text-base font-bold text-amber-100">{currentQ?.question}</p>

                  {/* Optional Options for Rapid Fire if configured */}
                  {currentQ?.options && currentQ.options.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-2 text-left">
                      {currentQ.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="p-3 rounded-xl bg-black/50 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-2"
                        >
                          <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center">
                            {['A', 'B', 'C', 'D'][oIdx]}
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

          {/* ROUND 3: BUZZER ROUND */}
          {phase === 'ROUND_3_ACTIVE' && (() => {
            const q = round3Questions[round3State.currentQuestionIndex];
            const isRevealed = round3State.isAnswerRevealed;
            const letters = ['A', 'B', 'C', 'D'];

            return (
              <div className="space-y-4">
                {/* Question Info */}
                <div className="p-3.5 rounded-2xl bg-[#180f2d] border border-amber-500/30 space-y-1 text-center">
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold uppercase">
                    <span>Buzzer Question #{round3State.currentQuestionIndex + 1}</span>
                    <span className="text-emerald-400">+15 / -5</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-amber-100">
                    {q?.question}
                  </p>
                </div>

                {/* Question Options (DISPLAYED TO ALL, BUT DISABLED BEFORE BUZZING IN) */}
                {buzzerState.status !== 'BUZZED' && !isRevealed && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      {q?.options.map((option, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-black/40 border border-amber-500/20 text-amber-200/70 text-xs text-left flex items-center gap-2.5 opacity-80"
                        >
                          <span className="w-6 h-6 rounded bg-black/30 text-amber-400 font-bold flex items-center justify-center">
                            {letters[idx]}
                          </span>
                          <span>{option}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col items-center justify-center py-2">
                      <button
                        onClick={handlePressBuzzer}
                        disabled={!buzzerState.isUnlocked}
                        className={`w-48 h-48 sm:w-52 sm:h-52 rounded-full flex flex-col items-center justify-center select-none touch-manipulation relative active:scale-95 transition-all ${
                          buzzerState.isUnlocked
                            ? 'bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-600 text-black shadow-[0_0_40px_rgba(245,158,11,0.6)] border-8 border-amber-300 animate-pulse-glow cursor-pointer'
                            : 'bg-gradient-to-b from-[#2b183a] to-[#160d1f] text-amber-400/30 border-8 border-purple-900/40 opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <Zap className={`w-10 h-10 mb-1 ${buzzerState.isUnlocked ? 'text-black' : 'text-amber-500/30'}`} />
                        <span className="font-cinzel font-black text-xl tracking-wider">
                          {buzzerState.isUnlocked ? 'BUZZ IN!' : 'LOCKED'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-90">
                          {buzzerState.isUnlocked ? 'Tap fast to answer' : 'Wait for Host unlock'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* IF BUZZED IN: Show options ONLY on the screen of the participant who buzzed! */}
                {buzzerState.status === 'BUZZED' && (
                  <div className="space-y-3">
                    {didIBuzzFirst ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-center font-black shadow-lg">
                          <div className="flex items-center justify-between">
                            <div className="text-xs uppercase tracking-wider">🎉 YOU BUZZED IN FIRST!</div>
                            <div className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${
                              timer.secondsLeft <= 3 ? 'bg-red-600 text-white animate-pulse' : 'bg-black text-yellow-300'
                            }`}>
                              ⏱️ {timer.secondsLeft}s
                            </div>
                          </div>
                          <div className="text-xs font-semibold mt-0.5">
                            Tap your chosen option below (10s answer limit):
                          </div>
                        </div>

                        {/* 4 Options Grid Enabled for Winner */}
                        <div className="grid grid-cols-1 gap-2.5">
                          {q?.options.map((option, idx) => {
                            const isSelected = buzzerState.selectedOptionIndex === idx;
                            const isCorrect = idx === q.correctOptionIndex;

                            let btnStyle = 'bg-black/50 border-amber-500/30 text-amber-200';

                            if (!isRevealed) {
                              if (isSelected) {
                                btnStyle = 'bg-amber-500 text-black font-black border-yellow-200 ring-2 ring-yellow-300 shadow-lg';
                              }
                            } else {
                              if (isSelected && isCorrect) {
                                btnStyle = 'bg-emerald-600 text-white font-black border-emerald-300';
                              } else if (isSelected && !isCorrect) {
                                btnStyle = 'bg-rose-900 text-white font-black border-rose-400';
                              } else if (isCorrect) {
                                btnStyle = 'bg-emerald-800 text-emerald-100 font-bold border-emerald-400';
                              }
                            }

                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelectBuzzerOption(idx)}
                                disabled={isRevealed}
                                className={`p-3.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all active:scale-[0.98] ${btnStyle} ${
                                  !isRevealed ? 'cursor-pointer hover:border-amber-400' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center font-black text-sm">
                                    {letters[idx]}
                                  </span>
                                  <span className="font-semibold">{option}</span>
                                </div>

                                {isSelected && !isRevealed && (
                                  <span className="px-2 py-0.5 rounded bg-black text-amber-300 text-[10px] font-black uppercase">
                                    Selected ↗
                                  </span>
                                )}
                                {isSelected && isRevealed && isCorrect && (
                                  <span className="text-[10px] font-black uppercase text-white">
                                    ✓ Correct (+15)
                                  </span>
                                )}
                                {isSelected && isRevealed && !isCorrect && (
                                  <span className="text-[10px] font-black uppercase text-white">
                                    ✗ Wrong (-5)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 rounded-3xl bg-[#180f2d] border border-amber-500/30 text-center space-y-3 animate-fadeIn">
                        <div className="text-3xl">🔔</div>
                        <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Buzzed In First:</div>
                        <div className="text-lg font-bold font-cinzel text-amber-100">
                          Seat #{buzzerState.buzzedParticipantId?.replace('p', '')} ({participants.find((p) => p.id === buzzerState.buzzedParticipantId)?.claimedName || participants.find((p) => p.id === buzzerState.buzzedParticipantId)?.spiritualName})
                        </div>
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                          Candidate at Seat #{buzzerState.buzzedParticipantId?.replace('p', '')} is choosing their option on their screen. Watch the main projector!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* If Answer is Revealed */}
                {isRevealed && (
                  <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-400 text-emerald-200 text-center space-y-1">
                    <div className="text-xs font-black uppercase">Transcendental Answer Revealed</div>
                    <div className="text-sm font-bold text-emerald-100">
                      Option {letters[q?.correctOptionIndex || 0]}: {q?.options[q?.correctOptionIndex || 0]}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TIE BREAKER: FASTEST FINGER FIRST */}
          {phase === 'TIE_BREAKER_ACTIVE' && (() => {
            const q = tieBreakerQuestions[tieBreakerState.currentQuestionIndex];
            const isTied =
              tieBreakerState.tiedParticipantIds.length === 0 ||
              tieBreakerState.tiedParticipantIds.includes(participantId) ||
              tieBreakerState.tiedParticipantIds.includes(participant?.id || '') ||
              tieBreakerState.tiedParticipantIds.includes(`p${selectedSeat}`) ||
              tieBreakerState.tiedParticipantIds.includes(String(selectedSeat));

            if (!isTied) {
              return (
                <div className="p-6 rounded-2xl bg-[#160d28] border border-cyan-500/30 text-center space-y-2 animate-fadeIn">
                  <h4 className="font-bold font-cinzel text-cyan-300">Tie Breaker Active</h4>
                  <p className="text-xs text-amber-200/70">
                    Other participants are resolving a score tie on the projector.
                  </p>
                </div>
              );
            }

            // If selected tied participant, check if host has launched the question
            if (tieBreakerState.isQuestionLaunched === false) {
              return (
                <div className="p-6 rounded-3xl bg-[#160d28] border border-cyan-500/40 text-center space-y-3 animate-fadeIn">
                  <div className="text-3xl">🎯</div>
                  <h4 className="text-lg font-bold font-cinzel text-cyan-200">You Are Selected for Tie-Breaker!</h4>
                  <p className="text-xs text-cyan-300/80 leading-relaxed">
                    Get ready! The host is selecting the participants and will launch Question #{tieBreakerState.currentQuestionIndex + 1} shortly.
                  </p>
                </div>
              );
            }

            const mySubmission =
              tieBreakerState.submissions[participantId] ||
              tieBreakerState.submissions[participant?.id || ''] ||
              tieBreakerState.submissions[`p${selectedSeat}`] ||
              tieBreakerState.submissions[String(selectedSeat)];

            return (
              <TieBreakerActiveCard
                key={tieBreakerState.currentQuestionIndex}
                question={q}
                questionIndex={tieBreakerState.currentQuestionIndex}
                participantId={participantId}
                mySubmission={mySubmission}
                isCompleted={tieBreakerState.isCompleted}
                winnerParticipantId={tieBreakerState.winnerParticipantId}
                participants={participants}
                executeAction={executeAction}
              />
            );
          })()}

          {/* LEADERBOARDS */}
          {phase.endsWith('_LEADERBOARD') && (
            <div className="p-6 rounded-3xl bg-[#170e28] border border-amber-500/30 text-center space-y-2">
              <div className="text-3xl">🏆</div>
              <h4 className="text-lg font-bold font-cinzel text-amber-300">Round Complete!</h4>
              <p className="text-xs text-amber-200/70">Check out the updated scores on the main screen!</p>
            </div>
          )}

          {phase === 'FINAL_PODIUM' && (
            <div className="p-6 rounded-3xl bg-gradient-to-b from-amber-900/60 to-purple-950/80 border border-amber-400 text-center space-y-3 shadow-xl">
              <div className="text-4xl">👑</div>
              <h3 className="text-xl font-black font-cinzel text-amber-300">Viplava 2026 Finale</h3>
              <p className="text-xs text-amber-100">
                Hare Krishna! A Quiz on Srila Prabhupada Life has concluded!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. Footer */}
      <div className="py-2 text-center text-[10px] text-amber-400/50 uppercase tracking-widest font-semibold border-t border-amber-500/10">
        Mathura-Gokul Dham • Viplava 2026
      </div>
    </div>
  );
}

interface TieBreakerActiveCardProps {
  question: TieBreakerQuestion;
  questionIndex: number;
  participantId: string;
  mySubmission?: TieBreakerSubmission;
  isCompleted: boolean;
  winnerParticipantId: string | null;
  participants: Participant[];
  executeAction: (action: string, payload?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown }>;
}

function TieBreakerActiveCard({
  question,
  questionIndex,
  participantId,
  mySubmission,
  isCompleted,
  winnerParticipantId,
  participants,
  executeAction,
}: TieBreakerActiveCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof performance !== 'undefined') {
      startTimeRef.current = performance.now();
    }
  }, []);

  const chosenIdx = mySubmission?.selectedOptionIndex ?? selectedOption;
  const hasSubmitted = chosenIdx !== null && chosenIdx !== undefined;

  const handleSelectOption = (e: React.MouseEvent<HTMLButtonElement>, idx: number) => {
    e.preventDefault();
    if (hasSubmitted) return;
    const now = e.timeStamp;
    const start = startTimeRef.current || now;
    const timeTakenMs = Math.max(120, Math.round(now > start ? now - start : 1200));
    setSelectedOption(idx);
    soundManager.playBell();
    executeAction('submit_tie_breaker_answer', {
      participantId,
      optionIndex: idx,
      timeTakenMs,
    });
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-400 text-cyan-200 text-center text-xs font-bold flex items-center justify-between">
        <span>🎯 FASTEST-FINGER-FIRST Q#{questionIndex + 1}</span>
        <span className="text-[10px] bg-cyan-500/30 px-2 py-0.5 rounded border border-cyan-400/50">
          {hasSubmitted ? '✓ Answer Locked' : '⚡ Tap fast!'}
        </span>
      </div>

      <div className="p-4 rounded-2xl bg-[#180f2d] border border-cyan-500/30 space-y-3 shadow-lg">
        <p className="text-sm font-bold text-amber-100 leading-snug">{question?.question}</p>

        <div className="grid grid-cols-1 gap-2.5">
          {question?.options.map((opt, idx) => {
            const isPicked = chosenIdx === idx;
            let btnClass = 'bg-black/50 hover:bg-cyan-950/60 border-cyan-500/30 text-cyan-200';

            if (isPicked) {
              btnClass = 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-300 text-white font-black ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)]';
            } else if (hasSubmitted) {
              btnClass = 'bg-black/30 border-slate-700 text-slate-400 opacity-60 cursor-not-allowed';
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasSubmitted}
                onClick={(e) => handleSelectOption(e, idx)}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between text-xs font-semibold active:scale-[0.98] transition-all ${btnClass}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm ${
                    isPicked ? 'bg-black/30 text-white' : 'bg-black/40 text-cyan-300'
                  }`}>
                    {['A', 'B', 'C', 'D'][idx]}
                  </span>
                  <span>{opt}</span>
                </div>

                {isPicked && (
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-black/40 text-cyan-200">
                    ✓ Submitted
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Submission Status Banner */}
        {hasSubmitted && (
          <div className="p-3 rounded-xl bg-cyan-950/90 border border-cyan-400 text-cyan-100 text-center space-y-1 animate-fadeIn">
            <div className="text-xs font-black uppercase text-cyan-300">
              ⚡ Response Locked! Reaction Time: {mySubmission?.timeTakenMs ? (mySubmission.timeTakenMs / 1000).toFixed(2) : 'Recorded'}s
            </div>
            <div className="text-[11px] text-cyan-200/80">
              Awaiting other tied participants. Results will flash on the big screen!
            </div>
          </div>
        )}

        {/* Winner Display if tie-break completed */}
        {isCompleted && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-center font-black space-y-0.5 shadow-lg animate-bounce">
            <div className="text-xs uppercase tracking-wider">👑 TIE-BREAKER WINNER DECIDED!</div>
            <div className="text-sm font-cinzel">
              Seat #{participants.find((p) => p.id === winnerParticipantId)?.seatNumber} ({participants.find((p) => p.id === winnerParticipantId)?.claimedName || participants.find((p) => p.id === winnerParticipantId)?.spiritualName})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
