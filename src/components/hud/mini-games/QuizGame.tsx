"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameResult } from "@/lib/data/types";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { seedFrom } from "@/lib/game/random";
import { QUIZ, dealQuiz, quizPassed } from "@/lib/game/personality-quiz";
import { ActionArtwork } from "../Artwork";
import { MiniGameShell, type MiniGameProps } from "./MiniGameShell";

type QuizStatus = "ready" | "question" | "reveal" | "won" | "lost";
const SILENCE = "Le silence, c’est non.";

/** Five questions, one corporate answer each, a few seconds to find it. */
export function QuizGame({ seedId, onResolve, onDone, practice }: MiniGameProps) {
  const [questions] = useState(() => dealQuiz(seedFrom(seedId)));
  const [status, setStatus] = useState<QuizStatus>("ready");
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [aside, setAside] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MiniGameResult | null>(null);
  const resolved = useRef<MiniGameResult | null>(null);
  const timer = useRef<HTMLSpanElement>(null);
  const deadline = useRef(0);
  const timeouts = useRef<number[]>([]);
  const base = JOURNEY_STEPS.entretien;
  const bonus = MINI_GAME_BONUS.entretien;
  const question = questions[Math.min(index, questions.length - 1)];

  useEffect(() => () => { timeouts.current.forEach(id => window.clearTimeout(id)); }, []);
  const later = (ms: number, run: () => void) => { timeouts.current.push(window.setTimeout(run, ms)); };

  const settle = useCallback((result: MiniGameResult) => {
    if (resolved.current) return;
    resolved.current = result;
    setOutcome(result);
    onResolve(result);
  }, [onResolve]);

  const finish = useCallback((score: number) => {
    const passed = quizPassed(score);
    setStatus(passed ? "won" : "lost");
    settle(passed ? "won" : "lost");
  }, [settle]);

  const answer = useCallback((choice: number | null) => {
    if (status !== "question") return;
    const good = choice === question.correct;
    const score = correct + (good ? 1 : 0);
    setChosen(choice);
    setCorrect(score);
    setAside(choice === null ? SILENCE : good ? question.aside : "Hmm. Honnête. Dommage.");
    setStatus("reveal");
    later(1400, () => {
      if (index + 1 >= questions.length) finish(score);
      else { setIndex(index + 1); setChosen(null); setAside(null); setStatus("question"); }
    });
  }, [status, question, correct, index, questions.length, finish]);
  const answerRef = useRef(answer);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  // The countdown bar and its deadline, per question.
  useEffect(() => {
    if (status !== "question") return;
    deadline.current = performance.now() + QUIZ.secondsPerQuestion * 1000;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline.current - performance.now());
      if (timer.current) timer.current.style.width = `${left / (QUIZ.secondsPerQuestion * 1000) * 100}%`;
      if (left <= 0) { answerRef.current(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, index]);

  const leave = () => {
    if (!resolved.current) settle("skipped");
    onDone();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (status !== "question" || event.repeat) return;
    const digit = Number(event.key);
    if (digit >= 1 && digit <= 4) { event.preventDefault(); answer(digit - 1); }
  };

  const won = outcome === "won";
  const finished = status === "won" || status === "lost";
  const instructions = finished
    ? won ? `Quatre bonnes réponses : mensonge avec panache. L’entretien ne recule que de ${-(base + bonus)} pas.` : "Trop honnête. Trois pas en arrière, comme prévu."
    : status === "ready"
      ? `Le cabinet Hydre & Fils teste ta personnalité. ${QUIZ.questions} questions, ${QUIZ.secondsPerQuestion} secondes chacune : réponds ce que le recruteur veut entendre, pas la vérité.`
      : `Question ${index + 1} sur ${questions.length}. Touche une réponse, ou 1 à 4 au clavier.`;

  return <MiniGameShell kind="quiz" eyebrow={`${practice ? "Entraînement · " : ""}« Quel est votre plus grand défaut ? » · ${base} pas`} title="Le Test de personnalité"
    instructions={instructions} onKeyDown={onKeyDown} onLeave={leave} focusKey={status}
    hud={<>
      <span className="mini-game__counter"><b>{Math.min(index + (finished ? 1 : 0), questions.length)}</b> / {questions.length} questions</span>
      <span className="mini-game__progress"><span style={{ width: `${(index + (finished || status === "reveal" ? 1 : 0)) / questions.length * 100}%` }} /></span>
      <span className="mini-game__score"><b>{correct}</b> ✓ sur {QUIZ.needed} requises</span>
    </>}
    status={finished ? <><strong>{won ? `${base + bonus} pas au lieu de ${base}` : `${base} pas`}</strong><span>{won ? `Recul réduit d’un pas grâce au mensonge` : "Le recul prévu. Rien de plus."}</span></> :
      <span>{status === "ready" ? `Une seule tentative · ${QUIZ.needed} bonnes réponses sur ${QUIZ.questions}` : status === "reveal" && aside ? `Le recruteur : « ${aside} »` : "La bonne réponse est celle du recruteur, pas la tienne."}</span>}
    primary={{
      label: finished ? "Continuer le voyage" : status === "ready" ? "Commencer l’entretien" : "Réponds ci-dessus…",
      disabled: status === "question" || status === "reveal",
      onClick: () => finished ? onDone() : setStatus("question"),
    }}
    skip={!finished ? { label: "Rester honnête (−3 pas)", onClick: leave } : null}>
    <div className="mini-game__arena mini-game__arena--panel quiz" data-status={status} data-question={index}>
      <div className="quiz__scene">
        <ActionArtwork kind="entretien" className="quiz__art" />
        <div className="quiz__bubble">
          {status === "ready" ? <p>« Asseyez-vous. Ce ne sera pas long. Enfin, pour vous. »</p>
            : finished ? <p>{won ? "« Vous êtes exactement ce que nous cherchons. Enfin, ce que vous avez dit. »" : "« Nous reviendrons vers vous. » (Non.)"}</p>
            : <p>« {question.prompt} »</p>}
          {status === "question" ? <span className="quiz__timer" aria-hidden><span ref={timer} /></span> : null}
        </div>
      </div>
      {status === "question" || status === "reveal" ? <div className="quiz__answers">
        {question.answers.map((text, i) => <button key={text} type="button" className="quiz__answer" disabled={status !== "question"}
          data-state={status === "reveal" ? (i === question.correct ? "correct" : i === chosen ? "wrong" : "dim") : undefined}
          onClick={() => answer(i)}><b>{i + 1}</b> {text}</button>)}
      </div> : null}
      {finished ? <span className="mini-game__stamp" aria-hidden>{won ? "PROFIL RETENU… POUR L’INSTANT" : "TROP HONNÊTE"}</span> : null}
    </div>
  </MiniGameShell>;
}
