//import { jsPDF } from "jspdf";

window.addEventListener("load", (event) => {
  console.log("Page loaded.");
  awaitForm();
});

//Fields per job board map to the stored params array in the extension
const fields = {
  greenhouse: {
    first_name: 0,
    last_name: 1,
    email: 2,
    phone: 3,
    LinkedIn: 4,
    Website: 5,
    school: 6,
    degree: 7,
    discipline: 8,
    "start-month": 9,
    "start-year": 10,
    "end-month": 11,
    "end-year": 12,
    gender: 13,
    race: 14,
    hispanic_ethnicity: 15,
    veteran_status: 16,
    disability: 17,
    resume: 19,
  },
  lever: {
    "name-input": 18,
    "email-input": 2,
    "phone-input": 3,
    "urls[LinkedIn]": 4,
    "urls[Linkedin]": 4,
    "urls[Portfolio]": 5,
    school: 6,
    degree: 7,
    discipline: 8,
    "start-month": 9,
    "start-year": 10,
    "end-month": 11,
    "end-year": 12,
    gender: 13,
    race: 14,
    hispanic_ethnicity: 15,
    veteran_status: 16,
    disability: 17,
  },
};

const params = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "LinkedIn",
  "Website",
  "School",
  "Degree",
  "Discipline",
  "Start Date Month",
  "Start Date Year",
  "End Date Month",
  "End Date Year",
  "Gender",
  "Race",
  "Hispanic/Latino",
  "Veteran Status",
  "Disability Status",
  "Full Name",
  "Resume",
];
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
function autofill(form) {
  chrome.storage.sync.get().then((res) => {
    console.log(res);
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        //go through stored params

        for (let jobParam in fields[jobForm]) {
          if (jobParam.toLowerCase() == "resume") {
            chrome.storage.local.get().then((f) => {
              setTimeout(() => {
                let el = document.querySelector(`#resume`);
                const dt = new DataTransfer();
                let arrBfr = base64ToArrayBuffer(f.Resume);

                dt.items.add(
                  new File([arrBfr], "resume.pdf", { type: "application/pdf" })
                );
                el.files = dt.files;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                window.scrollTo({ top: 0, behavior: "instant" });
              }, 1000);
            });
            continue;
          }
          //gets converted param
          const param = params[fields[jobForm][jobParam]];
          if (!res[param]) continue;

          let inputElement = form.querySelector(
            `[name="${jobParam}"], [id="${jobParam}"], [placeholder="${jobParam}"], [aria-label*="${jobParam}"], [aria-labelledby*="${jobParam}"], [aria-describedby*="${jobParam}"], [data-qa*="${jobParam}]`
          );
          if (!inputElement) continue;

          setNativeValue(inputElement, res[param]);
          //for the dropdown elements
          let btn = inputElement.closest(".select__control--outside-label");
          if (!btn) continue;

          const mouseUpEvent = new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
          });
          btn.dispatchEvent(mouseUpEvent);
          window.scrollTo({ top: 0, behavior: "instant" });
          setTimeout(() => {
            const enterEvent = new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
            });
            btn.dispatchEvent(enterEvent);
            window.scrollTo({ top: 0, behavior: "instant" });
          }, 400);
        }
        window.scrollTo({ top: 0, behavior: "instant" });
        break; //found site
      }
    }
  });
}
