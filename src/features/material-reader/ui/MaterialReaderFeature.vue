<template>
  <main class="material-reader-page">
    <header class="material-reader-intro">
      <div>
        <p class="material-reader-eyebrow">本地学习成果</p>
        <h1>材料阅读</h1>
        <p class="material-reader-description">
          浏览由 learn-from-materials 生成的互动学习页面和 Markdown。本功能只读取并展示成果，不会分析原始材料或调用 Copilot。
        </p>
      </div>
      <div class="material-reader-actions">
        <button
          class="material-reader-button material-reader-button-primary"
          type="button"
          :disabled="isBusy || !canChooseDirectory"
          @click="chooseBookshelf"
        >
          {{ bookshelfHandle ? '更换成果文件夹' : '选择成果文件夹' }}
        </button>
        <button
          v-if="hasStoredHandle && permissionState !== 'granted'"
          class="material-reader-button"
          type="button"
          :disabled="isBusy"
          @click="authorizeStoredDirectory"
        >
          重新授权读取
        </button>
        <button
          v-if="bookshelfHandle && permissionState === 'granted'"
          class="material-reader-button"
          type="button"
          :disabled="isBusy"
          @click="refreshBookshelf"
        >
          重新扫描
        </button>
      </div>
    </header>

    <section class="material-reader-guidance" aria-label="功能说明">
      <strong>如何使用</strong>
      <p>
        先用 learn-from-materials 生成学习成果，并将每份材料的交付文件放入 bookshelf 的独立子文件夹。
        首次点击“选择成果文件夹”，在系统窗口中选择存放这些成果的文件夹并授权读取。
        浏览器会记住目录句柄；之后打开本页时会尝试自动扫描，若权限失效，请点击“重新授权读取”。
      </p>
      <p class="material-reader-security-note">
        互动页面在受限预览框架中打开，无法读取主应用数据，外部网络资源与接口请求默认受限；
        页面内笔记等依赖浏览器本地存储的功能可能无法保存。本页不会修改你的成果文件。
      </p>
    </section>

    <p v-if="statusMessage" class="material-reader-status" role="status">
      {{ statusMessage }}
    </p>
    <p v-if="errorMessage" class="material-reader-error" role="alert">
      {{ errorMessage }}
    </p>

    <section
      class="material-reader-workspace"
      :class="{
        'is-preview-expanded': isPreviewExpanded,
        'is-preview-fullscreen': isPreviewFullscreen,
      }"
      aria-label="学习成果浏览器"
    >
      <aside class="material-reader-library">
        <div class="material-reader-library-heading">
          <h2>材料成果</h2>
          <span v-if="bookshelfHandle">{{ bookshelfHandle.name }}</span>
        </div>

        <div v-if="!bookshelfHandle" class="material-reader-empty">
          选择 bookshelf 文件夹后，这里会列出每份材料的成果。
        </div>
        <div v-else-if="permissionState !== 'granted'" class="material-reader-empty">
          授权后即可读取已保存的成果文件夹。
        </div>
        <div v-else-if="results.length === 0" class="material-reader-empty">
          bookshelf 中还没有材料子文件夹。
        </div>

        <div v-else class="material-reader-result-list">
          <article
            v-for="result in results"
            :key="result.name"
            class="material-reader-result"
            :class="{ 'is-selected': selectedResult?.name === result.name }"
          >
            <button
              class="material-reader-result-title"
              type="button"
              :aria-expanded="selectedResult?.name === result.name"
              @click="selectResult(result)"
            >
              <span>{{ result.name }}</span>
              <span class="material-reader-count">{{ result.files.length }}</span>
            </button>
            <div v-if="selectedResult?.name === result.name" class="material-reader-file-list">
              <button
                v-for="file in result.files"
                :key="file.name"
                class="material-reader-file"
                :class="{ 'is-selected': selectedFile?.name === file.name }"
                type="button"
                @click="openMaterialFile(result, file)"
              >
                <span aria-hidden="true">{{ file.type === 'html' ? '↗' : '¶' }}</span>
                <span>{{ file.name }}</span>
              </button>
              <p v-if="result.files.length === 0" class="material-reader-no-files">
                此文件夹中没有可预览的 HTML 或 Markdown 文件。
              </p>
            </div>
          </article>
        </div>
      </aside>

      <section ref="previewPanel" class="material-reader-preview" aria-label="成果预览">
        <div class="material-reader-preview-heading">
          <h2>{{ selectedFile?.name || '选择一份成果开始阅读' }}</h2>
          <span v-if="selectedResult">{{ selectedResult.name }}</span>
          <div class="material-reader-preview-actions">
            <button
              class="material-reader-view-button"
              type="button"
              :disabled="!previewDocument"
              :aria-pressed="isPreviewExpanded"
              @click="togglePreviewExpanded"
            >
              {{ isPreviewExpanded ? '退出放大' : '放大到导航栏下' }}
            </button>
            <button
              class="material-reader-view-button"
              type="button"
              :disabled="!previewDocument || !canUseFullscreen"
              :aria-pressed="isPreviewFullscreen"
              @click="togglePreviewFullscreen"
            >
              {{ isPreviewFullscreen ? '退出全屏' : '全屏阅读' }}
            </button>
          </div>
        </div>
        <div v-if="!previewDocument && !isReading" class="material-reader-preview-empty">
          <p>从左侧选择 HTML 互动学习页或 Markdown 文档。</p>
          <p>建议将生成交付中的独立 HTML 和 Markdown 放在对应材料文件夹根目录。</p>
        </div>
        <div v-else-if="isReading" class="material-reader-preview-empty" role="status">
          正在读取成果…
        </div>
        <div v-else class="material-reader-frame-container">
          <iframe
            class="material-reader-frame"
            title="材料学习成果预览"
            :srcdoc="previewDocument"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
          />
        </div>
      </section>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import './material-reader.css';
import {
  getDirectoryPermission,
  listBookshelfResults,
  readBookshelfHandle,
  readMaterialFile,
  saveBookshelfHandle,
} from '../services/material-reader-storage';
import { renderMaterialPreview } from '../services/material-reader-preview';

const bookshelfHandle = shallowRef(null);
const results = ref([]);
const selectedResult = shallowRef(null);
const selectedFile = shallowRef(null);
const previewDocument = ref('');
const previewPanel = ref(null);
const isPreviewExpanded = ref(false);
const isPreviewFullscreen = ref(false);
const permissionState = ref('unknown');
const hasStoredHandle = ref(false);
const isBusy = ref(false);
const isReading = ref(false);
const statusMessage = ref('');
const errorMessage = ref('');
const canChooseDirectory = computed(() => typeof window.showDirectoryPicker === 'function');
const canUseFullscreen = computed(() => Boolean(previewPanel.value?.requestFullscreen));

function syncPreviewFullscreenState() {
  isPreviewFullscreen.value = document.fullscreenElement === previewPanel.value;
}

async function togglePreviewFullscreen() {
  const panel = previewPanel.value;
  if (!panel) return;
  try {
    if (document.fullscreenElement === panel) {
      await document.exitFullscreen();
    } else {
      await panel.requestFullscreen();
    }
  } catch (error) {
    reportError('切换阅读全屏失败', error);
  }
}

function togglePreviewExpanded() {
  isPreviewExpanded.value = !isPreviewExpanded.value;
  if (isPreviewExpanded.value) {
    window.requestAnimationFrame(() => {
      previewPanel.value?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
}

function reportError(message, error) {
  console.error(message, error);
  errorMessage.value = `${message}${error?.message ? `：${error.message}` : ''}`;
  statusMessage.value = '';
}

async function scanCurrentBookshelf() {
  if (!bookshelfHandle.value) return;
  isBusy.value = true;
  errorMessage.value = '';
  try {
    results.value = await listBookshelfResults(bookshelfHandle.value);
    const previousName = selectedResult.value?.name;
    const nextResult = results.value.find((result) => result.name === previousName)
      || results.value[0]
      || null;
    selectedResult.value = nextResult;
    if (nextResult) {
      const currentFile = nextResult.files.find((file) => file.name === selectedFile.value?.name);
      const nextFile = currentFile || nextResult.files[0] || null;
      if (nextFile) {
        await openMaterialFile(nextResult, nextFile);
      } else {
        selectedFile.value = null;
        previewDocument.value = '';
      }
    } else {
      selectedFile.value = null;
      previewDocument.value = '';
    }
    statusMessage.value = `已扫描 ${results.value.length} 份材料成果。`;
  } catch (error) {
    reportError('扫描成果文件夹失败', error);
  } finally {
    isBusy.value = false;
  }
}

async function restoreBookshelf() {
  try {
    const savedHandle = await readBookshelfHandle();
    if (!savedHandle) return;
    bookshelfHandle.value = savedHandle;
    hasStoredHandle.value = true;
    permissionState.value = await getDirectoryPermission(savedHandle);
    if (permissionState.value === 'granted') {
      await scanCurrentBookshelf();
    } else {
      statusMessage.value = '已找到上次选择的 bookshelf；请重新授权后扫描成果。';
    }
  } catch (error) {
    reportError('恢复已保存的成果文件夹失败', error);
  }
}

async function chooseBookshelf() {
  if (!canChooseDirectory.value) {
    errorMessage.value = '当前浏览器不支持目录选择。请使用最新版 Chrome 或 Edge，并通过 localhost 或 HTTPS 打开本应用。';
    return;
  }

  isBusy.value = true;
  errorMessage.value = '';
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    bookshelfHandle.value = handle;
    await saveBookshelfHandle(handle);
    hasStoredHandle.value = true;
    permissionState.value = await getDirectoryPermission(handle);
    if (permissionState.value === 'granted') {
      await scanCurrentBookshelf();
    } else {
      statusMessage.value = '目录已保存；请点击“重新授权读取”后扫描。';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
    reportError('选择或保存成果文件夹失败', error);
  } finally {
    isBusy.value = false;
  }
}

async function authorizeStoredDirectory() {
  if (!bookshelfHandle.value) return;
  isBusy.value = true;
  errorMessage.value = '';
  try {
    permissionState.value = await getDirectoryPermission(bookshelfHandle.value, true);
    if (permissionState.value !== 'granted') {
      statusMessage.value = '尚未获得读取权限；请允许浏览器访问该文件夹后重试。';
      return;
    }
    await scanCurrentBookshelf();
  } catch (error) {
    reportError('重新授权成果文件夹失败', error);
  } finally {
    isBusy.value = false;
  }
}

async function refreshBookshelf() {
  await scanCurrentBookshelf();
}

function selectResult(result) {
  selectedResult.value = result;
  selectedFile.value = null;
  previewDocument.value = '';
  if (result.files[0]) {
    void openMaterialFile(result, result.files[0]);
  }
}

async function openMaterialFile(result, file) {
  selectedResult.value = result;
  selectedFile.value = file;
  isReading.value = true;
  previewDocument.value = '';
  errorMessage.value = '';
  try {
    const material = await readMaterialFile(file.handle);
    previewDocument.value = renderMaterialPreview(material.content, file.type);
  } catch (error) {
    reportError(`读取“${file.name}”失败`, error);
  } finally {
    isReading.value = false;
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncPreviewFullscreenState);
  if (!canChooseDirectory.value) {
    statusMessage.value = '目录读取需要支持 File System Access API 的最新版 Chrome 或 Edge。';
  }
  void restoreBookshelf();
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncPreviewFullscreenState);
});
</script>
