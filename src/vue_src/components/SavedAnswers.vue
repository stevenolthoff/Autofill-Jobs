<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-medium text-muted-foreground">Saved Answers</h2>
    <div class="max-h-60 overflow-y-auto space-y-3 p-1 rounded-md border">
        <div v-if="savedAnswers.length === 0" class="text-sm text-muted-foreground text-center p-4">
            No answers saved yet. Start applying to build your database!
        </div>
        <div v-for="item in savedAnswers" :key="item.id" class="p-3 bg-muted/50 rounded-md">
            <p class="text-sm font-medium text-foreground truncate" :title="item.question">{{ item.question }}</p>
            
            <!-- Answer display/edit area -->
            <div class="mt-1">
              <textarea 
                v-if="editingId === item.id"
                v-model="editingAnswer"
                class="w-full text-sm text-muted-foreground bg-background p-2 rounded border resize-none"
                rows="3"
                @keydown.enter.prevent="saveEdit(item.id)"
                @keydown.escape="cancelEdit"
                ref="editTextarea"
              ></textarea>
              <p 
                v-else 
                class="text-sm text-muted-foreground bg-background p-2 rounded cursor-pointer hover:bg-muted/30 transition-colors" 
                @click="startEdit(item.id, item.answer)"
                :title="'Click to edit'"
              >{{ item.answer }}</p>
            </div>
            
            <div class="flex justify-between items-center mt-2">
                <p class="text-xs text-muted-foreground/80">{{ new Date(item.timestamp).toLocaleDateString() }}</p>
                <div class="flex gap-2">
                  <button 
                    v-if="editingId !== item.id"
                    @click="startEdit(item.id, item.answer)" 
                    class="text-xs text-blue-500 hover:underline"
                  >
                    Edit
                  </button>
                  <button 
                    v-if="editingId === item.id"
                    @click="saveEdit(item.id)" 
                    class="text-xs text-green-500 hover:underline"
                  >
                    Save
                  </button>
                  <button 
                    v-if="editingId === item.id"
                    @click="cancelEdit" 
                    class="text-xs text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                  <button @click="deleteAnswer(item.id)" class="text-xs text-red-500 hover:underline">Delete</button>
                </div>
            </div>
        </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useSavedAnswers } from '@/composables/SavedAnswers';

const { savedAnswers, deleteAnswer, updateAnswer } = useSavedAnswers();

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
