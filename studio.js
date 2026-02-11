const studio = {
    db: { articles: {}, categories: [] },
    blocks: [],
    tags: [],
    currentSlug: null,
    repo: "AxiomDeveloper/Breaking-Ground-Media", // Points to Main Site

    async router(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');

        // Fetch data if entering Manager or Clips
        if (['manager', 'clips', 'hero-config'].includes(view)) {
            await this.fetchData();
        }
    },

    // --- CLIPS LOGIC (NEW) ---
    renderClips() {
        const grid = document.getElementById('clips-grid');
        // Find the category with type 'shorts' (now used for Clips)
        const clipsCat = this.db.categories.find(c => c.type === 'shorts');
        const items = clipsCat ? clipsCat.items : [];

        // We render the "Add New" card first in HTML, so we just append/fill the grid div
        // Actually, let's clear and rebuild including the Add Button
        let html = `
            <div class="clip-card new" onclick="studio.addClip()">
                <div class="icon">＋</div><p>Add Clip</p>
            </div>
        `;

        html += items.map((item, index) => `
            <div class="clip-card">
                <div class="delete-clip" onclick="event.stopPropagation(); studio.deleteClip(${index})">✕</div>
                <img src="${item.image}" onerror="this.src='https://via.placeholder.com/300x500?text=No+Img'">
                <div class="meta">
                    <h4>${item.title}</h4>
                </div>
            </div>
        `).join('');

        grid.innerHTML = html;
    },

    addClip() {
        const title = prompt("Clip Title:");
        if (!title) return;

        const url = prompt("Instagram Reel URL (or Link):");
        const img = prompt("Cover Image URL (Portrait 9:16):");

        const clipsCat = this.db.categories.find(c => c.type === 'shorts');
        if (clipsCat) {
            clipsCat.items.unshift({
                id: Date.now().toString(), // Unique ID
                title: title,
                image: img,
                link: url // Storing the link here
            });
            this.renderClips();
        } else {
            alert("Error: 'shorts' category not found in JSON.");
        }
    },

    deleteClip(index) {
        if (!confirm("Remove this clip?")) return;
        const clipsCat = this.db.categories.find(c => c.type === 'shorts');
        if (clipsCat) {
            clipsCat.items.splice(index, 1);
            this.renderClips();
        }
    },

    async saveClips() {
        // Just re-uses the main ship logic but specific message
        await this.pushToGitHub("Studio Update: Clips Feed");
    },

    // --- CORE SYNC ---
    async fetchData() {
        const token = localStorage.getItem('bgm_token');
        if (!token) return document.getElementById('token-modal').classList.add('active');

        try {
            const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/content.json`, {
                headers: { 'Authorization': `token ${token}` }
            });
            const data = await res.json();
            this.sha = data.sha;
            // Decode Content
            const decoded = decodeURIComponent(escape(atob(data.content)));
            this.db = JSON.parse(decoded);

            // Auto-render views depending on where we are
            if (document.getElementById('view-manager').classList.contains('active')) this.renderManager();
            if (document.getElementById('view-clips').classList.contains('active')) this.renderClips();

        } catch (e) { console.error(e); alert("Sync Error"); }
    },

    async pushToGitHub(msg) {
        const token = localStorage.getItem('bgm_token');
        const contentStr = JSON.stringify(this.db, null, 2);
        // Clean encoding for Emoji support
        const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

        const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/content.json`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                content: contentBase64,
                sha: this.sha
            })
        });

        if (res.ok) {
            alert("Synced successfully.");
            this.fetchData(); // Get new SHA
        } else {
            alert("Upload Failed.");
        }
    },

    // --- CREATOR LOGIC (Standard) ---
    addBlock(type) {
        const id = Date.now();
        this.blocks.push({ id, type, content: '' });
        this.renderStack();
    },

    updateBlock(id, val) {
        const b = this.blocks.find(x => x.id === id);
        if (b) b.content = val;
    },

    removeBlock(id) {
        this.blocks = this.blocks.filter(x => x.id !== id);
        this.renderStack();
    },

    renderStack() {
        document.getElementById('stack-area').innerHTML = this.blocks.map(b => `
            <div class="block">
                <small>${b.type.toUpperCase()}</small>
                <textarea oninput="studio.updateBlock(${b.id}, this.value)" placeholder="Content / URL">${b.content}</textarea>
                <button onclick="studio.removeBlock(${b.id})" class="remove-block">✕</button>
            </div>
        `).join('');
    },

    // Ship Article
    async ship() {
        const title = document.getElementById('c-title').value;
        const slug = this.currentSlug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

        // Add to Articles
        this.db.articles[slug] = {
            title: title,
            label: document.getElementById('c-label').value,
            hero: document.getElementById('c-hero-url').value,
            blocks: this.blocks,
            date: new Date().toISOString()
        };

        // Add to Latest Stories Feed (if new)
        const latest = this.db.categories.find(c => c.title === "Latest Stories");
        if (latest && !latest.items.find(i => i.id === slug)) {
            latest.items.unshift({
                id: slug,
                title: title,
                category: "Journalism",
                image: document.getElementById('c-hero-url').value
            });
        }

        await this.pushToGitHub(`Studio Ship: ${title}`);
        this.router('dashboard');
    },

    // Helpers
    saveToken() {
        localStorage.setItem('bgm_token', document.getElementById('gh-token').value);
        document.getElementById('token-modal').classList.remove('active');
        this.fetchData();
    }
};

// Event Listeners
document.getElementById('c-hero-trigger').onclick = () => {
    const url = prompt("Hero Image URL:");
    if (url) {
        document.getElementById('c-hero-url').value = url;
        document.getElementById('c-hero-preview').src = url;
        document.getElementById('c-hero-preview').style.display = 'block';
    }
};
