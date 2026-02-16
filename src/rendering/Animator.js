const IDLE_STATE = 'idle';

const isPlainObject = (value) => value !== null && typeof value === 'object';

const sanitizeAnimations = (map) => {
  if (!isPlainObject(map)) {
    return {};
  }

  const normalized = {};

  for (const [name, animation] of Object.entries(map)) {
    if (!isPlainObject(animation)) {
      continue;
    }

    const frames = Array.isArray(animation.frames) ? animation.frames : [];
    const fps = Number(animation.fps);

    normalized[name] = {
      frames,
      fps: Number.isFinite(fps) && fps > 0 ? fps : 0,
      loop: Boolean(animation.loop),
      onComplete: typeof animation.onComplete === 'function' ? animation.onComplete : undefined,
    };
  }

  return normalized;
};

export class Animator {
  /*
   * Player animation contract:
   * - idle: looping grounded stand animation.
   * - run: looping grounded movement animation.
   * - jump: one-shot upward airtime animation.
   * - fall: one-shot or looping downward airtime animation.
   */
  constructor(animations = {}, initialStateName = IDLE_STATE) {
    this.animations = {};
    this.currentState = null;
    this.currentFrameIndex = 0;
    this.elapsedSeconds = 0;
    this.playing = false;
    this.completed = false;

    this.setAnimations(animations);
    this.play(initialStateName, { reset: true });
  }

  setAnimations(map) {
    this.animations = sanitizeAnimations(map);

    const resolvedState = this.resolveState(this.currentState);
    if (!resolvedState) {
      this.currentState = null;
      this.currentFrameIndex = 0;
      this.elapsedSeconds = 0;
      this.playing = false;
      this.completed = false;
      return this;
    }

    if (resolvedState !== this.currentState) {
      this.currentState = resolvedState;
      this.resetPlayback();
      return this;
    }

    const animation = this.getAnimation(this.currentState);
    if (!animation || animation.frames.length === 0 || animation.fps <= 0) {
      this.currentFrameIndex = 0;
      this.elapsedSeconds = 0;
      this.playing = false;
      this.completed = false;
      return this;
    }

    this.currentFrameIndex = Math.min(this.currentFrameIndex, animation.frames.length - 1);
    if (animation.loop) {
      this.completed = false;
    } else if (this.completed) {
      this.playing = false;
    }

    return this;
  }

  play(name, { reset = false } = {}) {
    const resolvedState = this.resolveState(name);
    if (!resolvedState) {
      return this;
    }

    if (resolvedState !== this.currentState) {
      this.currentState = resolvedState;
      this.resetPlayback();
      return this;
    }

    if (reset) {
      this.resetPlayback();
      return this;
    }

    const animation = this.getAnimation(this.currentState);
    if (!animation || animation.frames.length === 0 || animation.fps <= 0) {
      this.playing = false;
      return this;
    }

    if (animation.loop || !this.completed) {
      this.playing = true;
    }

    return this;
  }

  stop() {
    this.playing = false;
    return this;
  }

  update(deltaSeconds) {
    if (!this.playing) {
      return this;
    }

    const animation = this.getAnimation(this.currentState);
    if (!animation || animation.frames.length === 0 || animation.fps <= 0) {
      this.currentFrameIndex = 0;
      this.elapsedSeconds = 0;
      this.playing = false;
      this.completed = false;
      return this;
    }

    const delta = Number(deltaSeconds);
    if (!Number.isFinite(delta) || delta <= 0) {
      return this;
    }

    const frameDuration = 1 / animation.fps;

    if (animation.loop) {
      const totalDuration = frameDuration * animation.frames.length;
      if (totalDuration <= 0) {
        this.currentFrameIndex = 0;
        return this;
      }

      this.elapsedSeconds = (this.elapsedSeconds + delta) % totalDuration;
      this.currentFrameIndex = Math.floor(this.elapsedSeconds / frameDuration);
      this.completed = false;
      return this;
    }

    const totalDuration = frameDuration * animation.frames.length;
    this.elapsedSeconds = Math.min(totalDuration, this.elapsedSeconds + delta);
    this.currentFrameIndex = Math.min(
      animation.frames.length - 1,
      Math.floor(this.elapsedSeconds / frameDuration),
    );

    if (this.elapsedSeconds >= totalDuration) {
      this.playing = false;

      if (!this.completed) {
        this.completed = true;
        if (typeof animation.onComplete === 'function') {
          animation.onComplete();
        }
      }
    }

    return this;
  }

  getCurrentFrame() {
    const animation = this.getAnimation(this.currentState);
    if (!animation || animation.frames.length === 0) {
      return null;
    }

    const index = Math.min(this.currentFrameIndex, animation.frames.length - 1);
    return animation.frames[index] ?? null;
  }

  getCurrentState() {
    return this.currentState;
  }

  isPlaying() {
    return this.playing;
  }

  getAnimation(stateName) {
    if (typeof stateName !== 'string') {
      return null;
    }

    return this.animations[stateName] ?? null;
  }

  resolveState(requestedState) {
    if (typeof requestedState === 'string' && this.animations[requestedState]) {
      return requestedState;
    }

    if (typeof this.currentState === 'string' && this.animations[this.currentState]) {
      return this.currentState;
    }

    if (this.animations[IDLE_STATE]) {
      return IDLE_STATE;
    }

    return null;
  }

  resetPlayback() {
    this.currentFrameIndex = 0;
    this.elapsedSeconds = 0;
    this.playing = true;
    this.completed = false;
  }
}
