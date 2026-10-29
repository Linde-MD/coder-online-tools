import { usePropertyTextEditor } from './usePropertyTextEditor.js';
import { parseSignalProperties, serializeSignalProperties } from '../../services/signal-properties-text.js';

export function useSignalTextEditor({ signal, message, ...options }) {
  return usePropertyTextEditor({
    ...options,
    entity: signal,
    label: 'Signal',
    serialize: serializeSignalProperties,
    parse: (text, format) => parseSignalProperties(text, message.value, format),
  });
}