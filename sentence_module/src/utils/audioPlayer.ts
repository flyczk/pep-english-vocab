/**
 * 单词朗读工具
 * 支持多种在线 TTS 与浏览器本地语音
 */

export type SpeechEngineMode = 'auto' | 'youdao' | 'baidu' | 'bing' | 'browser';
export type ResultEffectType = 'correct' | 'wrong' | 'mastery';

const SPEECH_ENGINE_STORAGE_KEY = 'words:speech-engine';
const SPEECH_VOICE_STORAGE_KEY = 'words:speech-voice-uri';
const AUTH_TOKEN_STORAGE_KEY = 'token';
const TTS_PROXY_API_PATH = '/api/tts/proxy';
let currentAudio: HTMLAudioElement | null = null;
let effectAudio: HTMLAudioElement | null = null;
let speechToken = 0;
// 播放令牌：每次新播放/停止都会自增，用于让仍处于网络请求阶段的旧 TTS 失效
let activeTtsToken = 0;
const RESULT_EFFECT_URLS: Record<ResultEffectType, string> = {
  correct: '/sfx/result-correct.mp3',
  wrong: '/sfx/result-wrong.mp3',
  mastery: '',
};


const getSpeechSynthesisSafe = (): SpeechSynthesis | null => {
  if (typeof window === 'undefined') return null;
  if (!('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
};

const normalizeEngine = (value: string | null | undefined): SpeechEngineMode => {
  // Backward compatibility: migrate legacy "google" to "bing"
  if (value === 'google') {
    return 'bing';
  }
  if (value === 'youdao' || value === 'baidu' || value === 'bing' || value === 'browser' || value === 'auto') {
    return value;
  }
  return 'auto';
};

export function getSpeechEnginePreference(): SpeechEngineMode {
  if (typeof window === 'undefined') return 'auto';
  return normalizeEngine(window.localStorage.getItem(SPEECH_ENGINE_STORAGE_KEY));
}

export function setSpeechEnginePreference(engine: SpeechEngineMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SPEECH_ENGINE_STORAGE_KEY, engine);
}

export function getSpeechVoicePreference(): string {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem(SPEECH_VOICE_STORAGE_KEY) || '');
}

export function setSpeechVoicePreference(voiceURI: string): void {
  if (typeof window === 'undefined') return;
  const value = String(voiceURI || '').trim();
  if (!value) {
    window.localStorage.removeItem(SPEECH_VOICE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SPEECH_VOICE_STORAGE_KEY, value);
}

export function getBrowserSpeechVoices(): SpeechSynthesisVoice[] {
  const synthesis = getSpeechSynthesisSafe();
  if (!synthesis) return [];
  const voices = synthesis.getVoices();
  return [...voices].sort((a, b) => {
    const aEn = /^en[-_]/i.test(a.lang) ? 0 : 1;
    const bEn = /^en[-_]/i.test(b.lang) ? 0 : 1;
    if (aEn !== bEn) return aEn - bEn;
    return a.name.localeCompare(b.name);
  });
}

const buildRemoteTtsUrl = (engine: Exclude<SpeechEngineMode, 'auto' | 'browser'>, word: string): string => {
  const encoded = encodeURIComponent(word);
  if (engine === 'youdao') {
    return `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`;
  }
  if (engine === 'baidu') {
    return `https://fanyi.baidu.com/gettts?lan=en&text=${encoded}&spd=3&source=web`;
  }
  return `https://cn.bing.com/dict/Speech?language=en&text=${encoded}`;
};

const getAuthToken = (): string => {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
};

const buildProxyTtsUrl = (
  engine: Exclude<SpeechEngineMode, 'auto' | 'browser'>,
  word: string,
): string => {
  const params = new URLSearchParams({
    engine,
    text: word,
  });
  return `${TTS_PROXY_API_PATH}?${params.toString()}`;
};

const normalizeSpeechText = (value: string): string => {
  const source = String(value || '').trim();
  if (!source) return '';
  return source
    .replace(/\bsth\.?\b/gi, 'something')
    .replace(/\bsb\.?\b/gi, 'somebody')
    .replace(/\s+/g, ' ')
    .trim();
};

function playWithRemoteTTS(
  url: string,
  label: string,
  options?: { revokeObjectUrl?: boolean; speed?: number; token?: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 停止之前的播放
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const audio = new Audio(url);
    if (options?.speed) {
      audio.playbackRate = options.speed;
    }
    currentAudio = audio;
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finalize = (handler: () => void) => {
      if (finished) return;
      finished = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      if (options?.revokeObjectUrl && typeof URL !== 'undefined') {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      handler();
    };

    // 一旦真正开始播放，就不再做过期计时：
    // 之前固定 5s 超时会把整句（朗读超过 5 秒）误判为卡死，降级到下一个引擎从头再播一遍
    audio.onplaying = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    audio.onended = () => {
      finalize(resolve);
    };

    audio.onerror = () => {
      finalize(() => reject(new Error(`${label} TTS failed`)));
    };

    // 超时保护
    timeout = setTimeout(() => {
      if (currentAudio === audio) {
        audio.pause();
      }
      finalize(() => reject(new Error('TTS timeout')));
    }, 8000);

    audio.play().catch((err) => {
      finalize(() => reject(err));
    });

    // 若播放过程中令牌已过期（已被新的播放或 stopAudio 取代），立即静默结束
    // 轮询在 play() 之后进行，避免 play 尚未触发时被误判
    const pollToken = () => {
      if (finished) return;
      if (options?.token != null && options.token !== activeTtsToken) {
        audio.pause();
        finalize(resolve);
        return;
      }
      setTimeout(pollToken, 120);
    };
    setTimeout(pollToken, 120);
  });
}

async function playWithEngineProxy(
  engine: Exclude<SpeechEngineMode, 'auto' | 'browser'>,
  word: string,
  speed?: number,
  token?: number,
): Promise<void> {
  const authToken = getAuthToken();
  if (!authToken) {
    throw new Error('Missing auth token');
  }
  const response = await fetch(buildProxyTtsUrl(engine, word), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Proxy ${engine} TTS failed: ${response.status} ${errorText.slice(0, 120)}`);
  }
  const blob = await response.blob();
  if (!blob || blob.size <= 0) {
    throw new Error(`Proxy ${engine} TTS empty response`);
  }
  // 网络请求可能耗时较长，返回后若令牌已过期则丢弃，防止"切到下一词后又读一遍"
  if (token != null && token !== activeTtsToken) {
    return;
  }
  const objectUrl = URL.createObjectURL(blob);
  await playWithRemoteTTS(objectUrl, `${engine} proxy`, { revokeObjectUrl: true, speed, token });
}

async function playWithEngineRemote(
  engine: Exclude<SpeechEngineMode, 'auto' | 'browser'>,
  word: string,
  speed?: number,
  token?: number,
): Promise<void> {
  // 百度与 Bing 优先经服务端代理，规避浏览器侧跨域/防盗链限制。
  let proxyError: unknown = null;
  if (engine === 'baidu' || engine === 'bing') {
    try {
      await playWithEngineProxy(engine, word, speed, token);
      return;
    } catch (error) {
      proxyError = error;
      // Fallback to direct URL when proxy route is unavailable on older backend.
    }
  }
  const directUrl = buildRemoteTtsUrl(engine, word);
  try {
    await playWithRemoteTTS(directUrl, engine, { speed, token });
  } catch (directError) {
    if (proxyError) {
      const proxyMsg = proxyError instanceof Error ? proxyError.message : String(proxyError);
      const directMsg = directError instanceof Error ? directError.message : String(directError);
      throw new Error(`${engine} proxy failed: ${proxyMsg}; direct failed: ${directMsg}`);
    }
    throw directError;
  }
}

async function playWithRemoteFallback(
  engines: Array<Exclude<SpeechEngineMode, 'auto' | 'browser'>>,
  word: string,
  speed?: number,
  token?: number,
): Promise<void> {
  let lastError: unknown = null;
  for (const engine of engines) {
    try {
      await playWithEngineRemote(engine, word, speed, token);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  try {
    await playWithSpeechSynthesis(word, speed);
  } catch (fallbackError) {
    if (lastError) throw lastError;
    throw fallbackError;
  }
}

/**
 * 使用浏览器 Web Speech API 播放（降级方案）
 */
function playWithSpeechSynthesis(word: string, speed?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const synthesis = getSpeechSynthesisSafe();
    if (!synthesis) {
      reject(new Error('SpeechSynthesis not supported'));
      return;
    }

    speechToken += 1;
    const currentToken = speechToken;
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch {
        // ignore
      }
      currentAudio = null;
    }
    synthesis.cancel();
    const voicePreference = getSpeechVoicePreference();
    const voices = getBrowserSpeechVoices();
    const preferredVoice =
      voices.find((voice) => voice.voiceURI === voicePreference) ||
      voices.find((voice) => /^en[-_]/i.test(voice.lang)) ||
      voices[0] ||
      null;

    const utterance = new SpeechSynthesisUtterance(word);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 0.85 * (speed || 1.0);
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (speechToken === currentToken) {
        resolve();
      }
    };
    utterance.onerror = () => {
      if (speechToken === currentToken) {
        reject(new Error('SpeechSynthesis error'));
      }
    };

    synthesis.speak(utterance);
  });
}

/**
 * 播放单词发音 —— 主入口
 * 支持在线多引擎与浏览器本地语音
 */
export async function playWordAudio(
  word: string,
  options?: { engine?: SpeechEngineMode; strictEngine?: boolean; speed?: number },
): Promise<void> {
  const speechText = normalizeSpeechText(word);
  if (!speechText) return;

  const engine = options?.engine || getSpeechEnginePreference();
  const strictEngine = Boolean(options?.strictEngine);
  const speed = options?.speed || 1.0;
  // 令牌：标志本次播放；stopAudio 或再次播放会使旧令牌过期
  const token = ++activeTtsToken;

  if (strictEngine) {
    if (engine === 'browser') {
      await playWithSpeechSynthesis(speechText, speed);
      return;
    }
    if (engine === 'youdao' || engine === 'baidu' || engine === 'bing') {
      await playWithEngineRemote(engine, speechText, speed, token);
      return;
    }
  }

  if (engine === 'youdao') {
    await playWithRemoteFallback(['youdao', 'baidu', 'bing'], speechText, speed, token);
    return;
  }
  if (engine === 'baidu') {
    await playWithRemoteFallback(['baidu', 'youdao', 'bing'], speechText, speed, token);
    return;
  }
  if (engine === 'bing') {
    await playWithRemoteFallback(['bing', 'youdao', 'baidu'], speechText, speed, token);
    return;
  }
  if (engine === 'browser') {
    await playWithSpeechSynthesis(speechText, speed);
    return;
  }

  await playWithRemoteFallback(['youdao', 'baidu', 'bing'], speechText, speed, token);
}

/**
 * 停止当前播放
 */
export function stopAudio(): void {
  activeTtsToken += 1; // 使仍在网络请求阶段的旧 TTS 失效
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (effectAudio) {
    effectAudio.pause();
    effectAudio = null;
  }
  const synthesis = getSpeechSynthesisSafe();
  if (synthesis) {
    speechToken += 1;
    synthesis.cancel();
  }
}

export async function playResultEffect(type: ResultEffectType, options?: { volume?: number }): Promise<void> {
  if (typeof window === 'undefined') return;
  const src = RESULT_EFFECT_URLS[type];
  if (!src) return;
  try {
    if (effectAudio) {
      effectAudio.pause();
      effectAudio = null;
    }
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = Math.max(0, Math.min(1, Number(options?.volume ?? 0.88)));
    audio.currentTime = 0;
    effectAudio = audio;
    await audio.play();
  } catch {
    // ignore effect playback errors
  }
}
