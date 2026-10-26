<template>
  <main class="learn-git-page" aria-labelledby="learn-git-title">
    <header class="learn-git-intro">
      <div class="learn-git-intro-copy">
        <p class="learn-git-eyebrow">交互式 Git 实验室</p>
        <h1 id="learn-git-title">Git 学习与练习</h1>
        <p>在可视化提交树中练习 Git 命令。无需登录，进度保存在当前浏览器中。</p>
      </div>
      <span class="learn-git-local-badge">
        <span class="learn-git-local-indicator" aria-hidden="true"></span>
        本地运行 · 不会修改本机仓库
      </span>
    </header>

    <div ref="frameShell" class="learn-git-frame-shell">
      <div class="learn-git-frame-toolbar">
        <div class="learn-git-frame-heading">
          <span class="learn-git-terminal-mark" aria-hidden="true">&gt;_</span>
          <span>Git 分支练习</span>
        </div>
        <div class="learn-git-frame-tools">
          <button
            v-if="isSandboxMode"
            class="learn-git-fullscreen-button learn-git-sandbox-button"
            type="button"
            @click="exitSandbox"
          >
            返回关卡
          </button>
          <p v-if="externalNavigationNotice" class="learn-git-notice" role="status">
            {{ externalNavigationNotice }}
          </p>
          <p v-if="fullscreenError" class="learn-git-fullscreen-error" role="alert">
            {{ fullscreenError }}
          </p>
          <button
            class="learn-git-fullscreen-button"
            type="button"
            :aria-label="fullscreenButtonLabel"
            :aria-pressed="isFullscreen"
            :title="fullscreenButtonLabel"
            @click="toggleFullscreen"
          >
            <svg v-if="!isFullscreen" aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M7 3.75H3.75V7M13 3.75h3.25V7M16.25 13v3.25H13M7 16.25H3.75V13" />
            </svg>
            <svg v-else aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M3.75 7h3.5V3.75M16.25 7h-3.5V3.75M13 16.25V13h3.25M7 16.25V13H3.75" />
            </svg>
            <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
          </button>
        </div>
      </div>
      <iframe
        ref="learnGitFrame"
        class="learn-git-frame"
        title="交互式 Git 分支练习器"
        :src="frameUrl"
        loading="eager"
        referrerpolicy="no-referrer"
        @load="attachFrameKeyboardShortcut"
      />
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const basePath = String(import.meta.env.BASE_URL || '/');
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
const appUrl = `${normalizedBasePath}learn-git-branching/index.html?locale=zh_CN`;
const frameUrl = ref(appUrl);
const frameShell = ref(null);
const learnGitFrame = ref(null);
const isFullscreen = ref(false);
const fullscreenError = ref('');
const externalNavigationNotice = ref('');
let frameWindow = null;
let frameDocument = null;
let noticeTimeout = 0;
const isSandboxMode = computed(() => (
  new URL(frameUrl.value, window.location.href).searchParams.has('NODEMO')
));

const fullscreenButtonLabel = computed(() => (
  isFullscreen.value ? '退出全屏（F11 或 Esc）' : '进入全屏（F11）'
));

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === frameShell.value;
  if (isFullscreen.value) {
    fullscreenError.value = '';
  }
}

async function toggleFullscreen() {
  const shell = frameShell.value;
  if (!shell) return;

  fullscreenError.value = '';
  try {
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }
    await shell.requestFullscreen();
  } catch (error) {
    console.error('Failed to toggle Git learning fullscreen mode.', error);
    fullscreenError.value = '无法切换全屏，请检查浏览器权限或按 Esc 退出其他全屏内容。';
  }
}

function handleFullscreenShortcut(event) {
  if (event.defaultPrevented) return;

  if (event.key === 'F11') {
    event.preventDefault();
    void toggleFullscreen();
    return;
  }

  if (
    event.key === 'Escape' &&
    frameShell.value?.ownerDocument.fullscreenElement === frameShell.value
  ) {
    event.preventDefault();
    void toggleFullscreen();
  }
}

function handleExternalFrameNavigation(event) {
  const anchor = event.target?.closest?.('a[href]');
  if (!anchor) return;

  const destination = new URL(anchor.href, frameDocument?.baseURI);
  if (destination.searchParams.has('NODEMO')) {
    const localSandboxUrl = new URL(appUrl, window.location.href);
    const locale = destination.searchParams.get('locale') || 'zh_CN';
    localSandboxUrl.search = `${new URLSearchParams({ locale }).toString()}&NODEMO`;
    frameUrl.value = localSandboxUrl.href;
    externalNavigationNotice.value = '已在本地学习器中打开沙盒模式。';
    event.preventDefault();
    window.clearTimeout(noticeTimeout);
    noticeTimeout = window.setTimeout(() => {
      externalNavigationNotice.value = '';
    }, 5000);
    return;
  }

  if (destination.origin === window.location.origin) return;

  event.preventDefault();
  externalNavigationNotice.value = '外部页面跳转已关闭，学习内容可在此页面继续使用。';
  window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => {
    externalNavigationNotice.value = '';
  }, 5000);
}

function exitSandbox() {
  frameUrl.value = appUrl;
  externalNavigationNotice.value = '已退出沙盒，返回关卡模式。';
  window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => {
    externalNavigationNotice.value = '';
  }, 5000);
}

function attachFrameKeyboardShortcut() {
  if (frameWindow) {
    frameWindow.removeEventListener('keydown', handleFullscreenShortcut);
  }
  frameDocument?.removeEventListener('click', handleExternalFrameNavigation, true);

  frameWindow = learnGitFrame.value?.contentWindow || null;
  frameDocument = learnGitFrame.value?.contentDocument || null;
  frameWindow?.addEventListener('keydown', handleFullscreenShortcut);
  frameDocument?.addEventListener('click', handleExternalFrameNavigation, true);
}

onMounted(() => {
  window.addEventListener('keydown', handleFullscreenShortcut);
  document.addEventListener('fullscreenchange', syncFullscreenState);
  attachFrameKeyboardShortcut();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleFullscreenShortcut);
  document.removeEventListener('fullscreenchange', syncFullscreenState);
  frameWindow?.removeEventListener('keydown', handleFullscreenShortcut);
  frameDocument?.removeEventListener('click', handleExternalFrameNavigation, true);
  window.clearTimeout(noticeTimeout);
});
</script>

<style scoped>
.learn-git-page {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 16px;
  width: 100%;
  max-width: 1680px;
  height: calc(100dvh - 164px);
  min-height: 460px;
  margin: 0 auto;
  padding: 20px clamp(16px, 3vw, 40px) 28px;
}

.learn-git-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface-card);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.learn-git-intro-copy {
  min-width: 0;
}

.learn-git-eyebrow {
  margin: 0 0 6px;
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.learn-git-intro h1 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 400;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.learn-git-intro-copy > p:last-child {
  margin: 8px 0 0;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.5;
}

.learn-git-local-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  border: 1px solid var(--color-hairline);
  border-radius: 9999px;
  background: var(--color-canvas);
  color: var(--color-body);
  font-size: 13px;
  font-weight: 500;
}

.learn-git-local-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent-teal, #5db8a6);
  box-shadow: 0 0 0 3px rgba(93, 184, 166, 0.16);
}

.learn-git-frame-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface-dark);
  box-shadow: 0 12px 30px rgba(53, 41, 29, 0.14);
}

.learn-git-frame-shell:fullscreen {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100vw;
  height: 100vh;
  min-height: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.learn-git-frame-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
  padding: 6px 12px 6px 16px;
  border-bottom: 1px solid var(--color-hairline);
  background: var(--color-surface-soft);
  color: var(--color-ink);
}

.learn-git-frame-heading,
.learn-git-frame-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.learn-git-frame-heading {
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
}

.learn-git-terminal-mark {
  color: var(--color-primary-active);
  font-family: var(--font-code);
  font-size: 14px;
  font-weight: 600;
}

.learn-git-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--color-canvas);
}

.learn-git-notice,
.learn-git-fullscreen-error {
  max-width: 360px;
  margin: 0;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.4;
}

.learn-git-notice {
  border: 1px solid rgba(204, 120, 92, 0.24);
  background: #f5e8de;
  color: #754532;
}

.learn-git-fullscreen-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 7px 10px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-md);
  background: var(--color-canvas);
  color: var(--color-ink);
  font: 600 13px/1 var(--font-body);
  cursor: pointer;
}

.learn-git-fullscreen-button:hover,
.learn-git-fullscreen-button:focus-visible {
  border-color: var(--color-primary);
  background: #fffaf3;
  outline: 2px solid rgba(204, 120, 92, 0.36);
  outline-offset: 2px;
}

.learn-git-sandbox-button {
  border-color: rgba(204, 120, 92, 0.45);
  background: #f5e8de;
  color: #754532;
}

.learn-git-sandbox-button:hover,
.learn-git-sandbox-button:focus-visible {
  border-color: var(--color-primary-active);
  background: #efd8c8;
}

.learn-git-fullscreen-button svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.learn-git-fullscreen-error {
  border: 1px solid rgba(198, 69, 69, 0.4);
  border-radius: var(--radius-md);
  background: #392220;
  color: #ffd1ca;
}

@media (max-width: 768px) {
  .learn-git-page {
    height: calc(100dvh - 176px);
    min-height: 420px;
    padding: 14px 12px 20px;
  }

  .learn-git-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }

  .learn-git-frame-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }

  .learn-git-frame-tools {
    width: 100%;
    justify-content: space-between;
  }

  .learn-git-notice,
  .learn-git-fullscreen-error {
    flex: 1;
  }

  .learn-git-frame-heading {
    display: none;
  }
}
</style>
