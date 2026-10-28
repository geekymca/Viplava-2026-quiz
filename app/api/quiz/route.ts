import { NextRequest, NextResponse } from 'next/server';
import { quizStore } from '@/lib/quizStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = quizStore.getState();
    return NextResponse.json({ success: true, state });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }
    const { action, payload = {} } = body || {};

    let result: unknown = null;

    switch (action) {
      case 'get_state':
        result = quizStore.getState();
        break;

      case 'set_phase':
        result = quizStore.setPhase(payload.phase);
        break;

      case 'set_timer':
        result = quizStore.setTimer(payload.secondsLeft, payload.isRunning);
        break;

      // Round 1
      case 'set_round1_question':
        result = quizStore.setRound1Question(payload.questionIndex);
        break;

      case 'pass_round1_question':
        result = quizStore.passRound1Question();
        break;

      case 'select_round1_option':
        result = quizStore.selectRound1Option(payload.optionIndex);
        break;

      case 'check_round1_answer':
        result = quizStore.checkRound1Answer(payload?.optionIndex);
        break;

      case 'mark_round1_answer':
        result = quizStore.markRound1Answer(payload.isCorrect);
        break;

      case 'reveal_round1_answer':
        result = quizStore.revealRound1Answer();
        break;

      case 'reset_round1_question_attempt':
        result = quizStore.resetRound1QuestionAttempt();
        break;

      // Round 2
      case 'set_rapid_seat':
        result = quizStore.setRapidFireSeat(payload.seatNumber);
        break;

      case 'record_rapid_answer':
        result = quizStore.recordRapidFireAnswer(payload.isCorrect);
        break;

      // Round 3
      case 'set_round3_question':
        result = quizStore.setRound3Question(payload.questionIndex);
        break;

      case 'unlock_buzzer':
        result = quizStore.unlockBuzzer();
        break;

      case 'lock_buzzer':
        result = quizStore.lockBuzzer();
        break;

      case 'press_buzzer':
        result = quizStore.pressBuzzer(payload.participantId);
        break;

      case 'select_buzzer_option':
        result = quizStore.selectBuzzerOption(payload.participantId, payload.optionIndex);
        break;

      case 'check_round3_answer':
        result = quizStore.checkRound3Answer(payload?.optionIndex);
        break;

      case 'mark_buzzer_answer':
        result = quizStore.markBuzzerAnswer(payload.isCorrect);
        break;

      case 'reveal_round3_answer':
        result = quizStore.revealRound3Answer();
        break;

      case 'reset_round3_question_attempt':
        result = quizStore.resetRound3QuestionAttempt();
        break;

      // Tie Breaker
      case 'init_tie_breaker':
        result = quizStore.initTieBreaker(payload.tiedParticipantIds);
        break;

      case 'launch_tie_breaker_question':
        result = quizStore.launchTieBreakerQuestion();
        break;

      case 'set_tie_breaker_question':
        result = quizStore.setTieBreakerQuestion(payload.questionIndex);
        break;

      case 'submit_tie_breaker_answer':
        result = quizStore.submitTieBreakerAnswer(
          payload.participantId,
          payload.optionIndex,
          payload.timeTakenMs
        );
        break;

      // Pause / Resume Round
      case 'toggle_pause_round':
        result = quizStore.togglePauseRound(payload.isPaused, payload.message);
        break;

      case 'undo_last_score_change':
        result = quizStore.undoLastScoreChange();
        break;

      // Question CRUD
      case 'add_round1_question':
        result = quizStore.addRound1Question(payload.question);
        break;

      case 'delete_round1_question':
        result = quizStore.deleteRound1Question(payload.id);
        break;

      case 'add_round2_question':
        result = quizStore.addRound2Question(payload.seatNumber, payload.question);
        break;

      case 'delete_round2_question':
        result = quizStore.deleteRound2Question(payload.seatNumber, payload.id);
        break;

      case 'add_round3_question':
        result = quizStore.addRound3Question(payload.question);
        break;

      case 'delete_round3_question':
        result = quizStore.deleteRound3Question(payload.id);
        break;

      case 'add_tie_breaker_question':
        result = quizStore.addTieBreakerQuestion(payload.question);
        break;

      case 'delete_tie_breaker_question':
        result = quizStore.deleteTieBreakerQuestion(payload.id);
        break;

      // Management & Admin
      case 'claim_seat':
        result = quizStore.claimSeat(payload.seatNumber, payload.name || '', payload.participantId);
        break;

      case 'release_seat':
        result = quizStore.releaseSeat(payload.seatNumber);
        break;

      case 'set_custom_host_url':
        result = quizStore.setCustomHostUrl(payload.url);
        break;

      case 'reset_check_ins':
        result = quizStore.resetCheckIns();
        break;

      case 'update_participant':
        result = quizStore.updateParticipant(payload.id, payload.updates);
        break;

      case 'adjust_score':
        result = quizStore.adjustScoreManually(payload.participantId, payload.round, payload.delta);
        break;

      case 'update_rules':
        result = quizStore.updateRules(payload.rules);
        break;

      case 'update_round1_questions':
        result = quizStore.updateRound1Questions(payload.questions);
        break;

      case 'update_round2_sets':
        result = quizStore.updateRound2Sets(payload.sets);
        break;

      case 'update_round3_questions':
        result = quizStore.updateRound3Questions(payload.questions);
        break;

      case 'update_tie_breaker_questions':
        result = quizStore.updateTieBreakerQuestions(payload.questions);
        break;

      case 'bulk_update_all_questions':
        result = quizStore.bulkUpdateAllQuestions(payload);
        break;

      case 'reset_quiz':
        result = quizStore.resetQuiz();
        break;

      case 'restore_defaults':
        result = quizStore.restoreDefaults();
        break;

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
      state: quizStore.getState(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
