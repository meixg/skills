'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_DIR = __dirname;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}

const DATA = arg('--data', path.join(SKILL_DIR, 'data'));
const REVIEWS_FILE = arg('--reviews', path.join(SKILL_DIR, 'reviews.json'));
const OUT = arg('--out', SKILL_DIR);
const ASSET_SRC = path.join(SKILL_DIR, '..', 'assets', 'style.css');

const VERDICT_COLORS = {
  'approve': '#1f9d55',
  'approve-with-nits': '#0f9f9f',
  'discuss': '#d97706',
  'needs-changes': '#dc2626',
};
const VERDICT_LABELS = {
  'approve': '可以合并',
  'approve-with-nits': '可以合并（有提醒）',
  'discuss': '需讨论',
  'needs-changes': '需修改',
};
const SEVERITY_COLORS = {
  'high': '#dc2626',
  'medium': '#d97706',
  'low': '#2563eb',
  'nit': '#6b7280',
  'info': '#15803d',
};
const SEVERITY_LABELS = {
  'high': '高',
  'medium': '中',
  'low': '低',
  'nit': '小问题',
  'info': '信息',
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Turn full URLs and "#NNNN" references into clickable links (escaped input).
function linkify(s) {
  return s
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    )
    .replace(
      /#(\d{3,7})\b/g,
      '<a href="https://github.com/nodejs/node/issues/$1" target="_blank" rel="noopener">#$1</a>'
    );
}

function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function badge(text, color) {
  return `<span class="badge" style="--c:${color}">${esc(text)}</span>`;
}

function severityBadge(sev) {
  return badge(SEVERITY_LABELS[sev] || sev, SEVERITY_COLORS[sev] || '#6b7280');
}

// ---------- SVG charts ----------

function donut(counts, size = 180, thickness = 26) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return '<p class="empty">暂无数据</p>';
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  let segs = '';
  let legend = '';
  for (const [key, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const frac = count / total;
    const dash = frac * c;
    segs +=
      `<circle class="donut-seg" cx="${cx}" cy="${cx}" r="${r}" ` +
      `stroke="${VERDICT_COLORS[key]}" stroke-width="${thickness}" ` +
      `stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" ` +
      `stroke-dashoffset="${(-offset).toFixed(2)}" />`;
    legend +=
      `<div class="legend-item"><span class="dot" style="background:${VERDICT_COLORS[key]}"></span>` +
      `${VERDICT_LABELS[key]} · ${count}</div>`;
    offset += dash;
  }
  return (
    `<div class="chart-wrap">` +
    `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="审查结论分布">` +
    `<circle class="donut-bg" cx="${cx}" cy="${cx}" r="${r}" stroke="#e5e7eb" stroke-width="${thickness}" fill="none" />` +
    segs +
    `<text x="${cx}" y="${cx - 2}" text-anchor="middle" class="donut-num">${total}</text>` +
    `<text x="${cx}" y="${cx + 16}" text-anchor="middle" class="donut-label">个 PR</text>` +
    `</svg><div class="legend">${legend}</div></div>`
  );
}

function hbar(label, value, max, color, fmt = (v) => v) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    `<div class="hbar-row">` +
    `<div class="hbar-label">${esc(label)}</div>` +
    `<div class="hbar-track"><div class="hbar-fill" style="width:${w.toFixed(1)}%;background:${color}"></div></div>` +
    `<div class="hbar-val">${esc(fmt(value))}</div></div>`
  );
}

function linesBar(prs) {
  const max = Math.max(...prs.map((p) => p.add + p.del), 1);
  let rows = '';
  for (const p of prs) {
    const addW = (p.add / max) * 100;
    const delW = (p.del / max) * 100;
    rows +=
      `<div class="hbar-row">` +
      `<a class="hbar-label link" href="pr-${p.number}.html">#${p.number}</a>` +
      `<div class="hbar-track"><div class="hbar-fill add" style="width:${addW.toFixed(1)}%"></div>` +
      `<div class="hbar-fill del" style="width:${delW.toFixed(1)}%"></div></div>` +
      `<div class="hbar-val">+${p.add} / -${p.del}</div></div>`;
  }
  return `<div class="barchart">${rows}</div>` +
    `<div class="chart-note"><span class="dot" style="background:#16a34a"></span>新增行 ` +
    `<span class="dot" style="background:#ef4444"></span>删除行（按本页内最大值归一化）</div>`;
}

function ciStacked(prs) {
  const max = Math.max(...prs.map((p) => p.ci.success + p.ci.failure + p.ci.skipped + p.ci.pending), 1);
  let rows = '';
  for (const p of prs) {
    const s = p.ci.success;
    const f = p.ci.failure;
    const k = p.ci.skipped;
    const g = p.ci.pending;
    const seg = (n, color) => {
      const w = (n / max) * 100;
      return n > 0 ? `<div class="ci-seg" style="width:${w.toFixed(1)}%;background:${color}" title="${n}"></div>` : '';
    };
    rows +=
      `<div class="hbar-row">` +
      `<a class="hbar-label link" href="pr-${p.number}.html">#${p.number}</a>` +
      `<div class="hbar-track ci">${seg(s, '#16a34a')}${seg(f, '#dc2626')}${seg(g, '#f59e0b')}${seg(k, '#d1d5db')}</div>` +
      `<div class="hbar-val">${s}✓ ${f}✗ ${g}… ${k}⊘</div></div>`;
  }
  return `<div class="barchart">${rows}</div>` +
    `<div class="chart-note"><span class="dot" style="background:#16a34a"></span>成功 ` +
    `<span class="dot" style="background:#dc2626"></span>失败 ` +
    `<span class="dot" style="background:#f59e0b"></span>进行中 ` +
    `<span class="dot" style="background:#d1d5db"></span>跳过</div>`;
}

function fileAreaChart(files) {
  const areas = {};
  for (const f of files) {
    const top = f.filename.split('/')[0];
    areas[top] = (areas[top] || 0) + 1;
  }
  const max = Math.max(...Object.values(areas), 1);
  const colors = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#64748b'];
  let i = 0;
  let rows = '';
  for (const [area, count] of Object.entries(areas).sort((a, b) => b[1] - a[1])) {
    rows += hbar(area, count, max, colors[i % colors.length]);
    i++;
  }
  return `<div class="barchart">${rows}</div>`;
}

// ---------- data helpers ----------

function loadPR(n, review) {
  const pr = readJSON(`pr_${n}.json`);
  const files = readJSON(`pr_${n}_files.json`);
  const checks = readJSON(`pr_${n}_checks.json`);
  let ci = { success: 0, failure: 0, skipped: 0, pending: 0 };
  for (const c of (checks.check_runs || [])) {
    if (c.conclusion === 'success') ci.success++;
    else if (c.conclusion === 'failure') ci.failure++;
    else if (c.conclusion === 'skipped') ci.skipped++;
    else ci.pending++;
  }
  const add = files.reduce((a, f) => a + (f.additions || 0), 0);
  const del = files.reduce((a, f) => a + (f.deletions || 0), 0);
  return { pr, files, ci, add, del };
}

function filesTable(files) {
  const rows = files
    .slice()
    .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))
    .map((f) => {
      const status = f.status === 'added' ? '新增' : f.status === 'removed' ? '删除' : f.status === 'renamed' ? '重命名' : '修改';
      return (
        `<tr><td class="mono">${esc(f.filename)}</td>` +
        `<td>${status}</td><td class="num add">+${f.additions || 0}</td>` +
        `<td class="num del">-${f.deletions || 0}</td></tr>`
      );
    })
    .join('');
  return `<table><thead><tr><th>文件</th><th>状态</th><th>新增</th><th>删除</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- page renderers ----------

function pageShell(title, body) {
  return (
    `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n` +
    `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${esc(title)}</title>\n<link rel="stylesheet" href="assets/style.css">\n</head>\n<body>\n${body}\n</body>\n</html>`
  );
}

function renderPRPage(n, item) {
  const { pr, files, ci, add, del } = item;
  const r = item.review;
  const isDraft = pr.draft === true;
  const draftBadge = isDraft ? badge('DRAFT 草案', '#6b7280') : '';
  const verdictBadge = badge(r.verdictLabel, VERDICT_COLORS[r.verdict]);
  const metaBadges = [badge(r.categoryLabel, '#4f46e5'), draftBadge, verdictBadge].filter(Boolean).join('');
  const ghLink = pr.html_url
    ? '<a class="link" href="' + esc(pr.html_url) + '" target="_blank" rel="noopener">' + esc(pr.html_url) + ' ↗</a>'
    : '';

  const findingsHtml = r.findings && r.findings.length
    ? r.findings.map((f) =>
        `<div class="finding"><div class="finding-head">${severityBadge(f.severity)}<h3>${linkify(esc(f.title))}</h3></div>` +
        `<p>${linkify(esc(f.detail))}</p>` +
        (f.suggestion ? `<p class="suggestion">建议：${linkify(esc(f.suggestion))}</p>` : '') +
        `</div>`
      ).join('')
    : '<p class="ok">未发现需要修改的问题。</p>';

  const keyChangesHtml = r.keyChanges && r.keyChanges.length
    ? r.keyChanges.map((k) =>
        `<div class="card"><h3>${linkify(esc(k.title))}</h3><p>${linkify(esc(k.detail))}</p></div>`
      ).join('')
    : '';

  const beginnerHtml = r.beginnerNotes && r.beginnerNotes.length
    ? `<ul>${r.beginnerNotes.map((b) => `<li>${linkify(esc(b))}</li>`).join('')}</ul>`
    : '';

  const topFiles = files
    .slice()
    .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))
    .slice(0, 10);
  const maxFile = Math.max(...topFiles.map((f) => f.additions + f.deletions), 1);
  const fileBars = topFiles.map((f) =>
    hbar(f.filename.replace(/^deps\//, 'deps/…'), f.additions + f.deletions, maxFile, '#2563eb', (v) => `+${f.additions}/-${f.deletions}`)
  ).join('');

  const body =
    `<header class="topbar"><div class="wrap"><a class="link" href="index.html">← 返回总览</a>` +
    `<span class="crumb">nodejs/node · PR #${n}</span></div></header>` +
    `<main class="wrap">` +
    `<section class="hero">` +
    `<div class="hero-meta">${metaBadges}` +
    `<span class="muted">作者 ${esc(pr.user && pr.user.login || '?')}</span>` +
    `<span class="muted">创建于 ${esc(pr.created_at || '').slice(0, 10)}</span>` +
    `<span class="muted">${files.length} 个文件 · +${add} / -${del}</span></div>` +
    `<h1>#${n} ${esc(pr.title)}</h1>` +
    `<p class="muted">${ghLink}</p>` +
    `</section>` +

    `<section class="grid2">` +
    `<div class="card wide"><h2>这个 PR 做了什么（大白话）</h2><p>${linkify(esc(r.plainLanguage))}</p></div>` +
    `<div class="card"><h2>摘要</h2><p>${linkify(esc(r.summaryZh))}</p></div>` +
    `<div class="card"><h2>为什么值得关注</h2><p>${linkify(esc(r.whyItMatters))}</p></div>` +
    `</section>` +

    (keyChangesHtml ? `<section><h2>关键改动点</h2><div class="cards">${keyChangesHtml}</div></section>` : '') +

    `<section><h2>改动的文件</h2><div class="grid2">` +
    `<div><div class="barchart">${fileBars}</div></div>` +
    `<div class="filetable">${filesTable(files)}</div>` +
    `</div></section>` +

    `<section><h2>Review 发现</h2><div class="findings">${findingsHtml}</div>` +
    `<div class="verdict card"><h2>审查结论</h2><p>${linkify(esc(r.verdictNote))}</p></div></section>` +

    `<section class="grid2">` +
    `<div class="card"><h2>CI 检查状态</h2>` +
    `<div class="ci-big">` +
    `<div class="ci-num ok">${ci.success}<span>成功</span></div>` +
    `<div class="ci-num bad">${ci.failure}<span>失败</span></div>` +
    `<div class="ci-num warn">${ci.pending}<span>进行中</span></div>` +
    `<div class="ci-num gray">${ci.skipped}<span>跳过</span></div>` +
    `</div><p>${linkify(esc(r.ciNote))}</p></div>` +
    `<div class="card"><h2>新手小词典</h2>${beginnerHtml}</div>` +
    `</section>` +

    `<footer class="foot"><p>本报告由本地只读分析生成（分支 ${esc(pr.head.ref)} → ${esc(pr.base.ref)}）。` +
    `数据为拉取时点的 GitHub 公共 API 快照，审查为自动化辅助结论，不替代 maintainer 正式 review；未对 GitHub 做任何写操作。</p></footer>` +
    `</main>`;

  return pageShell(`PR #${n} ${pr.title}`, body);
}

function renderIndex(prs, meta) {
  const verdictCounts = {};
  for (const p of prs) {
    verdictCounts[p.review.verdict] = (verdictCounts[p.review.verdict] || 0) + 1;
  }

  const tableRows = prs.map((p) => {
    const r = p.review;
    return (
      `<tr>` +
      `<td><a class="link" href="pr-${p.number}.html">#${p.number}</a></td>` +
      `<td class="title-cell"><a class="link" href="pr-${p.number}.html">${esc(p.pr.title)}</a></td>` +
      `<td>${badge(r.categoryLabel, '#4f46e5')}</td>` +
      `<td class="num">${p.files.length}</td>` +
      `<td class="num add">+${p.add}</td><td class="num del">-${p.del}</td>` +
      `<td>${badge(r.verdictLabel, VERDICT_COLORS[r.verdict])}</td>` +
      `<td class="num">${p.ci.success}✓ <span class="ci-fail">${p.ci.failure}✗</span></td>` +
      `</tr>`
    );
  }).join('');

  const body =
    `<header class="topbar"><div class="wrap"><span class="crumb">nodejs/node 最新 10 个 PR · 本地 Code Review 报告</span></div></header>` +
    `<main class="wrap">` +
    `<section class="hero">` +
    `<h1>nodejs/node · 最新 10 个 PR 审查报告</h1>` +
    `<p>面向刚接触 Node.js core 的开发者。每个 PR 都有：<b>大白话解释</b>、<b>改动文件与图表</b>、<b>审查发现</b>、<b>CI 状态</b> 和 <b>新手小词典</b>。</p>` +
    `<p class="muted">数据快照：${esc(meta.fetched_at)} · 范围：当前 open 且按创建时间最新的 10 个 PR · 方式：全部本地只读分析，未在 GitHub 做任何写操作。</p>` +
    `</section>` +

    `<section class="grid2 charts">` +
    `<div class="card"><h2>审查结论分布</h2>${donut(verdictCounts)}</div>` +
    `<div class="card"><h2>每个 PR 的改动量</h2>${linesBar(prs)}</div>` +
    `</section>` +

    `<section><h2>总览表</h2>` +
    `<table><thead><tr><th>PR</th><th>标题</th><th>类型</th><th>文件数</th><th>新增</th><th>删除</th><th>结论</th><th>CI</th></tr></thead>` +
    `<tbody>${tableRows}</tbody></table></section>` +

    `<section class="grid2 charts">` +
    `<div class="card"><h2>改动文件分布（按顶层目录）</h2>${fileAreaChart(prs.flatMap((p) => p.files))}</div>` +
    `<div class="card"><h2>CI 检查状态</h2>${ciStacked(prs)}</div>` +
    `</section>` +

    `<section class="card"><h2>给新手：怎么读这份报告</h2>` +
    `<ul class="faq">` +
    `<li><b>PR 是什么？</b>Pull Request 是别人写好代码后请求合入 Node.js 主干的“提案”。每个 PR 会附带 diff（改动）、讨论、CI 检查。</li>` +
    `<li><b>为什么有“草案 DRAFT”？</b>作者认为还没准备好合并，只希望先讨论。草稿 PR 同样值得 review，常能发现方向性问题。</li>` +
    `<li><b>CI 为什么重要？</b>Node.js 在每个 PR 上跑几十个构建与测试任务（不同操作系统、编译器、V8/OpenSSL 组合）。红（失败）通常是合并的硬门槛。</li>` +
    `<li><b>deps 更新为什么也要 review？</b>Node.js 把 undici、libffi、googletest 等第三方库直接放进仓库（vendored）。升级会把上游的新行为带进 Node.js，所以要检查与 Node.js 的集成点。</li>` +
    `<li><b>审查结论怎么定的？</b>我们按“是否存在会改变行为/导致回归的问题”给结论：可以合并 / 有提醒 / 需讨论 / 需修改。</li>` +
    `</ul></section>` +

    `<footer class="foot"><p>本报告为本地生成物：源码位于 pr-reviews/（data/ 存原始 API 快照，generate.js 生成页面）。` +
    `审查是自动化辅助结论，供学习与讨论，不替代 Node.js maintainer 的正式 review。</p></footer>` +
    `</main>`;

  return pageShell('nodejs/node 最新 10 个 PR 审查报告', body);
}

// ---------- main ----------

function main() {
  const meta = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  const list = readJSON('pr_list.json');
  const prs = [];
  for (const prMeta of list) {
    const n = String(prMeta.number);
    const review = meta.reviews[n];
    if (!review) {
      console.warn(`缺少 review 数据: ${n}`);
      continue;
    }
    const item = loadPR(n, review);
    item.review = review;
    item.number = n;
    prs.push(item);
    fs.writeFileSync(path.join(OUT, `pr-${n}.html`), renderPRPage(n, item));
    console.log(`生成 pr-${n}.html`);
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(prs, meta.meta));
  if (fs.existsSync(ASSET_SRC)) {
    const assetOut = path.join(OUT, 'assets');
    fs.mkdirSync(assetOut, { recursive: true });
    fs.copyFileSync(ASSET_SRC, path.join(assetOut, 'style.css'));
  }
  console.log('生成 index.html');
}

main();
