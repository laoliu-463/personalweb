// 刷新 GitHub 项目回退快照：npm run sync:repos
// 平时不必手动跑——API 正常时构建会用实时数据；只有想在离线环境
// 也拿到最新列表、或想让快照进版本库时才需要。
import { writeFile } from 'node:fs/promises';
import { GITHUB_USERNAME, buildReposUrl } from '../src/lib/config.mjs';

const res = await fetch(buildReposUrl(GITHUB_USERNAME));
if (!res.ok) {
  console.error(`拉取失败：HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
if (!Array.isArray(data)) {
  console.error('响应不是仓库数组，放弃写入');
  process.exit(1);
}

const target = new URL('../src/data/repos-fallback.json', import.meta.url);
await writeFile(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`已写入 ${data.length} 个仓库到 src/data/repos-fallback.json`);
