/* 由 tools/build-web.mjs 生成，不要手改。来源：miniprogram/ 的共享内核 */
(function (global) {
  const registry = {};
  const cache = {};
  function normalize(dir, spec) {
    if (spec.slice(0, 2) !== './' && spec.slice(0, 3) !== '../') return spec + '.js';
    const base = dir ? dir.split('/') : [];
    for (const piece of spec.split('/')) {
      if (piece === '.' || piece === '') continue;
      if (piece === '..') base.pop();
      else base.push(piece);
    }
    const id = base.join('/');
    return id.endsWith('.js') ? id : id + '.js';
  }
  function dirOf(id) {
    const parts = id.split('/');
    parts.pop();
    return parts.join('/');
  }
  function define(id, factory) {
    registry[id] = factory;
  }
  function makeRequire(dir) {
    return function require(spec) {
      const id = normalize(dir, spec);
      if (!registry[id]) throw new Error('模块没打进包里: ' + id);
      if (!cache[id]) {
        cache[id] = { exports: {} };
        registry[id](makeRequire(dirOf(id)), cache[id], cache[id].exports);
      }
      return cache[id].exports;
    };
  }
  global.DHK = {
    require(spec) {
      return makeRequire('')(spec);
    },
    module(id) {
      return makeRequire('')(id.replace(/\.js$/, ''));
    }
  };

define("data/content.js", function (require, module, exports) {
/**
 * 全部游戏内容：企业文化原文、序章、第一班的值班卡组、第二/三章的 NPC 剧情与判断。
 *
 * 改文案、加事件卡、换阈值都只改这个文件；规则怎么判定在 utils/state.js。
 *
 * 事件卡（shifts[].cards）结构：
 *   tag / from / title / body  卡片抬头与情境
 *   docs[]                     可展开的「材料」，玩家读完再盖章
 *   choices[]                  id + stamp(release|return) + label + trust 增减 +
 *                              marks 价值观印记增减 + result 后果文案 + flag 延迟后果
 *   variant{ when, ... }       命中 flag 时整张替换（让三个月后的后果自己找上门）
 *
 * 注意：产品结构、精度数据与阈值都是简化教学模拟，不是东鸿真实型号的规格、
 * 认证参数或维修指导。
 */
module.exports = {
  company: '浙江东鸿电子股份有限公司',

  // 企业文化：愿景、使命、理念、导向与价值观解释。
  culture: {
    vision: '微型智能电表行业领跑者',
    mission: '让每一度电更智能、更安全、更精准',
    belief: '成就客户可持续增长',
    directions: ['创新驱动、技术为本', '国际认证、全球布局', '行业聚焦、定制化方案'],
    values: [
      { name: '守正', text: '真实记录数据，发现问题及时反馈。' },
      { name: '务实', text: '从客户真实需求出发，解决具体问题。' },
      { name: '创新', text: '面对新需求，探索并验证更好的方案。' },
      { name: '精进', text: '不满足于能用，持续提高技术与质量标准。' }
    ]
  },

  // 序章：三段能源故事，nodes 决定 Canvas 点亮几个节点。
  prologue: [
    {
      tag: '01 / 能源的脉搏',
      title: '电在流动。',
      text: '从光伏屋顶到充电站，从数据中心到智慧工厂，每一度电都连接着真实的生产与生活。',
      nodes: 1
    },
    {
      tag: '02 / 看见每一度电',
      title: '让看不见的流动，\n成为可信的数据。',
      text: '如果没有精准的计量，我们难以知道电来自哪里、去了哪里、使用了多少。智能电表，让能源管理有据可依。',
      nodes: 3
    },
    {
      tag: '03 / 你的探索任务',
      title: '点亮能源网络，\n从技术之芯开始。',
      text: '你将成为东鸿文化探索员：在质量值班里，一批批出厂前的电表由你判断通过或退回重测。每一次判断，都对应一种工作态度。',
      nodes: 6
    }
  ],

  // 四个产品模块，作为第一班里判断「装没装错」的依据。
  modules: [
    {
      id: 'sample',
      code: 'S01',
      name: '采样单元',
      role: '感知电压与电流',
      detail: '把电压、电流的变化转化为可处理的信号。可靠的数据，从可靠的采样开始。',
      slot: '信号入口',
      failure: '这里需要先感知电压与电流。缺少采样，后续计算便没有可信的输入。'
    },
    {
      id: 'meter',
      code: 'M02',
      name: '计量核心',
      role: '计算电能数据',
      detail: '处理采样信号，计算电能数据。技术为本，意味着重视数据背后的计算与验证。',
      slot: '数据计算',
      failure: '这里需要处理采样信号、计算电能。其他模块不能替代计量核心。'
    },
    {
      id: 'comm',
      code: 'C03',
      name: '通讯模块',
      role: '连接能源管理系统',
      detail: '把计量结果传递给能源管理系统，让客户能够分析与管理能源使用。',
      slot: '数据出口',
      failure: '数据已经产生，但还需要通讯模块，把它传递给能源管理系统。'
    },
    {
      id: 'power',
      code: 'P04',
      name: '电源模块',
      role: '提供稳定供电',
      detail: '为内部模块提供稳定的工作电源。稳定、可靠，是持续改善产品的基础。',
      slot: '稳定供电',
      failure: '这里负责为内部模块供电。稳定的电源，是其他模块正常工作的基础。'
    }
  ],

  // 班次：一次值班 = 若干张事件卡，全部盖完章进入文化画像结算。
  shifts: [
    {
      id: 'quality',
      code: 'SHIFT 01',
      title: '质量值班',
      direction: '创新驱动、技术为本',
      brief:
        '你是计量实验室今天的质量值班员。每一批表出厂前，都要由你判断：通过，或者退回重测。规则只有几条，但产线、销售、客户都会来敲门。',
      rules: [
        '阈值 ±0.5%：偏差超出阈值，必须退回重测并留档。',
        '测试记录不完整，一律退回。',
        '手册没有写的情况，以客户现场风险为准，先补测再决定。',
        '任何「先发再说」的安排，都要留下可追溯的记录。'
      ],
      trust: 60,
      cards: [
        {
          id: 'rush',
          tag: '批次 B-2409 · 光伏客户',
          from: '产线检验员 小林',
          title: '今天必须发车',
          body: '这批 200 台等着装车，测试记录我刚拉出来，有一个点不太好看。要不要先发？',
          docs: [
            { label: '测试记录', text: '参考 100 kWh —— A +0.2% ／ B +2.4% ／ C −0.3%' },
            { label: '规则 1', text: '阈值 ±0.5%，超阈值必须退回重测并留档' }
          ],
          choices: [
            {
              id: 'release',
              stamp: 'release',
              label: '通过',
              trust: -20,
              marks: { 务实: 1, 守正: -1 },
              flag: 'shipRisky',
              result: '车开走了，台账干干净净。三个月后，这批表会自己回来找你。'
            },
            {
              id: 'return',
              stamp: 'return',
              label: '退回',
              trust: -6,
              marks: { 精进: 2 },
              flag: 'caughtEarly',
              result: '产线连夜返工，客户多等一天。第二天复测：B +0.2%，合格。'
            }
          ]
        },
        {
          id: 'assembly',
          tag: '售后 · 现场返修',
          from: '服务工程师 周岚',
          title: '读数漂移 3%',
          body: '客户现场这台表读数一直漂。照片我发你了，你帮我看一眼：是不是装配的时候放错了位置？',
          docs: [
            {
              label: '现场照片说明',
              text: '采样单元装在「数据计算」槽位，计量核心装在「信号入口」槽位'
            },
            {
              label: '模块职责',
              text: '采样单元 → 信号入口 ／ 计量核心 → 数据计算 ／ 通讯模块 → 数据出口 ／ 电源模块 → 稳定供电'
            }
          ],
          choices: [
            {
              id: 'refit',
              stamp: 'return',
              label: '退回：返厂重装',
              trust: 8,
              marks: { 守正: 1, 精进: 1 },
              result: '重装后读数回到 +0.1%。你把这张照片加进了新员工培训案例。'
            },
            {
              id: 'observe',
              stamp: 'release',
              label: '通过：先观察',
              trust: -12,
              marks: { 务实: -1 },
              result: '一周后同一客户再次报修，这次连通讯也断了。'
            }
          ]
        },
        {
          id: 'manual',
          tag: '研发 · 工艺疑点',
          from: '工艺工程师 何工',
          title: '手册里没有这一条',
          body: '这批表在 45℃ 以上才有偏差，常温检测全是好的。手册里没有温度这一条，按常规流程是不是就放行了？',
          docs: [
            { label: '环境记录', text: '车间 28℃（合格）／ 客户配电箱 52℃' },
            {
              label: '历史工单',
              text: '去年同型号一起同类投诉，原因写的是「现场环境」，至今未结案'
            },
            { label: '规则 3', text: '手册没有写的情况，以客户现场风险为准，先补测再决定' }
          ],
          choices: [
            {
              id: 'process',
              stamp: 'release',
              label: '通过：按手册走',
              trust: -10,
              marks: { 务实: 1, 守正: -1 },
              flag: 'leftRisk',
              result: '台账挑不出毛病，风险被留给了明年的现场。'
            },
            {
              id: 'extra',
              stamp: 'return',
              label: '退回：补高温工况',
              trust: 6,
              marks: { 精进: 2, 创新: 1 },
              flag: 'hotFixed',
              result: '补测发现温度补偿参数没有启用——去年那起投诉的答案，也是这一条。'
            }
          ]
        },
        {
          id: 'pending',
          tag: '出货 · 30 台不合格品',
          from: '销售 陈默',
          title: '就改成「待定」',
          body: '客户明天验收，仓库里这 30 台标了不合格。改成「待定」先发过去，验收完我们再处理，就这一次。',
          docs: [
            { label: '库存状态', text: '30 台：不合格（偏差 +1.8%，返修未完成）' },
            { label: '规则 4', text: '任何「先发再说」的安排，都要留下可追溯的记录' }
          ],
          choices: [
            {
              id: 'allow',
              stamp: 'release',
              label: '通过：先发货',
              trust: -15,
              marks: { 守正: -2, 务实: 1 },
              flag: 'pendingTrick',
              result: '系统里留下一条「待定」记录：谁都看得见，谁都解释不清。'
            },
            {
              id: 'refuse',
              stamp: 'return',
              label: '退回：并上报',
              trust: -5,
              marks: { 守正: 2, 精进: 1 },
              result: '销售很不高兴。三个月后审计翻账，这一页干干净净。'
            }
          ]
        },
        {
          id: 'callback',
          tag: '客户回访 · 三个月后',
          from: '光伏客户 采购 老周',
          title: '上次被你们拦下的那批',
          body: '复测全部合格，装车没有误期。采购问：你们是怎么测的？想加单，也想把你们的测试方法一起交付。',
          docs: [
            { label: '客户反馈', text: '现场运行稳定，偏差在 ±0.3% 以内' },
            { label: '追加订单', text: '同型号 150 台，要求随货交付验收方法' }
          ],
          variant: {
            when: 'shipRisky',
            tag: '客户投诉 · 批量返修',
            from: '光伏客户 采购 老周',
            title: '三个月前那批表',
            body: '现场批量偏差超过 2%，两条产线停了。这批表出厂时，测试点 B 是 +2.4%。你们打算怎么处理？',
            docs: [
              { label: '现场数据', text: '已测 32 台，偏差 +2.0% ~ +2.6%，其余暂停使用' },
              { label: '出厂记录', text: '测试点 B +2.4%，超出阈值，由你签发通过' }
            ],
            choices: [
              {
                id: 'own',
                stamp: 'return',
                label: '退回：认下并公开复盘',
                trust: -8,
                marks: { 守正: 2, 精进: 1 },
                result: '你们承担了更换费用，把这张记录做成了全员案例。'
              },
              {
                id: 'blame',
                stamp: 'release',
                label: '通过：归因现场环境',
                trust: -18,
                marks: { 守正: -2, 务实: 1 },
                result: '客户不再争辩，但从下一批开始在别家比价。'
              }
            ]
          },
          choices: [
            {
              id: 'standard',
              stamp: 'release',
              label: '通过：把测试方法整理成标准交付',
              trust: 10,
              marks: { 务实: 1, 精进: 2 },
              result: '客户把这份方法写进了自己的验收要求，随后追加了订单。'
            },
            {
              id: 'routine',
              stamp: 'release',
              label: '通过：按常规回复交期',
              trust: 2,
              marks: {},
              result: '订单来了，方法没留下来——下次还得从头解释一遍。'
            }
          ]
        },
        {
          id: 'project',
          tag: '新项目 · 光伏电站',
          from: '方案顾问 陈默',
          title: '要能看双向的电',
          body: '新项目要同时看清用电和回送电网的电量，还要在异常时告警。预算只够加三张能力卡，你选哪三张？',
          docs: [
            {
              label: '能力卡',
              text: '双向计量 ／ 通讯 ／ 异常告警 ／ 数据存储 ／ 报表 ／ 远程升级（六选三）'
            },
            { label: '客户原话', text: '我们不要花哨的功能，就想知道电去哪了、什么时候出的问题。' }
          ],
          choices: [
            {
              id: 'fit',
              stamp: 'release',
              label: '通过：双向计量 + 通讯 + 异常告警',
              trust: 12,
              marks: { 创新: 2, 务实: 2 },
              result: '客户拿到了看得懂的数据，这个方案进了标杆案例。'
            },
            {
              id: 'report',
              stamp: 'release',
              label: '通过：双向计量 + 数据存储 + 报表',
              trust: 4,
              marks: { 务实: 1, 创新: 1 },
              result: '报表很漂亮，但异常发生的时候，没有人被通知。'
            },
            {
              id: 'max',
              stamp: 'release',
              label: '通过：六张全加，先把项目拿下',
              trust: -8,
              marks: { 创新: 1, 务实: -2 },
              result: '预算超了一倍，客户把项目拆成两期，第一期没给你。'
            }
          ]
        }
      ]
    }
  ],

  // 第二章「世界之门」：把三张认证卡配到三个市场（点市场，再点认证卡）。
  certGame: {
    code: 'CHAPTER 02',
    title: '世界之门',
    direction: '国际认证、全球布局',
    npc: { name: '认证专员 周岚', role: '质量与认证', avatar: '周' },
    intro: '产品走向世界，先要经得起不同市场的标准。帮我把三张认证卡配到对应的市场。',
    markets: [
      { id: 'eu', name: '欧盟市场', hint: '计量器具指令 + CE 标志' },
      { id: 'na', name: '北美市场', hint: '安全认证体系，验厂很严' },
      { id: 'au', name: '澳洲市场', hint: '电气合规与注册标识' }
    ],
    certs: [
      { id: 'mid', name: 'MID / CE', note: '欧盟计量与合规' },
      { id: 'ul', name: 'UL / ETL', note: '北美安全认证' },
      { id: 'saa', name: 'SAA / RCM', note: '澳洲合规标识' }
    ],
    // 正确配对：市场 → 认证卡
    answer: { eu: 'mid', na: 'ul', au: 'saa' },
    wrong: '这张卡对应的是另一个市场。再看一眼市场的合规要求。',
    success: '三张卡都放对了。国际认证不是一张标签，而是质量与可靠性的长期承诺。',
    value: '守正 · 精进',
    color: '#4da8d5'
  },

  // 第三章「客户之光」：预算三张卡，从六张能力里挑最贴需求的组合。
  solutionGame: {
    code: 'CHAPTER 03',
    title: '客户之光',
    direction: '行业聚焦、定制化方案',
    npc: { name: '方案顾问 陈默', role: '客户现场', avatar: '陈' },
    brief: '数据中心客户：要看清每一个回路的能耗，异常时要立刻告警。预算只够选三张能力卡。',
    quota: 3,
    cards: [
      { id: 'loops', name: '多回路计量', note: '每个回路单独计量' },
      { id: 'quality', name: '电能质量监测', note: '谐波、电压暂降' },
      { id: 'alarm', name: '异常告警', note: '越限立即通知到人' },
      { id: 'store', name: '本地数据存储', note: '保存 30 天原始数据' },
      { id: 'report', name: '自动报表', note: '按月生成能耗月报' },
      { id: 'ota', name: '远程升级', note: '批量升级固件' }
    ],
    // 必需项：看不见回路与告警，方案就不成立
    required: ['loops', 'alarm'],
    // 满分组：再补上电能质量，才是真正贴住场景的组合
    perfect: ['loops', 'quality', 'alarm'],
    rejected: '客户看完直摇头：回路看不清、异常也没人通知，这个方案解决不了他的问题。',
    accepted: '客户接受了方案：回路与告警都到位，电能质量留到二期再谈。',
    success: '客户非常满意：回路、电能质量、告警一次到位，方案进了标杆案例。',
    value: '务实 · 创新',
    color: '#57b99a'
  },

  // 文化印记的行动承诺选项，也是完成整局的最后一步。
  actions: [
    '先理解需求，再提出并验证新方案。',
    '发现异常，记录、追溯、改进并复测。',
    '把每一次改进沉淀为团队可复用的经验。'
  ],

  // 打卡答题：每个展区一题，答对才算完成该展区（参考线上博物馆的「完成浏览·打卡答题」）。
  quests: [
    {
      id: 'culture',
      icon: '📜',
      name: '文化坐标',
      value: '务实',
      hint: '愿景、使命、理念与导向',
      intro:
        '愿景：微型智能电表行业领跑者。\n使命：让每一度电更智能、更安全、更精准。\n理念：成就客户可持续增长。\n发展导向：创新驱动技术为本 / 国际认证全球布局 / 行业聚焦定制化方案。',
      badge: '📜 文化坐标关卡',
      title: '四个名字，各有位置',
      question: '「成就客户可持续增长」在东鸿文化里属于哪一项？',
      options: ['愿景', '使命', '理念', '发展导向'],
      answer: 2,
      explain:
        '愿景是「微型智能电表行业领跑者」，使命是「让每一度电更智能、更安全、更精准」，「成就客户可持续增长」是经营理念，发展导向是「创新驱动、技术为本」等三条。'
    },
    {
      id: 'modules',
      icon: '⚡',
      name: '产品模块',
      value: '精进 · 创新',
      hint: '四块模块各司其职',
      intro:
        '采样单元 → 信号入口：感知电压与电流。\n计量核心 → 数据计算：处理采样信号、算出电能。\n通讯模块 → 数据出口：把数据交给能源管理系统。\n电源模块 → 稳定供电：给内部模块稳定电源。',
      badge: '⚡ 产品模块关卡',
      title: '链路不能接错',
      question: '现场读数漂移 3%，照片显示采样单元装在了「数据计算」槽位。最可能的原因是？',
      options: ['客户现场干扰太大', '模块装错了位置', '检验阈值设置过松', '通讯协议不匹配'],
      answer: 1,
      explain:
        '采样单元负责感知电压与电流（信号入口），计量核心才负责计算电能（数据计算）。装错槽位会让数据从源头就不对。'
    },
    {
      id: 'values',
      icon: '💎',
      name: '价值观',
      value: '守正',
      hint: '守正、务实、创新、精进',
      intro:
        '守正：真实记录数据，发现问题及时反馈。\n务实：从客户真实需求出发，解决具体问题。\n创新：面对新需求，探索并验证更好的方案。\n精进：不满足于能用，持续提高技术与质量标准。',
      badge: '💎 价值观关卡',
      title: '哪一种行为更贴「守正」？',
      question: '四个价值观中，「守正」最贴近下面哪种行为？',
      options: [
        '为了赶交期，把不合格标成「待定」先发货',
        '真实记录数据，发现问题及时反馈',
        '面对新需求，先提出方案再验证',
        '不满足于能用，持续提高质量标准'
      ],
      answer: 1,
      explain:
        '「真实记录数据，发现问题及时反馈」是守正；第三项对应创新，第四项对应精进，第一项是守正的反例。'
    },
    {
      id: 'world',
      icon: '🌍',
      name: '走向世界',
      value: '精进 · 务实',
      hint: '国际认证与全球布局',
      intro:
        '欧盟看 MID / CE，北美看 UL / ETL，澳洲看 SAA / RCM。\n认证不是一张标签，而是质量、规范与可靠性的长期承诺；不同市场要先看清它的合规要求。',
      badge: '🌍 走向世界关卡',
      title: '认证不是一张标签',
      question: '教学情境下，产品进入欧盟市场最需要准备哪组认证？',
      options: ['UL / ETL', 'SAA / 其他地区标识', 'MID / CE', '只需企业自测报告'],
      answer: 2,
      explain:
        '欧盟市场的计量与合规常用 MID / CE；UL / ETL 主要面向北美，SAA 面向澳洲。认证背后是质量与可靠性的长期承诺。'
    }
  ],

  // 翻牌记忆：八对，左边是名字，右边是它的职责或解释。
  memory: [
    { pair: 1, emoji: '📶', face: '采样单元' },
    { pair: 1, emoji: '🌡️', face: '感知电压与电流' },
    { pair: 2, emoji: '🧮', face: '计量核心' },
    { pair: 2, emoji: '➗', face: '计算电能数据' },
    { pair: 3, emoji: '📡', face: '通讯模块' },
    { pair: 3, emoji: '🔗', face: '连接能源管理系统' },
    { pair: 4, emoji: '🔋', face: '电源模块' },
    { pair: 4, emoji: '⚡', face: '提供稳定供电' },
    { pair: 5, emoji: '📏', face: '守正' },
    { pair: 5, emoji: '📝', face: '真实记录数据' },
    { pair: 6, emoji: '🎯', face: '务实' },
    { pair: 6, emoji: '🤝', face: '从客户真实需求出发' },
    { pair: 7, emoji: '💡', face: '创新' },
    { pair: 7, emoji: '🧪', face: '探索并验证新方案' },
    { pair: 8, emoji: '📈', face: '精进' },
    { pair: 8, emoji: '🏅', face: '持续提高质量标准' }
  ],

  // 跳格子闯关：答对往前跳一格，答错退回一格，走到终点算通关。
  hopGame: {
    code: 'CULTURE HOP',
    title: '文化跳格子',
    intro: '一格一个知识点。答对往前跳一格，答错退回一格——企业文化不是背下来，是一步步走过去。',
    start: '起点 · 实验室门口',
    finish: '终点 · 点亮每一度电',
    forward: '答对了，往前跳一格！',
    wrong: '答错了，停在原地。看清这一格的知识点再选一次。',
    tiles: [
      {
        id: 'mission',
        name: '我们的使命',
        point: '让每一度电更智能、更安全、更精准。',
        question: '东鸿的使命是哪一句？',
        options: [
          '微型智能电表行业领跑者',
          '让每一度电更智能、更安全、更精准',
          '成就客户可持续增长',
          '创新驱动、技术为本'
        ],
        answer: 1,
        explain: '第二项是使命；第一项是愿景，第三项是理念，第四项是发展导向。'
      },
      {
        id: 'value-of-meter',
        name: '计量的价值',
        point: '没有精准的计量，就说不清电从哪里来、去了哪里、用了多少。',
        question: '为什么智能电表对企业客户重要？',
        options: [
          '让电费更便宜',
          '让能源看得见、算得清，管理才有依据',
          '让线路不需要维护',
          '让用电量自动减少'
        ],
        answer: 1,
        explain: '计量把看不见的能源流动变成可信的数据，能源管理才有依据。'
      },
      {
        id: 'sample',
        name: '采样单元',
        point: '采样单元 → 信号入口：感知电压与电流。',
        question: '负责「感知电压与电流」的模块是？',
        options: ['采样单元', '计量核心', '通讯模块', '电源模块'],
        answer: 0,
        explain: '可靠的数据从可靠的采样开始：采样单元在信号入口。'
      },
      {
        id: 'meter',
        name: '计量核心',
        point: '计量核心 → 数据计算：处理采样信号、算出电能数据。',
        question: '处理采样信号、计算电能数据的是哪个模块？',
        options: ['采样单元', '计量核心', '通讯模块', '电源模块'],
        answer: 1,
        explain: '技术为本，意味着重视数据背后的计算与验证。'
      },
      {
        id: 'comm',
        name: '通讯模块',
        point: '通讯模块 → 数据出口：把结果交给能源管理系统。',
        question: '把计量结果送到能源管理系统的模块是？',
        options: ['电源模块', '通讯模块', '计量核心', '采样单元'],
        answer: 1,
        explain: '数据已经产生，但还需要通讯模块把它传递出去。'
      },
      {
        id: 'power',
        name: '电源模块',
        point: '电源模块 → 稳定供电：为内部模块提供稳定电源。',
        question: '为其他模块提供稳定工作电源的是？',
        options: ['电源模块', '通讯模块', '计量核心', '采样单元'],
        answer: 0,
        explain: '稳定、可靠，是持续改善产品的基础。'
      },
      {
        id: 'tolerance',
        name: '教学阈值',
        point: '教学阈值 ±0.5%，超出必须退回重测并留档。',
        question: '测试点偏差 +2.4%，按规定应该怎么处理？',
        options: [
          '在阈值内，可以放行',
          '超出阈值，退回重测并留档',
          '由销售决定是否发货',
          '改成「待定」先发出去'
        ],
        answer: 1,
        explain: '偏差 =（实测 − 参考）÷ 参考 × 100%；超阈值必须退回重测。'
      },
      {
        id: 'zhengshou',
        name: '守正',
        point: '守正：真实记录数据，发现问题及时反馈。',
        question: '下面哪种做法体现「守正」？',
        options: [
          '把不合格标成「待定」先发货',
          '真实记录数据，发现问题及时反馈',
          '只修正显示结果',
          '先交付、后续再观察'
        ],
        answer: 1,
        explain: '守正就是数据不打折：记录真实，问题上报。'
      },
      {
        id: 'wushi',
        name: '务实',
        point: '务实：从客户真实需求出发，解决具体问题。',
        question: '客户说要「更多功能」，务实的做法是？',
        options: [
          '把所有功能都加上',
          '先问清他要解决什么问题，再给合适的方案',
          '按去年的方案复制一份',
          '先报低价拿下订单'
        ],
        answer: 1,
        explain: '功能多不等于有价值，先理解需求再给方案。'
      },
      {
        id: 'chuangxin',
        name: '创新',
        point: '创新：面对新需求，探索并验证更好的方案。',
        question: '光伏客户要看清「用电 + 回送电网」的电量，哪种方案更合适？',
        options: [
          '沿用只统计用电的旧方案',
          '双向计量 + 通讯，并验证数据',
          '先堆叠六个功能再说',
          '让客户自己去算'
        ],
        answer: 1,
        explain: '创新从理解新需求开始，并且要用验证过的技术组合回应它。'
      },
      {
        id: 'jingjin',
        name: '精进',
        point: '精进：不满足于能用，持续提高技术与质量标准。',
        question: '发现异常后，精进的做法是？',
        options: [
          '先交付，后续再观察',
          '只修正显示结果',
          '记录 → 追溯 → 改进 → 复测',
          '先上报，等通知'
        ],
        answer: 2,
        explain: '发现问题不算完成，验证改进才算。'
      },
      {
        id: 'cert',
        name: '走向世界',
        point: '欧盟 MID / CE，北美 UL / ETL，澳洲 SAA / RCM。',
        question: '产品进入欧盟市场，最需要准备哪组认证？',
        options: ['MID / CE', 'UL / ETL', 'SAA / RCM', '只需要自测报告'],
        answer: 0,
        explain: '不同市场看不同的合规要求，认证是长期的质量承诺。'
      }
    ]
  },

  // 能量三消：六种能源节点，三个连线即消除。
  match3: {
    size: 6,
    seconds: 60,
    baseScore: 10,
    tiles: [
      { id: 'pv', name: '光伏', emoji: '☀️', color: '#f0b429' },
      { id: 'charger', name: '充电桩', emoji: '🔌', color: '#4da8d5' },
      { id: 'data', name: '数据中心', emoji: '🖥️', color: '#7a86d1' },
      { id: 'factory', name: '智慧工厂', emoji: '🏭', color: '#57b99a' },
      { id: 'building', name: '楼宇', emoji: '🏢', color: '#38a3a5' },
      { id: 'grid', name: '输配电', emoji: '🗼', color: '#e07a5f' }
    ]
  },

  // 知识答题：十题共 100 分，每题都有解释。
  quizBank: [
    {
      q: '东鸿的愿景是哪一句？',
      opts: [
        '让每一度电更智能、更安全、更精准',
        '微型智能电表行业领跑者',
        '成就客户可持续增长',
        '创新驱动、技术为本'
      ],
      ans: 1,
      explain: '愿景是「微型智能电表行业领跑者」，第一项是使命，第三项是理念。'
    },
    {
      q: '教学情境中，精度测试的阈值是多少？',
      opts: ['±0.1%', '±0.5%', '±2%', '±5%'],
      ans: 1,
      explain: '教学阈值 ±0.5%，超过就必须退回重测并留档（数据为教学示意）。'
    },
    {
      q: '测试点 B 参考 100 kWh、实测 102.4 kWh，它的偏差是多少？',
      opts: ['+0.24%', '+2.4%', '+24%', '−0.3%'],
      ans: 1,
      explain: '偏差 =（实测 − 参考）÷ 参考 × 100% = 2.4 ÷ 100 = +2.4%，超出阈值。'
    },
    {
      q: '四个价值观中，哪一个强调「不满足于能用」？',
      opts: ['守正', '务实', '创新', '精进'],
      ans: 3,
      explain: '精进：不满足于能用，持续提高技术与质量标准。'
    },
    {
      q: '模块与槽位的对应关系，正确的是？',
      opts: [
        '采样单元 → 数据计算',
        '计量核心 → 信号入口',
        '通讯模块 → 数据出口',
        '电源模块 → 数据出口'
      ],
      ans: 2,
      explain: '采样单元→信号入口，计量核心→数据计算，通讯模块→数据出口，电源模块→稳定供电。'
    },
    {
      q: '手册里没有写的情况，值班规则要求怎么处理？',
      opts: ['按惯例放行', '等领导决定', '以客户现场风险为准，先补测再决定', '直接退回'],
      ans: 2,
      explain: '规则第 3 条：手册没有写的情况，以客户现场风险为准，先补测再决定。'
    },
    {
      q: '产品进入欧盟市场，教学情境下最合适的是哪组认证？',
      opts: ['MID / CE', 'UL / ETL', 'SAA', 'FCC'],
      ans: 0,
      explain: 'MID / CE 面向欧盟；UL / ETL 主要面向北美；SAA 面向澳洲。'
    },
    {
      q: '数据中心客户最需要的是哪一组能力？',
      opts: [
        '把所有可选功能全部加入',
        '只提供总用电量',
        '多回路计量 + 电能质量监测 + 异常告警',
        '只做远程升级'
      ],
      ans: 2,
      explain: '行业聚焦、定制化方案：先看清客户的问题，再给真正适合的组合，不堆功能。'
    },
    {
      q: '发现异常之后，正确的顺序是？',
      opts: ['先交付，后续再观察', '只修正显示结果', '记录 → 追溯 → 改进 → 复测', '先上报，等通知'],
      ans: 2,
      explain: '发现问题不算完成，验证改进才算：记录、追溯、改进、复测，每一步都留档。'
    },
    {
      q: '「成就客户可持续增长」提醒我们优先做什么？',
      opts: ['堆更多功能', '理解客户场景后提供适合的方案', '先拿到订单再说', '把交付压力转给产线'],
      ans: 1,
      explain: '先理解场景，再给方案——这也是本作里务实与创新两项印记的共同点。'
    }
  ]
};

});

define("utils/state.js", function (require, module, exports) {
/**
 * 全局状态机：存档结构、清洗与推进规则、任务清单、结算画像与通关评级。
 *
 * 设计要点：存档只记「做过什么」（值班的每次盖章、每个展区的打卡答案、
 * 每个小游戏的成绩与答题记录），信任值、价值观印记、完成状态全部由这些
 * 决定重新算出来（snapshot / tasks）。好处：
 *   1. 改数值平衡、改卡片文案都不需要迁移存档；
 *   2. 残缺或伪造的存档最多停在真正完成过的那一步；
 *   3. 结算页能直接读到玩家自己造成的剧情线与成绩明细。
 */
const content = require('../data/content');

/** 四个价值观，同时是画像的四条轴。 */
const MARKS = content.culture.values.map((v) => v.name);
/** 值班班次：当前只有第一班。 */
const SHIFT = content.shifts[0];
const CARDS = SHIFT.cards;
const TRUST_MIN = 0;
const TRUST_MAX = 100;
const QUIZ_TOTAL = content.quizBank.length;
/** 能安全读取的存档版本：更早的按规则迁移，未知版本一律当新档处理。 */
const KNOWN_VERSIONS = [1, 2, 3, 4, 5];

/** 信任值分档：结局评价与评语。 */
const TRUST_LEVELS = [
  { min: 85, label: '可靠的在岗人', comment: '你把每一次签字都当成了承诺，客户愿意把方法交给你。' },
  { min: 70, label: '称职的值班员', comment: '多数时候，你选了那条不容易但站得住的路。' },
  { min: 55, label: '合格，但留了尾巴', comment: '台账能过，现场还有几件事在等你回头处理。' },
  { min: 0, label: '账面上干净，现场有雷', comment: '你做的每一个「先发再说」，都已经在路上了。' }
];

/** 印记最高项的称号。 */
const MARK_STYLE = {
  守正: { title: '规则守护者', comment: '数据和记录在你这里没有被让步。' },
  务实: { title: '交付推动者', comment: '你盯着客户的真实问题，没有被流程本身绊住。' },
  创新: { title: '场景解法人', comment: '面对新需求，你愿意先理解，再动手。' },
  精进: { title: '持续验证者', comment: '你不太接受「看起来没问题」。' }
};

/** 通关评级：参考线上博物馆的 GRADE S / A / B。 */
const GRADES = [
  {
    code: 'S',
    color: '#e85d26',
    comment: '完美通关！把关严、答题准、手速快，你是东鸿文化探索的超级玩家。',
    test: (s) =>
      s.trust >= 85 &&
      s.games.flip.done &&
      s.games.flip.moves <= 20 &&
      s.games.quiz.score >= 80 &&
      s.games.crush.score >= 300
  },
  {
    code: 'A',
    color: '#0fb8a7',
    comment: '非常棒！全部任务完成，判断稳、节奏好，可以带新同事走一遍了。',
    test: (s) => s.trust >= 70 && s.games.quiz.score >= 60 && s.games.crush.score >= 150
  },
  {
    code: 'B',
    color: '#c49a6c',
    comment: '全部通关！有些判断还可以再想一层，回看值班记录会有收获。',
    test: () => true
  }
];

function emptyCheckins() {
  const checkins = {};
  for (const quest of content.quests) checkins[quest.id] = false;
  return checkins;
}

function initial() {
  const marks = {};
  for (const name of MARKS) marks[name] = 0;
  return {
    version: 5,
    prologue: 0,
    prologueDone: false,
    decisions: [],
    // missions 由两个章节小游戏的完成情况推导，不直接读存档。
    missions: { 2: false, 3: false },
    pledge: '',
    completed: false,
    checkins: emptyCheckins(),
    games: {
      flip: { done: false, moves: 0, seconds: 0 },
      crush: { done: false, score: 0 },
      quiz: { done: false, score: 0, results: [] },
      cert: { matched: [] },
      solution: { done: false, picks: [], perfect: false },
      hop: { done: false, tile: 0, right: 0, wrong: 0 }
    },
    mistakes: 0,
    updatedAt: 0,
    // 下面三项由决定推导，normalize 每次都会重算。
    trust: SHIFT.trust,
    marks,
    flags: {}
  };
}

/** 命中 flag 时整张卡替换：让玩家自己造成的后果自己找上门。 */
function resolveCard(card, flags) {
  const merged = Object.assign({}, card);
  if (card && card.variant && flags && flags[card.variant.when])
    Object.assign(merged, card.variant);
  delete merged.variant;
  return merged;
}

/** 把一条决定套用到数值上。 */
function applyChoice(result, choice) {
  const trust = result.trust + (choice.trust || 0);
  result.trust = Math.max(TRUST_MIN, Math.min(TRUST_MAX, trust));
  for (const [name, delta] of Object.entries(choice.marks || {})) {
    if (MARKS.includes(name)) result.marks[name] += delta;
  }
  if (choice.flag) result.flags[choice.flag] = true;
}

/** 按存档重算信任值、印记与标记；存档里写别的数值没用。 */
function snapshot(s) {
  const result = { trust: SHIFT.trust, marks: {}, flags: {} };
  for (const name of MARKS) result.marks[name] = 0;

  s.decisions.forEach((decision, index) => {
    const card = resolveCard(CARDS[index], result.flags);
    const choice = card && card.choices.find((option) => option.id === decision.choiceId);
    if (choice) applyChoice(result, choice);
  });

  // 打卡答题答对后，按展区标注的价值观各记一分；第二、三章同理。
  for (const quest of content.quests) {
    if (!s.checkins[quest.id] || !quest.value) continue;
    for (const name of String(quest.value).split('·')) {
      const mark = name.trim();
      if (MARKS.includes(mark)) result.marks[mark] += 1;
    }
  }
  const chapters = [
    { done: s.missions['2'], value: content.certGame.value },
    { done: s.missions['3'], value: content.solutionGame.value }
  ];
  for (const chapter of chapters) {
    if (!chapter.done) continue;
    for (const name of String(chapter.value).split('·')) {
      const mark = name.trim();
      if (MARKS.includes(mark)) result.marks[mark] += 1;
    }
  }
  return result;
}

/** 清洗打卡记录：只认题库里的 id。 */
function normalizeCheckins(raw) {
  const checkins = emptyCheckins();
  if (!raw) return checkins;
  for (const quest of content.quests) checkins[quest.id] = raw[quest.id] === true;
  return checkins;
}

/** 清洗小游戏成绩：数值越界一律归零，避免伪造出高分。 */
function normalizeGames(raw, legacyMissions) {
  const games = initial().games;
  const source = raw || {};
  const flip = source.flip || {};
  const crush = source.crush || {};
  const quiz = source.quiz || {};

  const moves = Number.isSafeInteger(flip.moves) ? Math.max(0, Math.min(999, flip.moves)) : 0;
  const seconds = Number.isSafeInteger(flip.seconds)
    ? Math.max(0, Math.min(9999, flip.seconds))
    : 0;
  const flipDone = flip.done === true && moves > 0;
  games.flip = { done: flipDone, moves: flipDone ? moves : 0, seconds: flipDone ? seconds : 0 };

  const score = Number.isSafeInteger(crush.score) ? Math.max(0, Math.min(9999, crush.score)) : 0;
  games.crush = { done: crush.done === true && score > 0, score: crush.done === true ? score : 0 };

  const results = Array.isArray(quiz.results)
    ? quiz.results.slice(0, QUIZ_TOTAL).map((item) => item === true)
    : [];
  const correct = results.filter(Boolean).length;
  games.quiz = {
    done: quiz.done === true && results.length === QUIZ_TOTAL,
    score: Math.round((correct / QUIZ_TOTAL) * 100),
    results
  };

  // 认证配对：只保留真实存在的市场，按题目顺序排列
  const matched = Array.isArray((source.cert || {}).matched) ? source.cert.matched : [];
  const answer = content.certGame.answer;
  games.cert = {
    matched: content.certGame.markets
      .map((market) => market.id)
      .filter((id) => matched.includes(id) && id in answer)
  };

  // 方案组卡：必须凑满预算且包含必需项，否则视为没完成
  const solution = source.solution || {};
  const picks = Array.isArray(solution.picks)
    ? [
        ...new Set(
          solution.picks.filter((id) => content.solutionGame.cards.some((card) => card.id === id))
        )
      ]
    : [];
  const game = content.solutionGame;
  const valid =
    solution.done === true &&
    picks.length === game.quota &&
    game.required.every((id) => picks.includes(id));
  games.solution = {
    done: valid,
    picks: valid ? picks : [],
    perfect: valid && game.perfect.every((id) => picks.includes(id))
  };

  const hop = source.hop || {};
  const hopTotal = content.hopGame.tiles.length;
  const hopTile = Number.isSafeInteger(hop.tile) ? Math.max(0, Math.min(hopTotal, hop.tile)) : 0;
  const count = (value) => (Number.isSafeInteger(value) ? Math.max(0, Math.min(999, value)) : 0);
  games.hop = {
    tile: hopTile,
    right: count(hop.right),
    wrong: count(hop.wrong),
    done: hopTile >= hopTotal
  };

  // 旧存档（v4 及更早）把章节完成状态记在 missions 上：按「已通过」补成完整记录
  if (legacyMissions) {
    if (legacyMissions['2'] === true && games.cert.matched.length === 0) {
      games.cert.matched = content.certGame.markets.map((market) => market.id);
    }
    if (legacyMissions['3'] === true && !games.solution.done) {
      games.solution = { done: true, picks: content.solutionGame.perfect.slice(), perfect: true };
    }
  }
  return games;
}

/**
 * 清洗存档：只保留能对得上内容的数据，遇到对不上的就地截断，
 * 于是旧版本、残缺或被改过的存档最多停在真正完成过的那一步。
 */
function normalize(raw) {
  const s = initial();
  if (!raw || !KNOWN_VERSIONS.includes(raw.version)) return s;

  s.prologue = Number.isInteger(raw.prologue) ? Math.max(0, Math.min(2, raw.prologue)) : 0;
  s.prologueDone = raw.prologueDone === true;
  s.games = normalizeGames(raw.games, raw.missions);
  s.missions['2'] = s.games.cert.matched.length === content.certGame.markets.length;
  s.missions['3'] = s.games.solution.done === true;

  const submitted = Array.isArray(raw.decisions) ? raw.decisions : [];
  const flags = {};
  for (let index = 0; index < Math.min(submitted.length, CARDS.length); index += 1) {
    const decision = submitted[index];
    const card = resolveCard(CARDS[index], flags);
    const choice = decision && card.choices.find((option) => option.id === decision.choiceId);
    if (!choice || decision.cardId !== card.id) break;
    if (choice.flag) flags[choice.flag] = true;
    s.decisions.push({ cardId: card.id, choiceId: choice.id });
  }

  s.checkins = normalizeCheckins(raw.checkins);

  const settled = snapshot(s);
  s.trust = settled.trust;
  s.marks = settled.marks;
  s.flags = settled.flags;
  s.pledge = content.actions.includes(raw.pledge) ? raw.pledge : '';
  s.completed = shiftDone(s) && s.pledge !== '';
  s.mistakes = Number.isSafeInteger(raw.mistakes) ? Math.max(0, raw.mistakes) : 0;
  s.updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0;
  return s;
}

/** 值班是否已经盖完所有卡。 */
function shiftDone(s) {
  return s.decisions.length >= CARDS.length;
}

/** 当前待处理的卡；值班结束后返回 null。 */
function currentCard(s) {
  if (shiftDone(s)) return null;
  return resolveCard(CARDS[s.decisions.length], s.flags || {});
}

/** 处理一次操作；不符合前置条件的操作不会解锁任何进度。 */
function advance(state, event, payload) {
  const s = normalize(state);

  switch (event) {
    case 'prologue':
      s.prologue = Math.min(2, s.prologue + 1);
      break;
    case 'mission':
      if (s.prologue === 2) s.prologueDone = true;
      break;
    case 'choose': {
      const card = currentCard(s);
      if (!s.prologueDone || !card || !payload || payload.cardId !== card.id) break;
      const choice = card.choices.find((option) => option.id === payload.choiceId);
      if (!choice) break;
      s.decisions.push({ cardId: card.id, choiceId: choice.id });
      break;
    }
    case 'checkin': {
      const quest = content.quests.find((item) => item.id === (payload && payload.questId));
      if (!quest) break;
      if (quest.answer !== payload.choice) {
        s.mistakes += 1;
        break;
      }
      s.checkins[quest.id] = true;
      break;
    }
    case 'quizAnswer': {
      const index = payload && payload.index;
      const question = content.quizBank[index];
      if (!question || s.games.quiz.done) break;
      if (s.games.quiz.results.length !== index) break;
      s.games.quiz.results.push(payload.choice === question.ans);
      if (s.games.quiz.results.length === QUIZ_TOTAL) {
        s.games.quiz.done = true;
        s.games.quiz.score = Math.round(
          (s.games.quiz.results.filter(Boolean).length / QUIZ_TOTAL) * 100
        );
      }
      break;
    }
    case 'flipResult': {
      const moves = Number.isSafeInteger(payload && payload.moves) ? payload.moves : 0;
      const seconds = Number.isSafeInteger(payload && payload.seconds) ? payload.seconds : 0;
      if (s.games.flip.done || moves <= 0) break;
      s.games.flip = { done: true, moves: Math.min(999, moves), seconds: Math.min(9999, seconds) };
      break;
    }
    case 'crushResult': {
      const score = Number.isSafeInteger(payload && payload.score) ? payload.score : 0;
      if (score <= 0) break;
      s.games.crush = { done: true, score: Math.min(9999, score) };
      break;
    }
    case 'quizReset':
      s.games.quiz = { done: false, score: 0, results: [] };
      break;
    case 'certMatch': {
      const answer = content.certGame.answer;
      const market = payload && payload.market;
      if (!market || !(market in answer)) break;
      if (s.games.cert.matched.includes(market)) break;
      if (answer[market] !== payload.cert) {
        s.mistakes += 1;
        break;
      }
      s.games.cert.matched.push(market);
      break;
    }
    case 'hopAnswer': {
      const hop = s.games.hop;
      const tile = content.hopGame.tiles[hop.tile];
      const index = payload && payload.index;
      if (hop.done || !tile || index !== hop.tile) break;
      if (payload.choice === tile.answer) {
        s.games.hop = { ...hop, tile: hop.tile + 1, right: hop.right + 1 };
        s.games.hop.done = s.games.hop.tile >= content.hopGame.tiles.length;
      } else {
        // 答错：停在原格，提示错误让玩家重新选（不退格）
        s.mistakes += 1;
        s.games.hop = { ...hop, wrong: hop.wrong + 1 };
      }
      break;
    }
    case 'solution': {
      const game = content.solutionGame;
      const picks = Array.isArray(payload && payload.picks) ? [...new Set(payload.picks)] : [];
      const known = picks.filter((id) => game.cards.some((card) => card.id === id));
      const ok = known.length === game.quota && game.required.every((id) => known.includes(id));
      if (!ok) {
        s.mistakes += 1;
        break;
      }
      s.games.solution = {
        done: true,
        picks: known,
        perfect: game.perfect.every((id) => known.includes(id))
      };
      break;
    }
    case 'complete':
      if (shiftDone(s) && content.actions.includes(payload)) {
        s.pledge = payload;
        s.completed = true;
      }
      break;
    case 'mistake':
      s.mistakes += 1;
      break;
  }
  return normalize(s);
}

/** 主线进度：序章 10、第一班 60（每张卡 10）、二三章各 10、承诺 10。 */
function percent(s) {
  let value = s.prologueDone ? 10 : 0;
  value += (s.decisions.length / CARDS.length) * 60;
  value += (s.missions['2'] ? 10 : 0) + (s.missions['3'] ? 10 : 0);
  if (s.completed) value += 10;
  return Math.round(value);
}

/** 任务清单：主线、打卡与小游戏统一成一张表（供任务轨道与通关结算使用）。 */
function tasks(s) {
  const checkins = content.quests.map((quest) => ({
    id: quest.id,
    icon: quest.icon,
    name: `${quest.name}打卡`,
    done: s.checkins[quest.id] === true,
    page: '/pages/quest/quest'
  }));
  return [
    {
      id: 'prologue',
      icon: '🔑',
      name: '领取使命密钥',
      done: s.prologueDone,
      page: '/pages/prologue/prologue'
    },
    {
      id: 'shift',
      icon: '🕹️',
      name: '质量值班（六份材料）',
      done: shiftDone(s),
      page: '/pages/shift/shift'
    },
    ...checkins,
    {
      id: 'flip',
      icon: '🃏',
      name: '模块配对',
      done: s.games.flip.done,
      page: '/pages/flip/flip'
    },
    {
      id: 'crush',
      icon: '✨',
      name: '能量三消',
      done: s.games.crush.done,
      page: '/pages/crush/crush'
    },
    {
      id: 'quiz',
      icon: '📝',
      name: '知识答题',
      done: s.games.quiz.done,
      page: '/pages/quiz/quiz'
    },
    {
      id: 'hop',
      icon: '🦘',
      name: '文化跳格子',
      done: s.games.hop.done,
      page: '/pages/hop/hop'
    },
    {
      id: 'cert',
      icon: '🌍',
      name: '世界之门 · 认证配对',
      done: s.missions['2'],
      page: '/pages/cert/cert'
    },
    {
      id: 'solution',
      icon: '🎯',
      name: '客户之光 · 方案组卡',
      done: s.missions['3'],
      page: '/pages/solution/solution'
    },
    {
      id: 'pledge',
      icon: '🖋️',
      name: '保存文化画像',
      done: s.completed,
      page: '/pages/culture/culture'
    }
  ];
}

/** 已完成任务数 / 总任务数。 */
function taskProgress(s) {
  const list = tasks(s);
  return { done: list.filter((task) => task.done).length, total: list.length };
}

/** 企业文化模块是否完成：四个展区打卡 + 第一章值班 + 第二、三章互动关卡。 */
function cultureDone(s) {
  return (
    s.checkins &&
    Object.values(s.checkins).every(Boolean) &&
    shiftDone(s) &&
    s.missions['2'] === true &&
    s.missions['3'] === true
  );
}

/** 是否全部通关（任务清单全部完成）。 */
function allDone(s) {
  return tasks(s).every((task) => task.done);
}

/** 通关评级。 */
function grade(s) {
  return GRADES.find((item) => item.test(s)) || GRADES[GRADES.length - 1];
}

/** 通关结算用的成绩明细。 */
function scoreboard(s) {
  return {
    trust: s.trust,
    flip: s.games.flip,
    crush: s.games.crush,
    quiz: {
      score: s.games.quiz.score,
      correct: s.games.quiz.results.filter(Boolean).length,
      total: QUIZ_TOTAL
    },
    cert: { matched: s.games.cert.matched.length, total: content.certGame.markets.length },
    solution: s.games.solution,
    hop: s.games.hop,
    grade: grade(s),
    progress: taskProgress(s),
    tasks: tasks(s)
  };
}

/** 「继续探索」应该去哪一页。 */
function route(s) {
  if (!s.prologueDone) return '/pages/prologue/prologue';
  if (!shiftDone(s)) return '/pages/shift/shift';
  return '/pages/culture/culture';
}

/** 玩家做过的、影响最大的几件事，用于画像页的「你的关键行为」。 */
function highlights(s, limit = 3) {
  const flags = {};
  const seen = [];
  s.decisions.forEach((decision, index) => {
    const card = resolveCard(CARDS[index], flags);
    const choice = card && card.choices.find((option) => option.id === decision.choiceId);
    if (!choice) return;
    if (choice.flag) flags[choice.flag] = true;
    seen.push({
      card: card.title,
      choice: choice.label,
      stamp: choice.stamp,
      trust: choice.trust || 0,
      result: choice.result
    });
  });
  return seen.sort((a, b) => Math.abs(b.trust) - Math.abs(a.trust)).slice(0, limit);
}

/** 结算画像：信任值分档 + 四条印记 + 主印记称号 + 关键行为。 */
function portrait(s) {
  const level = TRUST_LEVELS.find((item) => s.trust >= item.min);
  const ranked = MARKS.map((name) => ({ name, value: s.marks[name] || 0 })).sort(
    (a, b) => b.value - a.value
  );
  const top = ranked[0] && ranked[0].value > 0 ? ranked[0].name : null;
  const style = top
    ? MARK_STYLE[top]
    : { title: '印记未成形', comment: '还没有做出足够多的判断。' };
  return { trust: s.trust, level, ranked, top, style, highlights: highlights(s) };
}

module.exports = {
  initial,
  normalize,
  advance,
  percent,
  route,
  portrait,
  tasks,
  cultureDone,
  taskProgress,
  allDone,
  grade,
  scoreboard,
  currentCard,
  shiftDone,
  resolveCard,
  MARKS,
  CARDS,
  TRUST_LEVELS,
  GRADES,
  QUIZ_TOTAL
};

});

define("utils/match3.js", function (require, module, exports) {
/**
 * 能量三消的纯逻辑：发牌、找三连、下落补牌、判断是否还有可走的一步。
 *
 * 这里不碰页面和 setData，全部是对普通数组的纯函数，
 * 所以「交换后能不能消」「消完怎么落」这些规则可以直接单元测试。
 * 随机数可注入，测试里传入固定序列就能得到确定的棋盘。
 */
const content = require('../data/content');

const TILE_COUNT = content.match3.tiles.length;
const MIN_RUN = 3;

/** 发一张不会立刻凑成三连的牌。 */
function pickTile(board, row, col, tileCount, random) {
  const banned = new Set();
  if (col >= 2 && board[row][col - 1] === board[row][col - 2]) banned.add(board[row][col - 1]);
  if (row >= 2 && board[row - 1][col] === board[row - 2][col]) banned.add(board[row - 1][col]);
  const allowed = [];
  for (let tile = 0; tile < tileCount; tile += 1) {
    if (!banned.has(tile)) allowed.push(tile);
  }
  return allowed[Math.floor(random() * allowed.length)];
}

/** 发一副完整的牌（可能自带三连，由调用方决定是否重发）。 */
function buildBoard(size, tileCount, random) {
  const board = [];
  for (let row = 0; row < size; row += 1) {
    board.push([]);
    for (let col = 0; col < size; col += 1) {
      board[row].push(pickTile(board, row, col, tileCount, random));
    }
  }
  return board;
}

/** 新棋盘：开局没有现成的三连，且至少还有一步可走。 */
function createBoard(size, tileCount = TILE_COUNT, random = Math.random) {
  let board = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    board = buildBoard(size, tileCount, random);
    if (findMatches(board).length === 0 && hasMove(board, tileCount)) return board;
  }
  // 兜底（实测几乎不会发生）：开局三连交给页面自己消掉。
  return board;
}

/** 所有属于三连（横或竖）的格子，按行优先排序。 */
function findMatches(board) {
  const rows = board.length;
  const marked = new Set();

  // 横向扫描
  board.forEach((line, row) => {
    let run = 1;
    for (let col = 1; col <= line.length; col += 1) {
      const same = col < line.length && line[col] != null && line[col] === line[col - 1];
      if (same) {
        run += 1;
        continue;
      }
      if (run >= MIN_RUN) {
        for (let k = col - run; k < col; k += 1) marked.add(`${row}:${k}`);
      }
      run = 1;
    }
  });

  // 纵向扫描（兼容长度不齐的测试用棋盘）
  const width = board.reduce((max, line) => Math.max(max, line.length), 0);
  for (let col = 0; col < width; col += 1) {
    let run = 1;
    for (let row = 1; row <= rows; row += 1) {
      const same = row < rows && board[row][col] != null && board[row][col] === board[row - 1][col];
      if (same) {
        run += 1;
        continue;
      }
      if (run >= MIN_RUN) {
        for (let k = row - run; k < row; k += 1) marked.add(`${k}:${col}`);
      }
      run = 1;
    }
  }

  return [...marked]
    .map((id) => {
      const [row, col] = id.split(':').map(Number);
      return { row, col };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** 交换两个格子，返回新棋盘（不改原数组）。 */
function swapTiles(board, from, to) {
  const next = board.map((line) => line.slice());
  const value = next[from.row][from.col];
  next[from.row][from.col] = next[to.row][to.col];
  next[to.row][to.col] = value;
  return next;
}

/** 两个格子是否上下或左右相邻。 */
function isAdjacent(from, to) {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
}

/** 消掉指定格子，上方牌下落，顶部补新牌。 */
function collapse(board, cleared, random = Math.random, tileCount = TILE_COUNT) {
  const size = board.length;
  const next = board.map((line) => line.slice());
  for (const cell of cleared) next[cell.row][cell.col] = null;

  for (let col = 0; col < size; col += 1) {
    let write = size - 1;
    for (let row = size - 1; row >= 0; row -= 1) {
      if (next[row][col] === null) continue;
      next[write][col] = next[row][col];
      if (write !== row) next[row][col] = null;
      write -= 1;
    }
    for (let row = write; row >= 0; row -= 1) {
      next[row][col] = Math.floor(random() * tileCount);
    }
  }
  return next;
}

/** 还有没有任何一步有效交换。 */
function hasMove(board, tileCount = TILE_COUNT) {
  const size = board.length;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0]
      ]) {
        const to = { row: row + dr, col: col + dc };
        if (to.row >= size || to.col >= size) continue;
        const swapped = swapTiles(board, { row, col }, to);
        if (findMatches(swapped).length > 0) return true;
      }
    }
  }
  return false;
}

/** 一次消除的得分：数量 × 基础分 × 连击倍数。 */
function scoreFor(clearedCount, combo, baseScore = content.match3.baseScore) {
  return clearedCount * baseScore * Math.max(1, combo);
}

/** 摊平成渲染用的二维数据（每格带图块信息，可选标记正在消除的格子）。 */
function decorate(board, clearing = []) {
  const marked = new Set(clearing.map((cell) => cell.row * board.length + cell.col));
  return board.map((line, row) => ({
    key: `row-${row}`,
    cells: line.map((tile, col) => ({
      key: `${row}-${col}`,
      row,
      col,
      tile,
      clearing: marked.has(row * board.length + col),
      ...content.match3.tiles[tile]
    }))
  }));
}

module.exports = {
  TILE_COUNT,
  createBoard,
  findMatches,
  swapTiles,
  isAdjacent,
  collapse,
  hasMove,
  scoreFor,
  decorate
};

});

})(typeof window !== 'undefined' ? window : globalThis);
