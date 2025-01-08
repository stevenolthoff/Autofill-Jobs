<template>
    <button @click="triggerAutofill">Trigger Autofill</button>
  </template>
  
  <script lang="ts">

  export default {
    methods: {
      triggerAutofill() {
        // Get the current active tab in the browser
        chrome.tabs.query({ active: true, currentWindow: true }, () => {
          // Send a message to the content script on the active tab
          chrome.tabs.sendMessage(0, { action: 'triggerAutofill' }, (response) => {
            if (response && response.status === 'success') {
              console.log("Autofill triggered successfully.");
            }
          });
        });
      }
    }
  };
  </script>