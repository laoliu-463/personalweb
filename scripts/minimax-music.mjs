/**
 * 调用 MiniMax 音乐生成 API，产出纯音乐到 public/music/。
 *
 * 用法：
 *   node scripts/minimax-music.mjs                       # 用默认提示词
 *   node scripts/minimax-music.mjs --out my-track.wav    # 指定文件名
 *   node scripts/minimax-music.mjs --model music-2.6     # 换模型
 *   node scripts/minimax-music.mjs --dry-run             # 只打印将要发送的请求，不真的调用
 *
 * 需要环境变量 MINIMAX_API_KEY（脚本不会打印它）。
 *
 * 注意：API 没有 seed / BPM / key 参数，也没有位深选项。
 * BPM 与调性只能写进 prompt 文本，模型不保证严格遵守。
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ENDPOINT = 'https://api.minimax.cn/v1/music_generation';

// 按《秘密beat》风格改写：A 小调（原建议里的 C Minor 与编排自相矛盾，已改）
const PROMPT = [
  'Pop rap type beat, instrumental, nylon-string acoustic guitar lead,',
  '154 BPM, A minor, emotional and lonely but tender, nostalgic,',
  'soft trap drums with hi-hat rolls, deep 808 bass, minimal ambient pad,',
  'clean production, mid-range left open for vocals,',
  'intro: solo nylon guitar with light room noise;',
  'verse: drums and 808 enter, guitar simplifies;',
  'chorus: richer guitar melody with soft string pad;',
  'outro: drums fade out, final long guitar note with delay tail',
].join(' ');

function parseArgs(argv) {
  const args = { out: 'secret-beat-minimax.wav', model: 'music-3.0', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--prompt') args.prompt = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    console.error('缺少环境变量 MINIMAX_API_KEY');
    process.exit(1);
  }

  const format = args.out.endsWith('.mp3') ? 'mp3' : 'wav';
  const body = {
    model: args.model,
    prompt: args.prompt ?? PROMPT,
    is_instrumental: true,          // 纯音乐，无人声
    output_format: 'url',           // url 有效期 24 小时，拿到后立刻下载
    audio_setting: {
      sample_rate: 44100,           // 文档允许的最高值
      bitrate: 256000,              // 同上
      format,
    },
  };

  if (args.dryRun) {
    console.log('POST', ENDPOINT);
    console.log(JSON.stringify(body, null, 2));
    console.log('\n(--dry-run，未发送)');
    return;
  }

  console.log(`请求中：model=${body.model} format=${format} ...`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}`, (await res.text()).slice(0, 500));
    process.exit(1);
  }

  const json = await res.json();
  const code = json?.base_resp?.status_code;

  if (code !== 0) {
    const hints = {
      1002: '触发限流，稍后再试',
      1004: '鉴权失败 —— API Key 不对，或该 Key 无音乐生成权限',
      1008: '账号余额不足',
      2013: '入参异常',
      2049: '无效的 api key',
    };
    console.error(`失败 status_code=${code} ${json?.base_resp?.status_msg ?? ''}`);
    if (hints[code]) console.error(`→ ${hints[code]}`);
    if (code === 1004 || code === 2049) {
      console.error('→ 2026-08-20 起付费接口不再面向新用户，免费接口已停服；');
      console.error('  若账号非历史付费用户，请改用网页端 https://www.minimaxi.com/audio');
    }
    process.exit(1);
  }

  const audioUrl = json?.data?.audio;
  if (!audioUrl) {
    console.error('响应里没有音频字段，原始响应：');
    console.error(JSON.stringify(json, null, 2).slice(0, 800));
    process.exit(1);
  }

  const outPath = resolve('public/music', args.out);
  await mkdir(dirname(outPath), { recursive: true });
  const audioRes = await fetch(audioUrl);
  const buf = Buffer.from(await audioRes.arrayBuffer());
  await writeFile(outPath, buf);

  const info = json.extra_info ?? {};
  console.log(`完成：${outPath}`);
  console.log(`  时长 ${(info.music_duration ?? 0) / 1000}s  `
    + `采样率 ${info.music_sample_rate}  声道 ${info.music_channel}  `
    + `大小 ${(buf.length / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
