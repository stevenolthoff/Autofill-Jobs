import { ref, onMounted } from 'vue';

export interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  sourceUrl: string;
  embedding?: number[];
  timestamp: string;
}

const savedAnswers = ref<SavedAnswer[]>([]);

export function useSavedAnswers() {
  const loadAnswers = async () => {
    if (chrome.storage) {
      const data = await chrome.storage.local.get('saved_answers');
      savedAnswers.value = (data.saved_answers || []).sort((a: SavedAnswer, b: SavedAnswer) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else { // Mock data for development
        savedAnswers.value = [
            { id: '1', question: 'Why do you want to work here?', answer: 'I am passionate about the company mission.', sourceUrl: 'http://example.com', timestamp: new Date().toISOString() },
            { id: '2', question: 'What is your greatest weakness?', answer: 'Sometimes I focus too much on details.', sourceUrl: 'http://example.com', timestamp: new Date().toISOString() },
        ];
    }
  };

  const deleteAnswer = async (id: string) => {
    const updatedAnswers = savedAnswers.value.filter(a => a.id !== id);
    if (chrome.storage) {
      await chrome.storage.local.set({ saved_answers: updatedAnswers });
    }
    savedAnswers.value = updatedAnswers;
  };

  const updateAnswer = async (id: string, updatedAnswer: Partial<SavedAnswer>) => {
    const updatedAnswers = savedAnswers.value.map(a => 
      a.id === id ? { ...a, ...updatedAnswer } : a
    );
    if (chrome.storage) {
      await chrome.storage.local.set({ saved_answers: updatedAnswers });
    }
    savedAnswers.value = updatedAnswers;
  };

  onMounted(loadAnswers);

  return {
    savedAnswers,
    loadAnswers,
    deleteAnswer,
    updateAnswer,
  };
}
