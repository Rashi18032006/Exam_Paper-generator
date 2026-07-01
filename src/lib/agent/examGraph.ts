import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ExamGraphAnnotation, ExamGraphState, AgentQuestion, SectionOutput, CompiledExam } from "@/lib/agent/state";
import { tavilySearch, splitMarks } from "@/lib/agent/tools";

// Helper function to clean and parse JSON markdown
function cleanAndParseJSON(text: string) {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse JSON from content:", text, error);
    throw error;
  }
}

// Helper to adjust question marks to exactly match budget
function adjustQuestionMarks(questions: AgentQuestion[], budget: number): AgentQuestion[] {
  if (!questions || questions.length === 0) {
    return [{
      text: "Theoretical concept question fallback due to missing data",
      marks: budget,
      type: "SAQ",
      answerKey: "Default answer"
    }];
  }

  const currentSum = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  if (currentSum === budget) return questions;

  const difference = budget - currentSum;
  const lastQ = questions[questions.length - 1];
  const newMarks = (lastQ.marks || 0) + difference;

  if (newMarks > 0) {
    lastQ.marks = newMarks;
  } else {
    lastQ.marks = 1;
    const newSum = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const newDiff = budget - newSum;
    questions[0].marks = Math.max(1, (questions[0].marks || 0) + newDiff);
  }

  return questions;
}

// 1. Initial Node to prepare distribution
const initNode = async (state: typeof ExamGraphAnnotation.State) => {
  // If we are resuming after human review, don't re-split marks
  if (state.managerDistribution) {
    return {};
  }

  const distribution = splitMarks(state.input.totalMarks, state.input.distribution);
  return {
    managerDistribution: distribution,
    iteration: 0,
    status: "running" as const,
    agentAOutput: null,
    agentBOutput: null,
    agentCOutput: null,
    editorOutput: null,
    feedbackRouterTarget: null,
    humanFeedback: state.humanFeedback || null,
  };
};

// 2. Worker Node A: Concept
const agentA_concept = async (state: typeof ExamGraphAnnotation.State) => {
  const budget = state.managerDistribution?.agentA.marks ?? 0;
  const topic = state.input.topic;
  const difficulty = state.input.difficulty;

  if (budget <= 0) {
    return { agentAOutput: [] };
  }

  const searchQuery = `${topic} theory questions exam`;
  let searchResults = "";
  try {
    searchResults = await tavilySearch(searchQuery);
  } catch (error) {
    console.error("Tavily search failed for Agent A:", error);
  }

  const ratioA = state.input.distribution?.theory ?? 40;
  const ratioB = state.input.distribution?.code ?? 35;
  const ratioC = state.input.distribution?.math ?? 25;
  const totalRatio = ratioA + ratioB + ratioC || 100;
  const numQuestionsTotal = state.input.numQuestions || 10;
  const numQuestionsA = Math.max(1, Math.round((ratioA / totalRatio) * numQuestionsTotal));

  const systemPrompt = `You are a Concept/Theory Exam Question Generator.
Generate a JSON array of exactly ${numQuestionsA} Short Answer Questions (SAQ) and Multiple Choice Questions (MCQ) on the topic "${topic}" with difficulty level "${difficulty}".
The total marks for all questions in this JSON array MUST be exactly ${budget}.
Each MCQ must have options and an answerKey. Each SAQ must have an answerKey.
Do not include any text other than the JSON array.
Use this format:
[
  { "text": "...", "marks": 2, "type": "MCQ", "options": ["A", "B", "C", "D"], "answerKey": "A" },
  { "text": "...", "marks": 5, "type": "SAQ", "answerKey": "..." }
]`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    maxRetries: 5,
  });

  const prompt = searchResults && searchResults.trim().length > 50
    ? `Here is some search context retrieved from the web:\n${searchResults}\n\nBased on this context, ${systemPrompt}`
    : `Generate the questions from scratch. ${systemPrompt}`;

  const response = await model.invoke(prompt);
  const content = response.content as string;
  let questions = cleanAndParseJSON(content);
  questions = adjustQuestionMarks(questions, budget);

  return { agentAOutput: questions };
};

// 3. Worker Node B: Programmer
const agentB_programmer = async (state: typeof ExamGraphAnnotation.State) => {
  const budget = state.managerDistribution?.agentB.marks ?? 0;
  const topic = state.input.topic;
  const difficulty = state.input.difficulty;

  if (budget <= 0) {
    return { agentBOutput: [] };
  }

  // Stagger execution to avoid concurrent Google API requests
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const searchQuery = `${topic} coding problems Python`;
  let searchResults = "";
  try {
    searchResults = await tavilySearch(searchQuery);
  } catch (error) {
    console.error("Tavily search failed for Agent B:", error);
  }

  const ratioA = state.input.distribution?.theory ?? 40;
  const ratioB = state.input.distribution?.code ?? 35;
  const ratioC = state.input.distribution?.math ?? 25;
  const totalRatio = ratioA + ratioB + ratioC || 100;
  const numQuestionsTotal = state.input.numQuestions || 10;
  const numQuestionsB = Math.max(1, Math.round((ratioB / totalRatio) * numQuestionsTotal));

  const systemPrompt = `You are a Programming Exam Question Generator.
Generate a JSON array of exactly ${numQuestionsB} programming tasks on the topic "${topic}" with difficulty level "${difficulty}".
The total marks for all questions in this JSON array MUST be exactly ${budget}.
Each programming task must include a description in "text", "starterCode" (e.g. Python function signature), and "solution" code, plus an "answerKey".
Do not include any text other than the JSON array.
Use this format:
[
  { "text": "Write a function to...", "marks": 10, "type": "CODING", "starterCode": "def solve():", "solution": "def solve():\\n  return True", "answerKey": "..." }
]`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    maxRetries: 5,
  });

  const prompt = searchResults && searchResults.trim().length > 50
    ? `Here is some search context retrieved from the web:\n${searchResults}\n\nBased on this context, ${systemPrompt}`
    : `Generate the questions from scratch. ${systemPrompt}`;

  const response = await model.invoke(prompt);
  const content = response.content as string;
  let questions = cleanAndParseJSON(content);
  questions = adjustQuestionMarks(questions, budget);

  return { agentBOutput: questions };
};

// 4. Worker Node C: Mathematician
const agentC_mathematician = async (state: typeof ExamGraphAnnotation.State) => {
  const budget = state.managerDistribution?.agentC.marks ?? 0;
  const topic = state.input.topic;
  const difficulty = state.input.difficulty;

  if (budget <= 0) {
    return { agentCOutput: [] };
  }

  // Stagger execution to avoid concurrent Google API requests
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const searchQuery = `${topic} numerical problems solutions`;
  let searchResults = "";
  try {
    searchResults = await tavilySearch(searchQuery);
  } catch (error) {
    console.error("Tavily search failed for Agent C:", error);
  }

  const ratioA = state.input.distribution?.theory ?? 40;
  const ratioB = state.input.distribution?.code ?? 35;
  const ratioC = state.input.distribution?.math ?? 25;
  const totalRatio = ratioA + ratioB + ratioC || 100;
  const numQuestionsTotal = state.input.numQuestions || 10;
  const numQuestionsC = Math.max(1, Math.round((ratioC / totalRatio) * numQuestionsTotal));

  const systemPrompt = `You are a Mathematics Exam Question Generator.
Generate a JSON array of exactly ${numQuestionsC} math problems on the topic "${topic}" with difficulty level "${difficulty}".
The total marks for all questions in this JSON array MUST be exactly ${budget}.
Each problem must include LaTeX formulas (using $ for inline and $$ for block math) in "text" or "latex" property, "solution" showing step-by-step math derivation, and a short "answerKey".
Do not include any text other than the JSON array.
Use this format:
[
  { "text": "Calculate $x$ when...", "latex": "x^2 + y^2 = r^2", "marks": 8, "type": "NUMERICAL", "solution": "Step 1...", "answerKey": "x = ..." }
]`;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    maxRetries: 5,
  });

  const prompt = searchResults && searchResults.trim().length > 50
    ? `Here is some search context retrieved from the web:\n${searchResults}\n\nBased on this context, ${systemPrompt}`
    : `Generate the questions from scratch. ${systemPrompt}`;

  const response = await model.invoke(prompt);
  const content = response.content as string;
  let questions = cleanAndParseJSON(content);
  questions = adjustQuestionMarks(questions, budget);

  return { agentCOutput: questions };
};

// 5. Editor Node
const editorAgent = async (state: typeof ExamGraphAnnotation.State) => {
  const expectedTotalMarks = state.input.totalMarks;
  const topic = state.input.topic;
  const difficulty = state.input.difficulty;

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.2,
    maxRetries: 5,
  });

  const prompt = `You are an Exam Editor.
You will receive three JSON arrays of exam questions from different sections:
Section A (Concept/Theory): ${JSON.stringify(state.agentAOutput)}
Section B (Programming/Coding): ${JSON.stringify(state.agentBOutput)}
Section C (Mathematics/Numerical): ${JSON.stringify(state.agentCOutput)}

Your task is to:
1. Compile these three sections into a single exam with sections "Theory/Concept", "Programming/Coding", and "Mathematics/Numerical".
2. Deduplicate any overlapping or redundant questions.
3. Assign sequential qNo (question numbers) starting from 1.
4. Ensure the totalMarks property is the exact sum of the marks of all questions in the compiled exam. The expected total marks is ${expectedTotalMarks}.
5. Format the output as a single JSON object matching this schema:
{
  "title": "Exam on ${topic} (Difficulty: ${difficulty})",
  "sections": [
    {
      "name": "Theory/Concept",
      "questions": [
        { "qNo": 1, "type": "MCQ", "text": "...", "marks": 2, "options": ["A", "B"], "answerKey": "A" }
      ]
    }
  ],
  "totalMarks": ${expectedTotalMarks}
}

If the sum of marks of all questions does not equal ${expectedTotalMarks}, do not try to make it up; instead, return a JSON object with this schema:
{
  "error": "Mark mismatch",
  "expected": ${expectedTotalMarks},
  "got": [calculated_sum]
}

Return ONLY the JSON. No other text or markdown code blocks.`;

  const response = await model.invoke(prompt);
  const content = response.content as string;
  const parsed = cleanAndParseJSON(content);

  if ("error" in parsed) {
    return {
      editorOutput: parsed,
      status: "error" as const,
    };
  }

  let actualSum = 0;
  if (parsed.sections) {
    for (const section of parsed.sections) {
      if (section.questions) {
        for (const question of section.questions) {
          actualSum += question.marks || 0;
        }
      }
    }
  }

  if (actualSum !== expectedTotalMarks) {
    return {
      editorOutput: { error: "Mark mismatch", expected: expectedTotalMarks, got: actualSum },
      status: "error" as const,
    };
  }

  return {
    editorOutput: parsed as CompiledExam,
    status: "running" as const,
  };
};

// 6. Feedback Router Node (deterministic, NO LLM)
const feedbackRouterAgent = async (state: typeof ExamGraphAnnotation.State) => {
  const feedback = (state.humanFeedback || "").toLowerCase();
  let targets: string[] = [];

  const reRunA = ["theory", "concept", "mcq", "definition"].some((kw) => feedback.includes(kw));
  const reRunB = ["code", "program", "function", "algorithm"].some((kw) => feedback.includes(kw));
  const reRunC = ["math", "calculation", "formula", "numerical"].some((kw) => feedback.includes(kw));

  if (reRunA && !reRunB && !reRunC) {
    targets = ["agentA"];
  } else if (!reRunA && reRunB && !reRunC) {
    targets = ["agentB"];
  } else if (!reRunA && !reRunB && reRunC) {
    targets = ["agentC"];
  } else {
    targets = ["agentA", "agentB", "agentC"];
  }

  const nextIteration = state.iteration + 1;

  if (nextIteration > 5) {
    return {
      status: "approved" as const,
      feedbackRouterTarget: null,
      humanFeedback: null,
      iteration: nextIteration,
    };
  }

  const update: any = {
    feedbackRouterTarget: targets,
    editorOutput: null,
    humanFeedback: null,
    iteration: nextIteration,
    status: "running" as const,
  };

  if (targets.includes("agentA")) update.agentAOutput = null;
  if (targets.includes("agentB")) update.agentBOutput = null;
  if (targets.includes("agentC")) update.agentCOutput = null;

  return update;
};

// 7. Human Review Node
const humanReviewNode = async (state: typeof ExamGraphAnnotation.State) => {
  return {
    status: "awaiting_review" as const,
  };
};

// Compile the LangGraph state workflow
const workflow = new StateGraph(ExamGraphAnnotation)
  .addNode("init", initNode)
  .addNode("agentA", agentA_concept)
  .addNode("agentB", agentB_programmer)
  .addNode("agentC", agentC_mathematician)
  .addNode("editor", editorAgent)
  .addNode("feedbackRouter", feedbackRouterAgent)
  .addNode("humanReview", humanReviewNode);

workflow.addEdge(START, "init");

// Initial run conditional fork
workflow.addConditionalEdges("init", (state) => {
  if (state.humanFeedback !== null && state.humanFeedback !== undefined && state.humanFeedback.trim() !== "") {
    return ["feedbackRouter"];
  }
  return ["agentA", "agentB", "agentC"];
});

// Join branches to editor
workflow.addEdge("agentA", "editor");
workflow.addEdge("agentB", "editor");
workflow.addEdge("agentC", "editor");

// Conditional route from editor (halt on error, otherwise go to humanReview)
workflow.addConditionalEdges("editor", (state) => {
  if (state.status === "error") {
    return END;
  }
  return "humanReview";
});

// humanReview goes to END
workflow.addEdge("humanReview", END);

// feedbackRouter routes dynamically back to targeted worker agents or END
workflow.addConditionalEdges("feedbackRouter", (state) => {
  if (state.status === "approved" || !state.feedbackRouterTarget || state.feedbackRouterTarget.length === 0) {
    return END;
  }
  return state.feedbackRouterTarget;
});

export const examGraph = workflow.compile();
