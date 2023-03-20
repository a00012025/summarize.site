const defaultValues = {
  prompt:
    "You are acting as a summarization AI, and for the input text please summarize it to the most important 3 to 5 bullet points for brevity: ",
  apiKey: "",
  suffix:
    "Please briefly summarize it to the most important 3 to 5 bullet points in English.",
};
const defaultChineseValues = {
  prompt:
    "對於給定的文字給我三到五個最重要的總結，要求簡明扼要不要有多餘的文字，並用中文輸出。輸入開始：",
  apiKey: "",
  suffix: "請用中文輸出結果，不要使用英文",
};

function setElementValueById(id, value) {
  document.getElementById(id).value = value;
}

function setDefaultValues() {
  for (const k of Object.keys(defaultValues)) {
    chrome.storage.sync.get(k, function (items) {
      setElementValueById(k, items[k] || defaultValues[k]);
    });
  }
}

function show_save_status() {
  var status = document.getElementById("status");
  status.textContent = "Options saved.";
  setTimeout(function () {
    status.textContent = "";
  }, 750);
}

function saveOptions() {
  let options = {};
  for (const k of Object.keys(defaultValues)) {
    options[k] = document.getElementById(k).value;
  }
  chrome.storage.sync.set(options, show_save_status);
}

function restoreOptionsWith(defaults) {
  return () => {
    chrome.storage.sync.set(defaults, function () {
      for (const k of Object.keys(defaults)) {
        setElementValueById(k, defaults[k]);
      }
      show_save_status();
    });
  };
}

setDefaultValues();
document.getElementById("saveButton").addEventListener("click", saveOptions);
document
  .getElementById("resetButton")
  .addEventListener("click", restoreOptionsWith(defaultValues));
document
  .getElementById("resetChineseButton")
  .addEventListener("click", restoreOptionsWith(defaultChineseValues));
