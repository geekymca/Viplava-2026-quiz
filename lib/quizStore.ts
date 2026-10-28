import os from 'os';
import { QuizState, QuizPhase, Participant, QuestionRound1, RapidFireSet, BuzzerQuestion, TieBreakerQuestion, QuizRules } from './types';
import { INITIAL_QUIZ_STATE } from './defaultData';

function detectLocalNetworkIp(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal && net.address) {
          if (!net.address.startsWith('127.')) {
            return net.address;
          }
        }
      }
    }
  } catch {}
  return null;
}

// Global singleton state in Node server environment
declare global {
  var __GLOBAL_QUIZ_STATE__: QuizState | undefined;
  var __QUIZ_LISTENERS__: Set<(state: QuizState) => void> | undefined;
  var __TIMER_INTERVAL__: NodeJS.Timeout | undefined;
}

if (!global.__GLOBAL_QUIZ_STATE__) {
  const initialState: QuizState = JSON.parse(JSON.stringify(INITIAL_QUIZ_STATE));
  const detected = detectLocalNetworkIp();
  if (detected) {
    initialState.detectedNetworkIp = detected;
  }
  global.__GLOBAL_QUIZ_STATE__ = initialState;
} else {
  // Ensure default uncheck state
  const detected = detectLocalNetworkIp();
  if (detected && global.__GLOBAL_QUIZ_STATE__ && !global.__GLOBAL_QUIZ_STATE__.detectedNetworkIp) {
    global.__GLOBAL_QUIZ_STATE__.detectedNetworkIp = detected;
  }
}

if (!global.__QUIZ_LISTENERS__) {
  global.__QUIZ_LISTENERS__ = new Set();
}

// Background timer ticker - counts down automatically when timer is running and not paused
if (!global.__TIMER_INTERVAL__) {
  global.__TIMER_INTERVAL__ = setInterval(() => {
    const state = global.__GLOBAL_QUIZ_STATE__;
    if (state && state.timer.isRunning && !state.isPaused) {
      if (state.timer.secondsLeft > 0) {
        state.timer.secondsLeft -= 1;
        state.timer.lastUpdated = Date.now();

        if (state.timer.secondsLeft === 0) {
          state.timer.isRunning = false;

          // Auto-timeout transitions
          if (state.phase === 'ROUND_1_ACTIVE') {
            if (!state.round1State.isPassed && state.round1State.passCount === 0) {
              // Direct question timed out -> auto pass to next seat (10 seconds)
              const currentSeat = state.round1State.targetSeat;
              const nextSeat = (currentSeat % 6) + 1;
              state.round1State.targetSeat = nextSeat;
              state.round1State.isPassed = true;
              state.round1State.passCount = 1;
              state.round1State.status = 'PASSED';
              state.round1State.selectedOptionIndex = null;
              state.timer.secondsLeft = 10;
              state.timer.initialSeconds = 10;
              state.timer.isRunning = true;
            } else {
              // Pass question timed out -> reveal answer
              state.round1State.isAnswerRevealed = true;
              state.round1State.status = 'REVEALED';
            }
          } else if (state.phase === 'ROUND_2_ACTIVE') {
            state.round2State.isCompleted = true;
          } else if (state.phase === 'ROUND_3_ACTIVE') {
            // Buzzer round: 10s answer timer expired for buzzed candidate
            if (state.buzzerState.status === 'BUZZED' && state.buzzerState.buzzedParticipantId) {
              const buzzedId = state.buzzerState.buzzedParticipantId;
              const participant = state.participants.find((p) => p.id === buzzedId);
              if (participant) {
                participant.scores.round3 -= 5;
                participant.totalScore -= 5;
                state.lastScoreChange = {
                  participantId: participant.id,
                  round: 'round3',
                  delta: -5,
                  description: 'Buzzer 10s Time Expired (-5)',
                  timestamp: Date.now(),
                };
              }
              // Re-unlock buzzer for other contestants
              state.buzzerState.buzzedParticipantId = null;
              state.buzzerState.selectedOptionIndex = null;
              state.buzzerState.isUnlocked = true;
              state.buzzerState.status = 'UNLOCKED';
              state.timer.secondsLeft = 10;
              state.timer.isRunning = false;
            } else {
              state.buzzerState.isUnlocked = false;
            }
          }
        }

        broadcastChange();
      }
    }
  }, 1000);
}

function broadcastChange() {
  if (global.__GLOBAL_QUIZ_STATE__) {
    global.__GLOBAL_QUIZ_STATE__.version += 1;
    global.__GLOBAL_QUIZ_STATE__.updatedAt = Date.now();
    const cloned = JSON.parse(JSON.stringify(global.__GLOBAL_QUIZ_STATE__));
    global.__QUIZ_LISTENERS__?.forEach((cb) => {
      try {
        cb(cloned);
      } catch (e) {
        console.error('Error broadcasting to listener', e);
      }
    });
  }
}

export const quizStore = {
  getState: (): QuizState => {
    return JSON.parse(JSON.stringify(global.__GLOBAL_QUIZ_STATE__!));
  },

  subscribe: (cb: (state: QuizState) => void) => {
    global.__QUIZ_LISTENERS__?.add(cb);
    return () => {
      global.__QUIZ_LISTENERS__?.delete(cb);
    };
  },

  setPhase: (phase: QuizPhase) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.phase = phase;

    // Reset timer according to phase defaults - automatically start on active rounds
    if (phase === 'ROUND_1_ACTIVE') {
      state.timer.initialSeconds = 20;
      state.timer.secondsLeft = 20;
      state.timer.isRunning = true;
    } else if (phase === 'ROUND_2_ACTIVE') {
      state.timer.initialSeconds = 60;
      state.timer.secondsLeft = 60;
      state.timer.isRunning = true;
    } else if (phase === 'ROUND_3_ACTIVE') {
      // Round 3: No timer countdown while reading questions; 10s clock starts when someone buzzes
      state.timer.initialSeconds = 10;
      state.timer.secondsLeft = 10;
      state.timer.isRunning = false;
      state.buzzerState.isUnlocked = true;
      state.buzzerState.buzzedParticipantId = null;
      state.buzzerState.status = 'UNLOCKED';
    } else if (phase === 'TIE_BREAKER_ACTIVE') {
      state.timer.isRunning = false;
      state.tieBreakerState.isQuestionLaunched = true;
      if (state.tieBreakerState.tiedParticipantIds.length === 0) {
        // Auto-detect top tied participants
        const sorted = [...state.participants].sort((a, b) => b.totalScore - a.totalScore);
        const topScore = sorted[0]?.totalScore ?? 0;
        const tiedTop = sorted.filter((p) => p.totalScore === topScore);
        if (tiedTop.length >= 2) {
          state.tieBreakerState.tiedParticipantIds = tiedTop.map((p) => p.id);
        } else {
          const secondScore = sorted[1]?.totalScore ?? 0;
          const tied23 = sorted.filter((p) => p.totalScore === secondScore);
          if (tied23.length >= 2) {
            state.tieBreakerState.tiedParticipantIds = tied23.map((p) => p.id);
          } else {
            state.tieBreakerState.tiedParticipantIds = state.participants.map((p) => p.id);
          }
        }
      }
    } else {
      state.timer.isRunning = false;
    }

    broadcastChange();
    return quizStore.getState();
  },

  setTimer: (secondsLeft: number, isRunning: boolean) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.timer.secondsLeft = secondsLeft;
    state.timer.isRunning = isRunning;
    state.timer.lastUpdated = Date.now();
    broadcastChange();
    return quizStore.getState();
  },

  // ---------------- ROUND 1: DIRECT & PASS ----------------
  setRound1Question: (questionIndex: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const q = state.round1Questions[questionIndex];
    const initialSeat = q ? q.assignedSeat : 1;

    state.round1State = {
      currentQuestionIndex: questionIndex,
      targetSeat: initialSeat,
      isPassed: false,
      passCount: 0,
      isAnswerRevealed: false,
      selectedOptionIndex: null,
      status: 'DIRECT',
    };
    state.timer.secondsLeft = 20; // 20 seconds for direct
    state.timer.initialSeconds = 20;
    state.timer.isRunning = true;

    broadcastChange();
    return quizStore.getState();
  },

  selectRound1Option: (optionIndex: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round1State.selectedOptionIndex = optionIndex;
    broadcastChange();
    return quizStore.getState();
  },

  passRound1Question: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    if (state.round1State.passCount >= 1) {
      // Max 1 pass allowed
      return quizStore.getState();
    }

    const currentSeat = state.round1State.targetSeat;
    const nextSeat = (currentSeat % 6) + 1; // 1->2, 2->3, 3->4, 4->5, 5->6, 6->1

    state.round1State.targetSeat = nextSeat;
    state.round1State.isPassed = true;
    state.round1State.passCount = 1;
    state.round1State.status = 'PASSED';
    state.timer.secondsLeft = 10; // 10 seconds for pass
    state.timer.initialSeconds = 10;
    state.timer.isRunning = true;

    broadcastChange();
    return quizStore.getState();
  },

  checkRound1Answer: (optionIndex?: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const qIndex = state.round1State.currentQuestionIndex;
    const q = state.round1Questions[qIndex];
    if (!q) return { success: false, state: quizStore.getState() };

    const selectedIdx = optionIndex !== undefined ? optionIndex : state.round1State.selectedOptionIndex;
    if (selectedIdx === null || selectedIdx === undefined) {
      return { success: false, state: quizStore.getState() };
    }
    state.round1State.selectedOptionIndex = selectedIdx;

    let isCorrect = false;
    if (q.options && q.options[selectedIdx]) {
      const selected = q.options[selectedIdx].trim().toLowerCase();
      const correct = q.correctAnswer.trim().toLowerCase();
      isCorrect = selected === correct || selected.includes(correct) || correct.includes(selected);
    } else {
      isCorrect = true;
    }

    const currentSeat = state.round1State.targetSeat;
    const participant = state.participants.find((p) => p.seatNumber === currentSeat);

    if (isCorrect) {
      const points = state.round1State.isPassed ? 5 : 10;
      if (participant) {
        participant.scores.round1 += points;
        participant.totalScore += points;
        state.lastScoreChange = {
          participantId: participant.id,
          round: 'round1',
          delta: points,
          description: state.round1State.isPassed ? `Round 1 Pass Correct (+${points})` : `Round 1 Direct Correct (+${points})`,
          timestamp: Date.now(),
        };
      }
      state.round1State.isAnswerRevealed = true;
      state.round1State.status = 'REVEALED';
      state.timer.isRunning = false;
    } else {
      // If wrong answer, make it like wrong and transfer to next if direct
      if (state.round1State.passCount === 0 && !state.round1State.isPassed) {
        const nextSeat = (currentSeat % 6) + 1;
        state.round1State.targetSeat = nextSeat;
        state.round1State.isPassed = true;
        state.round1State.passCount = 1;
        state.round1State.status = 'PASSED';
        state.round1State.selectedOptionIndex = null;
        state.round1State.isAnswerRevealed = false;
        state.timer.secondsLeft = 10;
        state.timer.initialSeconds = 10;
        state.timer.isRunning = true;
      } else {
        // Passed and wrong: mark as wrong, do not reveal so host can click Reveal Answer
        state.round1State.isAnswerRevealed = false;
        state.round1State.status = 'WRONG';
        state.timer.isRunning = false;
      }
    }

    broadcastChange();
    return { success: true, isCorrect, state: quizStore.getState() };
  },

  markRound1Answer: (isCorrect: boolean) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const currentSeat = state.round1State.targetSeat;
    const participant = state.participants.find((p) => p.seatNumber === currentSeat);

    if (isCorrect && participant) {
      const points = state.round1State.isPassed ? 5 : 10;
      participant.scores.round1 += points;
      participant.totalScore += points;
      state.round1State.isAnswerRevealed = true;
      state.round1State.status = 'REVEALED';
      state.timer.isRunning = false;

      state.lastScoreChange = {
        participantId: participant.id,
        round: 'round1',
        delta: points,
        description: state.round1State.isPassed ? `Round 1 Pass Correct (+${points})` : `Round 1 Direct Correct (+${points})`,
        timestamp: Date.now(),
      };
    } else if (!isCorrect) {
      // If direct missed, make it like wrong and transfer to next
      if (state.round1State.passCount === 0 && !state.round1State.isPassed) {
        const nextSeat = (currentSeat % 6) + 1;
        state.round1State.targetSeat = nextSeat;
        state.round1State.isPassed = true;
        state.round1State.passCount = 1;
        state.round1State.status = 'PASSED';
        state.round1State.selectedOptionIndex = null;
        state.round1State.isAnswerRevealed = false;
        state.timer.secondsLeft = 10;
        state.timer.initialSeconds = 10;
        state.timer.isRunning = true;
      } else {
        state.round1State.isAnswerRevealed = false;
        state.round1State.status = 'WRONG';
        state.timer.isRunning = false;
      }
    }

    broadcastChange();
    return quizStore.getState();
  },

  revealRound1Answer: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round1State.isAnswerRevealed = true;
    state.round1State.status = 'REVEALED';
    state.timer.isRunning = false;
    broadcastChange();
    return quizStore.getState();
  },

  resetRound1QuestionAttempt: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const q = state.round1Questions[state.round1State.currentQuestionIndex];
    const initialSeat = q ? q.assignedSeat : 1;

    state.round1State.targetSeat = initialSeat;
    state.round1State.isPassed = false;
    state.round1State.passCount = 0;
    state.round1State.isAnswerRevealed = false;
    state.round1State.selectedOptionIndex = null;
    state.round1State.status = 'DIRECT';
    state.timer.secondsLeft = 20;
    state.timer.initialSeconds = 20;
    state.timer.isRunning = true;

    broadcastChange();
    return quizStore.getState();
  },

  // ---------------- ROUND 2: RAPID FIRE ----------------
  setRapidFireSeat: (seatNumber: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round2State = {
      currentSeat: seatNumber,
      currentQuestionIndex: 0,
      correctCount: 0,
      passedCount: 0,
      answers: [],
      isCompleted: false,
    };
    state.timer.secondsLeft = 60;
    state.timer.initialSeconds = 60;
    // Auto-start clock timer automatically when rapid fire begins
    state.timer.isRunning = true;

    broadcastChange();
    return quizStore.getState();
  },

  recordRapidFireAnswer: (isCorrect: boolean) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const participant = state.participants.find((p) => p.seatNumber === state.round2State.currentSeat);

    if (isCorrect && participant) {
      participant.scores.round2 += 10;
      participant.totalScore += 10;
      state.round2State.correctCount += 1;

      state.lastScoreChange = {
        participantId: participant.id,
        round: 'round2',
        delta: 10,
        description: `Rapid Fire Q${state.round2State.currentQuestionIndex + 1} Correct (+10)`,
        timestamp: Date.now(),
      };
    } else {
      state.round2State.passedCount += 1;
    }

    state.round2State.answers.push({
      questionIndex: state.round2State.currentQuestionIndex,
      isCorrect,
    });

    if (state.round2State.currentQuestionIndex < 9) {
      state.round2State.currentQuestionIndex += 1;
    } else {
      state.round2State.isCompleted = true;
      state.timer.isRunning = false;
    }

    broadcastChange();
    return quizStore.getState();
  },

  // ---------------- ROUND 3: BUZZER ROUND ----------------
  setRound3Question: (questionIndex: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3State.currentQuestionIndex = questionIndex;
    state.round3State.isAnswerRevealed = false;

    // Automatically unlock buzzer and start timer when question appears
    state.buzzerState = {
      isUnlocked: true,
      buzzedParticipantId: null,
      buzzedAt: null,
      buzzHistory: [],
      status: 'UNLOCKED',
      selectedOptionIndex: null,
      selectedAt: null,
    };
    state.timer.secondsLeft = 10;
    state.timer.initialSeconds = 10;
    state.timer.isRunning = false;

    broadcastChange();
    return quizStore.getState();
  },

  checkRound3Answer: (optionIndex?: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const qIndex = state.round3State.currentQuestionIndex;
    const q = state.round3Questions[qIndex];
    if (!q) return { success: false, state: quizStore.getState() };

    const buzzedId = state.buzzerState.buzzedParticipantId;
    if (!buzzedId) return { success: false, state: quizStore.getState() };

    const selectedIdx = optionIndex !== undefined ? optionIndex : state.buzzerState.selectedOptionIndex;
    if (selectedIdx === null || selectedIdx === undefined) {
      return { success: false, state: quizStore.getState() };
    }
    state.buzzerState.selectedOptionIndex = selectedIdx;

    const isCorrect = selectedIdx === q.correctOptionIndex;
    const participant = state.participants.find((p) => p.id === buzzedId);

    if (isCorrect) {
      if (participant) {
        participant.scores.round3 += 15;
        participant.totalScore += 15;
        state.lastScoreChange = {
          participantId: participant.id,
          round: 'round3',
          delta: 15,
          description: 'Buzzer Round Correct (+15)',
          timestamp: Date.now(),
        };
      }
      state.round3State.isAnswerRevealed = true;
      state.buzzerState.status = 'ANSWERED';
      state.timer.isRunning = false;
    } else {
      if (participant) {
        participant.scores.round3 -= 5;
        participant.totalScore -= 5;
        state.lastScoreChange = {
          participantId: participant.id,
          round: 'round3',
          delta: -5,
          description: 'Buzzer Round Penalty (-5)',
          timestamp: Date.now(),
        };
      }
      // Wrong answer -> transfer chance back to other contestants by unlocking buzzer!
      state.buzzerState.buzzedParticipantId = null;
      state.buzzerState.selectedOptionIndex = null;
      state.buzzerState.isUnlocked = true;
      state.buzzerState.status = 'UNLOCKED';
      state.timer.secondsLeft = 10;
      state.timer.isRunning = false;
    }

    broadcastChange();
    return { success: true, isCorrect, state: quizStore.getState() };
  },

  unlockBuzzer: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.buzzerState.isUnlocked = true;
    state.buzzerState.buzzedParticipantId = null;
    state.buzzerState.buzzedAt = null;
    state.buzzerState.selectedOptionIndex = null;
    state.buzzerState.selectedAt = null;
    state.buzzerState.status = 'UNLOCKED';
    state.timer.secondsLeft = 10;
    state.timer.initialSeconds = 10;
    state.timer.isRunning = false;

    broadcastChange();
    return quizStore.getState();
  },

  lockBuzzer: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.buzzerState.isUnlocked = false;
    if (state.buzzerState.status === 'UNLOCKED') {
      state.buzzerState.status = 'IDLE';
    }
    broadcastChange();
    return quizStore.getState();
  },

  selectBuzzerOption: (participantId: string, optionIndex: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.buzzerState.selectedOptionIndex = optionIndex;
    state.buzzerState.selectedAt = Date.now();
    if (!state.buzzerState.buzzedParticipantId) {
      state.buzzerState.buzzedParticipantId = participantId;
      state.buzzerState.status = 'BUZZED';
    }
    broadcastChange();
    return quizStore.getState();
  },

  pressBuzzer: (participantId: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const now = Date.now();

    if (state.isPaused) {
      return { success: false, reason: 'Round is currently paused by the Host' };
    }

    if (!state.buzzerState.isUnlocked) {
      return {
        success: false,
        reason: state.buzzerState.buzzedParticipantId ? 'Another participant buzzed in first' : 'Buzzer is currently locked',
        buzzedBy: state.buzzerState.buzzedParticipantId,
      };
    }

    // Atomic first lock
    if (state.buzzerState.buzzedParticipantId === null) {
      state.buzzerState.buzzedParticipantId = participantId;
      state.buzzerState.buzzedAt = now;
      state.buzzerState.isUnlocked = false; // Lock out others
      state.buzzerState.status = 'BUZZED';
      state.buzzerState.selectedOptionIndex = null;
      state.buzzerState.selectedAt = null;
      state.buzzerState.buzzHistory.push({ participantId, timestamp: now });
      // 10 seconds to answer starts as soon as buzzer is pressed
      state.timer.secondsLeft = 10;
      state.timer.initialSeconds = 10;
      state.timer.isRunning = true;
      state.timer.lastUpdated = now;

      broadcastChange();
      return { success: true, buzzedFirst: true, buzzedAt: now };
    }

    // Already buzzed by someone else, record in history
    state.buzzerState.buzzHistory.push({ participantId, timestamp: now });
    return {
      success: false,
      reason: 'Another participant buzzed in first',
      buzzedBy: state.buzzerState.buzzedParticipantId,
      timeDifferenceMs: now - (state.buzzerState.buzzedAt || now),
    };
  },

  markBuzzerAnswer: (isCorrect: boolean) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const buzzedId = state.buzzerState.buzzedParticipantId;
    if (!buzzedId) return quizStore.getState();

    const participant = state.participants.find((p) => p.id === buzzedId);
    if (participant) {
      if (isCorrect) {
        participant.scores.round3 += 15;
        participant.totalScore += 15;
        state.round3State.isAnswerRevealed = true;
        state.buzzerState.status = 'ANSWERED';

        state.lastScoreChange = {
          participantId: participant.id,
          round: 'round3',
          delta: 15,
          description: `Buzzer Round Correct (+15)`,
          timestamp: Date.now(),
        };
      } else {
        participant.scores.round3 -= 5; // -5 negative marking
        participant.totalScore -= 5;
        state.buzzerState.status = 'IDLE';

        state.lastScoreChange = {
          participantId: participant.id,
          round: 'round3',
          delta: -5,
          description: `Buzzer Round Penalty (-5)`,
          timestamp: Date.now(),
        };
      }
    }

    broadcastChange();
    return quizStore.getState();
  },

  revealRound3Answer: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3State.isAnswerRevealed = true;
    state.buzzerState.isUnlocked = false;
    state.timer.isRunning = false;

    // Auto-evaluate if option was selected and not already evaluated
    const buzzedId = state.buzzerState.buzzedParticipantId;
    const selectedIdx = state.buzzerState.selectedOptionIndex;
    const currentQ = state.round3Questions[state.round3State.currentQuestionIndex];

    if (buzzedId && selectedIdx !== null && currentQ && state.buzzerState.status !== 'ANSWERED') {
      const isCorrect = selectedIdx === currentQ.correctOptionIndex;
      const participant = state.participants.find((p) => p.id === buzzedId);
      if (participant) {
        if (isCorrect) {
          participant.scores.round3 += 15;
          participant.totalScore += 15;
          state.buzzerState.status = 'ANSWERED';
          state.lastScoreChange = {
            participantId: participant.id,
            round: 'round3',
            delta: 15,
            description: `Buzzer Round Correct (+15)`,
            timestamp: Date.now(),
          };
        } else {
          participant.scores.round3 -= 5;
          participant.totalScore -= 5;
          state.buzzerState.status = 'IDLE';
          state.lastScoreChange = {
            participantId: participant.id,
            round: 'round3',
            delta: -5,
            description: `Buzzer Round Penalty (-5)`,
            timestamp: Date.now(),
          };
        }
      }
    }

    broadcastChange();
    return quizStore.getState();
  },

  resetRound3QuestionAttempt: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3State.isAnswerRevealed = false;
    state.buzzerState = {
      isUnlocked: true,
      buzzedParticipantId: null,
      buzzedAt: null,
      buzzHistory: [],
      status: 'UNLOCKED',
      selectedOptionIndex: null,
      selectedAt: null,
    };
    state.timer.secondsLeft = 10;
    state.timer.initialSeconds = 10;
    state.timer.isRunning = false;

    broadcastChange();
    return quizStore.getState();
  },

  // ---------------- TIE BREAKER: FASTEST FINGER FIRST ----------------
  initTieBreaker: (tiedParticipantIds: string[]) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerState = {
      currentQuestionIndex: 0,
      tiedParticipantIds,
      submissions: {},
      isCompleted: false,
      winnerParticipantId: null,
      isQuestionLaunched: true,
    };
    state.timer.isRunning = false;

    broadcastChange();
    return quizStore.getState();
  },

  launchTieBreakerQuestion: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerState.isQuestionLaunched = true;
    state.timer.isRunning = false;
    broadcastChange();
    return quizStore.getState();
  },

  setTieBreakerQuestion: (questionIndex: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerState.currentQuestionIndex = Math.min(questionIndex, 2); // Up to 3 questions (0, 1, 2)
    state.tieBreakerState.submissions = {};
    state.tieBreakerState.isCompleted = false;
    state.tieBreakerState.winnerParticipantId = null;
    state.tieBreakerState.isQuestionLaunched = true;
    state.timer.isRunning = false;
    broadcastChange();
    return quizStore.getState();
  },

  submitTieBreakerAnswer: (participantId: string, optionIndex: number, timeTakenMs: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const question = state.tieBreakerQuestions[state.tieBreakerState.currentQuestionIndex];
    if (!question) return quizStore.getState();

    // Match participant ID reliably across string formats ('p1', '1', or actual uuid/id)
    const matched = state.participants.find(
      (p) => p.id === participantId || `p${p.seatNumber}` === participantId || p.seatNumber.toString() === participantId
    );
    const resolvedId = matched ? matched.id : participantId;

    const isCorrect = optionIndex === question.correctOptionIndex;

    state.tieBreakerState.submissions[resolvedId] = {
      participantId: resolvedId,
      selectedOptionIndex: optionIndex,
      timeTakenMs: Math.max(100, Math.round(timeTakenMs)),
      isCorrect,
      submittedAt: Date.now(),
    };

    // Ensure resolvedId is in tiedParticipantIds
    if (!state.tieBreakerState.tiedParticipantIds.includes(resolvedId)) {
      state.tieBreakerState.tiedParticipantIds.push(resolvedId);
    }

    // Check if all tied participants have submitted or calculate winner
    const tiedCount = state.tieBreakerState.tiedParticipantIds.length;
    const submittedCount = Object.keys(state.tieBreakerState.submissions).length;

    if (submittedCount >= tiedCount) {
      // Find fastest correct
      const correctSubmissions = Object.values(state.tieBreakerState.submissions)
        .filter((s) => s.isCorrect)
        .sort((a, b) => a.timeTakenMs - b.timeTakenMs);

      if (correctSubmissions.length > 0) {
        const winner = correctSubmissions[0];
        state.tieBreakerState.winnerParticipantId = winner.participantId;
        state.tieBreakerState.isCompleted = true;

        const winnerParticipant = state.participants.find((p) => p.id === winner.participantId);
        if (winnerParticipant) {
          winnerParticipant.scores.tieBreaker += 10;
          winnerParticipant.totalScore += 10;
        }
      }
    }

    broadcastChange();
    return quizStore.getState();
  },

  // ---------------- GENERAL CONFIGURATION & ADMIN ----------------
  updateParticipant: (id: string, updates: Partial<Participant>) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const p = state.participants.find((item) => item.id === id);
    if (p) {
      Object.assign(p, updates);
      p.totalScore = p.scores.round1 + p.scores.round2 + p.scores.round3 + p.scores.tieBreaker;
    }
    broadcastChange();
    return quizStore.getState();
  },

  claimSeat: (seatNumber: number, customName: string, participantId?: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const p = state.participants.find((item) => item.seatNumber === seatNumber);
    if (p) {
      if (p.isClaimed && participantId && p.id !== participantId) {
        return { success: false, reason: 'Seat is already claimed by another participant', state: quizStore.getState() };
      }
      const trimmed = customName.trim();
      p.isClaimed = true;
      p.claimedName = trimmed || p.spiritualName;
      p.name = trimmed || p.name;
      p.spiritualName = trimmed || p.spiritualName;
      p.connected = true;
      p.lastActive = Date.now();
    }
    broadcastChange();
    return { success: true, state: quizStore.getState() };
  },

  releaseSeat: (seatNumber: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const p = state.participants.find((item) => item.seatNumber === seatNumber);
    if (p) {
      p.isClaimed = false;
      p.connected = false;
      p.claimedName = '';
    }
    broadcastChange();
    return quizStore.getState();
  },

  setCustomHostUrl: (url: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.customHostUrl = url.trim();
    broadcastChange();
    return quizStore.getState();
  },

  resetCheckIns: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.participants.forEach((p) => {
      p.isClaimed = false;
      p.connected = false;
      p.claimedName = '';
    });
    broadcastChange();
    return quizStore.getState();
  },

  togglePauseRound: (isPaused: boolean, message?: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.isPaused = isPaused;
    if (message) state.pausedMessage = message;

    if (isPaused) {
      state.timer.isRunning = false;
      if (state.buzzerState.isUnlocked) {
        state.buzzerState.isUnlocked = false;
      }
    } else {
      if (state.timer.secondsLeft > 0) {
        state.timer.isRunning = true;
      }
      if (state.phase === 'ROUND_3_ACTIVE' && !state.round3State.isAnswerRevealed && !state.buzzerState.buzzedParticipantId) {
        state.buzzerState.isUnlocked = true;
      }
    }

    broadcastChange();
    return quizStore.getState();
  },

  undoLastScoreChange: () => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    if (state.lastScoreChange) {
      const { participantId, round, delta } = state.lastScoreChange;
      const p = state.participants.find((item) => item.id === participantId);
      if (p) {
        p.scores[round] -= delta;
        p.totalScore = p.scores.round1 + p.scores.round2 + p.scores.round3 + p.scores.tieBreaker;
      }
      state.lastScoreChange = null;
    }
    broadcastChange();
    return quizStore.getState();
  },

  adjustScoreManually: (participantId: string, round: 'round1' | 'round2' | 'round3' | 'tieBreaker', delta: number) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const p = state.participants.find((item) => item.id === participantId);
    if (p) {
      p.scores[round] += delta;
      p.totalScore = p.scores.round1 + p.scores.round2 + p.scores.round3 + p.scores.tieBreaker;
      state.lastScoreChange = {
        participantId,
        round,
        delta,
        description: `Manual Adjustment (${delta > 0 ? '+' : ''}${delta})`,
        timestamp: Date.now(),
      };
    }
    broadcastChange();
    return quizStore.getState();
  },

  // Question CRUD methods
  addRound1Question: (q: QuestionRound1) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round1Questions.push(q);
    broadcastChange();
    return quizStore.getState();
  },

  deleteRound1Question: (id: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round1Questions = state.round1Questions.filter((q) => q.id !== id);
    if (state.round1State.currentQuestionIndex >= state.round1Questions.length) {
      state.round1State.currentQuestionIndex = Math.max(0, state.round1Questions.length - 1);
    }
    broadcastChange();
    return quizStore.getState();
  },

  addRound2Question: (seatNumber: number, q: { id: string; question: string; answer: string }) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const set = state.round2Sets.find((s) => s.seatNumber === seatNumber);
    if (set) {
      set.questions.push(q);
    } else {
      state.round2Sets.push({ seatNumber, questions: [q] });
    }
    broadcastChange();
    return quizStore.getState();
  },

  deleteRound2Question: (seatNumber: number, id: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    const set = state.round2Sets.find((s) => s.seatNumber === seatNumber);
    if (set) {
      set.questions = set.questions.filter((q) => q.id !== id);
    }
    broadcastChange();
    return quizStore.getState();
  },

  addRound3Question: (q: BuzzerQuestion) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3Questions.push(q);
    broadcastChange();
    return quizStore.getState();
  },

  deleteRound3Question: (id: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3Questions = state.round3Questions.filter((q) => q.id !== id);
    if (state.round3State.currentQuestionIndex >= state.round3Questions.length) {
      state.round3State.currentQuestionIndex = Math.max(0, state.round3Questions.length - 1);
    }
    broadcastChange();
    return quizStore.getState();
  },

  addTieBreakerQuestion: (q: TieBreakerQuestion) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerQuestions.push(q);
    broadcastChange();
    return quizStore.getState();
  },

  deleteTieBreakerQuestion: (id: string) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerQuestions = state.tieBreakerQuestions.filter((q) => q.id !== id);
    broadcastChange();
    return quizStore.getState();
  },

  updateRules: (rules: QuizRules) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.rules = { ...rules };
    broadcastChange();
    return quizStore.getState();
  },

  updateRound1Questions: (questions: QuestionRound1[]) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round1Questions = questions;
    broadcastChange();
    return quizStore.getState();
  },

  updateRound2Sets: (sets: RapidFireSet[]) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round2Sets = sets;
    broadcastChange();
    return quizStore.getState();
  },

  updateRound3Questions: (questions: BuzzerQuestion[]) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.round3Questions = questions;
    broadcastChange();
    return quizStore.getState();
  },

  updateTieBreakerQuestions: (questions: TieBreakerQuestion[]) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    state.tieBreakerQuestions = questions;
    broadcastChange();
    return quizStore.getState();
  },

  bulkUpdateAllQuestions: (payload: {
    round1Questions?: QuestionRound1[];
    round2Sets?: RapidFireSet[];
    round3Questions?: BuzzerQuestion[];
    tieBreakerQuestions?: TieBreakerQuestion[];
  }) => {
    const state = global.__GLOBAL_QUIZ_STATE__!;
    if (payload.round1Questions && Array.isArray(payload.round1Questions)) {
      state.round1Questions = payload.round1Questions;
    }
    if (payload.round2Sets && Array.isArray(payload.round2Sets)) {
      state.round2Sets = payload.round2Sets;
    }
    if (payload.round3Questions && Array.isArray(payload.round3Questions)) {
      state.round3Questions = payload.round3Questions;
    }
    if (payload.tieBreakerQuestions && Array.isArray(payload.tieBreakerQuestions)) {
      state.tieBreakerQuestions = payload.tieBreakerQuestions;
    }
    broadcastChange();
    return quizStore.getState();
  },

  resetQuiz: () => {
    const currentQuestions = {
      r1: global.__GLOBAL_QUIZ_STATE__?.round1Questions,
      r2: global.__GLOBAL_QUIZ_STATE__?.round2Sets,
      r3: global.__GLOBAL_QUIZ_STATE__?.round3Questions,
      tb: global.__GLOBAL_QUIZ_STATE__?.tieBreakerQuestions,
      rules: global.__GLOBAL_QUIZ_STATE__?.rules,
      participants: global.__GLOBAL_QUIZ_STATE__?.participants.map((p) => ({
        ...p,
        totalScore: 0,
        scores: { round1: 0, round2: 0, round3: 0, tieBreaker: 0 },
        isClaimed: false,
        connected: false,
        claimedName: '',
      })),
    };

    const newState: QuizState = JSON.parse(JSON.stringify(INITIAL_QUIZ_STATE));
    if (currentQuestions.r1) newState.round1Questions = currentQuestions.r1;
    if (currentQuestions.r2) newState.round2Sets = currentQuestions.r2;
    if (currentQuestions.r3) newState.round3Questions = currentQuestions.r3;
    if (currentQuestions.tb) newState.tieBreakerQuestions = currentQuestions.tb;
    if (currentQuestions.rules) newState.rules = currentQuestions.rules;
    if (currentQuestions.participants) newState.participants = currentQuestions.participants;

    global.__GLOBAL_QUIZ_STATE__ = newState;
    broadcastChange();
    return quizStore.getState();
  },

  restoreDefaults: () => {
    global.__GLOBAL_QUIZ_STATE__ = JSON.parse(JSON.stringify(INITIAL_QUIZ_STATE));
    broadcastChange();
    return quizStore.getState();
  },
};
