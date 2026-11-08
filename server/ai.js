// 薄封装：读取服务端设置，委托给前后端共享的 ai-client
import { getSettings } from "./store.js";
import {
  generateTreeAI,
  expandNodeAI,
  recommendResourcesAI,
  testConnectionAI,
} from "../shared/ai-client.ts";

function current() {
  const s = getSettings();
  return {
    settings: { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model },
    useMock: s.useMock,
  };
}

export function generateTree(params) {
  const { settings, useMock } = current();
  return generateTreeAI(settings, useMock, params);
}

export function expandNode(node, project) {
  const { settings, useMock } = current();
  return expandNodeAI(settings, useMock, node, project);
}

export function recommendResources(node, project) {
  const { settings, useMock } = current();
  return recommendResourcesAI(settings, useMock, node, project);
}

export function testConnection(overrides = {}) {
  const { settings, useMock } = current();
  return testConnectionAI(settings, useMock, overrides);
}
