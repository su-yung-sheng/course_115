/* 程式設計的教學影片改放雲端硬碟（11501/flowchart.html）
   跑法：node shared/tests/videodrive.test.js

   ⛔ 老師 2026-10-20：學生的學校帳號被標成「未滿 18 歲」，學校沒有開放 YouTube，
      嵌在頁面裡的示範影片全部顯示「貴組織不允許存取」。影片是老師自己錄的
      ⇒ 改放雲端硬碟。這份守的是：
        · 貼整條分享連結就能用（老師不必自己挑出 ID）
        · 還沒換的關卡照舊播 YouTube（可以一關一關換）
        · 十關一關都不能漏（對照表和 PROG 的關卡要一一對上）
        · 播放器下面一定有「看不到怎麼辦」 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, l) => { c ? pass++ : fail++; console.log((c ? '  ✅ ' : '  ❌ ') + l); };
const section = t => console.log('\n── ' + t + ' ──');

const H = fs.readFileSync(path.join(ROOT, '11501', 'flowchart.html'), 'utf8');
const s = H.indexOf('const VIDEO_DRIVE = {');
const e = H.indexOf('// 各單元的程式設計素材');
const progS = H.indexOf('const PROG = {');
const progE = H.indexOf('\n    };', progS) + 7;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(H.slice(s, e) + '\n' + "const G='';\n" + H.slice(progS, progE) +
  '\nthis.VIDEO_DRIVE = VIDEO_DRIVE; this.driveId = driveId; this.videoHTML = videoHTML; this.PROG = PROG;', ctx);

section('① 貼什麼都認得');
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
ok(ctx.driveId('https://drive.google.com/file/d/' + ID + '/view?usp=sharing') === ID, '★★★ 整條「共用 → 複製連結」直接貼');
ok(ctx.driveId('https://drive.google.com/file/d/' + ID + '/view?usp=drive_link') === ID, '新版的 drive_link 連結');
ok(ctx.driveId('https://drive.google.com/open?id=' + ID) === ID, '舊式 open?id= 連結');
ok(ctx.driveId('  ' + ID + '  ') === ID, '只貼 ID（前後有空白）也可以');
ok(ctx.driveId('') === '' && ctx.driveId('https://www.youtube.com/watch?v=84cCkGKsPsI') === '',
   '★ 空白、或貼錯成 YouTube 連結 ⇒ 認不出來（照舊播 YouTube，不會變成壞掉的播放器）');

section('② 有雲端硬碟用雲端硬碟，沒有照舊 YouTube');
ctx.VIDEO_DRIVE['2-1-1A'] = 'https://drive.google.com/file/d/' + ID + '/view?usp=sharing';
const a = ctx.videoHTML('2-1-1A', ctx.PROG['2-1-1A']);
ok(a.includes('https://drive.google.com/file/d/' + ID + '/preview') && !a.includes('youtube.com'),
   '★★★ 填了雲端硬碟 ⇒ 播雲端硬碟（/preview），完全不碰 YouTube');
ok(/在雲端硬碟開啟/.test(a) && a.includes('/file/d/' + ID + '/view'), '★★ 下面有「在雲端硬碟開啟」的備用連結');
const b = ctx.videoHTML('2-1-1B', ctx.PROG['2-1-1B']);
ok(b.includes('https://www.youtube.com/embed/' + ctx.PROG['2-1-1B'].video), '★★ 還沒填的關卡照舊播 YouTube');
ok(/貴組織不允許存取/.test(b), '★★ YouTube 那種也寫出「看到『貴組織不允許存取』怎麼辦」');
ok(/allowfullscreen/.test(a), '雲端硬碟播放器也能全螢幕');

section('③ 十關一關都不能漏');
const pk = Object.keys(ctx.PROG).sort(), vk = Object.keys(ctx.VIDEO_DRIVE).sort();
ok(pk.length === 10 && JSON.stringify(pk) === JSON.stringify(vk),
   '★★★ VIDEO_DRIVE 的關卡和 PROG 一一對上（少一關＝那一關永遠換不過來）　←　' + vk.join(','));
ok(/\$\{videoHTML\(u\.id, p\)\}/.test(H), '★★ 程式設計頁真的用 videoHTML 畫影片');
ok(!/src="https:\/\/www\.youtube\.com\/embed\/\$\{p\.video\}"/.test(H), '★ 沒有留下另一個寫死的 YouTube 播放器');

console.log('\n通過 ' + pass + '／失敗 ' + fail);
process.exit(fail ? 1 : 0);
