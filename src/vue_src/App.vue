<script setup lang="ts">
//Component imports
import InputField from '@/components/InputField.vue';
import GridDataField from '@/components/GridDataField.vue';
import GithubStars from '@/components/GithubStars.vue';
import PrivacyToggle from '@/components/PrivacyToggle.vue';
import Explanation from '@/components/Explanation.vue';
import EnterSkill from '@/components/EnterSkill.vue';
import EnterWorkExperience from '@/components/EnterWorkExperience.vue';
import SavedAnswers from '@/components/SavedAnswers.vue';
</script>


<template>
  <EnterWorkExperience/>
  <EnterSkill/>
  <Explanation/>
  
  <div class="p-6 flex flex-col gap-8">
    <header class="flex justify-between items-center">
      <h1 class="text-xl font-semibold text-primary">Autofill Jobs</h1>
      <div class="flex items-center gap-2">
        <GithubStars/>
        <PrivacyToggle/>
      </div>
    </header>

    <main class="flex flex-col gap-10">
      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Personal Details</h2>
        <InputField label="First Name" placeHolder="John" />
        <InputField label="Last Name" placeHolder="Pork" />
        <InputField label="Full Name" placeHolder="John Pork Sr." />
        <InputField label="Email" placeHolder="jpork@mit.edu" />
        <InputField label="Phone" placeHolder="123-345-6789" />
        <InputField label="Phone Type" :placeHolder="['Landline', 'Mobile', 'Office Phone']" />
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Experience</h2>
        <InputField label="Resume" placeHolder="No file found"/>
        <GridDataField label="Work Experience" />
        <GridDataField label="Skills" />
        <InputField label="API Key" explanation="The API Key field requires a Gemini-1.5-flash api key. This field is optional and is used to autofill the work experience and skills fields directly from your resume." placeHolder="AIyKwaSyBTOk..." />
        <InputField label="Current Employer" placeHolder="Apple" />
      </section>
      
      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Socials</h2>
        <InputField label="Twitter/X" placeHolder="https://x.com/" />
        <InputField label="LinkedIn" placeHolder="https://linkedin.com/in/johnpork" />
        <InputField label="Github" placeHolder="https://github.com/andrewmillercode" />
        <InputField label="Website" placeHolder="johnpork.com" />
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Location</h2>
        <InputField label="Location (Street)" placeHolder="123 Sesame St" />
        <InputField label="Location (City)" placeHolder="Albuquerque" />
        <InputField label="Location (State/Region)" placeHolder="New Mexico" />
        <InputField label="Location (Country)" placeHolder="United States of America" />
        <InputField label="Postal/Zip Code" placeHolder="87104" />
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Education</h2>
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
        <InputField label="GPA" placeHolder="3.94" />
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-base font-medium text-muted-foreground">Voluntary Identification</h2>
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
      </section>

      <SavedAnswers />
    </main>
  </div>
</template>
