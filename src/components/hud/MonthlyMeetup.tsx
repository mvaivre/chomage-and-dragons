"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { MonthlyMeetup as Meetup } from "@/lib/data/types";
import { monthKey, monthLabel } from "@/lib/game/calendar";
import {
  editableMeetupMonths, meetupDateLabel, meetupLatestInput, monthClosesAt,
  monthCountdown, shiftMeetupMonth, validateMeetupInput, zurichDateTimeInput, zurichInputToIso,
} from "@/lib/game/monthly-meetup";
import "./monthly-meetup.css";

interface Props {
  meetups: Meetup[];
  playerId: string | null;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSchedule: (playerId: string, monthKey: string, at: string, place: string) => { meetup: Meetup | null; rejected?: string };
}

/** The crown's deadline and the drink's date are deliberately separate. */
export function MonthlyMeetup({ meetups, playerId, onSchedule, disabled = false, onOpenChange }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const dateId = useId();
  const placeId = useId();
  const monthId = useId();
  const isEditing = editing !== null;
  const current = monthKey(now);
  const currentMeetup = meetups.find((meetup) => meetup.monthKey === current);
  const previousMeetup = meetups.find((meetup) => meetup.monthKey === shiftMeetupMonth(current, -1) && Date.parse(meetup.at) > now.getTime());
  const availableMonths = editableMeetupMonths(now);

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(isEditing);
    if (!isEditing) return;
    dialog.current?.showModal();
    return () => { onOpenChange?.(false); opener.current?.focus(); };
  }, [isEditing, onOpenChange]);

  const fillMonth = (key: string, instant: Date) => {
    const meetup = meetups.find((item) => item.monthKey === key);
    const latest = Date.parse(zurichInputToIso(meetupLatestInput(key))!);
    const suggested = Math.min(latest, Math.max(monthClosesAt(key) - 5 * 3_600_000, instant.getTime() + 24 * 3_600_000));
    setEditing(key);
    setDate(meetup ? zurichDateTimeInput(new Date(meetup.at)) : zurichDateTimeInput(new Date(suggested)));
    setPlace(meetup?.place ?? "");
    setError(null);
  };
  const open = (key: string) => {
    const instant = new Date();
    setNow(instant);
    opener.current = document.activeElement as HTMLElement | null;
    fillMonth(key, instant);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!playerId || !editing) return;
    const at = zurichInputToIso(date);
    if (!at) { setError("Cette heure n’existe pas ou apparaît deux fois lors du changement d’heure. Choisis une autre heure."); return; }
    const rejected = validateMeetupInput(editing, at, place, new Date());
    if (rejected) { setError(rejected); return; }
    const result = onSchedule(playerId, editing, at, place);
    if (result.rejected) { setError(result.rejected); return; }
    setEditing(null);
  };

  return <>
    <section className="monthly-meetup pointer-events-auto" aria-label="Couronne et verre du mois">
      <div className="monthly-meetup__clock">
        <span>Couronne · {monthLabel(current).split(" ")[0]}</span>
        <time dateTime={new Date(monthClosesAt(current)).toISOString()} title="Clôture du classement à minuit, heure de Zurich">
          {monthCountdown(current, now)}
        </time>
      </div>
      <button type="button" className="monthly-meetup__date" onClick={() => open(current)} disabled={!playerId || disabled}>
        <span aria-hidden="true">🍻</span>
        <span><small>Verre du mois</small><b>{currentMeetup ? meetupDateLabel(currentMeetup.at) : "Une date à choisir"}</b>
          {currentMeetup?.place ? <em>{currentMeetup.place}</em> : null}</span>
        {playerId ? <span className="monthly-meetup__edit">{currentMeetup ? "Changer" : "Fixer"}</span> : null}
      </button>
      {previousMeetup ? <button type="button" className="monthly-meetup__previous" onClick={() => open(previousMeetup.monthKey)} disabled={!playerId || disabled}>
        Verre de {monthLabel(previousMeetup.monthKey).split(" ")[0]} · {meetupDateLabel(previousMeetup.at)}
        {previousMeetup.place ? ` · ${previousMeetup.place}` : ""}
      </button> : null}
    </section>
    {editing !== null ? <dialog className="meetup-editor pointer-events-auto" aria-labelledby={titleId} ref={dialog}
      onKeyDown={(event) => event.stopPropagation()} onCancel={() => setEditing(null)} onClose={() => setEditing(null)}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setEditing(null);
      }}>
        <div className="meetup-editor__head">
          <h3 id={titleId}>On trinque quand ?</h3>
          <button type="button" onClick={() => setEditing(null)} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor={monthId}>Verre de la couronne de</label>
          <select id={monthId} value={editing} onChange={(event) => fillMonth(event.target.value, new Date())}>
            {availableMonths.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
          </select>
          <label htmlFor={dateId}>Date et heure · Zurich</label>
          <input id={dateId} type="datetime-local" value={date} min={zurichDateTimeInput(new Date(now.getTime() + 60_000))}
            max={meetupLatestInput(editing)} step={60} onChange={(event) => setDate(event.target.value)} required autoFocus />
          <label htmlFor={placeId}>Lieu <span>(facultatif)</span></label>
          <input id={placeId} type="text" value={place} maxLength={80} placeholder="La taverne de votre choix" onChange={(event) => setPlace(event.target.value)} />
          <p className="meetup-editor__hint">Toute la compagnie peut changer la date. La couronne reste décernée à la fin du mois.</p>
          {error ? <p className="meetup-editor__error" role="alert">{error}</p> : null}
          <button type="submit" className="meetup-editor__save">{meetups.some((m) => m.monthKey === editing) ? "Changer le rendez-vous" : "Fixer le rendez-vous"}</button>
        </form>
    </dialog> : null}
  </>;
}
