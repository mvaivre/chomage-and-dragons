"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { MonthlyMeetup as Meetup } from "@/lib/data/types";
import { monthKey, monthLabel } from "@/lib/game/calendar";
import { editableMeetupMonths, meetupDateLabel, meetupFill, meetupLatestInput, monthClosesAt, monthCountdown, nextMeetup, validateMeetupInput, zurichDateTimeInput, zurichInputToIso } from "@/lib/game/monthly-meetup";
interface Props {
    meetups: Meetup[];
    playerId: string | null;
    disabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSchedule: (playerId: string, monthKey: string, at: string, place: string) => {
        meetup: Meetup | null;
        rejected?: string;
    };
}
/** The crown's deadline and the drink's date are deliberately separate. */
export function MonthlyMeetup({ meetups, playerId, onSchedule, disabled = false, onOpenChange }: Props) {
    const uiLocale = useLocale();
    const [now, setNow] = useState(() => new Date());
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [date, setDate] = useState("");
    const [place, setPlace] = useState("");
    const [error, setError] = useState<string | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const opener = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const dateId = useId();
    const placeId = useId();
    const monthId = useId();
    const current = monthKey(now);
    const upcoming = nextMeetup(meetups, now);
    const fill = meetupFill(upcoming, now);
    const availableMonths = editableMeetupMonths(now);
    useEffect(() => {
        const update = () => setNow(new Date());
        const timer = window.setInterval(update, 30000);
        window.addEventListener("focus", update);
        document.addEventListener("visibilitychange", update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", update);
            document.removeEventListener("visibilitychange", update);
        };
    }, []);
    useEffect(() => {
        if (!open) return;
        const node = dialog.current;
        node?.showModal();
        const trigger = opener.current;
        return () => { node?.close(); trigger?.focus(); };
    }, [open]);
    const close = () => {
        setOpen(false);
        setEditing(null);
        onOpenChange?.(false);
    };
    const fillMonth = (key: string, instant: Date) => {
        const meetup = meetups.find((item) => item.monthKey === key);
        const latest = Date.parse(zurichInputToIso(meetupLatestInput(key))!);
        const suggested = Math.min(latest, Math.max(monthClosesAt(key) - 5 * 3600000, instant.getTime() + 24 * 3600000));
        setEditing(key);
        setDate(zurichDateTimeInput(new Date(meetup && Date.parse(meetup.at) > instant.getTime() ? meetup.at : suggested)));
        setPlace(meetup?.place ?? "");
        setError(null);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!playerId || !editing)
            return;
        const at = zurichInputToIso(date);
        if (!at) {
            setError("Changement d’heure : choisis une autre heure.");
            return;
        }
        const rejected = validateMeetupInput(editing, at, place, new Date());
        if (rejected) {
            setError(rejected);
            return;
        }
        const result = onSchedule(playerId, editing, at, place);
        if (result.rejected) {
            setError(result.rejected);
            return;
        }
        setEditing(null);
    };
    return <>
      <button type="button" ref={opener} className="company-button meetup-trigger" aria-haspopup="dialog"
        aria-label={tr("Prochain verre", undefined, uiLocale)}
        title={upcoming ? [meetupDateLabel(upcoming.at), upcoming.place].filter(Boolean).join(" · ") : tr("Prochain verre", undefined, uiLocale)}
        disabled={disabled} onClick={() => { setNow(new Date()); setOpen(true); onOpenChange?.(true); }}>
        <span className="meetup-mug" aria-hidden="true"><span className="meetup-mug__glass">
          <span className="meetup-mug__fill" style={{ height: `${fill * 100}%` }} />
        </span></span>
      </button>
    {open ? <dialog className="meetup-editor pointer-events-auto" aria-labelledby={titleId} ref={dialog} onKeyDown={(event) => event.stopPropagation()} onCancel={event => { event.preventDefault(); close(); }} onClick={(event) => {
                if (event.target !== event.currentTarget)
                    return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
                    close();
            }}>
        <div className="meetup-editor__head">
          <h3 id={titleId}>{tr("Prochain verre", undefined, uiLocale)}</h3>
          <button type="button" onClick={close} aria-label={tr("Fermer", undefined, uiLocale)}>×</button>
        </div>
        {editing === null ? <>
          <div className="meetup-summary">
            {upcoming ? <>
              <time dateTime={upcoming.at}>{meetupDateLabel(upcoming.at)}</time>
              <p>{upcoming.place || tr("Lieu à préciser", undefined, uiLocale)}</p>
            </> : <p>{tr("Une date à choisir", undefined, uiLocale)}</p>}
          </div>
          <p className="meetup-editor__hint">
            {tr("Couronne · ", undefined, uiLocale)}{tr(monthLabel(current).split(" ")[0], undefined, uiLocale)} · <time dateTime={new Date(monthClosesAt(current)).toISOString()}>{tr(monthCountdown(current, now), undefined, uiLocale)}</time>
          </p>
          {playerId ? <button type="button" className="meetup-editor__save" onClick={() => fillMonth(upcoming && availableMonths.includes(upcoming.monthKey) ? upcoming.monthKey : current, new Date())}>
            {tr(upcoming ? "Changer le rendez-vous" : "Fixer le rendez-vous", undefined, uiLocale)}
          </button> : null}
        </> : <form onSubmit={submit}>
          <label htmlFor={monthId}>{tr("Mois de la couronne", undefined, uiLocale)}</label>
          <select id={monthId} value={editing} onChange={(event) => fillMonth(event.target.value, new Date())}>
            {availableMonths.map((key) => <option key={key} value={key}>{tr(monthLabel(key), undefined, uiLocale)}</option>)}
          </select>
          <label htmlFor={dateId}>{tr("Date et heure · Zurich", undefined, uiLocale)}</label>
          <input id={dateId} type="datetime-local" value={date} min={zurichDateTimeInput(new Date(now.getTime() + 60000))} max={meetupLatestInput(editing)} step={60} onChange={(event) => setDate(event.target.value)} required autoFocus/>
          <label htmlFor={placeId}>{tr("Lieu ", undefined, uiLocale)}<span>{tr("(facultatif)", undefined, uiLocale)}</span></label>
          <input id={placeId} type="text" value={place} maxLength={80} placeholder={tr("Lieu du rendez-vous", undefined, uiLocale)} onChange={(event) => setPlace(event.target.value)}/>
          <p className="meetup-editor__hint">{tr("Tout le groupe peut modifier ce rendez-vous", undefined, uiLocale)}</p>
          {error ? <p className="meetup-editor__error" role="alert">{tr(error, undefined, uiLocale)}</p> : null}
          <button type="submit" className="meetup-editor__save">{tr(meetups.some((m) => m.monthKey === editing) ? "Changer le rendez-vous" : "Fixer le rendez-vous", undefined, uiLocale)}</button>
        </form>}
    </dialog> : null}
  </>;
}
