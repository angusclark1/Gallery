let currentFeaturedId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.demo-cell').forEach(cell => {
        cell.addEventListener('click', () => flyToFeatured(cell));
    });
    runLoader();
});

function runLoader() {
    const loaderScreen = document.getElementById('loaderScreen');
    const loaderTitle  = document.getElementById('loaderTitle');
    const loaderSub    = document.getElementById('loaderSub');
    const header       = document.querySelector('.site-header');
    const layout       = document.querySelector('.layout');

    const title = 'Cobble Gallery';
    const lines = [
        'A microservice for uploading,',
        'viewing and deleting images',
        'through the Cobble Gallery API'
    ];

    let i = 0;

    function typeTitle() {
        if (i < title.length) {
            loaderTitle.textContent += title[i];
            i++;
            setTimeout(typeTitle, 110);
        } else {
            setTimeout(typeLines, 800);
        }
    }

    let lineIndex = 0;
    let charIndex = 0;

    function typeLines() {
        // Fade sub in on first char
        if (lineIndex === 0 && charIndex === 0) {
            loaderSub.style.opacity = '1';
        }

        if (lineIndex >= lines.length) {
            setTimeout(collapseLoader, 1800);
            return;
        }

        const currentLine = lines[lineIndex];

        if (charIndex === 0 && lineIndex > 0) {
            loaderSub.innerHTML += '<br>';
        }

        if (charIndex < currentLine.length) {
            if (charIndex === 0) {
                loaderSub.innerHTML += '<span class="loader-line"></span>';
            }
            const spans = loaderSub.querySelectorAll('.loader-line');
            spans[spans.length - 1].textContent += currentLine[charIndex];
            charIndex++;
            setTimeout(typeLines, 28);
        } else {
            lineIndex++;
            charIndex = 0;
            setTimeout(typeLines, 160);
        }
    }

    // Hex spins alone for a moment before anything types
    setTimeout(typeTitle, 1200);

    function collapseLoader() {
        // Fade out text first, then screen
        loaderTitle.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        loaderSub.style.transition   = 'opacity 0.4s ease';
        loaderTitle.style.opacity    = '0';
        loaderTitle.style.transform  = 'translateY(-10px)';
        loaderSub.style.opacity      = '0';

        setTimeout(() => {
            loaderScreen.classList.add('hide');
        }, 500);

        setTimeout(() => {
            header.style.transition  = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
            header.classList.add('visible');
        }, 800);

        setTimeout(() => {
            // Stagger each child of layout in
            const panel  = document.querySelector('.controls-panel');
            const main   = document.querySelector('.gallery-main');

            if (panel) {
                panel.style.transition = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
                panel.style.opacity    = '0';
                panel.style.transform  = 'translateX(-16px)';
            }
            if (main) {
                main.style.transition  = 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
                main.style.opacity     = '0';
                main.style.transform   = 'translateX(16px)';
            }

            layout.classList.add('visible');

            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (panel) { panel.style.opacity = '1'; panel.style.transform = 'translateX(0)'; }
                if (main)  { main.style.opacity  = '1'; main.style.transform  = 'translateX(0)'; }
            }));

        }, 1100);

        setTimeout(() => {
            loaderScreen.remove();
        }, 1400);
    }
}

function runHeaderTypewriter() {
    // No longer used — typing happens on loader screen now
}

async function loadGallery() {
    const apiBase = document.getElementById("apiBase").value.trim();
    const memberId = document.getElementById("memberId").value.trim();
    const grid = document.getElementById("grid");

    setStatus("Loading...");
    grid.querySelectorAll('.honeycomb-cell:not(.demo-cell):not(.honeycomb-hidden)').forEach(el => el.remove());
    resetFeatured();

    const res = await fetch(`${apiBase}/api/gallery/${encodeURIComponent(memberId)}`);
    if (!res.ok) { setStatus(`Load failed: ${res.status}`, true); return; }

    const items = await res.json();
    setStatus(`Loaded ${items.length} item(s)`);

    const countEl = document.getElementById("galleryCount");
    if (countEl) countEl.textContent = `${items.length} image${items.length !== 1 ? "s" : ""}`;

    const filler = grid.querySelector('.honeycomb-hidden');

    items.forEach((it, i) => {
        const li = document.createElement("li");
        li.className = "honeycomb-cell";
        li.style.animationDelay = `${i * 55}ms`;
        li.dataset.imageId = it.ImageID;
        li.dataset.title = it.Title || "";
        li.dataset.desc = it.Description || "";
        li.dataset.privacy = it.Privacy || "";

        const imgSrc = it.ThumbnailDataUrl || it.ImageDataUrl || "";
        li.dataset.src = imgSrc;

        li.innerHTML = `
            <div class="hex-shape">
                ${imgSrc
                    ? `<img class="hex-img" src="${imgSrc}" alt="${escapeHtml(it.Title || '')}" />`
                    : `<div class="hex-img hex-no-preview">No preview</div>`
                }
                <div class="hex-overlay"><span class="hex-label">${escapeHtml(it.Title || "Untitled")}</span></div>
            </div>
        `;

        li.addEventListener("click", () => flyToFeatured(li));
        if (filler) grid.insertBefore(li, filler);
        else grid.appendChild(li);
    });
}

function flyToFeatured(cell) {
    const featuredShape = document.getElementById("featuredShape");
    if (!featuredShape) return;

    const imgEl = cell.querySelector('img.hex-img');
    const src = imgEl ? imgEl.src : (cell.dataset.src || "");

    if (src) {
        const preloader = new Image();
        preloader.src = src;
    }

    const fromRect = cell.getBoundingClientRect();
    const toRect = featuredShape.getBoundingClientRect();

    const clone = document.createElement('div');
    clone.style.cssText = `
        position: fixed;
        left: ${fromRect.left}px;
        top: ${fromRect.top}px;
        width: ${fromRect.width}px;
        height: ${fromRect.height}px;
        z-index: 9999;
        pointer-events: none;
        transition: none;
        transform-origin: center center;
        overflow: visible;
    `;

    clone.innerHTML = `
        <div style="
            position: absolute;
            top: -100%;
            left: 0;
            width: 100%;
            height: 300%;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            overflow: hidden;
            background: #18181f;
        ">
            ${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}
        </div>
    `;

    document.body.appendChild(clone);

    const toCenterX = toRect.left + toRect.width / 2;
    const toCenterY = toRect.top + toRect.height / 2;
    const fromCenterX = fromRect.left + fromRect.width / 2;
    const fromCenterY = fromRect.top + fromRect.height / 2;

    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    const scale = (toRect.width / fromRect.width) * 0.88;

    cell.style.transition = 'opacity 0.3s';
    cell.style.opacity = '0.25';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            clone.style.transition = 'transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease 0.75s';
            clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotateY(180deg)`;
            clone.style.opacity = '0';
        });
    });

    setTimeout(() => {
        clone.remove();
        cell.style.opacity = '1';
        revealFeatured(cell, src);
    }, 1100);
}










function revealFeatured(cell, src) {
    const wrap = document.getElementById("featuredWrap");
    const featuredImg = document.getElementById("featuredImg");
    const placeholder = document.querySelector(".featured-placeholder");

    if (src) {
        featuredImg.src = src;
        featuredImg.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
    } else {
        featuredImg.style.display = "none";
        if (placeholder) placeholder.style.display = "flex";
    }

    document.getElementById("featuredTitle").textContent = cell.dataset.title || "Untitled";
    document.getElementById("featuredDesc").textContent = cell.dataset.desc || "No description provided.";
    document.getElementById("featuredMeta").textContent =
        cell.dataset.imageId
            ? `ID: ${cell.dataset.imageId}  ·  ${cell.dataset.privacy || ""}`
            : "Demo image";

    const deleteBtn = document.getElementById("featuredDelete");
    if (cell.dataset.imageId) {
        deleteBtn.style.display = "inline-flex";
        currentFeaturedId = cell.dataset.imageId;
    } else {
        deleteBtn.style.display = "none";
        currentFeaturedId = null;
    }

    wrap.classList.remove("has-image");
    void wrap.offsetWidth; 
    wrap.classList.add("has-image");

    document.getElementById("featuredInner").classList.add("has-selection");

    wrap.style.transition = 'none';
    wrap.style.opacity = '0';
    wrap.style.transform = 'translateY(-10px) scale(0.98)';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            wrap.style.transition = 'opacity 0.35s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
            wrap.style.opacity = '1';
            wrap.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function resetFeatured() {
    const featuredImg = document.getElementById("featuredImg");
    const placeholder = document.querySelector(".featured-placeholder");
    const wrap = document.getElementById("featuredWrap");

    featuredImg.style.display = "none";
    featuredImg.src = "";
    if (placeholder) placeholder.style.display = "flex";
    document.getElementById("featuredTitle").textContent = "Nothing selected";
    document.getElementById("featuredDesc").textContent = "Click any image in the gallery below to feature it here.";
    document.getElementById("featuredMeta").textContent = "";
    document.getElementById("featuredDelete").style.display = "none";
    wrap.classList.remove("has-image");
    document.getElementById("featuredInner").classList.remove("has-selection");
    wrap.style.opacity = '1';
    wrap.style.transform = 'none';
    currentFeaturedId = null;
}

async function delFeatured() {
    if (currentFeaturedId) await del(currentFeaturedId);
}

async function upload() {
    const apiBase = document.getElementById("apiBase").value.trim();
    const memberId = document.getElementById("memberId").value.trim();
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const privacy = document.getElementById("privacy").value;
    const file = document.getElementById("file").files[0];

    if (!memberId) return setStatus("MemberID required", true);
    if (!file) return setStatus("Choose a file first", true);

    const fd = new FormData();
    fd.append("memberId", memberId);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("privacy", privacy);
    fd.append("file", file);

    setStatus("Uploading...");
    const res = await fetch(`${apiBase}/api/gallery/upload`, { method: "POST", body: fd });
    const text = await res.text();
    if (!res.ok) { setStatus(`Upload failed: ${res.status} ${text}`, true); return; }

    setStatus("Uploaded ✅");
    await loadGallery();
}

async function del(imageId) {
    const apiBase = document.getElementById("apiBase").value.trim();
    const memberId = document.getElementById("memberId").value.trim();

    if (!confirm("Delete image?")) return;

    setStatus("Deleting...");
    const res = await fetch(
        `${apiBase}/api/gallery/${imageId}?memberId=${encodeURIComponent(memberId)}`,
        { method: "DELETE" }
    );
    if (!res.ok) { setStatus(`Delete failed: ${res.status}`, true); return; }

    setStatus("Deleted ✅");
    resetFeatured();
    await loadGallery();
}

function setStatus(msg, isError = false) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = "status-msg" + (isError ? " status-error" : "");
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m =>
        ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}