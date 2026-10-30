import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('@/') ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context);
} });
const { t, LANGUAGES, setLocale, localeTag } = await import('../src/lib/i18n/index.ts');
const { default: messages } = await import('../src/lib/i18n/messages.json', {with:{type:'json'}});
const { default: overrides } = await import('../src/lib/i18n/overrides.json', {with:{type:'json'}});
const { CHARACTERS } = await import('../src/lib/game/characters.ts');
const { REQUIRED_BANK } = await import('../src/lib/game/keyword-rain.ts');
const { MINI_GAMES } = await import('../src/lib/game/mini-games.ts');
const { monthKey, monthLabel } = await import('../src/lib/game/calendar.ts');
const catalog={...messages,...overrides};
const placeholders=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
test('all four catalogues cover character selection, keywords and every mini-game with intact placeholders',()=>{
  for(const [source,translations] of Object.entries(catalog)) {
    assert.equal(translations.length,4,source);
    for(const translated of translations){assert.ok(translated.trim(),source);assert.deepEqual(placeholders(translated),placeholders(source),source);}
  }
  for(const source of [...CHARACTERS.flatMap(c=>[c.name,c.blurb]),...REQUIRED_BANK,...Object.values(MINI_GAMES).flatMap(g=>[g.title,g.misery,g.winFeedback])]) assert.ok(catalog[source],`Missing copy: ${source}`);
});
test('language changes format presentation without translating names, mutating records or changing season keys',()=>{
  const source={players:[{name:'Courage',characterId:'barde'}],events:[{kind:'candidature',at:'2026-10-30T12:00:00Z'}]};
  const before=JSON.stringify(source);
  for(const locale of LANGUAGES) {
    setLocale(locale);
    assert.equal(t('Saluer {0}',[source.players[0].name]).includes('Courage'),true);
    assert.equal(monthKey(new Date('2026-10-30T12:00:00Z')),'2026-10');
    assert.ok(monthLabel('2026-10').includes('2026'));
    assert.equal(JSON.stringify(source),before);
    assert.equal(t(17),17);
    assert.equal(t('Unknown user name'), 'Unknown user name');
    assert.match(localeTag(),/^[a-z]{2}-[A-Z]{2}$/);
  }
  setLocale('fr');
});
test('saved French messages display in the chosen language, including correct plurals and whitespace',()=>{
 assert.equal(t('Encore {0} tour{1}',[1,''],'de'),'Noch 1 Turm');
 assert.equal(t('Encore {0} tour{1}',[2,'s'],'de'),'Noch 2 Türme');
 assert.equal(t('Encore 2 tours',undefined,'it'),'Restano 2 torri');
 assert.equal(t('  +2 pas ',undefined,'en'),'  +2 steps ');
 assert.equal(t('{0} capturé !',['CV-3000'],'es'),'¡CV-3000 capturado!');
 assert.equal(t('Choisis ton univers',undefined,'fr'),'Choisis ton univers');
});

test('employment and fantasy terms keep their domain meaning in every language',()=>{
 for(const [locale,chest,interview] of [['en','Open the chest','Start the interview'],['de','Truhe öffnen','Vorstellungsgespräch beginnen'],['es','Abrir el cofre','Comenzar la entrevista'],['it','Apri il forziere','Inizia il colloquio']]) {
  assert.equal(t('Ouvrir le coffre',undefined,locale),chest);
  assert.equal(t('Commencer l’entretien',undefined,locale),interview);
  assert.equal(t('Chômage & Dragons',undefined,locale),'Chômage & Dragons');
 }
});
