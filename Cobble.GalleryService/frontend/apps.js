let currentFeaturedId = null;

async function loadGallery() {
    const apiBase = document.getElementById("apiBase").value.trim();
    const memberId = document.getElementById("memberId").value.trim();
    const status = document.getElementById("status");
    const grid = document.getElementById("grid");

    setStatus("Loading...");
    grid.innerHTML = "";
    resetFeatured();

    const res = await fetch(`${apiBase}/api/gallery/${encodeURIComponent(memberId)}`);
    if (!res.ok) {
        setStatus(`Load failed: ${res.status}`, true);
        return;
    }

    const items = await res.json();
    setStatus(`Loaded ${items.length} item(s)`);

    items.forEach((it, i) => {
        const li = document.createElement("li");
        li.className = "honeycomb-cell";
        li.style.animationDelay = `${i * 60}ms`;
        li.dataset.imageId = it.ImageID;
        li.dataset.title = it.Title || "";
        li.dataset.desc = it.Description || "";
        li.dataset.privacy = it.Privacy || "";
        li.dataset.src = it.ThumbnailDataUrl || it.ImageDataUrl || "";

        const imgSrc = it.ThumbnailDataUrl || it.ImageDataUrl || "";

        li.innerHTML = `
            <div class="hex-shape">
                ${imgSrc
                    ? `<img class="hex-img" src="${imgSrc}" alt="${escapeHtml(it.Title || '')}" />`
                    : `<div class="hex-img hex-no-preview">No preview</div>`
                }
                <div class="hex-overlay">
                    <span class="hex-label">${escapeHtml(it.Title || "Untitled")}</span>
                </div>
            </div>
        `;

        li.addEventListener("click", () => flyToFeatured(li));
        grid.appendChild(li);
    });

    // Add hidden filler for honeycomb alignment
    const filler = document.createElement("li");
    filler.className = "honeycomb-cell honeycomb-hidden";
    grid.appendChild(filler);
}

function flyToFeatured(cell) {
    const featuredInner = document.getElementById("featuredInner");
    const featuredShape = featuredInner.querySelector(".featured-hex-shape");

    const cellRect = cell.getBoundingClientRect();
    const targetRect = featuredShape.getBoundingClientRect();

    // Clone the clicked cell
    const clone = cell.cloneNode(true);
    clone.classList.add("flying-hex");
    document.body.appendChild(clone);

    Object.assign(clone.style, {
        position: "fixed",
        left: cellRect.left + "px",
        top: cellRect.top + "px",
        width: cellRect.width + "px",
        height: cellRect.height + "px",
        margin: 0,
        transform: "none",
        zIndex: 1000,
        pointerEvents: "none"
    });

    const scaleX = targetRect.width / cellRect.width;
    const scaleY = targetRect.height / cellRect.height;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const dx = targetRect.left + targetRect.width / 2 - (cellRect.left + cellRect.width / 2);
            const dy = targetRect.top + targetRect.height / 2 - (cellRect.top + cellRect.height / 2);
            clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale}) rotateY(179deg)`;
        });
    });

    clone.addEventListener("transitionend", () => {
        clone.remove();
        updateFeatured(cell);
    }, { once: true });
}

function updateFeatured(cell) {
    const src = cell.dataset.src;
    const title = cell.dataset.title || "Untitled";
    const desc = cell.dataset.desc || "";
    const imageId = cell.dataset.imageId;
    const privacy = cell.dataset.privacy || "";

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

    document.getElementById("featuredTitle").textContent = title;
    document.getElementById("featuredDesc").textContent = desc;
    document.getElementById("featuredMeta").textContent = `ImageID: ${imageId}  •  ${privacy}`;

    const deleteBtn = document.getElementById("featuredDelete");
    deleteBtn.style.display = "inline-block";

    currentFeaturedId = imageId;

    document.getElementById("featuredWrap").classList.add("has-image");
}

function resetFeatured() {
    document.getElementById("featuredImg").style.display = "none";
    document.getElementById("featuredImg").src = "";
    const placeholder = document.querySelector(".featured-placeholder");
    if (placeholder) placeholder.style.display = "flex";
    document.getElementById("featuredTitle").textContent = "—";
    document.getElementById("featuredDesc").textContent = "";
    document.getElementById("featuredMeta").textContent = "";
    document.getElementById("featuredDelete").style.display = "none";
    document.getElementById("featuredWrap").classList.remove("has-image");
    currentFeaturedId = null;
}

async function delFeatured() {
    if (!currentFeaturedId) return;
    await del(currentFeaturedId);
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

    if (!res.ok) {
        setStatus(`Upload failed: ${res.status} ${text}`, true);
        return;
    }

    setStatus("Uploaded");
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

    if (!res.ok) {
        setStatus(`Delete failed: ${res.status}`, true);
        return;
    }

    setStatus("Deleted");
    resetFeatured();
    await loadGallery();
}

function setStatus(msg, isError = false) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = "status-msg" + (isError ? " status-error" : "");
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[m]));
}
