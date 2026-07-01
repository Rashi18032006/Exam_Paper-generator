import { Annotation } from "@langchain/langgraph";

export interface AgentQuestion {
  text: string;
  marks: number;
  type: string;
  options?: string[];
  answerKey: string;
  latex?: string;
  starterCode?: string;
  solution?: string;
}

export type SectionOutput = AgentQuestion[];

export interface CompiledQuestion {
  qNo: number;
  type: string;
  text: string;
  marks: number;
  options?: string[];
  answerKey: string;
  latex?: string;
  starterCode?: string;
  solution?: string;
}

export interface CompiledExamSection {
  name: string;
  questions: CompiledQuestion[];
}

export interface CompiledExam {
  title: string;
  sections: CompiledExamSection[];
  totalMarks: number;
}

export interface ExamGraphState {
  input: {
    topic: string;
    totalMarks: number;
    difficulty: string;
    numQuestions?: number;
    distribution?: {
      theory: number;
      code: number;
      math: number;
    };
  };
  managerDistribution: {
    agentA: { marks: number };
    agentB: { marks: number };
    agentC: { marks: number };
  } | null;
  agentAOutput: SectionOutput | null;
  agentBOutput: SectionOutput | null;
  agentCOutput: SectionOutput | null;
  editorOutput: CompiledExam | { error: string; expected: number; got: number } | null;
  humanFeedback: string | null;
  feedbackRouterTarget: string[] | null;
  iteration: number;
  status: 'running' | 'awaiting_review' | 'approved' | 'error';
}

export const ExamGraphAnnotation = Annotation.Root({
  input: Annotation<ExamGraphState["input"]>(),
  managerDistribution: Annotation<ExamGraphState["managerDistribution"]>(),
  agentAOutput: Annotation<ExamGraphState["agentAOutput"]>(),
  agentBOutput: Annotation<ExamGraphState["agentBOutput"]>(),
  agentCOutput: Annotation<ExamGraphState["agentCOutput"]>(),
  editorOutput: Annotation<ExamGraphState["editorOutput"]>(),
  humanFeedback: Annotation<ExamGraphState["humanFeedback"]>(),
  feedbackRouterTarget: Annotation<ExamGraphState["feedbackRouterTarget"]>(),
  iteration: Annotation<ExamGraphState["iteration"]>(),
  status: Annotation<ExamGraphState["status"]>(),
});
