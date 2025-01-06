<script setup lang="ts">

import InputField from './components/InputField.vue';
//<InputField  label="Resume" placeHolder ="linkedin.com/in/johnpork"/>
</script>


<template>
  <h1>Autofill Jobs</h1>
  <InputField  label="First Name" placeHolder="John"/>
  <InputField  label="Last Name" placeHolder ="Pork"/>
  <InputField  label="Email" placeHolder ="jpork@mit.edu"/>
  <InputField  label="Phone" placeHolder ="123-345-6789"/>
  <InputField  label="LinkedIn" placeHolder ="linkedin.com/in/johnpork"/>
  
  <h2 style="margin-top: 1.5rem;">Voluntary Identification</h2>
  <InputField label="Gender" :placeHolder="['Male', 'Female', 'Decline To Self Identify']"/>
  <InputField label="Hispanic/Latino" :placeHolder="['Yes', 'No', 'Decline To Self Identify']"/>
  <InputField label="Veteran Status" :placeHolder="['I am not a protected veteran', 'I identify as one or more of the classifications of a protected veteran', 'I don\'t wish to answer']"/>
  <InputField label="Disability Status" :placeHolder="['Yes, I have a disability, or have had one in the past', 'No, I do not have a disability and have not had one in the past', 'I do not want to answer']"/>
</template>

