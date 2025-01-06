<template>
  <div class="inputFieldDiv">
    <h2>{{ label }}</h2>
    <input v-if="!['Resume','Gender','Hispanic/Latino','Veteran Status','Disability Status'].includes( label) " type="text" :placeholder="placeHolder" v-model="inputValue" @input="saveData" />
    <input v-if="label == 'Resume'" type="file" :placeholder="placeHolder" @change="saveResume" />
    <select v-if="['Gender','Hispanic/Latino','Veteran Status','Disability Status'].includes(label)" v-model="inputValue" @change="saveData">
      <option v-for="option in placeHolder" :key="option" :value="option">{{ option }}</option>
    </select>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue';

export default {
  props: ['label', 'placeHolder'],
  setup(props) {
    // Declare a reactive input value using Vue's ref
    const inputValue = ref('');

    const saveResume = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          if (!e.target?.result) return;
          const b64 = (e.target.result as string).split(',')[1];
          chrome.storage.local.set({ [props.label]: b64 }, () => {
            console.log(`${props.label} saved:`, b64);
          });
        };
        reader.readAsDataURL(file);
      }
    };
    const saveData = () => {
      // Store the value of the input field in chrome storage
      chrome.storage.sync.set({ [props.label]: inputValue.value }, () => {
        console.log(`${props.label} saved:`, inputValue.value);
      });
    };
    const loadData = () => {
      if (!chrome.storage) return;
      chrome.storage.sync.get([props.label], (data) => {

        inputValue.value = data[props.label] || '';  // Default to empty string if no value is found
      });
    };

    // Load data when the component is mounted
    loadData();

    return {
      inputValue,
      saveData,
      saveResume
    };
  },
};
</script>