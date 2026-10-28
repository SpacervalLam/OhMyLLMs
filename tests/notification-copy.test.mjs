import test from 'node:test';
import assert from 'node:assert/strict';
import {COPY,MODEL_MAP,MODELS,NOTICES} from '../dist/data.js';
import {GardenGame} from '../dist/engine.js';

const LANGS=['zh','en','ja'];

test('field-guide descriptions keep hidden triggers and recovery instructions out of all languages',()=>{
 for(const lang of LANGS){
  const claude=MODEL_MAP.claude;
  const text=[claude.role[lang],claude.desc[lang],claude.quote[lang],MODEL_MAP.grok.desc[lang]].join(' ');
  assert.doesNotMatch(text,/罢工|彩蛋|切换|地区|strike|Easter|Switch to|unsupported|ストライキ|ネタON|復帰|Elon/i);
 }
});

test('every deployable model carries its own vendor quota and rate-limit notice in all languages',()=>{
 for(const m of MODELS){
  const notice=NOTICES[m.id];
  assert.ok(notice,`missing NOTICES entry for ${m.id}`);
  for(const lang of LANGS){
   for(const key of ['quota','rateLimit']){
    const text=notice[key][lang];
    assert.ok(text&&text.length>0,`${m.id}.${key}.${lang} is empty`);
    assert.doesNotMatch(text,/\{\w+\}/,`${m.id}.${key}.${lang} has an unresolved placeholder`);
   }
  }
 }
 // 覆盖全部 9 个可部署模型，且没有多余条目。
 assert.deepEqual(Object.keys(NOTICES).sort(),MODELS.map(m=>m.id).sort());
});

test('vendor notices keep the provider name visible so players can tell them apart',()=>{
 for(const m of MODELS){
  for(const lang of LANGS){
   const text=NOTICES[m.id].quota[lang]+NOTICES[m.id].rateLimit[lang];
   assert.ok(text.includes(m.name)||NOTICES[m.id].quota[lang]!==NOTICES[m.id].rateLimit[lang],`${m.id} notices are indistinguishable in ${lang}`);
  }
 }
 assert.equal(NOTICES.chatgpt.quota.en,'You’ve reached your ChatGPT usage limit.');
 assert.equal(NOTICES.chatgpt.rateLimit.en,'Selected model is capacity, please try a different model');
});

test('quota notifications localize the actual deployment budget without changing game state',()=>{
 for(const lang of LANGS){
  const g=new GardenGame({lang,starter:false});g.tokens=1;
  assert.equal(g.plant('chatgpt',0,0).reason,'lackTokens');assert.equal(g.tokens,1);assert.equal(g.units.length,0);
  const copy=COPY[lang];assert.match(copy.lackTokens,/ChatGPT/);
  const detail=copy.lackTokensHint.replace('{available}',g.tokens).replace('{required}',MODEL_MAP.chatgpt.cost);
  assert.ok(detail.includes('1'));assert.ok(detail.includes(String(MODEL_MAP.chatgpt.cost)));assert.doesNotMatch(detail,/\{\w+\}/);
  assert.ok(copy.strike&&copy.strikeHint);
 }
 assert.equal(COPY.en.strike,'Your account is on hold');
 assert.equal(COPY.en.cooldown,'Selected model is capacity, please try a different model');
});

test('cooldown notice reports the remaining recharge time per language',()=>{
 for(const lang of LANGS){
  const g=new GardenGame({lang,starter:false});
  g.phase='playing';g.cooldowns.chatgpt=4.2;
  assert.equal(g.plant('chatgpt',0,0).reason,'cooldown');
  const detail=COPY[lang].cooldownHint.replace('{seconds}',Math.ceil(g.cooldowns.chatgpt));
  assert.ok(detail.includes('5'),`${lang} cooldown hint should round up: ${detail}`);
  assert.doesNotMatch(detail,/\{\w+\}/);
 }
});
