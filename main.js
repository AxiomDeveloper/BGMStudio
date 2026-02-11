import { Octokit } from "https://esm.sh/octokit@4.1.0?bundle";

const BRIDGE_FILE_URL = "./content.json";

function setChip(element, label, tone = "warn") {
  element.textContent = label;
  element.classList.remove("chip-good", "chip-warn", "chip-bad");
  if (tone === "good") {
    element.classList.add("chip-good");
  } else if (tone === "bad") {
    element.classList.add("chip-bad");
  } else {
    element.classList.add("chip-warn");
  }
}

function normalizeJson(raw) {
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

class GitHubPagesService {
  constructor({ token, owner, repo, branch }) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.octokit = new Octokit({ auth: token });
  }

  async pushAtomicContent({ path, message, content }) {
    const ref = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${this.branch}`
    });

    const currentCommitSha = ref.data.object.sha;
    const currentCommit = await this.octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: currentCommitSha
    });

    const blob = await this.octokit.rest.git.createBlob({
      owner: this.owner,
      repo: this.repo,
      content,
      encoding: "utf-8"
    });

    const tree = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: currentCommit.data.tree.sha,
      tree: [
        {
          path,
          mode: "100644",
          type: "blob",
          sha: blob.data.sha
        }
      ]
    });

    const commit = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: tree.data.sha,
      parents: [currentCommitSha]
    });

    await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${this.branch}`,
      sha: commit.data.sha,
      force: false
    });

    return {
      commitSha: commit.data.sha,
      commitUrl: `https://github.com/${this.owner}/${this.repo}/commit/${commit.data.sha}`
    };
  }
}

class BGMStudioControlRoom {
  constructor() {
    this.editor = document.querySelector("#json-editor");
    this.bridgeStatus = document.querySelector("#bridge-status");
    this.jsonStatus = document.querySelector("#json-status");
    this.shipStatus = document.querySelector("#ship-status");
    this.reloadButton = document.querySelector("#reload-btn");
    this.shipButton = document.querySelector("#ship-btn");

    this.ownerInput = document.querySelector("#gh-owner");
    this.repoInput = document.querySelector("#gh-repo");
    this.branchInput = document.querySelector("#gh-branch");
    this.tokenInput = document.querySelector("#gh-token");
    this.pathInput = document.querySelector("#gh-path");
    this.messageInput = document.querySelector("#gh-message");

    this.state = {
      raw: "",
      normalized: "",
      parsed: null
    };
  }

  async init() {
    this.bindEvents();
    await this.loadBridgeFile();
  }

  bindEvents() {
    this.editor.addEventListener("input", () => this.onEditorInput());
    this.reloadButton.addEventListener("click", () => this.loadBridgeFile());
    this.shipButton.addEventListener("click", () => this.ship());
  }

  async loadBridgeFile() {
    setChip(this.bridgeStatus, "Checking", "warn");
    try {
      const response = await fetch(`${BRIDGE_FILE_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Bridge fetch failed (${response.status})`);
      }
      const raw = await response.text();
      this.editor.value = raw;
      this.state.raw = raw;
      this.onEditorInput();
      setChip(this.bridgeStatus, "Hard-Link Live", "good");
    } catch (error) {
      console.error("[BGMstudio] load bridge failed", error);
      setChip(this.bridgeStatus, "Bridge Offline", "bad");
      setChip(this.shipStatus, "Load failed", "bad");
    }
  }

  onEditorInput() {
    const raw = this.editor.value;
    this.state.raw = raw;
    try {
      this.state.normalized = normalizeJson(raw);
      this.state.parsed = JSON.parse(this.state.normalized);
      setChip(this.jsonStatus, "Valid JSON", "good");
    } catch (error) {
      this.state.parsed = null;
      setChip(this.jsonStatus, "Invalid JSON", "bad");
    }
  }

  getShipConfig() {
    return {
      owner: this.ownerInput.value.trim(),
      repo: this.repoInput.value.trim(),
      branch: this.branchInput.value.trim() || "main",
      token: this.tokenInput.value.trim(),
      path: this.pathInput.value.trim() || "content.json",
      message: this.messageInput.value.trim() || "chore(content): ship update"
    };
  }

  validateShipConfig(config) {
    return Boolean(config.owner && config.repo && config.token);
  }

  vibrateShipButton() {
    if ("vibrate" in navigator) {
      navigator.vibrate([12, 28, 12]);
    }
  }

  async ship() {
    if (!this.state.parsed) {
      setChip(this.shipStatus, "Fix JSON first", "bad");
      return;
    }

    const config = this.getShipConfig();
    if (!this.validateShipConfig(config)) {
      setChip(this.shipStatus, "Missing GitHub credentials", "bad");
      return;
    }

    this.vibrateShipButton();
    this.shipButton.disabled = true;
    setChip(this.shipStatus, "Shipping", "warn");

    try {
      const service = new GitHubPagesService(config);
      /* @ANTIGRAVITY_INJECT: [SHIP_SEQUENCE_HUD_AND_TACTILE_TIMELINE] */
      const result = await service.pushAtomicContent({
        path: config.path,
        message: config.message,
        content: this.state.normalized
      });

      setChip(this.shipStatus, `Shipped ${result.commitSha.slice(0, 7)}`, "good");
      console.info("[BGMstudio] Commit URL:", result.commitUrl);
    } catch (error) {
      console.error("[BGMstudio] ship failed", error);
      setChip(this.shipStatus, "Ship failed", "bad");
    } finally {
      this.shipButton.disabled = false;
    }
  }
}

const controlRoom = new BGMStudioControlRoom();
controlRoom.init().catch((error) => {
  console.error("[BGMstudio] init failed", error);
});
