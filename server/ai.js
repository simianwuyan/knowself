// 薄封装：读取服务端设置，委托给前后端共享的 ai-client
import { getSettings } from "./store.js";
import {
  generateTreeAI,
  generatePaperPlanAI,
  expandNodeAI,
  recommendResourcesAI,
  testConnectionAI,
  analyzePaperAI,
  compareNodesAI,
  generateStudyCardAI,
} from "../shared/ai-client.ts";

function current() {
  const s = getSettings();
  return {
    settings: { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model },
    useMock: s.useMock,
  };
}

/** 带论文元数据时走论文精读计划 prompt，否则按科研方向生成 */
export function generateTree(params) {
  const { settings, useMock } = current();
  if (params.paper) {
    return generatePaperPlanAI(settings, useMock, {
      meta: params.paper,
      direction: params.direction,
      background: params.background,
      goal: params.goal,
    });
  }
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

export function analyzePaper(input) {
  const { settings, useMock } = current();
  return analyzePaperAI(settings, useMock, input);
}

export function compareNodes(nodes) {
  const { settings, useMock } = current();
  return compareNodesAI(settings, useMock, nodes);
}

export function generateStudyCard(node, project) {
  const { settings, useMock } = current();
  return generateStudyCardAI(settings, useMock, node, project);
}
