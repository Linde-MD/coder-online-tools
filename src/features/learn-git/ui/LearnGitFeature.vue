<template>
  <main class="learn-git-page" aria-labelledby="learn-git-title">
    <header class="learn-git-intro">
      <div class="learn-git-intro-copy">
        <p class="learn-git-eyebrow">LEARN GIT BRANCHING</p>
        <h1 id="learn-git-title">Git 学习与练习</h1>
        <p>在可视化提交树中练习 Git 命令。操作运行在浏览器模拟环境中，不会修改本机仓库。</p>
      </div>
      <a
        class="learn-git-source-link"
        href="https://github.com/pcottle/learnGitBranching"
        target="_blank"
        rel="noopener noreferrer"
      >
        查看开源项目
        <span aria-hidden="true">↗</span>
      </a>
    </header>

    <div ref="frameShell" class="learn-git-frame-shell">
      <iframe
        ref="learnGitFrame"
        class="learn-git-frame"
        title="LearnGitBranching 交互式 Git 学习器"
        :src="appUrl"
        loading="eager"
        referrerpolicy="no-referrer"
        @load="attachFrameKeyboardShortcut"
      />
      <div class="learn-git-frame-tools">
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
        <p v-if="fullscreenError" class="learn-git-fullscreen-error" role="alert">
          {{ fullscreenError }}
        </p>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const basePath = String(import.meta.env.BASE_URL || '/');
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
const appUrl = `${normalizedBasePath}learn-git-branching/index.html?locale=zh_CN`;
const frameShell = ref(null);
const learnGitFrame = ref(null);
const isFullscreen = ref(false);
const fullscreenError = ref('');
let frameWindow = null;

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

function attachFrameKeyboardShortcut() {
  if (frameWindow) {
    frameWindow.removeEventListener('keydown', handleFullscreenShortcut);
  }

  frameWindow = learnGitFrame.value?.contentWindow || null;
  frameWindow?.addEventListener('keydown', handleFullscreenShortcut);
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
});
</script>

<style scoped>
.learn-git-page {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 1680px;
  height: calc(100vh - 82px);
  min-height: 600px;
  margin: 0 auto;
  padding: 16px clamp(12px, 2vw, 28px) 20px;
}

.learn-git-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 20px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background: linear-gradient(180deg, #fffaf3 0%, #f2eadf 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.learn-git-intro-copy {
  min-width: 0;
}

.learn-git-eyebrow {
  margin: 0 0 3px;
  color: var(--color-primary-active);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
}

.learn-git-intro h1 {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 500;
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.learn-git-intro-copy > p:last-child {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
}

.learn-git-source-link {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid rgba(169, 88, 62, 0.34);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.62);
  color: var(--color-primary-active);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.learn-git-source-link:hover,
.learn-git-source-link:focus-visible {
  border-color: rgba(169, 88, 62, 0.56);
  background: rgba(169, 88, 62, 0.1);
}

.learn-git-frame-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-xl);
  background: #fff;
  box-shadow: 0 14px 32px rgba(53, 41, 29, 0.12);
}

.learn-git-frame-shell:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.learn-git-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.learn-git-frame-tools {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity 140ms ease, transform 140ms ease, visibility 140ms ease;
}

.learn-git-frame-shell:hover .learn-git-frame-tools,
.learn-git-frame-shell:focus-within .learn-git-frame-tools {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.learn-git-fullscreen-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid rgba(230, 223, 216, 0.9);
  border-radius: var(--radius-md);
  background: rgba(250, 249, 245, 0.96);
  box-shadow: 0 4px 14px rgba(20, 20, 19, 0.16);
  color: var(--color-ink);
  font: 600 13px/1 var(--font-body);
  cursor: pointer;
}

.learn-git-fullscreen-button:hover,
.learn-git-fullscreen-button:focus-visible {
  border-color: var(--color-primary);
  background: #fff;
  outline: 2px solid rgba(204, 120, 92, 0.3);
  outline-offset: 2px;
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
  max-width: 300px;
  margin: 0;
  padding: 9px 12px;
  border: 1px solid rgba(198, 69, 69, 0.28);
  border-radius: var(--radius-md);
  background: #fff5f3;
  box-shadow: 0 4px 14px rgba(20, 20, 19, 0.12);
  color: #9d3434;
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 768px) {
  .learn-git-page {
    height: calc(100vh - 112px);
    min-height: 620px;
    padding: 12px;
  }

  .learn-git-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
}
</style>
