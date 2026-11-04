// Signing in and talking to the GitHub API. The token only ever goes to
// SITE.api, and every change is made as a single commit on the site's branch.

import { SITE } from '../config.js';

// Same key as isSignedIn() in layout.js.
const TOKEN_KEY = 'vex.token';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token, remember) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage is blocked, so there's nothing stored to clear.
  }
}

const repoPath = `/repos/${SITE.owner}/${SITE.repo}`;

export class GitHubClient {
  constructor(token) {
    this.token = token;
  }

  async request(path, { method = 'GET', body, accept = 'application/vnd.github+json' } = {}) {
    let response;
    try {
      response = await fetch(`${SITE.api}${path}`, {
        method,
        cache: 'no-store',
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError("Couldn't reach GitHub. Check your connection and try again.", 0);
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.json()).message || '';
      } catch {
        // The error body wasn't JSON, so the status alone will have to do.
      }
      throw new GitHubError(describeError(response.status, detail), response.status);
    }

    if (accept.includes('raw')) return response.text();
    return response.status === 204 ? null : response.json();
  }

  // Signs in: checks the token is valid and can push to the site's repo.
  async verify() {
    const user = await this.request('/user');
    let repo;
    try {
      repo = await this.request(repoPath);
    } catch (error) {
      if (error.status === 404) {
        throw new GitHubError(
          `This token can't see ${SITE.owner}/${SITE.repo}. Select that repository when creating the token.`,
          403,
        );
      }
      throw error;
    }
    if (!repo.permissions?.push) {
      throw new GitHubError(`${user.login} doesn't have write access to ${SITE.owner}/${SITE.repo}.`, 403);
    }
    return { login: user.login, name: user.name, avatarUrl: user.avatar_url };
  }

  // Reads a file's current text straight from the repo, or null if it's missing.
  // `ref` can be a branch or a commit.
  async readFile(path, ref = SITE.branch) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    try {
      return await this.request(`${repoPath}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`, {
        accept: 'application/vnd.github.raw+json',
      });
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  // Makes one commit. `buildChanges(headSha)` returns the files to change:
  //   { path, text }    write a text file
  //   { path, base64 }  write a binary file
  //   { path, remove }  delete a file
  // If something else lands on the branch at the same moment, it starts again
  // from the new head so that the other change is never overwritten.
  async commit(message, buildChanges) {
    const attempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      const ref = await this.request(`${repoPath}/git/ref/heads/${SITE.branch}`);
      const headSha = ref.object.sha;
      const head = await this.request(`${repoPath}/git/commits/${headSha}`);
      const changes = await buildChanges(headSha);

      const tree = await Promise.all(changes.map((change) => this.#toTreeEntry(change)));
      const newTree = await this.request(`${repoPath}/git/trees`, {
        method: 'POST',
        body: { base_tree: head.tree.sha, tree },
      });
      const commit = await this.request(`${repoPath}/git/commits`, {
        method: 'POST',
        body: { message, tree: newTree.sha, parents: [headSha] },
      });

      try {
        await this.request(`${repoPath}/git/refs/heads/${SITE.branch}`, {
          method: 'PATCH',
          body: { sha: commit.sha, force: false },
        });
        return commit;
      } catch (error) {
        if (error.status !== 422 || attempt >= attempts) throw error;
      }
    }
  }

  async #toTreeEntry({ path, text, base64, remove }) {
    const entry = { path, mode: '100644', type: 'blob' };
    if (remove) return { ...entry, sha: null };
    if (text !== undefined) return { ...entry, content: text };
    const blob = await this.request(`${repoPath}/git/blobs`, {
      method: 'POST',
      body: { content: base64, encoding: 'base64' },
    });
    return { ...entry, sha: blob.sha };
  }
}

function describeError(status, detail) {
  if (status === 401) return 'GitHub rejected this token. It may be mistyped, expired or revoked.';
  if (status === 403 && /rate limit/i.test(detail)) return 'GitHub rate limit reached. Try again in a few minutes.';
  if (status === 403) {
    return `GitHub refused this. Check the token has "Contents: Read and write" permission for ${SITE.repo}.`;
  }
  return detail ? `GitHub said: ${detail}` : `GitHub returned an error (${status}).`;
}
