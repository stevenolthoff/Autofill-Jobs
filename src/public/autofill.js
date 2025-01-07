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
    "Website",
    "school",
    "degree",
    "discipline",
    "start-month",
    "start-year",
    "end-month",
    "end-year",
    "gender",
    "hispanic_ethnicity",
    "veteran_status",
    "disability",
  ],
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
  "Hispanic/Latino",
  "Veteran Status",
  "Disability Status",
];

function awaitForm() {
  // Create a MutationObserver to detect changes in the DOM
  const observer = new MutationObserver((_, observer) => {
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
        let form = null;
        if (jobForm === "greenhouse") {
          form = document.querySelector("#application-form, #application_form");
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
function setNativeValue(el, value) {
  const previousValue = el.value;

  if (el.type === 'checkbox' || el.type === 'radio') {
    if ((!!value && !el.checked) || (!!!value && el.checked)) {
      el.click();
    }
  } else el.value = value;

  const tracker = el._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue);
  }

  // 'change' instead of 'input', see https://github.com/facebook/react/issues/11488#issuecomment-381590324
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function autofill(form) {
  chrome.storage.sync.get().then((res) => {
    console.log(res);
    for (let jobForm in fields) {
      if (window.location.hostname.includes(jobForm)) {
    
       
        //go through stored params
        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          if (res[param]) {
            const translatedParam = fields[jobForm][i];
            let inputElement = form.querySelector(
              `[name="${translatedParam}"], [id="${translatedParam}"], [placeholder="${translatedParam}"], [aria-label*="${translatedParam}"], [aria-labelledby*="${translatedParam}"], [aria-describedby*="${translatedParam}"]`
            );
            if (inputElement) {
              
              setNativeValue(inputElement,res[param]);
              //for the dropdown elements
              let btn = inputElement.closest(".select__control--outside-label");
              if (btn){
                
                const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true, cancelable: true });
                btn.dispatchEvent(mouseUpEvent);
                setTimeout(()=>{
                  const enterEvent = new KeyboardEvent("keydown", {
                    key: "Enter",       
                    code: "Enter",       
                    keyCode: 13,        
                    which: 13,          
                    bubbles: true,
                  });
                  btn.dispatchEvent(enterEvent);

                },200);
                
            }
            }
          }
        }
        break;
      }
    }
  });
}
