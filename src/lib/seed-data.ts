import type { PrismaClient } from "@prisma/client";

interface SeedCard {
  title: string;
  url: string;
  description: string;
  tags: string[];
  imageSeed: string;
  featured?: boolean;
}

interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  description: string;
  cards: SeedCard[];
}

// Descriptions intentionally mix emoji and CJK: validates utf8mb4 end-to-end
export const seedCategories: SeedCategory[] = [
  {
    slug: "design-tools",
    name: "设计工具",
    icon: "palette",
    description: "界面、配色、字体与图标 🎨",
    cards: [
      {
        title: "Figma",
        url: "https://www.figma.com",
        description: "协作式界面设计工具，实时多人编辑，设计系统与原型一体化。",
        tags: ["UI 设计", "协作"],
        imageSeed: "figma",
        featured: true,
      },
      {
        title: "Penpot",
        url: "https://penpot.app",
        description: "开源的设计与原型平台，自托管友好，格式基于开放标准 SVG。",
        tags: ["开源", "原型"],
        imageSeed: "penpot",
      },
      {
        title: "Coolors",
        url: "https://coolors.co",
        description: "按空格键生成配色方案，支持对比度检查与调色板导出。",
        tags: ["配色"],
        imageSeed: "coolors",
      },
      {
        title: "Google Fonts",
        url: "https://fonts.google.com",
        description: "免费可商用的开源字体库，支持中日韩字形（Noto 家族）。",
        tags: ["字体", "免费"],
        imageSeed: "gfonts",
      },
      {
        title: "Icônes",
        url: "https://icones.js.org",
        description: "聚合 Iconify 全部图标集的检索器，一键复制 SVG / 组件代码。",
        tags: ["图标", "SVG"],
        imageSeed: "icones",
      },
      {
        title: "Dribbble",
        url: "https://dribbble.com",
        description: "设计师作品社区，UI 视觉风格趋势的风向标 ✨",
        tags: ["灵感", "社区"],
        imageSeed: "dribbble",
      },
    ],
  },
  {
    slug: "dev-resources",
    name: "开发资源",
    icon: "code",
    description: "文档、工具与社区 👨‍💻",
    cards: [
      {
        title: "GitHub",
        url: "https://github.com",
        description: "全球最大的代码托管与协作平台，开源世界的入口。",
        tags: ["代码托管", "开源"],
        imageSeed: "github",
        featured: true,
      },
      {
        title: "MDN Web Docs",
        url: "https://developer.mozilla.org",
        description: "Web 开发权威文档：HTML、CSS、JavaScript 与浏览器 API。",
        tags: ["文档", "前端"],
        imageSeed: "mdn",
      },
      {
        title: "Stack Overflow",
        url: "https://stackoverflow.com",
        description: "程序员问答社区，几乎所有报错都能在这里找到线索。",
        tags: ["问答", "社区"],
        imageSeed: "stackoverflow",
      },
      {
        title: "regex101",
        url: "https://regex101.com",
        description: "正则表达式在线调试器，实时解释每一段模式的含义。",
        tags: ["正则", "调试"],
        imageSeed: "regex101",
      },
      {
        title: "Can I use",
        url: "https://caniuse.com",
        description: "查询 Web 特性在各浏览器的兼容性支持情况。",
        tags: ["兼容性", "前端"],
        imageSeed: "caniuse",
      },
      {
        title: "DevDocs",
        url: "https://devdocs.io",
        description: "聚合数百份 API 文档，支持离线访问与键盘快速检索 ⌨️",
        tags: ["文档", "离线"],
        imageSeed: "devdocs",
      },
    ],
  },
  {
    slug: "ai-tools",
    name: "AI 工具",
    icon: "sparkles",
    description: "对话、生成与本地推理 🤖",
    cards: [
      {
        title: "Claude",
        url: "https://claude.ai",
        description: "Anthropic 出品的 AI 助手，长上下文与代码能力见长。",
        tags: ["AI 助手", "编程"],
        imageSeed: "claude",
        featured: true,
      },
      {
        title: "ChatGPT",
        url: "https://chatgpt.com",
        description: "OpenAI 的对话式 AI，生态与插件体系成熟。",
        tags: ["AI 助手"],
        imageSeed: "chatgpt",
      },
      {
        title: "Hugging Face",
        url: "https://huggingface.co",
        description: "开源模型与数据集社区，机器学习界的 GitHub。",
        tags: ["开源", "模型"],
        imageSeed: "huggingface",
      },
      {
        title: "Perplexity",
        url: "https://www.perplexity.ai",
        description: "带引用来源的 AI 搜索引擎，适合做资料调研。",
        tags: ["搜索", "调研"],
        imageSeed: "perplexity",
      },
      {
        title: "Ollama",
        url: "https://ollama.com",
        description: "一条命令在本地跑开源大模型，隐私数据不出机器 🔒",
        tags: ["本地部署", "开源"],
        imageSeed: "ollama",
      },
      {
        title: "Midjourney",
        url: "https://www.midjourney.com",
        description: "文本生成图像的标杆，艺术风格表现力出众。",
        tags: ["图像生成"],
        imageSeed: "midjourney",
      },
    ],
  },
  {
    slug: "learning",
    name: "学习平台",
    icon: "graduation-cap",
    description: "课程、练习与路线图 📚",
    cards: [
      {
        title: "freeCodeCamp",
        url: "https://www.freecodecamp.org",
        description: "完全免费的编程课程与认证，从零基础到全栈。",
        tags: ["免费", "编程"],
        imageSeed: "freecodecamp",
        featured: true,
      },
      {
        title: "roadmap.sh",
        url: "https://roadmap.sh",
        description: "开发者技能路线图：前端、后端、DevOps 一图看清学习路径。",
        tags: ["路线图", "职业"],
        imageSeed: "roadmap",
      },
      {
        title: "Exercism",
        url: "https://exercism.org",
        description: "67 种语言的编程练习，配备真人导师免费点评。",
        tags: ["练习", "免费"],
        imageSeed: "exercism",
      },
      {
        title: "Coursera",
        url: "https://www.coursera.org",
        description: "名校公开课平台，计算机科学与数据领域课程齐全。",
        tags: ["公开课"],
        imageSeed: "coursera",
      },
      {
        title: "掘金",
        url: "https://juejin.cn",
        description: "中文开发者技术社区，前端与移动端内容活跃。",
        tags: ["中文", "社区"],
        imageSeed: "juejin",
      },
      {
        title: "Khan Academy",
        url: "https://www.khanacademy.org",
        description: "从数学到计算机的免费基础教育，日本語・한국어多语言可用 🌍",
        tags: ["基础", "免费"],
        imageSeed: "khan",
      },
    ],
  },
  {
    slug: "inspiration",
    name: "灵感画廊",
    icon: "images",
    description: "优秀站点与界面模式 🖼️",
    cards: [
      {
        title: "Awwwards",
        url: "https://www.awwwards.com",
        description: "评审制的网页设计奖项，代表行业最高视觉水准。",
        tags: ["网页设计", "奖项"],
        imageSeed: "awwwards",
        featured: true,
      },
      {
        title: "Mobbin",
        url: "https://mobbin.com",
        description: "真实上线 App 的界面截图库，按模式与流程检索。",
        tags: ["移动端", "模式"],
        imageSeed: "mobbin",
      },
      {
        title: "Godly",
        url: "https://godly.website",
        description: "精选 astronomically good 的落地页设计合集。",
        tags: ["落地页"],
        imageSeed: "godly",
      },
      {
        title: "Behance",
        url: "https://www.behance.net",
        description: "Adobe 旗下创意作品平台，覆盖品牌、插画与动效。",
        tags: ["作品集", "创意"],
        imageSeed: "behance",
      },
      {
        title: "SiteInspire",
        url: "https://www.siteinspire.com",
        description: "按风格、类型与主题筛选的网页设计画廊。",
        tags: ["网页设计"],
        imageSeed: "siteinspire",
      },
      {
        title: "Land-book",
        url: "https://land-book.com",
        description: "产品落地页灵感库，每日更新 🚀",
        tags: ["落地页", "产品"],
        imageSeed: "landbook",
      },
    ],
  },
  {
    slug: "productivity",
    name: "效率工具",
    icon: "zap",
    description: "笔记、任务与自动化 ⚡",
    cards: [
      {
        title: "Notion",
        url: "https://www.notion.com",
        description: "笔记、数据库与协作一体的 all-in-one 工作区 📝",
        tags: ["笔记", "协作"],
        imageSeed: "notion",
        featured: true,
      },
      {
        title: "Obsidian",
        url: "https://obsidian.md",
        description: "本地优先的双链笔记，Markdown 文件完全归自己所有。",
        tags: ["笔记", "本地优先"],
        imageSeed: "obsidian",
      },
      {
        title: "Excalidraw",
        url: "https://excalidraw.com",
        description: "手绘风白板工具，画架构图和流程图又快又好看。",
        tags: ["白板", "画图"],
        imageSeed: "excalidraw",
      },
      {
        title: "Linear",
        url: "https://linear.app",
        description: "为速度而生的项目管理工具，键盘操作行云流水。",
        tags: ["项目管理"],
        imageSeed: "linear",
      },
      {
        title: "Raycast",
        url: "https://www.raycast.com",
        description: "macOS 启动器，剪贴板、窗口管理与脚本插件全都有。",
        tags: ["启动器", "macOS"],
        imageSeed: "raycast",
      },
      {
        title: "Todoist",
        url: "https://todoist.com",
        description: "自然语言录入的跨平台任务管理，坚持记录的好帮手 ✅",
        tags: ["任务", "跨平台"],
        imageSeed: "todoist",
      },
    ],
  },
];

function faviconUrl(siteUrl: string): string {
  const host = new URL(siteUrl).hostname;
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function imageUrl(seed: string): string {
  // picsum with fixed seed: same input -> same image
  return `https://picsum.photos/seed/${seed}/800/500`;
}

// Idempotent and side-effect safe: existing categories/cards are skipped; never overwrites admin edits
export async function runSeed(db: PrismaClient): Promise<{ categories: number; cards: number }> {
  let cardTotal = 0;
  let createdCategories = 0;

  for (let categoryIndex = 0; categoryIndex < seedCategories.length; categoryIndex++) {
    const seedCategory = seedCategories[categoryIndex];
    if (!seedCategory) continue;

    const existingCategory = await db.category.findFirst({
      where: { slug: seedCategory.slug },
      select: { id: true },
    });
    // Skip if category exists (incl. soft-deleted): soft delete is admin intent
    const category =
      existingCategory ??
      (await db.category.create({
        data: {
          slug: seedCategory.slug,
          name: seedCategory.name,
          icon: seedCategory.icon,
          description: seedCategory.description,
          order: categoryIndex,
        },
      }));
    if (existingCategory === undefined) createdCategories += 1;

    for (let cardIndex = 0; cardIndex < seedCategory.cards.length; cardIndex++) {
      const seedCard = seedCategory.cards[cardIndex];
      if (!seedCard) continue;

      const existingCard = await db.card.findFirst({
        where: { categoryId: category.id, title: seedCard.title },
        select: { id: true, deletedAt: true },
      });
      // Skip if card exists (incl. soft-deleted); only create when missing
      if (existingCard !== null) continue;

      const card = await db.card.create({
        data: {
          title: seedCard.title,
          url: seedCard.url,
          description: seedCard.description,
          image: imageUrl(seedCard.imageSeed),
          favicon: faviconUrl(seedCard.url),
          order: cardIndex,
          status: "PUBLISHED",
          featured: seedCard.featured === true,
          categoryId: category.id,
        },
      });

      for (const tagName of seedCard.tags) {
        const tag = await db.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        await db.cardTag.upsert({
          where: { cardId_tagId: { cardId: card.id, tagId: tag.id } },
          update: {},
          create: { cardId: card.id, tagId: tag.id },
        });
      }
      cardTotal += 1;
    }
  }

  return { categories: createdCategories, cards: cardTotal };
}
