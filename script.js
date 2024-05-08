//gl reading lol
const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let maxContent = 4000 * 2
let stopAI = false;
let isGenerating = false;
let voice = false;
let lastID = {}
const useFiles = {};
function escapeHtml(unsafe) {
  let clean = unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return DOMPurify.sanitize(clean, { USE_PROFILES: { html: true } });
}
let currentFile = null
async function getCurrentFile() {
  const file = await replit.session.getActiveFile()
  if (file !== null) {
    currentFile = file
  }
  return currentFile
}
getCurrentFile()

let clickTimer = null;

async function copyCodeBlock(codeBlock, event) {
  const textToCopy = codeBlock.textContent;
  const selection = window.getSelection();
  const range = document.createRange();

  range.selectNodeContents(codeBlock);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    await navigator.clipboard.writeText(textToCopy);
    triggerConfetti(event);
    await showMessage('Code block copied!');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    await showMessage('Failed to copy code block!');
  }
}

function triggerConfetti(event) {
  const origin = {
    y: (event.clientY / window.innerHeight),
    x: (event.clientX / window.innerWidth)
  };

  confetti({
    particleCount: 30,
    angle: 180,
    spread: 55,
    origin
  });
  confetti({
    particleCount: 30,
    angle: 0,
    spread: 55,
    origin
  });
}

async function showMessage(message) {
  if (lastID.copy) {
    await replit.messages.hideMessage(lastID.copy);
  }
  lastID.copy = await replit.messages.showConfirm(message, 1500);
}


function getSelectedTextWithin(element) {
  let text = "";
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Check if the selection is within the specified element
    if (element.contains(range.commonAncestorContainer)) {
      text = selection.toString();
    }
  }
  return text;
}

function exportMessageHistory() {
  const messageHistory = extractMessages();
  const dataStr = JSON.stringify(messageHistory);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.download = 'messageHistory-GPTReplit.json';
  link.href = url;
  link.click();
}

async function importMessageHistory(event) {
  await clearMessages()
  messageCounter = 1;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    const messages = JSON.parse(event.target.result);

    messages.forEach(message => {
      if (message.role === "assistant") {
        add_message({ type: "received-msg", text: message.content });
      } else {
        add_message({ type: message.role + "-msg", text: message.content });
      }
    });
  };
  reader.readAsText(file);
  if (lastID.importmessage) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.importmessage = await replit.messages.showConfirm("Successfully imported a new message history", 1500);

}

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('export-messages-button').addEventListener('click', exportMessageHistory);

document.getElementById('import-messages-button').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', importMessageHistory);


function add_message(x, id = null) {
  const chatMessages = document.getElementById('chat-messages');
  const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop < 60;
  let messageDiv = null;
  if (id !== null) {
    messageDiv = document.getElementById(`message-${id}`);
  }
  if (messageDiv === null) {
    messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', x.type);
    if (id !== null) {
      messageDiv.id = `message-${id}`;
    }
    chatMessages.appendChild(messageDiv);
  }

  if (!x.noMD) {
    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((x.text), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
  } else {
    messageDiv.innerHTML = DOMPurify.sanitize(x.text, { USE_PROFILES: { html: true } });
  }

  MathJax.typesetPromise([messageDiv])

  const codeBlocks = messageDiv.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock, index) => {

    const settings = loadRawSettings();
    const copyButtonSetting = settings && settings.copyButton;

    const copyButton = document.createElement('button');
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyButton.classList.add('button');
    copyButton.title = 'Click to copy'
    copyButton.style.position = 'absolute';
    copyButton.style.top = '0';
    copyButton.style.right = '0';

    const footer = document.createElement('div');
    footer.innerText = 'Double-click to copy';
    footer.style.fontSize = '0.8em';
    footer.style.textAlign = 'right';


    if (copyButtonSetting) {
      copyButton.addEventListener('click', (event) => copyCodeBlock(codeBlock, event));
      codeBlock.parentNode.style.position = 'relative';
      codeBlock.parentNode.appendChild(copyButton);
    } else {
      codeBlock.addEventListener('dblclick', (event) => copyCodeBlock(codeBlock, event));
      codeBlock.parentNode.appendChild(footer);
    }


  });
  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  hljs.highlightAll();
}

function playWoosh() {
  const audio = new Audio('woosh.mp3');
  audio.play();
}

async function clearMessages() {
  if (isGenerating) {
    replit.messages.showWarning("Cannot clear messages while generating a response!", 2000);
    return;
  }

  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  messageCounter = 1;
  if (lastID.clear) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.clear = await replit.messages.showConfirm("Cleared message history successfully!", 1500);
}


function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voice = true;
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    document.getElementById('user-message').value = speechResult;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.start();
}

// Check if the browser supports SpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.');
  document.getElementById('voice-input-button').disabled = true;
  document.getElementById('voice-input-button').title = `Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.`;
} else {
  document.getElementById('voice-input-button').addEventListener('click', startVoiceInput);
}
const clearMessagesButton = document.getElementById('clear-messages-button');
clearMessagesButton.addEventListener('click', clearMessages);

async function getSelectedMode() {
  const settings = loadSettings();
  if (settings && settings.model) {
    return settings.model;
  } else {
    const selectElement = document.getElementById("mode");
    const selectedMode = selectElement.options[selectElement.selectedIndex].value;
    return selectedMode;
  }
}

let messageCounter = 1;

async function fetchAssistantResponse(apiKey, mode, history, temperature, server) {
  if (!server) {
    server = 'api.openai.com'
  }
  try {
    let response = await fetch(`https://${server}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        'model': mode,
        'messages': history,
        'temperature': parseFloat(temperature),
        'stream': true
      })
    });
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`)
    }
    return response;

  } catch (error) {
    console.log('There was a problem with the fetch operation: ' + error.message);
    console.log(error)
    isGenerating = false
  }
}

async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  stopAI = false;
  isGenerating = true;
  
  const promptText = document.getElementById("user-message").value;
  if (promptText == "" || promptText == " ") {
    submit.disabled = false;
    stopButton.disabled = true;
    stopAI = false;
    isGenerating = false;
    return;
  }
  messageCounter++;
  const messageId = messageCounter;
  closePopup()
  add_message({ type: 'user-msg', text: escapeHtml(promptText), noMD: true }, messageId);
  document.getElementById("user-message").value = "";
  const apiKey = document.getElementById("KEY").value;
  const yapsettings = loadRawSettings();
  let noyap = "";
  if (yapsettings && yapsettings.hasOwnProperty("noyap") && yapsettings.noyap) {
    noyap = `No yapping, so keep your answers as short as possible. `;
  }
  
  let systemMessage = `You are a helpful programming assistant called Replit-GPT.`;
  const fileContents = {};
  const history = extractMessages();

  if (Object.keys(useFiles).length > 0) {
      let filesInfo = [];
      for (const filePath in useFiles) {
          if (useFiles[filePath]) {
              let fileContent = await replit.fs.readFile(filePath, "utf8");
              if (fileContent.error) {
                  await replit.messages.showError(`Error reading file ${filePath}`, 2000);
              } else {
                  fileContents[filePath] = fileContent.content;
                  let previewLength = Math.floor((maxContent / Object.keys(fileContents).length) - 1000);
                  filesInfo.push(`- File path: ${filePath}\n- File Content Preview: \`\`\`${fileContent.content.substring(0, previewLength)}\`\`\``);
              }
          }
      }

      if (filesInfo.length > 0) {
          systemMessage += " The user might ask something related to the contents of the following file(s):\n" + filesInfo.join('\n');
      }
  }

  history.unshift({ role: "system", content: systemMessage });


  const mode = await getSelectedMode();
  const settings = loadRawSettings();
  const customTemperature = settings && settings.temperature ? parseFloat(settings.temperature) : 0.7;
  let rawsettings = loadRawSettings();
  if (rawsettings == null) {
    rawsettings = {
      server: 'api.openai.com'
    };
  }

  try {
    const response = await fetchAssistantResponse(apiKey, mode, history, customTemperature, rawsettings.server);
    if (response.status !== 200) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.error.message);
    }
    await processResponse(response);
  } catch (error) {
    console.log(`Error fetching response: ${error}`);
    isGenerating = false;
    messageCounter++;
    add_message({ type: 'error-msg', text: `Error fetching response, ${error.message}` }, messageCounter);
  }
  console.log(useFiles)

  submit.disabled = false;
  stopButton.disabled = true;
}


async function processResponse(response) {
  const reader = response.body.getReader();
  let result = '';
  messageCounter++
  if (voice) {
    playWoosh()
  }
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false;
      isGenerating = false;
      stopButton.disabled = true;
      replit.messages.showWarning("Stopped generating!", 1000);
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = new TextDecoder().decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.includes('data: [DONE]')) {
        break;
      }
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5);
        try {
          const data = JSON.parse(jsonStr);
          if (data.choices) {
            for (const { delta } of data.choices) {
              if (delta.content) {
                result += delta.content;
              }
            }
          }
          add_message({ type: 'received-msg', text: result }, messageCounter);
        } catch (error) {
          console.log(`Error parsing JSON: ${error}`);
        }
      }
    }
  }
  isGenerating = false;
  messageCounter++;
}


function extractMessages() {
  const messageHistory = [];
  const chatMessages = document.getElementById('chat-messages');

  for (const messageElement of chatMessages.children) {
    const messageObject = {};

    if (messageElement.classList.contains('user-msg')) {
      messageObject.role = 'user';
    } else if (messageElement.classList.contains('received-msg')) {
      messageObject.role = 'assistant';
    } else if (messageElement.classList.contains('error-msg')) {
      messageObject.role = 'system';
    }

    messageObject.content = messageElement.textContent;
    messageHistory.push(messageObject);
  }
  return messageHistory;
}


submit.addEventListener("click", getResp);
var input = document.getElementById("user-message");

input.addEventListener("keypress", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit.click();
  }
});
stopButton.addEventListener("click", () => {
  stopAI = true;
});

const passwordInput = document.getElementById('KEY');
const savedPassword = localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT|V1.5.3') || localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT');
localStorage.setItem('OPENAI-API-KEY_GPT-REPLIT', savedPassword);

if (savedPassword && passwordInput.value != null) {
  passwordInput.value = savedPassword;
  replit.messages.showNotice("Loaded OpenAI API Key from previous session.", 1000)
}
passwordInput.addEventListener('change', () => {
  localStorage.setItem('OPENAI-API-KEY_GPT-REPLIT', passwordInput.value);
});

function truncateFilename(filename, maxLength) {
  if (filename.length <= maxLength) {
    return filename;
  }

  const middle = maxLength / 2;
  const start = filename.slice(0, middle - 1);
  const end = filename.slice(-middle + 2);
  return `${start}...${end}`;
}


async function updateInputMaxLength() {
  const userMessageInput = document.getElementById("user-message");
  const selectedMode = await getSelectedMode();
  if (selectedMode === "gpt-3.5-turbo") { // times 3 because of the token limit, not character limit
    userMessageInput.maxLength = 15000 * 3;
    maxContent = 15000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4") {
    userMessageInput.maxLength = 7500 * 3;
    maxContent = 7500 * 3
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4-32k") {
    userMessageInput.maxLength = 31500 * 3;
    maxContent = 27000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  }
  else if (selectedMode === "gpt-4-turbo") {
    userMessageInput.maxLength = 125000 * 3;
    maxContent = 125000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  }
  else {
    userMessageInput.maxLength = 15000 * 3;
    maxContent = 3700 * 3
  }
  updateFileTabTitles();
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const numFiles = fileTabs.length + 1;
  const maxFileContent = Math.floor((maxContent / numFiles) - 1000);
  if(maxFileContent < 15000) {
    document.getElementById("file-warning").innerText = `Watch out, if you add a new file we can only read the first ${maxFileContent} characters.`
  } else {
    document.getElementById("file-warning").innerText = ``
  }
}

async function updateAvailableFiles(dropdown, path = './') {
  while (dropdown.options.length > 0) { 
    dropdown.remove(0);
  }
  const excludedFileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.mp3', ".mp4", ".svg", ".pdf", ".xlsx", ".pptx", ".zip", ".rar", "svg"];
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const numFiles = fileTabs.length + 1;
  const maxFileContent = Math.floor((maxContent / numFiles) - 1000);
  if(maxFileContent < 15000) {
    document.getElementById("file-warning").innerText = `Watch out, if you add a new file we can only read the first ${maxFileContent} characters.`
  } else {
    document.getElementById("file-warning").innerText = ``
  }
  
  async function processDirectory(path) {
    const entries = await replit.fs.readDir(path);

    for (const entry of entries.children) {
      if (entry.type === 'DIRECTORY' && !entry.filename.startsWith(".")) {
        await processDirectory(`${path}${entry.filename}/`);
      } else if (entry.type === 'FILE') {
        const fileExtension = entry.filename.slice(entry.filename.lastIndexOf(".")).toLowerCase();
        if (!excludedFileExtensions.includes(fileExtension) && !useFiles[`${path}${entry.filename}`]) {
          const option = document.createElement('option');
          option.value = `${path}${entry.filename}`;
          const displayPath = path.replace(/^\.\//, '') + entry.filename;
          const truncatedFilename = truncateFilename(displayPath, 20);
          option.text = truncatedFilename;
          dropdown.appendChild(option);
        }
      }
    }
  }
  await processDirectory(path);
}

function updateFileTabTitles() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const numFiles = fileTabs.length;

  if (numFiles > 0) {
    const maxFileTabs = Math.floor((maxContent / numFiles) - 1000);
    fileTabs.forEach(tab => {
      const filename = tab.id.replace('file-tab-', '');
      
      tab.title = `GPT-Replit has opened the file '${filename}'. 
The AI only will read the first '${maxFileTabs}' characters'`;
    });
  }
}

function addFileTab(filename, disableDelete = false) {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTab = document.createElement('div');
  fileTab.classList.add('file-tab');
  fileTab.id = `file-tab-${filename}`;
  fileTab.title = `GPT-replit has opened the file ${filename}`;
  fileTab.setAttribute('draggable', 'true');
  const displayName = filename.replace(/^\.\//, '');
  const truncatedFilename = truncateFilename(displayName, 20);
  fileTab.textContent = truncatedFilename;

  // Handle dragging
  if (!disableDelete) {
    fileTab.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', fileTab.id);
      document.getElementById('add-file-button').classList.add('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fas fa-trash-alt"></i>';
    });

    fileTab.addEventListener('dragend', (event) => {
      document.getElementById('add-file-button').classList.remove('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fa-solid fa-plus"></i>';
    });


  }

  const removeButton = document.createElement('button');
  removeButton.innerHTML = '&times;';
  removeButton.title = "Remove file.";
  removeButton.className = "remove-file-button";
  if (disableDelete) {
    removeButton.disabled = true;
  } else {
    removeButton.onclick = function () {
      tabsContainer.removeChild(fileTab);
      useFiles[filename] = false;
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
      }
      updateFileTabTitles();
    };
  }

  useFiles[filename] = true;
  fileTab.appendChild(removeButton);
  tabsContainer.appendChild(fileTab);
  updateFileTabTitles();
}

document.getElementById('add-file-button').addEventListener('dragover', (event) => {
  event.preventDefault();
});

document.getElementById('add-file-button').addEventListener('drop', (event) => {
  event.preventDefault();
  const draggedId = event.dataTransfer.getData('text/plain');
  const draggedElement = document.getElementById(draggedId);
  if (draggedElement && (event.target.classList.contains('trash') || event.target.classList.contains('fa-trash-alt'))) {
    const filename = draggedId.replace('file-tab-', '');
    draggedElement.remove();
    useFiles[filename] = false; 

    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
    }
  }
  document.getElementById('add-file-button').classList.remove('trash');
});



document.getElementById('file-select-btn').addEventListener('click', async function() {
  const dropdown = document.getElementById('file-dropdown');
  const selectedFile = dropdown.value;
  if (selectedFile) {
    addFileTab(selectedFile);
    closePopup()
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      await updateAvailableFiles(dropdown, "./");
    }
  }
});

// Function to open the popup
function openPopup() {
  const popup = document.getElementById('file-popup');
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.classList.add('open'); 
  document.body.classList.add('body-modal-open'); 
}

// Function to close the popup
function closePopup() {
  const popup = document.getElementById('file-popup');
  popup.classList.remove('open'); 
  document.body.classList.remove('body-modal-open'); 
}

document.getElementById('add-file-button').addEventListener('click', openPopup);

document.getElementById('close-popup').addEventListener('click', closePopup);
function dragElement(element) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    //ed the syntax here:
    if (e.target.closest('#file-dropdown') !== null) {
      return;  // Prevent dragging when clicking on elements within '#file-dropdown'
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

dragElement(document.getElementById("file-popup"));

//image handling
let base64Image = null;

document.getElementById('upload-image-button').addEventListener('click', function() {
  return alert("This will be implemented in V1.7.0!")
  if (base64Image) {
    base64Image = null;
    this.innerHTML = '<i class="fa-solid fa-image"></i>';
    this.title = "Upload an image for AI analysis.";
    document.getElementById('image-uploaded-indicator').style.display = 'none';
  } else {
    document.getElementById('image-file-input').click();
  }
});

document.getElementById('image-file-input').addEventListener('change', function(event) {
    // Check if files are selected
    var firstFile = event.target.files[0];
    var reader = new FileReader();

    reader.onload = function(e) {
        var base64Image = e.target.result;
        console.log("Base64 image data:", base64Image);
        document.getElementById('image-uploaded-indicator').style.display = 'block';
        document.getElementById('upload-image-button').innerHTML = '<i class="fa-solid fa-check"></i>';
        document.getElementById('upload-image-button').title = "Image loaded. Click to remove.";
    };

    reader.onerror = function(e) {
        console.error("Error reading file:", e.target.error);
    };

    // Read the file as Data URL (Base64)
    reader.readAsDataURL(firstFile);
});






function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('scroll-to-bottom-button').addEventListener('click', scrollToBottom);

function loadPreviousMode() {
  const previousMode = localStorage.getItem('selectedMode');
  if (previousMode) {
    modeSelector.value = previousMode;
  }
  updateInputMaxLength();
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
  const settings = localStorage.getItem('settings');
  const parsedSettings = settings ? JSON.parse(settings) : null;
  if (parsedSettings && !parsedSettings.used) {
    return {};
  }
  return parsedSettings;
}

function loadRawSettings() {
  const settings = localStorage.getItem('settings');
  return settings ? JSON.parse(settings) : null;
}

const modal = document.getElementById('settings-modal');
const span = document.getElementsByClassName("close")[0];

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

span.onclick = function() {
  modal.style.display = "none";
}

document.getElementById('reset-settings-button').addEventListener('click', async () => {
  // Show confirm dialog
  if (confirm('Are you sure you want to reset the settings to their default values?')) {
    // Clear settings from local storage
    localStorage.removeItem('settings');

    // Reset inputs to default values
    document.getElementById('temperature').value = '0.7';
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = false;
    document.getElementById('noyap-btn').checked = false;
    document.getElementById('custom-server').value = 'api.openai.com';

    if (lastID.reset) {
      await replit.messages.hideMessage(lastID.reset)
    }
    lastID.reset = await replit.messages.showError("Reset settings to default", 5500)
  }
});

document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = loadRawSettings();
  if (settings) {
    document.getElementById('use').checked = settings.hasOwnProperty('used') ? settings.used : false;
    document.getElementById('temperature').value = settings.temp || '0.7';
    document.getElementById('custom-server').value = settings.server || 'api.openai.com';
    document.getElementById('model').value = settings.model || 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = settings.hasOwnProperty('copyButton') ? settings.copyButton : true;
    document.getElementById('noyap-btn').checked = settings.hasOwnProperty('noyap') ? settings.noyap : true;


  }
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('save-settings-button').addEventListener('click', async () => {
  const settings = {
    used: document.getElementById('use').checked,
    temp: document.getElementById('temperature').value,
    model: document.getElementById('model').value,
    copyButton: document.getElementById('copy-button').checked,
    noyap: document.getElementById('noyap-btn').checked,
    server: document.getElementById('custom-server').value,
  };
  saveSettings(settings)

  if (lastID.save) {
    await replit.messages.hideMessage(lastID.save)
  }
  lastID.save = await replit.messages.showNotice("Saved custom settings", 1500)
  modal.style.display = "none";
  await customModelUpdate();
});



async function customModelUpdate() {
  const settings = loadSettings();
  const modelSelect = document.getElementById('mode');

  // Find the disabled option
  const disabledOption = Array.from(modelSelect.options).find(option => option.value === 'disabled');

  if (settings && settings.used) {
    if (!lastID.customModalWarning) {
      lastID.customModalWarning = await replit.messages.showNotice("Watch out, your now using a custom model. We have no system yet to limit the characters so it might error because you used more tokens that it can handle!", 8500)
    }
    if (!disabledOption) {
      const newDisabledOption = document.createElement('option');
      newDisabledOption.textContent = 'Disabled';
      newDisabledOption.value = 'disabled';
      modelSelect.appendChild(newDisabledOption);
    }
    modelSelect.value = 'disabled';  // Select the disabled option
    modelSelect.disabled = true;

  } else {
    // Remove the disabled option if it exists
    if (disabledOption) {
      modelSelect.removeChild(disabledOption);
    }
    modelSelect.disabled = false;
  }
}

setInterval(async function() {
  await customModelUpdate()
}, 60000);

window.onload = function() {
  customModelUpdate()
  loadPreviousMode()
}

const modeSelector = document.getElementById("mode");
modeSelector.addEventListener("change", updateInputMaxLength);