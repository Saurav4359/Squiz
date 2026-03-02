import { mmkvStorage } from '../../lib/storage';
import { Question } from '../../types';

const SEEN_QUESTIONS_KEY = 'seekerrank_seen_questions';

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Gets the list of seen question hashes
 */
export async function getSeenQuestionHashes(): Promise<Set<string>> {
  const data = await mmkvStorage.getItem(SEEN_QUESTIONS_KEY);
  if (!data) return new Set();
  try {
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

/**
 * Adds questions to the seen list
 */
export async function markQuestionsAsSeen(questions: Question[]): Promise<void> {
  const seen = await getSeenQuestionHashes();
  questions.forEach(q => {
    seen.add(normalizeQuestion(q.question));
  });
  
  // Keep only the last 500 to prevent storage bloat
  const list = Array.from(seen).slice(-500);
  await mmkvStorage.setItem(SEEN_QUESTIONS_KEY, JSON.stringify(list));
}

/**
 * Filters out already seen questions from a list
 */
export async function filterSeenQuestions(questions: Question[]): Promise<Question[]> {
  const seen = await getSeenQuestionHashes();
  return questions.filter(q => !seen.has(normalizeQuestion(q.question)));
}
