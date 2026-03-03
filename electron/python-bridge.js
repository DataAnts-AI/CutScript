const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

class PythonBackend {
  constructor(port, isDev) {
    this.port = port;
    this.isDev = isDev;
    this.process = null;
  }

  async start() {
    // In dev mode, check if a backend is already running (e.g. from `npm run dev:backend`)
    // If so, reuse it instead of spawning a duplicate.
    if (this.isDev) {
      const alreadyRunning = await this._isPortOpen(2000);
      if (alreadyRunning) {
        console.log(`[backend] Dev backend already running on port ${this.port} — reusing it.`);
        return;
      }
    }

    const backendDir = this.isDev
      ? path.join(__dirname, '..', 'backend')
      : path.join(process.resourcesPath, 'backend');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    this.process = spawn(pythonCmd, [
      '-m', 'uvicorn', 'main:app',
      '--host', '127.0.0.1',
      '--port', String(this.port),
    ], {
      cwd: backendDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    this.process.stdout.on('data', (data) => {
      console.log(`[backend] ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      console.error(`[backend] ${data.toString().trim()}`);
    });

    this.process.on('error', (err) => {
      console.error('[backend] Failed to start Python backend:', err.message);
    });

    this.process.on('exit', (code) => {
      console.log(`[backend] Process exited with code ${code}`);
      this.process = null;
    });

    await this._waitForReady(30000);
    console.log(`[backend] Ready on port ${this.port}`);
  }

  _isPortOpen(timeoutMs) {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  stop() {
    if (this.process) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
      } else {
        this.process.kill('SIGTERM');
      }
      this.process = null;
    }
  }

  _waitForReady(timeoutMs) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Backend startup timed out'));
          return;
        }
        const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            setTimeout(check, 500);
          }
        });
        req.on('error', () => setTimeout(check, 500));
        req.end();
      };
      setTimeout(check, 1000);
    });
  }
}

module.exports = { PythonBackend };
