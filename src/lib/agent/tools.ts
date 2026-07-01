import { TavilySearch } from "@langchain/tavily";

export async function tavilySearch(query: string): Promise<string> {
  // Read key directly from environment, if not set TavilySearch will look for TAVILY_API_KEY
  if (!process.env.TAVILY_API_KEY) {
    console.warn("TAVILY_API_KEY is not defined in the environment.");
    return "";
  }

  try {
    const searchTool = new TavilySearch({ maxResults: 3 });
    const result = await searchTool.invoke({ query });
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    console.error("Tavily search failed:", error);
    return "";
  }
}

export interface MarkDistribution {
  theory?: number;
  code?: number;
  math?: number;
}

export function splitMarks(total: number, distribution?: MarkDistribution) {
  const pA = distribution?.theory ?? 40;
  const pB = distribution?.code ?? 35;
  const pC = distribution?.math ?? 25;

  const totalPercent = pA + pB + pC;
  if (totalPercent === 0) {
    return {
      agentA: { marks: 0 },
      agentB: { marks: 0 },
      agentC: { marks: 0 }
    };
  }

  let marksA = Math.floor((total * pA) / totalPercent);
  let marksB = Math.floor((total * pB) / totalPercent);
  let marksC = Math.floor((total * pC) / totalPercent);

  let remainder = total - (marksA + marksB + marksC);
  if (remainder > 0) {
    marksA += 1;
    remainder -= 1;
  }
  if (remainder > 0) {
    marksB += 1;
    remainder -= 1;
  }
  if (remainder > 0) {
    marksC += 1;
    remainder -= 1;
  }

  return {
    agentA: { marks: marksA },
    agentB: { marks: marksB },
    agentC: { marks: marksC }
  };
}
