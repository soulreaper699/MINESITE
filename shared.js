// VOXEL — Shared JavaScript Utilities

// =========================================================================
// 1. CROSSHAIR CURSOR
// =========================================================================
(function() {
  const ch = document.createElement('div');
  ch.id = 'cursor-crosshair';
  ch.innerHTML = '<div class="ch-h"></div><div class="ch-v"></div>';
  document.body.appendChild(ch);
  document.addEventListener('mousemove', e => {
    ch.style.left = e.clientX + 'px';
    ch.style.top  = e.clientY + 'px';
  });
})();

// =========================================================================
// 2. ACHIEVEMENT TOAST SYSTEM
// =========================================================================
const ACHIEVEMENTS = {
  firstVisit:  { icon: '🏠', name: 'First Steps',         desc: 'Visited VOXEL' },
  crafted:     { icon: '⚒️',  name: 'Benchmaking',         desc: 'Used the Crafting Table' },
  enchanted:   { icon: '✦',  name: 'Enchanter',            desc: 'Entered the Enchanting Room' },
  looted:      { icon: '💎', name: "Diamonds!",            desc: 'Opened the Loot Chest' },
  musicPlayed: { icon: '🎵', name: 'Disc Jockey',          desc: 'Played a music disc' },
  mapViewed:   { icon: '🗺️',  name: 'Getting an Upgrade',  desc: 'Opened the Dynmap' },
  purchased:   { icon: '🛒', name: 'Bartering',            desc: 'Visited the Market' },
  read:        { icon: '📖', name: 'Bookworm',             desc: 'Read the Compendium' },
  ranked:      { icon: '🏆', name: 'Top of the World',    desc: 'Checked the Leaderboard' },
  portal:      { icon: '🌀', name: 'Into the Nether',     desc: 'Entered a Portal' },
  lootAny:     { icon: '📦', name: 'Getting Wood',         desc: 'Opened any chest' },
};

const unlocked = JSON.parse(localStorage.getItem('voxel_achievements') || '[]');

function unlockAchievement(key) {
  if (unlocked.includes(key)) return;
  unlocked.push(key);
  localStorage.setItem('voxel_achievements', JSON.stringify(unlocked));
  const a = ACHIEVEMENTS[key];
  if (!a) return;
  showToast(a.icon, a.name, a.desc);
  // Dispatch event for achievement page to listen to
  window.dispatchEvent(new CustomEvent('achievementUnlocked', { detail: key }));
}
window.unlockAchievement = unlockAchievement;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.getUnlocked  = () => unlocked;

function showToast(icon, title, sub) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'achievement-toast';
  t.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-text">
      <div class="toast-title">ACHIEVEMENT GET!</div>
      <div class="toast-name">${title}</div>
    </div>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
window.showToast = showToast;

// =========================================================================
// 3. NAV ACTIVE STATE
// =========================================================================
(function() {
  const path = window.location.pathname;
  document.querySelectorAll('.mc-nav-links a').forEach(a => {
    if (a.getAttribute('href') && path.includes(a.getAttribute('href').replace('../',''))) {
      a.classList.add('active');
    }
  });
})();

// =========================================================================
// 4. AUTO-FIRE PAGE ACHIEVEMENT
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('dynmap'))       unlockAchievement('mapViewed');
  if (path.includes('crafting'))     unlockAchievement('crafted');
  if (path.includes('enchanting'))   unlockAchievement('enchanted');
  if (path.includes('lootchest'))    unlockAchievement('lootAny');
  if (path.includes('jukebox'))      {}  // triggered on play
  if (path.includes('market'))       unlockAchievement('purchased');
  if (path.includes('compendium'))   unlockAchievement('read');
  if (path.includes('leaderboard'))  unlockAchievement('ranked');
  if (path.includes('index') || path.endsWith('/') || path.endsWith('/tbros/')) unlockAchievement('firstVisit');
});
