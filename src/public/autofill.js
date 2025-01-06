//import { jsPDF } from "jspdf";

window.addEventListener("load", (event) => {
  console.log("Page loaded.");
  awaitForm();
});

const fields = {
  greenhouse: [
    "first_name",
    "last_name",
    "email",
    "phone",
    "LinkedIn",
    "gender",
    "hispanic_ethnicity",
    "veteran_status",
    "disability"
    
  ],
};

const params = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "LinkedIn",
  "Gender",
  "Hispanic/Latino",
  "Veteran Status",
  "Disability Status"
];

function awaitForm() {
  // Create a MutationObserver to detect changes in the DOM
  const observer = new MutationObserver((_, observer) => {
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        let form = null;
        if (jobForm === "greenhouse") {
          form = document.querySelector("#application-form");
        }
        if (form) {
          observer.disconnect();
          autofill(form);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function autofill(form) {
  chrome.storage.sync.get().then((res) => {
    console.log(res);
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        const event = new Event("input", { bubbles: true });
        //go through stored params
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          if (res[param]) {
            const translatedParam = fields[jobForm][i];
            const inputElement = form.querySelector(
              `[name="${translatedParam}"], [id="${translatedParam}"], [placeholder="${translatedParam}"], [aria-label*="${translatedParam}"], [aria-labelledby*="${translatedParam}"], [aria-describedby*="${translatedParam}"]`
            );
            if (inputElement) {
              inputElement.value = res[param];
              inputElement.dispatchEvent(event); //update react state
              console.log(`Autofilled ${param} with ${res[param]}`);
            }
          }
        }
        break;
      }
    }
  });
}
