/**
 * Dashboard Generator — Generic Social Media Research Dashboard
 *
 * Takes scraped data from any platform (TikTok, Facebook, Instagram, YouTube)
 * and generates an interactive HTML dashboard with:
 *   - Overview stats
 *   - Channel profile
 *   - Competitors comparison
 *   - Top content
 *   - All content table
 *   - Hashtags analysis
 *   - Analysis tab (populated by Gemini later)
 *   - Recommendations tab (populated by Gemini later)
 *   - Bilingual Excel export (EN + BG)
 *
 * Also exposes an Express router at /api/dashboard/.
 */

import { Router } from "express";
import { writeFile, mkdir } from "fs/promises";
import { resolve, join } from "path";

const router = Router();

// ─── Platform field mapping ─────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  tiktok: {
    name: "TikTok",
    icon: "fa-brands fa-tiktok",
    contentLabel: "Videos",
    viewsLabel: "Plays",
    likesLabel: "Likes",
    sharesLabel: "Shares",
    commentsLabel: "Comments",
    // Normalise raw TikTok data to common shape
    normalise(item) {
      return {
        id: item.id,
        url: item.url || item.webVideoUrl,
        text: item.text || "",
        createdAt: item.createdAt || item.createTimeISO,
        views: item.plays || item.playCount || 0,
        likes: item.likes || item.diggCount || 0,
        shares: item.shares || item.shareCount || 0,
        comments: item.comments || item.commentCount || 0,
        saves: item.saves || item.collectCount || 0,
        isVideo: true,
        thumbnailUrl: item.coverUrl || item.videoMeta?.coverUrl || "",
        duration: item.duration || item.videoMeta?.duration || null,
        authorName: item.author?.name || item.authorMeta?.name || "",
        authorUrl: item.author?.profileUrl || item.authorMeta?.profileUrl || "",
        authorFollowers: item.author?.followers || item.authorMeta?.fans || 0,
        authorTotalLikes: item.author?.totalLikes || item.authorMeta?.heart || 0,
        hashtags: item.hashtags || [],
      };
    },
  },
  facebook: {
    name: "Facebook",
    icon: "fa-brands fa-facebook",
    contentLabel: "Posts",
    viewsLabel: "Views",
    likesLabel: "Reactions",
    sharesLabel: "Shares",
    commentsLabel: "Comments",
    normalise(item) {
      return {
        id: item.id || item.postId,
        url: item.url,
        text: item.text || "",
        createdAt: item.createdAt || item.time,
        views: item.views || item.viewsCount || 0,
        likes: item.likes || 0,
        shares: item.shares || 0,
        comments: item.comments || 0,
        saves: 0,
        isVideo: !!item.isVideo,
        thumbnailUrl: item.thumbnailUrl || (item.media?.[0]?.thumbnail) || "",
        duration: null,
        authorName: item.author?.name || item.user?.name || item.pageName || "",
        authorUrl: item.author?.profileUrl || item.user?.profileUrl || item.facebookUrl || "",
        authorFollowers: 0, // FB doesn't expose this in post data
        authorTotalLikes: 0,
        hashtags: item.hashtags || [],
        // FB-specific
        reactionLike: item.reactionLike || item.reactionLikeCount || 0,
        reactionHaha: item.reactionHaha || item.reactionHahaCount || 0,
        reactionLove: item.reactionLove || item.reactionLoveCount || 0,
        reactionWow: item.reactionWow || item.reactionWowCount || 0,
        reactionSad: item.reactionSad || item.reactionSadCount || 0,
        reactionAngry: item.reactionAngry || item.reactionAngryCount || 0,
      };
    },
  },
  instagram: {
    name: "Instagram",
    icon: "fa-brands fa-instagram",
    contentLabel: "Posts",
    viewsLabel: "Views",
    likesLabel: "Likes",
    sharesLabel: "Shares",
    commentsLabel: "Comments",
    normalise(item) {
      return {
        id: item.id,
        url: item.url,
        text: item.text || item.caption || "",
        createdAt: item.createdAt || item.timestamp,
        views: item.views || item.videoViewCount || 0,
        likes: item.likes || item.likesCount || 0,
        shares: item.shares || 0,
        comments: item.comments || item.commentsCount || 0,
        saves: item.saves || 0,
        isVideo: item.isVideo || item.type === "video",
        thumbnailUrl: item.thumbnailUrl || item.displayUrl || "",
        duration: item.duration || null,
        authorName: item.authorName || item.ownerUsername || "",
        authorUrl: item.authorUrl || "",
        authorFollowers: item.authorFollowers || 0,
        authorTotalLikes: 0,
        hashtags: item.hashtags || [],
      };
    },
  },
  youtube: {
    name: "YouTube",
    icon: "fa-brands fa-youtube",
    contentLabel: "Videos",
    viewsLabel: "Views",
    likesLabel: "Likes",
    sharesLabel: "Shares",
    commentsLabel: "Comments",
    normalise(item) {
      return {
        id: item.id,
        url: item.url,
        text: item.text || item.title || "",
        createdAt: item.createdAt || item.date,
        views: item.views || item.viewCount || 0,
        likes: item.likes || item.likeCount || 0,
        shares: item.shares || 0,
        comments: item.comments || item.commentCount || 0,
        saves: 0,
        isVideo: true,
        thumbnailUrl: item.thumbnailUrl || "",
        duration: item.duration || null,
        authorName: item.authorName || item.channelName || "",
        authorUrl: item.authorUrl || item.channelUrl || "",
        authorFollowers: item.authorFollowers || item.subscriberCount || 0,
        authorTotalLikes: 0,
        hashtags: item.hashtags || [],
      };
    },
  },
};

// ─── Engagement rate calculator ──────────────────────────────────────────────

function engRate(item) {
  const denom = item.views || 1;
  const numer = (item.likes || 0) + (item.shares || 0) + (item.comments || 0) + (item.saves || 0);
  return (numer / denom * 100).toFixed(1) + "%";
}

function fmt(n) {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// ─── Dashboard HTML Generator ────────────────────────────────────────────────

function generateDashboardHTML({
  platform,
  channelName,
  channelUrl,
  scrapedDate,
  posts,        // normalised posts
  competitors,  // optional: array of { name, posts }
  analysisHtml, // optional: HTML for analysis tab
  recommendationsHtml, // optional: HTML for recommendations tab
  projectName,
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.facebook;
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalShares = posts.reduce((s, p) => s + (p.shares || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const authors = new Set(posts.map(p => p.authorName).filter(Boolean));

  // All posts including competitors for combined views
  const allPosts = [...posts];
  const compEntries = competitors || [];
  compEntries.forEach(c => {
    if (c.posts) allPosts.push(...c.posts);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${cfg.name} Research — ${channelName || projectName || "Dashboard"}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Sora:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sora', system-ui, sans-serif; background: #f8f6fa; color: #2d2d3a; font-size: 13px; display: flex; min-height: 100vh; padding: 0; }
    h1 { color: #91569c; font-family: 'Poppins', sans-serif; font-weight: 400; font-size: 22px; margin-bottom: 4px; }
    h2 { color: #91569c; font-family: 'Poppins', sans-serif; font-weight: 400; font-size: 16px; margin: 20px 0 10px; }
    h3 { color: #7b3f8a; font-family: 'Poppins', sans-serif; font-weight: 400; font-size: 14px; margin: 14px 0 6px; }
    .subtitle { color: #888; margin-bottom: 16px; font-size: 12px; }
    .stats-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .stat { background: white; border: 1px solid #e0d4e8; border-radius: 8px; padding: 10px 16px; text-align: center; box-shadow: 0 1px 4px rgba(145,86,156,0.06); }
    .stat .num { font-size: 22px; font-weight: 500; color: #91569c; font-family: 'Poppins', sans-serif; }
    .stat .label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: white; border: 1px solid #e0d4e8; border-radius: 8px; padding: 14px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(145,86,156,0.04); }
    table { border-collapse: collapse; width: 100%; font-size: 11px; table-layout: fixed; }
    th, td { border: 1px solid #e8dced; padding: 6px 8px; text-align: left; vertical-align: top; overflow: hidden; text-overflow: ellipsis; }
    th { background: #91569c; color: white; font-weight: 500; font-family: 'Sora', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; position: sticky; top: 0; white-space: nowrap; }
    td { background: white; }
    tr:hover td { background: #faf5fc; }
    .thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 4px; cursor: pointer; }
    .thumb:hover { transform: scale(2.5); position: relative; z-index: 10; }
    a { color: #91569c; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .highlight { background: #f0e6f4 !important; }
    .highlight td { background: #f0e6f4 !important; }
    .engagement { color: #2e7d32; font-weight: 500; }
    .low { color: #c62828; }
    .tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
    .tab { padding: 6px 14px; border-radius: 6px; cursor: pointer; background: white; border: 1px solid #e0d4e8; color: #888; font-size: 12px; font-family: 'Sora', sans-serif; }
    .tab:hover { border-color: #91569c; color: #91569c; }
    .tab.active { background: #91569c; color: white; border-color: #91569c; }
    .section { display: none; }
    .section.active { display: block; }
    .filter { background: white; border: 1px solid #e0d4e8; border-radius: 6px; padding: 6px 10px; color: #2d2d3a; font-size: 12px; margin-bottom: 10px; width: 260px; font-family: 'Sora', sans-serif; }
    .btn { background: #91569c; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Sora', sans-serif; }
    .btn:hover { background: #a366ad; }
    .btn-outline { background: white; color: #91569c; border: 1px solid #91569c; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: 'Sora', sans-serif; }
    .btn-outline:hover { background: #f8f2fa; }
    .caption-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .caption-cell:hover { white-space: normal; max-width: none; }
    .learn-how { margin-top: 6px; }
    .learn-how summary { cursor: pointer; color: #91569c; font-size: 11px; font-weight: 600; user-select: none; }
    .learn-how summary:hover { text-decoration: underline; }
    .learn-how .guide { background: #faf7fb; border: 1px solid #e8dced; border-radius: 8px; padding: 12px 14px; margin-top: 6px; font-size: 11px; line-height: 1.7; color: #333; }
    .learn-how .guide h4 { color: #91569c; font-size: 12px; margin: 10px 0 4px; font-family: 'Poppins', sans-serif; }
    .learn-how .guide ol, .learn-how .guide ul { padding-left: 18px; margin: 4px 0; }
    .learn-how .guide li { margin: 3px 0; }
    .learn-how .guide code { background: #e8dced; padding: 1px 5px; border-radius: 3px; font-size: 10px; }
    .app-sidebar { width: 72px; flex-shrink: 0; background: white; border-right: 1px solid #e0d4e8; display: flex; flex-direction: column; align-items: center; }
    .app-sidebar .logo-area { width: 100%; display: flex; align-items: center; justify-content: center; height: 56px; border-bottom: 1px solid #e0d4e8; }
    .app-sidebar .logo-area img { height: 28px; }
    .app-sidebar nav { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; }
    .app-sidebar .nav-btn { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 10px 0; border-radius: 12px; border: none; background: none; cursor: pointer; color: #888; text-decoration: none; transition: all 0.15s; }
    .app-sidebar .nav-btn:hover { background: rgba(246,240,248,0.6); color: #5c3a62; }
    .app-sidebar .nav-btn.active { background: #f6f0f8; color: #91569c; }
    .app-sidebar .nav-btn i { font-size: 16px; }
    .app-sidebar .nav-btn span { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; margin-top: 2px; }
    .main-content { flex: 1; padding: 20px; max-width: 1200px; overflow-y: auto; }
    .top-header { height: 56px; flex-shrink: 0; background: white; border-bottom: 1px solid #e0d4e8; display: flex; align-items: center; padding: 0 24px; width: 100%; gap: 12px; }
    .top-header h2 { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 13px; color: #5c3a62; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
    .back-arrow { color: #91569c; font-size: 16px; text-decoration: none; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; transition: all 0.15s; }
    .back-arrow:hover { background: #f6f0f8; color: #5c3a62; }
    .content-wrapper { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .reaction-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .reaction-bar .r { font-size: 11px; }
  </style>
</head>
<body>
<aside class="app-sidebar">
  <div class="logo-area"><a href="/"><img src="/logo-main.png" alt="TensorAx Studio" /></a></div>
  <nav>
    <a href="/" class="nav-btn"><i class="fa-solid fa-house"></i><span>Studio</span></a>
    <a href="/" class="nav-btn"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Skills</span></a>
    <a href="/" class="nav-btn"><i class="fa-solid fa-users-gear"></i><span>Teams</span></a>
    <a href="/" class="nav-btn active"><i class="fa-solid fa-folder-open"></i><span>Projects</span></a>
    <a href="/" class="nav-btn"><i class="fa-solid fa-images"></i><span>Assets</span></a>
    <a href="/" class="nav-btn"><i class="fa-solid fa-gear"></i><span>Settings</span></a>
  </nav>
</aside>
<div class="content-wrapper">
<div class="top-header">
  <a href="/" class="back-arrow" title="Back to Studio"><i class="fa-solid fa-arrow-left"></i></a>
  <h2><i class="${cfg.icon}"></i> Research — ${escHtml(channelName || projectName || "Dashboard")}</h2>
</div>
<div class="main-content">

<h1><i class="${cfg.icon}"></i> ${escHtml(channelName || "")} ${cfg.name} Research</h1>
<p class="subtitle">Scraped ${scrapedDate || new Date().toISOString().substring(0, 10)} | ${posts.length} ${cfg.contentLabel.toLowerCase()} | ${authors.size} accounts</p>

<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
  <div class="stats-bar">
    <div class="stat"><div class="num">${posts.length}</div><div class="label">${cfg.contentLabel}</div></div>
    <div class="stat"><div class="num">${authors.size}</div><div class="label">Accounts</div></div>
    <div class="stat"><div class="num">${fmt(totalViews)}</div><div class="label">${cfg.viewsLabel}</div></div>
    <div class="stat"><div class="num">${fmt(totalLikes)}</div><div class="label">${cfg.likesLabel}</div></div>
    <div class="stat"><div class="num">${fmt(totalShares)}</div><div class="label">${cfg.sharesLabel}</div></div>
    <div class="stat"><div class="num">${fmt(totalComments)}</div><div class="label">${cfg.commentsLabel}</div></div>
  </div>
  <button class="btn-outline" onclick="exportExcel('en')">&#x1f4e5; Download Excel (EN)</button>
  <button class="btn-outline" onclick="exportExcel('bg')">&#x1f4e5; Изтегли Excel (БГ)</button>
</div>

<div class="tabs">
  <div class="tab active" onclick="showTab('overview')">Overview</div>
  <div class="tab" onclick="showTab('channel')">Channel</div>
  <div class="tab" onclick="showTab('competitors')">Competitors</div>
  <div class="tab" onclick="showTab('top')">Top 10</div>
  <div class="tab" onclick="showTab('allcontent')">All ${cfg.contentLabel}</div>
  <div class="tab" onclick="showTab('hashtags')">Hashtags</div>
  <div class="tab" onclick="showTab('analysis')">Analysis</div>
  <div class="tab" onclick="showTab('recommendations')">Recommendations</div>
</div>

<div class="section active" id="sec-overview"></div>
<div class="section" id="sec-channel"></div>
<div class="section" id="sec-competitors"></div>
<div class="section" id="sec-top"></div>
<div class="section" id="sec-allcontent"></div>
<div class="section" id="sec-hashtags"></div>
<div class="section" id="sec-analysis">${analysisHtml || '<p style="color:#888">Analysis will be generated after scraping completes.</p>'}</div>
<div class="section" id="sec-recommendations">${recommendationsHtml || '<p style="color:#888">Recommendations will be generated after analysis.</p>'}</div>

<script>
const PLATFORM = ${JSON.stringify(platform)};
const CHANNEL_NAME = ${JSON.stringify(channelName || "")};
const POSTS = ${JSON.stringify(posts)};
const COMPETITORS = ${JSON.stringify(compEntries.map(c => ({ name: c.name, posts: c.posts || [] })))};
const CFG = {
  contentLabel: ${JSON.stringify(cfg.contentLabel)},
  viewsLabel: ${JSON.stringify(cfg.viewsLabel)},
  likesLabel: ${JSON.stringify(cfg.likesLabel)},
  sharesLabel: ${JSON.stringify(cfg.sharesLabel)},
  commentsLabel: ${JSON.stringify(cfg.commentsLabel)},
};

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('sec-' + name).classList.add('active');
}

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function engRate(p) {
  const d = p.views || 1;
  return (((p.likes||0) + (p.shares||0) + (p.comments||0) + (p.saves||0)) / d * 100).toFixed(1) + '%';
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Overview ───────────────────────────────────────────────────────────
function renderOverview() {
  const authors = {};
  POSTS.forEach(p => {
    const a = p.authorName || 'unknown';
    if (!authors[a]) authors[a] = { count: 0, followers: p.authorFollowers||0, totalViews: 0, totalLikes: 0, url: p.authorUrl };
    authors[a].count++;
    authors[a].totalViews += p.views||0;
    authors[a].totalLikes += p.likes||0;
  });
  const sorted = Object.entries(authors).sort((a,b) => b[1].totalViews - a[1].totalViews);

  let html = '<h2>Top Accounts by Total ' + CFG.viewsLabel + '</h2>';
  html += '<table><tr><th>#</th><th>Account</th><th>Followers</th><th>' + CFG.contentLabel + '</th><th>Total ' + CFG.viewsLabel + '</th><th>Total ' + CFG.likesLabel + '</th><th>Avg ' + CFG.viewsLabel + '</th></tr>';
  sorted.slice(0, 25).forEach(([name, d], i) => {
    const isChannel = name === CHANNEL_NAME;
    html += '<tr class="' + (isChannel ? 'highlight' : '') + '"><td>' + (i+1) + '</td><td><a href="' + (d.url||'#') + '" target="_blank">@' + escHtml(name) + '</a>' + (isChannel ? ' ⭐' : '') + '</td><td>' + fmt(d.followers) + '</td><td>' + d.count + '</td><td>' + fmt(d.totalViews) + '</td><td>' + fmt(d.totalLikes) + '</td><td>' + fmt(Math.round(d.totalViews/d.count)) + '</td></tr>';
  });
  html += '</table>';
  document.getElementById('sec-overview').innerHTML = html;
}

// ── Channel ────────────────────────────────────────────────────────────
function renderChannel() {
  const ch = POSTS.filter(p => p.authorName === CHANNEL_NAME);
  if (!ch.length) { document.getElementById('sec-channel').innerHTML = '<p>No channel posts found. Showing all scraped content in other tabs.</p>'; return; }
  const totalViews = ch.reduce((s,p) => s + (p.views||0), 0);
  const avgEng = ch.length > 0 ? (ch.reduce((s,p) => s + parseFloat(engRate(p)), 0) / ch.length).toFixed(1) + '%' : '0%';

  let html = '<div class="card"><h2>@' + escHtml(CHANNEL_NAME) + '</h2><p>' + ch.length + ' ' + CFG.contentLabel.toLowerCase() + ' | Total ' + CFG.viewsLabel.toLowerCase() + ': <strong>' + fmt(totalViews) + '</strong> | Avg engagement: <strong>' + avgEng + '</strong></p></div>';
  html += '<h3>All ' + CFG.contentLabel + ' (sorted by ' + CFG.viewsLabel.toLowerCase() + ')</h3>';
  html += buildContentTable(ch.sort((a,b) => (b.views||0) - (a.views||0)));
  document.getElementById('sec-channel').innerHTML = html;
}

// ── Competitors ────────────────────────────────────────────────────────
function renderCompetitors() {
  if (!COMPETITORS.length) { document.getElementById('sec-competitors').innerHTML = '<p>No competitor data available. Add competitor handles when configuring the research.</p>'; return; }
  let html = '<h2>Competitor Comparison</h2>';
  COMPETITORS.forEach(comp => {
    if (!comp.posts || !comp.posts.length) return;
    const totalViews = comp.posts.reduce((s,p) => s + (p.views||0), 0);
    html += '<div class="card"><h3>' + escHtml(comp.name) + '</h3><p>' + comp.posts.length + ' ' + CFG.contentLabel.toLowerCase() + ' | Total ' + CFG.viewsLabel.toLowerCase() + ': ' + fmt(totalViews) + ' | Avg: ' + fmt(Math.round(totalViews/comp.posts.length)) + '</p></div>';
    html += buildContentTable(comp.posts.sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 5));
  });
  document.getElementById('sec-competitors').innerHTML = html;
}

// ── Top 10 ─────────────────────────────────────────────────────────────
function renderTop() {
  const sorted = [...POSTS].sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 10);
  let html = '<h2>Top 10 by ' + CFG.viewsLabel + '</h2>';
  html += buildContentTable(sorted);
  document.getElementById('sec-top').innerHTML = html;
}

// ── All Content ────────────────────────────────────────────────────────
function renderAllContent() {
  let html = '<input class="filter" id="content-filter" placeholder="Filter by author, text, hashtag..." oninput="filterContent()"><div id="all-content-table"></div>';
  document.getElementById('sec-allcontent').innerHTML = html;
  renderFilteredContent(POSTS);
}

function renderFilteredContent(data) {
  document.getElementById('all-content-table').innerHTML = buildContentTable(data.sort((a,b) => (b.views||0) - (a.views||0)));
}

function filterContent() {
  const q = document.getElementById('content-filter').value.toLowerCase();
  const filtered = POSTS.filter(p => {
    return (p.authorName||'').toLowerCase().includes(q) || (p.text||'').toLowerCase().includes(q) || (p.hashtags||[]).some(h => h.toLowerCase().includes(q));
  });
  renderFilteredContent(filtered);
}

// ── Hashtags ───────────────────────────────────────────────────────────
function renderHashtags() {
  const tags = {};
  POSTS.forEach(p => {
    (p.hashtags||[]).forEach(h => {
      const key = h.toLowerCase();
      if (!tags[key]) tags[key] = { tag: h, count: 0, totalViews: 0 };
      tags[key].count++;
      tags[key].totalViews += p.views||0;
    });
  });
  const sorted = Object.values(tags).sort((a,b) => b.count - a.count);
  let html = '<h2>Hashtag Analysis (' + sorted.length + ' unique)</h2>';
  html += '<table><tr><th>#</th><th>Hashtag</th><th>Used</th><th>Total ' + CFG.viewsLabel + '</th><th>Avg ' + CFG.viewsLabel + '</th></tr>';
  sorted.slice(0, 50).forEach((t, i) => {
    html += '<tr><td>' + (i+1) + '</td><td>#' + escHtml(t.tag) + '</td><td>' + t.count + '</td><td>' + fmt(t.totalViews) + '</td><td>' + fmt(Math.round(t.totalViews/t.count)) + '</td></tr>';
  });
  html += '</table>';
  document.getElementById('sec-hashtags').innerHTML = html;
}

// ── Content Table Builder ──────────────────────────────────────────────
function buildContentTable(data) {
  let html = '<table><tr><th style="width:64px">Thumb</th><th>Author</th><th style="width:200px">Text</th><th>' + CFG.viewsLabel + '</th><th>' + CFG.likesLabel + '</th><th>' + CFG.sharesLabel + '</th><th>' + CFG.commentsLabel + '</th><th>Eng %</th><th>Date</th><th>Link</th></tr>';
  data.forEach(p => {
    const isHighViews = (p.views||0) > 10000;
    html += '<tr class="' + (isHighViews ? 'highlight' : '') + '">'
      + '<td>' + (p.thumbnailUrl ? '<img class="thumb" src="' + p.thumbnailUrl + '" onerror="this.style.display=\\'none\\'">' : '-') + '</td>'
      + '<td>@' + escHtml(p.authorName) + '</td>'
      + '<td class="caption-cell">' + escHtml((p.text||'').substring(0,100)) + '</td>'
      + '<td class="' + (isHighViews ? 'engagement' : '') + '">' + fmt(p.views) + '</td>'
      + '<td>' + fmt(p.likes) + '</td>'
      + '<td>' + fmt(p.shares) + '</td>'
      + '<td>' + fmt(p.comments) + '</td>'
      + '<td class="engagement">' + engRate(p) + '</td>'
      + '<td>' + (p.createdAt||'').substring(0,10) + '</td>'
      + '<td>' + (p.url ? '<a href="' + p.url + '" target="_blank">View</a>' : '-') + '</td>'
      + '</tr>';
  });
  html += '</table>';
  return html;
}

// ── Excel Export ───────────────────────────────────────────────────────
function exportExcel(lang) {
  const wb = XLSX.utils.book_new();
  const isEN = lang === 'en';

  // Overview sheet
  const overviewData = POSTS.map(p => ({
    [isEN ? 'Author' : 'Автор']: p.authorName,
    [isEN ? 'Text' : 'Текст']: (p.text||'').substring(0, 200),
    [isEN ? CFG.viewsLabel : 'Гледания']: p.views||0,
    [isEN ? CFG.likesLabel : 'Харесвания']: p.likes||0,
    [isEN ? CFG.sharesLabel : 'Споделяния']: p.shares||0,
    [isEN ? CFG.commentsLabel : 'Коментари']: p.comments||0,
    [isEN ? 'Engagement' : 'Ангажираност']: engRate(p),
    [isEN ? 'Date' : 'Дата']: (p.createdAt||'').substring(0, 10),
    [isEN ? 'URL' : 'Линк']: p.url||'',
  }));
  const ws1 = XLSX.utils.json_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, ws1, isEN ? 'All Content' : 'Съдържание');

  // Hashtags sheet
  const tags = {};
  POSTS.forEach(p => (p.hashtags||[]).forEach(h => {
    const key = h.toLowerCase();
    if (!tags[key]) tags[key] = { tag: h, count: 0, views: 0 };
    tags[key].count++;
    tags[key].views += p.views||0;
  }));
  const hashData = Object.values(tags).sort((a,b) => b.count - a.count).map(t => ({
    [isEN ? 'Hashtag' : 'Хаштаг']: '#' + t.tag,
    [isEN ? 'Count' : 'Брой']: t.count,
    [isEN ? 'Total Views' : 'Общо гледания']: t.views,
    [isEN ? 'Avg Views' : 'Средно гледания']: Math.round(t.views/t.count),
  }));
  const ws2 = XLSX.utils.json_to_sheet(hashData);
  XLSX.utils.book_append_sheet(wb, ws2, isEN ? 'Hashtags' : 'Хаштагове');

  XLSX.writeFile(wb, '${channelName || "research"}_' + PLATFORM + '_' + lang + '.xlsx');
}

// ── Init ───────────────────────────────────────────────────────────────
renderOverview();
renderChannel();
renderCompetitors();
renderTop();
renderAllContent();
renderHashtags();
</script>
</div></div></body></html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Public API: generate + save dashboard ───────────────────────────────────

async function generateAndSaveDashboard({
  platform,
  channelName,
  channelUrl,
  scrapedDate,
  rawPosts,           // raw scraped data (platform-specific format)
  competitors = [],   // [{ name, rawPosts }]
  analysisHtml,
  recommendationsHtml,
  projectSlug,
  projectName,
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.facebook;

  // Normalise posts
  const posts = rawPosts.map(p => cfg.normalise(p));
  const compEntries = competitors.map(c => ({
    name: c.name,
    posts: (c.rawPosts || []).map(p => cfg.normalise(p)),
  }));

  const html = generateDashboardHTML({
    platform,
    channelName,
    channelUrl,
    scrapedDate: scrapedDate || new Date().toISOString().substring(0, 10),
    posts,
    competitors: compEntries,
    analysisHtml,
    recommendationsHtml,
    projectName,
  });

  // Save to project directory
  const projectDir = resolve(process.cwd(), "assets/0. Projects", projectSlug || "research");
  await mkdir(projectDir, { recursive: true });
  const filename = `${platform}-research-dashboard.html`;
  const filePath = join(projectDir, filename);
  await writeFile(filePath, html, "utf-8");

  // Also save to public for immediate access
  const publicPath = join(resolve(process.cwd(), "public"), `${projectSlug || "research"}-${platform}-dashboard.html`);
  await writeFile(publicPath, html, "utf-8");

  console.log(`[Dashboard] Generated: ${filePath}`);
  console.log(`[Dashboard] Public URL: /${projectSlug || "research"}-${platform}-dashboard.html`);

  return {
    filePath,
    publicUrl: `/${projectSlug || "research"}-${platform}-dashboard.html`,
    postCount: posts.length,
    platform,
  };
}

// ─── API Endpoints ───────────────────────────────────────────────────────────

// POST /api/dashboard/generate — generate a dashboard from scraped data
router.post("/generate", async (req, res) => {
  try {
    const result = await generateAndSaveDashboard(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Dashboard] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { generateAndSaveDashboard, generateDashboardHTML, PLATFORM_CONFIG };
