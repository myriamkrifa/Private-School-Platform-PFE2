/**
 * Built-in General AI when OPENAI_API_KEY is not set.
 */

const TOPIC_ANSWERS = {
  java: `**Java** is a popular **object-oriented programming language** created in the 1990s (originally by Sun Microsystems, now maintained by Oracle and the open-source community).

**What it is used for:** Android apps, enterprise backends, banking systems, large web services, and desktop applications.

**Key ideas:**
- Code runs on the **JVM** (Java Virtual Machine) — "write once, run anywhere"
- Strong typing, classes, and objects
- Huge standard library and ecosystem (Spring, Maven, Gradle)

**Hello World:**
\`\`\`java
public class Hello {
  public static void main(String[] args) {
    System.out.println("Hello, World!");
  }
}
\`\`\`

**Java vs JavaScript:** Different languages — Java is compiled for the JVM; JavaScript runs mainly in browsers and Node.js.`,

  javascript: `**JavaScript** is a programming language used mainly for **websites and web apps** (browsers) and **servers** (Node.js).

**Key ideas:** variables, functions, objects, DOM manipulation, async (\`fetch\`, promises).

\`\`\`javascript
console.log("Hello, World!");
\`\`\`

Often used with HTML/CSS. Not the same as **Java**.`,

  python: `**Python** is a widely used programming language known for **readable syntax** and versatility.

**Used for:** data science, AI/ML, scripting, web backends (Django, Flask), automation, education.

\`\`\`python
print("Hello, World!")
\`\`\`

Indentation defines code blocks instead of curly braces.`,

  html: `**HTML** (HyperText Markup Language) is the standard language for **structuring web pages**.

It uses **tags** like \`<h1>\`, \`<p>\`, \`<a>\`, \`<div>\` to define headings, paragraphs, links, and layout containers. Browsers render HTML; styling is usually done with **CSS**, behavior with **JavaScript**.`,

  css: `**CSS** (Cascading Style Sheets) controls **how HTML looks** — colors, fonts, spacing, layout, responsive design.

Example:
\`\`\`css
h1 { color: navy; font-size: 2rem; }
\`\`\`

Works together with HTML and JavaScript.`,

  react: `**React** is a **JavaScript library** for building user interfaces, especially single-page web apps.

**Ideas:** components, JSX, state, props, virtual DOM. Created by Meta; often used with tools like Vite or Next.js.`,

  photosynthesis: `**Photosynthesis** is how green plants make food using light energy.

Plants take **CO₂** and **water**, use **sunlight** and **chlorophyll**, and produce **glucose** and **oxygen**.

**Equation (simplified):** 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂`,

  dna: `**DNA** (deoxyribonucleic acid) stores genetic instructions in living organisms. It has a **double helix** shape with bases A, T, C, G.

**RNA** is related but usually single-stranded and helps build proteins from DNA instructions.`,

  rna: `**RNA** (ribonucleic acid) helps cells use genetic information from **DNA** to make proteins. It is usually single-stranded and uses base **U** instead of **T**.`,

  ai: `**Artificial intelligence (AI)** means computer systems that perform tasks that usually need human intelligence — e.g. understanding language, recognizing images, or making predictions.

**Machine learning** is a common approach: models learn patterns from data rather than following only fixed rules.`,

  'machine learning': `**Machine learning** is a branch of AI where programs **learn from data** to make predictions or decisions (e.g. spam filters, recommendations, image recognition).

Common types: supervised learning, unsupervised learning, neural networks / deep learning.`,

  api: `An **API** (Application Programming Interface) is a defined way for programs to **talk to each other** — e.g. your app sends an HTTP request to a server and gets JSON data back.

REST APIs are common on the web.`,

  database: `A **database** is organized storage for data (users, grades, products, etc.). Apps **query** it with SQL (MySQL, PostgreSQL) or document tools (MongoDB).

Your EduManage school data lives in a database.`,

  sql: `**SQL** (Structured Query Language) is used to **read and change data** in relational databases.

Examples:
\`\`\`sql
SELECT name FROM students WHERE class_id = 3;
INSERT INTO users (email) VALUES ('a@school.com');
\`\`\``,

  coding: `**Coding (programming)** means writing instructions computers can run to solve problems and build software.

**Languages:** Python, Java, JavaScript, C++, and many more — each has different strengths.

**Core concepts:** variables, conditions (\`if\`), loops, functions, data structures, debugging.

**How to start:** pick one language, follow a beginner tutorial, build small projects (calculator, todo app), practice daily.`,

  'computer programming': `**Computer programming** is creating software by writing code in languages like Python, Java, or JavaScript.

Programmers use **algorithms** (step-by-step logic), **data structures**, and tools like editors, Git, and frameworks to build apps, websites, and systems.`
}

function normalizeTopic(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .trim()
}

function extractWhatIsSubject(message) {
  const m = String(message || '').trim()
  const patterns = [
    /^(?:what is|what's|whats|what about|define|explain|tell me about)\s+(?:an?\s+)?(.+)$/i,
    /^(?:can you explain|help me understand)\s+(.+)$/i
  ]
  for (const pattern of patterns) {
    const match = m.match(pattern)
    if (match) return normalizeTopic(match[1])
  }
  return null
}

function extractTopic(message) {
  const m = String(message || '')
  const about = m.match(/(?:about|explain|learn|understand)\s+(.+?)(?:\?|$)/i)
  if (about) return about[1].trim().replace(/\.$/, '')
  return 'the topic'
}

function titleCase(subject) {
  if (!subject) return 'This topic'
  return subject.charAt(0).toUpperCase() + subject.slice(1)
}

function lookupTopicAnswer(subject) {
  if (!subject) return null
  if (TOPIC_ANSWERS[subject]) return TOPIC_ANSWERS[subject]
  if (subject.includes('java') && !subject.includes('javascript')) return TOPIC_ANSWERS.java
  if (subject.includes('javascript') || subject === 'js') return TOPIC_ANSWERS.javascript
  if (subject.includes('photo')) return TOPIC_ANSWERS.photosynthesis
  if (subject === 'coding' || subject === 'code' || subject.includes('programming')) {
    return TOPIC_ANSWERS.coding
  }
  return null
}

function answerFromLocalGeneral(message) {
  const q = String(message || '').toLowerCase().trim()
  const topic = extractTopic(message)

  const whatIsSubject = extractWhatIsSubject(message)
  if (whatIsSubject) {
    const direct = lookupTopicAnswer(whatIsSubject)
    if (direct) return direct
  }

  if (/\bjava\b(?!script)/.test(q) && !/javascript/.test(q)) {
    return TOPIC_ANSWERS.java
  }

  if (/photosynthesis/.test(q)) {
    return TOPIC_ANSWERS.photosynthesis
  }

  if (/dna|rna/.test(q)) {
    return TOPIC_ANSWERS.dna
  }

  if (/fraction/.test(q)) {
    return `**Understanding fractions**

A **fraction** is part of a whole: **numerator** (top) ÷ **denominator** (bottom).

**Examples:** ½ = one of two equal parts; ¾ = three of four parts.

**Adding (same denominator):** ¼ + ¼ = ½  
**Different denominators:** find a common denominator first (e.g. ½ + ⅓ → 3/6 + 2/6 = 5/6).`
  }

  if (/javascript|js\b/.test(q) || /help me learn.*(code|program)/.test(q)) {
    return TOPIC_ANSWERS.javascript
  }

  if (/professional email|write.*email|email to|polite email/.test(q)) {
    return `**Professional email template**

**Subject:** [Clear, specific subject]

Dear [Name],

I hope this message finds you well. I am writing regarding **[reason — one sentence]**.

[Main paragraph: facts, dates, or request. Keep it polite and concise.]

Please let me know if you need any further information. Thank you for your time and support.

Kind regards,  
[Your name]`
  }

  if (/feedback comment|report card|student report/.test(q)) {
    return `**Report feedback comments (examples)**

- *Strengths:* "[Name] participates actively and completes homework on time."
- *Progress:* "Shows steady improvement in [subject]; keep practicing [skill]."
- *Focus area:* "Would benefit from more practice with [topic]."`
  }

  if (/quiz|exam question|mathematics quiz/.test(q)) {
    return `**Sample mathematics quiz (Grade 7 — fractions)**

1. Simplify: 12/18  
2. Add: ¼ + ⅜  
3. A pizza has 8 slices. You eat 3. What fraction remains?  
4. Which is larger: ⅔ or ¾?`
  }

  if (/lesson plan/.test(q)) {
    return `**Lesson plan outline — fractions (45 min)**

**Objectives:** Understand numerator/denominator; add fractions with like denominators.

**Starter:** Real-life examples (pizza, measuring cups).

**Main:** Define terms; guided practice.

**Plenary:** Exit ticket; homework problems.`
  }

  if (/stud(y|ying)|revision plan|support my child/.test(q)) {
    return `**Study support tips**

1. **Short sessions:** 25–30 minutes with breaks.  
2. **Plan the week:** subjects, deadlines, one priority per day.  
3. **Active recall:** explain the topic aloud without notes.  
4. **Environment:** quiet space, phone away.

For **your** homework or grades in EduManage, ask: "What homework is due?" or "Show my recent grades."`
  }

  if (/write.*(essay|paragraph|letter)|help me write/.test(q)) {
    return `**Writing help for:** "${topic}"

1. **Introduction** — main idea in 1–2 sentences  
2. **Body** — 2–3 points with examples  
3. **Conclusion** — summarize without new facts`
  }

  if (/python/.test(q)) {
    return TOPIC_ANSWERS.python
  }

  if (/recipe|cook/.test(q)) {
    return `Tell me the dish and dietary needs for a simple outline. Always follow verified recipes for safety.`
  }

  if (/weather/.test(q)) {
    return `I cannot fetch live weather — use a weather app. I can explain climate concepts if you ask.`
  }

  return null
}

module.exports = { answerFromLocalGeneral }
