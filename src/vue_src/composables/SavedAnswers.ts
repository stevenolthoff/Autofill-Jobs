import { ref, onMounted } from 'vue';

export interface QuestionVariant {
  id: string;
  question: string;
  sourceUrl: string;
  embedding?: number[];
  timestamp: string;
}

export interface AnswerCluster {
  id: string;
  answer: string;
  questions: QuestionVariant[];
  timestamp?: string; // For sorting by most recent activity
}

const savedAnswers = ref<AnswerCluster[]>([]);

export function useSavedAnswers() {
  const loadAnswers = async () => {
    if (chrome.storage) {
      const data = await chrome.storage.local.get('saved_answers');
      const clusters: AnswerCluster[] = data.saved_answers || [];
      
      // Sort clusters by the timestamp of their most recent question
      clusters.forEach(cluster => {
        // Ensure questions array exists
        if (!cluster.questions) {
          cluster.questions = [];
        }
        
        if (cluster.questions.length > 0) {
          cluster.timestamp = cluster.questions.reduce((latest, q) => 
            q.timestamp > latest ? q.timestamp : latest, cluster.questions[0].timestamp
          );
        } else {
          cluster.timestamp = new Date(0).toISOString();
        }
      });

      savedAnswers.value = clusters.sort((a, b) => 
        new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
      );

    } else { // Mock data for development
        savedAnswers.value = [
            { 
                id: 'cluster1', 
                answer: 'I am passionate about the company mission and believe my skills in...', 
                questions: [
                    { id: 'q1', question: 'Why do you want to work here?', sourceUrl: 'http://example.com', timestamp: new Date().toISOString() },
                    { id: 'q2', question: 'What makes you a good fit for this role?', sourceUrl: 'http://example.com', timestamp: new Date().toISOString() },
                ],
                timestamp: new Date().toISOString()
            },
        ];
    }
  };

  const deleteAnswer = async (clusterId: string) => {
    const updatedClusters = savedAnswers.value.filter(c => c.id !== clusterId);
    if (chrome.storage) {
      await chrome.storage.local.set({ saved_answers: updatedClusters });
    }
    savedAnswers.value = updatedClusters;
  };

  const updateAnswer = async (clusterId: string, updatedData: { answer: string }) => {
    const updatedClusters = savedAnswers.value.map(c => 
      c.id === clusterId ? { ...c, answer: updatedData.answer } : c
    );
    if (chrome.storage) {
      await chrome.storage.local.set({ saved_answers: updatedClusters });
    }
    savedAnswers.value = updatedClusters;
  };

  const deleteQuestionVariant = async (clusterId: string, questionId: string) => {
    const cluster = savedAnswers.value.find(c => c.id === clusterId);
    if (!cluster || !cluster.questions) return;

    const updatedQuestions = cluster.questions.filter(q => q.id !== questionId);
    let updatedClusters;

    if (updatedQuestions.length === 0) {
      updatedClusters = savedAnswers.value.filter(c => c.id !== clusterId);
    } else {
      updatedClusters = savedAnswers.value.map(c => 
        c.id === clusterId ? { ...c, questions: updatedQuestions } : c
      );
    }
    
    if (chrome.storage) {
      await chrome.storage.local.set({ saved_answers: updatedClusters });
    }
    savedAnswers.value = updatedClusters;
  };

  onMounted(loadAnswers);

  return {
    savedAnswers,
    loadAnswers,
    deleteAnswer,
    updateAnswer,
    deleteQuestionVariant,
  };
}
