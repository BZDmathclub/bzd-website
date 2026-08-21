window.AI_MODELS_RANKING = {
  largeLanguageModels: {
    title: '大语言模型',
    note: '注：该排名参考AI测评网站+BZD数模社部分学生、写手老师匿名打分 综合评分结果',
    categories: [
      {
        name: '论文写作',
        models: ['GPT-4', 'Gemini', 'Claude', 'Grok', '豆包', 'DeepSeek'],
        warning: '⚠️ 警告：国内AI模型很难通过知网AIGC检测，非常建议使用非国产AI进行论文写作'
      },
      {
        name: '模型求解',
        models: ['Claude', 'GPT-4', 'Gemini', 'Grok', 'DeepSeek', '豆包']
      },
      {
        name: '思路构建',
        models: ['GPT-4', 'Claude', 'Gemini', 'DeepSeek', '豆包', 'Grok']
      }
    ]
  },
  aiAgents: {
    title: '智能体排行',
    agents: [
      { name: '扣子数模智能体', votes: [145, 152, 24, 32] },
      { name: 'MathModelAgent', votes: [32, 112, 65, 98] },
      { name: 'Modex', votes: [54, 34, 32, 12] },
      { name: 'Mrite', votes: [94, 157, 32, 24] }
    ],
    levels: ['夯', '顶级', 'NPC', '拉']
  }
};
