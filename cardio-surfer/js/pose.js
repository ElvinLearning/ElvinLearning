// Camera + MediaPipe Pose Landmarker.
// Exposes a small class that pumps landmarks into a callback each frame.

const VISION_VER = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
              'pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Bones we draw in the mini preview.
const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32],
];

export class PoseTracker {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.onFrame = null;       // (landmarks|null) => void
    this.fit = 'cover';        // must match the CSS object-fit of the preview
    this.fps = 0;
    this._fpsT = performance.now();
    this._fpsN = 0;
  }

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser has no camera API. On iPhone you must use Safari (or Chrome/Edge on iOS 17+), and the page must be served over https://');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        throw new Error('Camera permission was denied. On iPhone: tap the "AA" button in the Safari address bar → Website Settings → Camera → Allow, then reload.');
      }
      if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        throw new Error('No front-facing camera was found on this device.');
      }
      throw new Error(`Could not open the camera (${e.name}). ${e.message || ''}`);
    }

    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();

    // Safari sometimes reports 0x0 for a beat after play() resolves.
    await new Promise((res) => {
      const check = () => (this.video.videoWidth > 0 ? res() : requestAnimationFrame(check));
      check();
    });
  }

  async loadModel() {
    if (this.landmarker) return;             // already downloaded this session
    let vision;
    try {
      const mod = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      vision = await mod.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      this._PoseLandmarker = mod.PoseLandmarker;
    } catch (e) {
      throw new Error('Could not download the pose model. Check your connection and reload. ' + (e.message || ''));
    }

    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });

    try {
      this.landmarker = await this._PoseLandmarker.createFromOptions(vision, opts('GPU'));
      this.delegate = 'GPU';
    } catch {
      // Some iOS/WebGL combos reject the GPU delegate — CPU still runs fine on the lite model.
      this.landmarker = await this._PoseLandmarker.createFromOptions(vision, opts('CPU'));
      this.delegate = 'CPU';
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  _loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const v = this.video;
    if (!this.landmarker || v.readyState < 2) return;
    if (v.currentTime === this.lastVideoTime) return;   // no new camera frame yet
    this.lastVideoTime = v.currentTime;

    let res;
    try {
      res = this.landmarker.detectForVideo(v, performance.now());
    } catch {
      return;
    }

    this._fpsN++;
    const now = performance.now();
    if (now - this._fpsT > 1000) {
      this.fps = Math.round((this._fpsN * 1000) / (now - this._fpsT));
      this._fpsN = 0; this._fpsT = now;
    }

    const lm = res?.landmarks?.[0] || null;
    this.draw(lm);
    this.onFrame?.(lm);
  };

  draw(lm) {
    const c = this.overlay;
    const w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr; c.height = h * dpr;
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!lm) return;

    // Replicate the preview's object-fit so the skeleton lands on the body.
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const s = this.fit === 'contain' ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
    const ox = (w - vw * s) / 2, oy = (h - vh * s) / 2;
    const px = (p) => p.x * vw * s + ox;
    const py = (p) => p.y * vh * s + oy;

    g.lineWidth = 2.2;
    g.strokeStyle = 'rgba(55,230,180,.92)';
    g.beginPath();
    for (const [a, b] of BONES) {
      if (!lm[a] || !lm[b]) continue;
      g.moveTo(px(lm[a]), py(lm[a]));
      g.lineTo(px(lm[b]), py(lm[b]));
    }
    g.stroke();

    g.fillStyle = '#fff';
    for (const i of [0, 11, 12, 23, 24, 25, 26, 27, 28]) {
      const p = lm[i]; if (!p) continue;
      g.beginPath(); g.arc(px(p), py(p), 2.6, 0, Math.PI * 2); g.fill();
    }
  }
}
