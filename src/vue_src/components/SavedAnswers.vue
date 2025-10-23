<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-medium text-muted-foreground">Saved Answers</h2>
    <div class="max-h-60 overflow-y-auto space-y-3 p-1 rounded-md border">
        <div v-if="savedAnswers.length === 0" class="text-sm text-muted-foreground text-center p-4">
            No answers saved yet. Start applying to build your database!
        </div>
        <div v-for="cluster in savedAnswers" :key="cluster.id" class="p-3 bg-muted/50 rounded-md">
            
            <!-- Answer display/edit area -->
            <div>
              <textarea 
                v-if="editingId === cluster.id"
                v-model="editingAnswer"
                class="w-full text-sm font-medium text-foreground bg-background p-2 rounded border resize-none"
                rows="3"
                @keydown.enter.prevent="saveEdit(cluster.id)"
                @keydown.escape="cancelEdit"
                ref="editTextarea"
              ></textarea>
              <p 
                v-else 
                class="text-sm font-medium text-foreground bg-background p-2 rounded cursor-pointer hover:bg-muted/30 transition-colors" 
                @click="startEdit(cluster.id, cluster.answer)"
                :title="'Click to edit canonical answer'"
              >{{ cluster.answer }}</p>
            </div>
            
            <!-- List of associated questions -->
            <div class="mt-2 pl-4 border-l-2 border-muted" v-if="cluster.questions.length > 0">
              <div v-for="q in cluster.questions" :key="q.id" class="text-sm text-muted-foreground py-1 flex justify-between items-center group">
                <span class="truncate pr-2" :title="q.question">{{ q.question }}</span>
                <button @click="deleteQuestionVariant(cluster.id, q.id)" class="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs pr-1 flex-shrink-0">delete</button>
              </div>
            </div>

            <div class="flex justify-between items-center mt-2">
                <p class="text-xs text-muted-foreground/80">{{ cluster.questions.length }} question(s)</p>
                <div class="flex gap-2 items-center">
                  <button 
                    v-if="editingId !== cluster.id"
                    @click="startEdit(cluster.id, cluster.answer)" 
                    class="text-xs text-blue-500 hover:underline"
                  >
                    Edit Answer
                  </button>
                  <template v-if="editingId === cluster.id">
                    <button @click="saveEdit(cluster.id)" class="text-xs text-green-500 hover:underline">Save</button>
                    <button @click="cancelEdit" class="text-xs text-gray-500 hover:underline">Cancel</button>
                  </template>
                  <button @click="deleteAnswer(cluster.id)" class="text-xs text-red-500 hover:underline">Delete Group</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useSavedAnswers } from '@/composables/SavedAnswers';

const { savedAnswers, deleteAnswer, updateAnswer, deleteQuestionVariant } = useSavedAnswers();

// Edit state
const editingId = ref<string | null>(null);
const editingAnswer = ref('');
const editTextarea = ref<HTMLTextAreaElement | null>(null);

const startEdit = async (id: string, currentAnswer: string) => {
  editingId.value = id;
  editingAnswer.value = currentAnswer;
  await nextTick();
  editTextarea.value?.focus();
};

const saveEdit = async (id: string) => {
  if (editingAnswer.value.trim()) {
    await updateAnswer(id, { answer: editingAnswer.value.trim() });
  }
  cancelEdit();
};

const cancelEdit = () => {
  editingId.value = null;
  editingAnswer.value = '';
};
</script>
