import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueTokens, letterDelay } from '../src/lib/game/dialogue-text.ts';

test('typed punchlines retain exact accents, punctuation, spaces and stable character positions', () => {
  for (const line of ["Error 404 : ton potentiel est porté disparu…", "À 7h12, l’énergie du lundi démissionne !", "Les pommes de terre ont trois ans d’expérience.", "", "L’ombre 🐉 garde le brouillon."]) {
    const tokens = dialogueTokens(line);
    assert.equal(tokens.map(t => t.text).join(''), line);
    for (const token of tokens) assert.equal(line.slice(token.start, token.start + token.text.length), token.text);
  }
  const tokens = dialogueTokens("Error 404 : ton potentiel est porté disparu…");
  assert.ok(tokens.some(t => t.text === 'Error 404' && t.emphasis));
  assert.ok(tokens.some(t => t.text === 'potentiel' && t.emphasis));
  assert.ok(letterDelay('…') > letterDelay(','));
  assert.ok(letterDelay(',') > letterDelay('a'));
});
