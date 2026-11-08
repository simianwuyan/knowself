// 无 API Key 或开启 useMock 时的演示数据（server 与浏览器本地模式共用）
// 细粒度示例：以「扩散模型图像生成」为例，展示概念/模型/公式/论文/工具粒度
import type {
  CompareResult,
  KnowledgeNode,
  PaperAnalysis,
  PaperMeta,
  TreeParams,
  TreeResult,
} from "./types.ts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type RawNode = Omit<KnowledgeNode, "id" | "mastery" | "resources"> & {
  resources?: KnowledgeNode["resources"];
};

function baseTree(direction: string): TreeResult {
  const dir = direction || "示例研究方向";
  const d = dir.length > 10 ? dir.slice(0, 10) : dir;
  const nodes: RawNode[] = [
    { name: "文献检索与阅读", description: "会用 arXiv/Google Scholar 检索，三遍法读论文", kind: "tool", importance: "core", prereqs: [], estHours: 2,
      resources: [{ title: "如何读论文（三遍法）", type: "tutorial", note: "经典方法" }] },
    { name: "Python 科学计算", description: "NumPy 数组运算与 Matplotlib 画图", kind: "tool", importance: "core", prereqs: [], estHours: 3 },
    { name: "概率论基础", description: "随机变量、期望方差、条件概率", kind: "concept", importance: "core", prereqs: [], estHours: 2 },
    { name: "贝叶斯公式", description: "P(x|y) 与先验/后验的转换，理解生成模型的出发点", kind: "formula", importance: "core", prereqs: ["概率论基础"], estHours: 1 },
    { name: "高斯分布", description: "一维/多维高斯的密度形式与采样", kind: "concept", importance: "core", prereqs: ["概率论基础"], estHours: 1.5 },
    { name: "重参数化技巧", description: "z = μ + σ⊙ε 把随机采样移出梯度路径", kind: "formula", importance: "core", prereqs: ["高斯分布"], estHours: 1 },
    { name: "马尔可夫链", description: "状态转移与平稳分布的概念", kind: "concept", importance: "recommended", prereqs: ["概率论基础"], estHours: 1 },
    { name: "线性代数基础", description: "矩阵乘法、特征值、正定性", kind: "concept", importance: "core", prereqs: [], estHours: 2 },
    { name: "神经网络基础", description: "多层感知机、激活函数、反向传播直觉", kind: "model", importance: "core", prereqs: ["线性代数基础", "Python 科学计算"], estHours: 3 },
    { name: "卷积神经网络 CNN", description: "卷积、池化、通道；U-Net 的积木", kind: "model", importance: "core", prereqs: ["神经网络基础"], estHours: 2.5 },
    { name: "U-Net 结构", description: "编码器-解码器 + 跳跃连接，扩散模型去噪骨干", kind: "model", importance: "core", prereqs: ["卷积神经网络 CNN"], estHours: 2 },
    { name: "KL 散度", description: "分布差异度量，变分推断与扩散损失的基础", kind: "formula", importance: "core", prereqs: ["贝叶斯公式"], estHours: 1 },
    { name: "变分下界 ELBO", description: "log p(x) 的下界分解，理解扩散目标函数的钥匙", kind: "formula", importance: "core", prereqs: ["KL 散度", "重参数化技巧"], estHours: 2 },
    { name: "前向扩散过程", description: "q(xt|xt-1) 逐步加噪至各向同性高斯", kind: "model", importance: "core", prereqs: ["马尔可夫链", "高斯分布"], estHours: 1.5 },
    { name: "噪声调度 βt", description: "线性/余弦调度对生成质量的影响", kind: "concept", importance: "recommended", prereqs: ["前向扩散过程"], estHours: 1 },
    { name: "重参数化采样 q(xt|x0)", description: "xt = √ᾱt·x0 + √(1-ᾱt)·ε 一步到位", kind: "formula", importance: "core", prereqs: ["前向扩散过程", "重参数化技巧"], estHours: 1 },
    { name: "反向去噪过程", description: "pθ(xt-1|xt) 用网络预测噪声逐步还原", kind: "model", importance: "core", prereqs: ["U-Net 结构", "变分下界 ELBO"], estHours: 2 },
    { name: "简化训练目标", description: "L = ‖ε - εθ(xt, t)‖²，DDPM 的实践形式", kind: "formula", importance: "core", prereqs: ["反向去噪过程"], estHours: 1.5 },
    { name: "论文：DDPM (Ho et al. 2020)", description: "去噪扩散概率模型奠基作，确立训练/采样范式", kind: "paper", importance: "core", prereqs: ["简化训练目标", "噪声调度 βt"], estHours: 4,
      resources: [{ title: "Denoising Diffusion Probabilistic Models", type: "paper", note: "NeurIPS 2020" }] },
    { name: "引导采样 Classifier Guidance", description: "用分类器梯度引导生成走向目标类别", kind: "model", importance: "recommended", prereqs: ["论文：DDPM (Ho et al. 2020)"], estHours: 1.5 },
    { name: "论文：DDIM (Song et al. 2021)", description: "非马尔可夫采样，数十步快速生成", kind: "paper", importance: "core", prereqs: ["论文：DDPM (Ho et al. 2020)"], estHours: 3,
      resources: [{ title: "Denoising Diffusion Implicit Models", type: "paper", note: "ICLR 2021" }] },
    { name: "文本条件机制", description: "文本编码如何注入去噪网络（cross-attention）", kind: "concept", importance: "recommended", prereqs: ["论文：DDIM (Song et al. 2021)"], estHours: 1.5 },
    { name: "论文：Latent Diffusion / Stable Diffusion", description: "潜空间扩散，大幅降低算力门槛", kind: "paper", importance: "recommended", prereqs: ["文本条件机制"], estHours: 4 },
    { name: "PyTorch 复现 mini-DDPM", description: "在 MNIST 上实现训练与采样全流程", kind: "tool", importance: "core", prereqs: ["论文：DDPM (Ho et al. 2020)", "神经网络基础"], estHours: 5 },
    { name: "实验记录与消融", description: "固定随机种子、控制变量、记录指标", kind: "tool", importance: "recommended", prereqs: ["PyTorch 复现 mini-DDPM"], estHours: 2 },
    { name: "前沿跟踪：顶会新论文", description: "建立 arXiv 订阅与论文管理流程", kind: "tool", importance: "extension", prereqs: ["文献检索与阅读"], estHours: 1.5 },
  ];
  return {
    title: d,
    summary: `这是「${dir}」方向的演示知识清单（当前为 Mock 模式）。示例展示了本工具的粒度：概念/模型/公式/论文/工具逐点拆分、短学时、按依赖连成图谱；连接真实 AI 后将按你的方向生成同粒度的清单。`,
    nodes: nodes.map((n) => ({
      name: n.name,
      description: n.description,
      kind: n.kind,
      importance: n.importance,
      prereqs: n.prereqs,
      estHours: n.estHours,
      resources: n.resources || [],
    })),
  };
}

export async function mockTree(params: TreeParams): Promise<TreeResult> {
  await sleep(1200);
  return baseTree(params.direction);
}

export async function mockExpand({ node }: { node: KnowledgeNode }): Promise<{ children: Omit<KnowledgeNode, "id" | "mastery">[] }> {
  await sleep(1000);
  const name = node.name || "知识点";
  return {
    children: [
      { name: `${name} · 直觉图景`, description: `用图示建立对${name}的直觉理解`, kind: "concept", importance: "core", prereqs: [...(node.prereqs || [])], estHours: Math.max(0.5, Math.round((node.estHours || 2) * 0.2 * 2) / 2), resources: [] },
      { name: `${name} · 关键定义`, description: `精确记忆${name}的定义与符号`, kind: "formula", importance: "core", prereqs: [`${name} · 直觉图景`], estHours: Math.max(0.5, Math.round((node.estHours || 2) * 0.25 * 2) / 2), resources: [] },
      { name: `${name} · 推导主线`, description: `跟一遍${name}的核心推导，跳过细节`, kind: "formula", importance: "recommended", prereqs: [`${name} · 关键定义`], estHours: Math.max(0.5, Math.round((node.estHours || 2) * 0.3 * 2) / 2), resources: [] },
      { name: `${name} · 数值小例`, description: `手算/代码跑一个最小数值例子验证理解`, kind: "tool", importance: "core", prereqs: [`${name} · 关键定义`], estHours: Math.max(0.5, Math.round((node.estHours || 2) * 0.25 * 2) / 2), resources: [] },
    ],
  };
}

export async function mockResources({ node }: { node: KnowledgeNode }): Promise<{ resources: KnowledgeNode["resources"] }> {
  await sleep(800);
  return {
    resources: [
      { title: `《${node.name || "该主题"}》入门教程（Mock）`, type: "tutorial", note: "Mock 演示数据，连接真实 AI 后可获得真实推荐" },
      { title: `${node.name || "该主题"} 经典教材章节（Mock）`, type: "book", note: "系统学习首选" },
    ],
  };
}

export async function mockTest(): Promise<{ reply: string; ms: number; model?: string }> {
  const started = Date.now();
  await sleep(400);
  return { reply: "Mock 连接正常", ms: Date.now() - started, model: "mock" };
}

export async function mockAnalyzePaper({ meta }: { meta: PaperMeta }): Promise<PaperAnalysis> {
  await sleep(1500);
  const title = meta.title || "Mock 论文";
  const refTitle = meta.refs[0]?.title || "Mock 引文A：领域奠基工作";
  const refTitle2 = meta.refs[1]?.title || "Mock 引文B：方法前置论文";
  return {
    paperNode: {
      name: title,
      description: `（Mock 提取）这篇论文是该方向的关键工作，提出的方法建立在 ${refTitle} 等前作之上。读懂它需要先掌握下列概念、公式与前置论文。`,
      kind: "paper",
      importance: "core",
      prereqs: [],
      estHours: 4,
      resources: [],
    },
    nodes: [
      { name: "论文核心问题", description: "论文要解决的问题定义与动机（Mock 示例节点）", kind: "concept", importance: "core", prereqs: [], estHours: 0.5, resources: [], fromPaper: title },
      { name: "方法总体框架", description: "论文方法的模块划分与数据流（Mock 示例节点）", kind: "model", importance: "core", prereqs: ["论文核心问题"], estHours: 1.5, resources: [], fromPaper: title },
      { name: "论文关键公式", description: "论文中最重要的目标函数/定理及其含义（Mock 示例节点）", kind: "formula", importance: "core", prereqs: ["方法总体框架"], estHours: 1, resources: [], fromPaper: title },
      { name: "实验设计与指标", description: "论文实验怎么验证主张、看哪些指标（Mock 示例节点）", kind: "concept", importance: "recommended", prereqs: ["论文关键公式"], estHours: 1, resources: [], fromPaper: title },
    ],
    keyRefs: [
      { title: refTitle, why: "（Mock）论文方法的直接基础，先读它才能理解改进点" },
      { title: refTitle2, why: "（Mock）前置论文，提供了本论文对比的 baseline" },
    ],
  };
}

export async function mockCompare({ nodes }: { nodes: KnowledgeNode[] }): Promise<CompareResult> {
  await sleep(1200);
  const names = nodes.map((n) => n.name);
  const a = names[0] || "知识点A";
  const b = names[1] || "知识点B";
  return {
    text: `【共同点】（Mock 演示）${a} 与 ${b} 都属于同一知识链条上的内容，服务于同一类研究问题，需要相似的数学与建模基础。

【关键差异】
${a}：侧重「是什么」——建立概念与直觉，是理解后续内容的入口。
${b}：侧重「怎么算」——在概念之上引入可操作的模型/公式，直接对应论文中的方法部分。

【联系与依赖】${b} 的定义建立在 ${a} 之上：先吃透 ${a}，${b} 的推导才不会变成符号堆砌。学习顺序上应先 ${a} 后 ${b}。

【常见混淆点】初学者常把两者的适用条件混为一谈：${a} 的结论在更宽松的条件下成立，而 ${b} 的使用有额外前提，套用前要逐条核对。

【怎么选/怎么学】读论文遇到 ${b} 的推导卡住时，回到 ${a} 补直觉；两者都掌握后，尝试互相推导一遍，检验是否真正理解。

（以上为 Mock 演示数据，连接真实 AI 后将针对你选的知识点生成真实对比）`,
  };
}
