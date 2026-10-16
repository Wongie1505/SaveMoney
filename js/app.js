/* ==========================================================
   Get it done: offline savings thermometer
   State shape:
   S = { cur: "K", projects: [
       { id, name, target, deadline, tx: [{ a, n, t }],
         done: null | { date, notes, photo, w, h } }
   ] }
   ========================================================== */

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let S = JSON.parse(localStorage.getItem('gid') || '{"cur":"K","projects":[]}');

/* ---------- Helpers ---------- */

function save() {
    try {
        localStorage.setItem('gid', JSON.stringify(S));
        return true;
    } catch {
        alert('Storage is full. Download a backup and delete some old projects.');
        return false;
    }
}

const esc = s => s.replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
}[c]));

const raised = p => p.tx.reduce((sum, t) => sum + t.a, 0);
const money = n => S.cur + Math.round(n).toLocaleString('en-US');
const find = id => S.projects.find(p => p.id === id);
const today = () => new Date().toISOString().slice(0, 10);

/* Shrinks a photo so localStorage does not fill up after a few projects */
function compress(file, max = 900) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * k);
            c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve({ url: c.toDataURL('image/jpeg', 0.7), w: c.width, h: c.height });
        };
        img.onerror = reject;
        img.src = url;
    });
}

/* ---------- Views ---------- */

function row(p, inner) {
    return `
        <div class="item" data-row="${p.id}">
            <a href="#p/${p.id}">${inner}</a>
            <button class="icon" data-act="dots" data-id="${p.id}"
                    aria-label="Options for ${esc(p.name)}">&#8942;</button>
        </div>`;
}

function home() {
    const active = S.projects.filter(p => !p.done);
    const done = S.projects.filter(p => p.done);

    const activeRows = active.map(p => {
        const pc = Math.min(100, Math.round(raised(p) / p.target * 100));
        return row(p, `
            <span>
                <b>${esc(p.name)}</b>
                <small>${pc}% &nbsp;${money(raised(p))} of ${money(p.target)}</small>
            </span>`);
    }).join('');

    const doneRows = done.map(p => row(p, `
        <img class="thumb" src="${p.done.photo}" alt="">
        <span>
            <b>${esc(p.name)}</b>
            <small>Completed ${p.done.date} &nbsp;${money(raised(p))}</small>
        </span>`)).join('');

    return `
        <button class="big" data-act="newp">+ New project</button>
        <h2>Recent</h2>
        ${activeRows || '<p class="empty">Nothing in progress. Start a project and name the thing you are saving for.</p>'}
        ${done.length ? `<h2>Completed</h2>${doneRows}` : ''}`;
}

function history(p) {
    const items = p.tx.slice(-8).reverse().map(t => `
        <div class="tx">
            <div>${esc(t.n || (t.a > 0 ? 'Added' : 'Removed'))}<small>${t.t}</small></div>
            <b class="${t.a < 0 ? 'out' : ''}">${t.a < 0 ? '-' : '+'}${money(Math.abs(t.a))}</b>
        </div>`).join('');
    return items ? `<h2>History</h2>${items}` : '';
}

function thermometer(p, pct) {
    const ticks = [0.25, 0.5, 0.75, 1].map(f => {
        const y = 275 - 265 * f;
        const color = pct >= f ? '#d8402f' : '#4d6b63';
        return `
            <line x1="66" x2="78" y1="${y}" y2="${y}" stroke="${color}" stroke-width="2"/>
            <text x="82" y="${y + 4}" font-size="11" font-weight="700" fill="${color}">${money(p.target * f)}</text>`;
    }).join('');

    return `
        <svg id="thermo" viewBox="0 0 170 300" aria-label="${Math.round(pct * 100)}% raised">
            <defs>
                <clipPath id="c">
                    <rect x="35" y="10" width="30" height="270" rx="15"/>
                    <circle cx="50" cy="275" r="24"/>
                </clipPath>
            </defs>
            <rect x="35" y="10" width="30" height="270" rx="15" fill="#fbfdfb"/>
            <circle cx="50" cy="275" r="24" fill="#fbfdfb"/>
            <g clip-path="url(#c)">
                <rect class="fill" id="fill" x="20" y="10" width="60" height="300"
                      fill="#d8402f" style="transform:translateY(275px)"/>
            </g>
            <rect x="35" y="10" width="30" height="270" rx="15" fill="none" stroke="#10302a" stroke-width="3"/>
            <circle cx="50" cy="275" r="24" fill="none" stroke="#10302a" stroke-width="3"/>
            ${ticks}
        </svg>`;
}

function project(p) {
    const r = raised(p);
    const pct = Math.min(1, r / p.target);
    const left = Math.max(0, p.target - r);

    let plan = 'No deadline set.';
    if (left <= 0) {
        plan = 'Goal reached. Complete the project to log your win.';
    } else if (p.deadline) {
        const days = Math.ceil((new Date(p.deadline) - Date.now()) / 864e5);
        plan = days <= 0
            ? 'Deadline passed. Reset it or push on.'
            : `Save ${money(left / Math.max(1, Math.ceil(days / 7)))} a week to finish by ${p.deadline}.`;
    }

    return `
        <div class="proj">
            <div>
                <div class="stat"><small>Target</small><span>${money(p.target)}</span></div>
                <div class="stat"><small>Raised</small><span>${money(r)}</span></div>
                <div class="stat"><small>Remaining</small><span>${money(left)}</span></div>
                <p class="plan">${plan}</p>
            </div>
            ${thermometer(p, pct)}
        </div>
        <div class="acts">
            <button class="sub" data-act="sub" data-id="${p.id}">&minus; Subtract</button>
            <button class="add" data-act="add" data-id="${p.id}">+ Add</button>
        </div>
        ${left <= 0 ? `<button class="big finish" data-act="finish" data-id="${p.id}">Complete project</button>` : ''}
        ${history(p)}`;
}

function trophy(p) {
    return `
        <img class="photo" src="${p.done.photo}" alt="Photo of ${esc(p.name)}">
        <div class="stat">
            <small>Completed ${p.done.date}, target was ${money(p.target)}</small>
            <span>${money(raised(p))} saved</span>
        </div>
        <p class="notes">${esc(p.done.notes)}</p>
        ${history(p)}`;
}

function settings() {
    return `
        <div class="set">
            <label>Currency symbol
                <input id="cur" value="${esc(S.cur)}" maxlength="4">
            </label>
            <button data-act="pdf">Download report (PDF)</button>
            <button class="ghost" data-act="export">Download backup (JSON)</button>
            <label>Restore backup
                <input type="file" id="imp" accept=".json">
            </label>
            <p class="empty">
                Data lives only in this browser. The PDF is for reading and sharing,
                it cannot be restored. Use the JSON backup to protect your data.
            </p>
        </div>`;
}

function render() {
    const h = location.hash.slice(1);
    const p = h.startsWith('p/') && find(h.slice(2));

    $('#drawer').classList.remove('open');
    $('#scrim').classList.remove('open');
    $('#title').textContent = p ? p.name : h === 'settings' ? 'Settings' : 'Get it done';
    $('#app').innerHTML = p
        ? (p.done ? trophy(p) : project(p))
        : h === 'settings' ? settings() : home();

    const fill = $('#fill');
    if (fill) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            fill.style.transform = `translateY(${265 * (1 - Math.min(1, raised(p) / p.target))}px)`;
        }));
    }
}

/* ---------- Bottom sheet ----------
   ok() may return:  undefined -> close and re-render
                     false     -> close, caller handles rendering
                     'stay'    -> keep the sheet open               */

function sheet(title, fields, ok, label = 'Save', danger = false) {
    const d = document.createElement('div');
    d.className = 'ov';
    d.innerHTML = `
        <form class="sheet">
            <h3>${title}</h3>
            ${fields}
            <div class="row">
                <button type="button" class="ghost" id="cx">Cancel</button>
                <button class="${danger ? 'danger' : ''}">${label}</button>
            </div>
        </form>`;
    document.body.append(d);

    const first = d.querySelector('input, textarea');
    if (first) first.focus();

    d.querySelector('#cx').onclick = () => d.remove();
    d.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true;

        const result = await ok(new FormData(e.target));
        if (result === 'stay') {
            btn.disabled = false;
            return;
        }
        d.remove();
        if (result !== false) render();
    };
}

function txSheet(id, sign) {
    const p = find(id);
    const sub = sign < 0;

    sheet(
        sub ? 'Subtract money' : 'Add money',
        `<input name="a" type="number" inputmode="numeric" min="1" ${sub ? `max="${raised(p)}"` : ''} required placeholder="Amount">
         <input name="n" ${sub ? 'required placeholder="Why are you taking it out?"' : 'placeholder="Note (optional)"'}>`,
        f => {
            p.tx.push({ a: sign * +f.get('a'), n: f.get('n').trim(), t: today() });
            save();
        }
    );
}

/* ---------- Celebration ---------- */

function celebrate(svg, done) {
    if (reduced || !svg) return done();

    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    svg.classList.add('boom');

    const cv = document.createElement('canvas');
    cv.id = 'fx';
    cv.width = innerWidth;
    cv.height = innerHeight;
    document.body.append(cv);
    const g = cv.getContext('2d');

    const colors = ['#d8402f', '#f5b82e', '#2f9e6f', '#3b7ddd', '#e86aa6', '#ffffff'];
    const emoji = ['🎉', '🎈', '⭐', '🥳', '🎊'];

    const bits = Array.from({ length: 150 }, () => {
        const a = Math.random() * Math.PI * 2;
        const v = 4 + Math.random() * 11;
        return {
            x: cx, y: cy,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 4,
            s: 6 + Math.random() * 8,
            c: colors[Math.floor(Math.random() * colors.length)],
            e: Math.random() < 0.15 ? emoji[Math.floor(Math.random() * emoji.length)] : null,
            rot: Math.random() * 6,
            vr: (Math.random() - 0.5) * 0.4
        };
    });

    let t0;
    const frame = t => {
        t0 = t0 || t;
        g.clearRect(0, 0, cv.width, cv.height);

        bits.forEach(b => {
            b.vy += 0.25;
            b.vx *= 0.99;
            b.x += b.vx;
            b.y += b.vy;
            b.rot += b.vr;

            g.save();
            g.translate(b.x, b.y);
            g.rotate(b.rot);
            if (b.e) {
                g.font = `${b.s * 2.4}px serif`;
                g.fillText(b.e, 0, 0);
            } else {
                g.fillStyle = b.c;
                g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
            }
            g.restore();
        });

        if (t - t0 < 2600) {
            requestAnimationFrame(frame);
        } else {
            cv.remove();
            done();
        }
    };

    setTimeout(() => requestAnimationFrame(frame), 600);
}

/* ---------- PDF report ---------- */

function exportPDF() {
    if (!window.jspdf) {
        alert('PDF library did not load. Check that js/jspdf.umd.min.js is uploaded next to app.js.');
        return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const M = 15;
    const W = 210 - 2 * M;
    const H = 297;
    let y = M;

    const room = h => {
        if (y + h > H - M) {
            doc.addPage();
            y = M;
        }
    };

    const text = (str, size = 10, bold = false, gap = 1) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(size);
        const lh = size * 0.45;
        doc.splitTextToSize(str, W).forEach(line => {
            room(lh);
            y += lh;
            doc.text(line, M, y);
        });
        y += gap;
    };

    text('Get it done: progress report', 18, true, 2);
    text(`Generated ${today()}`, 9, false, 6);

    S.projects.forEach(p => {
        text(p.name, 13, true, 1);
        text(
            `${p.done ? 'Completed ' + p.done.date : 'In progress'}  |  Target ${money(p.target)}  |  Raised ${money(raised(p))}`
            + (p.deadline ? `  |  Deadline ${p.deadline}` : ''),
            10, false, 2
        );

        if (p.done) {
            text(p.done.notes, 10, false, 2);
            let w = 70;
            let h = w * p.done.h / p.done.w;
            if (h > 90) {
                h = 90;
                w = h * p.done.w / p.done.h;
            }
            room(h);
            doc.addImage(p.done.photo, 'JPEG', M, y, w, h);
            y += h + 4;
        }

        p.tx.forEach(t => {
            text(`${t.t}   ${t.a < 0 ? '-' : '+'}${money(Math.abs(t.a))}   ${t.n}`, 9, false, 0.5);
        });
        y += 8;
    });

    doc.save(`get-it-done-report-${today()}.pdf`);
}

/* ---------- Actions ---------- */

const acts = {
    menu() {
        $('#drawer').classList.toggle('open');
        $('#scrim').classList.toggle('open');
    },

    dots(id, btn) {
        const pop = document.createElement('div');
        pop.className = 'pop';
        pop.innerHTML = `
            <button data-act="rename" data-id="${id}">Rename</button>
            <button class="danger" data-act="del" data-id="${id}">Delete</button>`;
        btn.parentElement.append(pop);
    },

    newp() {
        sheet(
            'New project',
            `<input name="name" required placeholder="What are you saving for?">
             <input name="target" type="number" inputmode="numeric" min="1" required placeholder="Target amount">
             <label>Deadline (optional)
                <input name="deadline" type="date" min="${today()}">
             </label>`,
            f => {
                S.projects.unshift({
                    id: Date.now().toString(36),
                    name: f.get('name').trim(),
                    target: +f.get('target'),
                    deadline: f.get('deadline'),
                    tx: [],
                    done: null
                });
                save();
            }
        );
    },

    rename(id) {
        const p = find(id);
        sheet(
            'Rename project',
            `<input name="name" required value="${esc(p.name)}">`,
            f => {
                p.name = f.get('name').trim();
                save();
            }
        );
    },

    del(id) {
        const p = find(id);
        const warn = !p.done && raised(p) > 0
            ? `<p>You have ${money(raised(p))} recorded here.</p>` : '';

        sheet(
            `Delete "${esc(p.name)}"?`,
            `${warn}<p>Its history${p.done ? ', photo and notes' : ''} will be gone for good.</p>`,
            () => {
                const el = document.querySelector(`[data-row="${id}"]`);
                S.projects = S.projects.filter(x => x !== p);
                save();
                if (el) el.classList.add('gone');
                setTimeout(render, 320);
                return false;
            },
            'Delete',
            true
        );
    },

    add: id => txSheet(id, 1),
    sub: id => txSheet(id, -1),

    finish(id) {
        const p = find(id);
        sheet(
            'Complete project',
            `<label>Photo of what you achieved
                <input name="photo" type="file" accept="image/*" required>
             </label>
             <label>Notes
                <textarea name="notes" rows="3" required placeholder="What did you get, and how does it feel?"></textarea>
             </label>`,
            async f => {
                let img;
                try {
                    img = await compress(f.get('photo'));
                } catch {
                    alert('Could not read that image. Try another one.');
                    return 'stay';
                }

                p.done = { date: today(), notes: f.get('notes').trim(), photo: img.url, w: img.w, h: img.h };
                if (!save()) {
                    p.done = null;
                    return 'stay';
                }

                celebrate($('#thermo'), render);
                return false;
            },
            'Complete'
        );
    },

    pdf: exportPDF,

    export() {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
        a.download = `get-it-done-backup-${today()}.json`;
        a.click();
    }
};

/* ---------- Events ---------- */

document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    const popOpen = b && b.dataset.act === 'dots' && b.parentElement.querySelector('.pop');

    document.querySelectorAll('.pop').forEach(p => p.remove());
    if (b && !popOpen) acts[b.dataset.act](b.dataset.id, b);
});

document.addEventListener('change', async e => {
    if (e.target.id === 'cur') {
        S.cur = e.target.value.trim() || 'K';
        save();
    }

    if (e.target.id === 'imp' && e.target.files[0]) {
        try {
            const data = JSON.parse(await e.target.files[0].text());
            if (!Array.isArray(data.projects)) throw 0;
            S = data;
            save();
            location.hash = '';
            render();
        } catch {
            alert('That file is not a valid backup.');
        }
    }
});

addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');