<script setup lang="ts">

import InputField from './components/InputField.vue';

</script>


<template>
  <div>
    <h1>Autofill Jobs</h1>
    <!-- Place this tag where you want the button to render. -->
<a class="github-button" href="https://github.com/andrewmillercode/Autofill-Jobs" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star andrewmillercode/Autofill-Jobs on GitHub">Star</a>
  </div>
  
  <InputField label="First Name" placeHolder="John" />
  <InputField label="Last Name" placeHolder="Pork" />
  <InputField label="Full Name" placeHolder="John Pork Sr." />
  <InputField label="Location (Street)" placeHolder="123 Sesame St" />
  <InputField label="Location (City)" placeHolder="Albuquerque" />
  <InputField label="Location (State)" placeHolder="New Mexico" />
  <InputField label="Location (Country)" placeHolder="United States of America" />
  <InputField label="Email" placeHolder="jpork@mit.edu" />
  <InputField label="Phone" placeHolder="123-345-6789" />
  <InputField label="LinkedIn" placeHolder="linkedin.com/in/johnpork" />
  <InputField label="Website" placeHolder="johnpork.com" />
  <InputField  label="Resume" placeHolder="No file found"/>

  <h2 class="subheading">Education</h2>
  <InputField label="School" placeHolder="Massachusetts Institute of Technology" />
  <InputField label="Degree" :placeHolder="[
    'Associate\'s Degree',
    'Bachelor\'s Degree',
    'Doctor of Medicine (M.D.)',
    'Doctor of Philosophy (Ph.D.)',
    'Engineer\'s Degree',
    'High School',
    'Juris Doctor (J.D.)',
    'Master of Business Administration (M.B.A.)',
    'Master\'s Degree',
    'Other'
  ]" />
  <InputField label="Discipline" placeHolder="Computer Science" />
  <InputField label="Start Date Month" :placeHolder="[
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]" />
  <InputField label="Start Date Year" placeHolder="2024" />
  <InputField label="End Date Month" :placeHolder="[
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]" />
  <InputField label="End Date Year" placeHolder="2025" />


  <h2 class="subheading">Voluntary Identification</h2>
  <InputField label="Gender" :placeHolder="['Male', 'Female', 'Decline To Self Identify']" />
  <InputField label="Race" :placeHolder="[
  'American Indian or Alaskan Native',
  'Asian',
  'Black or African American',
  'White',
  'Native Hawaiian or Other Pacific Islander',
  'Two or More Races',
  'Decline To Self Identify'
]" />
  <InputField label="Hispanic/Latino" :placeHolder="['Yes', 'No', 'Decline To Self Identify']" />
  <InputField label="Veteran Status"
    :placeHolder="['I am not a protected veteran', 'I identify as one or more of the classifications of a protected veteran', 'I don\'t wish to answer']" />
  <InputField label="Disability Status"
    :placeHolder="['Yes, I have a disability, or have had one in the past', 'No, I do not have a disability and have not had one in the past', 'I do not want to answer']" />
</template>
