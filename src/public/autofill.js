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
    "candidate-location": "Location (City)",
    Website: "Website",
    resume: "Resume",
    school: "School",
    degree: "Degree",
    discipline: "Discipline",
    "start-month": "Start Date Month",
    "start-year": "Start Date Year",
    "end-month": "End Date Month",
    "end-year": "End Date Year",
    gender: "Gender",
    hispanic_ethnicity: "Hispanic/Latino",
    race: "Race",
    "react-select-race-placeholder race-error": "Race",
    veteran_status: "Veteran Status",
    disability: "Disability Status",
  },
  lever: {
    resume: "Resume",
    name: "Full Name",
    email: "Email",
    phone: "Phone",
    location: "Location (City)",
    "urls[LinkedIn]": "LinkedIn",
    "urls[GitHub]": "Github",
    "urls[Linkedin]": "LinkedIn",
    "urls[Portfolio]": "Website",
    "eeo[gender]": "Gender",
    "eeo[race]": "Race",
    "eeo[veteran]": "Veteran Status",
    "eeo[disability]": "Disability Status",
    "eeo[disabilitySignature]": "Full Name",
    "eeo[disabilitySignatureDate]": "Current Date",
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  } else if (el instanceof HTMLSelectElement) {
    for (let o of el.children) {
      if (o.value.toLowerCase().includes(value.toLowerCase())) {
        el.value = o.value;
        break;
      }
    }
  } else el.value = value;

  // 'change' instead of 'input', see https://github.com/facebook/react/issues/11488#issuecomment-381590324
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
async function autofill(form) {
  chrome.storage.sync.get().then(async (res) => {
    res["Current Date"] = `${new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date())}`;
    sleep(200);
    console.log(res);
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        //go through stored params

        for (let jobParam in fields[jobForm]) {
          if (jobParam.toLowerCase() == "resume") {
            chrome.storage.local.get().then((localData) => {
              let resumeDiv = {
                greenhouse: "#resume",
                lever: "#resume-upload-input",
              };
              let el = document.querySelector(resumeDiv[jobForm]);
              const dt = new DataTransfer();
              let arrBfr = base64ToArrayBuffer(localData.Resume);

              dt.items.add(
                new File([arrBfr], `${localData["Resume_name"]}`, {
                  type: "application/pdf",
                })
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

          if (param === "Location (City)") {
            longDelay = true;
            res[param] = `${res[param] != undefined ? `${res[param]},` : ""}${
              res["Location (State)"] != undefined
                ? `${res["Location (State)"]},`
                : ""
            }${
              res["Location (Country)"] != undefined
                ? `${res["Location (Country)"]},`
                : ""
            }`;
            if (res[param][res[param].length - 1] == ",")
              res[param] = res[param].slice(0, res[param].length - 1);
          }
          if (param === "Gender") longDelay = true;
          setNativeValue(inputElement, res[param]);
          //for the dropdown elements
          let btn = inputElement.closest(".select__control--outside-label");
          if (!btn) continue;

          btn.dispatchEvent(
            new MouseEvent("mouseup", {
              bubbles: true,
              cancelable: true,
            })
          );

          await sleep(longDelay ? 1000 : 300);
          btn.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
            })
          );
          await sleep(300);
        }
        scrollToTop();
        break; //found site
      }
    }
  });
}
