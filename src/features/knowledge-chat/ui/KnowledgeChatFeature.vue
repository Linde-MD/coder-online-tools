<template>
  <section id="feature-knowledge-chat" class="feature-panel" :class="{ active }">
    <div class="knowledge-chat-panel container-xl">
      <header class="knowledge-chat-header">
        <div>
          <p class="knowledge-chat-kicker">Enterprise Knowledge Assistant</p>
          <h2 class="knowledge-chat-title">知识库问答台</h2>
          <p class="knowledge-chat-note">
            通过你配置的私有检索 API 发起问答，不内置任何固定地址或密钥。
          </p>
        </div>
        <div class="knowledge-chat-header-actions">
          <span class="knowledge-chat-connection" :class="isConfigReady ? 'is-ready' : 'is-missing'">
            {{ isConfigReady ? '已连接' : '未连接' }}
          </span>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="openConfigDialog">
            连接设置
          </button>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm"
            @click="clearMessages"
            :disabled="messages.length === 0"
          >
            清空会话
          </button>
        </div>
      </header>

      <div v-if="!isConfigReady" class="knowledge-chat-onboard">
        <h3>首次使用向导</h3>
        <p>
          请先填写检索 API URL 与 Authorization。建议使用 Bearer Token 形式，例如：
          <span class="knowledge-chat-code">Bearer xxxxxx</span>。
          这些配置仅保存于你的浏览器本地存储。
        </p>
        <button type="button" class="btn btn-primary" @click="openConfigDialog">
          立即配置
        </button>
      </div>

      <div class="knowledge-chat-body" :class="{ 'is-disabled': !isConfigReady }">
        <div class="knowledge-chat-thread" ref="threadRef">
          <article v-for="item in messages" :key="item.id" class="knowledge-bubble" :class="`role-${item.role}`">
            <header class="knowledge-bubble-head">
              <strong>{{ item.role === 'user' ? '你' : '助手' }}</strong>
              <span>{{ item.time }}</span>
            </header>
            <div class="knowledge-bubble-content">{{ item.content }}</div>
            <div v-if="item.role === 'assistant' && item.references?.length" class="knowledge-bubble-ref">
              <details>
                <summary>查看检索片段（{{ item.references.length }}）</summary>
                <ol>
                  <li v-for="(refItem, refIndex) in item.references" :key="`${item.id}-${refIndex}`">
                    {{ refItem }}
                  </li>
                </ol>
              </details>
            </div>
          </article>

          <div v-if="messages.length === 0" class="knowledge-chat-empty">
            <p>输入你的业务问题，例如某协议字段含义、流程规范、故障排查路径等。</p>
          </div>
        </div>

        <div class="knowledge-chat-composer">
          <label class="form-label" for="knowledge-chat-input">提问内容</label>
          <textarea
            id="knowledge-chat-input"
            v-model="draftQuestion"
            class="form-control"
            rows="4"
            maxlength="2000"
            placeholder="请输入你希望检索的问题"
            :disabled="isSending || !isConfigReady"
            @keydown.ctrl.enter.prevent="submitQuestion"
          ></textarea>
          <div class="knowledge-chat-composer-actions">
            <span class="knowledge-chat-hint">Ctrl + Enter 发送</span>
            <button
              type="button"
              class="btn btn-primary"
              @click="submitQuestion"
              :disabled="isSending || !isConfigReady || !draftQuestion.trim()"
            >
              {{ isSending ? '发送中...' : '发送问题' }}
            </button>
          </div>
          <p v-if="runtimeError" class="knowledge-chat-error">{{ runtimeError }}</p>
        </div>
      </div>

      <div class="knowledge-chat-config-modal" :class="{ open: configDialogOpen }" @click.self="closeConfigDialog">
        <div class="knowledge-chat-config-card" role="dialog" aria-modal="true" aria-label="知识库连接设置">
          <div class="knowledge-chat-config-head">
            <div>
              <h3>知识库连接设置</h3>
              <p>保存后将写入浏览器 Local Storage，可随时修改。</p>
            </div>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="closeConfigDialog">关闭</button>
          </div>

          <div class="knowledge-chat-config-grid">
            <label class="knowledge-chat-field">
              <span>HTTP API URL</span>
              <input v-model.trim="draftConfig.apiUrl" class="form-control" placeholder="https://your-domain/v1/datasets/.../retrieve">
            </label>

            <label class="knowledge-chat-field">
              <span>Authorization</span>
              <input
                v-model="draftConfig.authorization"
                class="form-control"
                type="password"
                placeholder="Bearer <token>"
                autocomplete="off"
              >
            </label>

            <label class="knowledge-chat-field">
              <span>查询提示词</span>
              <textarea
                v-model.trim="draftConfig.queryPrefix"
                class="form-control"
                rows="3"
                placeholder="用于补充检索意图的专业提示词"
              ></textarea>
              <label class="form-check-label d-inline-flex align-items-center gap-2 mt-1">
                <input v-model="draftConfig.useQueryPrefix" class="form-check-input" type="checkbox">
                将提示词拼接到检索 query（默认关闭，建议仅在确有需要时开启）
              </label>
            </label>

            <label class="knowledge-chat-field knowledge-chat-field-small">
              <span>返回片段数量 Top K (1-20)</span>
              <input v-model.number="draftConfig.topK" class="form-control" type="number" min="1" max="20">
            </label>
          </div>

          <div class="knowledge-chat-config-foot">
            <div class="knowledge-chat-config-preview">
              <strong>当前令牌掩码：</strong>
              <span>{{ maskedAuth }}</span>
            </div>
            <button type="button" class="btn btn-primary" @click="saveConfig">保存设置</button>
          </div>
          <p v-if="configError" class="knowledge-chat-error">{{ configError }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { retrieveKnowledgeAnswer } from '../services/knowledge-chat-api';
import {
  hasKnowledgeChatConnection,
  maskAuthorization,
  normalizeConfig,
  readKnowledgeChatConfig,
  saveKnowledgeChatConfig,
} from '../services/knowledge-chat-storage';

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const config = ref(readKnowledgeChatConfig());
const draftConfig = ref(normalizeConfig(config.value));
const configDialogOpen = ref(false);
const configError = ref('');

const messages = ref([]);
const draftQuestion = ref('');
const isSending = ref(false);
const runtimeError = ref('');
const threadRef = ref(null);

const isConfigReady = computed(() => hasKnowledgeChatConnection(config.value));
const maskedAuth = computed(() => maskAuthorization(config.value.authorization));

function nowText() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeMessage(role, content, references = []) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role,
    content,
    references,
    time: nowText(),
  };
}

function openConfigDialog() {
  configError.value = '';
  draftConfig.value = normalizeConfig(config.value);
  configDialogOpen.value = true;
}

function closeConfigDialog() {
  configDialogOpen.value = false;
  configError.value = '';
}

function saveConfig() {
  const normalized = normalizeConfig(draftConfig.value);
  if (!normalized.apiUrl) {
    configError.value = '请填写有效的 API URL。';
    return;
  }
  if (!normalized.authorization) {
    configError.value = '请填写 Authorization。';
    return;
  }

  config.value = saveKnowledgeChatConfig(normalized);
  closeConfigDialog();
}

function clearMessages() {
  messages.value = [];
  runtimeError.value = '';
}

async function scrollThreadToBottom() {
  await nextTick();
  const el = threadRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

async function submitQuestion() {
  runtimeError.value = '';
  const question = String(draftQuestion.value || '').trim();

  if (!isConfigReady.value) {
    runtimeError.value = '请先完成连接设置。';
    openConfigDialog();
    return;
  }
  if (!question || isSending.value) {
    return;
  }

  isSending.value = true;
  messages.value.push(makeMessage('user', question));
  draftQuestion.value = '';
  await scrollThreadToBottom();

  try {
    const result = await retrieveKnowledgeAnswer({
      apiUrl: config.value.apiUrl,
      authorization: config.value.authorization,
      question,
      queryPrefix: config.value.queryPrefix,
      useQueryPrefix: config.value.useQueryPrefix,
      topK: config.value.topK,
    });

    messages.value.push(makeMessage('assistant', result.answerText, result.references));
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败，请检查配置和网络。';
    runtimeError.value = message;
    messages.value.push(makeMessage('assistant', `请求失败：${message}`));
  } finally {
    isSending.value = false;
    await scrollThreadToBottom();
  }
}

onMounted(() => {
  if (!isConfigReady.value) {
    openConfigDialog();
  }
});
</script>
