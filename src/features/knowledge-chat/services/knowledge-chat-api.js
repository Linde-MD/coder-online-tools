function pickTextFromObject(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;

  const candidates = [
    item.answer,
    item.content,
    item.text,
    item.chunk,
    item.snippet,
    item.document,
    item.page_content,
    item?.segment?.content,
    item?.metadata?.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function collectRecordTexts(data) {
  const buckets = [
    data?.records,
    data?.data,
    data?.data?.records,
    data?.data?.results,
    data?.result,
    data?.result?.records,
    data?.result?.results,
    data?.results,
    data?.documents,
    data?.hits,
  ];

  const list = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      list.push(...bucket);
      continue;
    }

    if (bucket && typeof bucket === 'object') {
      const maybeArrayValues = Object.values(bucket).filter((value) => Array.isArray(value));
      for (const arrayValue of maybeArrayValues) {
        list.push(...arrayValue);
      }
    }
  }

  const texts = list
    .map((item) => pickTextFromObject(item))
    .filter((item) => typeof item === 'string' && item.trim());

  return Array.from(new Set(texts));
}

function normalizeKnowledgeResponse(data) {
  const directAnswerCandidates = [
    data?.answer,
    data?.message,
    data?.data?.answer,
    data?.result?.answer,
    data?.output,
    data?.outputs?.text,
  ];

  let answerText = '';
  for (const candidate of directAnswerCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      answerText = candidate.trim();
      break;
    }
  }

  const references = collectRecordTexts(data);
  if (!answerText && references.length > 0) {
    answerText = references.slice(0, 3).join('\n\n');
  }

  if (!answerText) {
    answerText = '接口已返回，但未识别到可展示文本。请检查返回结构或调整检索配置。';
  }

  return {
    answerText,
    references,
    raw: data,
  };
}

async function parseErrorResponse(response) {
  const fallback = `请求失败：HTTP ${response.status}`;
  try {
    const data = await response.json();
    const message = data?.message || data?.error || data?.detail;
    if (typeof message === 'string' && message.trim()) {
      return `${fallback} - ${message.trim()}`;
    }
    return fallback;
  } catch (_) {
    return fallback;
  }
}

function buildRetrievePayload(question, queryPrefix, topK, useQueryPrefix) {
  const safePrefix = String(queryPrefix || '').trim();
  const query = useQueryPrefix && safePrefix ? `${safePrefix}\n\n用户问题：${question}` : question;
  const payload = { query };

  if (Number.isFinite(Number(topK))) {
    payload.top_k = Math.max(1, Math.min(20, Math.floor(Number(topK))));
  }

  return payload;
}

function normalizeAuthorizationHeader(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  // If user inputs only the token, default to Bearer scheme for Dify-compatible APIs.
  if (/^bearer\s+/i.test(text)) {
    return text;
  }

  if (!text.includes(' ')) {
    return `Bearer ${text}`;
  }

  return text;
}

async function retrieveKnowledgeAnswer({ apiUrl, authorization, question, queryPrefix, topK, useQueryPrefix, signal }) {
  const endpoint = String(apiUrl || '').trim();
  const token = normalizeAuthorizationHeader(authorization);
  const ask = String(question || '').trim();

  if (!endpoint) {
    throw new Error('未配置 API URL。');
  }
  if (!token) {
    throw new Error('未配置 Authorization。');
  }
  if (!ask) {
    throw new Error('请输入问题后再发送。');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(buildRetrievePayload(ask, queryPrefix, topK, useQueryPrefix)),
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error('响应不是合法 JSON。请检查 API 返回格式。');
  }

  return normalizeKnowledgeResponse(data);
}

export { retrieveKnowledgeAnswer };
