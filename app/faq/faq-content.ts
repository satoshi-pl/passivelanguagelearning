export type FaqItem = { id: string; question: string; answer: string };

export type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "method",
    title: "The method",
    items: [
      {
        id: "what-is-pll",
        question: "What is Passive Language Learning?",
        answer:
          "Passive Language Learning is the first step in PLL. You see the target language first, then connect it to meaning in your support language. This builds recognition and understanding in a lighter, more natural way before moving into more demanding recall.",
      },
      {
        id: "why-start-passive",
        question: "Why does PLL start with Passive Learning?",
        answer:
          "Because understanding usually comes before confident recall. Starting with recognition makes learning feel clearer and more rewarding early on. It reduces friction and helps you build a strong base before moving into active use of the language.",
      },
      {
        id: "why-easier-direction",
        question: "Why is target language → native language easier?",
        answer:
          "This direction focuses on recognition rather than production. You don’t have to generate the language yourself straight away, which lowers mental effort. That makes it easier to build familiarity, notice patterns, and feel real progress sooner.",
      },
      {
        id: "when-active-unlocks",
        question: "When does Active Learning unlock?",
        answer:
          "Active Learning becomes available only after you’ve mastered an item in Passive Learning. This ensures that recall is built on understanding, not guesswork.",
      },
      {
        id: "what-is-active",
        question: "What is Active Learning?",
        answer:
          "Active Learning is the second stage. You start from your support language and try to recall the target language. It is more demanding, but it strengthens memory, recall, and control of the language.",
      },
      {
        id: "why-not-active-first",
        question: "Why not start with active recall immediately?",
        answer:
          "Because it can make learning feel heavy too early. PLL is designed to create momentum first through understanding, then build toward recall once the learner is ready.",
      },
    ],
  },
  {
    id: "how-it-works",
    title: "How PLL works",
    items: [
      {
        id: "learn-vs-review",
        question: "What is the difference between Learning and Review?",
        answer:
          "Learning is where you move forward and mark items as mastered. Review is where you revisit what you already know to strengthen it. Review does not reset progress — it simply reinforces it.",
      },
      {
        id: "review-limits",
        question: "Can I review without limits?",
        answer:
          "Yes. You can use both Passive Review and Active Review as much as you want. If something doesn’t feel fully stable yet, you can keep practicing it without any pressure.",
      },
      {
        id: "mastered-too-early",
        question: "What happens if I mark something as mastered too early?",
        answer:
          "Nothing negative. “Mastered” simply means the item is ready for the next stage. You can still review it at any time, so you never lose access to it.",
      },
      {
        id: "what-are-favourites",
        question: "What are Favourites?",
        answer:
          "Favourites let you create your own focused practice set. You can save important words or sentences and revisit them separately from your normal learning flow.",
      },
      {
        id: "choose-practice",
        question: "Can I choose what I practice?",
        answer:
          "Yes. You can choose between words, sentences, and words + sentences. You can also focus on specific categories to make learning more targeted.",
      },
    ],
  },
  {
    id: "philosophy",
    title: "Learning philosophy",
    items: [
      {
        id: "no-streaks",
        question: "Why doesn’t PLL use streaks?",
        answer:
          "Because learning should not feel like maintaining a number. Streaks can shift the focus from improving your language to simply staying active. PLL keeps the focus on actual learning and personal progress.",
      },
      {
        id: "no-levels",
        question: "Why are there no levels or gamified rewards?",
        answer:
          "PLL avoids unnecessary noise like gamified levelling, confetti, and artificial rewards. The goal is not to simulate progress, but to help you genuinely feel it through understanding and recall.",
      },
      {
        id: "enjoy-progress-meaning",
        question: "What does “Enjoy the progress!” mean?",
        answer:
          "It means progress itself should be the reward. PLL is designed so that improvement feels real and personal, not something driven by external pressure or gamified systems.",
      },
      {
        id: "anti-gamification",
        question: "Is PLL anti-gamification?",
        answer:
          "PLL simply takes a different approach. Instead of relying on external rewards, it focuses on structure, clarity, and meaningful repetition. The aim is to support a healthier and more sustainable learning experience.",
      },
      {
        id: "why-calmer",
        question: "Why is PLL designed to feel calmer?",
        answer:
          "Because many learners benefit from fewer distractions and less pressure. A calmer environment helps you concentrate better, stay consistent, and enjoy the process of improving.",
      },
    ],
  },
  {
    id: "practical",
    title: "Practical questions",
    items: [
      {
        id: "which-target-langs",
        question: "Which languages can I currently learn?",
        answer: "You can currently learn English and Spanish.",
      },
      {
        id: "which-support-langs",
        question: "Which support languages are available?",
        answer:
          "PLL currently supports learning from English, Spanish, German, French, Italian, Portuguese, Turkish, and Polish.",
      },
      {
        id: "beginners",
        question: "Is PLL good for beginners?",
        answer:
          "Yes. The passive-first structure makes it easier to get started. It reduces early difficulty and helps beginners build confidence step by step.",
      },
      {
        id: "vocabulary-only",
        question: "Is PLL only for vocabulary?",
        answer:
          "No. PLL includes both words and sentences, so you learn not just individual terms, but also how language works in context.",
      },
      {
        id: "audio",
        question: "Does PLL include audio?",
        answer:
          "Yes. Audio is included to support familiarity with pronunciation and help reinforce learning through listening.",
      },
    ],
  },
  {
    id: "who-for",
    title: "Who PLL is for",
    items: [
      {
        id: "who-designed",
        question: "Who is PLL designed for?",
        answer:
          "PLL is for learners who want structured language practice, a calm and focused environment, real progress without gamified pressure, and a more thoughtful approach to learning. It’s especially suitable for people who want to enjoy improving, rather than feel pushed by an app.",
      },
    ],
  },
];

export function faqJsonLd() {
  const mainEntity = FAQ_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question" as const,
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text: item.answer,
      },
    }))
  );

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}
