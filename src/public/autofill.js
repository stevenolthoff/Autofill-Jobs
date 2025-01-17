window.addEventListener("load", (_) => {
  console.log("Autofill Jobs found page");
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
  dover: {
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    linkedinUrl: "LinkedIn",
    phoneNumber: "Phone",
    resume: "Resume",
  },
  workday: [
    { linkedinQuestion: "LinkedIn" },
    { "file-upload-input-ref": "Resume" },
    { gpa: "GPA" },
    { multiSelectContainer: "Discipline" },
    { degree: "Degree" },
    { school: "School" },
    { "phone-number": "Phone" },
    { "phone-device-type": "Phone Type" },
    { addressSection_postalCode: "Postal/Zip Code" },
    { addressSection_city: "Location (City)" },
    { addressSection_countryRegion: "Location (State/Region)" },
    { addressSection_addressLine1: "Location (Street)" },
    { legalNameSection_lastName: "Last Name" },
    { legalNameSection_firstName: "First Name" },
    { countryDropdown: "Location (Country)" },
  ],
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
        } else {
          form = document.querySelector("form, #mainContent");
          if (form) {
            observer.disconnect();
            autofill(form);
          }
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
        console.log(jobForm);
        if (jobForm == "workday") {
          workDayAutofill(res);
          break;
        }
        for (let jobParam in fields[jobForm]) {
          if (jobParam.toLowerCase() == "resume") {
            chrome.storage.local.get().then(async (localData) => {
              let resumeDiv = {
                greenhouse: "#resume",
                lever: "#resume-upload-input",
                dover:
                  'input[type="file"][accept=".pdf"], input[type="file"][accept="application/pdf"]',
              };
              let el = document.querySelector(resumeDiv[jobForm]);
              el.addEventListener('submit', function(event) {
                event.preventDefault();
              });  
              if (localData.Resume) {
                const dt = new DataTransfer();
                let arrBfr = base64ToArrayBuffer(localData.Resume);

                dt.items.add(
                  new File([arrBfr], `${localData["Resume_name"]}`, {
                    type: "application/pdf",
                  })
                );
                el.files = dt.files;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                await sleep(400);
              }
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
            res[param] = `${res[param] != undefined ? `${res[param]},` : ""} ${
              res["Location (State/Region)"] != undefined
                ? `${res["Location (State/Region)"]},`
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
async function workDayAutofill(res) {
  let wfields = fields.workday;
  while (wfields.length > 0) {
    await sleep(150);

    let [jobParamKey, jobParamValue] = Object.entries(
      wfields[wfields.length - 1]
    )[0];
    //gets param from user data
    const param = jobParamValue;
    const jobParam = jobParamKey;
    console.log(jobParam);
    if (!res[param]) continue;

    let inputElement = document.querySelector(
      `[data-automation-id="${jobParam}"], [data-automation-label="${res[param]}"]`
    );
    if (!inputElement) continue;
    if (jobParam == "multiSelectContainer") {
      inputElement = inputElement.querySelector("div input");
      inputElement.click();
      await sleep(300);
      inputElement.setAttribute("value", res[param]);
      inputElement.value = res[param];
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);
      inputElement.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
        })
      );
      await sleep(200);
      wfields.pop();
      continue;
    }
    if (jobParam == "file-upload-input-ref") {
      chrome.storage.local.get().then(async (localData) => {
        console.log(localData);
        const dt = new DataTransfer();
        let arrBfr = base64ToArrayBuffer(localData.Resume);

        dt.items.add(
          new File([arrBfr], `${localData["Resume_name"]}`, {
            type: "application/pdf",
          })
        );
        inputElement.files = dt.files;
        inputElement.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("filled resume");
        await sleep(400);
        wfields.pop();
      });
      continue;
    }
    inputElement.setAttribute("value", res[param]);
    inputElement.value = res[param];
    inputElement.focus();
    inputElement.blur();
    inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    if (inputElement instanceof HTMLButtonElement) {
      inputElement.click();
      await sleep(250);
      //for the dropdown elements(workday version)
      let dropDown = document.querySelector(
        'ul[role="listbox"][tabindex="-1"]'
      );
      if (dropDown) {
        let btns = dropDown.querySelectorAll("li div");

        btns.forEach((btndiv) => {
          if (
            btndiv.textContent.includes(res[param]) ||
            res[param].includes(btndiv.textContent)
          ) {
            btndiv.click();
          }
        });
      }
    }
    wfields.pop();
  }
}
