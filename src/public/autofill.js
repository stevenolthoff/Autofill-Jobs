//import { jsPDF } from "jspdf";

window.addEventListener("load", (event) => {
  console.log("Page loaded.");
  awaitForm();
});

//Fields per job board map to the stored params array in the extension
const fields = {
  greenhouse: {
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email",
    phone: "Phone",
    LinkedIn: "LinkedIn",
   "candidate-location" : "Location (City)",
    Website: "Website",
    school: "School",
    degree: "Degree",
    discipline: "Discipline",
    "start-month": "Start Date Month",
    "start-year": "Start Date Year",
    "end-month": "End Date Month",
    "end-year": "End Date Year",
    gender: "Gender",
    hispanic_ethnicity: "Hispanic/Latino",
    "race": "Race",
    "react-select-race-placeholder race-error" : "Race",
    veteran_status: "Veteran Status",
    disability:  "Disability Status",
    resume: "Resume",
  },
  lever: {
    "name-input": "Full Name",
    "email-input": "Email",
    "phone-input": "Phone",
    "urls[LinkedIn]": "LinkedIn",
    "urls[Linkedin]": "LinkedIn",
    "urls[Portfolio]": "Website",
   
  },
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);

  // Create a new ArrayBuffer and copy the binary string into it
  const arrayBuffer = new ArrayBuffer(binaryString.length);
  const view = new Uint8Array(arrayBuffer);

  // Convert binary string to an array of bytes
  for (let i = 0; i < binaryString.length; i++) {
    view[i] = binaryString.charCodeAt(i);
  }

  return arrayBuffer;
}
function awaitForm() {
  // Create a MutationObserver to detect changes in the DOM
  const observer = new MutationObserver((_, observer) => {
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        let form = document.querySelector(
          "#application-form, #application_form"
        );
        if (form) {
          observer.disconnect();
          autofill(form);
        }
        break; //found site
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  if (window.location.hostname.includes("lever")) {
    let form = document.querySelector("#application-form, #application_form");
    if (form) autofill(form);
  }
}
function setNativeValue(el, value) {
  if (el.type === "checkbox" || el.type === "radio") {
    if ((!!value && !el.checked) || (!!!value && el.checked)) {
      el.click();
    }
  } else el.value = value;

  // 'change' instead of 'input', see https://github.com/facebook/react/issues/11488#issuecomment-381590324
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
async function autofill(form) {
  chrome.storage.sync.get().then(async (res) => {
    sleep(200);
    console.log(res);
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        //go through stored params

        for (let jobParam in fields[jobForm]) {
          if (jobParam.toLowerCase() == "resume") {
            chrome.storage.local.get().then((localData) => {
                let el = document.querySelector(`#resume`);
                const dt = new DataTransfer();
                let arrBfr = base64ToArrayBuffer(localData.Resume);

                dt.items.add(
                  new File([arrBfr], `${localData['Resume_name']}`, { type: "application/pdf" })
                );
                el.files = dt.files;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                sleep(400);
            });
            continue;
          }

          let longDelay = false;
          //gets param from user data
          const param = fields[jobForm][jobParam];
          if (!res[param]) continue;

          let inputElement = form.querySelector(
            `[id="${jobParam}"], [name="${jobParam}"], [placeholder="${jobParam}"], [aria-label*="${jobParam}"], [aria-labelledby*="${jobParam}"], [aria-describedby*="${jobParam}"], [data-qa*="${jobParam}]`
          );
          if (!inputElement) continue;
          
          if (param === "Location (City)"){
            longDelay = true;
            res[param] = `${res[param]},${res["Location (State)"]}`
          }

          setNativeValue(inputElement, res[param]);
          //for the dropdown elements
          let btn = inputElement.closest(".select__control--outside-label");
          if (!btn) continue;

          btn.dispatchEvent(new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
          }));

          
          await sleep(longDelay ? 1000 : 400);
          btn.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
          }));
          await sleep(400);  
          
        }
        scrollToTop();
        break; //found site
      }
    }
  });
}

