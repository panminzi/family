// Test setup. Provides global stubs that all component tests need.
import { config } from '@vue/test-utils';

// Stub Element Plus components used in pages so tests don't need its real
// runtime (which depends on full DOM features and a lot of CSS).
const stubs = {
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': {
    props: ['label'],
    template: '<div class="el-form-item"><label v-if="label">{{ label }}</label><slot /></div>',
  },
  'el-input': {
    props: ['modelValue', 'placeholder', 'type', 'rows'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  'el-button': {
    props: ['type', 'loading', 'disabled'],
    emits: ['click'],
    template:
      '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  },
  'el-select': {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  'el-option': {
    props: ['label', 'value', 'disabled'],
    template: '<option :value="value" :disabled="disabled">{{ label }}</option>',
  },
};
config.global.stubs = { ...config.global.stubs, ...stubs };
