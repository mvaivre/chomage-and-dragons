import test from 'node:test';import assert from 'node:assert/strict';import {VOXEL_ICONS,ICON_NAMES}from'../src/lib/game/voxel-icons.ts';
test('all voxel UI models share a bounded optical frame and a small static geometry budget',()=>{
 assert.ok(ICON_NAMES.length>=40);
 for(const name of ICON_NAMES){const faces=VOXEL_ICONS[name];assert.ok(faces.length>=3&&faces.length<=120,`${name}: bounded DOM cost`);const points=faces.flatMap(f=>{assert.match(f.fill,/^#[a-f0-9]{6}$/i);return f.points.split(' ').map(p=>p.split(',').map(Number));});
  for(const p of points)assert.ok(p.every(v=>Number.isFinite(v)&&v>=5.9&&v<=58.1),`${name}: no clipped face`);
  for(const axis of[0,1])assert.ok(Math.abs(Math.min(...points.map(p=>p[axis]))+Math.max(...points.map(p=>p[axis]))-64)<.02,`${name}: same visual centre`);
 }
 assert.equal(new Set(Object.values(VOXEL_ICONS).map(f=>JSON.stringify(f))).size,ICON_NAMES.length,'each symbol has a distinct model');
});
