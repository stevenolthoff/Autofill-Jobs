let initTime;
window.addEventListener("load", (_) => {
  console.log("AutofillJobs: found job page.");
  initTime = new Date().getTime();
  awaitForm();
});
const applicationFormQuery =
  "#application-form, #application_form, #applicationform";
//Fields per job board map to the stored params array in the extension
const fields = {
  greenhouse: {
    first_name: "First Name",
    last_name: "Last Name",
    "Preferred Name": "Full Name",
    email: "Email",
    phone: "Phone",
    LinkedIn: "LinkedIn",
    Github: "Github",
    Twitter: "Twitter/X",
    X: "Twitter/X",
    "candidate-location": "Location (City)",
    Website: "Website",
    Portfolio: "Website",
    Employer: "Current Employer",
    "Current Company": "Current Employer",
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
    org: "Current Employer",
    company: "Current Employer",
    employer: "Current Employer",
    "urls[LinkedIn]": "LinkedIn",
    "urls[GitHub]": "Github",
    "urls[Linkedin]": "LinkedIn",
    "urls[X]": "Twitter/X",
    "urls[Twitter]": "Twitter/X",
    "urls[Portfolio]": "Website",
    "urls[Link to portfolio]": "Website",
    website: "Website",
    portfolio: "Website",
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
    phone: "Phone",
    linkedinUrl: "LinkedIn",
    github: "Github",
    phoneNumber: "Phone",
    resume: "Resume",
  },
  workday: {
    "My Information": {
      country: "Location (Country)",
      firstName: "First Name",
      lastName: "Last Name",
      addressLine1: "Location (Street)",
      addressSection_countryRegion: "Location (State/Region)",
      city: "Location (City)",
      postal: "Postal/Zip Code",
      "phone-device-type": "Phone Type",
      phoneType: "Phone Type",
      "phone-number": "Phone",
      phoneNumber: "Phone",
    },
    "My Experience": {
      schoolName: "School",
      degree: "Degree",
      fieldOfStudy: "Discipline",
      gradeAverage: "GPA",
      "file-upload-input-ref": "Resume",
      linkedin: "LinkedIn",
    },
    "Voluntary Disclosures": {
      ethnicity: "Race",
      race: "Race",
      gender: "Gender",
      veteran: "Veteran Status",
      disability: "Disability Status",
    },
    "Self Identify": {
      name: "Full Name",
      "month-input": "Current Date",
      "day-input": "Current Date",
      "year-input": "Current Date",
    },
  },
};
/*
    { linkedinQuestion: "LinkedIn" },
    { "file-upload-input-ref": "Resume" },
    { gpa: "GPA" },
    { multiSelectContainer: "Discipline" },
    { degree: "Degree" },
    { school: "School" }

*/
const enterEvent = new KeyboardEvent("keydown", {
  key: "Enter",
  code: "Enter",
  keyCode: 13,
  which: 13,
  bubbles: true,
});
const mouseUpEvent = new MouseEvent("mouseup", {
  bubbles: true,
  cancelable: true,
});
const changeEvent = new Event("change", { bubbles: true });

//timing delays (ms)
const initialDelay = 1000;
const shortDelay = 200;
const longDelay = 600;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function inputQuery(jobParam, form) {
  let normalizedParam = jobParam.toLowerCase();
  let inputElement = Array.from(form.querySelectorAll("input")).find(
    (input) => {
      const attributes = [
        input.id?.toLowerCase().trim(),
        input.name?.toLowerCase().trim(),
        input.placeholder?.toLowerCase().trim(),
        input.getAttribute("aria-label")?.toLowerCase().trim(),
        input.getAttribute("aria-labelledby")?.toLowerCase().trim(),
        input.getAttribute("aria-describedby")?.toLowerCase().trim(),
        input.getAttribute("data-qa")?.toLowerCase().trim(),
      ];

      for (let i = 0; i < attributes.length; i++) {
        if (
          attributes[i] != undefined &&
          attributes[i].includes(normalizedParam)
        ) {
          return true;
        }
      }
      return false;
    }
  );
  return inputElement;
}

function workdayQuery(jobParam, form, type) {
  let normalizedParam = jobParam.toLowerCase();
  let inputElement = Array.from(form.querySelectorAll(type)).find((input) => {
    const attributes = [
      input.id?.toLowerCase().trim(),
      input.name?.toLowerCase().trim(),
      input.getAttribute("data-automation-id")?.toLowerCase().trim(),
      input.getAttribute("data-automation-label")?.toLowerCase().trim(),
    ];

    for (let i = 0; i < attributes.length; i++) {
      if (
        attributes[i] != undefined &&
        attributes[i].includes(normalizedParam) &&
        !attributes[i].includes("phonecode")
      ) {
        return true;
      }
    }
    return false;
  });
  return inputElement;
}

function formatCityStateCountry(data, param) {
  let formattedStr = `${data[param] != undefined ? `${data[param]},` : ""} ${
    data["Location (State/Region)"] != undefined
      ? `${data["Location (State/Region)"]},`
      : ""
  }`;
  if (formattedStr[formattedStr.length - 1] == ",")
    formattedStr = formattedStr.slice(0, formattedStr.length - 1);
  return formattedStr;
}
function curDateStr() {
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date())}`;
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
async function awaitForm() {
  // Create a MutationObserver to detect changes in the DOM
  const observer = new MutationObserver((_, observer) => {
    for (let jobForm in fields) {
      if (!window.location.hostname.includes(jobForm)) continue;
      //workday
      if (jobForm == "workday") {
        autofill(null);
        observer.disconnect();
        return;
      }
      let form = document.querySelector(applicationFormQuery);
      if (form) {
        observer.disconnect();
        autofill(form);
        return;
      } else {
        form = document.querySelector("form, #mainContent");
        if (form) {
          observer.disconnect();
          autofill(form);
          return;
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
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
function getTimeElapsed() {
  let cur = new Date().getTime();
  return ((cur - initTime) / 1000).toFixed(3);
}
async function autofill(form) {
  console.log("Autofill Jobs: Starting autofill.");
  chrome.storage.sync.get().then(async (res) => {
    res["Current Date"] = curDateStr();
    await sleep(initialDelay);
    for (let jobForm in fields) {
      if (!window.location.hostname.includes(jobForm)) continue;
      if (jobForm == "workday") {
        workDayAutofill(res);
        return;
      }
      for (let jobParam in fields[jobForm]) {
        if (jobParam.toLowerCase() == "resume") {
          chrome.storage.local.get().then(async (localData) => {
            await sleep(shortDelay);
            let resumeDiv = {
              greenhouse: 'input[id="resume"]',
              lever: 'input[id="resume-upload-input"]',
              dover:
                'input[type="file"][accept=".pdf"], input[type="file"][accept="application/pdf"]',
            };
            let el = document.querySelector(resumeDiv[jobForm]);
            if (!el) {
              //old greenhouse forms
              el = document.querySelector('input[type="file"]');
            }
            el.addEventListener("submit", function (event) {
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
              el.dispatchEvent(changeEvent);
              await sleep(shortDelay);
            }
          });
          continue;
        }

        let useLongDelay = false;
        //gets param from user data
        const param = fields[jobForm][jobParam];
        let fillValue = res[param];
        if (!fillValue) continue;
        let inputElement = inputQuery(jobParam, form);
        if (!inputElement) continue;

        if (param === "Gender" || "Location (City)") useLongDelay = true;
        if (param === "Location (City)")
          fillValue = formatCityStateCountry(res, param);

        setNativeValue(inputElement, fillValue);
        //for the dropdown elements
        let btn = inputElement.closest(".select__control--outside-label");
        if (!btn) continue;

        btn.dispatchEvent(mouseUpEvent);
        await sleep(useLongDelay ? longDelay : shortDelay);
        btn.dispatchEvent(enterEvent);
        await sleep(shortDelay);
      }
      scrollToTop();
      console.log(`Autofill Jobs: Complete in ${getTimeElapsed()}s.`);
      break; //found site
    }
  });
}
function getCurStageWorkday(form) {
  if (!form) return null;
  let progressBar = form.querySelector('[data-automation-id="progressBar"]');
  if (!progressBar) return null;
  let curStep = progressBar.querySelector(
    '[data-automation-id="progressBarActiveStep"]'
  );
  return curStep.children[2].textContent;
}
async function workDayAutofill(res) {
  await sleep(initialDelay);
  let wrkDayFields = Object.assign({}, fields.workday);
  const observer = new MutationObserver(async (_, observer) => {
    let curStage = getCurStageWorkday(document);
    if (curStage && wrkDayFields[curStage]) {
      await sleep(2000);
      for (let jobParam in wrkDayFields[curStage]) {
        let useLongDelay = false;
        //gets param from user data
        const param = wrkDayFields[curStage][jobParam];
        if (param.toLowerCase() == "resume") {
          let inputElement = workdayQuery(jobParam, document, "input");
          console.log(jobParam, inputElement);
          chrome.storage.local.get().then(async (localData) => {
            const dt = new DataTransfer();
            let arrBfr = base64ToArrayBuffer(localData.Resume);

            dt.items.add(
              new File([arrBfr], `${localData["Resume_name"]}`, {
                type: "application/pdf",
              })
            );
            inputElement.files = dt.files;
            inputElement.dispatchEvent(changeEvent);
            console.log("AutofillJobs: Resume Uploaded.");
            await sleep(longDelay);
          });
          delete wrkDayFields[curStage][jobParam];
          continue;
        }
        let fillValue = res[param];
        if (!fillValue) {
          delete wrkDayFields[curStage][jobParam];
          continue;
        }

        let inputElement = workdayQuery(jobParam, document, "input");
        console.log(jobParam, inputElement);
        if (inputElement != undefined) {
          //text fields
          if (jobParam == "month-input") {
            fillValue = res["Current Date"].split("/")[1];
          }
          if (jobParam == "day-input") {
            fillValue = res["Current Date"].split("/")[0];
          }
          if (jobParam == "year-input") {
            fillValue = res["Current Date"].split("/")[2];
          }
          if (param == "Discipline") {
            let dropElement = document.querySelector(
              "[data-automation-id='multiselectInputContainer']"
            );
            dropElement.click();
            await sleep(1000);
            let inputElement = document.querySelector(
              "#education-4--fieldOfStudy"
            );
            inputElement.value = fillValue;
            inputElement.setAttribute("value", fillValue);

            await sleep(500);
            inputElement.dispatchEvent(enterEvent);
            inputElement.dispatchEvent(
              new KeyboardEvent("keyup", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
              })
            );
            await sleep(1000);
            let el = document.querySelector(
              ".ReactVirtualized__Grid__innerScrollContainer"
            );
            if (el != undefined) {
              let backupOption = undefined;
              for (let o of el.children) {
                if (
                  o
                    .getAttribute("aria-label")
                    .toLowerCase()
                    .includes(fillValue.toLowerCase())
                ) {
                  if (
                    o.getAttribute("aria-label").toLowerCase().includes("|")
                  ) {
                    backupOption = o.children[o];
                    continue;
                  }
                  backupOption = undefined;
                  o.children[0].click();
                  break;
                }
              }
              if (backupOption != undefined) backupOption.click();
              delete wrkDayFields[curStage][jobParam];
              continue;
            }
          }
          inputElement.setAttribute("value", fillValue);
          inputElement.value = fillValue;
          inputElement.focus();
          inputElement.blur();
          inputElement.dispatchEvent(changeEvent);
          await sleep(shortDelay);

          delete wrkDayFields[curStage][jobParam];
          continue;
        }
        let dropdownElement = workdayQuery(jobParam, document, "button");
        console.log(jobParam, dropdownElement);
        if (dropdownElement != undefined) {
          dropdownElement.click();
          await sleep(longDelay);
          //for the dropdown elements(workday version)
          let dropDown = document.querySelector(
            'ul[role="listbox"][tabindex="-1"]'
          );
          if (dropDown) {
            let btns = dropDown.querySelectorAll("li div");
            let normalizedParam = fillValue.toLowerCase().trim();
            if (normalizedParam.includes("decline")) fillValue = "decline";
            btns.forEach((btndiv) => {
              if (
                btndiv.textContent.toLowerCase().includes(normalizedParam) ||
                normalizedParam.includes(btndiv.textContent.toLowerCase()) ||
                (btndiv.textContent.toLowerCase().includes("self") &&
                  fillValue == "decline")
              ) {
                btndiv.click();
              }
            });
            await sleep(shortDelay);
            dropdownElement.blur();
          }

          delete wrkDayFields[curStage][jobParam];
          continue;
        }

        delete wrkDayFields[curStage][jobParam];
        /*
        let selectElement = workdayQuery(jobParam,document,"div");
        if (selectElement) {
          selectElement = selectElement.querySelector("div input");
          selectElement.click();
            await sleep(longDelay);
            
            selectElement.value = res[param];
            selectElement.dispatchEvent(changeEvent);
            await sleep(shortDelay);
            selectElement.dispatchEvent(enterEvent);
            await sleep(shortDelay);

            delete wrkDayFields[curStage][jobParam];
          continue;
        }
        */
        //if (!inputElement) continue;
        /*
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
            const dt = new DataTransfer();
            let arrBfr = base64ToArrayBuffer(localData.Resume);
    
            dt.items.add(
              new File([arrBfr], `${localData["Resume_name"]}`, {
                type: "application/pdf",
              })
            );
            inputElement.files = dt.files;
            inputElement.dispatchEvent(new Event("change", { bubbles: true }));
            console.log("AutofillJobs: Resume Uploaded.");
            await sleep(400);
            wfields.pop();
          });
          continue;
        }
          */
        //delete wrkDayFields[curStage][jobParam]
        // console.log(wrkDayFields[curStage].hasKey(jobParam))
        // inputElement.setAttribute("value", res[param]);
        /*
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
        */
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  /*
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
        const dt = new DataTransfer();
        let arrBfr = base64ToArrayBuffer(localData.Resume);

        dt.items.add(
          new File([arrBfr], `${localData["Resume_name"]}`, {
            type: "application/pdf",
          })
        );
        inputElement.files = dt.files;
        inputElement.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("AutofillJobs: Resume Uploaded.");
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
  */
}
