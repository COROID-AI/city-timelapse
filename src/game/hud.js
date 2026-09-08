// DOM HUD controller: speed readout, nitrous gauge + drift hint, lap/timer
// panel, live standings, countdown, and finish overlay.

const NAMES = {
  player: 'YOU',
  ai0: 'RAZOR',
  ai1: 'VOLT',
  ai2: 'NITRA',
  ai3: 'KAT',
};

function fmtTime(t) {
  if (t == null || !isFinite(t)) return '--:--';
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

export class HUD {
  constructor() {
    this.el = {
      speed: document.getElementById('speed'),
      nitroFill: document.getElementById('nitro-fill'),
      nitroWrap: document.getElementById('nitro-wrap'),
      drift: document.getElementById('drift'),
      lap: document.getElementById('lap'),
      lapTime: document.getElementById('lap-time'),
      totalTime: document.getElementById('total-time'),
      standings: document.getElementById('standings'),
      countdown: document.getElementById('countdown'),
      countdownNum: document.getElementById('countdown-num'),
      finish: document.getElementById('finish'),
      finishTitle: document.getElementById('finish-title'),
      finishList: document.getElementById('finish-list'),
      finalTime: document.getElementById('final-time'),
    };
    this.pos = {};
    this.standingCache = '';
  }

  update(snapshot) {
    const speedKmh = Math.round(Math.abs(snapshot.speed) * 3.6);
    this.el.speed.textContent = String(speedKmh);
    this.el.nitroFill.style.width = `${Math.round(snapshot.nitroFraction * 100)}%`;
    if (snapshot.boosting) {
      this.el.nitroWrap.classList.add('active');
    } else {
      this.el.nitroWrap.classList.remove('active');
    }
    this.el.drift.classList.toggle('drift-on', snapshot.drifting);
    this.el.lap.textContent = `${Math.min(snapshot.lap + 1, snapshot.totalLaps)} / ${snapshot.totalLaps}`;
    this.el.lapTime.textContent = fmtTime(snapshot.lapTime);
    this.el.totalTime.textContent = fmtTime(snapshot.totalTime);
    this._renderStandings(snapshot.standings);
  }

  _renderStandings(standings) {
    const items = standings
      .map((r) => {
        const name = NAMES[r.id] ?? r.id;
        const lap = Math.min(r.laps + 1, this._totalLaps());
        const prog = r.finished ? 'FIN' : `L${lap}`;
        return `<li><span class="pos">${prog}</span><span class="who">${name}</span><span class="spread"></span></li>`;
      })
      .join('');
    const key = items;
    if (key === this.standingCache) return;
    this.standingCache = key;
    this.el.standings.innerHTML = items;
  }

  _totalLaps() {
    return window.__LAPS__ || 3;
  }

  showCountdown(num) {
    this.el.countdown.classList.add('show');
    this.el.countdownNum.textContent = num;
  }

  hideCountdown() {
    this.el.countdown.classList.remove('show');
  }

  showFinish(finalStandings, finalTimes, playerTotal) {
    this.el.finish.classList.add('show');
    this.el.finishTitle.textContent =
      finalStandings[0] && finalStandings[0].id === 'player'
        ? '🏆 You Win!'
        : 'Race Complete';
    this.el.finalTime.textContent = `Your time: ${fmtTime(playerTotal)}`;
    const rows = finalStandings
      .map((r, i) => {
        const name = NAMES[r.id] ?? r.id;
        const total = finalTimes[r.id];
        return `<li>${i + 1}. ${name} — ${fmtTime(total)}</li>`;
      })
      .join('');
    this.el.finishList.innerHTML = rows;
  }

  hideFinish() {
    this.el.finish.classList.remove('show');
  }
}