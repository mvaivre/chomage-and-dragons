import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, Graphics, Rectangle, Sprite, Texture, TextureSource} from 'pixi.js';
import {roomTextures} from '../src/components/game/roomTextures.ts';

test('room prewarming survives display-object teardown and uploads each shared atlas only once', () => {
  const source = new TextureSource({width: 32, height: 16});
  const left = new Texture({source, frame: new Rectangle(0, 0, 16, 16)});
  const right = new Texture({source, frame: new Rectangle(16, 0, 16, 16)});
  const room = new Container(), nested = new Container();
  room.addChild(nested);
  nested.addChild(new Sprite(left), new Sprite(right));
  const drawing = new Graphics().rect(0, 0, 20, 20).fill(0xff0000);
  room.addChild(drawing);

  const queued = roomTextures([room, nested]);
  assert.deepEqual(queued, [source], 'atlas frames share one upload, geometry stays out of the async queue');
  room.destroy({children: true});
  assert.equal(drawing.context, null, 'a queued Graphics would now have an invalid context');
  assert.equal(queued[0].destroyed, false, 'the shared texture remains safe to upload after the room unmounts');
  assert.deepEqual(roomTextures([room]), []);
  left.destroy(); right.destroy(); source.destroy();
});
