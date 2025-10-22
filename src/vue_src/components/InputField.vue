<template>
  <div class="grid grid-cols-3 items-center gap-4">
    <label :for="label" class="text-sm font-medium text-muted-foreground text-right col-span-1">
      {{ label }}
      <button v-if="explanation" @click="showExplanation" class="inline-flex items-center justify-center align-middle h-4 w-4 rounded-full text-muted-foreground/80 hover:bg-muted ml-1">
        ?
      </button>
    </label>

    <template v-if="!dropDowns.includes(label) && !files.includes(label)">
      <input 
        :id="label"
        class="h-9 px-3 py-2 text-sm col-span-2 bg-transparent rounded-md border border-input ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        :type="hidden" 
        :placeholder="placeHolder"
        v-model="inputValue" 
        @input="saveData" 
        @focus="onFocus" 
        @blur="onBlur" />
    </template>
    
    <template v-if="files.includes(label)">
      <div class="col-span-2">
        <input type="file" :id="label + '-file'" class="sr-only" @change="saveResume" />
        <label :for="label + '-file'" class="inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-primary-foreground bg-primary rounded-md cursor-pointer hover:bg-primary/90">
          Upload File
        </label>
        <span class="ml-3 text-sm text-muted-foreground truncate">{{ inputValue || 'No file selected' }}</span>
      </div>
    </template>

    <template v-if="dropDowns.includes(label)">
      <select 
        :id="label"
        :class="hidden"
        class="h-9 px-3 py-2 text-sm col-span-2 bg-transparent rounded-md border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        v-model="inputValue" 
        @change="dropdownPrivacy">
        <option v-for="option in placeHolder" :key="option" :value="option">{{ option }}</option>
      </select>
    </template>
  </div>
</template>

<script lang="ts">
import { ref, watch } from 'vue';
import { usePrivacy } from '@/composables/Privacy';
import { useExplanation } from '@/composables/Explanation.ts';
import { useResumeDetails } from '@/composables/ResumeDetails';
export default {
  props: ['label', 'placeHolder', 'explanation'],
  data() {
    return {
      dropDowns: ['Gender', 'Hispanic/Latino', 'Veteran Status', 'Disability Status', 'Degree', 'Start Date Month', 'End Date Month', 'Race', 'Phone Type'],
      files: ['Resume']
    };
  },

  setup(props) {
    // Declare a reactive input value using Vue's ref
    const inputValue = ref('');
    // Use the composable
    const { privacy } = usePrivacy();
    const hidden = ref('text');
    const { toggleExplanation, setExplanation } = useExplanation();
    const { loadDetails } = useResumeDetails();
    watch(privacy, (newVal) => {
      hidden.value = newVal ? 'password' : 'text';
    });

    const showExplanation = () => {
      setExplanation(props.explanation);
      toggleExplanation();
    }

    const saveResume = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          if (!e.target?.result) return;
          const b64 = (e.target.result as string).split(',')[1];
          chrome.storage.local.set({ [`${props.label + '_name'}`]: file.name }, () => {
            inputValue.value = file.name
            console.log(`${props.label} + _name saved:`, file.name);
          });
          chrome.storage.local.set({ [props.label]: b64 }, () => {
            console.log(`${props.label} saved:`, b64);
          });

          chrome.storage.sync.get('API Key', (key) => {
            key = key['API Key']
            if (key) {
              //parse resume, return skills
              fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({

                    contents: [
                      {
                        parts: [
                          {
                            text: `Parse this resume (skills section as a single array as a string, no subarrays. Work experience json follows this format experiences:[{jobTitle: ,jobEmployer: ,jobDuration: 'mm/yy-mm/yy', isCurrentEmployer: , roleBulletsString: }]. Return parsed data as {skills:[],experiences:}. Ensure type correctness and make sure skills has 0 subarrays(example: ['AWS','Java']). `,
                          },
                          {
                            'inline_data': {
                              data: b64,
                              'mime_type': 'application/pdf',
                            }
                          }
                        ]
                      },
                    ]


                  })
                }

              ).then((response) => response.json())
                .then((json) => {
                  console.log(json);
                  let res = json.candidates[0].content.parts[0].text;
                  res = res.replace(/```json/, "").replace(/```/, "").replace('\n', " ").trim();
                  chrome.storage.local.set({ [`${props.label + '_details'}`]: res }, () => {
                    console.log(`${props.label} saved:`, res);
                    loadDetails(); //pass details over to others
                  });

                }).catch(e => {
                  console.error(e);
                });
            }
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
        if (inputValue.value == '' && props.label === "Resume") {
          chrome.storage.local.get([`${props.label + '_name'}`], (data) => {

            inputValue.value = data[`${props.label + '_name'}`] || 'No file found';  // Default to empty string if no value is found
          });
        }
      });
    };
    const onFocus = () => {
      if (privacy.value) hidden.value = "text";

    };
    const onBlur = () => {
      if (privacy.value) hidden.value = "password";

    };
    const dropdownPrivacy = () => {
      saveData();
      if (privacy.value) onBlur();
    }
    // Load data when the component is mounted
    loadData();

    return {
      inputValue,
      saveData,
      saveResume,
      hidden,
      onFocus,
      onBlur,
      dropdownPrivacy,
      showExplanation
    };
  },
};
</script>
